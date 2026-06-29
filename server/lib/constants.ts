import type { TravelMode, TripStatus } from './types.js';

export const MODES = {
  PARTY:    'party',
  STUDENT:  'student',
  LUXURY:   'luxury',
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
  party:    { vols: 0.25, hebergement: 0.25, activites: 0.25, restauration: 0.12, transports: 0.08 },
  student:  { vols: 0.35, hebergement: 0.30, activites: 0.10, restauration: 0.15, transports: 0.05 },
  luxury:   { vols: 0.20, hebergement: 0.45, activites: 0.20, restauration: 0.10, transports: 0.03 },
  group:    { vols: 0.30, hebergement: 0.35, activites: 0.15, restauration: 0.12, transports: 0.05 },
  relax:    { vols: 0.22, hebergement: 0.40, activites: 0.15, restauration: 0.13, transports: 0.07 },
  surprise: { vols: 0.28, hebergement: 0.32, activites: 0.18, restauration: 0.13, transports: 0.06 },
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

/** Nom du cookie httpOnly portant le JWT d'authentification (lecture côté middleware + pose côté routes auth). */
export const NOM_COOKIE_AUTH = 'tg_token';
