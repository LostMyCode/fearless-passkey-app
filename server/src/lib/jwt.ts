import { createSign, createVerify } from 'crypto';

interface JWTPayload {
  sub: string;       // credentialId
  iat: number;
  exp: number;
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(input: string): Buffer {
  // Restore standard base64 padding
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + padding, 'base64');
}

export function signJWT(payload: JWTPayload, privateKeyPem: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(privateKeyPem);

  return `${signingInput}.${base64url(signature)}`;
}

export function verifyJWT(token: string, publicKeyPem: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signature = base64urlDecode(encodedSignature);

    const verifier = createVerify('RSA-SHA256');
    verifier.update(signingInput);
    const isValid = verifier.verify(publicKeyPem, signature);

    if (!isValid) {
      return null;
    }

    const payloadJson = base64urlDecode(encodedPayload).toString('utf8');
    const payload: JWTPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
