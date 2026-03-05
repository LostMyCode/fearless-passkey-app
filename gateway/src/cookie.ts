/**
 * Parse a single cookie value from a `Cookie` request header string.
 *
 * @param cookieHeader - The raw value of the `Cookie` header.
 * @param name         - The cookie name to look up.
 * @returns The decoded cookie value, or `null` if not found.
 */
export function parseCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }

  return null;
}

/**
 * Build a `Set-Cookie` header value for the gateway JWT.
 *
 * The cookie is always:
 *   - **HttpOnly** — inaccessible to JavaScript
 *   - **Secure**   — HTTPS only
 *   - **SameSite=Lax** — sent on same-site navigations and top-level GET requests
 *   - **Path=/**   — valid for the entire origin
 *
 * @param name    - Cookie name.
 * @param value   - JWT string to store.
 * @param maxAge  - Lifetime in seconds (should match server-side `JWT_EXPIRY`).
 * @returns A complete `Set-Cookie` header value ready to be assigned to the
 *          `Set-Cookie` response header.
 */
export function buildSetCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`;
}

/**
 * Build a `Set-Cookie` header value that immediately expires the gateway cookie,
 * effectively signing the user out.
 *
 * @param name - Cookie name (must match the one used in `buildSetCookie`).
 */
export function buildClearCookie(name: string): string {
  return `${name}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`;
}
