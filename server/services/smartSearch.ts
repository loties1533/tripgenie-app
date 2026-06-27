/**
 * @fileoverview Recherches web via Tavily pour vols, événements et hôtels.
 * Chaque fonction extrait des données réelles + URLs cliquables.
 */

import { searchWeb } from './tools/webSearch.js';
import { callAI, parseJSON } from './claude/index.js';
import { predictHQEventsSearch } from './predictHQ.js';
import type { TravelMode, FlightLinks, HotelLinks, ActivityLinks } from '../lib/types.js';

function encode(str: string): string {
  return encodeURIComponent(str?.trim() ?? '');
}

function flightLinks(origin: string, destination: string, departure?: string): FlightLinks {
  const dep = departure?.slice(0, 10).replace(/-/g, '') ?? '';
  return {
    skyscanner: `https://www.skyscanner.fr/transport/flights/${encode(origin)}/${encode(destination)}/${dep}/`,
    kayak:      `https://www.kayak.fr/flights/${encode(origin)}-${encode(destination)}/${departure ?? ''}`,
    google:     `https://www.google.com/travel/flights?q=vols+${encode(origin)}+${encode(destination)}`,
  };
}

function hotelLinks(hotelName: string, city: string): HotelLinks {
  // N'ajoute pas la ville si elle est déjà dans le nom (LLM inclut souvent "Mandarin Oriental, Miami")
  const searchTerm = hotelName.toLowerCase().includes(city.toLowerCase())
    ? hotelName
    : `${hotelName} ${city}`;
  return {
    booking: `https://www.booking.com/searchresults.html?ss=${encode(searchTerm)}`,
    hotels:  `https://fr.hotels.com/search.do?q-destination=${encode(city)}&q-localised-check-in=&q-room-0-adults=2`,
    google:  `https://www.google.com/travel/hotels/${encode(city)}?q=${encode(hotelName)}`,
  };
}

function activityLinks(activityName: string, city: string): ActivityLinks {
  return {
    // Google Search : fiable pour n'importe quel événement, jamais de 404
    viator:       `https://www.google.com/search?q=${encode(activityName + ' ' + city + ' tickets')}`,
    getyourguide: `https://www.getyourguide.fr/s/?q=${encode(activityName + ' ' + city)}`,
    airbnb:       `https://www.airbnb.fr/experiences/search?q=${encode(city)}`,
  };
}

// ---- Interfaces pour les résultats ----

export interface FlightSearchResult {
  price: number;
  airline: string;
  outbound_time: string;
  arrival_time: string;
  duration: string;
  stops: string;
  booking_url: string | null;
  links: FlightLinks;
}

export interface EventSearchResult {
  title: string;
  category: string;
  start: string;
  venue: string;
  description: string;
  booking_url: string | null;
  links: ActivityLinks;
}

export interface HotelSearchResult {
  name: string;
  loc: string;
  hl: string;
  stars: number;
  price_per_night: number;
  booking_url: string | null;
  links: HotelLinks;
}

interface SmartFlightParams {
  origin: string;
  destination: string;
  departure: string;
  return_date?: string;
}

interface SmartEventsParams {
  location: string;
  dateFrom?: string;
  dateTo?: string;
  mode: TravelMode;
}

interface SmartHotelParams {
  location: string;
  mode: TravelMode;
}


export async function smartFlightSearch({
  origin, destination, departure, return_date,
}: SmartFlightParams): Promise<FlightSearchResult | null> {
  try {
    const query = `vols ${origin} ${destination} ${departure} prix compagnies aériennes`;
    const webContext = await searchWeb(query);
    if (!webContext) return null;

    const prompt = `
Voici des résultats web pour des vols de ${origin} à ${destination} :
${webContext}

Extrais le meilleur vol trouvé. RÈGLES STRICTES :
- "price" = prix EN EUROS par personne pour UN billet aller simple. Minimum 50€.
- Si tu vois un prix < 50€, IGNORE-LE. Si aucun prix fiable, estime un prix réaliste.

Retourne UNIQUEMENT ce JSON :
{
  "price": 150,
  "airline": "Compagnie",
  "outbound_time": "10:30",
  "arrival_time": "14:00",
  "duration": "2h30",
  "stops": "Direct",
  "booking_url": null
}`;

    const resRaw = await callAI(prompt, undefined, 'pack');
    const data = parseJSON(resRaw) as Omit<FlightSearchResult, 'links'>;
    return { ...data, links: flightLinks(origin, destination, departure) };
  } catch (err) {
    console.error('SmartFlightSearch error:', (err as Error).message);
    return null;
  }
}

