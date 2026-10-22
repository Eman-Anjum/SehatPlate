/**
 * server/verdict.test.js
 * Vitest unit tests for the pure-logic computeVerdict function.
 * No Groq calls, no DB access.
 */
import { describe, it, expect } from 'vitest';
import { computeVerdict } from './verdict.js';

const DISCLAIMER = 'Guidance only. Please consult your doctor or dietitian.';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build a minimal valid call with sensible defaults. */
function call(overrides = {}) {
  return computeVerdict({
    dish: 'Chicken Biryani',
    condition: 'diabetes',
    answers: { portion: 'small', oil: 'light', freq: 'rarely' },
    confidence: 0.9,
    groqProposal: { verdict: 'Safe', reason: 'Looks fine.', swaps: [] },
    groqFailed: false,
    ...overrides,
  });
}

// ─── Disclaimer always present ───────────────────────────────────────────────

describe('disclaimer', () => {
  it('is always present in the response', () => {
    const r = call();
    expect(r.disclaimer).toBe(DISCLAIMER);
  });

  it('is present even on Groq failure', () => {
    const r = call({ groqFailed: true, groqProposal: null });
    expect(r.disclaimer).toBe(DISCLAIMER);
  });
});

// ─── min_verdict floor ───────────────────────────────────────────────────────

