import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthenticatorTransportFuture, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getConfig } from '../lib/env';
import { successResponse, errorResponse, handleError } from '../lib/responses';
import { handleOptions } from '../lib/cors';
import { getCredential, updateCredentialCounter } from '../lib/ddb';
import { AuthenticationVerifyRequest, AuthenticationVerifyResponse } from '../types';

/**
 * Verify WebAuthn authentication response
 * This completes the passkey sign-in process and updates the counter
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

    if (!event.body) {
      return errorResponse('MISSING_BODY', 'Request body is required');
    }

    const requestData: AuthenticationVerifyRequest = JSON.parse(event.body);

    if (!requestData.assertion) {
      return errorResponse('MISSING_ASSERTION', 'Authentication assertion is required');
    }

    const credentialId = requestData.assertion.id;

    console.log(JSON.stringify({
      action: 'authentication_verify_requested',
      credentialId,
      type: requestData.assertion.type
    }));

    // Look up the credential by ID
    const credential = await getCredential(credentialId);
    if (!credential) {
      console.log(JSON.stringify({
        action: 'authentication_failed',
        reason: 'credential_not_found',
        credentialId
      }));

      return errorResponse(
        'CREDENTIAL_NOT_FOUND',
        'No credential found with the provided ID'
      );
    }

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: requestData.assertion,
      expectedOrigin: config.origin,
      expectedRPID: config.rpId,
      expectedChallenge: requestData.challenge,
      credential: {
        ...credential,
        id: credentialId,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        transports: credential.transports as AuthenticatorTransportFuture[]
      }
    });

    if (!verification.verified || !verification.authenticationInfo) {
      console.log(JSON.stringify({
        action: 'authentication_verification_failed',
        credentialId,
        verified: verification.verified
      }));

      return errorResponse(
        'VERIFICATION_FAILED',
        'Failed to verify authentication response'
      );
    }

    const { newCounter } = verification.authenticationInfo;

    // Per WebAuthn spec, if the sign count is 0, it means the authenticator may not support it.
    // We only enforce counter checks if the stored counter is greater than 0.
    // Apple Passkeys, for example, may always return a counter of 0.
    if (credential.counter > 0) {
      // Security check: counter must increase to prevent replay attacks from cloned authenticators
      if (newCounter <= credential.counter) {
        console.error(JSON.stringify({
          action: 'authentication_failed',
          reason: 'counter_not_increased',
          credentialId,
          storedCounter: credential.counter,
          receivedCounter: newCounter
        }));

        return errorResponse(
          'INVALID_COUNTER',
          'Authentication counter did not increase - possible cloned authenticator'
        );
      }

      // Update the counter in the database only for authenticators that support it
      await updateCredentialCounter(credentialId, newCounter, credential.counter);
    }

    const response: AuthenticationVerifyResponse = {
      ok: true,
      credentialId,
      newCounter
    };

    console.log(JSON.stringify({
      action: 'authentication_completed',
      credentialId,
      oldCounter: credential.counter,
      newCounter,
      deviceType: credential.deviceType
    }));

    return successResponse(response);

  } catch (error) {
    return handleError(error, 'authentication_verify');
  }
}
