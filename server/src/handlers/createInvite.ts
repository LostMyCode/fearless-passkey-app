import { getConfig } from '../lib/env';
import { createInviteToken } from '../lib/invite';

interface CreateInviteEvent {
  expiresInHours?: number;
}

interface CreateInviteResult {
  url: string;
  token: string;
  expiresAt: string;
}

/**
 * Generate a one-time invite link for passkey registration.
 * Invoked directly via AWS CLI — not exposed via API Gateway.
 *
 * Usage:
 *   aws lambda invoke \
 *     --function-name fearless-passkey-app-CreateInvite \
 *     --payload '{"expiresInHours": 24}' \
 *     response.json && cat response.json
 */
export async function handler(event: CreateInviteEvent): Promise<CreateInviteResult> {
  const config = getConfig();
  const expiresInHours = event.expiresInHours ?? 24;

  const { token, expiresAt } = await createInviteToken(expiresInHours);

  return {
    url: `${config.origin}/register?token=${token}`,
    token,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  };
}
