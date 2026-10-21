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

  const res = await fetch(url, {
    ...options,
    headers,
  });

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

export async function getHealth() {
  try {
    return await apiFetch('/health', { method: 'GET' });
  } catch (err) {
    return { status: 'error', detail: err.message };
  }
}

export async function registerUser({ email, password }) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function loginUser({ email, password }) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.access_token) {
    setAccessToken(data.access_token);
  }
  return data;
}

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

export async function setup2fa() {
  return apiFetch('/auth/2fa/setup', { method: 'POST' });
}

export async function verify2fa(code) {
  return apiFetch('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function getMe() {
  return apiFetch('/me', { method: 'GET' });
}
