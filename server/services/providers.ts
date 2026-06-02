/**
 * @fileoverview Adaptateurs vers les différents providers IA.
 * Chaque fonction prend (systemPrompt, userPrompt) et retourne le texte brut de la réponse.
 */

import 'dotenv/config';

const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY?.trim() ?? null;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY?.trim() ?? null;
const AI_TIMEOUT_MS  = 45_000;

interface FetchOptions extends RequestInit {
  signal?: AbortSignal;
}

function fetchWithTimeout(url: string, options: FetchOptions, timeoutMs = AI_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

interface AnthropicResponse {
  content: Array<{ text: string }>;
  error?: { message: string };
}

export async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
  });
  const data = (await res.json()) as AnthropicResponse;
  if (!res.ok) throw new Error(`Claude error: ${JSON.stringify(data.error)}`);
  return data.content[0].text;
}

const FREE_MODELS = [
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

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
  error?: { code?: number; message?: string };
}

export async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
  for (const model of FREE_MODELS) {
    try {
      const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
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
      const data = (await res.json()) as OpenRouterResponse;
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

interface GeminiResponse {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  error?: { message: string };
}

export async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetchWithTimeout(
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
  const data = (await res.json()) as GeminiResponse;
  if (res.status === 429) throw new Error('QUOTA_EXCEEDED: Limite gratuite Gemini atteinte.');
  if (!res.ok) throw new Error(`Gemini error: ${JSON.stringify(data.error)}`);
  return data.candidates[0].content.parts[0].text;
}

interface OllamaResponse {
  message: { content: string };
}

export async function callOllama(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetchWithTimeout(
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
  const data = (await res.json()) as OllamaResponse;
  if (!res.ok) throw new Error(`Ollama error: ${JSON.stringify(data)}`);
  return data.message.content;
}
