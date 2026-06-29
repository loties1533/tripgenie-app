/**
 * @fileoverview Helpers d'URL partagés par les services (vols, hôtels, activités…).
 */

import type { ActivityLinks } from './types.js';

/** Encode une chaîne pour l'insérer dans une URL (trim + encodeURIComponent, jamais undefined). */
export function encoderURL(str: string): string {
  return encodeURIComponent(str?.trim() ?? '');
}

/**
 * Liens de réservation pour un restaurant. Les deux premiers liens (TheFork, recherche
 * Google) sont communs ; `lienAnnuaireLocal` est l'annuaire propre à la source (Foursquare,
 * Yelp…) et est passé par l'appelant.
 */
export function liensRestaurant(name: string, city: string, lienAnnuaireLocal: string): ActivityLinks {
  return {
    viator:       `https://www.thefork.fr/recherche?q=${encoderURL(name + ' ' + city)}`,
    getyourguide: `https://www.google.com/search?q=${encoderURL(name + ' ' + city + ' réservation')}`,
    airbnb:       lienAnnuaireLocal,
  };
}
