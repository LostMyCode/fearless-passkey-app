/**
 * Exchange a one-time auth code for a signed JWT.
 *
 * Call this inside your platform's auth-callback handler after the user
 * is redirected back from the passkey login page with `?code=<uuid>`.
 *
 * The code is validated server-side (TTL 60 s, single-use, atomic) and
 * consumed atomically. A second call with the same code will always return
 * `null`.
 *
 * @param code           - The UUID received in the callback query string.
 * @param passkeyApiBase - Base URL of the AWS passkey API (no trailing slash).
 * @returns The signed JWT string on success, or `null` if the code is
 *          invalid, expired, or has already been used.
 */
export async function exchangeCode(
  code: string,
  passkeyApiBase: string,
): Promise<string | null> {
  let response: Response;

  try {
    response = await fetch(`${passkeyApiBase}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  } catch {
    // Network error — treat as invalid
    return null;
  }

  if (!response.ok) return null;

  try {
    const body = await response.json() as { token?: string };
    return typeof body.token === 'string' ? body.token : null;
  } catch {
    return null;
  }
}
