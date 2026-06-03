// =============================================
// TRIPGENIE — server/services/scoring.ts
// Algorithme de scoring multi-critères par mode
// =============================================

import { MODES } from '../lib/constants.js';
import type { TravelMode, ResultatScore, Activite, Evenement } from '../lib/types.js';

// ---- Types pour le scoring ----
interface VolScore {
  price?: number;
  duration_min?: number;
  stops?: number;
}

interface HotelScore {
  stars?: number;
  price_per_night?: number | string;
  max_guests?: number;
  rating?: number;
  price?: number;
}

export interface PackForScoring {
  vol?: VolScore | null;
  hotel?: HotelScore | null;
  events?: Evenement[];
  activities?: Activite[];
  totalPrice?: number;
}

interface ModeWeights {
  [key: string]: number;
}

type ScoreKey =
  | 'events' | 'prix' | 'hotel' | 'vol'
  | 'activities_free' | 'activities' | 'calme'
  | 'global' | 'originalite';

interface ScoreValues extends Record<ScoreKey, number> {}

// ---- Poids par mode ----
const MODE_WEIGHTS: Record<TravelMode, ModeWeights> = {
  party:    { events: 0.40, prix: 0.30, hotel: 0.20, vol: 0.10 },
  student:  { prix: 0.50, activities_free: 0.25, hotel: 0.15, events: 0.10 },
  luxury:   { hotel: 0.40, activities: 0.30, vol: 0.20, prix: 0.10 },
  group:    { hotel: 0.35, activities: 0.30, prix: 0.20, vol: 0.15 },
  relax:    { calme: 0.35, hotel: 0.30, activities: 0.25, prix: 0.10 },
  surprise: { global: 0.60, originalite: 0.40 },
};

/**
 * Ramène une valeur numérique dans l'intervalle [0, 1].
 * Utilisé pour comparer des grandeurs hétérogènes (prix, étoiles, durée)
 * sur une même échelle avant de les combiner.
 *
 * @param value - Valeur brute à normaliser
 * @param min   - Borne inférieure de la plage de référence
 * @param max   - Borne supérieure de la plage de référence
 * @returns     Valeur normalisée entre 0 et 1 (0.5 si min === max)
 */
function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Calcule le score d'un vol selon le mode de voyage.
 * La pondération varie : luxury favorise le vol direct et la durée courte,
 * student favorise uniquement le prix bas.
 *
 * @param vol  - Données du vol (prix, durée, escales)
 * @param mode - Mode de voyage qui change la pondération
 * @returns    Score entre 0 et 1
 */
function scoreVol(vol: VolScore | null | undefined, mode: TravelMode): number {
  if (!vol) return 0.5;
  const prixScore   = 1 - normalise(vol.price ?? 0, 50, 2000);
  const dureeScore  = 1 - normalise(vol.duration_min ?? 0, 60, 720);
  const directScore = vol.stops === 0 ? 1 : vol.stops === 1 ? 0.6 : 0.3;

  if (mode === 'luxury')  return directScore * 0.5 + prixScore * 0.1 + dureeScore * 0.4;
  if (mode === 'student') return prixScore * 0.85 + directScore * 0.15;
  return prixScore * 0.5 + directScore * 0.3 + dureeScore * 0.2;
}

/**
 * Calcule le score d'un hôtel selon le mode et le nombre de voyageurs.
 * En mode group, la capacité d'accueil pèse 50% du score.
 * En mode luxury, les étoiles et le rating priment sur le prix.
 *
 * @param hotel     - Données de l'hôtel (étoiles, prix/nuit, capacité, note)
 * @param mode      - Mode de voyage
 * @param travelers - Nombre de voyageurs (impacte le score de capacité)
 * @returns         Score entre 0 et 1
 */
