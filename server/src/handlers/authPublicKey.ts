import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getConfig } from '../lib/env';
import { handleError } from '../lib/responses';
/**
 * Return the RS256 public key PEM
 * GET /auth/public-key
 *
 * Public key is not secret — CORS is open (*) so any platform can fetch it
 * programmatically during setup without needing an origin allowlist.
 */
export async function handler(
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {

  try {
    const config = getConfig();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/x-pem-file',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400' // public key rarely changes
      },
      body: config.jwtPublicKey
    };

  } catch (error) {
    return handleError(error, 'auth_public_key');
  }
}
