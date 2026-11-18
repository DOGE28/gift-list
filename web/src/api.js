/**
 * Thin API client that uses fetch with credentials for cookie-based auth.
 */

async function request(path, options = {}) {
  const { method = 'GET', body, ...rest } = options;

  const headers = {
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...rest.headers,
  };

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  // Auth
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (data) => request('/auth/login', { method: 'POST', body: data }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  changeCredentials: (data) => request('/auth/change-credentials', { method: 'POST', body: data }),

  // Individuals
  getIndividuals: () => request('/users'),
  getIndividual: (id) => request(`/users/${id}`),
  createIndividual: (data) => request('/users', { method: 'POST', body: data }),
  updateIndividual: (id, data) => request(`/users/${id}`, { method: 'PUT', body: data }),
  deleteIndividual: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Events
  getEvents: () => request('/events'),
  getEvent: (id) => request(`/events/${id}`),
  createEvent: (data) => request('/events', { method: 'POST', body: data }),
  updateEvent: (id, data) => request(`/events/${id}`, { method: 'PUT', body: data }),
  deleteEvent: (id) => request(`/events/${id}`, { method: 'DELETE' }),
  addParticipant: (id, data) => request(`/events/${id}/participants`, { method: 'POST', body: data }),
  removeParticipant: (id, userId) => request(`/events/${id}/participants/${userId}`, { method: 'DELETE' }),
  getGuestTokens: (id) => request(`/events/${id}/guest-tokens`),
  createGuestToken: (id, data) => request(`/events/${id}/guest-tokens`, { method: 'POST', body: data }),
  revokeGuestToken: (id, tokenId) => request(`/events/${id}/guest-tokens/${tokenId}`, { method: 'DELETE' }),

  // Items
  getItems: (eventId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/events/${eventId}/items${qs ? `?${qs}` : ''}`);
  },
  getItem: (id) => request(`/items/${id}`),
  createItem: (eventId, data) => request(`/events/${eventId}/items`, { method: 'POST', body: data }),
  updateItem: (id, data) => request(`/items/${id}`, { method: 'PUT', body: data }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),

  // Guest (unauthenticated)
  guestGetItems: (token) => request(`/g/${token}`),
  guestCreateItem: (token, data) => request(`/g/${token}/items`, { method: 'POST', body: data }),
};

export default api;