function scoreHotel(hotel: HotelScore | null | undefined, mode: TravelMode, travelers: number): number {
  if (!hotel) return 0.5;
  const starsScore    = normalise(hotel.stars ?? 3, 1, 5);
  const prixNum       = typeof hotel.price_per_night === 'string'
    ? parseFloat(hotel.price_per_night)
    : (hotel.price_per_night ?? hotel.price ?? 150);
  const prixScore     = 1 - normalise(prixNum, 20, 800);
  const capacityScore = (hotel.max_guests ?? travelers) >= travelers ? 1 : 0.3;
  const ratingScore   = normalise(hotel.rating ?? 7, 5, 10);

  if (mode === 'luxury')  return starsScore * 0.5 + ratingScore * 0.35 + prixScore * 0.15;
  if (mode === 'student') return prixScore * 0.6 + ratingScore * 0.3 + starsScore * 0.1;
  if (mode === 'group')   return capacityScore * 0.5 + prixScore * 0.3 + ratingScore * 0.2;
  return starsScore * 0.35 + ratingScore * 0.4 + prixScore * 0.25;
}

/**
 * Score les événements locaux disponibles à la destination.
 * Logique inversée pour le mode relax : moins il y a d'événements festifs,
 * meilleur est le score (calme recherché).
 *
 * @param events - Liste des événements trouvés par Tavily
 * @param mode   - Mode de voyage
 * @returns      Score entre 0 et 1
 */
function scoreEvents(events: Evenement[] | undefined, mode: TravelMode, activities?: Activite[]): number {
  if (!events || events.length === 0) {
    // Fallback party : si Tavily ne trouve rien, score via les activités nightlife du pack
    if (mode === 'party' && activities?.length) {
      const nightlifeActs = activities.filter(a =>
        ['club', 'bar', 'nightlife', 'festival', 'soirée', 'party', 'concert', 'boite', 'beach club'].some(k =>
          (a.category ?? '').toLowerCase().includes(k) ||
          (a.name ?? '').toLowerCase().includes(k)
        )
      ).length;
      // Ratio activités nightlife / 4 attendues + bonus volume total
      return Math.min(1, nightlifeActs / 4) * 0.7 + Math.min(1, activities.length / 6) * 0.3;
    }
    return 0;
  }

  const countScore  = normalise(events.length, 0, 20);
  const partyEvents = events.filter(e =>
    ['concert', 'festival', 'nightlife', 'club', 'party'].some(k =>
      e.category?.toLowerCase().includes(k) ||
      e.title?.toLowerCase().includes(k)
    )
  ).length;

  const partyScore = normalise(partyEvents, 0, 10);

  if (mode === 'party')   return partyScore * 0.7 + countScore * 0.3;
  if (mode === 'student') return countScore * 0.6 + partyScore * 0.4;
  if (mode === 'relax')   return 1 - partyScore; // moins d'événements = mieux
  return countScore;
}

/**
 * Score les activités proposées dans le pack.
 * Chaque mode filtre un type d'activité différent :
 * - student : activités gratuites
 * - luxury  : activités premium (> 100€)
 * - relax   : activités calmes (spa, nature, randonnée)
 *
 * @param activities - Liste des activités du pack
 * @param mode       - Mode de voyage
 * @returns          Score entre 0 et 1
 */
function scoreActivities(activities: Activite[] | undefined, mode: TravelMode): number {
  if (!activities || activities.length === 0) return 0;

  const total      = activities.length;
  const freeCount  = activities.filter(a => a.price === 0 || a.price_range === 'free').length;
  const luxeCount  = activities.filter(a => typeof a.price === 'number' && a.price > 100).length;
  const calmCount  = activities.filter(a =>
    ['spa', 'yoga', 'hiking', 'beach', 'nature'].some(k =>
      a.category?.toLowerCase().includes(k)
    )
  ).length;

  if (mode === 'student') return normalise(freeCount, 0, total);
  if (mode === 'luxury')  return normalise(luxeCount, 0, total) * 0.6 + normalise(total, 0, 20) * 0.4;
  if (mode === 'relax')   return normalise(calmCount, 0, total) * 0.7 + normalise(total, 0, 20) * 0.3;
  return normalise(total, 0, 20);
}

