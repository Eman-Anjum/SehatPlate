# SehatPlate

AI food guide for Pakistani dishes. The user picks a condition (diabetes, kidney disease, high blood pressure), uploads a photo or types a dish, confirms the dish, answers follow-up questions, and gets a verdict (Safe / Moderation / Avoid) with a reason, healthier swaps and a medical disclaimer. Guidance only, not medical advice.

## Stack

- Frontend: React 18 + Vite 4, React Router. All requests go through `src/api.js` (relative URLs only).
- Backend: Node.js + Express (`server/`), Zod validation, JWT (HS256) + bcryptjs, TOTP 2FA (otplib, qrcode), multer, helmet, cors, express-rate-limit.
- Database: PostgreSQL (`users`, `scans`), schema only through `db/migrations/`.
- AI: Groq, called only from `server/ai.js`. Env: `GROQ_API_KEY`, `GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL`.
- Rules: `server/dish_rules.json` (10 dishes x 3 conditions, common questions, escalations).
- Tests: Vitest + supertest with Groq mocked (51 test cases in 5 files: `ai`, `dish`, `verdict`, `verdictRoute`, `verdictHistory`).

## Done

### Backend
- **Auth** (`server/auth.js`): `POST /auth/register`, `POST /auth/login`, `GET /me`. Login returns `{access_token}`, or `{requires_2fa, temp_token}` (5 min) when 2FA is on. `/auth` login and register are limited to 20 requests per 15 min per IP.
- **2FA** (`server/twofa.js`): `POST /auth/2fa/setup` (secret, `otpauth_uri`, 8 recovery codes, shown once), `/auth/2fa/verify`, `/auth/2fa/login` (TOTP or single-use recovery code). Failed 2FA logins are locked out after 5 attempts per 10 min per user (in memory).
- **Dish** (`server/dish.js`): `POST /dish/identify` (photo via Groq vision, typed name matched locally against the rules) and `POST /dish/questions` (questions from the rules, or Groq-generated and cached per dish and condition). Uploads: jpeg/png/webp, max 5 MB. 10 requests per min per user.
- **Verdict** (`server/verdict.js`, `server/verdictRoute.js`): `POST /verdict` validates the body, asks Groq for one proposal, then applies the safety override. The strictest result wins, so Groq can never go softer than the rules:
  - the rules floor (`min_verdict`) for that dish and condition;
  - escalating answers;
  - confidence below 0.6 or any unanswered question gives at least Moderation;
  - invalid Groq output or a Groq failure falls back to the rules floor, else Moderation.

  Each scan is saved with its answers. Safe is possible only where the rules floor is `null` (9 of 30 dish and condition pairs) and requires all questions answered, no escalating answer, confidence 0.6 or more, and a Groq proposal of Safe. 10 requests per min per user.
- **History** (`server/history.js`): `GET /history` returns the user's own scans, newest first, max 50.

### Frontend
- `src/pages/AuthPage.jsx`: sign in / register, 2FA login step (TOTP or recovery code), logged-in top bar, 2FA setup (QR, secret, recovery codes, confirm code), logout. Embeds `ScanPage` after login.
- `src/pages/ScanPage.jsx`: Scan tab (condition, dish name or photo with client-side downscale to 1024 px, confirm or edit the dish guess, questions, verdict badge, reason, swaps, disclaimer) and History tab.
- `src/hooks/useAuth.js` and `src/api.js`: token handling and API calls, including the 429 and 502 messages.
- **Theme:** teal and red palette (primary `#208f84`, danger `#dd2d4a`, text `#0f3d3a` / `#14262b`, muted `#5b6f73`, lines `#d6e3e5`, tints `#e3f3f1`). Only colors changed; no logic or layout changed. Verdict badge, error and success colors (green, amber, red) are intentionally unchanged.
- `src/styles.css`: a light design layer over the inline styles (teal page background, rounded cards and buttons, sticky top bar, pill tabs, pill badges, `spin` keyframes).

## Known issues in the current snapshot
- No clear history button. The History tab can only list and refresh. It needs three small pieces: DELETE /history in server/history.js (delete the signed-in user's scans only), clearHistory() in src/api.js, and a Clear button with a confirm in HistoryTab (ScanPage.jsx) that reloads the list. Add a test in server/verdictHistory.test.js.
- 2FA setup and verify have no rate limit. Only the 2FA login has the failed-attempt lockout.
- multer is on 1.x. Upgrade to 2.x, then retest photo scans.
- dish_rules.json has no medical review. The rules are not clinically validated; the app must stay conservative and keep the disclaimer.
- Tests not rerun after the styling changes. Run npm test and click through one full scan (condition, photo and typed name, questions, verdict, history, 2FA setup) before publishing.
- No password reset, privacy or terms text.
- Unused leftovers: server/register.js duplicates the register route and is not mounted; backend/ (FastAPI) is not used. The live backend is server/.
- Fragile style hooks: styles.css finds some elements by an inline value (for example the card's border-radius: 20px and the badge background colors), so changing those values in the JSX breaks the matching rule.


## Next steps

1. Rate limit `/auth/2fa/setup` and `/auth/2fa/verify` (only the 2FA login has a failed-attempt lockout).
2. Fix the issues above: one `styles.css`, finish the color swap in the two pages.
3. Upgrade `multer` 1.x to 2.x, then retest photo scans.
4. Medical review of `dish_rules.json`; then add more dishes, one small insert at a time.
5. Password reset flow; privacy and terms text.
6. Publish and test with the real secrets.

## Gotchas

- `package.json` must keep `"type": "module"`. Never set `VITE_API_URL`.
- The Vite proxy must list every route prefix: /api, /health, /auth, /me, /dish, /history, /verdict.
- The preview proxy strips headers: send `access_token` as a query parameter and `temp_token` in the JSON body.
- `SESSION_SECRET` and `DATABASE_URL` are platform secrets; do not change them.
- Never rewrite `server/dish_rules.json`; make one small edit at a time.
- Do not edit or delete files in `db/migrations`. Migrations are applied only by a build.
- Groq retires models: a deprecated model id in a secret makes every Groq call fail and verdicts fall back to Moderation. Qwen 3.x models think first, so send `reasoning_effort: "none"` for `qwen/` models only.
- `styles.css` finds elements by their inline colors (as `rgb(...)`), so when you change a color in the JSX, update the matching selector too.
- Keep the 2FA setup screen when editing `AuthPage.jsx`.
