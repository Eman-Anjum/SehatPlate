/**
 * server/verdictRoute.test.js
 * Vitest route tests for POST /verdict with the Groq call mocked.
 * Auth and DB are mocked too, so no JWT secret or database is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Authenticate every request as user 1 (verdictRoute only uses requireAuth).
vi.mock('./auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.userId = 1;
    next();
  },
}));

// No real database in tests.
vi.mock('./db.js', () => ({
  pool: { query: vi.fn() },
}));

// Mock only the Groq proposal; keep the rest of ai.js real.
vi.mock('./ai.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, proposeVerdict: vi.fn() };
});

import verdictRouter from './verdictRoute.js';
import { pool } from './db.js';
import { proposeVerdict } from './ai.js';

const app = express();
app.use(express.json());
app.use('/verdict', verdictRouter);

const DISCLAIMER = 'Guidance only. Please consult your doctor or dietitian.';
const SAFE_PROPOSAL = {
  verdict: 'Safe',
  reason: 'A small portion is usually fine.',
  swaps: ['Take a small portion', 'Add a fresh salad'],
};

function postVerdict(body) {
  return request(app).post('/verdict').send(body);
}

beforeEach(() => {
  vi.clearAllMocks();
  proposeVerdict.mockResolvedValue(SAFE_PROPOSAL);
  pool.query.mockResolvedValue({ rows: [{ id: 42, user_id: 1 }] });
});

describe('POST /verdict', () => {
  it('rules floor wins: AI says Safe but min_verdict is Moderation', async () => {
    const res = await postVerdict({
      dish: 'Chicken Biryani',
      dish_id: 'chicken_biryani',
      condition: 'diabetes',
      answers: { portion: 'small', oil: 'light', freq: 'rarely' },
      confidence: 0.9,
    });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('Moderation'); // biryani + diabetes floor
    expect(res.body.adjusted_for_safety).toBe(true);
    expect(res.body.scan_id).toBe(42);
    expect(res.body.dish_id).toBe('chicken_biryani');
    expect(res.body.disclaimer).toBe(DISCLAIMER);
    expect(res.body.confidence).toBe(0.9);
    expect(Array.isArray(res.body.swaps)).toBe(true);

    // One Groq call, one scan insert with the answers as JSON.
    expect(proposeVerdict).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO scans/i);
    expect(params[0]).toBe(1);
    expect(params[1]).toBe('Chicken Biryani');
    expect(JSON.parse(params[3])).toEqual({ portion: 'small', oil: 'light', freq: 'rarely' });
  });

  it('escalation: chicken_biryani + kidney_disease + large portion -> Avoid', async () => {
    proposeVerdict.mockResolvedValue({
      verdict: 'Moderation',
      reason: 'Salty dish, keep the portion small.',
      swaps: ['Ask for less salt', 'Skip the potatoes'],
    });
    const res = await postVerdict({
      dish: 'chicken_biryani',
      condition: 'kidney_disease',
      answers: { portion: 'large', potato: 'no', freq: 'rarely' },
      confidence: 0.9,
    });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('Avoid');
    expect(res.body.adjusted_for_safety).toBe(true);
  });

  it('confidence 0.4 forces at least Moderation even when AI says Safe', async () => {
    const res = await postVerdict({
      dish: 'Daal Chawal',
      condition: 'high_blood_pressure',
      // all applicable questions answered, no escalation fires
      answers: { rice: 'small', tarka: 'light', extra_salt: 'no', freq: 'rarely' },
      confidence: 0.4,
    });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('Moderation');
    expect(res.body.adjusted_for_safety).toBe(true);
  });

  it('a missing applicable answer forces at least Moderation', async () => {
    const res = await postVerdict({
      dish: 'Daal Chawal',
      condition: 'high_blood_pressure',
      answers: { rice: 'small', tarka: 'light', extra_salt: 'no' }, // freq missing
      confidence: 0.9,
    });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('Moderation');
    expect(res.body.adjusted_for_safety).toBe(true);
  });

  it('Groq failure -> 200 with the rules fallback, not an error', async () => {
    proposeVerdict.mockRejectedValue(new Error('groq down'));
    const res = await postVerdict({
      dish: 'Chicken Biryani',
      condition: 'diabetes',
      answers: { portion: 'small', oil: 'light', freq: 'rarely' },
      confidence: 0.9,
    });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('Moderation'); // rules min_verdict
    expect(res.body.reason).toContain('blood sugar'); // rules reason
    expect(res.body.adjusted_for_safety).toBe(false); // no proposal existed
    expect(res.body.disclaimer).toBe(DISCLAIMER);
  });

  it('a failed scan insert still returns the verdict with scan_id null', async () => {
    pool.query.mockRejectedValue(new Error('db down'));
    const res = await postVerdict({
      dish: 'Chai',
      condition: 'diabetes',
      answers: { cups: 'one_two', sugar: 'none', freq: 'rarely' },
      confidence: 0.9,
    });

    expect(res.status).toBe(200);
    expect(res.body.scan_id).toBeNull();
    expect(res.body.verdict).toBe('Safe');
  });

  it('rejects a bad body with 400 {detail} and never calls Groq', async () => {
    const res = await postVerdict({ dish: '', condition: 'nope', confidence: 2 });
    expect(res.status).toBe(400);
    expect(typeof res.body.detail).toBe('string');

    const missing = await postVerdict({ dish: 'Chai', condition: 'diabetes' });
    expect(missing.status).toBe(400);

    expect(proposeVerdict).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });
});
