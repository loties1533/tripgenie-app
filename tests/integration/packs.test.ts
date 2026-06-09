// =============================================
// TRIPGENIE — tests/integration/packs.test.ts
// Route packs (relation 1-N : un voyage → plusieurs packs classés) :
//   - auth requise (401 sans token)
//   - propriété du voyage vérifiée (403 sinon)
//   - GET    : liste les packs d'un voyage, triés par rang
//   - POST   : sélectionne un pack (désélectionne les autres + confirme le trip)
// La table packs est peuplée par le pipeline de génération → route réellement utile.
// =============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server/index.js';

process.env.JWT_SECRET = 'test-secret-for-vitest';

vi.mock('express-rate-limit', () => ({
  default:   () => (_: any, __: any, next: any) => next(),
  rateLimit: () => (_: any, __: any, next: any) => next()
}));
vi.mock('../../server/middleware/limiter.js', () => {
  const p = (_: any, __: any, n: any) => n();
  return { aiGenerateLimiter: p, aiChatLimiter: p, authLimiter: p };
});

// Mock Prisma : GET → trip.findFirst (propriété) + pack.findMany.
// POST select → $transaction (propriété → existence → désélection → sélection → MAJ trip).
// $transaction exécute son callback contre le mock lui-même (tx = prismaMock).
const { prismaMock } = vi.hoisted(() => {
  const prismaMock: any = {
    trip: { findFirst: vi.fn(), updateMany: vi.fn() },
    pack: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (fn: any) => fn(prismaMock));
  return { prismaMock };
});
vi.mock('../../server/db/prisma.js', () => ({ default: prismaMock }));

const OWNER = { id: 'owner-uuid', email: 'owner@test.com', name: 'Owner' };
const token = jwt.sign(OWNER, process.env.JWT_SECRET!, { expiresIn: '1d' });
const auth  = (r: any) => r.set('Authorization', `Bearer ${token}`);
const TRIP  = 'trip-123';
const PACK  = 'pack-456';

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction garde son implémentation (tx = prismaMock) ; défaut fail-closed.
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
  prismaMock.trip.findFirst.mockResolvedValue(null);
});

// ============================================================
// GET /api/packs/:trip_id
// ============================================================
describe('GET /api/packs/:trip_id', () => {

  it('401 sans token', async () => {
    const res = await request(app).get(`/api/packs/${TRIP}`);
    expect(res.status).toBe(401);
  });

  it('403 si le voyage n\'appartient pas à l\'utilisateur', async () => {
    prismaMock.trip.findFirst.mockResolvedValueOnce(null); // propriété : null → 403
    const res = await auth(request(app).get(`/api/packs/${TRIP}`));
    expect(res.status).toBe(403);
  });

  it('liste les packs du voyage triés par rang', async () => {
    prismaMock.trip.findFirst.mockResolvedValueOnce({ id: TRIP } as any);     // 1) propriété OK
    prismaMock.pack.findMany.mockResolvedValueOnce([                          // 2) packs triés
      { id: 'p1', rank: 1, selected: true },
      { id: 'p2', rank: 2, selected: false },
    ] as any);
    const res = await auth(request(app).get(`/api/packs/${TRIP}`));
    expect(res.status).toBe(200);
    expect(res.body.packs).toHaveLength(2);
    expect(res.body.packs[0].rank).toBe(1);
  });
});

// ============================================================
// POST /api/packs/:trip_id/select/:pack_id
// ============================================================
describe('POST /api/packs/:trip_id/select/:pack_id', () => {

  it('401 sans token', async () => {
    const res = await request(app).post(`/api/packs/${TRIP}/select/${PACK}`);
    expect(res.status).toBe(401);
  });

  it('403 si le voyage n\'appartient pas à l\'utilisateur', async () => {
    prismaMock.trip.findFirst.mockResolvedValueOnce(null); // propriété : null → 403
    const res = await auth(request(app).post(`/api/packs/${TRIP}/select/${PACK}`));
    expect(res.status).toBe(403);
  });

  it('sélectionne le pack choisi et renvoie le pack', async () => {
    // Transaction atomique : propriété → existence pack → désélection → sélection → MAJ trip
    prismaMock.trip.findFirst.mockResolvedValueOnce({ id: TRIP } as any);                  // 1) propriété OK
    prismaMock.pack.findFirst.mockResolvedValueOnce({ id: PACK } as any);                  // 2) pack existe
    prismaMock.pack.updateMany.mockResolvedValueOnce({ count: 2 } as any);                 // 3) désélection
    prismaMock.pack.update.mockResolvedValueOnce({ id: PACK, selected: true } as any);     // 4) sélection
    prismaMock.trip.updateMany.mockResolvedValueOnce({ count: 1 } as any);                 // 5) MAJ trip
    const res = await auth(request(app).post(`/api/packs/${TRIP}/select/${PACK}`));
    expect(res.status).toBe(200);
    expect(res.body.pack.id).toBe(PACK);
    expect(res.body.pack.selected).toBe(true);
    expect(prismaMock.pack.update).toHaveBeenCalled();
  });
});
