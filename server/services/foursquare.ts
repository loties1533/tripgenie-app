/**
 * @fileoverview Foursquare Places API — restaurants et bars réels par ville.
 * 1000 requêtes/jour gratuites. Docs : https://location.foursquare.com/developer/
 */

import 'dotenv/config';
import type { Activite, TravelMode, ActivityLinks } from '../lib/types.js';

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
// Nouvelle API Places (FSQ OS Places) — l'ancienne (api.foursquare.com/v3) est
// décommissionnée depuis le 15 mai 2026. Auth = Service Key en Bearer + header de version.
const BASE = 'https://places-api.foursquare.com';
const PLACES_API_VERSION = '2025-06-17';

const MODE_QUERY: Record<TravelMode, string> = {
  party:    'bar,nightclub,lounge',
  luxury:   'fine dining,restaurant,wine bar',
  student:  'restaurant,cafe,street food',
  group:    'restaurant,brasserie,buffet',
  relax:    'cafe,restaurant,tea room',
  surprise: 'restaurant,bistro,fusion',
};

interface FSQPlace {
  fsq_place_id: string;     // renommé (était fsq_id en v3)
  name: string;
  rating?: number;          // champ PREMIUM — absent en free tier
  price?: number;           // champ PREMIUM — absent en free tier
  categories: Array<{ fsq_category_id?: string; name: string }>;
  location: { locality?: string; address?: string };
}

interface FSQResponse {
  results: FSQPlace[];
}

function encode(str: string): string {
  return encodeURIComponent(str?.trim() ?? '');
}

function priceLabel(price?: number): string {
  return ['', '$', '$$', '$$$', '$$$$'][price ?? 2] ?? '$$';
}

function priceNum(price?: number): number {
  return [0, 15, 35, 65, 120][price ?? 2] ?? 35;
}

function restaurantLinks(name: string, city: string): ActivityLinks {
  return {
    viator:       `https://www.thefork.fr/recherche?q=${encode(name + ' ' + city)}`,
    getyourguide: `https://www.google.com/search?q=${encode(name + ' ' + city + ' réservation')}`,
    airbnb:       `https://foursquare.com/explore?q=restaurants&near=${encode(city)}`,
  };
}

export async function foursquareRestaurantSearch(
  city: string,
  mode: TravelMode
): Promise<Activite[]> {
  if (!FOURSQUARE_API_KEY) {
    console.warn('⚠️ Foursquare ignoré (FOURSQUARE_API_KEY manquante).');
    return [];
  }

  try {
    // Free tier : on NE demande PAS rating/price ni sort=RATING (champs/tri premium
    // → HTTP 429). On garde les champs gratuits (nom, catégories, localisation).
    const params = new URLSearchParams({
      near:  city,
      query: MODE_QUERY[mode] ?? 'restaurant',
      limit: '3',
    });

    const res = await fetch(`${BASE}/places/search?${params}`, {
      headers: {
        Authorization:          `Bearer ${FOURSQUARE_API_KEY}`,
        'X-Places-Api-Version': PLACES_API_VERSION,
        Accept:                 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Foursquare ${res.status}`);

    const data = await res.json() as FSQResponse;
    if (!data.results?.length) return [];

    console.log(`✅ Foursquare: ${data.results.length} lieux trouvés pour ${city}`);

    return data.results.map(p => ({
      name:        p.name,
      category:    p.categories[0]?.name ?? 'Restaurant',
      emoji:       '🍽️',
      description: [
        p.categories[0]?.name ?? 'Restaurant',
        p.location?.locality,
        p.rating ? `⭐ ${p.rating}/10` : null,   // affiché seulement si dispo (premium)
      ].filter(Boolean).join(' · '),
      duration:    '1h30',
      price:       priceNum(p.price),
      price_range: priceLabel(p.price),
      booking_url: `https://www.google.com/maps/search/?api=1&query=${encode(p.name + ' ' + city)}`,
      links:       restaurantLinks(p.name, city),
    }));

  } catch (err) {
    console.error('❌ Foursquare error:', (err as Error).message);
    return [];
  }
}
