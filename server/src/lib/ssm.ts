import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const client = new SSMClient({});
let cachedPrivateKey: string | undefined;

/**
 * Get the JWT private key.
 * - Local dev: reads JWT_PRIVATE_KEY env var directly (set via env.json)
 * - Production: fetches from SSM Parameter Store using JWT_PRIVATE_KEY_PARAM
 */
export async function getPrivateKey(): Promise<string> {
  const direct = process.env.JWT_PRIVATE_KEY;
  if (direct) return direct;

  if (cachedPrivateKey) return cachedPrivateKey;

  const paramName = process.env.JWT_PRIVATE_KEY_PARAM;
  if (!paramName) {
    throw new Error('Missing JWT_PRIVATE_KEY_PARAM environment variable');
  }

  const result = await client.send(
    new GetParameterCommand({ Name: paramName, WithDecryption: true })
  );

  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter not found: ${paramName}`);
  }

  cachedPrivateKey = value;
  return cachedPrivateKey;
}
