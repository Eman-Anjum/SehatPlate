/**
 * src/api.js — Client-side API helpers.
 *
 * Token storage: an in-memory variable (no localStorage/cookie).
 * The preview proxy strips Authorization headers, so the token is
 * also appended as ?access_token= in the query string (server reads it first).
 * temp_tokens are sent in the JSON body, never as a header.
 */

const BASE = import.meta.env.VITE_API_URL || '';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

/**
 * Core fetch wrapper.
 * - Attaches Authorization header AND ?access_token= query param when logged in.
 * - Parses JSON responses and throws on non-2xx with {status, data, message}.
 */
async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  let url = `${BASE}${path}`;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
    url += (url.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(accessToken);
  }

  const res = await fetch(url, { ...options, headers });

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : null;

  if (!res.ok) {
    const error = new Error(data?.detail || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

/* ── Public helpers ──────────────────────────────────────────────── */

/** GET /health — no auth required */
export async function getHealth() {
  try {
    return await apiFetch('/health', { method: 'GET' });
  } catch (err) {
    return { status: 'error', detail: err.message };
  }
}

/** POST /auth/register — returns {id, email} */
export async function registerUser({ email, password }) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * POST /auth/login — returns either:
 *   {access_token}                      → normal login; token stored automatically
 *   {requires_2fa: true, temp_token}   → 2FA required; data returned unchanged
 */
export async function loginUser({ email, password }) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  // Only store the token when login is fully complete (no 2FA pending)
  if (data.access_token) {
    setAccessToken(data.access_token);
  }
  // Return data unchanged so the caller can detect requires_2fa
  return data;
}

/**
 * POST /auth/2fa/login — completes a 2FA login.
 * Pass either {temp_token, code} or {temp_token, recovery_code}.
 * Stores the returned access_token automatically.
 */
export async function login2fa({ temp_token, code, recovery_code }) {
  const data = await apiFetch('/auth/2fa/login', {
    method: 'POST',
    body: JSON.stringify({ temp_token, code, recovery_code }),
  });
  if (data.access_token) {
    setAccessToken(data.access_token);
  }
  return data;
}

/**
 * POST /auth/2fa/setup — initiates TOTP setup (requires auth).
 * Returns {secret, otpauth_uri, recovery_codes[8]}.
 * Recovery codes are plain-text here only; server stores hashes.
 */
export async function setup2fa() {
  return apiFetch('/auth/2fa/setup', { method: 'POST' });
}

/**
 * POST /auth/2fa/verify — confirms the TOTP code and enables 2FA.
 * Returns {enabled: true}.
 */
export async function verify2fa(code) {
  return apiFetch('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** GET /me — returns {id, email, totp_enabled}; requires auth */
export async function getMe() {
  return apiFetch('/me', { method: 'GET' });
}
