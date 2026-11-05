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

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
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
  if (response.status === 503) {
    throw new ApiError(`El microservicio ${path.split('/')[1]} no está activo. Reinicia el backend con npm start dentro de la carpeta backend.`, 503, data);
  }
  if (!response.ok) {
    // Si el servidor rechaza el token, la sesión se cierra en toda la aplicación.
    if (response.status === 401 && token) window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError(data?.error || `API error: ${response.status}`, response.status, data);
  }
  return data;
}

const query = params => new URLSearchParams(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
).toString();

export const getNews = () => request('/content/news');

export const getDashboardSummary = () => Promise.all([
  request('/healthcare/appointments/mine'),
  request('/pqrs/requests/mine'),
  request('/healthcare/authorizations/mine'),
]).then(([appointments, pqrs, authorizations]) => ({
  appointments: appointments.items || [],
  pqrs: pqrs.items || [],
  authorizations: authorizations.items || [],
}));

// ---------- Sesión ----------
export const login = (document, password, role) => request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ document, password, role }),
});

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
  body: JSON.stringify(data),
});

export const register = data => request('/users/register', {
  method: 'POST',
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
  body: JSON.stringify(data),
});

export const getMyPqrs = () => request('/pqrs/requests/mine');

export const getPqrsQueue = (status = 'open') => request(`/pqrs/requests/queue?${query({ status })}`);

export const updatePqrs = (id, data) => request(`/pqrs/requests?id=${encodeURIComponent(id)}`, {
  method: 'PATCH',
  body: JSON.stringify(data),
});

export const getProfile = value => request(`/users/profile?document=${encodeURIComponent(value)}`);

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

export const getAuthorizations = (document, number) => request(`/healthcare/authorizations?${query({ document, number })}`);

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

export const getPqrsById = (id, document) => request(`/pqrs/requests?${query({ id, document })}`);

// ---------- Medicamentos y laboratorio ----------
export const getPrescriptions = (document, prescriptionNumber) => request(
  `/meds-labs/prescriptions?document=${encodeURIComponent(document)}&prescriptionNumber=${encodeURIComponent(prescriptionNumber)}`,
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
);

export const getMyLabResults = () => request('/meds-labs/lab-results/mine');

export const getLabWorklist = (status = 'processing') => request(`/meds-labs/lab-results/worklist?${query({ status })}`);

export const saveLabDocument = data => request('/meds-labs/lab-results/document', {
  method: 'PUT',
  body: JSON.stringify(data),
});
