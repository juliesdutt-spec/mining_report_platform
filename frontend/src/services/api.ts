// Base API configuration for DataForge
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function checkBackendHealth(): Promise<{ isOnline: boolean; statusText: string }> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(id);
    if (res.ok) {
      const data = await res.json();
      return { isOnline: true, statusText: `FastAPI Live (${data.status})` };
    }
    return { isOnline: false, statusText: 'Backend Offline (Demo Mock Mode)' };
  } catch (err) {
    return { isOnline: false, statusText: 'Backend Offline (Demo Mock Mode)' };
  }
}

export { API_BASE_URL };
