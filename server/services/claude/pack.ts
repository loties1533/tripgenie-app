/**
 * @fileoverview Génération du pack voyage complet via LLM.
 *
 * Ce module est organisé en fonctions pures testables unitairement :
 * - calcNights()          → calcul du nombre de nuits
 * - buildPackPrompt()     → construction du prompt LLM selon le mode
 * - parsePackResponse()   → parsing JSON + fallback si LLM renvoie du JSON cassé
 * - mapFlights()          → mapping FlightSearchResult → Pack['flights']
 * - mapActivities()       → mapping AITextResult.activities → Pack['activities']
 * - calcBudgetBreakdown() → répartition budgétaire selon BUDGET_RATIOS
 * - assemblePack()        → orchestrateur principal (appelle les fonctions ci-dessus)
 */

import { callAI, parseJSON, sanitizeInput } from './core.js';
import { MODES, BUDGET_RATIOS, DEFAULT_VALUES } from '../../lib/constants.js';
import type { Pack, TravelMode } from '../../lib/types.js';
import type { FlightSearchResult, EventSearchResult, HotelSearchResult } from '../smartSearch.js';
import type { WeatherData } from '../weather.js';

// ---- Types internes ----

export interface AssemblePackParams {
  destination: string;
  origin?: string;
  flights?: FlightSearchResult[];
  events?: EventSearchResult[];
  hotels?: HotelSearchResult[];
  mode: TravelMode;
  profile?: string;
  travelers: number;
  budget: number;
  departure?: string;
  return_date?: string;
  duration?: number;
  realWeather?: WeatherData | null;
  realPhoto?: string | null;
}

export interface AITextResult {
  country?: string;
  airport_code?: string;
  origin_airport_code?: string;
  tagline?: string;
  overview?: string;
  weather?: { temp?: string; cond?: string; tip?: string };
  hotels?: Array<{ name?: string; loc?: string; hl?: string; stars?: number; price_per_night?: number }>;
  itinerary?: Array<{ day: number; title?: string; am?: string; pm?: string; plan_b?: string }>;
  activities?: Array<{ name?: string; desc?: string; type?: string; plan_b?: string }>;
  tip1?: string;
  tip2?: string;
  phrase?: string;
  phrase_tr?: string;
}

// ============================================================
// 1. calcNights — calcul du nombre de nuits du séjour
// ============================================================

/**
 * Calcule le nombre de nuits en fonction des dates ou de la durée.
 * Fallback : estimation par le budget (500€ ≈ 1 nuit, capped à 14).
 */
export function calcNights(
  departure: string | undefined,
  return_date: string | undefined,
  duration: number | undefined,
  budget: number,
): number {
  if (departure && return_date) {
    return Math.max(
      Math.round((new Date(return_date).getTime() - new Date(departure).getTime()) / 86_400_000),
      1,
    );
  }
  if (duration) return parseInt(String(duration));
  return Math.min(Math.max(Math.round(budget / 500), 2), 14);
}

// ============================================================
// 2. buildPackPrompt — construction du prompt LLM
// ============================================================

/**
 * Construit le prompt envoyé au LLM selon le mode de voyage, le budget et les données réelles.
 * Séparé d'assemblePack pour être testable unitairement et modifiable sans risque.
 */
