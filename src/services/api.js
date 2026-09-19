const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000/api`;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export const getNews = () => request('/content/news');

export const login = (document, password) => request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ document, password }),
});

export const createAppointment = data => request('/healthcare/appointments', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const createPqrs = data => request('/pqrs/requests', {
  method: 'POST',
  body: JSON.stringify(data),
});