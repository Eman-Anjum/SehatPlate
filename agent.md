# AGENTS.md

## Project
SehatPlate: AI food guide for Pakistani dishes (biryani, nihari, haleem, daal chawal, chai, etc.).
User uploads a photo or types a dish name, picks ONE health condition (diabetes, kidney disease,
high blood pressure), answers 3-4 follow-up questions, and gets a verdict (Safe / Moderation / Avoid)
with reason, swaps and disclaimer. English only. No family profiles. Hackathon MVP: a complete
end-to-end flow beats extra features.
Product details are in `requirements.md` and `specs.md`. Read them only when asked.

## Stack (fixed. Do not change or add alternatives)
- Frontend: React 18 + Vite, React Router, plain CSS or Tailwind. Talks to backend with fetch.
- Backend: FastAPI (Python 3.11+), Pydantic v2, Uvicorn.
- Database: the platform's built-in database via `DATABASE_URL` (from Secrets), SQLAlchemy 2.0.
  Schema changes go through the platform's migrations in `db/migrations/`. Do NOT use
  `create_all` or Alembic. Define models in `models.py` and tell the user a migration is needed.
- Auth: JWT (PyJWT), passwords hashed with bcrypt, 2FA via TOTP (pyotp) + recovery codes.
- AI: Groq API, called from the backend ONLY, with the `groq` Python SDK.

## Folder structure
- `/frontend`: src/pages, src/components, src/api.js
- `/backend`: app/main.py, routers/, models.py, schemas.py, security.py, groq_client.py, verdict.py,
  db.py, dish_rules.json, tests/
- Repo root: AGENTS.md, SUMMARY.md, requirements.md, specs.md

## Environment variables (never committed; real values live in the workspace Secrets)
Backend: DATABASE_URL, SESSION_SECRET (used as the JWT signing key), JWT_EXPIRE_MINUTES,
GROQ_API_KEY, GROQ_VISION_MODEL, GROQ_TEXT_MODEL (model names only from env, never hardcoded),
FRONTEND_ORIGIN. Frontend: VITE_API_URL. Keep `.env.example` updated.

## Commands
- Backend: `cd backend && uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm run dev`
- Install: `pip install -r backend/requirements.txt`, `npm install` in /frontend
- Tests: `cd backend && pytest`

## Workflow rules
- Start every chat by reading AGENTS.md and SUMMARY.md. Do not scan the repo.
- One task per request. No extra features. No new libraries without asking.
- Touch only files needed for the task. No refactors. Do not reprint unchanged files.
- Keep code simple and readable (beginner team). Short comments where non-obvious.
- After each task: update SUMMARY.md, then reply in max 3 lines: what changed / files / how to test.
- If unsure, ask one short question instead of guessing.

## API contract (keep stable)
- POST /auth/register {email, password}
- POST /auth/login -> {access_token} or {requires_2fa: true, temp_token}
- POST /auth/2fa/setup (auth) -> {secret, otpauth_uri, recovery_codes[8]} (shown once)
- POST /auth/2fa/verify {code} (auth) enables 2FA
- POST /auth/2fa/login {temp_token, code OR recovery_code} -> {access_token} (recovery code is single-use)
- GET /me (auth)
- POST /dish/identify (auth, multipart: image OR text field `name`) -> {dish_guess, confidence 0-1}
- POST /dish/questions (auth) {dish, condition} -> {questions: [{id, text, options[]}]}
- POST /verdict (auth) {dish, condition, answers, confidence} -> verdict JSON
- GET /history (auth) -> list of the user's past results
- All errors: HTTP status + {detail: "short message"}.

## Database
- users: id, email (unique), password_hash, totp_secret (nullable), totp_enabled (bool),
  recovery_codes (JSON, hashed, nullable), created_at
- scans: id, user_id (FK), dish, condition, answers (JSON), verdict, reason, swaps (JSON), created_at

## Auth and security rules
- Hash passwords with bcrypt. Never store or log plain passwords, tokens, TOTP or recovery codes.
- JWT is HS256 with `sub` (user id) and `exp`. Protect routes with a FastAPI dependency.
- 2FA secret is only returned at setup. Recovery codes are stored hashed and marked used once spent.
- CORS only for FRONTEND_ORIGIN.
- Validate every request body with Pydantic. Images: jpeg/png/webp only, max 5 MB.
- Use SQLAlchemy queries only (no raw string SQL). Users can only read their own scans.
- Rate-limit /dish/identify, /dish/questions and /verdict (about 10 requests/min per user) to protect
  the free AI quota.
- Never expose GROQ_API_KEY or SESSION_SECRET to the frontend or in responses.

## AI rules (Groq)
- All Groq calls live in `backend/app/groq_client.py`. Routes call its functions, never Groq directly.
- Vision-capable model for /dish/identify (image sent as a base64 data URL in an image_url part);
  text model for questions and verdicts. Model names come from env.
- Ask for JSON only and validate with a Pydantic model. On invalid JSON, retry once, then return a
  clean 502. Never crash. Set a 30 s timeout on every call. Keep prompts short to save tokens.
- Questions: use the dish's questions from `dish_rules.json` when the dish is listed. Otherwise ask
  Groq and cache the result in memory per (dish, condition).
- Verdict JSON: {dish, condition, verdict, reason, swaps[], disclaimer}. `verdict` is exactly
  "Safe", "Moderation" or "Avoid".
- Verdict system prompt: cautious food guide for Pakistani dishes, based on WHO, ADA and NKF
  principles, conservative when unsure, never diagnose, simple language. Pass the dish's entry from
  `dish_rules.json` as context when listed.

## Safety override (critical, in `verdict.py`, not in the LLM)
The LLM proposes a verdict. Code then applies these checks and the stricter result wins
(order: Safe < Moderation < Avoid):
1. `dish_rules.json` may set `min_verdict` per dish and condition. The final verdict can never be
   softer than it.
2. If identify confidence < 0.6, or any follow-up question is unanswered, the final verdict is at
   least "Moderation".
3. If the LLM output is invalid or Groq fails, fall back to `min_verdict` if present, else "Moderation".
Add pytest tests for this override logic.
- Never give medication, dosage, treatment or diagnosis advice.
- Never invent guideline citations. No doctor or dietitian has reviewed the rules, so stay conservative.
- Always include the disclaimer: "Guidance only. Please consult your doctor or dietitian."

## Frontend rules
- Pages: Login/Register, 2FA (setup with QR + recovery codes, login code entry), Home (scan flow), History.
- All API calls go through `src/api.js`, which attaches the Bearer token.
- If confidence is low, ask the user "Is this <dish>?" and let them correct it before continuing.
- Show loading and error states for every request. Redirect to login on 401.
- Verdict colors: Safe green, Moderation amber, Avoid red. Always show the text label too.
- Plain, simple English, large readable text, mobile-first. Show the disclaimer on every result.

## Definition of done
- Feature works end to end and can be tested with a given example.
- Tests for the module pass. No secrets in code. SUMMARY.md updated.
