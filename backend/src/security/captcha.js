import { HttpError } from '../service.js';

/**
 * CAPTCHA para formularios públicos (lo verifica el API Gateway antes de reenviar la petición) (consultas con documento, radicar PQRSD, registro).
 * Se activa solo si se define CAPTCHA_SECRET (hCaptcha por defecto; con
 * CAPTCHA_PROVIDER=recaptcha usa Google reCAPTCHA). El navegador envía el token en la
 * cabecera x-captcha-token. Sin CAPTCHA_SECRET (desarrollo, pruebas) no se exige.
 */
const VERIFY_URLS = {
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
};

export const captchaEnabled = () => Boolean(process.env.CAPTCHA_SECRET);

export async function requireCaptcha(req) {
  if (!captchaEnabled()) return true;
  const token = String(req.headers['x-captcha-token'] || '');
  if (!token || token.length > 4096) throw new HttpError(400, 'Confirma que no eres un robot (CAPTCHA).');
  const provider = process.env.CAPTCHA_PROVIDER === 'recaptcha' ? 'recaptcha' : 'hcaptcha';
  const body = new URLSearchParams({ secret: process.env.CAPTCHA_SECRET, response: token });
  if (req.headers['x-client-ip']) body.set('remoteip', String(req.headers['x-client-ip']));
  let result;
  try {
    const response = await fetch(VERIFY_URLS[provider], { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    result = await response.json();
  } catch {
    throw new HttpError(503, 'No se pudo verificar el CAPTCHA. Intenta de nuevo.');
  }
  if (!result?.success) throw new HttpError(400, 'La verificación CAPTCHA no fue válida. Intenta de nuevo.');
  return true;
}
