// =============================================
// TRIPGENIE — src/lib/api.ts
// Toutes les requêtes HTTP vers l'API Express
// =============================================

import type {
  Pack, TripRecord, User, ResultatOnboarding, ResultatScore
} from '../../../server/lib/types'

// En développement : Vite proxifie /api → localhost:3000
// En production : VITE_API_URL pointe vers l'API distante
const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

async function request<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // cookie httpOnly envoyé automatiquement
    ...opts
  })
  const data = await res.json() as T
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`)
  return data
}

// ---- Auth ----
export const logout = () => request<{ message: string }>('/auth/logout', { method: 'POST' })

export const login  = (email: string, password: string) =>
  request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })

export const signup = (email: string, password: string, name: string) =>
  request<{ user: User }>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) })

export const getMe = () => request<{ user: User }>('/auth/me')

// ---- IA ----
export const chatOnboarding = (userMessage: string, currentData: Record<string, unknown>) =>
  request<ResultatOnboarding>('/ai/onboarding', { method: 'POST', body: JSON.stringify({ userMessage, currentData }) })

export interface DestinationItem {
  city: string;
  country: string;
  tagline?: string;
  reason?: string;
  budget_estimate?: string;
  match_score?: number;
  photo?: string | null;
}
export const getDestinations = (params: Record<string, unknown>) =>
  request<{ destinations: DestinationItem[] }>('/ai/destinations', { method: 'POST', body: JSON.stringify(params) })

export interface GeneratePackResponse {
  pack: Pack;
  trip_id: string | null;
  pack_id: string | null;
  score: ResultatScore;
  flights_found: boolean;
  events_found: boolean;
}
export const generatePack = (params: Record<string, unknown>) =>
  request<GeneratePackResponse>('/ai/generate', { method: 'POST', body: JSON.stringify(params) })

export interface ChatModifyResponse {
  response: string;
  needs_full_regen?: boolean;
  modifications?: Partial<Pack>;
  chips?: string[];
}
export const chatModify = (message: string, currentPack: Pack, mode: string, tripId: string | null) =>
  request<ChatModifyResponse>('/ai/chat', { method: 'POST', body: JSON.stringify({ message, current_pack: currentPack, mode, trip_id: tripId }) })

// ---- Voyages (CRUD) ----
export const getTrips      = (filters: Record<string, string> = {}) =>
  request<{ trips: TripRecord[]; count: number }>(`/trips?${new URLSearchParams(filters)}`)

export const getTrip       = (id: string) => request<{ trip: TripRecord }>(`/trips/${id}`)
export const getPublicTrip = (id: string) => request<{ trip: TripRecord & { pack_id: string | null } }>(`/trips/share/${id}`)
export const deleteTrip    = (id: string) => request<{ message: string }>(`/trips/${id}`, { method: 'DELETE' })
export const updateTrip    = (id: string, fields: { status?: string; travelers?: number; budget?: string }) =>
  request<{ trip: TripRecord }>(`/trips/${id}`, { method: 'PUT', body: JSON.stringify(fields) })

// ---- Photos — proxy backend (clé Unsplash jamais exposée côté client) ----
export const getCityPhoto = (city: string) => request<{ url: string }>(`/photos/${encodeURIComponent(city)}`)

// ---- Préférences utilisateur (relation 1-1) ----
export interface UserPreferences {
  default_mode?: string;
  preferred_prefs?: string[];
  home_city?: string;
  currency?: string;
}
export const getPreferences  = () => request<{ preferences: UserPreferences | null }>('/preferences')
export const savePreferences = (fields: UserPreferences) =>
  request<{ preferences: UserPreferences }>('/preferences', { method: 'PUT', body: JSON.stringify(fields) })

// ---- Votes ----
export const saveVote = (pack_id: string, item_id: string, vote_type: boolean, voter_name = '') =>
  request<{ vote: unknown }>('/votes', { method: 'POST', body: JSON.stringify({ pack_id, item_id, vote_type, voter_name }) })

export const getVotes = (pack_id: string) => request<{ votes: unknown[] }>(`/votes/${pack_id}`)
