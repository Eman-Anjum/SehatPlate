/**
 * server/verdictRoute.js
 * POST /verdict — full implementation (Module 7, Phases 2-5).
 * Zod validation, one Groq proposal, safety override via computeVerdict
 * (stricter-wins, unchanged), per-user rate limit, best-effort persistence.
 * Never logs or returns keys, tokens or full prompts.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { computeVerdict } from './verdict.js';
import { proposeVerdict } from './ai.js';
import { pool } from './db.js';

const require = createRequire(import.meta.url);
const rules = require('./dish_rules.json');

const router = Router();

const ORDER = rules.verdict_order; // ["Safe", "Moderation", "Avoid"]

const bodySchema = z.object({
  dish: z.string().trim().min(1, 'dish is required').max(80, 'dish is too long'),
  dish_id: z.string().trim().min(1).max(80).nullish(),
  condition: z.enum(['diabetes', 'kidney_disease', 'high_blood_pressure']),
  answers: z.record(z.string(), z.string()).default({}),
  confidence: z.number().min(0, 'confidence must be between 0 and 1').max(1, 'confidence must be between 0 and 1'),
});

// Same per-user limiter pattern as /dish: 10 requests/minute.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId),
  handler: (req, res) =>
    res.status(429).json({ detail: 'Too many requests. Please wait a minute and try again.' }),
});

function findDishEntry(name, id) {
  const candidates = [id, name].filter(Boolean).map((s) => String(s).trim().toLowerCase());
  return (
    (rules.dishes || []).find((d) =>
      candidates.some(
        (c) =>
          d.id === c ||
          d.name.toLowerCase() === c ||
          (d.aliases || []).some((a) => a.toLowerCase() === c)
      )
    ) || null
  );
}

// Render answers as "question: label (option_id)" lines, using option labels
// from dish_rules.json where available.
function describeAnswers(entry, condition, answers) {
  const labelMaps = new Map(); // qid -> Map(oid -> label)
  const addQuestions = (qs) => {
    for (const q of qs || []) {
      labelMaps.set(q.id, new Map((q.options || []).map((o) => [o.id, o.label])));
    }
  };
  addQuestions(rules.common_questions);
  if (entry) {
    for (const q of entry.questions || []) {
      if (q.conditions && !q.conditions.includes(condition)) continue;
      addQuestions([q]);
    }
  }
  const lines = [];
  for (const [qid, oid] of Object.entries(answers || {})) {
    const label = labelMaps.get(qid)?.get(oid);
    lines.push(label ? `- ${qid}: ${label} (${oid})` : `- ${qid}: ${oid}`);
  }
  return lines.join('\n');
}

export async function _insertScan(userId, dish, condition, answers, verdict, reason, swaps = []) {
  // Same columns the history route selects so rows are visible.
  const sql = `INSERT INTO scans (user_id, dish, condition, answers, verdict, reason, swaps) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, user_id, dish, condition, answers, verdict, reason, swaps, created_at`;
  const params = [userId, dish, condition, JSON.stringify(answers ?? {}), verdict, reason, JSON.stringify(swaps)];
  return pool.query(sql, params);
}

router.post('/', requireAuth, limiter, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.errors.map((e) => e.message).join(', ') });
  }
  const { dish, dish_id, condition, answers, confidence } = parsed.data;

  // Build the prompt context: principle text + curated rules for listed dishes
  // + answers rendered with option labels where available.
  const entry = findDishEntry(dish, dish_id);
  const principle = rules.principles?.[condition] ?? '';
  const dishRules = entry?.rules?.[condition] ?? null;
  const dishRulesText = dishRules ? JSON.stringify(dishRules) : '';
  const answersText = describeAnswers(entry, condition, answers);

  // One Groq proposal. Any failure or invalid output is NOT an error:
  // pass "no proposal" so computeVerdict falls back to the rules.
  let groqProposal = null;
  let groqFailed = false;
  try {
    groqProposal = await proposeVerdict({ dish, condition, answersText, principle, dishRulesText });
  } catch (err) {
    groqFailed = true;
    console.warn('Verdict proposal unavailable:', err && err.message);
  }

  const result = computeVerdict({ dish, condition, answers, confidence, groqProposal, groqFailed });

  const adjusted_for_safety =
    groqProposal !== null && ORDER.indexOf(result.verdict) > ORDER.indexOf(groqProposal.verdict);

  // Persist the scan; a failed insert never blocks the verdict.
  let scan_id = null;
  try {
    const inserted = await _insertScan(
      req.userId,
      dish,
      condition,
      answers,
      result.verdict,
      result.reason,
      result.swaps || []
    );
    scan_id = inserted.rows?.[0]?.id ?? null;
  } catch (err) {
    console.error('Failed to save scan (verdictRoute):', err && err.message);
  }

  return res.json({
    scan_id,
    dish,
    dish_id: dish_id ?? null,
    condition,
    verdict: result.verdict,
    reason: result.reason,
    swaps: result.swaps,
    disclaimer: result.disclaimer, // set by the server inside computeVerdict
    confidence,
    adjusted_for_safety,
  });
});

export default router;
