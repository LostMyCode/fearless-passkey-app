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
2. Edit `server/scripts/deploy.sh` to set your stack name, region, domain, and SSM path
3. Deploy: `bash server/scripts/deploy.sh`

## Invite Flow

Registration is invite-only. Generate a link via CLI:

```bash
aws lambda invoke \
  --function-name <stack-name>-CreateInvite \
  --payload '{"expiresInHours": 24}' \
  response.json && cat response.json
```

## Gateway

The `gateway/` package protects routes by validating JWT cookies and redirecting unauthenticated users to `/auth/login`. See [gateway/README.md](gateway/README.md) for integration recipes.

## Security Notes

- HTTPS required in production for WebAuthn
- Private key is stored in SSM Parameter Store (SecureString)
- Invite tokens and auth codes are single-use with TTL
