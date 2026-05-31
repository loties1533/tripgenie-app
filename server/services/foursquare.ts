/**
 * @fileoverview Foursquare Places API — restaurants et bars réels par ville.
 * 1000 requêtes/jour gratuites. Docs : https://location.foursquare.com/developer/
 */

import 'dotenv/config';
import type { Activite, TravelMode, ActivityLinks } from '../lib/types.js';

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
const BASE = 'https://api.foursquare.com/v3';

const MODE_QUERY: Record<TravelMode, string> = {
  party:    'bar,nightclub,lounge',
  luxury:   'fine dining,restaurant,wine bar',
  student:  'restaurant,cafe,street food',
  group:    'restaurant,brasserie,buffet',
  relax:    'cafe,restaurant,tea room',
  surprise: 'restaurant,bistro,fusion',
};

interface FSQPlace {
  fsq_id: string;
  name: string;
  rating?: number;
  price?: number;
  categories: Array<{ id: number; name: string }>;
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
    const params = new URLSearchParams({
      near:   city,
      query:  MODE_QUERY[mode] ?? 'restaurant',
      sort:   'RATING',
      limit:  '3',
      fields: 'fsq_id,name,rating,price,categories,location',
    });

    const res = await fetch(`${BASE}/places/search?${params}`, {
      headers: { Authorization: FOURSQUARE_API_KEY, Accept: 'application/json' },
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
      description: `${p.categories[0]?.name ?? 'Restaurant'} · ${priceLabel(p.price)} · ⭐ ${p.rating ?? '?'}/10`,
      duration:    '1h30',
      price:       priceNum(p.price),
      price_range: priceLabel(p.price),
      booking_url: `https://www.thefork.fr/recherche?q=${encode(p.name + ' ' + city)}`,
      links:       restaurantLinks(p.name, city),
    }));

  } catch (err) {
    console.error('❌ Foursquare error:', (err as Error).message);
    return [];
  }
}