export function buildPackPrompt({
  dest, originCity, travelers, profile, mode, budgetPerPers, nights, events,
}: {
  dest: string;
  originCity: string;
  travelers: number;
  profile: string | undefined;
  mode: TravelMode;
  budgetPerPers: number;
  nights: number;
  events?: EventSearchResult[];
}): string {
  const budgetTone = budgetPerPers >= 2000
    ? 'Budget premium : penthouses, villas privées, tables Michelin, accès VIP.'
    : budgetPerPers >= 1000
    ? 'Budget confortable : hôtels 4★ soignés, restaurants gastronomiques.'
    : budgetPerPers >= 500
    ? 'Budget moyen : bon rapport qualité/prix, quelques coups de cœur premium.'
    : 'Petit budget : adresses locales authentiques, astuces insider.';

  const modePersona = mode === MODES.LUXURY
    ? "Ton ADN est l'excellence absolue. Chaque proposition doit être digne d'un guide Condé Nast."
    : mode === MODES.PARTY
    ? "Tu es l'expert nightlife. Chaque journée monte en puissance vers une soirée mémorable."
    : mode === MODES.RELAX
    ? 'Tu es un maître du slow travel. Rythme doux, expériences intimes, pas de rush.'
    : mode === MODES.GROUP
    ? 'Tu orchestres des expériences fédératrices, accessibles à tous les membres du groupe.'
    : mode === MODES.STUDENT
    ? 'Tu connais tous les bons plans : max de saveurs pour min de budget.'
    : 'Tu combines intelligemment les envies du groupe avec la richesse locale.';

  const activityTypes = mode === MODES.PARTY
    ? 'club|bar|discothèque|beach-club|festival|restaurant-lounge'
    : mode === MODES.LUXURY
    ? 'restaurant-étoilé|spa-5étoiles|yacht-privé|club-vip|expérience-exclusive|gastronomie'
    : mode === MODES.STUDENT
    ? 'bar-incontournable|street-food|marché-local|concert|activité-outdoor|visite-gratuite'
    : mode === MODES.RELAX
    ? 'spa|plage-privée|restaurant-vue|yoga|croisière|nature'
    : 'restaurant|activité-phare|visite-emblématique|bateau|spa|expérience-locale';

  const activityInstruction = mode === MODES.PARTY
    ? '⚠️ MODE PARTY — OBLIGATOIRE : 6 vrais lieux nightlife (boîtes, beach clubs, bars, festivals, restos lounge). AUCUN musée ni site culturel. Exemples réels : Pacha, Ushuaïa, Hi Ibiza, Amnesia, Destino.'
    : mode === MODES.LUXURY
    ? '⚠️ MODE LUXURY — OBLIGATOIRE : 6 adresses ultra-premium (restos Michelin, spas palace, yachts, clubs privés). Exemples : Nobu, Cipriani, Nikki Beach. Noms réels uniquement.'
    : mode === MODES.STUDENT
    ? '⚠️ MODE STUDENT — OBLIGATOIRE : 6 adresses connues et accessibles (bars étudiants, marchés, street food, activités outdoor gratuites ou pas chères). Noms réels uniquement.'
    : mode === MODES.RELAX
    ? '⚠️ MODE RELAX — OBLIGATOIRE : 6 adresses zen et authentiques (spas, plages calmes, restos vue mer, activités nature). Noms réels uniquement.'
    : '⚠️ OBLIGATOIRE : 6 adresses incontournables, réelles et variées adaptées au groupe. Noms exacts uniquement, pas de descriptions génériques.';

  const realVenuesContext = events?.length
    ? `\nÉVÉNEMENTS RÉELS :\n${events.slice(0, 4).map(e => `- ${e.title} @ ${e.venue}`).join('\n')}`
    : '';

  return `Tu es le concierge privé de TripGenie. Destination : ${dest}. Ville de départ : ${originCity}.
    VOYAGEURS : ${travelers} personne(s). PROFIL : ${profile ?? mode}. VIBE : ${mode}. BUDGET : ${budgetPerPers}€/pers. DURÉE : ${nights} nuits.

    ${modePersona}
    ${budgetTone}
    ${activityInstruction}
    ${realVenuesContext}

    Génère ce JSON COMPACT (itinerary = 3 jours, activities = 6) :
    {"country":"Pays","airport_code":"IBZ","origin_airport_code":"BOD","tagline":"5-7 mots accrocheurs","overview":"1 phrase","weather":{"temp":"22°C","cond":"Soleil","tip":"Conseil"},"hotels":[{"name":"Vrai hôtel","loc":"Quartier","hl":"Point fort"},{"name":"Alternative","loc":"Quartier","hl":"Point fort"}],"itinerary":[{"day":1,"title":"Titre","am":"Activité réelle","pm":"Club/resto réel"},{"day":2,"title":"Titre","am":"Activité réelle","pm":"Soirée réelle"},{"day":3,"title":"Titre","am":"Activité réelle","pm":"Soirée réelle"}],"activities":[{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"}],"tip1":"Conseil","tip2":"Adresse food","phrase":"Mot local","phrase_tr":"Traduction"}
    ⚠️ VRAIS noms uniquement. Pas de "Gastronomie locale" ou "Découverte de ${dest}".
    ⚠️ airport_code = code IATA de l'aéroport de ${dest}. origin_airport_code = code IATA de l'aéroport de ${originCity} (ville de départ).`;
}

