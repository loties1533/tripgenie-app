// =============================================
// TRIPGENIE — server/routes/collaborators.ts  (Prisma)
// Collaborateurs de voyage (relation many-to-many trips ↔ users)
// =============================================

import express from 'express';
import { z } from 'zod';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import type { Request, Response, NextFunction } from 'express';

const router = express.Router();

const inviteSchema = z.object({
  email: z.string().email('email invalide'),
  role:  z.enum(['viewer', 'editor']).default('viewer')
});

const tripParamSchema = z.object({
  trip_id: z.string().min(1, 'trip_id requis'),
});

const tripCollaboratorParamSchema = z.object({
  trip_id: z.string().min(1, 'trip_id requis'),
  user_id: z.string().min(1, 'user_id requis'),
});

// ---- GET /api/trips/:trip_id/collaborators ----
router.get('/:trip_id/collaborators', requireAuth, validateParams(tripParamSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const tripId = String(req.params.trip_id);

    // 1. Propriété du voyage (404 si pas à l'utilisateur)
    const owned = await prisma.trip.findFirst({ where: { id: tripId, user_id: userId }, select: { id: true } });
    if (!owned) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }

    // 2. Collaborateurs + infos user (name/email) via la relation — JOIN propre.
    const rows = await prisma.tripCollaborator.findMany({
      where:   { trip_id: tripId },
      select:  { user_id: true, role: true, invited_at: true, user: { select: { name: true, email: true } } },
      orderBy: { invited_at: 'asc' },
    });

    const collaborators = rows.map((r) => ({
      user_id:    r.user_id,
      role:       r.role,
      invited_at: r.invited_at,
      users:      { name: r.user.name, email: r.user.email },
    }));

    res.json({ collaborators });

  } catch (err) {
    next(err);
  }
});

// ---- POST /api/trips/:trip_id/collaborators ----
router.post('/:trip_id/collaborators', requireAuth, validateParams(tripParamSchema), validateBody(inviteSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const tripId = String(req.params.trip_id);
    const parsed = req.body;

    // 1. Propriété du voyage
    const owned = await prisma.trip.findFirst({ where: { id: tripId, user_id: userId }, select: { id: true } });
    if (!owned) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }

    // 2. Trouver la cible par email (on ne lit PAS le hash)
    const targetUser = await prisma.user.findUnique({
      where:  { email: parsed.email },
      select: { id: true, name: true, email: true },
    });
    if (!targetUser) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    if (targetUser.id === userId) {
      res.status(400).json({ error: 'Impossible de s\'inviter soi-même' });
      return;
    }

    // 3. Upsert collaborateur (PK composée trip_id + user_id)
    const collaborator = await prisma.tripCollaborator.upsert({
      where:  { trip_id_user_id: { trip_id: tripId, user_id: targetUser.id } },
      create: { trip_id: tripId, user_id: targetUser.id, role: parsed.role },
      update: { role: parsed.role, invited_at: new Date() },
    });

    res.status(201).json({ collaborator, user: { name: targetUser.name, email: targetUser.email } });

  } catch (err) {
    next(err);
  }
});

// ---- DELETE /api/trips/:trip_id/collaborators/:user_id ----
router.delete('/:trip_id/collaborators/:user_id', requireAuth, validateParams(tripCollaboratorParamSchema), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const tripId = String(req.params.trip_id);

    // Propriété (404 si non possédé)
    const owned = await prisma.trip.findFirst({ where: { id: tripId, user_id: userId }, select: { id: true } });
    if (!owned) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }

    await prisma.tripCollaborator.deleteMany({
      where: { trip_id: tripId, user_id: String(req.params.user_id) },
    });

    res.status(200).json({ message: 'Collaborateur retiré' });

  } catch (err) {
    next(err);
  }
});

export default router;
