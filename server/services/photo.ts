/**
 * @fileoverview Photo HD de la destination — pipeline 3 niveaux.
 *
 * 1. Wikipedia REST API (sans clé, fonctionne pour toute ville du monde)
 *    → originalimage de l'article Wikipedia de la destination
 * 2. Unsplash API (si UNSPLASH_ACCESS_KEY valide)
 * 3. Pexels API (si PEXELS_API_KEY valide)
 *
 * Aucune liste hardcodée — ça marche pour Hvar, Katmandou, N'Djamena ou Ibiza.
 */

const DEFAULT_PHOTO =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80';

interface UnsplashSearchResponse {
  results: Array<{ urls: { regular: string } }>;
}

interface PexelsResponse {
  photos: Array<{ src: { large2x: string } }>;
}

export async function getDestinationPhoto(query: string): Promise<string> {
  // 1️⃣ — Unsplash API (photos de voyage curatées, haute qualité)
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (unsplashKey) {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' landscape destination')}&per_page=3&orientation=landscape`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${unsplashKey}` },
        signal:  AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as UnsplashSearchResponse;
        const photo = data.results?.[0]?.urls?.regular;
        if (photo) {
          console.log(`📸 Unsplash OK: ${query}`);
          return photo;
        }
      } else {
        console.warn(`Unsplash ${res.status} for "${query}" — fallback Wikipedia`);
      }
    } catch (err) {
      console.warn(`Unsplash timeout for "${query}":`, (err as Error).message);
    }
  }

  // 2️⃣ — Pexels API (si clé valide)
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  if (pexelsKey) {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + ' travel')}&per_page=1&orientation=landscape`;
      const res = await fetch(url, {
        headers: { Authorization: pexelsKey },
        signal:  AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as PexelsResponse;
        const photo = data.photos?.[0]?.src?.large2x;
        if (photo) {
          console.log(`📸 Pexels OK: ${query}`);
          return photo;
        }
      }
    } catch (err) {
      console.warn(`Pexels error for "${query}":`, (err as Error).message);
    }
  }

  // 3️⃣ — Fallback générique
  console.warn(`📸 Fallback générique pour "${query}"`);
  return DEFAULT_PHOTO;
}
