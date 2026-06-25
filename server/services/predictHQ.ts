/**
 * @fileoverview Intégration PredictHQ — événements réels par ville et dates.
 * PredictHQ retourne des données structurées (concerts, festivals, sports…)
 * sans passer par un LLM pour parser les résultats.
 *
 * Docs : https://docs.predicthq.com/api/events
 */

import 'dotenv/config';
import type { TravelMode, ActivityLinks } from '../lib/types.js';
import type { EventSearchResult } from './smartSearch.js';

const PREDICTHQ_API_KEY = process.env.PREDICTHQ_API_KEY;
const BASE = 'https://api.predicthq.com/v1';

// Catégories PredictHQ selon le mode de voyage
const MODE_CATEGORIES: Record<TravelMode, string> = {
  party:    'concerts,festivals',
  luxury:   'concerts,performing-arts,festivals',
  student:  'concerts,festivals,community,sports',
  group:    'concerts,festivals,sports,community',
  relax:    'performing-arts,community',
  surprise: 'concerts,festivals,performing-arts,community',
};

interface PHQPlace {
  id: string;
  name: string;
  type: string;
}

interface PHQEvent {
  id: string;
  title: string;
  category: string;
  start: string;
  description?: string;
  entities?: Array<{ name: string; type: string }>;
  local_rank?: number;
  rank?: number;
}

function encode(str: string): string {
  return encodeURIComponent(str?.trim() ?? '');
}

function eventLinks(title: string, city: string): ActivityLinks {
  return {
    viator:       `https://www.viator.com/search?q=${encode(title + ' ' + city)}`,
    getyourguide: `https://www.getyourguide.fr/s/?q=${encode(title + ' ' + city)}`,
    airbnb:       `https://www.airbnb.fr/experiences/search?q=${encode(city)}`,
  };
}

/** Étape 1 : récupère l'identifiant de lieu PredictHQ pour une ville */
async function getPlaceId(city: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${BASE}/places/?q=${encode(city)}&limit=1`,
      {
        headers: { Authorization: `Bearer ${PREDICTHQ_API_KEY}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { results?: PHQPlace[] };
    return data.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Recherche les événements réels pour une ville et des dates données.
 * Utilise l'ID de lieu PredictHQ pour un filtrage précis par ville.
 * Retourne [] si pas de clé API ou aucun événement trouvé.
 */
export async function predictHQEventsSearch(
  city: string,
  dateFrom: string,
  dateTo: string,
  mode: TravelMode
): Promise<EventSearchResult[]> {
  if (!PREDICTHQ_API_KEY) {
    console.warn('⚠️ PredictHQ ignoré (PREDICTHQ_API_KEY manquante).');
    return [];
  }

  try {
    const placeId = await getPlaceId(city);
    const categories = MODE_CATEGORIES[mode] ?? 'concerts,festivals';

    const params = new URLSearchParams({
      'active.gte':   dateFrom,
      'active.lte':   dateTo || dateFrom,
      category:       categories,
      sort:           'local_rank',
      limit:          '6',
    });

    // Filtre par lieu si trouvé, sinon recherche texte sur la ville
    if (placeId) {
      params.set('place.scope', placeId);
    } else {
      params.set('q', city);
    }

    const res = await fetch(`${BASE}/events/?${params}`, {
      headers: { Authorization: `Bearer ${PREDICTHQ_API_KEY}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // 401 = clé invalide/expirée (PredictHQ est payant, essai limité). Non bloquant :
      // on log proprement et smartEventsSearch bascule sur Tavily pour les événements.
      if (res.status === 401) {
        console.warn('⚠️ PredictHQ ignoré (clé invalide ou expirée) — fallback événements via Tavily.');
        return [];
      }
      throw new Error(`PredictHQ ${res.status}: ${await res.text()}`);
    }

    const data = await res.json() as { count: number; results: PHQEvent[] };

    if (!data.results?.length) {
      console.warn(`⚠️ PredictHQ: 0 événement pour ${city} (${dateFrom} → ${dateTo})`);
      return [];
    }

    console.log(`✅ PredictHQ: ${data.results.length} événements trouvés pour ${city}`);

    return data.results.slice(0, 6).map(e => ({
      title:       e.title,
      category:    e.category.replace(/-/g, ' '),
      start:       e.start.slice(0, 10),
      venue:       e.entities?.find(en => en.type === 'venue')?.name ?? city,
      description: e.description ?? `${e.category} à ${city}`,
      booking_url: null,
      links:       eventLinks(e.title, city),
    }));

  } catch (err) {
    console.warn('⚠️ PredictHQ indisponible (fallback Tavily) :', (err as Error).message);
    return [];
  }
}
