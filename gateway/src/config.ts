import type { GatewayConfig, ResolvedGatewayConfig } from './types.js';

const DEFAULTS = {
  callbackPath: '/__auth/cb',
  cookieName: 'psk_token',
  cookieMaxAge: 28800, // 8 hours
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
 * @param passkeyApiBase - AWS API Gateway base URL.
 * @param callbackUrl    - Absolute URL of the callback endpoint on your platform
 *                         (e.g. `https://app.example.com/__auth/cb`).
 * @param destination    - The original pathname the user was trying to reach
 *                         (e.g. `/dashboard`). Passed through to the callback
 *                         so the user can be redirected there after sign-in.
 */
export function buildLoginUrl(
  passkeyApiBase: string,
  callbackUrl: string,
  destination: string,
): string {
  const url = new URL(`${passkeyApiBase}/auth/login`);
  url.searchParams.set('redirect', callbackUrl);
  url.searchParams.set('destination', destination);
  return url.toString();
}
