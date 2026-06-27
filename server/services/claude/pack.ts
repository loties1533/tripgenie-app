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
    {"country":"Pays","airport_code":"IBZ","origin_airport_code":"BOD","tagline":"5-7 mots accrocheurs","overview":"1 phrase","weather":{"temp":"22°C","cond":"Soleil","tip":"Conseil"},"hotels":[{"name":"Vrai hôtel","loc":"Quartier","hl":"Point fort"},{"name":"Alternative","loc":"Quartier","hl":"Point fort"}],"itinerary":[{"day":1,"title":"Titre","am":"Activité réelle","pm":"Club/resto réel"},{"day":2,"title":"Titre","am":"Activité réelle","pm":"Soirée réelle"},{"day":3,"title":"Titre","am":"Activité réelle","pm":"Soirée réelle"}],"activities":[{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"},{"name":"LIEU RÉEL","desc":"50 chars max","type":"${activityTypes}"}],"tip1":"Conseil","tip2":"Adresse food","phrase":"Mot ou expression local(e)","phrase_tr":"Traduction française"}
    ⚠️ LANGUE : rédige TOUS les textes EN FRANÇAIS (tagline, overview, cond, tip, hl, title, am, pm, desc, tip1, tip2, phrase_tr). Seuls les noms propres de lieux/hôtels/clubs restent dans leur langue d'origine.
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
      phrase_tr: 'Salutation de bienvenue',
    };
  }
}

// ============================================================
// Helpers — liens de réservation PRÉ-REMPLIS avec les vraies données du voyage
// (villes, codes IATA, dates, voyageurs). Construits à partir de la DEMANDE, pas
// de la sortie du LLM : les liens restent corrects même si le LLM se trompe de ville.
// ============================================================

/** 'YYYY-MM-DD' depuis une date ISO (ou '' si absente). */
function ymd(date?: string): string {
  return date ? date.slice(0, 10) : '';
}

/** 'YYMMDD' pour les deep-links Skyscanner (2026-07-15 → 260715). */
function yymmdd(date?: string): string {
  return date ? date.slice(2, 10).replace(/-/g, '') : '';
}

/** Code IATA plausible (3 lettres, hors placeholder 'XXX'). */
function isValidIATA(code?: string): boolean {
  return !!code && /^[A-Za-z]{3}$/.test(code) && code.toUpperCase() !== 'XXX';
}

/**
 * Liens vols pré-remplis. Google Flights (requête naturelle) = lien primaire
 * fiable : jamais de 404, pas besoin de code IATA. Skyscanner/Kayak en complément
 * UNIQUEMENT si les codes IATA sont valides ET qu'on a une date de départ ;
 * sinon on retombe sur Google Flights (anti page inexistante).
 */
export function buildFlightLinks(params: {
  originCity: string; destCity: string;
  originIATA?: string; destIATA?: string;
  departure?: string; return_date?: string; travelers: number;
}): { google: string; skyscanner: string; kayak: string } {
  const { originCity, destCity, originIATA, destIATA, departure, return_date } = params;
  const adults = Math.max(1, params.travelers || 1);
  const dep = ymd(departure);
  const ret = ymd(return_date);

  const iataOk = isValidIATA(originIATA) && isValidIATA(destIATA);

  // Google Flights : URL avec IATA + dates si dispo (format hash), sinon recherche Google.
  // Le format ?q=... de google.com/travel/flights ne pré-remplit pas la destination.
  const google = iataOk && dep
    ? `https://www.google.com/flights#flt=${originIATA}.${destIATA}.${dep}${ret ? `*${destIATA}.${originIATA}.${ret}` : ''};c:EUR;e:1;a:${adults};px:0`
    : `https://www.google.com/search?q=${encodeURIComponent(`vols ${originCity} ${destCity}${dep ? ' ' + dep : ''}${adults > 1 ? ' ' + adults + ' personnes' : ''}`)}`;

  const skyscanner = iataOk && dep
    ? `https://www.skyscanner.fr/transport/flights/${originIATA!.toLowerCase()}/${destIATA!.toLowerCase()}/${yymmdd(departure)}/${ret ? yymmdd(return_date) + '/' : ''}?adults=${adults}`
    : google;
  const kayak = iataOk && dep
    ? `https://www.kayak.fr/flights/${originIATA!.toUpperCase()}-${destIATA!.toUpperCase()}/${dep}${ret ? '/' + ret : ''}/${adults}adults`
    : google;

  return { google, skyscanner, kayak };
}

