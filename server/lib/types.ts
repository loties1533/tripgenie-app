export interface Meteo {
  avg_temp: string;   // ex : "22°C"
  conditions: string; // ex : "Ensoleillé"
  tip: string;        // conseil vestimentaire
  humidity?: number;  // ex : 65 (%)
  wind?: string;      // ex : "15 km/h"
}

export type TypeVol = 'outbound' | 'return';

export interface TronconVol {
  from: string;
  from_city: string;
  to: string;
  to_city: string;
  departure_time: string;   // ex : "10:30"
  arrival_time: string;
  duration: string;         // ex : "2h30"
  stops: string;            // "Direct" ou "1 escale(s)"
  airline: string;
  price_per_person: string; // ex : "250€"
  type: TypeVol;
  links?: FlightLinks;
}

export interface FlightLinks {
  skyscanner: string;
  kayak: string;
  google: string;
}

export interface HotelLinks {
  booking: string;
  hotels: string;
  google: string;
}

export interface ActivityLinks {
  viator: string;
  getyourguide: string;
  airbnb: string;
}

export interface Hotel {
  name: string;
  location: string;
  stars: number;
  price_per_night: string; // ex : "150€"
  highlights: string;
  emoji: string;
  match_reason?: string;
  booking_url?: string; // lien Booking pré-rempli (ville + dates + voyageurs)
  links?: HotelLinks;
  // Champs utilisés par le scoring (données brutes)
  max_guests?: number;
  rating?: number;
  price?: number; // prix numérique pour le scoring
}

export type TypeElementItineraire = 'activity' | 'food' | 'event';

export interface ElementItineraire {
  time: string;
  type: TypeElementItineraire;
  title: string;
  description: string;
  price?: string;      // optionnel : on n'invente pas de prix si on ne le connaît pas
  duration?: string;   // optionnel : idem pour la durée
}

export interface JourneeItineraire {
  day: number;
  title: string;
  subtitle: string;
  items: ElementItineraire[];
}

export interface Activite {
  name: string;
  category: string;
  emoji: string;
  description: string;
  duration: string;
  price: string | number;
  price_range?: string;
  best_time?: string;
  booking_url?: string;  // lien carte (Google Maps) — localisation du lieu
  reserve_url?: string;  // lien de réservation réel (plateforme de booking)
  links?: ActivityLinks;
}

export interface Evenement {
  title: string;
  category: string;
  start: string;
  venue: string;
  description: string;
  booking_url?: string | null;
  links?: ActivityLinks;
}

export interface RepartitionBudget {
  vols: string;
  hebergement: string;
  activites: string;
  restauration: string;
  transports: string;
  divers: string;
  total: string;
}

export interface DetailsScore {
  vol: number;
  hotel: number;
  events: number;
  activities: number;
  prix: number;
  activities_free?: number;
  calme?: number;
  global?: number;
  originalite?: number;
}

export interface ResultatScore {
  total: number;    // score global entre 0 et 1
  details: DetailsScore;
  label?: string;   // ex : "Excellent", "Bon", "Moyen"
}

export interface ResumePack {
  total_budget: string;
  nights: number;
  activities_count: number;
}

export interface ConseilVoyage {
  title: string;
  content: string;
}

export interface ExpressionLocale {
  phrase: string;
  translation: string;
}

export interface Pack {
  destination: string;
  country: string;
  tagline: string;
  overview: string;
  weather?: Meteo;
  summary: ResumePack;
  flights: TronconVol[];
  hotels: Hotel[];
  itinerary: JourneeItineraire[];
  activities: Activite[];
  events: Evenement[];
  budget_breakdown: RepartitionBudget;
  tips?: ConseilVoyage[];
  local_phrases?: ExpressionLocale[];
  score?: ResultatScore;
  photo_url?: string;
  isMock?: boolean;
}

export interface ResultatOnboarding {
  response: string;      // réponse textuelle du bot
  chips: string[];       // suggestions cliquables
  extractedData: Record<string, unknown>; // données voyage extraites du message
  isReady: boolean;      // true quand toutes les infos nécessaires sont collectées
  isMock?: boolean;      // true si réponse de secours (fallback)
}

export interface EnregistrementVoyage {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  origin: string;
  departure: string;
  return_date: string;
  travelers: number;
  budget: string;
  mode: TravelMode;
  pack_data: Pack;
  score: number;
  status: TripStatus;
  created_at: string;
  updated_at: string;
}

export type TravelMode = 'party' | 'luxury' | 'student' | 'group' | 'relax' | 'surprise';
export type TripStatus = 'draft' | 'confirmed' | 'archived';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
}

// Payload du token JWT (ce qui est dans req.user)
export interface JwtPayload {
  id: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}

// Une suggestion de destination renvoyée par /ai/destinations (type partagé client/serveur)
export interface ElementDestination {
  city: string;
  country: string;
  tagline?: string;
  reason?: string;
  budget_estimate?: string;
  match_score?: number;
  photo?: string | null;
}
