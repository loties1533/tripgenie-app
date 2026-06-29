/**
 * @fileoverview Clés API des providers IA, lues une seule fois depuis l'environnement
 * et partagées par les services (providers.ts, claude/core.ts…).
 */

import 'dotenv/config';

export const CLE_ANTHROPIC  = process.env.ANTHROPIC_API_KEY?.trim() ?? null;
export const CLE_OPENROUTER = process.env.OPENROUTER_API_KEY?.trim() ?? null;