/** Lien Booking pré-rempli : ville + check-in/out + nombre d'adultes. */
export function buildHotelBookingUrl(
  hotelName: string, city: string,
  departure?: string, return_date?: string, travelers = 2,
): string {
  // Booking.com redirige les liens non-affiliés vers leur accueil (perd les params).
  // Google Hotels fonctionne sans affiliation et pré-remplit la recherche.
  const term = hotelName.toLowerCase().includes(city.toLowerCase()) ? hotelName : `${hotelName} ${city}`;
  const p = new URLSearchParams({ q: term });
  if (ymd(departure))   p.set('dates',   `${ymd(departure)},${ymd(return_date) ?? ''}`);
  if (travelers > 1)    p.set('adults',  String(travelers));
  return `https://www.google.com/travel/hotels?${p.toString()}`;
}

/** Lien de réservation réel pour une activité (plateforme de booking, pas une carte). */
export function buildActivityReserveUrl(name: string, city: string): string {
  // N'ajoute la ville que si le nom ne la contient pas déjà (évite "Nobu Maldives Maldives").
  const q = name.toLowerCase().includes(city.toLowerCase()) ? name : `${name} ${city}`;
  // Google Search : plus fiable que GYG pour trouver le vrai site d'un lieu nommé.
  return `https://www.google.com/search?q=${encodeURIComponent(q + ' réservation')}`;
}

// ============================================================
// 4. mapFlights — mapping vols réels → Pack['flights']
// ============================================================

/**
 * Transforme les résultats Tavily en tableau de vols typé Pack['flights'].
 * Cap le prix à 15% du budget si le prix trouvé semble aberrant (> 1800€).
 */
