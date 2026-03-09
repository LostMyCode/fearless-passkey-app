import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { OAuth2Client } from 'google-auth-library';
import { getConfig } from '../lib/env';
import { successResponse, errorResponse, handleError } from '../lib/responses';
import { handleOptions } from '../lib/cors';
import { getFederatedAccount } from '../lib/federatedAccount';
import { generateAuthCode } from '../lib/authCode';

/**
 * Verify a Google ID token and issue a one-time auth code.
 * POST /auth/google/verify
 * Body: { idToken: string }
 * Response: { ok: true, code: string }
 */
export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {

  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  try {
    const config = getConfig();

    // Enforce server-side provider restriction.
    // Even if GOOGLE_CLIENT_ID is configured, reject requests
    // unless 'google' is explicitly listed in ALLOWED_PROVIDERS.
    if (!config.allowedProviders.includes('google')) {
      console.log(JSON.stringify({
        action: 'google_verify_denied',
        reason: 'provider_not_allowed',
      }));
      return errorResponse('PROVIDER_NOT_ALLOWED', 'Google login is not allowed', 403);
    }

    const googleClientId = config.googleClientId;

    if (!googleClientId) {
      return errorResponse('GOOGLE_NOT_CONFIGURED', 'Google login is not configured', 500);
    }

    if (!event.body) {
      return errorResponse('MISSING_BODY', 'Request body is required');
    }

    const { idToken } = JSON.parse(event.body) as { idToken?: string };

    if (!idToken) {
      return errorResponse('MISSING_ID_TOKEN', 'Google ID token is required');
    }

    // Verify the Google ID token
    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return errorResponse('INVALID_TOKEN', 'Google token is invalid or email not verified', 401);
    }

    const email = payload.email;

    // Check if the email is in the allowed federated accounts
    const account = await getFederatedAccount('google', email);
    if (!account) {
      console.log(JSON.stringify({
        action: 'google_verify_denied',
        email,
        reason: 'not_in_allowed_list',
      }));
      return errorResponse('ACCOUNT_NOT_ALLOWED', 'This Google account is not authorized', 403);
    }

    // Generate a one-time auth code using the federated subject as the identity
    const subject = `google:${email}`;
    const code = await generateAuthCode(subject);

    console.log(JSON.stringify({
      action: 'google_verify_success',
      email,
      subject,
    }));

    return successResponse({ ok: true, code });

  } catch (error) {
    return handleError(error, 'google_verify');
  }
}
