// Re-export server types for client use
import { AuthenticatorTransportFuture } from '@simplewebauthn/browser';

export interface RegistrationOptionsRequest {}

export interface RegistrationOptionsResponse {
  rp: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  challenge: string;
  pubKeyCredParams: Array<{
    alg: number;
    type: 'public-key';
  }>;
  timeout: number;
  excludeCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransportFuture[];
  }>;
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification: 'required' | 'preferred' | 'discouraged';
    residentKey?: 'discouraged' | 'preferred' | 'required';
  };
  attestation: 'none' | 'indirect' | 'direct' | 'enterprise';
}

export interface RegistrationVerifyRequest {
  attestation: any; // RegistrationResponseJSON from @simplewebauthn/browser
  challenge: string;
}

export interface RegistrationVerifyResponse {
  ok: true;
  credentialId: string;
}

export interface AuthenticationOptionsRequest {
  credentialIdHint?: string;
}

export interface AuthenticationOptionsResponse {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials?: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransportFuture[];
  }>;
  userVerification: 'required' | 'preferred' | 'discouraged';
}

export interface AuthenticationVerifyRequest {
  assertion: any; // AuthenticationResponseJSON from @simplewebauthn/browser
  challenge: string;
}

export interface AuthenticationVerifyResponse {
  ok: true;
  credentialId: string;
  newCounter: number;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
