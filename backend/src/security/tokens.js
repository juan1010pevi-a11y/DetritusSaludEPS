import crypto from 'node:crypto';

/**
 * JSON Web Tokens (RFC 7519) firmados con HMAC-SHA256 (HS256), implementados con node:crypto
 * para no agregar dependencias. Se valida: algoritmo fijo (evita el ataque "alg: none"),
 * firma en tiempo constante, emisor (iss), audiencia (aud), vencimiento (exp) y nbf.
 */

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const CLOCK_SKEW_SECONDS = 30;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

export function signJwt(claims, { secret, issuer, audience, expiresInSeconds }) {
  const iat = nowSeconds();
  const payload = {
    ...claims,
    iss: issuer,
    aud: audience,
    iat,
    nbf: iat - 1,
    exp: iat + expiresInSeconds,
    jti: claims.jti || crypto.randomUUID(),
  };
  const body = `${HEADER}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  return `${body}.${sign(body, secret)}`;
}

/** Devuelve las claims si el token es válido; si no, null. */
export function verifyJwt(token, { secret, issuer, audience }) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  try {
    const decodedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT') return null;
    const expected = Buffer.from(sign(`${header}.${payload}`, secret));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = nowSeconds();
    if (issuer && claims.iss !== issuer) return null;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (audience && !audiences.includes(audience)) return null;
    if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) return null;
    if (typeof claims.nbf === 'number' && claims.nbf - CLOCK_SKEW_SECONDS > now) return null;
    return claims;
  } catch {
    return null;
  }
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Comparación en tiempo constante de dos textos (evita ataques de tiempo). */
export function safeEqualText(a, b) {
  const left = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const right = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(left, right) && String(a ?? '') === String(b ?? '');
}
