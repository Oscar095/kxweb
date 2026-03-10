const BASE = '';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Error ${res.status}`);
  }
  return res.json();
}

export function apiGet(path) {
  return apiFetch(path);
}

export function apiPost(path, body) {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function apiPut(path, body) {
  return apiFetch(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function apiDelete(path) {
  return apiFetch(path, { method: 'DELETE' });
}
