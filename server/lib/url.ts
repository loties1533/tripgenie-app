import type { ActivityLinks } from './types.js';

// ?? '' évite undefined si str est null/undefined
export function encoderURL(str: string): string {
  return encodeURIComponent(str?.trim() ?? '');
}

export function lienGoogleMaps(name: string, city: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encoderURL(name + ' ' + city)}`;
}

export function liensRestaurant(name: string, city: string): ActivityLinks {
  return {
    viator:       `https://www.thefork.fr/recherche?q=${encoderURL(name + ' ' + city)}`,
    getyourguide: `https://www.google.com/search?q=${encoderURL(name + ' ' + city + ' réservation')}`,
  };
}
