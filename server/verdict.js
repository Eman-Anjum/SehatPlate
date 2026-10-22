/**
 * server/verdict.js
 * Pure logic verdict module — no Groq calls, no DB access.
 * All decision-making is deterministic and testable here.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const rules = require('./dish_rules.json');

// Ordered severity levels — higher index == stricter.
const ORDER = rules.verdict_order; // ["Safe", "Moderation", "Avoid"]

function indexOf(verdict) {
  const i = ORDER.indexOf(verdict);
  return i === -1 ? 0 : i;
}

/** Return whichever verdict is stricter (higher in ORDER). */
function stricter(a, b) {
  return indexOf(a) >= indexOf(b) ? a : b;
}

/**
 * Look up the dish entry by id or alias (case-insensitive).
 * Returns the dish object or null.
 */
function findDish(dishName) {
  const lower = dishName.trim().toLowerCase();
  return (
    rules.dishes.find(
      (d) =>
        d.id === lower ||
        d.name.toLowerCase() === lower ||
        (d.aliases || []).some((a) => a.toLowerCase() === lower)
    ) || null
  );
}

/**
 * Collect all questions that apply to a dish + condition.
 * Returns an array of question ids.
 */
function applicableQuestionIds(dish, condition) {
  const ids = [];
  // common_questions always apply
  for (const q of rules.common_questions || []) ids.push(q.id);
  // dish-specific questions filtered by condition
  if (dish) {
    for (const q of dish.questions || []) {
      if (!q.conditions || q.conditions.includes(condition)) {
        ids.push(q.id);
      }
    }
  }
  return ids;
}

/**
 * Check a single escalation rule against the answers map.
 * escalation.if: { q: string, a: string | string[] }
 * Returns true if the answer matches.
 */
function escalationFires(escalation, answers) {
  const { q, a } = escalation.if;
  const userAnswer = answers[q];
  if (userAnswer === undefined || userAnswer === null) return false;
  if (Array.isArray(a)) return a.includes(userAnswer);
  return userAnswer === a;
}

/**
 * computeVerdict — the single public export.
 *
 * @param {object} params
 * @param {string}  params.dish        - Dish name / alias as recognised by dish_rules.json
 * @param {string}  params.condition   - One of: diabetes, kidney_disease, high_blood_pressure
 * @param {object}  params.answers     - { [questionId]: optionId }
 * @param {number}  params.confidence  - 0–1 from the identify step
 * @param {object|null} params.groqProposal - { verdict, reason, swaps } from Groq, or null on failure
 * @param {boolean} [params.groqFailed] - true when Groq call itself threw / returned unusable output
 *
 * @returns {{ verdict: string, reason: string, swaps: string[], disclaimer: string }}
 */
export function computeVerdict({ dish, condition, answers = {}, confidence = 1, groqProposal = null, groqFailed = false }) {
  const dishEntry = findDish(dish);
  const dishRules = dishEntry?.rules?.[condition] ?? null;

  // --- 1. Determine the rule-based floor --------------------------------
  let ruleFloor = null; // null means no rule-based floor

  if (dishRules) {
    // a) min_verdict from rules (may be null)
    if (dishRules.min_verdict !== null && dishRules.min_verdict !== undefined) {
      ruleFloor = dishRules.min_verdict;
    }

    // b) dish-specific escalations
    for (const esc of dishRules.escalations || []) {
      if (escalationFires(esc, answers)) {
        ruleFloor = ruleFloor === null ? esc.min_verdict : stricter(ruleFloor, esc.min_verdict);
      }
    }
  }

  // c) common_escalations
  for (const esc of rules.common_escalations || []) {
    if (escalationFires(esc, answers)) {
      const mv = esc.min_verdict;
      ruleFloor = ruleFloor === null ? mv : stricter(ruleFloor, mv);
    }
  }

  // --- 2. Confidence / unanswered questions floor -----------------------
  const appIds = applicableQuestionIds(dishEntry, condition);
  const hasUnanswered = appIds.some((id) => answers[id] === undefined || answers[id] === null);

  let uncertaintyFloor = null;
  if (confidence < 0.6 || hasUnanswered) {
    uncertaintyFloor = 'Moderation';
  }

  // --- 3. Determine the overall floor (strictest of rule + uncertainty) -
  let floor = null;
  if (ruleFloor !== null && uncertaintyFloor !== null) {
    floor = stricter(ruleFloor, uncertaintyFloor);
  } else {
    floor = ruleFloor ?? uncertaintyFloor;
  }

  // --- 4. Select reason / swaps source ----------------------------------
  // Prefer rules-based text when available; fall back to generic.
  const rulesReason = dishRules?.reason ?? null;
  const rulesSwaps = dishRules?.swaps ?? [];

  const genericReason =
    'This dish could not be assessed in detail. Please be cautious and check with your healthcare provider.';
  const genericSwaps = [
    'Choose a smaller portion',
    'Avoid added salt and oil',
    'Consult your dietitian for personalised advice',
  ];

  // --- 5. Resolve verdict -----------------------------------------------
  let verdict;
  let reason;
  let swaps;

  const groqValid =
    !groqFailed &&
    groqProposal !== null &&
    typeof groqProposal === 'object' &&
    ORDER.includes(groqProposal.verdict) &&
    typeof groqProposal.reason === 'string' &&
    groqProposal.reason.trim().length > 0;

  if (groqValid) {
    // Start from Groq's proposal and apply hard overrides.
    verdict = groqProposal.verdict;
    reason = groqProposal.reason;
    swaps = Array.isArray(groqProposal.swaps) ? groqProposal.swaps : rulesSwaps;
  } else {
    // Groq failed or output invalid — fall back to rules.
    verdict = floor !== null ? floor : 'Moderation';
    reason = rulesReason ?? genericReason;
    swaps = rulesSwaps.length > 0 ? rulesSwaps : genericSwaps;
  }

  // Hard override: the floor always wins.
  if (floor !== null && indexOf(floor) > indexOf(verdict)) {
    verdict = floor;
    // When rules bump the verdict stricter than Groq, prefer rules text.
    if (rulesReason) {
      reason = rulesReason;
      if (rulesSwaps.length > 0) swaps = rulesSwaps;
    }
  }

  // Safety: no medication / dosage / diagnosis language allowed.
  // (Rules-based text is pre-screened; AI text is stripped below.)
  reason = sanitiseReason(reason);

  const DISCLAIMER = 'Guidance only. Please consult your doctor or dietitian.';

  return { verdict, reason, swaps, disclaimer: DISCLAIMER };
}

// Basic guard — strip phrases that sound like medical prescriptions.
const FORBIDDEN_PATTERNS = [
  /\bdose\b/gi,
  /\bdosage\b/gi,
  /\bmedication\b/gi,
  /\bprescri(?:be|ption)\b/gi,
  /\bdiagnos(?:e|is|ed)\b/gi,
];

function sanitiseReason(text) {
  if (typeof text !== 'string') return '';
  let out = text;
  for (const pat of FORBIDDEN_PATTERNS) {
    out = out.replace(pat, '[omitted]');
  }
  return out;
}
