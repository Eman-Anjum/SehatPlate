# AGENTS.md

## Project
SehatPlate: AI food guide for Pakistani dishes. User uploads a photo or types a
dish name, picks a health condition (diabetes, kidney disease, high blood
pressure), answers 3-4 follow-up questions, and gets a verdict
(Safe / Moderation / Avoid) with reason, swaps and disclaimer.
Product details are in SPEC.md. Read it only when asked.

## Stack (fixed. Do not change or add alternatives)
- Frontend: React 18 + Vite, React Router, plain CSS or Tailwind. Talks to the
  backend with fetch.
- Backend: FastAPI (Python 3.11+), Pydantic v2, Uvicorn.
- Database: PostgreSQL via SQLAlchemy 2.0 + psycopg. Tables created from models
  at startup. No Alembic unless asked.
- Auth: JWT (PyJWT) access tokens, passwords hashed with bcrypt, 2FA via TOTP (pyotp).
- AI: Grok (xAI API), OpenAI-compatible, called from the backend ONLY with the
  `openai` Python SDK and base_url https://api.x.ai/v1.

## Folder structure
/frontend   React app (src/pages, src/components, src/api.js)
/backend    FastAPI app (app/main.py, routers/, models.py, schemas.py,
            security.py, grok.py, db.py)
SPEC.md, AGENTS.md, SUMMARY.md at repo root.

## Environment variables (backend/.env, never committed)
DATABASE_URL, JWT_SECRET, JWT_EXPIRE_MINUTES, XAI_API_KEY,
GROK_MODEL (default read from env, never hardcoded in logic),
FRONTEND_ORIGIN. Frontend: VITE_API_URL. Keep .env.example updated.
Use the workspace Secrets for real values.

## Commands
- Backend: `cd backend && uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm run dev`
- Install: `pip install -r backend/requirements.txt`, `npm install` in /frontend

## Workflow rules
- Start every chat by reading AGENTS.md and SUMMARY.md. Do not scan the repo.
- One task per request. No extra features. No new libraries without asking.
- Touch only files needed for the task. No refactors.
- Keep code simple and readable (beginner team). Short comments where non-obvious.
- After each task: update SUMMARY.md, then reply in max 3 lines:
  what changed / files / how to test.
- If unsure, ask one short question instead of guessing.

## API contract (keep stable)
- POST /auth/register {email, password}
- POST /auth/login -> {access_token} or {requires_2fa: true, temp_token}
- POST /auth/2fa/setup (auth) -> {secret, otpauth_uri}
- POST /auth/2fa/verify {code} (auth) enables 2FA
- POST /auth/2fa/login {temp_token, code} -> {access_token}
- GET  /me (auth)
- POST /dish/identify (auth, multipart image) -> {dish_guess}
- POST /dish/questions (auth) {dish, condition} -> {questions: [{id, text, options[]}]}
- POST /verdict (auth) {dish, condition, answers} -> verdict JSON
- GET  /history (auth) -> list of the user's past results
All errors: HTTP status + {detail: "short message"}.

## Database
- users: id, email (unique), password_hash, totp_secret (nullable),
  totp_enabled (bool), created_at
- scans: id, user_id (FK), dish, condition, answers (JSONB), verdict,
  reason, swaps (JSONB), created_at

## Auth and security rules
- Hash passwords with bcrypt. Never store or log plain passwords or tokens.
- JWT is HS256, signed with JWT_SECRET, has `sub` (user id) and `exp`.
  Protect routes with a FastAPI dependency that validates the token.
- Enable CORS only for FRONTEND_ORIGIN.
- Validate every request body with Pydantic. Limit image uploads to
  jpeg/png/webp, max 5 MB.
- Use SQLAlchemy queries only (no raw string SQL). Users can only read their
  own scans.
- Never expose XAI_API_KEY or JWT_SECRET to the frontend or in responses.

## Grok (AI) rules
- All Grok calls live in backend/app/grok.py. Routes call its functions; they
  never call xAI directly.
- Client: OpenAI(api_key=XAI_API_KEY, base_url="https://api.x.ai/v1").
  Model name from GROK_MODEL. Use a vision-capable Grok model for
  /dish/identify (send the image as a base64 data URL in an image_url part).
- Ask for JSON only and validate the result with a Pydantic model. On invalid
  JSON, retry once, then return a clean 502 error. Never crash.
- Set a timeout (30 s) on every call. Keep prompts short to save tokens.
- Verdict JSON: {dish, condition, verdict, reason, swaps[], disclaimer}.
  verdict is exactly "Safe", "Moderation" or "Avoid".
- System prompt for verdicts: cautious food guide for Pakistani dishes, based
  on WHO, ADA and NKF principles, conservative when unsure, never diagnose,
  simple language. Use the dish rules file (backend/app/dish_rules.json) as
  context when the dish is listed there.
- Always include the disclaimer: "Guidance only. Please consult your doctor
  or dietitian."

## Frontend rules
- Pages: Login/Register, 2FA, Home (scan flow), History.
- All API calls go through src/api.js, which attaches the Bearer token.
- Show loading and error states for every request. Redirect to login on 401.
- Verdict colors: Safe green, Moderation amber, Avoid red.

## Definition of done
- Feature works end to end and can be tested with a given example.
- No secrets in code. SUMMARY.md updated.
