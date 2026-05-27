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

export interface BudgetRatio {
  vols: number;
  heberg: number;
  activites: number;
  resto: number;
  trans: number;
}

export const BUDGET_RATIOS: Record<TravelMode, BudgetRatio> = {
  party:    { vols: 0.25, heberg: 0.25, activites: 0.25, resto: 0.12, trans: 0.08 },
  student:  { vols: 0.35, heberg: 0.30, activites: 0.10, resto: 0.15, trans: 0.05 },
  luxury:   { vols: 0.20, heberg: 0.45, activites: 0.20, resto: 0.10, trans: 0.03 },
  group:    { vols: 0.30, heberg: 0.35, activites: 0.15, resto: 0.12, trans: 0.05 },
  relax:    { vols: 0.22, heberg: 0.40, activites: 0.15, resto: 0.13, trans: 0.07 },
  surprise: { vols: 0.28, heberg: 0.32, activites: 0.18, resto: 0.13, trans: 0.06 },
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
