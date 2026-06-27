// =============================================
// TRIPGENIE — server/middleware/auth.ts
// Vérification du token JWT sur les routes protégées
// =============================================

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from '../lib/types.js';

// Augmentation de l'interface Express Request pour inclure req.user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Extrait le token JWT depuis la requête.
 *
 * Deux sources sont supportées par ordre de priorité :
 * 1. Cookie httpOnly `tg_token` — méthode principale en production.
 *    Le cookie httpOnly est inaccessible depuis le JavaScript navigateur,
 *    ce qui le rend immunisé aux attaques XSS (Cross-Site Scripting).
 * 2. Header `Authorization: Bearer <token>` — fallback pour les tests
 *    Supertest et les clients API qui n'envoient pas de cookies.
 *
 * @param req - Requête Express entrante
 * @returns   Token JWT brut, ou null si absent
 */
const NOM_COOKIE_AUTH = 'tg_token';

function extraireToken(req: Request): string | null {
  if (req.cookies?.[NOM_COOKIE_AUTH]) return req.cookies[NOM_COOKIE_AUTH] as string;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return null;
}

/**
 * Middleware de protection des routes : bloque les requêtes non authentifiées.
 *
 * Vérifie et décode le token JWT. En cas de succès, attache l'objet
 * utilisateur décodé à `req.user` (disponible pour toutes les routes suivantes).
 * Le type de `req.user` est déclaré globalement via declaration merging Express.
 *
 * @throws 401 si token absent, expiré ou invalide
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extraireToken(req);
  if (!token) {
    res.status(401).json({ error: 'Token manquant ou invalide' });
    return;
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    next();
  } catch (err) {
    if ((err as Error).name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Session expirée, reconnecte-toi' });
      return;
    }
    res.status(401).json({ error: 'Token invalide' });
  }
}

/**
 * Middleware d'authentification optionnel : ne bloque jamais la requête.
 *
 * Si un token valide est présent, `req.user` est renseigné (route semi-protégée).
 * Si le token est absent ou invalide, la requête continue avec `req.user = undefined`.
 *
 * Utilisé sur les routes IA (/generate, /chat) pour sauvegarder le pack
 * en base si l'utilisateur est connecté, sans obliger la connexion.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extraireToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    } catch (_) {
      // Silently ignore invalid token
    }
  }
  next();
}
