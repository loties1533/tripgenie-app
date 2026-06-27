// =============================================
// TRIPGENIE — server/routes/trips.ts  (Prisma)
// =============================================

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { MODES_LIST, TRIP_STATUS_LIST } from '../lib/constants.js';
import type { TravelMode } from '../lib/types.js';

const schemaCreationVoyage = z.object({
  destination:  z.string().min(1, 'destination requise').max(100),
  mode:         z.enum(MODES_LIST as [TravelMode, ...TravelMode[]], { error: 'mode invalide' }),
  title:        z.string().max(200).optional(),
  country:      z.string().max(100).optional(),
  origin:       z.string().max(100).optional(),
  departure:    z.string().optional(),
  return_date:  z.string().optional(),
  travelers:    z.number().int().min(1).max(50).optional(),
  budget:       z.union([z.string(), z.number()]).optional(),
  pack_data:    z.any().optional(),
  score:        z.number().optional()
});

const schemaMiseAJourVoyage = z.object({
  title:     z.string().max(200).optional(),
  status:    z.enum(TRIP_STATUS_LIST as [string, ...string[]]).optional(),
  pack_data: z.any().optional(),
  score:     z.number().optional(),
  travelers: z.number().int().min(1).max(50).optional(),
  budget:    z.union([z.string(), z.number()]).optional()
});

const router = express.Router();

// Parse une date "YYYY-MM-DD" en Date (colonne @db.Date) ou null
const convertirEnDate = (s?: string | null): Date | null => (s ? new Date(s) : null);

// ---- GET /api/trips/share/:id (Public) ----
router.get('/share/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Lecture PUBLIQUE : on sélectionne EXPLICITEMENT les champs partageables.
    // Aucune donnée utilisateur n'est exposée (ni user_id, ni email, ni hash) —
    // le select agit comme un périmètre de sécurité minimal.
    const trip = await prisma.trip.findUnique({
      where:  { id: String(req.params.id) },
      select: {
        id: true, title: true, destination: true, country: true,
        pack_data: true, score: true, mode: true,
        departure: true, return_date: true, travelers: true, budget: true,
        packs: { select: { id: true, rank: true, selected: true } },
      },
    });

    if (!trip) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }

    // Le pack sélectionné (ou rang 1) sert de cible pour les votes consensus
    const packs = trip.packs ?? [];
    const targetPack = packs.find((p) => p.selected) ?? [...packs].sort((a, b) => a.rank - b.rank)[0] ?? null;
    const { packs: _packs, ...tripData } = trip;

    res.json({ trip: { ...tripData, pack_id: targetPack?.id ?? null } });
  } catch (err) {
    console.error('Public share error:', err);
    next(err);
  }
});

router.use(requireAuth);

// ---- GET /api/trips ----
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const userId = req.user.id;

    const { mode, status } = req.query;
    const limit  = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 50);
    const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);

    // Isolation des données : filtre applicatif user_id systématique.
    const listeVoyages = await prisma.trip.findMany({
      where: {
        user_id: userId,
        ...(typeof mode === 'string'   ? { mode }   : {}),
        ...(typeof status === 'string' ? { status } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    res.json({ trips: listeVoyages, count: listeVoyages.length, limit, offset });

  } catch (err) {
    console.error('GET trips error:', err);
    next(err);
  }
});

// ---- POST /api/trips ----
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const donneesValidees = schemaCreationVoyage.safeParse(req.body);
    if (!donneesValidees.success) {
      res.status(400).json({ error: donneesValidees.error.issues[0].message });
      return;
    }
    const { title, destination, country, origin, departure, return_date, travelers, budget, mode, pack_data, score } = donneesValidees.data;

    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const userId = req.user.id;

    const trip = await prisma.trip.create({
      data: {
        user_id:     userId,
        title:       title || `Voyage à ${destination}`,
        destination,
        country:     country ?? null,
        origin:      origin ?? null,
        departure:   convertirEnDate(departure),
        return_date: convertirEnDate(return_date),
        travelers:   travelers || 1,
        budget:      budget != null ? String(budget) : null,
        mode,
        status:      'draft',
        pack_data:   pack_data ?? undefined,
        score:       score ?? null,
      },
    });

    res.status(201).json({ trip });

  } catch (err) {
    console.error('POST trip error:', err);
    next(err);
  }
});

// ---- GET /api/trips/:id ----
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const userId = req.user.id;

    // findFirst scopé par id ET user_id → 404 si non possédé (isolation)
    const trip = await prisma.trip.findFirst({
      where:   { id: String(req.params.id), user_id: userId },
      include: { packs: { orderBy: { rank: 'asc' } } },
    });

    if (!trip) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }

    res.json({ trip });

  } catch (err) {
    console.error('GET trip error:', err);
    next(err);
  }
});

// ---- PUT /api/trips/:id ----
router.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const donneesValidees = schemaMiseAJourVoyage.safeParse(req.body);
    if (!donneesValidees.success) {
      res.status(400).json({ error: donneesValidees.error.issues[0].message });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const userId = req.user.id;

    // Allowlist : on ne construit `champsModifies` qu'avec les colonnes fournies et validées.
    const champsModifies: Record<string, unknown> = {};
    if (donneesValidees.data.title     !== undefined) champsModifies.title     = donneesValidees.data.title;
    if (donneesValidees.data.status    !== undefined) champsModifies.status    = donneesValidees.data.status;
    if (donneesValidees.data.pack_data !== undefined) champsModifies.pack_data = donneesValidees.data.pack_data;
    if (donneesValidees.data.score     !== undefined) champsModifies.score     = donneesValidees.data.score;
    if (donneesValidees.data.travelers !== undefined) champsModifies.travelers = donneesValidees.data.travelers;
    if (donneesValidees.data.budget    !== undefined) champsModifies.budget    = donneesValidees.data.budget != null ? String(donneesValidees.data.budget) : null;
    // updated_at est géré automatiquement par @updatedAt

    // updateMany scopé par user_id → impossible de modifier le voyage d'un autre.
    const voyageMisAJour = await prisma.trip.updateMany({
      where: { id: String(req.params.id), user_id: userId },
      data: champsModifies,
    });

    if (voyageMisAJour.count === 0) {
      res.status(404).json({ error: 'Voyage introuvable' });
      return;
    }

    const trip = await prisma.trip.findUnique({ where: { id: String(req.params.id) } });
    res.json({ trip });

  } catch (err) {
    console.error('PUT trip error:', err);
    next(err);
  }
});

// ---- DELETE /api/trips/:id ----
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    const userId = req.user.id;

    // deleteMany scopé par user_id (les packs partent en cascade)
    await prisma.trip.deleteMany({ where: { id: String(req.params.id), user_id: userId } });

    res.json({ message: 'Voyage supprimé' });

  } catch (err) {
    console.error('DELETE trip error:', err);
    next(err);
  }
});

export default router;
