#!/bin/bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
STACK_NAME="my-passkey-app"
AWS_REGION="us-east-1"
RP_ID="example.com"
RP_NAME="My App"
ORIGIN="https://example.com"
SSM_PARAM_NAME="/myapp/jwt-private-key"
GOOGLE_CLIENT_ID=""  # Google OAuth 2.0 Client ID (leave empty to disable Google login)
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYS_DIR="$SCRIPT_DIR/../keys"
PRIVATE_KEY="$KEYS_DIR/private.pem"
PUBLIC_KEY="$KEYS_DIR/public.pem"
SERVER_DIR="$SCRIPT_DIR/.."

# Check prerequisites
if ! command -v sam &>/dev/null; then
  echo "Error: AWS SAM CLI is not installed." >&2
  exit 1
fi
if ! command -v aws &>/dev/null; then
  echo "Error: AWS CLI is not installed." >&2
  exit 1
fi
if [[ ! -f "$PRIVATE_KEY" ]]; then
  echo "Error: $PRIVATE_KEY not found. Run scripts/generate-keys.sh first." >&2
  exit 1
fi
if [[ ! -f "$PUBLIC_KEY" ]]; then
  echo "Error: $PUBLIC_KEY not found. Run scripts/generate-keys.sh first." >&2
  exit 1
fi

# Upload private key to SSM Parameter Store
echo "Uploading private key to SSM: $SSM_PARAM_NAME"
aws ssm put-parameter \
  --name "$SSM_PARAM_NAME" \
  --value "$(cat "$PRIVATE_KEY")" \
  --type SecureString \
  --overwrite \
  --region "$AWS_REGION"
echo "SSM upload complete."

# Build
echo ""
echo "Building..."
cd "$SERVER_DIR"
sam build

# Deploy
echo ""
echo "Deploying stack: $STACK_NAME"
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-confirm-changeset \
  --parameter-overrides \
    "RpId=$RP_ID" \
    "RpName=$RP_NAME" \
    "Origin=$ORIGIN" \
    "JwtPrivateKeyParam=$SSM_PARAM_NAME" \
    "JwtPublicKey=$(cat "$PUBLIC_KEY")" \
    "GoogleClientId=$GOOGLE_CLIENT_ID"

echo ""
echo "Deploy complete."
echo ""
echo "Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs" \
  --output table
