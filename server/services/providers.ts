/**
 * @fileoverview Adaptateurs vers les différents providers IA.
 * Chaque fonction prend (systemPrompt, userPrompt) et retourne le texte brut de la réponse.
 */

import 'dotenv/config';

const CLE_ANTHROPIC  = process.env.ANTHROPIC_API_KEY?.trim() ?? null;
const CLE_OPENROUTER = process.env.OPENROUTER_API_KEY?.trim() ?? null;
const TIMEOUT_IA_MS  = 45_000;

interface OptionsFetch extends RequestInit {
  signal?: AbortSignal;
}

function fetchAvecTimeout(url: string, options: OptionsFetch, timeoutMs = TIMEOUT_IA_MS): Promise<Response> {
  const controleurAbort = new AbortController();
  const minuterie = setTimeout(() => controleurAbort.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controleurAbort.signal }).finally(() => clearTimeout(minuterie));
}

interface ReponseAnthropic {
  content: Array<{ text: string }>;
  error?: { message: string };
}

export async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetchAvecTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         CLE_ANTHROPIC ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
  });
  const data = (await res.json()) as ReponseAnthropic;
  if (!res.ok) throw new Error(`Claude error: ${JSON.stringify(data.error)}`);
  return data.content[0].text;
}

const MODELES_GRATUITS = [
  'openai/gpt-oss-20b:free',
  'google/gemma-3-27b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-3-12b-it:free',
  'microsoft/phi-3-medium-128k-instruct:free',
  'qwen/qwen-2-7b-instruct:free',
  // 'nvidia/nemotron-nano-9b-v2:free',   ❌ trop petit — tronque le JSON à ~338 chars
  // 'google/gemma-3-4b-it:free',          ❌ trop petit
  // 'meta-llama/llama-3.2-3b-instruct:free', ❌ trop petit
  // 'liquid/lfm-2.5-1.2b-instruct:free', ❌ trop petit
  // 'z-ai/glm-4.5-air:free',             ❌ limite ~1240 chars output
];

interface ReponseOpenRouter {
  choices: Array<{ message: { content: string } }>;
  error?: { code?: number; message?: string };
}

export async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
  for (const model of MODELES_GRATUITS) {
    try {
      const res = await fetchAvecTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${CLE_OPENROUTER}`,
          'HTTP-Referer':  'http://localhost:3001',
          'X-Title':       'TripGenie',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          messages: [
            { role: 'system', content: systemPrompt + '\n\nCRITICAL: REPONDS UNIQUEMENT EN JSON VALIDE.' },
            { role: 'user',   content: userPrompt },
          ],
        }),
      });
      const data = (await res.json()) as ReponseOpenRouter;
      if (!res.ok || data.error?.code === 429) {
        console.warn(`Model ${model} unavailable, trying next...`);
        continue;
      }
      console.log(`✅ Using model: ${model}`);
      return data.choices[0].message.content;
    } catch (err) {
      console.warn(`Model ${model} failed: ${(err as Error).message}`);
      continue;
    }
  }
  throw new Error('QUOTA_EXCEEDED: Tous les modèles gratuits sont épuisés.');
}

interface ReponseGemini {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  error?: { message: string };
}

export async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetchAvecTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
      }),
    }
  );
  const data = (await res.json()) as ReponseGemini;
  if (res.status === 429) throw new Error('QUOTA_EXCEEDED: Limite gratuite Gemini atteinte.');
  if (!res.ok) throw new Error(`Gemini error: ${JSON.stringify(data.error)}`);
  return data.candidates[0].content.parts[0].text;
}

interface ReponseOllama {
  message: { content: string };
}

export async function callOllama(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetchAvecTimeout(
    `${process.env.OLLAMA_BASE_URL}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    process.env.OLLAMA_MODEL ?? 'gemma2:9b',
        stream:   false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
    },
    60_000
  );
  const data = (await res.json()) as ReponseOllama;
  if (!res.ok) throw new Error(`Ollama error: ${JSON.stringify(data)}`);
  return data.message.content;
}
