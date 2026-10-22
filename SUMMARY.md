# SehatPlate

AI food guide for Pakistani dishes. Users upload a photo or type a dish name, choose a condition (diabetes, kidney disease, high blood pressure), answer follow-up questions, and receive a verdict (Safe / Moderation / Avoid) with a reason, swaps and a medical disclaimer.

## Stack

- Frontend: React + Vite.
- Backend: Node.js + Express (`server/`), Zod, JWT + bcryptjs, TOTP (otplib) recovery codes, multer for uploads.
- Database: PostgreSQL via platform migrations (`db/migrations/`).
- AI: Groq API, called only from `server/ai.js`.
- Tests: Vitest + supertest, Groq mocked.
- Rules data: `server/dish_rules.json` (10 dishes: chicken biryani, nihari, haleem, daal chawal, chai, chicken karahi, halwa puri, samosa, paratha, roti sabzi; 3 conditions; `common_questions` with `freq`; `common_escalations`: freq=daily forces Moderation).

## Done

- Module 1: backend skeleton, `/health`, DB pool, `users`/`scans` tables via migration.
- Modules 2-4a: register, login, `/me`, 2FA endpoints; `src/pages/AuthPage.jsx`, `src/hooks/useAuth.js`, `src/api.js`.
- Module 5a: Groq layer in `server/ai.js` (`identifyDish`, defensive parsing, retries). Tests in `server/ai.test.js` pass.
- Module 5b: `POST /dish/identify`. Photo goes to Groq, typed name is matched locally against `dish_rules.json`. Rate limited to 10 req/min per user.
- Module 6: `POST /dish/questions`. Known dishes get questions filtered by condition plus `common_questions`. Unknown dishes get AI-generated questions with an in-memory cache. If the AI fails it falls back to `common_questions`.
- `GET /history`: the logged-in user's scans, newest first, max 50 (`id, user_id, dish, condition, verdict, reason, swaps, created_at`).
- Module 7 Phase 1: `server/verdict.js`, a pure-logic engine. A rule floor comes from `min_verdict`, dish escalations and `common_escalations`. Confidence below 0.6, or any applicable question left unanswered, forces at least Moderation. The strictest floor wins, so the AI can never go softer than the rules. Groq failure falls back to the rules reason and swaps. Forbidden medical language is stripped from AI text.
- Module 7 Phases 2-5: `POST /verdict` in `server/verdictRoute.js`.
  - `proposeVerdict` / `parseVerdictProposal` in `ai.js`: one Groq call, temp 0.2, about 300 tokens, no medication, dosage or diagnosis advice.
  - Zod body validation (400 `{detail}`) and a per-user rate limit of 10/min (429 `{detail}`).
  - Response: `{scan_id, dish, dish_id, condition, verdict, reason, swaps, disclaimer, confidence, adjusted_for_safety}`.
  - Any Groq failure falls back to the rules, never an error.
  - The scan is saved best-effort. If the insert fails, the verdict is still returned with `scan_id: null`.
  - `server/verdictRoute.test.js` passes (rules floor, escalation, low confidence, missing answer, Groq failure, insert failure, bad body).

## Test status (Vitest run: 44 passed, 2 failed, 2 files could not run)

| File | Result |
|------|--------|
| `ai.test.js` | Passes |
| `verdictRoute.test.js` | Passes |
| `verdict.test.js` | 2 failing tests (test data problem, see below) |
| `dish.test.js` | Cannot run: syntax error at line 43 (unbalanced brackets in the mock). The `/dish/questions` and `/history` tests are not currently running. |
| `verdictHistory.test.js` | Cannot run: `it` is imported twice (line 43), and the two tests duplicate each other. It also needs a live database and a user id that exists in `users`. |

Why the 2 `verdict.test.js` tests fail: both use Daal Chawal + high_blood_pressure and send only `extra_salt`, `tarka` and `freq`. This dish also asks `rice` for that condition, so the engine correctly treats the missing answer as unanswered and returns Moderation. The tests expect Safe, so they need `rice` added to their answers. The engine itself behaves as designed.

## Manual test results

| Test | Expected | Status |
|------|----------|--------|
| 1 | 200, Avoid, with disclaimer | Matches |
| 2 | Moderation or Avoid, never Safe | Matches |
| 3 | Moderation now, Safe once the Module 7 follow-up is built | Moderation (expected for now) |
| 4 and 5 | 400 with a message | Matches |
| 6 | Saved scans, newest first | Matches |

(These rows are from your latest run as you described it. I haven't re-run the live endpoints, because that needs the database and Groq keys.)

## Not built yet

- Frontend scan flow: only the auth page exists (`App.jsx` is 12 lines). There are no UI pages for photo/name entry, condition choice, follow-up questions, the verdict screen or history.
- Client helpers in `src/api.js` for `/dish/*`, `/verdict` and `/history`.
- Module 7 follow-up that lets Test 3 return Safe.
- Fixes to `dish.test.js`, `verdictHistory.test.js` and the 2 `verdict.test.js` tests so `npm test` is fully green.

## Gotchas

- `package.json` must keep `"type": "module"`.
- The Vite proxy must list every route prefix (`/auth`, `/me`, `/dish`, `/history`, `/verdict`).
- The preview proxy strips headers, so send `access_token` as a query param and `temp_token` inside the JSON body.
- `SESSION_SECRET` must be set or the server exits. Tests that import `auth.js` need it.
- `backend/` is an unused FastAPI leftover. The live backend is `server/`.
- There are 7 overlapping `users`/`scans` migrations. Check the latest one if `scans` columns look off.
