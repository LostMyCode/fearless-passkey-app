import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { getConfig } from './env';

const client = new DynamoDBClient({});
const ddbDoc = DynamoDBDocumentClient.from(client);

export interface FederatedAccount {
  providerSubject: string;  // "google:<email>"
  provider: string;         // "google"
  email: string;
  createdAt: string;        // ISO timestamp
}

/**
 * Register a federated account as allowed.
 * Called by the AddFederatedAccount CLI Lambda.
 */
export async function addFederatedAccount(
  provider: string,
  email: string,
): Promise<FederatedAccount> {
  const config = getConfig();
  const providerSubject = `${provider}:${email}`;

  const item: FederatedAccount = {
    providerSubject,
    provider,
    email,
    createdAt: new Date().toISOString(),
  };

  await ddbDoc.send(new PutCommand({
    TableName: config.federatedAccountsTable,
    Item: item,
  }));

  console.log(JSON.stringify({
    action: 'federated_account_added',
    providerSubject,
  }));

  return item;
}

/**
 * Look up whether a federated account is allowed.
 * Returns the account record or null if not found.
 */
export async function getFederatedAccount(
  provider: string,
  email: string,
): Promise<FederatedAccount | null> {
  const config = getConfig();
  const providerSubject = `${provider}:${email}`;

  const result = await ddbDoc.send(new GetCommand({
    TableName: config.federatedAccountsTable,
    Key: { providerSubject },
  }));

  return (result.Item as FederatedAccount) ?? null;
}