describe('min_verdict', () => {
  it('applies Moderation floor for chicken_biryani + diabetes when Groq says Safe', () => {
    const r = call({ groqProposal: { verdict: 'Safe', reason: 'OK', swaps: [] } });
    // biryani diabetes min_verdict is Moderation
    expect(r.verdict).toBe('Moderation');
  });

  it('does NOT apply a floor for a dish+condition with null min_verdict (daal_chawal+diabetes, small portion)', () => {
    const r = computeVerdict({
      dish: 'Daal Chawal',
      condition: 'diabetes',
      // small rice, light tarka — no escalation fires
      answers: { rice: 'small', tarka: 'light', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: { verdict: 'Safe', reason: 'Fine.', swaps: [] },
      groqFailed: false,
    });
    // min_verdict is null AND no escalation fires → Groq's Safe wins
    expect(r.verdict).toBe('Safe');
  });

  it('applies Avoid floor for halwa_puri + diabetes (min_verdict Avoid)', () => {
    const r = computeVerdict({
      dish: 'Halwa Puri',
      condition: 'diabetes',
      answers: { puri: 'one', halwa: 'none', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: { verdict: 'Moderation', reason: 'OK', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Avoid');
  });
});

// ─── escalation — string value ───────────────────────────────────────────────

describe('escalation (string answer)', () => {
  it('escalates to Avoid when portion=large for biryani+diabetes', () => {
    const r = call({ answers: { portion: 'large', oil: 'light', freq: 'rarely' } });
    expect(r.verdict).toBe('Avoid');
  });

  it('does not escalate when portion=small', () => {
    const r = call({ answers: { portion: 'small', oil: 'light', freq: 'rarely' } });
    // min_verdict is Moderation; no escalation → stays Moderation
    expect(r.verdict).toBe('Moderation');
  });
});

// ─── escalation — array answer ───────────────────────────────────────────────

describe('escalation (array answer)', () => {
  it('escalates daal_chawal+diabetes to Moderation when rice=medium (array match)', () => {
    // escalation: {"q":"rice","a":["medium","large"]} => Moderation
    const r = computeVerdict({
      dish: 'daal chawal',
      condition: 'diabetes',
      answers: { rice: 'medium', tarka: 'light', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Moderation');
  });

  it('escalates daal_chawal+diabetes to Moderation when rice=large (array match)', () => {
    const r = computeVerdict({
      dish: 'Daal Chawal',
      condition: 'diabetes',
      answers: { rice: 'large', tarka: 'light', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Moderation');
  });

  it('does NOT escalate daal_chawal+diabetes when rice=small (not in array)', () => {
    const r = computeVerdict({
      dish: 'Daal Chawal',
      condition: 'diabetes',
      answers: { rice: 'small', tarka: 'light', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Safe');
  });
});

// ─── common_escalation ───────────────────────────────────────────────────────

describe('common_escalation', () => {
  it('elevates to Moderation when freq=daily even on a dish with null min_verdict', () => {
    // daal chawal + high_blood_pressure has null min_verdict, no escalations fire for these answers
    // but common_escalation freq=daily should give Moderation
    const r = computeVerdict({
      dish: 'Daal Chawal',
      condition: 'high_blood_pressure',
      answers: { extra_salt: 'no', tarka: 'light', freq: 'daily' },
      confidence: 0.9,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Moderation');
  });

  it('does not apply common_escalation when freq=rarely', () => {
    const r = computeVerdict({
      dish: 'Daal Chawal',
      condition: 'high_blood_pressure',
      answers: { extra_salt: 'no', tarka: 'light', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Safe');
  });
});

// ─── low confidence ──────────────────────────────────────────────────────────

describe('low confidence', () => {
  it('forces at least Moderation when confidence < 0.6', () => {
    const r = computeVerdict({
      dish: 'Daal Chawal',
      condition: 'high_blood_pressure',
      answers: { extra_salt: 'no', tarka: 'light', freq: 'rarely' },
      confidence: 0.5,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Moderation');
  });

  it('still allows Avoid when low confidence + rule says Avoid', () => {
    const r = computeVerdict({
      dish: 'Chicken Biryani',
      condition: 'diabetes',
      answers: { portion: 'large', oil: 'light', freq: 'rarely' },
      confidence: 0.3,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    // biryani+diabetes+large → Avoid (escalation), confidence floor is Moderation — Avoid wins
    expect(r.verdict).toBe('Avoid');
  });

  it('does not apply Moderation floor when confidence is exactly 0.6', () => {
    // 0.6 is the boundary — at 0.6 the floor must NOT apply
    const r = computeVerdict({
      dish: 'Daal Chawal',
      condition: 'high_blood_pressure',
      answers: { extra_salt: 'no', tarka: 'light', freq: 'rarely' },
      confidence: 0.6,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Safe');
  });
});

// ─── unanswered applicable question ─────────────────────────────────────────

describe('unanswered questions', () => {
  it('forces at least Moderation when an applicable question is unanswered', () => {
    // omit 'portion' which is applicable to biryani+diabetes
    const r = computeVerdict({
      dish: 'Chicken Biryani',
      condition: 'diabetes',
      answers: { oil: 'light', freq: 'rarely' }, // 'portion' missing
      confidence: 0.9,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    // biryani diabetes min_verdict=Moderation already, but test the unanswered path
    expect(r.verdict).toBe('Moderation');
  });

  it('forces Moderation on null min_verdict dish when a question is unanswered', () => {
    // daal chawal+high_bp has null min_verdict; omit freq
    const r = computeVerdict({
      dish: 'Daal Chawal',
      condition: 'high_blood_pressure',
      answers: { extra_salt: 'no', tarka: 'light' }, // freq missing
      confidence: 0.9,
      groqProposal: { verdict: 'Safe', reason: 'Fine', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Moderation');
  });
});

// ─── Groq failure ────────────────────────────────────────────────────────────

describe('Groq failure', () => {
  it('falls back to rules min_verdict for listed dish when Groq fails', () => {
    const r = computeVerdict({
      dish: 'Chicken Biryani',
      condition: 'diabetes',
      answers: { portion: 'small', oil: 'light', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: null,
      groqFailed: true,
    });
    // biryani+diabetes min_verdict is Moderation
    expect(r.verdict).toBe('Moderation');
    // reason comes from the dish rules, not generic
    expect(r.reason).toContain('blood sugar');
  });

  it('falls back to Moderation with generic reason for unlisted dish when Groq fails', () => {
    const r = computeVerdict({
      dish: 'Unknown Exotic Dish',
      condition: 'diabetes',
      answers: { freq: 'rarely' },
      confidence: 0.9,
      groqProposal: null,
      groqFailed: true,
    });
    expect(r.verdict).toBe('Moderation');
    expect(r.reason).toContain('healthcare provider');
  });

  it('returns swaps from rules for listed dish on Groq failure', () => {
    const r = computeVerdict({
      dish: 'Nihari',
      condition: 'high_blood_pressure',
      answers: { portion: 'small', source: 'home_less_salt', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: null,
      groqFailed: true,
    });
    expect(r.swaps.length).toBeGreaterThan(0);
    expect(r.swaps.some((s) => /salt/i.test(s))).toBe(true);
  });
});

// ─── invalid Groq output ─────────────────────────────────────────────────────

describe('invalid Groq output', () => {
  it('treats null groqProposal without groqFailed flag as invalid → uses rule floor', () => {
    // groqFailed=false but proposal is null — counts as invalid output
    const r = computeVerdict({
      dish: 'Chicken Biryani',
      condition: 'diabetes',
      answers: { portion: 'small', oil: 'light', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: null,
      groqFailed: false,
    });
    expect(r.verdict).toBe('Moderation'); // rule floor
  });

  it('treats proposal with unknown verdict string as invalid', () => {
    const r = call({
      groqProposal: { verdict: 'Maybe', reason: 'Sure', swaps: [] },
      groqFailed: false,
    });
    // invalid → rule floor (Moderation for biryani+diabetes)
    expect(r.verdict).toBe('Moderation');
  });

  it('treats proposal with missing reason as invalid', () => {
    const r = call({
      groqProposal: { verdict: 'Safe', reason: '', swaps: [] },
      groqFailed: false,
    });
    expect(r.verdict).toBe('Moderation');
  });
});

// ─── stricter-wins override ──────────────────────────────────────────────────

describe('stricter-wins override', () => {
  it('Avoid beats Moderation rule floor when Groq says Avoid', () => {
    const r = call({
      answers: { portion: 'small', oil: 'light', freq: 'rarely' },
      groqProposal: { verdict: 'Avoid', reason: 'Very risky.', swaps: ['Skip it'] },
    });
    // biryani diabetes floor is Moderation; Groq says Avoid → Avoid wins
    expect(r.verdict).toBe('Avoid');
  });

  it('Avoid beats Moderation floor when escalation fires AND Groq says Moderation', () => {
    const r = call({
      answers: { portion: 'large', oil: 'light', freq: 'rarely' },
      groqProposal: { verdict: 'Moderation', reason: 'Watch it.', swaps: ['Smaller portion'] },
    });
    // escalation large → Avoid; Groq says Moderation → Avoid wins
    expect(r.verdict).toBe('Avoid');
  });

  it('floor does not downgrade a valid Groq Avoid verdict', () => {
    const r = computeVerdict({
      dish: 'Daal Chawal',
      condition: 'high_blood_pressure',
      answers: { extra_salt: 'no', tarka: 'light', freq: 'rarely' },
      confidence: 0.9,
      groqProposal: { verdict: 'Avoid', reason: 'Very salty batch.', swaps: ['Skip today'] },
      groqFailed: false,
    });
    // floor is null → Groq's Avoid is kept
    expect(r.verdict).toBe('Avoid');
  });
});

// ─── sanitiseReason / disclaimer strips forbidden medical language ────────────

describe('sanitiseReason', () => {
  it('strips medication-related language from AI output', () => {
    const r = call({
      groqProposal: {
        verdict: 'Moderation',
        reason: 'Take your medication and adjust the dosage accordingly.',
        swaps: [],
      },
    });
    expect(r.reason).not.toMatch(/medication/i);
    expect(r.reason).not.toMatch(/dosage/i);
  });
});
