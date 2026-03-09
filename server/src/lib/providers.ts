import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify the HMAC-SHA256 signature on the `providers` query parameter.
 *
 * The gateway signs `providers={providers}&redirect={redirect}` using a
 * shared secret. This function recomputes the HMAC and performs a
 * timing-safe comparison to prevent users from forging the signature.
 *
 * @returns The list of verified providers, or an empty array if the
 *          signature is missing / invalid / secret is not configured.
 */
export function verifyProvidersSig(
  providers: string,
  redirect: string,
  signature: string,
  secret: string,
): string[] {
  if (!secret || !signature || !providers) {
    return [];
  }

  const data = `providers=${providers}&redirect=${redirect}`;
  const expected = createHmac('sha256', secret).update(data).digest('hex');

  // Timing-safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return [];
  }

  return providers.split(',').map(p => p.trim()).filter(Boolean);
}
