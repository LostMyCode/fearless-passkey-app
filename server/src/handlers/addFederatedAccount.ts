import { addFederatedAccount } from '../lib/federatedAccount';

interface AddFederatedAccountEvent {
  provider: string;  // "google"
  email: string;     // "user@example.com"
}

interface AddFederatedAccountResult {
  providerSubject: string;
  email: string;
  createdAt: string;
}

/**
 * Register a federated account as allowed for login.
 * Invoked directly via AWS CLI - not exposed via API Gateway.
 *
 * Usage:
 *   aws lambda invoke \
 *     --function-name <stack-name>-AddFederatedAccount \
 *     --payload '{"provider": "google", "email": "user@example.com"}' \
 *     response.json && cat response.json
 */
export async function handler(
  event: AddFederatedAccountEvent,
): Promise<AddFederatedAccountResult> {
  if (!event.provider || !event.email) {
    throw new Error('Both "provider" and "email" are required');
  }

  const supportedProviders = ['google'];
  if (!supportedProviders.includes(event.provider)) {
    throw new Error(`Unsupported provider: ${event.provider}. Supported: ${supportedProviders.join(', ')}`);
  }

  const account = await addFederatedAccount(event.provider, event.email);

  return {
    providerSubject: account.providerSubject,
    email: account.email,
    createdAt: account.createdAt,
  };
}
