// Base URL: use VITE_API_URL if set (for external deploys), otherwise relative
// so Vite's dev proxy forwards /health and /api/* to Express on port 3001.
const BASE = import.meta.env.VITE_API_URL || '';

export async function getHealth() {
  try {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { status: 'error', detail: err.message };
  }
}
