// =============================================
// TRIPGENIE — server/routes/auth.ts
// Inscription, Connexion et Déconnexion avec JWT
// =============================================

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../db/prisma.js';
import { authLimiter } from '../middleware/limiter.js';

// Schemas de validation
const registerSchema = z.object({
  email:    z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court (6 min)'),
  name:     z.string().min(2, 'Nom trop court').optional()
});

const loginSchema = z.object({
  email:    z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis')
});

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,                                // inaccessible au JS du navigateur → protège du vol de token par XSS
  secure: process.env.NODE_ENV === 'production', // cookie envoyé uniquement en HTTPS en prod (http://localhost autorisé en dev)
  sameSite: 'strict' as const,                   // anti-CSRF maximal : le cookie n'est jamais envoyé par un autre site.
                                                 // Possible ici car le front React et l'API Express sont servis par le MÊME serveur (même origine).
  maxAge: 7 * 24 * 60 * 60 * 1000                // 7 jours
};

// ---- POST /api/auth/signup ----
router.post('/signup', authLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { email, password, name } = parsed.data;

    // 1. Email déjà pris ?
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      res.status(409).json({ error: 'Cet email est déjà utilisé' });
      return;
    }

    // 2. Hasher le mot de passe (le hash bcrypt est calculé ICI, côté serveur)
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 3. Insérer l'utilisateur (select explicite → le hash n'est jamais renvoyé)
    const user = await prisma.user.create({
      data:   { email, password: password_hash, name: name ?? null },
      select: { id: true, email: true, name: true, avatar_url: true, created_at: true },
    });

    // 4. Générer le JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    // 5. Envoyer le cookie httpOnly (le token n'est jamais renvoyé dans le body :
    //    le front s'appuie uniquement sur le cookie, inaccessible au JS)
    res.cookie('tg_token', token, COOKIE_OPTIONS);

    res.status(201).json({ user });

  } catch (err) {
    console.error('Register Error:', err);
    next(err);
  }
});

// ---- POST /api/auth/login ----
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { email, password } = parsed.data;

    // 1. Chercher l'utilisateur (avec son hash, nécessaire pour bcrypt.compare).
    //    Même message d'erreur pour email inconnu ET mauvais mot de passe (anti-énumération).
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }

    // 2. Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }

    // 3. Générer le token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    // 4. Cookie httpOnly uniquement — le token n'est pas exposé dans le body
    res.cookie('tg_token', token, COOKIE_OPTIONS);

    // On enlève le hash de la réponse
    const { password: _pw, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });

  } catch (err) {
    console.error('Login Error:', err);
    next(err);
  }
});

// ---- POST /api/auth/logout ----
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('tg_token', { ...COOKIE_OPTIONS, maxAge: 0 });
  res.json({ message: 'Déconnecté avec succès' });
});

// ---- GET /api/auth/me ----
router.get('/me', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.tg_token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload;

    // Lecture de SON PROPRE profil : l'id vient du JWT déjà vérifié.
    const user = await prisma.user.findUnique({
      where:  { id: decoded.id as string },
      select: { id: true, email: true, name: true, avatar_url: true, created_at: true },
    });
    if (!user) {
      res.status(401).json({ error: 'Utilisateur introuvable' });
      return;
    }

    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

export default router;
