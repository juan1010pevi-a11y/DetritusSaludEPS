import { useState } from 'react';
import { digitsOnly, documentError, phoneError } from '../../lib/validators';
import './FormFields.css';

/**
 * Campos de formulario con validación incorporada. Funcionan tanto controlados
 * (value + onChange) como dentro de formularios que leen FormData.
 * - Filtran lo que se escribe (por ejemplo, el documento solo acepta números).
 * - Usan setCustomValidity para que el navegador muestre el mensaje al enviar.
 */

function applyValidity(input, message) {
  input.setCustomValidity(message || '');
}

/** Contraseña oculta por defecto, con botón para mostrarla mientras se escribe. */
export function PasswordInput({ id, className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={`password-field ${className}`}>
      <input id={id} type={visible ? 'text' : 'password'} spellCheck="false" autoCapitalize="off" {...props} />
      <button
        type="button"
        className="password-field__toggle"
        onClick={() => setVisible(value => !value)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        aria-controls={id}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {!visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  );
}

/** Número de documento: solo dígitos (5 a 12). Con documentType="PA" acepta letras. */
export function DocumentInput({ documentType = 'CC', onChange, ...props }) {
  const passport = documentType === 'PA';
  const handle = event => {
    const input = event.target;
    const value = passport ? input.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 12) : digitsOnly(input.value, 12);
    if (input.value !== value) input.value = value;
    applyValidity(input, value ? documentError(value, documentType) : '');
    onChange?.(event);
  };
  return (
    <input
      type="text"
      inputMode={passport ? 'text' : 'numeric'}
      autoComplete="off"
      placeholder="Ej. 1020304050"
      title={passport ? 'Entre 5 y 12 letras o números' : 'Solo números, entre 5 y 12 dígitos, sin puntos ni espacios'}
      onChange={handle}
      onBlur={event => applyValidity(event.target, event.target.value ? documentError(event.target.value, documentType) : '')}
      {...props}
    />
  );
}

/** Celular colombiano: 10 dígitos que empiezan por 3. */
export function PhoneInput({ onChange, required, ...props }) {
  const handle = event => {
    const input = event.target;
    const value = digitsOnly(input.value, 10);
    if (input.value !== value) input.value = value;
    applyValidity(input, value ? phoneError(value) : '');
    onChange?.(event);
  };
  return (
    <input
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder="3001234567"
      title="10 dígitos que empiezan por 3"
      required={required}
      onChange={handle}
      {...props}
    />
  );
}

/** Campo solo numérico genérico (NIT, teléfono fijo, ingresos, códigos…). */
export function DigitsInput({ maxLength = 12, minLength, label = 'Este campo', onChange, ...props }) {
  const handle = event => {
    const input = event.target;
    const value = digitsOnly(input.value, maxLength);
    if (input.value !== value) input.value = value;
    const tooShort = minLength && value && value.length < minLength;
    applyValidity(input, tooShort ? `${label} debe tener al menos ${minLength} dígitos.` : '');
    onChange?.(event);
  };
  // Sin maxLength nativo: al pegar "300 123 4567" el navegador cortaría antes de quitar los espacios.
  return <input type="text" inputMode="numeric" autoComplete="off" title="Solo números" onChange={handle} {...props} />;
}

/** Lista de requisitos de la contraseña que se va marcando mientras se escribe. */
export function PasswordHints({ value = '' }) {
  const rules = [
    [value.length >= 8, 'Mínimo 8 caracteres'],
    [/[A-Za-z]/.test(value), 'Al menos una letra'],
    [/\d/.test(value), 'Al menos un número'],
  ];
  return (
    <ul className="password-hints" aria-live="polite">
      {rules.map(([ok, text]) => <li key={text} className={ok ? 'is-ok' : ''}>{ok ? '✓' : '•'} {text}</li>)}
    </ul>
  );
}
