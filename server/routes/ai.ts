// =============================================
// TRIPGENIE — server/routes/ai.ts
// Routes du pipeline IA : génération de packs, chat de modification,
// onboarding conversationnel et suggestions de destinations.
// =============================================

import express from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { aiGenerateLimiter, aiChatLimiter } from '../middleware/limiter.js';
import { analyzeRequest, suggestDestinations, assemblePack, chatModify, chatIntake } from '../services/claude/index.js';
import { scorepack } from '../services/scoring.js';
import { smartFlightSearch, smartEventsSearch, smartHotelSearch } from '../services/smartSearch.js';
import { yelpRestaurantSearch } from '../services/yelp.js';
import { foursquareRestaurantSearch } from '../services/foursquare.js';
import { getRealWeather } from '../services/weather.js';
import { getDestinationPhoto } from '../services/photo.js';
import prisma from '../db/prisma.js';
import type { Prisma } from '@prisma/client';
import { MODES, DEFAULT_VALUES } from '../lib/constants.js';
import { AppError } from '../lib/AppError.js';
import type { TravelMode } from '../lib/types.js';
import type { FlightSearchResult, EventSearchResult, HotelSearchResult } from '../services/smartSearch.js';
import type { WeatherData } from '../services/weather.js';

const router = express.Router();

const travelModeSchema = z.enum(['party', 'student', 'luxury', 'group', 'relax', 'surprise']);
const nonEmptyString = z.string().trim().min(1);
const currentPackSchema = z.any().optional().refine((value) => {
  return value === undefined || (typeof value === 'object' && value !== null && !Array.isArray(value));
}, { message: 'current_pack invalide' }).superRefine((value, ctx) => {
  if (value !== undefined) {
    const size = JSON.stringify(value).length;
    if (size > 50000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'current_pack trop volumineux (max 50ko)' });
    }
  }
});

const analyzeSchema = z.object({
  input: nonEmptyString.max(1000, 'Message trop long (max 1000 caractères)'),
});

const destinationsSchema = z.object({
  mode: travelModeSchema,
  budget: z.number().int().min(0).optional(),
  travelers: z.number().int().min(1).max(20).optional(),
  duration: z.number().int().min(1).optional(),
  origin: z.string().trim().min(1).optional(),
  preferences: z.array(z.string()).optional(),
  departure: z.string().trim().optional(),
});

const onboardingSchema = z.object({
  currentData: z.record(z.string(), z.unknown()).optional(),
  userMessage: nonEmptyString.max(1000, 'Message trop long'),
});

const generateSchema = z.object({
  destination: nonEmptyString,
  origin: z.string().trim().optional(),
  departure: nonEmptyString,
  return_date: z.string().trim().optional().nullable(),
  travelers: z.preprocess((val) => typeof val === 'string' ? Number(val) : val, z.number().int().min(1).max(20)).optional(),
  budget: z.preprocess((val) => typeof val === 'string' ? Number(val) : val, z.number().int().min(1).max(50000)),
  mode: travelModeSchema.optional(),
  preferences: z.array(z.string()).optional(),
});

const chatSchema = z.object({
  message: nonEmptyString.max(1000, 'Message trop long'),
  current_pack: currentPackSchema.optional(),
  mode: travelModeSchema.optional(),
  trip_id: z.string().uuid('trip_id invalide').optional(),
});

// ---- POST /api/ai/analyze ----
router.post('/analyze', aiChatLimiter, optionalAuth, validateBody(analyzeSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { input } = req.body;
    if (!input?.trim()) {
      res.status(400).json({ error: 'input requis' });
      return;
    }
    if (input.length > 1000) {
      res.status(400).json({ error: 'Message trop long (max 1000 car.)' });
      return;
    }

    const analysis = await analyzeRequest(input);
    res.json({ analysis });

  } catch (err) {
    console.error('AI analyze error:', (err as Error).message);
    next(err);
  }
});

// ---- POST /api/ai/destinations ----
router.post('/destinations', aiGenerateLimiter, optionalAuth, validateBody(destinationsSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { mode, budget, travelers, duration, origin, preferences, departure } = req.body;

    const result = await suggestDestinations({ mode, budget, travelers, duration, origin, preferences, departure });
    res.json(result);

  } catch (err) {
    console.error('AI destinations error:', (err as Error).message);
    next(err);
  }
});

// ---- POST /api/ai/onboarding ----
router.post('/onboarding', aiChatLimiter, optionalAuth, validateBody(onboardingSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentData, userMessage } = req.body;

    const result = await chatIntake({ currentData, userMessage });
    res.json(result);

  } catch (err) {
    console.error('AI onboarding error:', (err as Error).message);
    next(err);
  }
});

