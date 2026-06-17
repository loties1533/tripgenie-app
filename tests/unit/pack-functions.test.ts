// =============================================
// TRIPGENIE — tests/unit/pack-functions.test.ts
//
// Tests unitaires des 6 fonctions pures de services/claude/pack.ts
// Aucun appel LLM, aucun service externe — fonctions déterministes.
//
// Fonctions testées :
//   calcNights         → calcul du nombre de nuits
//   buildPackPrompt    → construction du prompt LLM
//   parsePackResponse  → parsing JSON + fallback structuré
//   mapFlights         → FlightSearchResult[] → Pack['flights']
//   mapActivities      → activités LLM → Pack['activities']
//   calcBudgetBreakdown → répartition BUDGET_RATIOS
// =============================================

import { describe, it, expect, vi } from 'vitest';

// ---- Mock callAI uniquement — on garde le vrai parseJSON/sanitizeInput ----
// vi.importActual conserve les vraies implémentations des autres exports.
// Seul callAI est remplacé pour éviter les appels réseau LLM dans les tests.
vi.mock('../../server/services/claude/core.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../server/services/claude/core.js')>();
  return {
    ...real,
    callAI: vi.fn().mockResolvedValue('{}'),
  };
});

import {
  calcNights,
  buildPackPrompt,
  parsePackResponse,
  mapFlights,
  mapActivities,
  calcBudgetBreakdown,
} from '../../server/services/claude/pack.js';

// ============================================================
// 1. calcNights
// ============================================================
describe('calcNights — calcul du nombre de nuits', () => {

  it('dates précises : return_date - departure en jours', () => {
    expect(calcNights('2026-07-10', '2026-07-17', undefined, 2000)).toBe(7);
  });

  it('durée explicite : retourne duration si fournie', () => {
    expect(calcNights(undefined, undefined, 5, 2000)).toBe(5);
  });

  it('fallback budget : budget / 500, borné entre 2 et 14', () => {
    expect(calcNights(undefined, undefined, undefined, 1000)).toBe(2);   // 1000/500=2
    expect(calcNights(undefined, undefined, undefined, 3000)).toBe(6);   // 3000/500=6
    expect(calcNights(undefined, undefined, undefined, 50000)).toBe(14); // capé à 14
    expect(calcNights(undefined, undefined, undefined, 100)).toBe(2);    // minimum 2
  });

  it('aller-retour même jour → minimum 1 nuit', () => {
    expect(calcNights('2026-07-10', '2026-07-10', undefined, 2000)).toBe(1);
  });

  it('dates prioritaires sur duration', () => {
    expect(calcNights('2026-07-10', '2026-07-13', 10, 2000)).toBe(3);
  });
});

// ============================================================
// 2. buildPackPrompt
// ============================================================
describe('buildPackPrompt — construction du prompt LLM', () => {

  const base = {
    dest: 'Ibiza',
    originCity: 'Paris',
    travelers: 2,
    profile: undefined as string | undefined,
    mode: 'party' as const,
    budgetPerPers: 1000,
    nights: 5,
    events: undefined as undefined,
  };

  it('contient la destination et la ville de départ', () => {
    const prompt = buildPackPrompt(base);
    expect(prompt).toContain('Ibiza');
    expect(prompt).toContain('Paris');
  });

  it('contient le mode de voyage', () => {
    const prompt = buildPackPrompt(base);
    expect(prompt).toContain('party');
  });

  it('contient les instructions nightlife pour mode party', () => {
    const prompt = buildPackPrompt(base);
    expect(prompt.toLowerCase()).toContain('nightlife');
  });

  it('contient instructions luxury pour mode luxury', () => {
    const prompt = buildPackPrompt({ ...base, mode: 'luxury' as const });
    expect(prompt.toLowerCase()).toContain('michelin');
  });

  it('contient instructions student pour mode student', () => {
    const prompt = buildPackPrompt({ ...base, mode: 'student' as const });
    expect(prompt.toLowerCase()).toContain('budget');
  });

  it('injecte les événements réels si fournis', () => {
    const events = [
      { title: 'Pacha Opening', venue: 'Pacha Ibiza', category: 'Nightlife', start: '2026-07-15', description: '', booking_url: null, links: { viator: '', getyourguide: '', airbnb: '' } },
    ];
    const prompt = buildPackPrompt({ ...base, events });
    expect(prompt).toContain('Pacha Opening');
  });

  it('contient le budget par personne', () => {
    const prompt = buildPackPrompt(base);
    expect(prompt).toContain('1000');
  });

  it('contient le nombre de nuits', () => {
    const prompt = buildPackPrompt(base);
    expect(prompt).toContain('5');
  });

  it('contient le nombre de voyageurs', () => {
    const prompt = buildPackPrompt(base);
    expect(prompt).toContain('2');
  });
});

