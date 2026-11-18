// CAPTCHA invisible (hCaptcha) para los formularios públicos: consultas con documento,
// radicar PQRSD, registro y afiliación. Solo se activa si se define VITE_HCAPTCHA_SITEKEY
// (y en el backend CAPTCHA_SECRET). Sin esa variable no se carga nada.
const SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITEKEY || '';
const SCRIPT_URL = 'https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off';

export const captchaEnabled = () => Boolean(SITE_KEY);

let ready = null;
let widgetId = null;

function load() {
  ready ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const container = document.createElement('div');
      container.style.display = 'none';
      document.body.appendChild(container);
      widgetId = window.hcaptcha.render(container, { sitekey: SITE_KEY, size: 'invisible' });
      resolve();
    };
    script.onerror = () => { ready = null; reject(new Error('No se pudo cargar la verificación anti-robots.')); };
    document.head.appendChild(script);
  });
  return ready;
}

/** Devuelve un token de un solo uso, o null si el CAPTCHA no está configurado. */
export async function getCaptchaToken() {
  if (!SITE_KEY) return null;
  await load();
  window.hcaptcha.reset(widgetId);
  const { response } = await window.hcaptcha.execute(widgetId, { async: true });
  return response;
}
