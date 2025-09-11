import { v4 as uuidv4 } from 'uuid';
import { PasskeyCredential } from '../types';

/**
 * Create a new PasskeyCredential model from WebAuthn registration data
 * Includes all required fields for security and UX features
 */
export function createCredential(data: {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  backedUp: boolean;
  deviceType: 'singleDevice' | 'multiDevice';
}): PasskeyCredential {
  const now = new Date().toISOString();

  return {
    credentialId: data.credentialId,
    publicKey: data.publicKey,
    counter: data.counter,
    transports: data.transports,
    backedUp: data.backedUp,
    deviceType: data.deviceType,
    userHandle: uuidv4(), // Random UUID - required by WebAuthn but not used for our lookup
    createdAt: now,
    updatedAt: now
  };
}