// ============================================================
// 3. parsePackResponse
// ============================================================
describe('parsePackResponse — parsing JSON + fallback', () => {

  it('parse un JSON valide', () => {
    const raw = JSON.stringify({
      country: 'Espagne',
      tagline: 'Ibiza by night',
      airport_code: 'IBZ',
    });
    const result = parsePackResponse(raw, 'Ibiza', 5);
    expect(result.country).toBe('Espagne');
    expect(result.tagline).toBe('Ibiza by night');
    expect(result.airport_code).toBe('IBZ');
  });

  it('parse JSON avec fences markdown (```json ... ```)', () => {
    const raw = '```json\n{"country":"France","tagline":"Paris forever"}\n```';
    const result = parsePackResponse(raw, 'Paris', 3);
    expect(result.country).toBe('France');
  });

  it('fallback si JSON totalement invalide', () => {
    const result = parsePackResponse('ceci nest pas du json !!!', 'Ibiza', 5);
    expect(result.country).toBeDefined();
    expect(result.tagline).toContain('Ibiza');
    expect(result.itinerary).toHaveLength(3); // Math.min(5, 3) = 3 jours
  });

  it('fallback contient des hôtels génériques', () => {
    const result = parsePackResponse('invalid', 'Barcelone', 4);
    expect(result.hotels).toHaveLength(2);
    expect(result.hotels![0].name).toContain('Barcelone');
  });

  it('fallback itinerary limité à 3 jours max', () => {
    const result = parsePackResponse('invalid', 'Tokyo', 10);
    expect(result.itinerary!.length).toBeLessThanOrEqual(3);
  });

  it('fallback avec 1 nuit : itinerary 1 jour', () => {
    const result = parsePackResponse('invalid', 'Lyon', 1);
    expect(result.itinerary).toHaveLength(1);
  });

  it('parse JSON tronqué (bracket manquant)', () => {
    const raw = '{"country":"Italie","tagline":"Roma"}'; // valide mais tronqué volontairement
    const result = parsePackResponse(raw, 'Rome', 4);
    expect(result.country).toBe('Italie');
  });
});

