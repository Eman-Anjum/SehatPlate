/**
 * server/verdictRoute.js
 * POST /verdict route — Phase 1 skeleton.
 * Full Groq integration, Zod validation, rate limiting and DB persistence
 * are added in later phases. This file is the mount point so index.js
 * can import it now.
 */
import { Router } from 'express';
import { requireAuth } from './auth.js';
import { computeVerdict } from './verdict.js';
import { pool } from './db.js';

const router = Router();

export async function _insertScan(userId, dish, condition, verdict, reason, swaps = []) {
  // Insert with the same columns the history route selects so rows are visible
  const sql = `INSERT INTO scans (user_id, dish, condition, verdict, reason, swaps) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, user_id, dish, condition, verdict, reason, swaps, created_at`;
  const params = [userId, dish, condition, verdict, reason, JSON.stringify(swaps)];
  return pool.query(sql, params);
}

// Phase 1: accept the body, run pure logic, return the verdict.
// Zod validation + per-user rate limiter added in Phase 3.
router.post('/', requireAuth, async (req, res) => {
  const { dish, condition, answers = {}, confidence = 1 } = req.body || {};

  const VALID_CONDITIONS = ['diabetes', 'kidney_disease', 'high_blood_pressure'];

  if (!dish || typeof dish !== 'string' || !dish.trim()) {
    return res.status(400).json({ detail: 'dish is required' });
  }
  if (!VALID_CONDITIONS.includes(condition)) {
    return res.status(400).json({ detail: 'condition must be one of: ' + VALID_CONDITIONS.join(', ') });
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    return res.status(400).json({ detail: 'confidence must be a number between 0 and 1' });
  }

  // Phase 1: no Groq call — groqProposal is null (simulates Groq not yet wired).
  const result = computeVerdict({
    dish: dish.trim(),
    condition,
    answers,
    confidence,
    groqProposal: null,
    groqFailed: false,
  });

  // Persist the scan; don't fail the response if saving fails.
  try {
    // ensure we pass the same user id that requireAuth put on req
    await _insertScan(req.userId, dish.trim(), condition, result.verdict, result.reason, result.swaps || []);
  } catch (err) {
    // Log the real error so operators can debug DB issues and return the verdict anyway.
    console.error('Failed to save scan (verdictRoute):', err);
    // rethrow is intentionally omitted so the user still receives the verdict
  }

  return res.json({ dish: dish.trim(), condition, ...result });
});

export default router;
