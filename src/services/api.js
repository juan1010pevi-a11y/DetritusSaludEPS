import { getCaptchaToken } from '../lib/captcha';
// En desarrollo Vite reenvía /api al API Gateway (ver vite.config.js).
const API_URL = import.meta.env.VITE_API_URL || '/api';

export const BACKEND_DOWN_MESSAGE = 'No hay conexión con el backend. Abre otra terminal y ejecuta: cd backend  →  npm install  →  npm start';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// ---------- Token de acceso ----------
// El token de acceso (JWT, 15 min) vive SOLO en memoria: ningún script puede leerlo de
// localStorage si hubiera un XSS. La sesión larga la mantiene una cookie HttpOnly que el
// navegador envía sola a /api/auth/refresh (credentials: 'include').
let accessToken = null;
export const setAccessToken = token => { accessToken = token || null; };
export const getAccessToken = () => accessToken;


let refreshing = null;
/** Pide un token nuevo con la cookie. Una sola petición a la vez (evita rotar dos veces). */
export function refreshSession() {
  refreshing ||= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async response => {
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.token) {
        if (response.status !== 409) setAccessToken(null);
        return null;
      }
      setAccessToken(data.token);
      return data;
    })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function request(path, options = {}, retried = false) {
  let response;
  const { captcha, ...fetchOptions } = options;
  // Formularios públicos: token anti-robots de un solo uso (si el CAPTCHA está configurado).
  let captchaToken = null;
  if (captcha) {
    try { captchaToken = await getCaptchaToken(); } catch (error) { throw new ApiError(error.message, 0); }
  }
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(captchaToken ? { 'X-Captcha-Token': captchaToken } : {}),
        ...fetchOptions.headers,
      },
    });
  } catch {
    throw new ApiError(BACKEND_DOWN_MESSAGE, 0);
  }

  let data = null;
  try { data = await response.json(); } catch { data = null; }

  // El proxy de Vite responde 500/502/504 sin JSON cuando el gateway está apagado;
  // el gateway responde 503 cuando el microservicio específico está apagado.
  if (!response.ok && !data && [500, 502, 504].includes(response.status)) {
    throw new ApiError(BACKEND_DOWN_MESSAGE, 0);
  }
  // Un microservicio responde "Ruta no encontrada" cuando está corriendo una versión vieja del backend.
  if (response.status === 404 && data?.error === 'Ruta no encontrada') {
    throw new ApiError('El backend que está corriendo es una versión anterior y no tiene esta función. Cierra la ventana negra del backend y vuelve a abrir iniciar.cmd (o ejecuta npm start dentro de backend).', 404, data);
  }
  // Tolerancia a fallos: solo esta sección queda sin servicio; el resto del portal sigue funcionando.
  if (response.status === 503) {
    throw new ApiError(data?.error || `El servicio de ${path.split('/')[1]} no está disponible en este momento. El resto del portal sigue funcionando.`, 503, data);
  }
  if (response.status === 429) {
    throw new ApiError(data?.error || 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.', 429, data);
  }
  if (!response.ok) {
    // Token de acceso vencido (15 min): se renueva una vez con la cookie y se repite la petición.
    if (response.status === 401 && accessToken && !retried && !path.startsWith('/auth/')) {
      const renewed = await refreshSession();
      if (renewed) {
        window.dispatchEvent(new CustomEvent('auth:refreshed', { detail: renewed }));
        return request(path, options, true);
      }
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw new ApiError(data?.error || `API error: ${response.status}`, response.status, data);
  }
  return data;
}

const query = params => new URLSearchParams(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
).toString();

export const getNews = () => request('/content/news');

// allSettled: si un microservicio está apagado, el resumen muestra lo demás en lugar de fallar completo.
export const getDashboardSummary = () => Promise.allSettled([
  request('/healthcare/appointments/mine'),
  request('/pqrs/requests/mine'),
  request('/healthcare/authorizations/mine'),
]).then(([appointments, pqrs, authorizations]) => {
  const items = result => (result.status === 'fulfilled' ? result.value.items || [] : []);
  return {
    appointments: items(appointments),
    pqrs: items(pqrs),
    authorizations: items(authorizations),
    unavailable: [appointments, pqrs, authorizations].filter(result => result.status === 'rejected').map(result => result.reason?.message),
  };
});

// ---------- Estado de los microservicios ----------
export const getPublicHealth = () => fetch(`${API_URL}/health`, { credentials: 'omit' })
  .then(response => response.json())
  .catch(() => null);
export const getServicesStatus = () => request('/admin/services');
export const setServiceState = (name, action) => request(`/admin/services/${encodeURIComponent(name)}/${action}`, { method: 'POST' });

// ---------- Sesión ----------
export const login = (document, password, role) => request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ document, password, role }),
});