// ---- Score calme de destination ----
function scoreCalme(_destination: string, events: Evenement[] | undefined): number {
  const eventCount = events?.length ?? 0;
  return 1 - normalise(eventCount, 0, 30);
}

// ---- Score originalité (mode surprise) ----
const COMMON_DESTINATIONS = ['paris', 'london', 'rome', 'barcelona', 'amsterdam', 'new york', 'tokyo'];
function scoreOriginalite(destination: string): number {
  const dest = destination.toLowerCase();
  return COMMON_DESTINATIONS.some(d => dest.includes(d)) ? 0.3 : 0.9;
}

/**
 * Calcule le score global d'un pack de voyage — fonction principale de l'algorithme.
 *
 * L'algorithme est purement déterministe (zéro IA) : une moyenne pondérée de scores
 * partiels (vol, hôtel, événements, activités, prix) dont les poids varient selon
 * le mode de voyage choisi par l'utilisateur.
 *
 * Exemple de pondération mode luxury :
 *   hotel 40% + activities 30% + vol 20% + prix 10%
 *
 * Exemple de pondération mode student :
 *   prix 50% + activities_free 25% + hotel 15% + events 10%
 *
 * @param pack        - Données brutes du pack (vol, hôtel, activités, prix total)
 * @param mode        - Mode de voyage (luxury | party | student | group | relax | surprise)
 * @param travelers   - Nombre de voyageurs (défaut : 2)
 * @param destination - Nom de la destination (utilisé pour le score d'originalité)
 * @returns           ResultatScore : { total: number (0-1), details: scores partiels }
 */
export function scorepack(
  pack: PackForScoring,
  mode: TravelMode,
  travelers = 2,
  destination = ''
): ResultatScore {
  const { vol, hotel, events, activities, totalPrice } = pack;
  const weights = MODE_WEIGHTS[mode] ?? MODE_WEIGHTS.party;

  // Prix par personne : 30000€ pour 5 personnes = 6000€/pers (plus juste que le budget brut)
  const pricePerPerson = travelers > 1 ? (totalPrice ?? 0) / travelers : (totalPrice ?? 0);

  const scores: ScoreValues = {
    vol:             scoreVol(vol, mode),
    hotel:           scoreHotel(hotel, mode, travelers),
    events:          scoreEvents(events, mode, activities),   // activities en fallback nightlife
    activities:      scoreActivities(activities, mode),
    prix:            1 - normalise(pricePerPerson, 100, 8000), // max 8000€/pers (était 10000 total)
    activities_free: scoreActivities(activities, 'student'),
    calme:           scoreCalme(destination, events),
    global:          0,
    originalite:     scoreOriginalite(destination),
  };

  // Score global = moyenne pondérée de tous les scores
  scores.global = Object.entries(weights).reduce((total, [key, weight]) => {
    return total + (scores[key as ScoreKey] ?? 0) * weight;
  }, 0);

  return {
    total:   Math.round(scores.global * 100) / 100,
    details: scores,
  };
}

/**
 * Trie une liste de packs par score décroissant et retourne le top 3.
 * Utilisé pour la fonctionnalité de comparaison de destinations.
 *
 * @param packs       - Liste de packs à comparer
 * @param mode        - Mode de voyage (même pour tous les packs comparés)
 * @param travelers   - Nombre de voyageurs
 * @param destination - Destination commune
 * @returns           Top 3 des packs avec leur rank et score calculé
 */
export function rankPacks<T extends PackForScoring>(
  packs: T[],
  mode: TravelMode,
  travelers: number,
  destination: string
): Array<T & { rank: number; score: ResultatScore }> {
  return packs
    .map((pack, idx) => ({
      ...pack,
      rank:  idx + 1,
      score: scorepack(pack, mode, travelers, destination),
    }))
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 3)
    .map((pack, idx) => ({ ...pack, rank: idx + 1 }));
}

export { MODE_WEIGHTS };