// Ajoute une durée "XhYY" / "Xh" à une heure "HH:MM" → "HH:MM" (même fuseau).
// Garantit la cohérence : heure d'arrivée = heure de départ + durée.
function addDurationToTime(time: string, duration: string): string {
  const [h, m] = time.split(':').map(Number);
  const match  = duration.toLowerCase().match(/(\d+)\s*h\s*(\d*)/);
  const dh     = match ? parseInt(match[1], 10) : 0;
  const dmin   = match && match[2] ? parseInt(match[2], 10) : 0;
  const total  = (((h || 0) * 60 + (m || 0) + dh * 60 + dmin) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Résout le prix d'un billet PAR PERSONNE et PAR TRAJET (aller simple).
 * Source unique de vérité partagée par mapFlights (affichage) et le calcul du
 * budget (camembert) — garantit que les deux montrent le même prix.
 *
 * - Prix réel Tavily si dispo et plausible (≤ 1800€/billet).
 * - Sinon estimation = 15 % du budget / voyageur.
 */
export function resolveFlightPricePerPerson(
  flights: FlightSearchResult[] | undefined,
  budget: number,
  travelers: number,
): number {
  const volPriceEst = Math.round(budget * 0.15 / travelers);
  const rawPrice    = flights?.[0]?.price ?? 0;
  const priceCapped = rawPrice > 1800 ? volPriceEst : rawPrice;
  return priceCapped || volPriceEst;
}

export function mapFlights(
  flights: FlightSearchResult[] | undefined,
  airportCode: string,
  originCode: string,
  originCity: string,
  dest: string,
  budget: number,
  travelers: number,
  departure?: string,
  return_date?: string,
): Pack['flights'] {
  const volPriceEst    = Math.round(budget * 0.15 / travelers);
  // Liens pré-remplis avec la VRAIE demande (villes, IATA, dates, voyageurs) —
  // identiques sur l'aller et le retour : ils pointent vers la recherche A/R complète.
  const links = buildFlightLinks({
    originCity, destCity: dest, originIATA: originCode, destIATA: airportCode,
    departure, return_date, travelers,
  });
  const finalPrice     = `${resolveFlightPricePerPerson(flights, budget, travelers)}€`;

  if (flights?.length) {
    const dur    = flights[0].duration   || null;
    const stops  = flights[0].stops      || null;
    const outDep = flights[0].outbound_time || '10:30';
    return [
      {
        from:             originCode,
        from_city:        originCity,
        to:               airportCode,
        to_city:          dest,
        departure_time:   outDep,
        arrival_time:     dur ? addDurationToTime(outDep, dur) : '—',
        duration:         dur ?? '—',
        stops:            stops ?? '—',
        airline:          flights[0].airline ?? 'À confirmer',
        price_per_person: finalPrice,
        type:             'outbound' as const,
        links,
      },
      {
        from:             airportCode,
        from_city:        dest,
        to:               originCode,
        to_city:          originCity,
        departure_time:   '—',
        arrival_time:     '—',
        duration:         dur ?? '—',
        stops:            stops ?? '—',
        airline:          flights[0].airline ?? 'À confirmer',
        price_per_person: finalPrice,
        type:             'return' as const,
        links,
      },
    ];
  }

  // Fallback : aucune donnée Tavily — prix estimé, durée inconnue
  return [
    { from: originCode, from_city: originCity, to: airportCode, to_city: dest,
      departure_time: '—', arrival_time: '—', duration: '—',
      stops: '—', airline: 'À confirmer', price_per_person: `${volPriceEst}€`, type: 'outbound' as const, links },
    { from: airportCode, from_city: dest, to: originCode, to_city: originCity,
      departure_time: '—', arrival_time: '—', duration: '—',
      stops: '—', airline: 'À confirmer', price_per_person: `${volPriceEst}€`, type: 'return' as const, links },
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
      booking_url,                                  // bouton « Carte » → localisation Google Maps
      reserve_url: buildActivityReserveUrl(name, dest), // bouton « Réserver » → plateforme de booking
    };
  });
}

// ============================================================
// 6. calcBudgetBreakdown — répartition budgétaire par mode
// ============================================================

/**
 * Répartit le budget total en postes cohérents avec les VRAIS prix.
 *
 * - Poste « Vols » = vrai coût des billets (`realFlightTotal`, A/R × voyageurs)
 *   quand il est connu, plafonné à 60 % du budget pour éviter qu'un vol cher
 *   absorbe tout. Fallback sur le ratio théorique si aucun prix réel.
 * - Le budget restant (budget − vols) est réparti sur les autres postes selon
 *   leurs ratios RENORMALISÉS (somme des ratios hors-vols), donc générique quel
 *   que soit le prix des vols : vols pas chers → plus de budget sur place.
 * - Hébergement plafonné à un prix/nuit/personne réaliste (250€, 800€ luxury) ;
 *   le surplus est redistribué sur activités/resto/transports.
 */
