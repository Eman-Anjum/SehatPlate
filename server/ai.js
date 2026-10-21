// Sole Groq caller. Uses Node's built-in fetch (no SDK). Never logs keys or image data.
import { z } from 'zod';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TIMEOUT_MS = 30_000;
const RATE_LIMIT_WAIT_MS = 2_000;

export class AIError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.detail = message;
  }
}

const PROMPT =
  'You identify Pakistani dishes (for example biryani, nihari, haleem, daal chawal, chai). ' +
  'Reply with JSON only, no other text: {"dish_guess": string, "confidence": number between 0 and 1}. ' +
  'Use a low confidence if you are unsure.';

const resultSchema = z.object({
  dish_guess: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
});

const UNUSABLE = 'The AI returned an unusable answer. Please try again.';

// Find balanced {...} substrings, in order of appearance.
function* jsonCandidates(text) {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        yield text.slice(start, i + 1);
        break;
      }
    }
  }
}

export function parseIdentifyResponse(text) {
  if (typeof text !== 'string' || !text.trim()) throw new AIError(502, UNUSABLE);
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/```(?:json)?/gi, ' ');
  for (const candidate of jsonCandidates(cleaned)) {
    let value;
    try {
      value = JSON.parse(candidate);
    } catch {
      continue;
    }
    const parsed = resultSchema.safeParse(value);
    if (parsed.success) {
      return { dish_guess: parsed.data.dish_guess, confidence: parsed.data.confidence };
    }
  }
  throw new AIError(502, UNUSABLE);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildRequest({ imageBuffer, mimeType, name }) {
  const hasImage = imageBuffer && imageBuffer.length > 0;
  const hasName = typeof name === 'string' && name.trim().length > 0;
  if (!hasImage && !hasName) throw new AIError(400, 'Please provide a photo or a dish name.');

  const apiKey = process.env.GROQ_API_KEY;
  const model = hasImage ? process.env.GROQ_VISION_MODEL : process.env.GROQ_TEXT_MODEL;
  if (!apiKey || !model) {
    throw new AIError(503, 'The AI service is not configured right now. Please try again later.');
  }

  let userContent;
  if (hasImage) {
    const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${Buffer.from(imageBuffer).toString('base64')}`;
    userContent = [
      { type: 'text', text: 'What dish is in this photo?' },
      { type: 'image_url', image_url: { url: dataUrl } },
    ];
  } else {
    userContent = `Dish name typed by the user: ${name.trim()}`;
  }

  const body = JSON.stringify({
    model,
    temperature: 0,
    max_tokens: 300,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user', content: userContent },
    ],
  });
  return { apiKey, body };
}

async function fetchOnce({ apiKey, body }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new AIError(504, 'The AI took too long to answer. Please try again.');
    }
    throw new AIError(502, 'Could not reach the AI service. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

// One Groq call (with a single 429 retry). Returns the model's text.
async function callGroq(request) {
  let res = await fetchOnce(request);
  if (res.status === 429) {
    await sleep(RATE_LIMIT_WAIT_MS);
    res = await fetchOnce(request);
    if (res.status === 429) {
      throw new AIError(429, 'The AI service is busy. Please try again in a moment.');
    }
  }
  if (!res.ok) throw new AIError(502, 'The AI service had a problem. Please try again.');
  let data;
  try {
    data = await res.json();
  } catch {
    throw new AIError(502, UNUSABLE);
  }
  return data?.choices?.[0]?.message?.content ?? '';
}

export async function identifyDish({ imageBuffer, mimeType, name } = {}) {
  const request = buildRequest({ imageBuffer, mimeType, name });
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callGroq(request);
    try {
      return parseIdentifyResponse(text);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
