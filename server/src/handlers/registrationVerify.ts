import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getConfig } from '../lib/env';
import { successResponse, errorResponse, handleError } from '../lib/responses';
import { handleOptions } from '../lib/cors';
import { putCredential } from '../lib/ddb';
import { createCredential } from '../lib/models';
import { RegistrationVerifyRequest, RegistrationVerifyResponse } from '../types';

/**
 * Verify WebAuthn registration response and store the credential
 * This completes the passkey registration process
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

    const requestData: RegistrationVerifyRequest = JSON.parse(event.body);

    if (!requestData.attestation) {
      return errorResponse('MISSING_ATTESTATION', 'Attestation response is required');
    }

    console.log(JSON.stringify({
      action: 'registration_verify_requested',
      credentialId: requestData.attestation.id,
      type: requestData.attestation.type
    }));

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response: requestData.attestation,
      expectedOrigin: config.origin,
      expectedRPID: config.rpId,
      expectedChallenge: requestData.challenge
    });

    if (!verification.verified || !verification.registrationInfo) {
      console.log(JSON.stringify({
        action: 'registration_verification_failed',
        credentialId: requestData.attestation.id,
        verified: verification.verified
      }));

      return errorResponse(
        'VERIFICATION_FAILED',
        'Failed to verify registration response'
      );
    }

    const credentialId: string = verification.registrationInfo.credential.id;
    const credentialPublicKey = verification.registrationInfo.credential.publicKey;
    const counter = verification.registrationInfo.credential.counter;

    // Create and store the credential
    const credential = createCredential({
      credentialId,
      publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter,
      transports: requestData.attestation.response.transports || [],
      backedUp: verification.registrationInfo.credentialBackedUp,
      deviceType: verification.registrationInfo.credentialDeviceType
    });

    await putCredential(credential);

    const response: RegistrationVerifyResponse = {
      ok: true,
      credentialId: credential.credentialId
    };

    console.log(JSON.stringify({
      action: 'registration_completed',
      credentialId: credential.credentialId,
      deviceType: credential.deviceType,
      backedUp: credential.backedUp,
      transports: credential.transports
    }));

    return successResponse(response);

  } catch (error) {
    return handleError(error, 'registration_verify');
  }
}
