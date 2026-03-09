import type { FederatedProvider, GatewayConfig, ResolvedGatewayConfig } from './types.js';

const DEFAULTS = {
  callbackPath: '/__auth/cb',
  cookieName: 'psk_token',
  cookieMaxAge: 28800, // 8 hours
  federatedProviders: [] as FederatedProvider[],
  providersSecret: '',
} as const;

/**
 * Resolve a `GatewayConfig` by filling in default values for optional fields.
 *
 * Call this once at startup rather than on every request.
 *
 * @example
 * const config = resolveConfig({
 *   passkeyApiBase: env.PASSKEY_API_BASE,
 *   publicKey: env.PASSKEY_PUBLIC_KEY,
 *   protectedPaths: ['/admin', '/dashboard'],
 * });
 */
export function resolveConfig(config: GatewayConfig): ResolvedGatewayConfig {
  return { ...DEFAULTS, ...config };
}

/**
 * Return true if `pathname` starts with any of the configured protected prefixes.
 *
 * @example
 * isProtectedPath('/admin/users', ['/admin', '/dashboard']) // true
 * isProtectedPath('/public', ['/admin', '/dashboard'])      // false
 */
export function isProtectedPath(pathname: string, protectedPaths: string[]): boolean {
  return protectedPaths.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Build the full URL that the login page will redirect back to after
 * a successful passkey authentication.
 *
 * When `federatedProviders` is non-empty, the `providers` query parameter
 * is HMAC-signed with `providersSecret` so the server can verify the
 * gateway actually authorised these providers.  This prevents users from
 * enabling providers by manually editing the URL.
 *
 * @param passkeyApiBase - AWS API Gateway base URL.
 * @param callbackUrl    - Absolute URL of the callback endpoint on your platform
 *                         (e.g. `https://app.example.com/__auth/cb`).
 * @param destination    - The original pathname the user was trying to reach
 *                         (e.g. `/dashboard`). Passed through to the callback
 *                         so the user can be redirected there after sign-in.
 * @param federatedProviders - Optional list of providers to allow.
 * @param providersSecret    - HMAC secret shared with the passkey server.
 *                             Required when `federatedProviders` is non-empty.
 */
export async function buildLoginUrl(
  passkeyApiBase: string,
  callbackUrl: string,
  destination: string,
  federatedProviders?: string[],
  providersSecret?: string,
): Promise<string> {
  const url = new URL(`${passkeyApiBase}/auth/login`);
  url.searchParams.set('redirect', callbackUrl);
  url.searchParams.set('destination', destination);
  if (federatedProviders && federatedProviders.length > 0) {
    const providers = federatedProviders.join(',');
    url.searchParams.set('providers', providers);

    if (providersSecret) {
      const sig = await hmacSign(`providers=${providers}&redirect=${callbackUrl}`, providersSecret);
      url.searchParams.set('providers_sig', sig);
    }
  }
  return url.toString();
}

/**
 * Compute HMAC-SHA256 using the Web Crypto API (works in Workers, Node ≥ 18, Deno, Bun).
 */
async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
