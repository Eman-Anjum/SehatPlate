# AGENTS.md

## Critical rules (read first)
- Start every chat by reading AGENTS.md and SUMMARY.md only. Do not scan the repo.
- One module per request. No extra features, no new libraries without asking.
- Touch only files needed for the task. No refactors.
- Never hardcode secrets. Never view, replace or remove the secrets
  DATABASE_URL and SESSION_SECRET. Read all secrets from process.env.
- Never expose secrets or password/token data in responses or logs.
- Safety: never invent citations, never give medication, dosage or diagnosis
  advice. Be conservative when unsure.
- After each task: update SUMMARY.md, then reply in max 3 lines:
  what changed / files / how to test. If unclear, ask ONE short question.
- Output only new or changed files. No explanations.
   - package.json must keep "type": "module". Never set the VITE_API_URL secret;
     the client uses relative URLs only (via src/api.js).
   - Every new top-level API route prefix (/auth, /me, /dish, /verdict, /history)

## Project
SehatPlate: AI food guide for Pakistani dishes. User uploads a photo or types a
dish name, picks ONE condition (diabetes, kidney disease, high blood pressure),
confirms the AI's dish guess, answers 3-4 follow-up questions, and gets a
verdict (Safe / Moderation / Avoid) with reason, swaps and disclaimer:
"Guidance only. Please consult your doctor or dietitian."
English only. No family profiles. Product details: SPEC.md (read only if asked).

## Stack (fixed)
- Frontend: React + Vite, React Router, fetch via src/api.js.
- Backend: Node.js (Express), Zod validation, jsonwebtoken, bcryptjs,
  otplib (TOTP), qrcode, multer (uploads), express-rate-limit, helmet, cors.
- Tests: Vitest.
- AI: Groq free tier, called from the backend ONLY.
- Layout: follow the project type's scaffold (client + server in one repo,
  root package.json with a `dev` script that starts both).

## Database
- Platform built-in database via DATABASE_URL. Detect the driver from the URL
  scheme. If it is not PostgreSQL, STOP and report.
- Schema changes only as migration files in db/migrations/. No auto-sync.
- Parameterized queries only. Users can read only their own rows.
- users: id, email (unique), password_hash, totp_secret (nullable),
  totp_enabled, recovery_codes (JSON of hashed codes, nullable), created_at
- scans: id, user_id (FK), dish, condition, answers (JSON), verdict, reason,
  swaps (JSON), created_at

## Auth and security
- Email + password; bcryptjs hashing. JWT signed with SESSION_SECRET (HS256),
  claims sub + exp. Protect routes with an auth middleware.
- 2FA: TOTP (authenticator app) + 8 single-use hashed recovery codes.
  Login returns {access_token} or {requires_2fa: true, temp_token}.
- CORS only for FRONTEND_ORIGIN. helmet on. Validate every body with Zod.
- Uploads: jpeg/png/webp, max 5 MB.
- Rate limit AI endpoints to about 10 requests/min/user.

## API contract (keep stable; errors = HTTP status + {detail})
- POST /auth/register, POST /auth/login
- POST /auth/2fa/setup -> {secret, otpauth_uri, recovery_codes[8]}
- POST /auth/2fa/verify
- POST /auth/2fa/login {temp_token, code OR recovery_code} -> {access_token}
- GET /me
- POST /dish/identify (image OR text `name`) -> {dish_guess, confidence 0-1}
- POST /dish/questions {dish, condition} -> {questions[]}
- POST /verdict {dish, condition, answers, confidence} -> verdict JSON
- GET /history

## Verdict logic (server/verdict.js, tested with Vitest)
- Groq proposes the verdict; code then applies a hard override.
  Stricter wins: Safe < Moderation < Avoid.
  1. dish_rules.json may set min_verdict per dish + condition.
  2. confidence < 0.6 or any unanswered follow-up => at least Moderation.
  3. Invalid LLM output or Groq failure => min_verdict, else Moderation.
- Verdict JSON: {dish, condition, verdict, reason, swaps[], disclaimer}.
- Questions: use dish_rules.json when the dish is listed; otherwise Groq with
  an in-memory cache per (dish, condition).
- If confidence is low, the frontend asks "Is this <dish>?" and allows edits.

## AI (Groq) rules
- All Groq calls live in server/ai.js. Routes never call Groq directly.
- Models from env: GROQ_VISION_MODEL, GROQ_TEXT_MODEL. Key: GROQ_API_KEY.
- Parse model output defensively: strip any reasoning text, extract the JSON,
  validate with Zod, retry once, then fail safe (see Verdict logic).
- Handle 429 with one short wait and retry, then a friendly error. 30 s timeout.
- Keep prompts short. Never send real patient data.

## Frontend
- Pages: Register/Login, 2FA setup (QR from otpauth_uri), Home (scan flow),
  Result, History.
- Show loading and error states everywhere. On 401, go to login.
- Colors: Safe green, Moderation amber, Avoid red.

## Secrets / env
DATABASE_URL, SESSION_SECRET (auto, hidden), GROQ_API_KEY, GROQ_VISION_MODEL,
GROQ_TEXT_MODEL, FRONTEND_ORIGIN, VITE_API_URL. Keep .env.example updated.

## Done means
Feature works end to end with the stated test, tests pass, SUMMARY.md updated.
