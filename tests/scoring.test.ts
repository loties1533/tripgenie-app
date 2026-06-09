import { describe, it, expect } from 'vitest';
import { scorepack, rankPacks } from '../server/services/scoring.js';
import { MODES } from '../server/lib/constants.js';

const packBase = {
  vol:        { price: 400, duration_min: 120, stops: 0 },
  hotel:      { stars: 4, price_per_night: 150, rating: 8.5 },
  events:     [{ category: 'nightlife' }, { category: 'concert' }],
  activities: [{ name: 'Visite musée' }, { name: 'Tour en vélo' }],
  totalPrice: 2000
};

describe('scorepack — algorithme de scoring multi-critères', () => {

  it('retourne un score entre 0 et 1', () => {
    const result = scorepack(packBase, MODES.PARTY, 2, 'Barcelone');
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(1);
  });

  it('retourne un objet avec total et details', () => {
    const result = scorepack(packBase, MODES.PARTY, 2, 'Barcelone');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('details');
  });

  it('mode luxury favorise les hôtels étoilés', () => {
    const packLuxe  = { ...packBase, hotel: { stars: 5, price_per_night: 500, rating: 9.5 } };
    const packBasic = { ...packBase, hotel: { stars: 2, price_per_night: 50,  rating: 6.0 } };
    const scoreLuxe  = scorepack(packLuxe,  MODES.LUXURY, 2, 'Monaco');
    const scoreBasic = scorepack(packBasic, MODES.LUXURY, 2, 'Monaco');
    expect(scoreLuxe.total).toBeGreaterThan(scoreBasic.total);
  });

  it('mode student favorise les prix bas', () => {
    const packPasCher = { ...packBase, vol: { price: 80,  duration_min: 200, stops: 1 }, totalPrice: 500  };
    const packCher    = { ...packBase, vol: { price: 800, duration_min: 90,  stops: 0 }, totalPrice: 3000 };
    const scorePasCher = scorepack(packPasCher, MODES.STUDENT, 1, 'Prague');
    const scoreCher    = scorepack(packCher,    MODES.STUDENT, 1, 'Prague');
    expect(scorePasCher.total).toBeGreaterThan(scoreCher.total);
  });

  it('mode surprise donne un meilleur score aux destinations originales', () => {
    const scoreOriginal = scorepack(packBase, MODES.SURPRISE, 2, 'Tbilissi');
    const scoreCommun   = scorepack(packBase, MODES.SURPRISE, 2, 'Paris');
    expect(scoreOriginal.total).toBeGreaterThan(scoreCommun.total);
  });

  it('gère les données manquantes sans planter', () => {
    const packVide = { vol: null, hotel: null, events: [], activities: [], totalPrice: 0 };
    expect(() => scorepack(packVide, MODES.RELAX, 2, 'Bali')).not.toThrow();
  });

  it('gère un mode inconnu sans planter (fallback party)', () => {
    expect(() => scorepack(packBase, 'mode_inexistant', 2, 'Rome')).not.toThrow();
  });

  it('mode relax pénalise les destinations avec beaucoup d\'événements festifs', () => {
    const packAnimé = { ...packBase, events: Array(15).fill({ category: 'concert', title: 'Festival' }) };
    const packCalme = { ...packBase, events: [] };
    const scoreAnimé = scorepack(packAnimé, MODES.RELAX, 2, 'Ibiza');
    const scoreCalme = scorepack(packCalme,  MODES.RELAX, 2, 'Alentejo');
    expect(scoreCalme.total).toBeGreaterThan(scoreAnimé.total);
  });

  it('mode group favorise les hôtels avec capacité suffisante', () => {
    const packCapacité = { ...packBase, hotel: { stars: 3, price_per_night: 100, rating: 7.5, max_guests: 6 } };
    const packPetit    = { ...packBase, hotel: { stars: 3, price_per_night: 100, rating: 7.5, max_guests: 1 } };
    const scoreCapacité = scorepack(packCapacité, MODES.GROUP, 4, 'Barcelone');
    const scorePetit    = scorepack(packPetit,    MODES.GROUP, 4, 'Barcelone');
    expect(scoreCapacité.total).toBeGreaterThan(scorePetit.total);
  });

  it('mode student favorise les activités gratuites', () => {
    const packGratuit = { ...packBase, activities: [
      { name: 'Plage', category: 'nature', price: 0,  price_range: 'free' },
      { name: 'Musée gratuit', category: 'culture', price: 0, price_range: 'free' }
    ]};
    const packPayant = { ...packBase, activities: [
      { name: 'Safari', category: 'adventure', price: 200 },
      { name: 'Spa VIP',  category: 'wellness',  price: 300 }
    ]};
    const scoreGratuit = scorepack(packGratuit, MODES.STUDENT, 1, 'Prague');
    const scorePayant  = scorepack(packPayant,  MODES.STUDENT, 1, 'Prague');
    expect(scoreGratuit.total).toBeGreaterThan(scorePayant.total);
  });

  it('le détail contient bien toutes les clés de score', () => {
    const result = scorepack(packBase, MODES.LUXURY, 2, 'Monaco');
    const keys = ['vol', 'hotel', 'events', 'activities', 'prix'];
    keys.forEach(k => expect(result.details).toHaveProperty(k));
  });
});

// ============================================================
// rankPacks — tri et classement
// ============================================================

describe('rankPacks — classement des packs', () => {

  const packBudget = {
    vol:        { price: 80,  duration_min: 180, stops: 1 },
    hotel:      { stars: 2, price_per_night: 40,  rating: 6.5 },
    events:     [],
    activities: [{ name: 'Musée', category: 'culture', price: 0, price_range: 'free' }],
    totalPrice: 500
  };

  const packLuxe = {
    vol:        { price: 800, duration_min: 90, stops: 0 },
    hotel:      { stars: 5, price_per_night: 500, rating: 9.5 },
    events:     [{ category: 'gala', title: 'Gala VIP' }],
    activities: [{ name: 'Yacht', category: 'leisure', price: 500 }],
    totalPrice: 8000
  };

  it('retourne au maximum 3 packs', () => {
    const packs = [packBase, packBudget, packLuxe, { ...packBase, totalPrice: 3000 }];
    const ranked = rankPacks(packs, MODES.LUXURY, 2, 'Monaco');
    expect(ranked.length).toBeLessThanOrEqual(3);
  });

  it('le pack le mieux noté est rank 1', () => {
    const packs = [packBudget, packLuxe];
    const ranked = rankPacks(packs, MODES.LUXURY, 2, 'Monaco');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].score.total).toBeGreaterThanOrEqual(ranked[1]?.score.total ?? 0);
  });

  it('chaque pack a un score calculé', () => {
    const packs = [packBase, packBudget];
    const ranked = rankPacks(packs, MODES.PARTY, 2, 'Barcelone');
    ranked.forEach(p => {
      expect(p.score).toBeDefined();
      expect(p.score.total).toBeGreaterThanOrEqual(0);
      expect(p.score.total).toBeLessThanOrEqual(1);
    });
  });
});
