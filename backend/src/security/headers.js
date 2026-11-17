/**
 * Cabeceras de seguridad HTTP (equivalente a lo que hace "helmet" en Express) para las
 * respuestas del API Gateway. Las del frontend las pone Nginx (ver nginx/default.conf).
 */
export function securityHeaders(res, { https = false } = {}) {
  if (https) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // La API solo devuelve JSON o documentos: no necesita ejecutar scripts ni ser enmarcada.
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  // Las respuestas tienen datos personales: ningún navegador ni proxy debe guardarlas.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}

/** Cabeceras que un microservicio nunca debe devolver al navegador. */
export const HIDDEN_UPSTREAM_HEADERS = ['x-powered-by', 'server'];