// ============================================================
// 3. parsePackResponse — parsing JSON + fallback structuré
// ============================================================

/**
 * Parse la réponse brute du LLM en AITextResult.
 * Si le JSON est malformé (parseJSON échoue après ses 5 tentatives),
 * renvoie un fallback générique pour ne jamais bloquer la génération.
 */
export function parsePackResponse(raw: string, dest: string, nights: number): AITextResult {
  try {
    return parseJSON(raw) as AITextResult;
  } catch (err) {
    console.error('⚠️ FALLBACK GÉNÉRIQUE ACTIVÉ — JSON malformé reçu du LLM. Raison:', (err as Error).message);
    console.error('⚠️ Réponse brute du LLM (200 premiers chars):', raw.slice(0, 200));
    return {
      country:  'Destination',
      tagline:  `Découvrez les secrets de ${dest}`,
      overview: `Un voyage sur-mesure à ${dest}.`,
      weather:  { temp: '22°C', cond: 'Ensoleillé', tip: 'Tenue légère recommandée' },
      hotels: [
        { name: `Grand Hôtel ${dest}`,    loc: 'Centre-ville', hl: 'Vue panoramique' },
        { name: `Boutique Hôtel ${dest}`, loc: 'Vieille ville', hl: 'Charme local' },
      ],
      itinerary: Array.from({ length: Math.min(nights, 3) }).map((_, i) => ({
        day:   i + 1,
        title: i === 0 ? 'Arrivée & Découverte' : i === 1 ? 'Exploration locale' : 'Détente & Gastronomie',
        am:    i === 0 ? 'Installation et première balade' : 'Visite des incontournables',
        pm:    i === 0 ? 'Dîner dans le quartier' : 'Soirée en ville',
      })),
      activities: [
        { name: `Découverte de ${dest}`, desc: 'Exploration des quartiers emblématiques.' },
        { name: 'Gastronomie locale',    desc: 'Les meilleures adresses culinaires.' },
        { name: 'Expérience culturelle', desc: 'Musées, architecture et vie locale.' },
      ],
      tip1:      "Réservez vos activités à l'avance.",
      tip2:      'Goûtez aux spécialités locales.',
      phrase:    'Bonjour !',
      phrase_tr: 'Hello!',
    };
  }
}

// ============================================================
// 4. mapFlights — mapping vols réels → Pack['flights']
// ============================================================

/**
 * Transforme les résultats Tavily en tableau de vols typé Pack['flights'].
 * Cap le prix à 15% du budget si le prix trouvé semble aberrant (> 1800€).
 */
