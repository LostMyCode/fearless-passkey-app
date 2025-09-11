import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  PutCommandInput,
  GetCommandInput,
  UpdateCommandInput
} from '@aws-sdk/lib-dynamodb';
import { PasskeyCredential } from '../types';
import { getConfig } from './env';

const client = new DynamoDBClient({});
const ddbDoc = DynamoDBDocumentClient.from(client);

/**
 * Store a new passkey credential in DynamoDB
 * Uses the credentialId as the primary key for efficient lookup during authentication
 */
export async function putCredential(credential: PasskeyCredential): Promise<void> {
  const config = getConfig();

  const input: PutCommandInput = {
    TableName: config.ddbTableName,
    Item: credential,
    // Prevent overwriting existing credentials (safety check)
    ConditionExpression: 'attribute_not_exists(credentialId)'
  };

  try {
    await ddbDoc.send(new PutCommand(input));
    console.log(JSON.stringify({
      action: 'credential_stored',
      credentialId: credential.credentialId,
      deviceType: credential.deviceType,
      backedUp: credential.backedUp
    }));
  } catch (error) {
    console.error(JSON.stringify({
      action: 'credential_store_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      credentialId: credential.credentialId
    }));
    throw error;
  }
}

/**
 * Retrieve a credential by its ID for authentication
 * This is the main lookup method during sign-in
 */
export async function getCredential(credentialId: string): Promise<PasskeyCredential | null> {
  const config = getConfig();

  const input: GetCommandInput = {
    TableName: config.ddbTableName,
    Key: { credentialId }
  };

  try {
    const result = await ddbDoc.send(new GetCommand(input));
    return result.Item as PasskeyCredential || null;
  } catch (error) {
    console.error(JSON.stringify({
      action: 'credential_lookup_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      credentialId
    }));
    throw error;
  }
}

/**
 * Update the signature counter after successful authentication
 * This prevents replay attacks from cloned authenticators
 * Uses conditional update to ensure counter only increases
 */
export async function updateCredentialCounter(
  credentialId: string,
  newCounter: number,
  currentCounter: number
): Promise<void> {
  const config = getConfig();

  const input: UpdateCommandInput = {
    TableName: config.ddbTableName,
    Key: { credentialId },
    UpdateExpression: 'SET #counter = :newCounter, updatedAt = :updatedAt',
    ConditionExpression: '#counter = :currentCounter', // Optimistic concurrency control
    ExpressionAttributeNames: {
      '#counter': 'counter'
    },
    ExpressionAttributeValues: {
      ':newCounter': newCounter,
      ':currentCounter': currentCounter,
      ':updatedAt': new Date().toISOString()
    }
  };

  try {
    await ddbDoc.send(new UpdateCommand(input));
    console.log(JSON.stringify({
      action: 'counter_updated',
      credentialId,
      oldCounter: currentCounter,
      newCounter
    }));
  } catch (error) {
    console.error(JSON.stringify({
      action: 'counter_update_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      credentialId,
      currentCounter,
      newCounter
    }));
    throw error;
  }
}
