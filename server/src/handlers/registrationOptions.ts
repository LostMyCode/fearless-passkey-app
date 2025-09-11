import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getConfig } from '../lib/env';
import { successResponse, handleError } from '../lib/responses';
import { handleOptions } from '../lib/cors';
import { RegistrationOptionsRequest, RegistrationOptionsResponse } from '../types';

/**
 * Generate WebAuthn registration options
 * This is the first step in passkey registration - provides challenge and other params
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

    // Parse request (currently empty but typed for future extensibility)
    let requestData: RegistrationOptionsRequest = {};
    if (event.body) {
      requestData = JSON.parse(event.body);
    }

    console.log(JSON.stringify({
      action: 'registration_options_requested',
      rpId: config.rpId,
      origin: config.origin
    }));

    // Generate registration options using simplewebauthn
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpId,
      // Generate a random user ID - not used for lookup in our passwordless model
      userID: crypto.getRandomValues(new Uint8Array(32)),
      userName: 'user', // Placeholder - not displayed in passwordless flow
      userDisplayName: 'User', // Placeholder - not displayed

      // Prefer authenticators that can be backed up (like 1Password, iCloud Keychain)
      // but allow platform authenticators too (TouchID, Windows Hello)
      attestationType: 'none', // Don't require attestation for privacy

      // Exclude credentials we already have (none for first registration)
      excludeCredentials: [],

      // Authenticator selection criteria
      authenticatorSelection: {
        // Allow both platform (TouchID) and cross-platform (1Password) authenticators
        authenticatorAttachment: undefined,
        // Require user verification (PIN, biometric, etc)
        userVerification: 'preferred',
        // Allow discoverable credentials for better UX
        residentKey: 'preferred'
      }
    });

    const response: RegistrationOptionsResponse = options;

    console.log(JSON.stringify({
      action: 'registration_options_generated',
      challengeLength: options.challenge.length,
      rpId: options.rp.id
    }));

    return successResponse(response);

  } catch (error) {
    return handleError(error, 'registration_options');
  }
}