export function mapFlights(
  flights: FlightSearchResult[] | undefined,
  airportCode: string,
  originCode: string,
  originCity: string,
  dest: string,
  budget: number,
  travelers: number,
): Pack['flights'] {
  const volPriceEst    = Math.round(budget * 0.15 / travelers);
  const rawPrice       = flights?.[0]?.price ?? 0;
  const pricePerPerson = rawPrice > 0 ? rawPrice : 0;
  const priceCapped    = pricePerPerson > 1800 ? volPriceEst : pricePerPerson;
  const finalPrice     = `${priceCapped || volPriceEst}€`;

  if (flights?.length) {
    return [
      {
        from:             originCode,
        from_city:        originCity,
        to:               airportCode,
        to_city:          dest,
        departure_time:   flights[0].outbound_time || '10:30',
        arrival_time:     flights[0].arrival_time  || '12:00',
        duration:         flights[0].duration      || '2h00',
        stops:            flights[0].stops         || 'Direct',
        airline:          flights[0].airline       || 'Air France',
        price_per_person: finalPrice,
        type:             'outbound' as const,
        links:            flights[0].links || null,
      },
      {
        from:             airportCode,
        from_city:        dest,
        to:               originCode,
        to_city:          originCity,
        departure_time:   '18:00',
        arrival_time:     '20:00',
        duration:         flights[0].duration || '2h00',
        stops:            'Direct',
        airline:          flights[0].airline  || 'Air France',
        price_per_person: finalPrice,
        type:             'return' as const,
        links:            flights[0].links || null,
      },
    ];
  }

  // Fallback : vols estimés sans données Tavily
  return [
    { from: originCode, from_city: originCity, to: airportCode, to_city: dest,
      departure_time: '10:30', arrival_time: '12:00', duration: '1h30',
      stops: 'Direct', airline: 'Air France', price_per_person: `${volPriceEst}€`, type: 'outbound' as const },
    { from: airportCode, from_city: dest, to: originCode, to_city: originCity,
      departure_time: '18:00', arrival_time: '19:30', duration: '1h30',
      stops: 'Direct', airline: 'Air France', price_per_person: `${volPriceEst}€`, type: 'return' as const },
  ];
}

// ============================================================
// 5. mapActivities — mapping activités LLM → Pack['activities']
// ============================================================

/**
 * Transforme les activités brutes du LLM en activités typées avec emoji,
 * catégorie et lien de réservation adapté au type d'activité.
 */
export function mapActivities(
  activities: AITextResult['activities'],
  dest: string,
): Pack['activities'] {
  return (activities ?? []).map(a => {
    const type    = a.type ?? 'activité';
    const isNight = ['club', 'bar', 'nightlife', 'soirée'].some(k => type.toLowerCase().includes(k));
    const isFood  = ['restaurant', 'food', 'gastronomie'].some(k => type.toLowerCase().includes(k));
    const isBoat  = ['bateau', 'yacht', 'boat', 'croisière'].some(k => type.toLowerCase().includes(k));
    const emoji   = isNight ? '🎉' : isFood ? '🍽' : isBoat ? '⛵' : type === 'plage' ? '🏖' : type === 'spa' ? '💆' : '🏛';
    const name    = a.name ?? 'Activité';
    const q       = encodeURIComponent(`${name} ${dest}`);
    // Lien universel Google Maps : ouvre la fiche du lieu DANS LA BONNE VILLE,
    // partout dans le monde. TheFork (resto FR) renvoyait vers Paris pour une
    // ville hors France ; GetYourGuide/Viator ne couvrent pas tout non plus.
    const booking_url = `https://www.google.com/maps/search/?api=1&query=${q}`;

    return {
      name,
      category:    isNight ? 'Nightlife' : isFood ? 'Gastronomie' : isBoat ? 'Nautique' : 'Culture',
      emoji,
      description: a.desc ?? 'Incontournable',
      duration:    '2-3h',
      price:       'Variable',
      best_time:   isNight ? 'Soir' : 'Journée',
      booking_url,
    };
  });
}

// ============================================================
// 6. calcBudgetBreakdown — répartition budgétaire par mode
// ============================================================

/**
 * Répartit le budget total selon les ratios définis dans BUDGET_RATIOS.
 * Plafonne le prix par nuit d'hébergement (250€ standard, 800€ luxury).
 */
