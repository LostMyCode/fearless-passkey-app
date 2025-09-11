# Passkey Client

Modern web client for passkey authentication built with Vite + Preact + TypeScript + Mantine.

## Features

- Clean, responsive UI with Mantine components
- Complete WebAuthn registration and authentication flows
- Proper error handling for all WebAuthn edge cases
- TypeScript for type safety
- Development and production API configuration

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
# Update .env with production API URL
echo "VITE_API_BASE_URL=https://your-api.amazonaws.com" > .env

npm run build
```

## Browser Support

Requires a modern browser with WebAuthn support:
- Chrome/Edge 67+
- Firefox 60+
- Safari 14+
- iOS Safari 14+
- Android Chrome 70+

## Environment Variables

- `VITE_API_BASE_URL`: Backend API base URL

## Security Notes

- HTTPS required in production for WebAuthn
- API URL must match server CORS configuration
- No credentials or sensitive data stored in client
