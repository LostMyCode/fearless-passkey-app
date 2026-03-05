import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getConfig } from '../lib/env';
import { successResponse, errorResponse, handleError } from '../lib/responses';
import { handleOptions } from '../lib/cors';
import { consumeAuthCode } from '../lib/authCode';
import { signJWT } from '../lib/jwt';
import { getPrivateKey } from '../lib/ssm';
import { AuthExchangeRequest, AuthExchangeResponse } from '../types';

/**
 * Exchange a one-time auth code for a JWT
 * POST /auth/exchange
 * Body: { code: string }
 * Response: { token: string }
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {

  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  try {
    const config = getConfig();

    if (!event.body) {
      return errorResponse('MISSING_BODY', 'Request body is required');
    }

    const requestData: AuthExchangeRequest = JSON.parse(event.body);

    if (!requestData.code) {
      return errorResponse('MISSING_CODE', 'Auth code is required');
    }

    const credentialId = await consumeAuthCode(requestData.code);

    if (!credentialId) {
      return errorResponse('INVALID_CODE', 'Auth code is invalid, expired, or already used');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: credentialId,
      iat: now,
      exp: now + config.jwtExpiry
    };

    const privateKey = await getPrivateKey();
    const token = signJWT(payload, privateKey);

    console.log(JSON.stringify({
      action: 'jwt_issued',
      credentialId,
      exp: payload.exp
    }));

    const response: AuthExchangeResponse = { token };
    return successResponse(response);

  } catch (error) {
    return handleError(error, 'auth_exchange');
  }
}