export function calcBudgetBreakdown(
  budget: number,
  mode: TravelMode,
  nights: number,
  travelers: number,
): Pack['budget_breakdown'] {
  const ratio  = BUDGET_RATIOS[mode] ?? BUDGET_RATIOS.party;
  const maxPpn = mode === MODES.LUXURY ? 800 : 250;

  const vols      = Math.round(budget * ratio.vols);
  let   heberg    = Math.round(budget * ratio.heberg);
  const ppn       = heberg / nights / travelers;
  if (ppn > maxPpn) heberg = maxPpn * nights * travelers;
  const activites = Math.round(budget * ratio.activites);
  const resto     = Math.round(budget * ratio.resto);
  const trans     = Math.round(budget * ratio.trans);
  const divers    = Math.max(0, budget - vols - heberg - activites - resto - trans);

  return {
    vols:         `${vols}€`,
    hebergement:  `${heberg}€`,
    activites:    `${activites}€`,
    restauration: `${resto}€`,
    transports:   `${trans}€`,
    divers:       `${divers}€`,
    total:        `${budget}€`,
    // heberg exposé pour le mapping hôtels (calcul prix/nuit)
    _hebergRaw:   heberg,
  } as Pack['budget_breakdown'] & { _hebergRaw: number };
}

// ============================================================
// 7. assemblePack — orchestrateur principal
// ============================================================

/**
 * Génère un pack voyage complet.
 *
 * Orchestre les fonctions pures ci-dessus :
 * 1. calcNights        → nombre de nuits
 * 2. buildPackPrompt   → prompt LLM enrichi avec les données réelles
 * 3. callAI            → appel LLM (Gemini → Claude → OpenRouter → Mocks)
 * 4. parsePackResponse → parsing JSON + fallback
 * 5. mapFlights        → vols structurés
 * 6. mapActivities     → activités avec emoji + liens de réservation
 * 7. calcBudgetBreakdown → répartition budgétaire
 *
 * @param params - Destination, mode, budget, dates, données réelles (vols/météo/hôtels/events)
 * @returns      Pack complet structuré prêt à être affiché côté client
 */
