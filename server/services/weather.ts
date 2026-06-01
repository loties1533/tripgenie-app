/**
 * @fileoverview Météo réelle via Open-Meteo (gratuit, sans clé API).
 *
 * 3 modes selon la date de départ :
 * - ≤ 16 jours  → API forecast (prévision exacte)
 * - > 16 jours  → API climate historique (même mois, année précédente)
 * - Pas de date → météo actuelle
 *
 * Géocodage via Open-Meteo Geocoding API (aussi gratuit).
 */

export interface WeatherData {
  temp: string;
  cond: string;
  humidity: number;
  wind: string;
}

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
}

interface GeoResponse {
  results?: GeoResult[];
}

interface ForecastResponse {
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    windspeed_10m_max?: number[];
    weathercode?: number[];
  };
  hourly?: {
    relativehumidity_2m?: number[];
  };
}

interface ClimateResponse {
  daily?: {
    temperature_2m_mean?: number[];
    precipitation_sum?: number[];
  };
}

/** Convertit un WMO weather code en description lisible */
function wmoToCondition(code: number): string {
  if (code === 0)               return 'Ciel dégagé';
  if (code <= 2)                return 'Partiellement nuageux';
  if (code === 3)               return 'Couvert';
  if (code >= 51 && code <= 55) return 'Bruine';
  if (code >= 61 && code <= 65) return 'Pluie';
  if (code >= 71 && code <= 77) return 'Neige';
  if (code >= 80 && code <= 82) return 'Averses';
  if (code >= 95 && code <= 99) return 'Orages';
  return 'Variable';
}

/** Géocode une ville → coordonnées GPS */
async function geocode(city: string): Promise<GeoResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = (await res.json()) as GeoResponse;
  return data.results?.[0] ?? null;
}

/** Météo de prévision (départ dans ≤ 16 jours) */
async function getForecastWeather(lat: number, lon: number, date: string): Promise<WeatherData | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode&hourly=relativehumidity_2m&timezone=auto&start_date=${date}&end_date=${date}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const data = (await res.json()) as ForecastResponse;

  const maxT = data.daily?.temperature_2m_max?.[0] ?? 20;
  const minT = data.daily?.temperature_2m_min?.[0] ?? 15;
  const avgT = Math.round((maxT + minT) / 2);
  const wind = data.daily?.windspeed_10m_max?.[0] ?? 10;
  const code = data.daily?.weathercode?.[0] ?? 0;
  const hum  = data.hourly?.relativehumidity_2m?.[12] ?? 60;

  return {
    temp:     `${avgT}°C`,
    cond:     wmoToCondition(code),
    humidity: Math.round(hum),
    wind:     `${Math.round(wind)} km/h`,
  };
}

/** Météo climatique (départ dans > 16 jours — même mois, année précédente) */
async function getClimateWeather(lat: number, lon: number, date: string): Promise<WeatherData | null> {
  const d        = new Date(date);
  const lastYear = d.getFullYear() - 1;
  const month    = String(d.getMonth() + 1).padStart(2, '0');
  const startRef = `${lastYear}-${month}-01`;
  const endRef   = `${lastYear}-${month}-${String(new Date(lastYear, d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

  const url = `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lon}&start_date=${startRef}&end_date=${endRef}&daily=temperature_2m_mean,precipitation_sum&models=EC_Earth3P_HR`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = (await res.json()) as ClimateResponse;

  const temps = data.daily?.temperature_2m_mean?.filter((v): v is number => v != null) ?? [];
  const precs = data.daily?.precipitation_sum?.filter((v): v is number => v != null) ?? [];
  if (!temps.length) return null;

  const avgT = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
  const avgP = precs.length ? precs.reduce((a, b) => a + b, 0) / precs.length : 0;
  const cond = avgP > 3 ? 'Pluies fréquentes' : avgP > 1 ? 'Quelques averses' : avgT > 25 ? 'Chaud et ensoleillé' : avgT > 15 ? 'Doux et agréable' : 'Frais';

  return {
    temp:     `${avgT}°C`,
    cond,
    humidity: 65,
    wind:     '15 km/h',
  };
}

/** Météo actuelle (pas de date fournie) */
async function getCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const today = new Date().toISOString().slice(0, 10);
  return getForecastWeather(lat, lon, today);
}

/**
 * Point d'entrée principal.
 * Sélectionne automatiquement forecast / climate / current selon la date de départ.
 */
export async function getRealWeather(city: string, departureDate?: string): Promise<WeatherData | null> {
  try {
    const geo = await geocode(city);
    if (!geo) {
      console.warn(`Weather: géocodage échoué pour "${city}"`);
      return null;
    }

    const { latitude: lat, longitude: lon } = geo;

    if (!departureDate) {
      return await getCurrentWeather(lat, lon);
    }

    const departure = new Date(departureDate);
    if (isNaN(departure.getTime())) {
      return await getCurrentWeather(lat, lon);
    }

    const daysUntil = Math.round((departure.getTime() - Date.now()) / 86400000);

    if (daysUntil <= 0) {
      return await getCurrentWeather(lat, lon);
    } else if (daysUntil <= 16) {
      console.log(`🌤️  Météo forecast J+${daysUntil} pour ${city}`);
      return await getForecastWeather(lat, lon, departureDate.slice(0, 10));
    } else {
      console.log(`🌡️  Météo climatique (J+${daysUntil}) pour ${city}`);
      return await getClimateWeather(lat, lon, departureDate.slice(0, 10));
    }
  } catch (err) {
    console.error('Weather error:', (err as Error).message);
    return null;
  }
}