export async function smartEventsSearch({
  location, dateFrom, dateTo, mode,
}: SmartEventsParams): Promise<EventSearchResult[]> {

  // ── 1. PredictHQ en priorité : données structurées réelles, pas de LLM parsing ──
  try {
    const phqEvents = await predictHQEventsSearch(
      location,
      dateFrom ?? new Date().toISOString().slice(0, 10),
      dateTo  ?? dateFrom ?? new Date().toISOString().slice(0, 10),
      mode
    );
    if (phqEvents.length > 0) return phqEvents;
  } catch (err) {
    console.warn('⚠️ PredictHQ fallback:', (err as Error).message);
  }

  // ── 2. Fallback Tavily + LLM si PredictHQ ne retourne rien ──
  try {
    const query = (mode === 'luxury' || mode === 'party')
      ? `exclusive VIP parties private clubs best nightlife ${location} ${dateFrom ?? ''}`
      : `événements spectacles concerts incontournables ${location} ${dateFrom ?? ''}`;

    const webContext = await searchWeb(query);
    if (!webContext) return [];

    const prompt = `
Voici des résultats web pour des événements à ${location} :
${webContext}

Extrais les 3 meilleurs événements. "category" et "description" rédigés EN FRANÇAIS. Retourne UNIQUEMENT un tableau JSON :
[
  {
    "title": "Nom",
    "category": "Nightlife",
    "start": "${dateFrom ?? 'Pendant le séjour'}",
    "venue": "Lieu",
    "description": "Description courte.",
    "booking_url": null
  }
]`;

    const resRaw = await callAI(prompt, undefined, 'destinations');
    const parsed = parseJSON(resRaw);
    const events: Omit<EventSearchResult, 'links'>[] = Array.isArray(parsed) ? parsed : [];

    return events.map(e => ({ ...e, links: activityLinks(e.title, location) }));
  } catch (err) {
    console.error('SmartEventsSearch error:', (err as Error).message);
    return [];
  }
}

export async function smartHotelSearch({ location, mode }: SmartHotelParams): Promise<HotelSearchResult[]> {
  try {
    const query = mode === 'student'
      ? `best hostels affordable hotels ${location} booking price`
      : `best luxury 5 star hotels ${location} booking price`;

    const webContext = await searchWeb(query);
    if (!webContext) return [];

    const prompt = `
Voici des résultats web pour des hôtels à ${location} :
${webContext}

Extrais les 2 meilleurs hôtels avec leur VRAI nom (ex: "Nobu Hotel Ibiza Bay", "Hard Rock Hotel Ibiza").
Le point fort "hl" rédigé EN FRANÇAIS.
⚠️ Si tu ne trouves aucun vrai nom d'hôtel dans ce texte, retourne exactement [].
Ne jamais inventer ou mettre un placeholder. Retourne UNIQUEMENT un tableau JSON :
[
  {
    "name": "Vrai nom de l'hôtel",
    "loc": "Quartier",
    "hl": "Point fort en français",
    "stars": 4,
    "price_per_night": 150,
    "booking_url": null
  }
]`;

    const resRaw = await callAI(prompt, undefined, 'destinations');
    const parsed = parseJSON(resRaw);
    const raw: Omit<HotelSearchResult, 'links'>[] = Array.isArray(parsed) ? parsed : [];

    const PLACEHOLDER = /données|disponible|n\/a|pas de|aucun|inconnu|unknown|placeholder/i;
    const hotels = raw.filter(h => h.name && h.name.length > 3 && !PLACEHOLDER.test(h.name));

    if (hotels.length) console.log(`✅ SmartHotelSearch: ${hotels.length} hôtels trouvés pour ${location}`);
    else console.warn(`⚠️ SmartHotelSearch: aucun hôtel valide pour ${location} — fallback LLM`);

    return hotels.map(h => ({ ...h, links: hotelLinks(h.name, location) }));
  } catch (err) {
    console.error('SmartHotelSearch error:', (err as Error).message);
    return [];
  }
}
