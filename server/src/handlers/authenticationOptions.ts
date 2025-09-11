import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthenticatorTransportFuture, generateAuthenticationOptions } from '@simplewebauthn/server';
import { getConfig } from '../lib/env';
import { successResponse, handleError } from '../lib/responses';
import { handleOptions } from '../lib/cors';
import { getCredential } from '../lib/ddb';
import { AuthenticationOptionsRequest, AuthenticationOptionsResponse } from '../types';

/**
 * Generate WebAuthn authentication options
 * This is the first step in passkey authentication - provides challenge
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  try {
    const config = getConfig();

    // Parse request
    let requestData: AuthenticationOptionsRequest = {};
    if (event.body) {
      requestData = JSON.parse(event.body);
    }

    console.log(JSON.stringify({
      action: 'authentication_options_requested',
      hasCredentialHint: !!requestData.credentialIdHint
    }));

    // Build allowed credentials list
    const allowCredentials: Array<{
      id: string;
      type: 'public-key';
      transports?: AuthenticatorTransportFuture[];
    }> = [];

    // If a specific credential was hinted, include it with transport info for better UX
    if (requestData.credentialIdHint) {
      const credential = await getCredential(requestData.credentialIdHint);
      if (credential) {
        allowCredentials.push({
          id: credential.credentialId,
          type: 'public-key',
          transports: credential.transports as any[] // Transport types from stored credential
        });
      }
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: config.rpId,
      // If no specific credential hinted, allow any registered credential
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'preferred', // Prefer user verification but don't require it
      timeout: 60000 // 60 second timeout
    });

    const response: AuthenticationOptionsResponse = options;

    console.log(JSON.stringify({
      action: 'authentication_options_generated',
      challengeLength: options.challenge.length,
      allowedCredentials: allowCredentials.length
    }));

    return successResponse(response);

  } catch (error) {
    return handleError(error, 'authentication_options');
  }
}