export const verifyMfa = (mfaToken, code) => request('/auth/mfa/verify', {
  method: 'POST',
  body: JSON.stringify({ mfaToken, code }),
});

export const logoutRequest = () => request('/auth/logout', { method: 'POST' });

export const getMfaStatus = () => request('/auth/mfa/status');
export const setupMfa = () => request('/auth/mfa/setup', { method: 'POST' });
export const enableMfa = code => request('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) });
export const disableMfa = code => request('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) });
export const getMySessions = () => request('/auth/sessions');

export const forgotPassword = document => request('/auth/password/forgot', {
  method: 'POST',
  body: JSON.stringify({ document }),
});

export const resetPassword = data => request('/auth/password/reset', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const switchRole = role => request('/auth/switch-role', {
  method: 'POST',
  body: JSON.stringify({ role }),
});

export const createAffiliation = data => request('/users/affiliations', {
  method: 'POST',
  captcha: true,
  body: JSON.stringify(data),
});

export const register = data => request('/users/register', {
  method: 'POST',
  captcha: true,
  body: JSON.stringify(data),
});

// ---------- Citas y agenda médica ----------
export const getSpecialties = () => request('/healthcare/specialties');

export const getDoctors = specialty => request(`/healthcare/doctors?${query({ specialty })}`);

export const getAvailability = ({ specialty, doctorId, from, days = 14, document, excludeAppointmentId, modality }) => request(
  `/healthcare/availability?${query({ specialty, doctorId, from, days, document, excludeAppointmentId, modality })}`,
);

export const rescheduleAppointment = data => request('/healthcare/appointments/reschedule', {
  method: 'POST',
  body: JSON.stringify(data),
});

// ---------- Incapacidades / ausencias del médico ----------
export const getDoctorAbsences = doctorId => request(`/healthcare/doctor/absences?${query({ doctorId })}`);

export const createDoctorAbsence = data => request('/healthcare/doctor/absences', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const cancelDoctorAbsence = id => request('/healthcare/doctor/absences', {
  method: 'PATCH',
  body: JSON.stringify({ id }),
});

// ---------- Historia clínica ----------
export const getClinicalHistory = patientId => request(`/healthcare/clinical-history?${query({ patientId })}`);

export const getMyClinicalHistory = () => request('/healthcare/clinical-history/mine');

export const saveClinicalBackground = data => request('/healthcare/clinical-history/background', {
  method: 'PUT',
  body: JSON.stringify(data),
});

// ---------- Notificaciones ----------
export const getMyNotifications = () => request('/notifications/notifications/mine');

export const getAllNotifications = () => request('/notifications/notifications');

export const createAppointment = data => request('/healthcare/appointments', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const getMyAppointments = () => request('/healthcare/appointments/mine');

export const attendAppointment = data => request('/healthcare/appointments/attend', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const updateAppointmentStatus = (id, status) => request(`/healthcare/appointments?id=${encodeURIComponent(id)}`, {
  method: 'PATCH',
  body: JSON.stringify({ status }),
});

export const getDoctorAgenda = ({ date, days, doctorId } = {}) => request(
  `/healthcare/doctor/agenda?${query({ date, days, doctorId })}`,
);

export const getDoctorSchedule = doctorId => request(`/healthcare/doctor/schedule?${query({ doctorId })}`);

export const saveDoctorSchedule = data => request('/healthcare/doctor/schedule', {
  method: 'PUT',
  body: JSON.stringify(data),
});

export const getAdminDoctors = () => request('/healthcare/doctors/admin');

export const lookupPerson = document => request(`/users/staff/lookup?${query({ document })}`);

export const createDoctor = data => request('/users/staff/doctors', {
  method: 'POST',
  body: JSON.stringify(data),
});

// ---------- PQRS, perfil y administración ----------
export const createPqrs = data => request('/pqrs/requests', {
  method: 'POST',
  captcha: true,
  body: JSON.stringify(data),
});

export const getMyPqrs = () => request('/pqrs/requests/mine');

export const getPqrsQueue = (status = 'open') => request(`/pqrs/requests/queue?${query({ status })}`);

export const updatePqrs = (id, data) => request(`/pqrs/requests?id=${encodeURIComponent(id)}`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});

// Perfil completo: requiere sesión (solo el propio o un administrador).
export const getProfile = value => request(`/users/profile${value ? `?document=${encodeURIComponent(value)}` : ''}`);

// Consulta pública: solo estado y régimen, sin datos personales.
export const getAffiliationStatus = document => request(`/users/affiliation-status?${query({ document })}`, { captcha: true });

export const getClinicalAudit = params => request(`/healthcare/audit?${query(params || {})}`);

export const getStaffOverview = () => request('/users/staff/overview');

export const getRoleUsers = () => request('/users/staff/users');

export const updateUserRoles = (userId, roles) => request('/users/staff/roles', {
  method: 'PUT',
  body: JSON.stringify({ userId, roles }),
});

export const updateProfile = data => request('/users/profile', {
  method: 'PATCH',
  body: JSON.stringify(data),
});

export const getAuthorizations = (document, number) => request(`/healthcare/authorizations?${query({ document, number })}`, { captcha: true });

export const getAuthorizationCatalog = () => request('/healthcare/authorizations/catalog');

export const getMyAuthorizations = () => request('/healthcare/authorizations/mine');

export const getAuthorizationQueue = (status = 'requested') => request(`/healthcare/authorizations/queue?${query({ status })}`);

export const decideAuthorization = (id, decision, notes, provider) => request(`/healthcare/authorizations?id=${encodeURIComponent(id)}`, {
  method: 'PATCH',
  body: JSON.stringify({ decision, notes, provider }),
});

export const createAuthorization = data => request('/healthcare/authorizations', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const getPqrsById = (id, document) => request(`/pqrs/requests?${query({ id, document })}`, { captcha: true });

// ---------- Medicamentos y laboratorio ----------
export const getPrescriptions = (document, prescriptionNumber) => request(
  `/meds-labs/prescriptions?document=${encodeURIComponent(document)}&prescriptionNumber=${encodeURIComponent(prescriptionNumber)}`,
  { captcha: true },
);

export const getPharmacyCatalog = () => request('/meds-labs/catalog');

export const getMyPrescriptions = () => request('/meds-labs/prescriptions/mine');

export const getPrescriptionQueue = (status = 'pending') => request(`/meds-labs/prescriptions/queue?${query({ status })}`);

export const createPrescription = data => request('/meds-labs/prescriptions', {
  method: 'POST',
  body: JSON.stringify(data),
});

export const updatePrescriptionStatus = (formulaNumber, status, deliveryPoint) => request(`/meds-labs/prescriptions?formula=${encodeURIComponent(formulaNumber)}`, {
  method: 'PATCH',
  body: JSON.stringify({ status, deliveryPoint }),
});

export const getLabResults = (document, orderNumber) => request(
  `/meds-labs/lab-results?document=${encodeURIComponent(document)}&orderNumber=${encodeURIComponent(orderNumber)}`,
  { captcha: true },
);

export const getMyLabResults = () => request('/meds-labs/lab-results/mine');

export const getLabWorklist = (status = 'processing') => request(`/meds-labs/lab-results/worklist?${query({ status })}`);

export const saveLabDocument = data => request('/meds-labs/lab-results/document', {
  method: 'PUT',
  body: JSON.stringify(data),
});