/**
 * POST /api/ai/generate — Point d'entrée du pipeline de génération.
 *
 * Pipeline orchestré en 4 étapes séquentielles :
 *
 * 1. Validation des inputs (Zod-like, manuel)
 *
 * 2. Recherche web PARALLÈLE via Promise.allSettled :
 *    - smartFlightSearch  → Tavily : vols réels
 *    - smartEventsSearch  → Tavily : événements locaux
 *    - smartHotelSearch   → Tavily : hôtels
 *    - getRealWeather     → Open-Meteo
 *    - getDestinationPhoto → Unsplash (proxy)
 *
 *    Promise.allSettled est utilisé à la place de Promise.all pour que
 *    l'échec d'un service externe (ex: météo en panne) ne bloque pas
 *    toute la génération. Le pack est créé avec les données disponibles.
 *
 * 3. assemblePack() → LLM (Gemini / OpenRouter / Claude en fallback)
 *    génère le pack JSON structuré avec les données réelles injectées.
 *
 * 4. scorepack() → Algorithme déterministe (zéro IA) qui note le pack
 *    de 0 à 1 selon des poids définis par mode de voyage.
 *
 * @requires optionalAuth — le pack est sauvegardé si l'utilisateur est connecté
 * @requires aiGenerateLimiter — 10 générations/heure/IP (coût LLM)
 */
router.post('/generate', aiGenerateLimiter, optionalAuth, validateBody(generateSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      destination,
      origin      = DEFAULT_VALUES.ORIGIN,
      departure,
      return_date,
      travelers   = DEFAULT_VALUES.TRAVELERS,
      budget,
      mode        = MODES.PARTY,
    } = req.body;

    // ---- RECHERCHE WEB (Tavily + IA) avec Timeout de sécurité ----
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);

    let results: [
      PromiseSettledResult<FlightSearchResult | null>,
      PromiseSettledResult<EventSearchResult[]>,
      PromiseSettledResult<HotelSearchResult[]>,
      PromiseSettledResult<WeatherData | null>,
      PromiseSettledResult<string | null>
    ] = [] as unknown as [
      PromiseSettledResult<FlightSearchResult | null>,
      PromiseSettledResult<EventSearchResult[]>,
      PromiseSettledResult<HotelSearchResult[]>,
      PromiseSettledResult<WeatherData | null>,
      PromiseSettledResult<string | null>
    ];
    // Photo et météo : rapides → séparées du batch Tavily pour ne pas être
    // tuées par le timeout de 25s si Tavily est lent
    const photoPromise   = getDestinationPhoto(destination).catch(() => null);
    const weatherPromise = getRealWeather(destination, departure).catch(() => null);
    // Foursquare en premier (1000/jour), Yelp en fallback (500/jour) — les deux gardés
    const restaurantsPromise = foursquareRestaurantSearch(destination, mode as TravelMode)
      .then(r => r.length > 0 ? r : yelpRestaurantSearch(destination, mode as TravelMode))
      .catch(() => []);

    // Timeout individuel 20s par service : si events timeout, vols + hôtels sont préservés
    // (avant : timeout global 25s qui jetait TOUT si un seul service était lent)
    results = await Promise.allSettled([
      withTimeout(smartFlightSearch({ origin, destination, departure, return_date }), 30000),
      withTimeout(smartEventsSearch({ location: destination, dateFrom: departure, dateTo: return_date || departure, mode }), 30000),
      withTimeout(smartHotelSearch({ location: destination, mode }), 30000),
      Promise.resolve(null),  // placeholder météo (fetchée séparément)
      Promise.resolve(null),  // placeholder photo (fetchée séparément)
    ]);

    // On attend photo, météo et Yelp indépendamment du timeout Tavily
    const realPhoto       = await photoPromise;
    const realWeather     = await weatherPromise;
    const restaurants     = await restaurantsPromise;

    const aiFlight = results[0].status === 'fulfilled' ? results[0].value : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let flights: any[] = [];

    if (aiFlight) {
      flights = [{
        id: 'AI-SEARCH',
        price: aiFlight.price * travelers,
        price_per_person: aiFlight.price,
        outbound: {
          from: origin, to: destination, airline: aiFlight.airline,
          departure_time: aiFlight.outbound_time, arrival_time: aiFlight.arrival_time,
          duration_min: (() => { const m = aiFlight.duration?.match(/(\d+)h(\d+)?/); return m ? (parseInt(m[1]||'0')*60 + parseInt(m[2]||'0')) : 180; })(),
          stops: aiFlight.stops === 'Direct' ? 0 : 1
        },
        return: {
          from: destination, to: origin, airline: aiFlight.airline,
          departure_time: '18:00', arrival_time: '20:00',
          duration_min: 120, stops: 0
        }
      }];
    }

    const events     = results[1].status === 'fulfilled' ? results[1].value : [];
    const realHotels = results[2].status === 'fulfilled' ? results[2].value : [];
    if (results[1].status === 'rejected') console.warn('Events API fallback:', results[1].reason);

    const pack = await assemblePack({
      destination,
      origin,
      flights: aiFlight ? [aiFlight] : [],
      events,
      hotels: realHotels,
      mode: mode as TravelMode,
      travelers,
      budget,
      departure,
      return_date,
      realWeather,
      realPhoto,
    });

    // Merge restaurants Yelp dans les activités (si Yelp a retourné des résultats)
    if (restaurants.length > 0) {
      pack.activities = [...(pack.activities ?? []), ...restaurants];
      console.log(`🍽️  Restaurants: ${restaurants.length} lieux ajoutés aux activités`);
    }

    // ---- Scoring réel via scoring.js ----
    const bestFlight = flights[0] ?? null;
    const hotelData = pack.hotels?.[0] || null;
    
    const scoreResult = scorepack(
      {
        vol: bestFlight 
          ? { price: bestFlight.price, duration_min: bestFlight.outbound?.duration_min, stops: bestFlight.outbound?.stops } 
          : { price: budget * 0.25, duration_min: 180, stops: 0 }, // Simulation intelligente pour le score
        hotel: hotelData 
          ? { stars: hotelData.stars || 4, price_per_night: parseInt(hotelData.price_per_night?.replace('€','') || '150'), rating: 8.5 } 
          : { stars: 4, price_per_night: 150, rating: 8 },
        events,
        activities: pack.activities ?? [],
        totalPrice: budget
      },
      mode as TravelMode,
      travelers,
      destination
    );

    const scoredPack = {
      ...pack,
      flights_data: flights,
      events_data:  events,
      score: scoreResult
    };

    // Sauvegarde si user connecté — trip + pack dans UNE transaction.
    // Si l'insert du pack échoue, ROLLBACK : pas de trip orphelin sans pack.
    let tripId: string | null = null;
    let packId: string | null = null;
    if (req.user) {
      const saved = await prisma.$transaction(async (tx) => {
        const trip = await tx.trip.create({
          data: {
            user_id:     req.user!.id,
            title:       `Voyage à ${destination}`,
            destination,
            origin,
            departure:   new Date(departure),
            return_date: return_date ? new Date(return_date) : null,
            travelers,
            budget:      String(budget),
            mode,
            status:      'draft',
            // cast structurel : le pack est JSON-sérialisable (champs optionnels → InputJsonValue)
            pack_data:   scoredPack as unknown as Prisma.InputJsonValue,
            score:       scoreResult.total,
          },
          select: { id: true },
        });
        const pack = await tx.pack.create({
          data: { trip_id: trip.id, rank: 1, score: scoreResult.total, pack_data: scoredPack as unknown as Prisma.InputJsonValue, selected: true },
          select: { id: true },
        });
        return { tripId: trip.id, packId: pack.id };
      });
      tripId = saved.tripId;
      packId = saved.packId;
    }

    res.json({
      pack:          scoredPack,
      trip_id:       tripId,
      pack_id:       packId,
      flights_found: flights.length,
      events_found:  events.length,
      score:         scoreResult.total
    });

  } catch (err) {
    console.error('AI generate error:', (err as Error).message);
    next(err);
  }
});

