import {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/server';

// Request/Response types for API endpoints
export interface RegistrationOptionsRequest {}

export interface RegistrationOptionsResponse extends PublicKeyCredentialCreationOptionsJSON {}

export interface RegistrationVerifyRequest {
  attestation: RegistrationResponseJSON;
  challenge: string;
}

export interface RegistrationVerifyResponse {
  ok: true;
  credentialId: string;
}

export interface AuthenticationOptionsRequest {
  credentialIdHint?: string;
}

export interface AuthenticationOptionsResponse extends PublicKeyCredentialRequestOptionsJSON {}

export interface AuthenticationVerifyRequest {
  assertion: AuthenticationResponseJSON;
  challenge: string;
}

export interface AuthenticationVerifyResponse {
  ok: true;
  credentialId: string;
  newCounter: number;
}

// DynamoDB model
export interface PasskeyCredential {
  credentialId: string;      // Primary key - base64url encoded
  publicKey: string;         // base64url encoded public key
  counter: number;           // Signature counter to prevent replay attacks
  transports: string[];      // How the authenticator communicates ['usb', 'nfc', 'ble', 'internal']
  backedUp: boolean;         // Whether credential is backed up (affects UX warnings)
  deviceType: 'singleDevice' | 'multiDevice';  // Single device (like TouchID) vs multi-device (like 1Password)
  userHandle: string;        // Random UUID - required by WebAuthn spec but not used for lookup
  createdAt: string;         // ISO timestamp
  updatedAt: string;         // ISO timestamp
}

// Error response format
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
