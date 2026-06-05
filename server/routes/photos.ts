// =============================================
// TRIPGENIE — server/routes/photos.ts
// Proxy Unsplash côté serveur — la clé ne sort jamais côté client
// =============================================

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getDestinationPhoto } from '../services/photo.js';

const router = express.Router();

// ---- GET /api/photos/:city ----
router.get('/:city', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityParam = req.params.city;
    if (typeof cityParam !== 'string' || !cityParam.trim()) {
      res.status(400).json({ error: 'city requis' });
      return;
    }

    const url = await getDestinationPhoto(cityParam.trim());
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

export default router;
