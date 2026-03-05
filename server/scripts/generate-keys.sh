#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYS_DIR="$SCRIPT_DIR/../keys"

mkdir -p "$KEYS_DIR"

PRIVATE_KEY="$KEYS_DIR/private.pem"
PUBLIC_KEY="$KEYS_DIR/public.pem"

if [[ -f "$PRIVATE_KEY" ]]; then
  echo "keys/private.pem already exists. Delete it first if you want to regenerate."
  exit 1
fi

echo "Generating RSA 2048 key pair..."
openssl genrsa -out "$PRIVATE_KEY" 2048
openssl rsa -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY"
chmod 600 "$PRIVATE_KEY"

echo ""
echo "Generated:"
echo "  Private key: $PRIVATE_KEY"
echo "  Public key:  $PUBLIC_KEY"
echo ""
echo "Next: run scripts/deploy.sh to upload the private key to SSM and deploy."
