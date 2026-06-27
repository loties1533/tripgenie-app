/**
 * @fileoverview Foursquare Places API — restaurants et bars réels par ville.
 * 1000 requêtes/jour gratuites. Docs : https://location.foursquare.com/developer/
 */

import 'dotenv/config';
import type { Activite, TravelMode, ActivityLinks } from '../lib/types.js';

const CLE_FOURSQUARE = process.env.FOURSQUARE_API_KEY;
// Nouvelle API Places (FSQ OS Places) — l'ancienne (api.foursquare.com/v3) est
// décommissionnée depuis le 15 mai 2026. Auth = Service Key en Bearer + header de version.
const URL_BASE_FOURSQUARE = 'https://places-api.foursquare.com';
const VERSION_API_PLACES = '2025-06-17';

const REQUETES_PAR_MODE: Record<TravelMode, string> = {
  party:    'bar,nightclub,lounge',
  luxury:   'fine dining,restaurant,wine bar',
  student:  'restaurant,cafe,street food',
  group:    'restaurant,brasserie,buffet',
  relax:    'cafe,restaurant,tea room',
  surprise: 'restaurant,bistro,fusion',
};

interface LieuFoursquare {
  fsq_place_id: string;     // renommé (était fsq_id en v3)
  name: string;
  rating?: number;          // champ PREMIUM — absent en free tier
  price?: number;           // champ PREMIUM — absent en free tier
  categories: Array<{ fsq_category_id?: string; name: string }>;
  location: { locality?: string; address?: string };
}

interface ReponseFoursquare {
  results: LieuFoursquare[];
}

function encoderURL(str: string): string {
  return encodeURIComponent(str?.trim() ?? '');
}

function etiquettePrix(price?: number): string {
  return ['', '$', '$$', '$$$', '$$$$'][price ?? 2] ?? '$$';
}

function prixNumerique(price?: number): number {
  return [0, 15, 35, 65, 120][price ?? 2] ?? 35;
}

function liensRestaurant(name: string, city: string): ActivityLinks {
  return {
    viator:       `https://www.thefork.fr/recherche?q=${encoderURL(name + ' ' + city)}`,
    getyourguide: `https://www.google.com/search?q=${encoderURL(name + ' ' + city + ' réservation')}`,
    airbnb:       `https://foursquare.com/explore?q=restaurants&near=${encoderURL(city)}`,
  };
}

export async function foursquareRestaurantSearch(
  city: string,
  mode: TravelMode
): Promise<Activite[]> {
  if (!CLE_FOURSQUARE) {
    console.warn('⚠️ Foursquare ignoré (FOURSQUARE_API_KEY manquante).');
    return [];
  }

  try {
    // Free tier : on NE demande PAS rating/price ni sort=RATING (champs/tri premium
    // → HTTP 429). On garde les champs gratuits (nom, catégories, localisation).
    const parametresRequete = new URLSearchParams({
      near:  city,
      query: REQUETES_PAR_MODE[mode] ?? 'restaurant',
      limit: '3',
    });

    const res = await fetch(`${URL_BASE_FOURSQUARE}/places/search?${parametresRequete}`, {
      headers: {
        Authorization:          `Bearer ${CLE_FOURSQUARE}`,
        'X-Places-Api-Version': VERSION_API_PLACES,
        Accept:                 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Foursquare ${res.status}`);

    const donneesFoursquare = await res.json() as ReponseFoursquare;
    if (!donneesFoursquare.results?.length) return [];

    console.log(`✅ Foursquare: ${donneesFoursquare.results.length} lieux trouvés pour ${city}`);

    return donneesFoursquare.results.map(p => ({
      name:        p.name,
      category:    p.categories[0]?.name ?? 'Restaurant',
      emoji:       '🍽️',
      description: [
        p.categories[0]?.name ?? 'Restaurant',
        p.location?.locality,
        p.rating ? `⭐ ${p.rating}/10` : null,   // affiché seulement si dispo (premium)
      ].filter(Boolean).join(' · '),
      duration:    '1h30',
      price:       prixNumerique(p.price),
      price_range: etiquettePrix(p.price),
      booking_url: `https://www.google.com/maps/search/?api=1&query=${encoderURL(p.name + ' ' + city)}`,
      links:       liensRestaurant(p.name, city),
    }));

  } catch (err) {
    console.error('❌ Foursquare error:', (err as Error).message);
    return [];
  }
}
