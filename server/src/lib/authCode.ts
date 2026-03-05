import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { getConfig } from './env';

const client = new DynamoDBClient({});
const ddbDoc = DynamoDBDocumentClient.from(client);

interface AuthCode {
  code: string;        // UUID v4
  credentialId: string;
  issuedAt: string;    // ISO timestamp
  expiresAt: number;   // Unix timestamp (TTL) - 60 seconds from now
  used: boolean;
}

/**
 * Generate a one-time auth code for a credential and store it in DynamoDB.
 * TTL is set to 60 seconds from now.
 */
export async function generateAuthCode(credentialId: string): Promise<string> {
  const config = getConfig();
  const code = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 60;

  const item: AuthCode = {
    code,
    credentialId,
    issuedAt: new Date().toISOString(),
    expiresAt,
    used: false
  };

  await ddbDoc.send(new PutCommand({
    TableName: config.authCodesTable,
    Item: item
  }));

  console.log(JSON.stringify({
    action: 'auth_code_generated',
    credentialId,
    expiresAt
  }));

  return code;
}

/**
 * Consume a one-time auth code, atomically marking it as used.
 * Returns the credentialId if valid, or null if not found / already used / expired.
 */
export async function consumeAuthCode(code: string): Promise<string | null> {
  const config = getConfig();
  const now = Math.floor(Date.now() / 1000);

  try {
    // Use conditional update to atomically mark as used (prevents race conditions)
    const result = await ddbDoc.send(new UpdateCommand({
      TableName: config.authCodesTable,
      Key: { code },
      UpdateExpression: 'SET #used = :true',
      ConditionExpression: 'attribute_exists(#code) AND #used = :false AND #expiresAt > :now',
      ExpressionAttributeNames: {
        '#used': 'used',
        '#code': 'code',
        '#expiresAt': 'expiresAt'
      },
      ExpressionAttributeValues: {
        ':true': true,
        ':false': false,
        ':now': now
      },
      ReturnValues: 'ALL_NEW'
    }));

    const item = result.Attributes as AuthCode | undefined;
    if (!item) {
      return null;
    }

    console.log(JSON.stringify({
      action: 'auth_code_consumed',
      credentialId: item.credentialId
    }));

    return item.credentialId;
  } catch (error) {
    // ConditionalCheckFailedException means code not found, already used, or expired
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      console.log(JSON.stringify({
        action: 'auth_code_invalid',
        reason: 'not_found_used_or_expired',
        code
      }));
      return null;
    }
    throw error;
  }
}
