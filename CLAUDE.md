# CLAUDE.md

## Project Overview

Fearless Passkey App — an invite-only, passwordless authentication system built on WebAuthn/passkeys. Two-package monorepo: an AWS Lambda backend (`server/`) and a platform-agnostic client middleware SDK (`gateway/`).

## Repository Structure

```
server/              # AWS SAM backend (Lambda + DynamoDB + API Gateway)
  src/handlers/      # 10+ Lambda function handlers
  src/lib/           # Shared utilities (DDB, JWT, CORS, env, etc.)
  scripts/           # Deployment & key generation scripts
  template.yaml      # AWS SAM infrastructure-as-code
gateway/             # Published NPM package (@fearless-sdk/gateway)
  src/               # 6 source files, zero runtime dependencies
```

## Tech Stack

- **Language:** TypeScript 5.2+ (strict mode), targeting ES2022
- **Server runtime:** Node.js 20.x on AWS Lambda
- **Gateway runtime:** Node.js 18+ / Web Crypto API (browser-compatible)
- **Infrastructure:** AWS SAM (API Gateway HTTP API, DynamoDB, SSM Parameter Store)
- **Auth:** `@simplewebauthn/server` for WebAuthn ceremonies, custom RS256 JWT
- **Package manager:** Yarn (both packages)

## Common Commands

### Server

```bash
cd server
yarn install              # Install dependencies
yarn build                # tsc — compile TypeScript
yarn test                 # jest — run tests
yarn dev                  # sam local start-api --env-vars env.json
```

### Gateway

```bash
cd gateway
yarn install
yarn build                # tsc — compile TypeScript
yarn type-check           # tsc --noEmit
```

### Deployment

```bash
bash server/scripts/generate-keys.sh   # Generate RSA 2048 key pair → server/keys/
bash server/scripts/deploy.sh           # Upload private key to SSM, sam build + deploy
```

## Architecture

### Authentication Flow

1. User visits protected app → gateway checks JWT cookie
2. Missing/invalid JWT → redirect to `/auth/login` (Lambda-served HTML)
3. WebAuthn ceremony (passkey registration or authentication)
4. Server generates single-use auth code (60s TTL, stored in DynamoDB)
5. Redirect to `/__auth/cb?code=<uuid>` on the protected app
6. Gateway exchanges code for JWT via `POST /auth/exchange`
7. JWT set as HttpOnly/Secure/SameSite=Lax cookie
8. Subsequent requests verified locally with RS256 public key

### Key Lambda Handlers (`server/src/handlers/`)

| Handler | Purpose |
|---|---|
| `registrationOptions.ts` | Generate WebAuthn registration challenge |
| `registrationVerify.ts` | Verify registration, store credential |
| `authenticationOptions.ts` | Generate WebAuthn auth challenge |
| `authenticationVerify.ts` | Verify auth response, issue one-time code |
| `authExchange.ts` | Exchange code for signed JWT |
| `authPublicKey.ts` | Serve JWT public key (public endpoint) |
| `authLogin.ts` / `registerPage.ts` | Render HTML login/register pages |
| `createInvite.ts` | Generate invite tokens (CLI-invoked) |
| `addFederatedAccount.ts` | Pre-approve Google accounts (CLI-invoked) |
| `googleVerify.ts` | Verify Google ID tokens |

### Gateway SDK (`gateway/src/`)

ESM-only package (`"type": "module"`, NodeNext module resolution). Zero runtime dependencies — uses Web Crypto API for JWT verification.

Exports: `resolveConfig`, `isProtectedPath`, `buildLoginUrl`, `verifyJWT`, `exchangeCode`, cookie utilities, and types (`GatewayConfig`, `JWTPayload`).

## DynamoDB Tables

| Table | Partition Key | Purpose |
|---|---|---|
| PasskeysTable | `credentialId` | WebAuthn credentials (public key, counter, device type) |
| InvitesTable | `token` | Single-use invite tokens with TTL |
| CodesTable | `code` | Single-use auth codes (60s TTL) |
| FederatedAccountsTable | `providerSubject` | Pre-approved Google accounts |

## Coding Conventions

- **Handlers** are one-per-file in `server/src/handlers/`, named by feature (camelCase)
- **Lib modules** in `server/src/lib/` are small, focused utilities
- **Interfaces/types** use PascalCase, co-located in `types.ts` per package
- **Constants** use UPPER_SNAKE_CASE
- **Exported functions** use camelCase
- **Error handling:** structured JSON logging (`console.log` with objects), DynamoDB conditional expressions for atomicity, `ConditionalCheckFailedException` handling for race conditions
- **Server uses CommonJS** (`module: "CommonJS"` in tsconfig); **gateway uses ESM** (`module: "NodeNext"`)
- Gateway has stricter tsconfig including `exactOptionalPropertyTypes`

## Security Considerations

- Private JWT key lives in AWS SSM Parameter Store (SecureString), never in code or env files
- `server/keys/` is gitignored — never commit private keys
- `server/env.json` is gitignored — contains local dev secrets
- All tokens (invites, auth codes) are single-use with TTL enforcement
- Signature counter validation prevents cloned authenticator attacks
- CORS restricted to configured origin per handler
- DynamoDB conditional writes ensure atomicity (no double-spend on codes/invites)

## Environment Variables

Key env vars for the server (see `server/env.json` for local dev):

| Variable | Description |
|---|---|
| `RP_ID` | WebAuthn Relying Party ID (e.g., `localhost`) |
| `RP_NAME` | Display name for WebAuthn prompts |
| `ORIGIN` | Allowed CORS origin |
| `DDB_TABLE_NAME` | Passkeys DynamoDB table |
| `AUTH_CODES_TABLE` | Auth codes DynamoDB table |
| `INVITES_TABLE` | Invites DynamoDB table |
| `JWT_PUBLIC_KEY` | PEM-encoded RS256 public key |
| `JWT_EXPIRY` | JWT lifetime in seconds (default: 28800 = 8h) |
| `GOOGLE_CLIENT_ID` | Optional, enables Google federated login |
