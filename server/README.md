# Passkey Server

AWS SAM-based serverless API for WebAuthn passkey registration and authentication.

## Architecture

- **4 Lambda Functions**: Registration options/verify, Authentication options/verify
- **API Gateway HTTP API**: RESTful endpoints with CORS
- **DynamoDB**: Single table storing credentials by ID
- **IAM**: Minimal permissions for DDB access only

## Environment Variables

- `RP_ID`: Relying Party ID (domain, use `localhost` for dev)
- `RP_NAME`: Human readable app name
- `ORIGIN`: Frontend URL for CORS (must match exactly)
- `DDB_TABLE_NAME`: DynamoDB table name

## Local Development

```bash
npm install
sam local start-api --env-vars env.json
```

## Deployment

```bash
sam build
sam deploy --guided
```

## Testing

```bash
# Registration flow
curl -X POST http://localhost:3000/webauthn/registration/options \
  -H "Content-Type: application/json"

curl -X POST http://localhost:3000/webauthn/registration/verify \
  -H "Content-Type: application/json" \
  -d '{"attestation": {...}}'

# Authentication flow
curl -X POST http://localhost:3000/webauthn/authentication/options \
  -H "Content-Type: application/json"

curl -X POST http://localhost:3000/webauthn/authentication/verify \
  -H "Content-Type: application/json" \
  -d '{"assertion": {...}}'
```

## Security Notes

- Counter validation prevents replay attacks
- Conditional DDB writes prevent race conditions
- CORS restricted to configured origin
- No sensitive data in logs
- HTTPS required in production

```