export function calcBudgetBreakdown(
  budget: number,
  mode: TravelMode,
  nights: number,
  travelers: number,
  realFlightTotal?: number,
): Pack['budget_breakdown'] {
  const ratio  = BUDGET_RATIOS[mode] ?? BUDGET_RATIOS.party;
  const maxPpn = mode === MODES.LUXURY ? 800 : 250;

  // ── Poste VOLS : vrai coût (plafonné à 60 % du budget) sinon estimation ratio.
  const vols = realFlightTotal && realFlightTotal > 0
    ? Math.min(Math.round(realFlightTotal), Math.round(budget * 0.60))
    : Math.round(budget * ratio.vols);

  // ── Budget restant réparti sur les postes hors-vols (ratios renormalisés).
  const remaining = Math.max(0, budget - vols);
  const otherSum  = ratio.heberg + ratio.activites + ratio.resto + ratio.trans;
  const part      = (r: number) => (otherSum > 0 ? remaining * (r / otherSum) : 0);

  // Hébergement plafonné à un prix/nuit/personne réaliste.
  const nominalHeberg = Math.round(part(ratio.heberg));
  let   heberg        = nominalHeberg;
  const ppn           = heberg / nights / travelers;
  if (ppn > maxPpn) heberg = maxPpn * nights * travelers;

  // Le budget hébergement non dépensé (à cause du plafond) est REDISTRIBUÉ au
  // prorata sur activités/resto/transports — au lieu de gonfler « Divers ».
  const surplus   = Math.max(0, nominalHeberg - heberg);
  const redistSum = ratio.activites + ratio.resto + ratio.trans;
  const share     = (r: number) => (redistSum > 0 ? (surplus * r) / redistSum : 0);

  const activites = Math.round(part(ratio.activites) + share(ratio.activites));
  const resto     = Math.round(part(ratio.resto)     + share(ratio.resto));
  const trans     = Math.round(part(ratio.trans)     + share(ratio.trans));
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
  // Vrai coût des vols = prix/pers résolu × 2 trajets (A/R) × voyageurs.
  const flightPricePerPerson = resolveFlightPricePerPerson(flights, budget, travelers);
  const realFlightTotal      = flightPricePerPerson * 2 * travelers;
  const budgetBreakdown = calcBudgetBreakdown(budget, mode, nights, travelers, realFlightTotal);
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
    flights: mapFlights(flights, airportCode, originCode, originCity, dest, budget, travelers, departure, return_date),
    hotels: (realHotels?.length ? realHotels : t.hotels ?? []).map((h, i) => ({
      name:            h.name ?? `Hôtel ${i + 1}`,
      location:        (h as { loc?: string }).loc ?? (h as { location?: string }).location ?? 'Centre',
      stars:           h.stars ?? (i === 0 && mode === 'luxury' ? 5 : 4),
      price_per_night: (h as { price_per_night?: number }).price_per_night
        ? `${(h as { price_per_night: number }).price_per_night}€`
        : `${Math.round(heberg / nights / (i + 1))}€`,
      highlights:      (h as { hl?: string; highlights?: string }).hl ?? (h as { highlights?: string }).highlights ?? 'Excellent choix',
      emoji:           i === 0 ? '🏨' : '🏩',
      // Lien Booking pré-rempli : ville demandée + check-in/out + voyageurs.
      booking_url:     buildHotelBookingUrl(h.name ?? `Hôtel ${i + 1}`, dest, departure, return_date, travelers),
    })),
    itinerary: (t.itinerary ?? []).map(d => ({
      day:      d.day,
      title:    d.title ?? 'Journée découverte',
      subtitle: mode === MODES.PARTY ? 'Ambiance & Vie nocturne' : mode === MODES.LUXURY ? 'Prestige & Exclusivité' : 'Exploration',
      items: [
        // Heures indicatives (matin/soir). On n'affiche PLUS de prix/durée inventés :
        // l'IA ne fournit que l'activité (am/pm), donc tout chiffre serait du faux.
        { time: mode === MODES.PARTY ? '14:00' : '10:00', type: 'activity' as const, title: d.am ?? 'Exploration', description: '' },
        { time: mode === MODES.PARTY ? '22:00' : '20:00', type: mode === MODES.PARTY ? 'event' as const : 'food' as const, title: d.pm ?? 'Soirée', description: '' },
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
      { phrase: t.phrase ?? 'Santé !', translation: t.phrase_tr ?? 'À votre santé !' },
    ],
  };
}