// ============================================================
// 4. mapFlights
// ============================================================
describe('mapFlights — mapping vols → Pack[\'flights\']', () => {

  const flight = {
    price: 150,
    airline: 'Vueling',
    outbound_time: '08:00',
    arrival_time: '10:00',
    duration: '2h00',
    stops: 'Direct',
    booking_url: null,
    links: { skyscanner: 'https://skyscanner.fr', kayak: '', google: '' },
  };

  it('produit exactement 2 vols (aller + retour)', () => {
    const flights = mapFlights([flight], 'IBZ', 'CDG', 'Paris', 'Ibiza', 2000, 2);
    expect(flights).toHaveLength(2);
  });

  it('vol aller de type outbound', () => {
    const flights = mapFlights([flight], 'IBZ', 'CDG', 'Paris', 'Ibiza', 2000, 2);
    expect(flights[0].type).toBe('outbound');
    expect(flights[0].from).toBe('CDG');
    expect(flights[0].to).toBe('IBZ');
  });

  it('vol retour de type return', () => {
    const flights = mapFlights([flight], 'IBZ', 'CDG', 'Paris', 'Ibiza', 2000, 2);
    expect(flights[1].type).toBe('return');
    expect(flights[1].from).toBe('IBZ');
    expect(flights[1].to).toBe('CDG');
  });

  it('prix pas divisé (déjà par personne)', () => {
    const flights = mapFlights([flight], 'IBZ', 'CDG', 'Paris', 'Ibiza', 2000, 2);
    expect(flights[0].price_per_person).toBe('150€');
  });

  it('prix aberrant (>1800€) → capé à 15% du budget/pers', () => {
    const expensiveFlight = { ...flight, price: 5000 };
    const flights = mapFlights([expensiveFlight], 'IBZ', 'CDG', 'Paris', 'Ibiza', 2000, 2);
    // budget 2000€, 2 pers → 15% = 300€/pers → pas 5000€
    const priceNum = parseInt(flights[0].price_per_person!.replace('€', ''));
    expect(priceNum).toBeLessThan(1800);
  });

  it('fallback sans données Tavily : vols estimés générés', () => {
    const flights = mapFlights(undefined, 'IBZ', 'CDG', 'Paris', 'Ibiza', 2000, 2);
    expect(flights).toHaveLength(2);
    expect(flights[0].airline).toBe('Air France');
  });

  it('fallback sans données : prix = 15% budget/pers', () => {
    const flights = mapFlights([], 'IBZ', 'CDG', 'Paris', 'Ibiza', 2000, 2);
    // 15% de 2000€ / 2 pers = 150€
    expect(flights[0].price_per_person).toBe('150€');
  });

  it('propage les liens Skyscanner', () => {
    const flights = mapFlights([flight], 'IBZ', 'CDG', 'Paris', 'Ibiza', 2000, 2);
    expect(flights[0].links?.skyscanner).toBe('https://skyscanner.fr');
  });
});

// ============================================================
// 5. mapActivities
// ============================================================
describe('mapActivities — mapping activités → Pack[\'activities\']', () => {

  it('retourne un tableau vide si undefined', () => {
    expect(mapActivities(undefined, 'Ibiza')).toHaveLength(0);
  });

  it('retourne un tableau vide si tableau vide', () => {
    expect(mapActivities([], 'Ibiza')).toHaveLength(0);
  });

  it('catégorie Nightlife pour type club', () => {
    const acts = mapActivities([{ name: 'Pacha', type: 'club', desc: 'legendary' }], 'Ibiza');
    expect(acts[0].category).toBe('Nightlife');
    expect(acts[0].emoji).toBe('🎉');
  });

  it('catégorie Gastronomie pour type restaurant', () => {
    const acts = mapActivities([{ name: 'Nobu', type: 'restaurant-étoilé', desc: 'Michelin' }], 'Ibiza');
    expect(acts[0].category).toBe('Gastronomie');
    expect(acts[0].emoji).toBe('🍽');
  });

  it('catégorie Nautique pour type bateau', () => {
    const acts = mapActivities([{ name: 'Yacht privé', type: 'bateau', desc: 'exclusif' }], 'Ibiza');
    expect(acts[0].category).toBe('Nautique');
    expect(acts[0].emoji).toBe('⛵');
  });

  it('catégorie Culture par défaut', () => {
    const acts = mapActivities([{ name: 'Musée Dali', type: 'culture', desc: 'art' }], 'Figueres');
    expect(acts[0].category).toBe('Culture');
    expect(acts[0].emoji).toBe('🏛');
  });

  it('lien Google Maps universel pour un restaurant', () => {
    const acts = mapActivities([{ name: 'Nobu', type: 'restaurant', desc: 'test' }], 'Ibiza');
    expect(acts[0].booking_url).toContain('google.com/maps');
  });

  it('lien Google Maps universel pour un bateau', () => {
    const acts = mapActivities([{ name: 'Sailing trip', type: 'bateau', desc: 'test' }], 'Ibiza');
    expect(acts[0].booking_url).toContain('google.com/maps');
  });

  it('lien Google Maps universel pour le nightlife', () => {
    const acts = mapActivities([{ name: 'Amnesia', type: 'club', desc: 'test' }], 'Ibiza');
    expect(acts[0].booking_url).toContain('google.com/maps');
  });

  it('lien Google Maps universel inclut la ville (bonne ville partout)', () => {
    const acts = mapActivities([{ name: 'Cathédrale', type: 'monument', desc: 'test' }], 'Paris');
    expect(acts[0].booking_url).toContain('google.com/maps');
    expect(acts[0].booking_url).toContain('Paris');
  });

  it('préserve le nom de l\'activité', () => {
    const acts = mapActivities([{ name: 'Ushuaïa Beach Club', type: 'beach-club', desc: 'test' }], 'Ibiza');
    expect(acts[0].name).toBe('Ushuaïa Beach Club');
  });

  it('fallback name si absent', () => {
    const acts = mapActivities([{ type: 'culture', desc: 'test' }], 'Ibiza');
    expect(acts[0].name).toBe('Activité');
  });
});

