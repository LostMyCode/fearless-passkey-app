import { randomUUID } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { getConfig } from './env';

const client = new DynamoDBClient({});
const ddbDoc = DynamoDBDocumentClient.from(client);

interface InviteToken {
  token: string;
  issuedAt: string;
  expiresAt: number;  // Unix timestamp (TTL)
  used: boolean;
}

export async function createInviteToken(expiresInHours: number): Promise<{ token: string; expiresAt: number }> {
  const config = getConfig();
  const token = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + expiresInHours * 3600;

  await ddbDoc.send(new PutCommand({
    TableName: config.invitesTable,
    Item: { token, issuedAt: new Date().toISOString(), expiresAt, used: false } satisfies InviteToken
  }));

  console.log(JSON.stringify({ action: 'invite_created', expiresAt }));
  return { token, expiresAt };
}

export async function validateInviteToken(token: string): Promise<boolean> {
  const config = getConfig();
  const now = Math.floor(Date.now() / 1000);

  const result = await ddbDoc.send(new GetCommand({
    TableName: config.invitesTable,
    Key: { token }
  }));

  const item = result.Item as InviteToken | undefined;
  if (!item || item.used || item.expiresAt < now) return false;
  return true;
}

export async function consumeInviteToken(token: string): Promise<boolean> {
  const config = getConfig();
  const now = Math.floor(Date.now() / 1000);

  try {
    await ddbDoc.send(new UpdateCommand({
      TableName: config.invitesTable,
      Key: { token },
      UpdateExpression: 'SET #used = :true',
      ConditionExpression: 'attribute_exists(#token) AND #used = :false AND #expiresAt > :now',
      ExpressionAttributeNames: { '#used': 'used', '#token': 'token', '#expiresAt': 'expiresAt' },
      ExpressionAttributeValues: { ':true': true, ':false': false, ':now': now }
    }));

    console.log(JSON.stringify({ action: 'invite_consumed', token }));
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return false;
    }
    throw error;
  }
}
