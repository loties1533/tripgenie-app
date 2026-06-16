// =============================================
// TRIPGENIE — server/routes/packs.ts  (Prisma)
// GET  /api/packs/:trip_id     → packs d'un voyage
// POST /api/packs/:trip_id/select/:pack_id → choisir un pack
// =============================================

import express from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import prisma from '../db/prisma.js';
import type { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { validateParams } from '../middleware/validation.js';

const router = express.Router();
router.use(requireAuth);

const packParamsSchema = z.object({
  trip_id: z.string().min(1, 'trip_id requis'),
  pack_id: z.string().min(1, 'pack_id requis').optional(),
});

router.get('/:trip_id', validateParams(packParamsSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const userId = req.user.id;

    // Vérif propriété AVANT de lire les packs (isolation par user_id)
    const owned = await prisma.trip.findFirst({
      where:  { id: String(req.params.trip_id), user_id: userId },
      select: { id: true },
    });
    if (!owned) {
      res.status(403).json({ error: 'Accès non autorisé' });
      return;
    }

    const packs = await prisma.pack.findMany({
      where:   { trip_id: String(req.params.trip_id) },
      orderBy: { rank: 'asc' },
    });

    res.json({ packs });
  } catch (err) {
    console.error('GET packs error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:trip_id/select/:pack_id', validateParams(packParamsSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const userId = req.user.id;

    // Tout dans UNE transaction atomique : propriété → existence pack → bascule
    // selected → MAJ du trip. Si une étape échoue, ROLLBACK (pas d'état incohérent).
    const outcome = await prisma.$transaction(async (tx): Promise<
      { status: 403 } | { status: 404 } | { status: 200; pack: unknown }
    > => {
      const owned = await tx.trip.findFirst({
        where: { id: String(req.params.trip_id), user_id: userId }, select: { id: true },
      });
      if (!owned) return { status: 403 };

      const exists = await tx.pack.findFirst({
        where: { id: String(req.params.pack_id), trip_id: String(req.params.trip_id) }, select: { id: true },
      });
      if (!exists) return { status: 404 };

      // Désélectionne tous les packs du trip, puis sélectionne le choisi
      await tx.pack.updateMany({ where: { trip_id: String(req.params.trip_id) }, data: { selected: false } });
      const pack = await tx.pack.update({ where: { id: String(req.params.pack_id) }, data: { selected: true } });

      // Met à jour le statut du voyage + snapshot du pack sélectionné
      await tx.trip.updateMany({
        where: { id: String(req.params.trip_id), user_id: userId },
        data:  { status: 'confirmed', pack_data: pack as unknown as Prisma.InputJsonValue },
      });

      return { status: 200, pack };
    });

    if (outcome.status === 403) { res.status(403).json({ error: 'Accès non autorisé' }); return; }
    if (outcome.status === 404) { res.status(404).json({ error: 'Pack introuvable' });   return; }

    res.json({ pack: outcome.pack, message: 'Pack sélectionné !' });
  } catch (err) {
    console.error('SELECT pack error:', err);
    res.status(500).json({ error: 'Erreur lors de la sélection' });
  }
});

export default router;
