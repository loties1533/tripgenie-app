import * as Mocks from '../mocks.js';
import { callAI, parseJSON, sanitizeInput, normalizeChips } from './core.js';
import type { ResultatOnboarding, Pack, TravelMode } from '../../lib/types.js';

interface ParamsChatIntake {
  currentData?: Record<string, unknown>;
  userMessage: string;
}

interface ParamsChatModify {
  currentPack?: Partial<Pack>;
  userMessage: string;
  mode?: TravelMode;
}

interface ResultatChatModify {
  response: string;
  needs_full_regen?: boolean;
  modifications?: Partial<Pack>;
  chips?: string[];
}

export async function chatIntake({ currentData, userMessage }: ParamsChatIntake): Promise<ResultatOnboarding & { isMock?: boolean }> {
  const systemPrompt = `Tu es le Concierge Privé de TripGenie. Tu incarnes l'excellence du service personnalisé.

TON OBJECTIF : Collecter les informations essentielles pour orchestrer une escapade signature (Profil, Voyageurs, Budget, Dates).
Le but est d'être prêt (isReady: true) en MAXIMUM 2-3 échanges.

ANNÉE EN COURS : ${new Date().getFullYear()}. Pour toute date sans année (ex: "15/08", "du 15 au 21 août"), utilise TOUJOURS ${new Date().getFullYear()}.

RÈGLES D'OR :
1. VOCABULAIRE LUXE : Utilise "escapade" pas "voyage", "résidence" pas "hôtel".
2. ANTICIPATION : Ne redemande JAMAIS ce qui est déjà connu.
3. FLUIDITÉ (ISREADY) : Tu passes isReady: true dès que tu as au moins 3 champs remplis parmi (travelers, budget, profile, duration).
4. DÉDUCTION : "On est 4 amis" → travelers=4, profile="amis", mode="party".
5. LANGUE : rédige "response" et TOUS les "chips" exclusivement EN FRANÇAIS.

DONNÉES ACTUELLES :
${JSON.stringify(currentData ?? {})}

QUESTIONS PRIORITAIRES (Si manquantes) :
${!currentData?.profile   ? "→ PRIORITÉ 1 : Quelle est l'occasion de cette escapade ?" : '✅ Profil connu'}
${!currentData?.travelers ? '→ PRIORITÉ 2 : Combien de convives participent ?'          : '✅ Voyageurs connus'}
${!currentData?.budget    ? '→ PRIORITÉ 3 : Quel budget souhaitez-vous allouer ?'       : '✅ Budget connu'}
${!currentData?.departure ? '→ PRIORITÉ 4 : Quelle serait votre fenêtre de dates ?'     : '✅ Dates connues'}

FORMAT DE RÉPONSE (JSON STRICT) :
{
  "response": "Ta réponse élégante et concise (max 2 phrases).",
  "chips": ["Option 1", "Option 2", "Option 3"],
  "extractedData": {
    "travelers": null, "profile": null, "mode": "relax", "premium": false, "budget": null, "duration": null, "departure": null, "origin": "Paris"
  },
  "isReady": false
}`;

  const messageNormalise = sanitizeInput(userMessage).toLowerCase();

  if (messageNormalise.includes('montre-moi')) {
    const profile = (currentData?.profile as string | undefined) ?? (Mocks.MOCK_ONBOARDING.extractedData.profile as string);
    return {
      response:      "C'est parti pour le voyage Signature TripGenie ! ✨",
      isReady:       true,
      chips:         [],
      extractedData: { ...Mocks.MOCK_ONBOARDING.extractedData, profile },
      isMock:        true,
    };
  }

  if (messageNormalise.includes('attendre')) {
    return {
      response:      "Pas de souci ! N'hésite pas à revenir. À bientôt ! 👋",
      isReady:       false,
      chips:         ['Réessayer'],
      extractedData: {},
      isMock:        true,
    };
  }

  try {
    const reponseIABrute = await callAI(
      `${systemPrompt}\n\nMessage utilisateur : "${sanitizeInput(userMessage)}"`,
      undefined,
      'onboarding'
    );
    return parseJSON(reponseIABrute) as ResultatOnboarding;
  } catch (err) {
    console.error('ChatIntake échoué, activation du mode survie :', (err as Error).message);
    return {
      ...Mocks.MOCK_ONBOARDING,
      response: "Je capte un peu mal mais je continue ! On part sur une base solide, qu'est-ce que tu en penses ?",
      isMock: true,
    };
  }
}

export async function chatModify({ currentPack, userMessage }: ParamsChatModify): Promise<ResultatChatModify> {
  const systemPrompt = `Tu es l'expert voyage TripGenie. L'utilisateur veut modifier son voyage à ${currentPack?.destination ?? 'destination'}.

  CONTEXTE ACTUEL :
  - Destination : ${currentPack?.destination}
  - Budget : ${currentPack?.summary?.total_budget}
  - Pack actuel : ${JSON.stringify(currentPack)}

  CONSIGNES :
  1. Réponds de manière amicale et concise (champ "response").
  2. Si l'utilisateur demande une modification majeure, mets "needs_full_regen" à true.
  3. Pour des modifications précises, suggère les changements dans "modifications".
  4. LANGUE : rédige "response" et les "chips" exclusivement EN FRANÇAIS.

  RÈGLE CRITIQUE SUR "modifications" (chaque liste REMPLACE l'existante) :
  - N'inclus une clé (activities / hotels / itinerary) QUE si tu la modifies vraiment.
  - Quand tu renvoies une de ces clés, renvoie la LISTE COMPLÈTE ET À JOUR :
    les éléments existants à CONSERVER + tes ajouts/remplacements. Ne renvoie
    JAMAIS une liste partielle, sinon les anciens éléments seront perdus.
  - Le pack contient actuellement ${currentPack?.activities?.length ?? 0} activité(s)
    et ${currentPack?.hotels?.length ?? 0} hôtel(s). Ex : pour "plus d'activités",
    renvoie les activités existantes + les nouvelles dans le même tableau.

  FORMAT RÉPONSE (JSON UNIQUEMENT) :
  {
    "response": "Ma réponse à l'utilisateur",
    "needs_full_regen": false,
    "modifications": {
      "hotels": [...],
      "activities": [...],
      "itinerary": [...]
    }
  }`;

  try {
    const reponseIABrute = await callAI(`${systemPrompt}\n\nMessage de l'utilisateur : "${sanitizeInput(userMessage)}"`);
    const packModifie = parseJSON(reponseIABrute) as ResultatChatModify;
    if (packModifie.chips) packModifie.chips = normalizeChips(packModifie.chips);

    // Les activités modifiées par l'IA peuvent contenir un booking_url bidon
    // (domaine inventé, ex: luxe-restaurant.com). On le normalise vers un lien
    // Google Maps universel, comme à la génération initiale (transformerActivites).
    const destinationPack = currentPack?.destination ?? '';
    if (packModifie.modifications?.activities) {
      packModifie.modifications.activities = packModifie.modifications.activities.map((a: any) => ({
        ...a,
        booking_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((a.name || a.title || '') + ' ' + destinationPack)}`,
      }));
    }
    return packModifie;
  } catch (err) {
    console.error('ChatModify échoué :', (err as Error).message);
    return {
      response:      "Je n'ai pas pu modifier le pack, réessaie avec une autre formulation.",
      needs_full_regen: false,
      modifications: {},
      chips:         ['Réessayer', 'Modifier un hôtel', 'Changer une activité'],
    };
  }
}
