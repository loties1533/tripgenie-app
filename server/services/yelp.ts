/**
 * @fileoverview Yelp Fusion API — restaurants réels par ville.
 * Retourne les meilleurs restaurants avec notes, prix et catégorie.
 * Docs : https://docs.developer.yelp.com/reference/v3_business_search
 */

import 'dotenv/config';
import type { Activite, TravelMode, ActivityLinks } from '../lib/types.js';

const YELP_API_KEY = process.env.YELP_API_KEY;
const BASE = 'https://api.yelp.com/v3';

// Catégories Yelp selon le mode
const MODE_YELP_CATEGORIES: Record<TravelMode, string> = {
  party:    'bars,nightlife,cocktailbars',
  luxury:   'restaurants,frenchrestaurants,wine_bars',
  student:  'restaurants,streetfood,cafes',
  group:    'restaurants,brasseries,buffets',
  relax:    'restaurants,cafes,tea',
  surprise: 'restaurants,newamerican,fusion',
};

interface YelpBusiness {
  id: string;
  name: string;
  rating: number;
  price?: string;         // "$" | "$$" | "$$$" | "$$$$"
  categories: Array<{ alias: string; title: string }>;
  location: { city: string; address1?: string };
  url: string;
  image_url?: string;
}

interface YelpResponse {
  businesses: YelpBusiness[];
  total: number;
}

function encode(str: string): string {
  return encodeURIComponent(str?.trim() ?? '');
}

function priceFromSymbol(price?: string): number {
  const map: Record<string, number> = { '$': 15, '$$': 35, '$$$': 65, '$$$$': 120 };
  return price ? (map[price] ?? 30) : 30;
}

function restaurantLinks(name: string, city: string): ActivityLinks {
  return {
    viator:       `https://www.thefork.fr/recherche?q=${encode(name + ' ' + city)}`,
    getyourguide: `https://www.google.com/search?q=${encode(name + ' ' + city + ' réservation')}`,
    airbnb:       `https://www.yelp.fr/search?find_desc=restaurants&find_loc=${encode(city)}`,
  };
}

/**
 * Retourne les meilleurs restaurants Yelp pour une ville selon le mode.
 * Retourne [] si YELP_API_KEY absente ou aucun résultat.
 */
export async function yelpRestaurantSearch(
  city: string,
  mode: TravelMode
): Promise<Activite[]> {
  if (!YELP_API_KEY) {
    console.warn('⚠️ Yelp ignoré (YELP_API_KEY manquante).');
    return [];
  }

  try {
    const categories = MODE_YELP_CATEGORIES[mode] ?? 'restaurants';

    const params = new URLSearchParams({
      location:   city,
      categories,
      sort_by:    'rating',
      limit:      '3',
    });

    const res = await fetch(`${BASE}/businesses/search?${params}`, {
      headers: {
        Authorization: `Bearer ${YELP_API_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Yelp ${res.status}: ${await res.text()}`);

    const data = await res.json() as YelpResponse;

    if (!data.businesses?.length) {
      console.warn(`⚠️ Yelp: 0 restaurant trouvé pour ${city}`);
      return [];
    }

    console.log(`✅ Yelp: ${data.businesses.length} restaurants trouvés pour ${city}`);

    return data.businesses.map(b => ({
      name:        b.name,
      category:    b.categories[0]?.title ?? 'Restaurant',
      emoji:       '🍽️',
      description: `${b.categories[0]?.title ?? 'Restaurant'} · ${b.price ?? '$$'} · ⭐ ${b.rating}/5`,
      duration:    '1h30',
      price:       priceFromSymbol(b.price),
      price_range: b.price ?? '$$',
      booking_url: `https://www.thefork.fr/recherche?q=${encode(b.name + ' ' + city)}`,
      links:       restaurantLinks(b.name, city),
    }));

  } catch (err) {
    console.error('❌ Yelp error:', (err as Error).message);
    return [];
  }
}
