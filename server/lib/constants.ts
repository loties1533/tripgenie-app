import type { TravelMode, TripStatus } from './types.js';

export const MODES = {
  PARTY:    'party',
  STUDENT:  'student',
  GROUP:    'group',
  RELAX:    'relax',
  SURPRISE: 'surprise',
} as const;

export type ModeKey = keyof typeof MODES;
export const MODES_LIST: TravelMode[] = Object.values(MODES) as TravelMode[];

export interface RatioBudget {
  vols: number;
  hebergement: number;
  activites: number;
  restauration: number;
  transports: number;
}

export const BUDGET_RATIOS: Record<TravelMode, RatioBudget> = {
  party:    { vols: 0.25, hebergement: 0.25, activites: 0.27, restauration: 0.10, transports: 0.08 },
  student:  { vols: 0.35, hebergement: 0.30, activites: 0.10, restauration: 0.15, transports: 0.05 },
  group:    { vols: 0.30, hebergement: 0.35, activites: 0.15, restauration: 0.12, transports: 0.05 },
  relax:    { vols: 0.22, hebergement: 0.40, activites: 0.15, restauration: 0.13, transports: 0.07 },
  surprise: { vols: 0.28, hebergement: 0.32, activites: 0.18, restauration: 0.13, transports: 0.06 },
};

// Plafonds de dépenses selon le NIVEAU DE PRIX (axe orthogonal au mode/vibe).
// Remplace les anciens `mode === 'luxury' ? X : Y` dispersés dans pack.ts :
// une seule source de vérité pour régler les 2 niveaux Premium / Classique.
//   maxPpn    = prix max €/nuit/personne pour l'hébergement
//   activites/resto/transp = plafonds €/jour/personne des postes dépensables
export interface PlafondsPrix {
  maxPpn: number;
  activites: number;
  resto: number;
  transp: number;
}

export const PLAFONDS: Record<'classique' | 'premium', PlafondsPrix> = {
  classique: { maxPpn: 250, activites: 80,  resto: 60,  transp: 25 },
  premium:   { maxPpn: 800, activites: 250, resto: 150, transp: 60 },
};

export const TRIP_STATUS = {
  DRAFT:     'draft',
  CONFIRMED: 'confirmed',
  ARCHIVED:  'archived',
} as const;

export const TRIP_STATUS_LIST: TripStatus[] = Object.values(TRIP_STATUS) as TripStatus[];

export const DEFAULT_VALUES = {
  ORIGIN:    'Paris',
  TRAVELERS: 2,
  NIGHTS:    4,
  MODE:      MODES.PARTY as TravelMode,
} as const;

export const NOM_COOKIE_AUTH = 'tg_token';