// ============================================================
// 6. calcBudgetBreakdown
// ============================================================
describe('calcBudgetBreakdown — répartition BUDGET_RATIOS', () => {

  it('total = budget fourni', () => {
    const bd = calcBudgetBreakdown(2000, 'party', 5, 2);
    expect(bd.total).toBe('2000€');
  });

  it('mode party : 25% vols (ratio.vols = 0.25)', () => {
    const bd = calcBudgetBreakdown(2000, 'party', 5, 2);
    expect(bd.vols).toBe('500€'); // 2000 * 0.25
  });

  it('mode luxury : 20% vols (ratio.vols = 0.20)', () => {
    const bd = calcBudgetBreakdown(2000, 'luxury', 5, 2);
    expect(bd.vols).toBe('400€'); // 2000 * 0.20
  });

  it('mode student : 35% vols (ratio.vols = 0.35)', () => {
    const bd = calcBudgetBreakdown(2000, 'student', 5, 2);
    expect(bd.vols).toBe('700€'); // 2000 * 0.35
  });

  it('plafond hébergement luxury : max 800€/nuit/pers', () => {
    // budget 100000, luxury, 5 nuits, 2 pers
    // heberg = 100000 * 0.45 = 45000 → ppn = 45000/5/2 = 4500 > 800 → capé à 800*5*2 = 8000
    const bd = calcBudgetBreakdown(100000, 'luxury', 5, 2);
    const heberg = parseInt(bd.hebergement.replace('€', ''));
    expect(heberg).toBe(8000);
  });

  it('plafond hébergement standard : max 250€/nuit/pers', () => {
    // budget 50000, party, 5 nuits, 2 pers
    // heberg = 50000 * 0.25 = 12500 → ppn = 12500/5/2 = 1250 > 250 → capé à 250*5*2 = 2500
    const bd = calcBudgetBreakdown(50000, 'party', 5, 2);
    const heberg = parseInt(bd.hebergement.replace('€', ''));
    expect(heberg).toBe(2500);
  });

  it('divers = budget - somme des autres postes (jamais négatif)', () => {
    const bd = calcBudgetBreakdown(2000, 'party', 5, 2);
    const vols    = parseInt(bd.vols.replace('€', ''));
    const heberg  = parseInt(bd.hebergement.replace('€', ''));
    const acts    = parseInt(bd.activites.replace('€', ''));
    const resto   = parseInt(bd.restauration.replace('€', ''));
    const trans   = parseInt(bd.transports.replace('€', ''));
    const divers  = parseInt(bd.divers.replace('€', ''));
    expect(divers).toBeGreaterThanOrEqual(0);
    expect(vols + heberg + acts + resto + trans + divers).toBeLessThanOrEqual(2001); // ±1 arrondi
  });

  it('tous les champs sont présents', () => {
    const bd = calcBudgetBreakdown(3000, 'relax', 7, 2);
    expect(bd).toHaveProperty('vols');
    expect(bd).toHaveProperty('hebergement');
    expect(bd).toHaveProperty('activites');
    expect(bd).toHaveProperty('restauration');
    expect(bd).toHaveProperty('transports');
    expect(bd).toHaveProperty('divers');
    expect(bd).toHaveProperty('total');
  });

  it('chaque champ est une string terminant par €', () => {
    const bd = calcBudgetBreakdown(2000, 'group', 4, 3);
    expect(bd.vols).toMatch(/^\d+€$/);
    expect(bd.hebergement).toMatch(/^\d+€$/);
    expect(bd.total).toMatch(/^\d+€$/);
  });
});
