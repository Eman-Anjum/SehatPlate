const API_URL = import.meta.env.VITE_API_URL;

export async function getHealth() {
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) {
      throw new Error('Network response was not ok');
    }
    return await res.json();
  } catch (error) {
    return { status: 'error', detail: error.message };
  }
}
