# Passkey Authentication App

A complete passkey (WebAuthn) registration and authentication system built with AWS SAM, AWS Lambda + Vite/Preact/TypeScript + Mantine.

## Prerequisites

- Node.js 20.x
- AWS CLI configured
- AWS SAM CLI installed
- Modern browser with WebAuthn support

## Quick Start

1. **Install dependencies**:
   ```bash
   # Server
   cd server && npm install

   # Client
   cd ../client && npm install
   ```

2. **Set environment variables**:
   ```bash
   # For local development
   export RP_ID=localhost
   export RP_NAME="Passkey Demo"
   export ORIGIN=http://localhost:5173
   export DDB_TABLE_NAME=Passkeys
   ```

3. **Start local development**:
   ```bash
   # Terminal 1: Start local API
   cd server
   sam local start-api --env-vars env.json

   # Terminal 2: Start frontend
   cd client
   npm run dev
   ```

4. **Access the app**: http://localhost:5173

## Deployment

1. **Build and deploy**:
   ```bash
   cd server
   sam build
   sam deploy --guided
   ```

2. **Update client config**:
   ```bash
   cd client
   echo "VITE_API_BASE_URL=https://your-api-id.execute-api.region.amazonaws.com" > .env
   npm run build
   ```

## Security Notes

- **HTTPS required** in production for WebAuthn
- **RP_ID must match** your domain (use `localhost` for local dev)
- **ORIGIN must match** your frontend URL exactly
- **Counter validation** prevents replay attacks from cloned authenticators
- **CORS** is restricted to configured origin only
