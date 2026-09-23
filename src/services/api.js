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

export const getDashboardSummary = affiliateId => Promise.all([
  request(`/healthcare/appointments?affiliateId=${encodeURIComponent(affiliateId)}`),
  request(`/pqrs/requests?affiliateId=${encodeURIComponent(affiliateId)}`),
  request(`/healthcare/authorizations?affiliateId=${encodeURIComponent(affiliateId)}`),
]).then(([appointments, pqrs, authorizations]) => ({
  appointments: appointments.items || [],
  pqrs: pqrs.items || [],
  authorizations: authorizations.items || [],
}));

export const login = (document, password, role) => request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ document, password, role }),
});

export const register = data => request('/users/register', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const createAppointment = data => request('/healthcare/appointments', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const createPqrs = data => request('/pqrs/requests', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const getProfile = value => request(`/users/profile?document=${encodeURIComponent(value)}`);

export const getStaffOverview = () => request('/users/staff/overview');

export const updateProfile = data => request('/users/profile', {
  method: 'PATCH',
  body: JSON.stringify(data),
});

export const getAuthorizations = value => request(`/healthcare/authorizations?document=${encodeURIComponent(value)}`);

export const createAuthorization = data => request('/healthcare/authorizations', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const getPqrsById = id => request(`/pqrs/requests?id=${encodeURIComponent(id)}`);

export const getPrescriptions = (document, prescriptionNumber) => request(
  `/meds-labs/prescriptions?document=${encodeURIComponent(document)}&prescriptionNumber=${encodeURIComponent(prescriptionNumber)}`,
);

export const getLabResults = (document, orderNumber) => request(
  `/meds-labs/lab-results?document=${encodeURIComponent(document)}&orderNumber=${encodeURIComponent(orderNumber)}`,
);