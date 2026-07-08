// TRIPGENIE — server/lib/tripAccess.ts
// Autorisation d'édition d'un voyage. Deux niveaux de droits :
//   • propriétaire (trip.user_id) : accès complet (modifier + supprimer) ;
//   • collaborateur « editor »    : peut modifier le voyage (pas le supprimer) ;
//   • collaborateur « viewer »    : lecture seule.
// La suppression du voyage reste réservée au propriétaire (voir routes/trips.ts).

import prisma from '../db/prisma.js';

export type AccesEdition = 'owner' | 'editor' | 'forbidden' | 'not_found';

/**
 * Évalue le droit de MODIFIER le voyage `tripId` pour `userId`.
 * Distingue « voyage inexistant » (404) de « connu mais sans droit » (403).
 */
export async function evaluerAccesEdition(userId: string, tripId: string): Promise<AccesEdition> {
  const voyage = await prisma.trip.findUnique({
    where:  { id: tripId },
    select: { user_id: true },
  });
  if (!voyage) return 'not_found';
  if (voyage.user_id === userId) return 'owner';

  const collaboration = await prisma.tripCollaborator.findUnique({
    where:  { trip_id_user_id: { trip_id: tripId, user_id: userId } },
    select: { role: true },
  });
  return collaboration?.role === 'editor' ? 'editor' : 'forbidden';
}

/** Raccourci booléen : le voyage existe et l'utilisateur a le droit de le modifier. */
export async function peutEditerVoyage(userId: string, tripId: string): Promise<boolean> {
  const acces = await evaluerAccesEdition(userId, tripId);
  return acces === 'owner' || acces === 'editor';
}