/**
 * POST /api/ai/chat — Modification conversationnelle post-génération.
 *
 * C'est la seule partie vraiment "agentique" de TripGenie :
 * le LLM reçoit le pack actuel + le message utilisateur et décide
 * librement quels éléments modifier, sans étapes prédéfinies.
 *
 * Contrairement à /generate (pipeline fixe), ici le modèle
 * choisit lui-même ce qu'il modifie dans le pack.
 *
 * Si l'utilisateur est connecté et qu'un trip_id est fourni,
 * les modifications sont persistées en base de données.
 *
 * @requires aiChatLimiter — 30 messages/15min/IP
 */
router.post('/chat', aiChatLimiter, optionalAuth, validateBody(chatSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message, current_pack, mode, trip_id } = req.body;

    const result = await chatModify({
      currentPack: current_pack,
      userMessage: message,
      mode: mode as TravelMode
    });

    // MAJ DB si user connecté et trip existant — updateMany scopé par user_id
    // garantit qu'on ne modifie jamais le voyage d'un autre (isolation).
    if (req.user && trip_id && result.modifications) {
      await prisma.trip.updateMany({
        where: { id: trip_id, user_id: req.user.id },
        data:  { pack_data: { ...current_pack, ...result.modifications } as Prisma.InputJsonValue },
      });
    }

    res.json(result);

  } catch (err) {
    console.error('AI chat error:', (err as Error).message);
    next(err);
  }
});

export default router;
