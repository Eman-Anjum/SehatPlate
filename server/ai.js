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

// In-memory cache for generated questions per dish+condition
const questionCache = new Map();

const questionSchema = z.array(z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1),
  options: z.array(z.object({ id: z.string().trim().min(1), label: z.string().trim().min(1) })).min(1),
})).min(1).max(10);

// generateQuestions: asks Groq for 3-4 short follow-up questions for a dish and condition
export async function generateQuestions(dish, condition) {
  const key = `${dish.trim().toLowerCase()}::${condition}`;
  if (questionCache.has(key)) return questionCache.get(key);

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_TEXT_MODEL;
  if (!apiKey || !model) {
    throw new AIError(503, 'The AI service is not configured right now.');
  }

  const prompt = `You are a short questionnaire generator. For the Pakistani dish named "${dish}" and the health condition "${condition}", produce 3 short follow-up questions in JSON array form. Each question must have id, text, and options (each option has id and label). Keep questions concise and relevant (portion size, oil, potatoes, salt etc). Reply with JSON only.`;
  const body = JSON.stringify({ model, temperature: 0, max_tokens: 300, messages: [ { role: 'system', content: 'Generate short questionnaire' }, { role: 'user', content: prompt } ] });
  const request = { apiKey, body };

  let lastErr;
  for (let attempt=0; attempt<2; attempt++) {
    let text;
    try {
      text = await callGroq(request);
    } catch (err) {
      lastErr = err;
      continue;
    }
    // defensive: strip code fences and try to parse JSON arrays
    const cleaned = String(text).replace(/<think>[\s\S]*?<\/think>/gi,' ').replace(/```(?:json)?/gi,' ');
    try {
      const parsed = JSON.parse(cleaned);
      const validated = questionSchema.parse(parsed);
      questionCache.set(key, validated);
      return validated;
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  throw lastErr || new AIError(502, 'Failed to generate questions');
}

// --- Verdict proposal (POST /verdict) --------------------------------------
// Reuses callGroq (single call, one 429 retry inside) and the defensive
// jsonCandidates parser. Never logs keys or prompts.

const proposalSchema = z.object({
  verdict: z.enum(['Safe', 'Moderation', 'Avoid']),
  reason: z.string().trim().min(1).max(600),
  swaps: z.array(z.string().trim().min(1).max(120)).min(2).max(4),
});

const VERDICT_PROMPT =
  'You are a cautious nutrition guide for Pakistani dishes. ' +
  'Reply with JSON only, no other text: {"verdict": "Safe" | "Moderation" | "Avoid", "reason": string, "swaps": [string, ...]}. ' +
  'Be conservative: when unsure, choose the stricter verdict. ' +
  'The reason must be at most 2 short, simple sentences. ' +
  'Give 2 to 4 short practical swaps. ' +
  'Never give medication, dosage or diagnosis advice. No citations.';

export function parseVerdictProposal(text) {
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
    const parsed = proposalSchema.safeParse(value);
    if (parsed.success) return parsed.data;
  }
  throw new AIError(502, UNUSABLE);
}

// One Groq call to the text model asking for the JSON verdict proposal.
export async function proposeVerdict({ dish, condition, answersText = '', principle = '', dishRulesText = '' } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_TEXT_MODEL;
  if (!apiKey || !model) {
    throw new AIError(503, 'The AI service is not configured right now.');
  }

  const userPrompt = [
    `Dish: ${dish}`,
    `Health condition: ${condition}`,
    principle ? `General principle for this condition: ${principle}` : null,
    dishRulesText ? `Curated rules for this dish and condition: ${dishRulesText}` : null,
    answersText ? `User answers:\n${answersText}` : 'User answers: none provided.',
    'Now reply with the JSON verdict only.',
  ]
    .filter(Boolean)
    .join('\n');

  const body = JSON.stringify({
    model,
    temperature: 0.2,
    max_tokens: 300,
    messages: [
      { role: 'system', content: VERDICT_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = await callGroq({ apiKey, body });
  return parseVerdictProposal(text);
}