export async function assemblePack({
  destination, origin, flights, events, hotels: realHotels, mode, profile, travelers, budget,
  departure, return_date, duration, realWeather, realPhoto,
}: AssemblePackParams): Promise<Pack> {
  const dest       = sanitizeInput(destination);
  const originCity = sanitizeInput(origin ?? DEFAULT_VALUES.ORIGIN);
  const nights     = calcNights(departure, return_date, duration, budget);
  const budgetPerPers = Math.round(budget / travelers);

  // ── 1. Appel LLM ──────────────────────────────────────────────────────────
  const prompt = buildPackPrompt({ dest, originCity, travelers, profile, mode, budgetPerPers, nights, events });
  const textRaw = await callAI(prompt, undefined, 'pack');

  // ── 2. Parsing JSON (5 stratégies de récupération) ────────────────────────
  const t = parsePackResponse(textRaw, dest, nights);

  // ── 3. Codes IATA (fournis par le LLM) ────────────────────────────────────
  const airportCode = t.airport_code?.toUpperCase() ?? 'XXX';
  const originCode  = t.origin_airport_code?.toUpperCase() ?? 'XXX';

  // ── 4. Répartition budgétaire ─────────────────────────────────────────────
  const budgetBreakdown = calcBudgetBreakdown(budget, mode, nights, travelers);
  const heberg = (budgetBreakdown as Pack['budget_breakdown'] & { _hebergRaw: number })._hebergRaw;

  // ── 5. Mapping événements ─────────────────────────────────────────────────
  const eventData = events?.length
    ? events.slice(0, 3).map(e => ({
        title:       e.title,
        category:    e.category,
        start:       e.start || 'Pendant votre séjour',
        venue:       e.venue || 'Centre ville',
        description: e.description || '',
        booking_url: e.booking_url ?? null,
        links:       e.links ?? undefined,
      }))
    : [{ title: `Soirée à ${dest}`, category: 'Nightlife', start: 'Pendant votre séjour', venue: 'Centre ville', description: 'Animation locale garantie' }];

  // ── 6. Assemblage du Pack final ───────────────────────────────────────────
  return {
    destination: dest,
    country:     t.country  ?? 'Destination',
    tagline:     t.tagline  ?? `${dest}, votre prochaine aventure`,
    overview:    t.overview ?? `Découvrez ${dest} sous son meilleur jour.`,
    photo_url:   realPhoto ?? undefined,
    weather: realWeather
      ? { avg_temp: realWeather.temp, conditions: realWeather.cond, tip: t.weather?.tip ?? 'Prévoyez des couches', humidity: realWeather.humidity, wind: realWeather.wind }
      : { avg_temp: t.weather?.temp ?? '20°C', conditions: t.weather?.cond ?? 'Ensoleillé', tip: t.weather?.tip ?? 'Prévoyez des couches' },
    summary: { total_budget: `${budget}€`, nights, activities_count: (t.activities ?? []).length },
    flights: mapFlights(flights, airportCode, originCode, originCity, dest, budget, travelers),
    hotels: (realHotels?.length ? realHotels : t.hotels ?? []).map((h, i) => ({
      name:            h.name ?? `Hôtel ${i + 1}`,
      location:        (h as { loc?: string }).loc ?? (h as { location?: string }).location ?? 'Centre',
      stars:           h.stars ?? (i === 0 && mode === 'luxury' ? 5 : 4),
      price_per_night: (h as { price_per_night?: number }).price_per_night
        ? `${(h as { price_per_night: number }).price_per_night}€`
        : `${Math.round(heberg / nights / (i + 1))}€`,
      highlights:      (h as { hl?: string; highlights?: string }).hl ?? (h as { highlights?: string }).highlights ?? 'Excellent choix',
      emoji:           i === 0 ? '🏨' : '🏩',
    })),
    itinerary: (t.itinerary ?? []).map(d => ({
      day:      d.day,
      title:    d.title ?? 'Journée découverte',
      subtitle: mode === MODES.PARTY ? 'Vibe & Nightlife' : mode === MODES.LUXURY ? 'Prestige & Exclusivité' : 'Exploration',
      items: [
        // Heures indicatives (matin/soir). On n'affiche PLUS de prix/durée inventés :
        // l'IA ne fournit que l'activité (am/pm), donc tout chiffre serait du faux.
        { time: mode === MODES.PARTY ? '14:00' : '10:00', type: 'activity' as const, title: d.am ?? 'Exploration', description: 'Découverte locale' },
        { time: mode === MODES.PARTY ? '22:00' : '20:00', type: mode === MODES.PARTY ? 'event' as const : 'food' as const, title: d.pm ?? 'Soirée', description: 'Moment mémorable' },
      ],
    })),
    activities: mapActivities(t.activities, dest),
    events:     eventData,
    budget_breakdown: {
      vols:         budgetBreakdown.vols,
      hebergement:  budgetBreakdown.hebergement,
      activites:    budgetBreakdown.activites,
      restauration: budgetBreakdown.restauration,
      transports:   budgetBreakdown.transports,
      divers:       budgetBreakdown.divers,
      total:        budgetBreakdown.total,
    },
    tips: [
      { title: 'Conseil pratique', content: t.tip1 ?? "Réservez à l'avance" },
      { title: 'Sur place',        content: t.tip2 ?? 'Explorez les quartiers locaux' },
    ],
    local_phrases: [
      { phrase: t.phrase ?? 'Santé !', translation: t.phrase_tr ?? 'Cheers !' },
    ],
  };
}
