/**
 * MOCKS DE SURVIE - TRIPGENIE
 * Données de simulation de haute qualité à utiliser
 * uniquement lorsque les quotas d'IA sont épuisés.
 */

import type { ResultatOnboarding, Pack } from '../lib/types.js';

export const MOCK_ONBOARDING: ResultatOnboarding & { isMock: boolean } = {
  response:
    "Je suis désolé, mes experts locaux sont tous occupés à préparer des départs ! ✨ En attendant leur retour, je peux vous proposer un itinéraire 'Signature TripGenie' basé sur les préférences classiques. Cela vous tente ?",
  chips: ['Oui, montre-moi !', 'Je préfère attendre'],
  extractedData: {
    profile: 'Voyageur',
    budget: 2000,
    duration: 7,
    mode: 'relax',
    discoveryMode: 'classic',
  },
  isReady: false,
  isMock: true,
};

export interface MockDestination {
  city: string;
  country: string;
  reason: string;
  match_score: number;
}

export const MOCK_DESTINATIONS: { destinations: MockDestination[]; isMock: boolean } = {
  destinations: [
    {
      city: 'Ibiza',
      country: 'Espagne',
      reason: 'La capitale mondiale de la fête avec des coins secrets magnifiques.',
      match_score: 98,
    },
    {
      city: 'Hvar',
      country: 'Croatie',
      reason: "Une île chic, ensoleillée et parfaite pour les groupes d'amis.",
      match_score: 92,
    },
    {
      city: 'Saint-Tropez',
      country: 'France',
      reason: "Le luxe à la française par excellence, idéal pour votre budget.",
      match_score: 89,
    },
  ],
  isMock: true,
};

// Un itinéraire ultra-complet pour Ibiza (Destination par défaut pour la démo)
export const MOCK_PACK: Partial<Pack> & { isMock: boolean } = {
  destination: 'Ibiza',
  country: 'Espagne',
  tagline: "L'île Blanche : Entre Rythme Effréné et Calme Azur",
  overview:
    "Ibiza n'est pas qu'une île de fête. C'est un joyau des Baléares où les eaux cristallines rencontrent une architecture bohème-chic.",
  weather: { avg_temp: '26°C', conditions: 'Soleil radieux', tip: "N'oubliez pas vos lunettes de soleil." },
  summary: { total_budget: '8000€', nights: 7, activities_count: 12 },
  activities: [
    { name: 'Plage de Pampelonne', category: 'Plage', emoji: '🏖', description: 'Le spot mythique.', duration: '4h', price: 'Gratuit', best_time: 'Journée' },
    { name: 'Place des Lices', category: 'Culture', emoji: '🏛', description: 'Pétanque et marché.', duration: '2h', price: 'Gratuit', best_time: 'Matin' },
    { name: 'Citadelle de Saint-Tropez', category: 'Culture', emoji: '🏛', description: 'Vue imprenable.', duration: '3h', price: '15€', best_time: 'Journée' },
  ],
  flights: [
    { from: 'BOD', from_city: 'Bordeaux', to: 'NCE', to_city: 'Nice', departure_time: '10:15', arrival_time: '12:00', duration: '1h45', stops: 'Direct', airline: 'Air France', price_per_person: '145€', type: 'outbound' },
    { from: 'NCE', from_city: 'Nice', to: 'BOD', to_city: 'Bordeaux', departure_time: '18:30', arrival_time: '20:15', duration: '1h45', stops: 'Direct', airline: 'Air France', price_per_person: '145€', type: 'return' },
  ],
  hotels: [
    { name: 'Hôtel Byblos', location: 'Centre', stars: 5, price_per_night: '850€', highlights: 'La légende de Saint-Tropez.', emoji: '🏨', match_reason: 'Le summum du luxe festif' },
    { name: 'Hôtel de Paris', location: 'Port', stars: 5, price_per_night: '550€', highlights: 'Rooftop avec piscine transparente.', emoji: '🏩', match_reason: 'Design moderne et vue mer' },
  ],
  itinerary: [
    {
      day: 1, title: 'Arrivée & Sunset Chill', subtitle: "Bienvenue sur l'île",
      items: [
        { time: '14:00', type: 'activity', title: 'Installation au Nobu', description: 'Cocktail de bienvenue face à la baie.', price: 'Inclus', duration: '1h' },
        { time: '19:00', type: 'food', title: 'Dîner au Blue Marlin', description: 'Le beach club mythique.', price: '80€', duration: '3h' },
      ],
    },
    {
      day: 2, title: 'Exploration des Calas', subtitle: 'Eaux turquoise',
      items: [
        { time: '10:00', type: 'activity', title: 'Cala Salada', description: "Baignade dans l'une des plus belles criques.", price: 'Gratuit', duration: '4h' },
        { time: '20:00', type: 'activity', title: 'Datcha Night', description: 'Première immersion dans la vie nocturne.', price: '50€', duration: 'Toute la nuit' },
      ],
    },
  ],
  events: [],
  budget_breakdown: { vols: '2000€', hebergement: '3000€', activites: '1500€', restauration: '1000€', transports: '300€', divers: '200€', total: '8000€' },
  tips: [],
  local_phrases: [],
  isMock: true,
};
