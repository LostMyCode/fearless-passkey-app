# Passkey Authentication App

Invite-gated passkey (WebAuthn) registration and authentication built with AWS SAM + Lambda + DynamoDB.

## Prerequisites

- Node.js 20.x
- AWS CLI configured
- AWS SAM CLI installed
- OpenSSL

## Local Development

1. **Install dependencies**: `cd server && yarn install`

2. **Create `server/env.json`** with variables for each function:
   ```json
   {
     "RegistrationOptionsFunction": {
       "RP_ID": "localhost",
       "RP_NAME": "Passkey Demo",
       "ORIGIN": "http://localhost:3000",
       "DDB_TABLE_NAME": "passkeys",
       "JWT_PUBLIC_KEY": "<public-key-pem>",
       "JWT_PRIVATE_KEY": "<private-key-pem>",
       "JWT_EXPIRY": "28800",
       "AUTH_CODES_TABLE": "passkey-codes",
       "INVITES_TABLE": "passkey-invites",
       "LOGIN_PAGE_TITLE": "Sign In"
     }
   }
   ```

3. **Start local API**: `cd server && sam local start-api --env-vars env.json`

## Deployment

1. Generate keys: `bash server/scripts/generate-keys.sh`
2. Edit `server/scripts/deploy.sh` to set your stack name, region, domain, SSM path, and optionally `GOOGLE_CLIENT_ID`
3. Deploy: `bash server/scripts/deploy.sh`

## Invite Flow

Registration is invite-only. Generate a link via CLI:

```bash
aws lambda invoke \
  --function-name <stack-name>-CreateInvite \
  --payload '{"expiresInHours": 24}' \
  response.json && cat response.json
```

## Google Federated Login

Google login is available as a fallback for devices that don't support passkeys. It is **not enabled by default** — it requires both server-side and gateway-side configuration.

### 1. Server setup

Set `GOOGLE_CLIENT_ID` in `deploy.sh` with your Google OAuth 2.0 Client ID and deploy. No client secret is needed — the server verifies Google ID tokens directly.

### 2. Allow Google accounts

Only pre-approved accounts can log in. Register them via CLI:

```bash
aws lambda invoke \
  --function-name <stack-name>-AddFederatedAccount \
  --payload '{"provider": "google", "email": "user@example.com"}' \
  response.json && cat response.json
```

### 3. Gateway setup

Add `federatedProviders: ['google']` to your gateway config. This causes the login page to show the Google sign-in button alongside the passkey option.

```typescript
const cfg = resolveConfig({
  passkeyApiBase: env.PASSKEY_API_BASE,
  publicKey: env.PASSKEY_PUBLIC_KEY,
  protectedPaths: ['/admin'],
  federatedProviders: ['google'],
});
```

Then pass `cfg.federatedProviders` when building the login URL:

```typescript
buildLoginUrl(cfg.passkeyApiBase, callbackUrl, pathname, cfg.federatedProviders);
```

## Gateway

The `gateway/` package protects routes by validating JWT cookies and redirecting unauthenticated users to `/auth/login`. See [gateway/README.md](gateway/README.md) for integration recipes.

## Security Notes

- HTTPS required in production for WebAuthn
- Private key is stored in SSM Parameter Store (SecureString)
- Invite tokens and auth codes are single-use with TTL
- Google federated login requires accounts to be pre-approved in the FederatedAccounts table
