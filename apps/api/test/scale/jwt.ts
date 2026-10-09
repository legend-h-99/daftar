/**
 * Minimal HS256 JWT signer for scale-test tooling only.
 *
 * We deliberately don't pull in `jsonwebtoken` as a direct dependency just to
 * mint a handful of test tokens locally — HS256 signing is three lines of
 * `crypto`, and this mirrors exactly what `passport-jwt` / `@nestjs/jwt`
 * verify on the other end (see apps/api/src/auth/jwt.strategy.ts).
 *
 * NEVER use this for anything user-facing; it has no expiry handling beyond
 * a plain `exp` claim and no `jti`, so revocation (plan 005) is bypassed —
 * fine for hitting a local dev API with synthetic scale-test data only.
 */
import { createHmac } from 'node:crypto';

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface ScaleJwtPayload {
  sub: string; // userId
  phone?: string | null;
  businessId: string | null;
  exp: number;
}

export function signScaleJwt(
  payload: Omit<ScaleJwtPayload, 'exp'>,
  secret: string,
  ttlSeconds = 3600,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload: ScaleJwtPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(fullPayload));
  const signature = base64url(
    createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest(),
  );
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
