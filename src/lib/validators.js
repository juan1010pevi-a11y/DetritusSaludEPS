// Reglas de validación compartidas por el frontend y el backend.
// IMPORTANTE: backend/src/validators.js es una copia exacta de este archivo
// (una prueba automática verifica que sean iguales). Si cambias uno, copia el otro.

export const DOCUMENT_TYPE_LABELS = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  TI: 'Tarjeta de identidad',
  RC: 'Registro civil',
  PA: 'Pasaporte',
  PPT: 'Permiso por protección temporal',
};

/** Deja solo dígitos y corta a `max` caracteres (para inputs numéricos). */
export function digitsOnly(value, max = 20) {
  return String(value ?? '').replace(/\D/g, '').slice(0, max);
}

/**
 * Documento de identidad: solo números (5 a 12 dígitos, sin empezar en 0).
 * El pasaporte admite letras y números.
 */
export function documentError(value, type = 'CC') {
  const text = String(value ?? '').trim();
  if (!text) return 'Escribe el número de documento.';
  if (type === 'PA') {
    return /^[A-Za-z0-9]{5,12}$/.test(text) ? null : 'El pasaporte debe tener entre 5 y 12 letras o números, sin espacios.';
  }
  if (!/^\d+$/.test(text)) return 'El número de documento solo puede tener números (sin puntos, comas ni espacios).';
  if (text.length < 5 || text.length > 12) return 'El número de documento debe tener entre 5 y 12 dígitos.';
  if (text.startsWith('0')) return 'El número de documento no puede empezar por 0.';
  if (/^(\d)\1+$/.test(text)) return 'El número de documento no es válido.';
  return null;
}

export const isValidDocument = (value, type) => documentError(value, type) === null;

/** Celular colombiano: 10 dígitos que empiezan por 3. Acepta +57 al inicio. */
export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
}

export function phoneError(value, { required = true } = {}) {
  const phone = normalizePhone(value);
  if (!phone) return required ? 'Escribe tu número de celular.' : null;
  return /^3\d{9}$/.test(phone) ? null : 'El celular debe tener 10 dígitos y empezar por 3 (ej. 3001234567).';
}

export function emailError(value, { required = true } = {}) {
  const email = String(value ?? '').trim();
  if (!email) return required ? 'Escribe tu correo electrónico.' : null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) ? null : 'Escribe un correo electrónico válido (ej. nombre@correo.com).';
}

export function nameError(value) {
  const name = String(value ?? '').trim();
  if (name.length < 3) return 'Escribe el nombre completo.';
  return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/.test(name) ? null : 'El nombre solo puede tener letras y espacios.';
}

/** Contraseña: mínimo 8 caracteres, con letras y números. */
export function passwordError(value) {
  const password = String(value ?? '');
  if (password.length < 8) return 'La contraseña debe tener mínimo 8 caracteres.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'La contraseña debe combinar letras y números.';
  return null;
}

/** Código de verificación de 6 dígitos (recuperar contraseña). */
export function codeError(value) {
  return /^\d{6}$/.test(String(value ?? '').trim()) ? null : 'El código tiene 6 dígitos.';
}

/** Número entero o decimal dentro de un rango (signos vitales, cantidades…). */
export function numberInRangeError(value, { min, max, label, integer = false, required = false }) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return required ? `${label} es obligatorio.` : null;
  if (!/^\d+(\.\d+)?$/.test(text)) return `${label} debe ser un número.`;
  const number = Number(text);
  if (integer && !Number.isInteger(number)) return `${label} debe ser un número entero.`;
  if (number < min || number > max) return `${label} debe estar entre ${min} y ${max}.`;
  return null;
}

/** Tensión arterial con formato sistólica/diastólica, ej. 120/80. */
export function bloodPressureError(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = /^(\d{2,3})\/(\d{2,3})$/.exec(text);
  if (!match) return 'La tensión arterial se escribe como 120/80.';
  const [systolic, diastolic] = [Number(match[1]), Number(match[2])];
  if (systolic < 60 || systolic > 260 || diastolic < 30 || diastolic > 160 || diastolic >= systolic) {
    return 'La tensión arterial no es válida.';
  }
  return null;
}

/** Oculta parte de un correo o celular para mostrarlo sin exponerlo completo. */
export function maskContact(value) {
  const text = String(value ?? '');
  if (!text) return '';
  if (text.includes('@')) {
    const [user, domain] = text.split('@');
    return `${user.slice(0, 2)}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
  }
  const digits = text.replace(/\D/g, '');
  return `${'*'.repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}
