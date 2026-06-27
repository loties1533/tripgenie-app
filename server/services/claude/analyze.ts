/**
 * @fileoverview Analyse de la demande utilisateur et suggestion de destinations.
 */

import { searchWeb } from '../tools/webSearch.js';
import * as Mocks from '../mocks.js';
import { callAI, parseJSON, sanitizeInput } from './core.js';
import { getDestinationPhoto } from '../photo.js';
import type { ResultatOnboarding } from '../../lib/types.js';

export async function analyzeRequest(userInput: string): Promise<unknown> {
  const raw = await callAI(
    `Analyse cette demande: "${sanitizeInput(userInput)}"
JSON: {"destination":"ville ou null","origin":"Paris","mode":"party|student|luxury|group|relax|surprise","travelers":2,"duration_days":3,"budget_total":null,"preferences":[],"confidence":0.9}`,
    undefined,
    'onboarding'
  );
  return parseJSON(raw);
}

interface SuggestDestinationsParams {
  mode?: string;
  profile?: string;
  interests?: string[];
  budget?: number;
  travelers?: number;
  duration?: number;
  origin?: string;
  moods?: string[];
  discoveryMode?: string;
  preferences?: string[];
  departure?: string;
}

interface DestinationItem {
  city: string;
  country: string;
  tagline?: string;
  reason?: string;
  budget_estimate?: string;
  match_score?: number;
  photo?: string | null;
}

interface DestinationsResult {
  destinations: DestinationItem[];
  isMock?: boolean;
}

export async function suggestDestinations({
  mode, profile, interests, budget, travelers, duration, origin, moods, discoveryMode, preferences, departure,
}: SuggestDestinationsParams): Promise<DestinationsResult> {
  try {
    const intStr  = interests?.join(', ') ?? 'voyage';
    const moodStr = moods?.join(', ')     ?? '';
    const depDate = departure ? new Date(departure) : null;
    const month   = depDate && !isNaN(depDate.getTime())
      ? new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(depDate)
      : 'actuellement';

    let query = `Meilleures destinations ${mode} pour ${profile} en ${month}. `;
    if (mode === 'party') {
      query += `Destinations reconnues mondialement pour la fête : beach clubs, clubs de nuit, festivals, vie nocturne intense. Exemples : Ibiza, Mykonos, Tulum, Miami, Bangkok, Phuket, Bali, Barcelone, Monaco, Hvar, Zrce, Marbella, Rimini, Chypre, Dubaï. `;
    } else if (mode === 'luxury') {
      query += `Destinations ultra-luxe : Saint-Tropez, Monaco, Maldives, Dubaï, Bora Bora, Santorini, Amalfi, Positano, Capri. `;
    } else if (mode === 'relax') {
      query += `Destinations calmes et ressourçantes : Bali, Thaïlande, Îles grecques, Canaries, Madère, Açores, Corse, Sardaigne. `;
    } else if (mode === 'student') {
      query += `Destinations pas chères et animées : Prague, Budapest, Lisbonne, Porto, Bangkok, Hanoï, Cracovie, Bucarest. `;
    }
    query += `Budget total ${budget}€ pour ${travelers} personnes. Intérêts: ${intStr} ${moodStr}.`;
    if (discoveryMode === 'hidden_gem') {
      query += ` Cherche des pépites cachées, pas les destinations ultra-touristiques habituelles.`;
    }

    const webContext = await searchWeb(query);
    const budgetPerPers = budget && travelers ? Math.round(budget / travelers) : 0;

    const budgetTier = budgetPerPers >= 3000
      ? `BUDGET PREMIUM (${budgetPerPers}€/pers) : le budget permet des vols long-courrier + hôtels haut de gamme. Propose des destinations qui correspondent à CE NIVEAU DE BUDGET — raisonne par rapport au coût réel de la vie, du vol et de l'hébergement dans chaque destination. Varie les continents. La 3ème destination doit être une pépite originale que peu de gens connaissent.`
      : budgetPerPers >= 1500
      ? `BUDGET CONFORTABLE (${budgetPerPers}€/pers) : le budget couvre un vol moyen-courrier + bon hébergement, ou un long-courrier accessible. Adapte tes suggestions au coût réel de chaque destination. La 3ème destination doit surprendre.`
      : `BUDGET SERRÉ (${budgetPerPers}€/pers) : privilégie des destinations où ce budget est suffisant pour bien vivre — raisonne par rapport au coût de la vie local et au prix des vols depuis ${origin ?? 'France'}. La 3ème destination doit être une vraie pépite peu chère et méconnue.`;

    const raw = await callAI(
      `CONTEXTE WEB RÉCENT : ${webContext}
      MISSION : Suggère 3 destinations parfaites pour un voyage en ${month}.
      PROFIL : ${profile ?? 'voyageur'}, MODE : ${mode}.
      BUDGET TOTAL : ${budget}€ pour ${travelers ?? 2} personne(s) = ${budgetPerPers}€/personne.

      ${budgetTier}
      STRATÉGIE : propose des destinations RECONNUES pour ce mode de voyage. Pour party = vraies destinations fête (beach clubs, clubs, festivals). Varie les continents mais reste cohérent avec le mode.

      FORMAT JSON STRICT :
      {"destinations": [{"city": "Nom", "country": "Pays", "tagline": "Accroche courte", "reason": "Raison MAX 8 mots", "budget_estimate": "~${budgetPerPers}€/pers", "match_score": 95}]}
      ⚠️ "tagline" et "reason" DOIVENT être rédigés EN FRANÇAIS. Seuls "city" et "country" gardent leur nom d'origine.`,
      undefined,
      'destinations'
    );
    const result = parseJSON(raw) as DestinationsResult;

    if (result?.destinations?.length) {
      const photos = await Promise.allSettled(
        result.destinations.map(d => getDestinationPhoto(d.city))
      );
      result.destinations = result.destinations.map((d, i) => ({
        ...d,
        photo: photos[i].status === 'fulfilled' ? photos[i].value : null,
        budget_estimate: budgetPerPers
          ? `~${budgetPerPers.toLocaleString('fr-FR')}€/pers`
          : d.budget_estimate,
      }));
    }

    return result;
  } catch (err) {
    console.error('⚠️ SuggestDestinations failed, activation du Mode Survie:', (err as Error).message);
    return Mocks.MOCK_DESTINATIONS;
  }
}
