import type { ActivityLinks } from './types.js';

// ?? '' évite undefined si str est null/undefined
export function encoderURL(str: string): string {
  return encodeURIComponent(str?.trim() ?? '');
}

export function liensRestaurant(name: string, city: string, lienAnnuaireLocal: string): ActivityLinks {
  return {
    viator:       `https://www.thefork.fr/recherche?q=${encoderURL(name + ' ' + city)}`,
    getyourguide: `https://www.google.com/search?q=${encoderURL(name + ' ' + city + ' réservation')}`,
    airbnb:       lienAnnuaireLocal,
  };
}
