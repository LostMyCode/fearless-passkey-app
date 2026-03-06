# @passkey-gateway/core

Platform-agnostic primitives for the passkey authentication gateway.

## Overview

This package provides the three building blocks needed to protect any path on any platform:

| Function | Purpose |
|---|---|
| `verifyJWT` | Verify an RS256 JWT locally using the public key (no AWS call) |
| `exchangeCode` | Exchange a one-time auth code for a JWT (calls `/auth/exchange`) |
| `parseCookie` / `buildSetCookie` | Read and write the JWT cookie |
| `resolveConfig` | Fill in default values for optional config fields |
| `isProtectedPath` | Check if a pathname matches any protected prefix |
| `buildLoginUrl` | Build the redirect URL to the AWS-hosted login page |

**Runtime requirements:** Any environment with the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
— Cloudflare Workers, Node.js ≥ 18, Deno, Bun, Google Cloud Functions (Node 18+), AWS Lambda (Node 18+), browsers.

---

## Authentication flow

```
1.  User → your-app.com/protected
2.  Middleware: no valid JWT cookie
    → redirect to AWS /auth/login?redirect=<callbackUrl>&destination=/protected
3.  Login page: passkey ceremony (TouchID / FaceID / security key)
4.  Login page: POST /webauthn/authentication/verify → { code: "uuid" }
5.  Login page: redirect to your-app.com/__auth/cb?code=uuid&destination=/protected
6.  Middleware intercepts /__auth/cb
    → exchangeCode(code) → POST /auth/exchange → JWT
    → Set-Cookie: psk_token=<jwt>; HttpOnly; Secure; SameSite=Lax
    → redirect to /protected
7.  Subsequent requests: middleware verifyJWT(cookie) locally → pass through
```

Only step 6 makes a network call to AWS. Every other request is verified
locally with the public key — zero latency overhead on authenticated traffic.

---

## Setup

### 1. Deploy the AWS backend

```bash
cd server
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

sam build
sam deploy --guided \
  --parameter-overrides \
    RpId="your-domain.com" \
    Origin="https://your-app.com" \
    JwtPrivateKey="$(cat private.pem)" \
    JwtPublicKey="$(cat public.pem)"
```

### 2. Fetch your public key

```bash
curl https://<api-id>.execute-api.<region>.amazonaws.com/auth/public-key
```

Store the output — you will paste it into each platform's configuration.

### 3. Register passkeys

Navigate to the client app (or directly to `GET /auth/login`) and register
passkeys for every user who should have access. Only registered credentials
can authenticate.

---

## Platform recipes

Each recipe is complete and self-contained. Copy, fill in the two required
values (`passkeyApiBase` and `publicKey`), and deploy.

---

### Cloudflare Workers

```typescript
// src/index.ts
import {
  resolveConfig, isProtectedPath, buildLoginUrl,
  verifyJWT, exchangeCode,
  parseCookie, buildSetCookie,
} from '../gateway/src/index.js';
import type { GatewayConfig } from '../gateway/src/index.js';

interface Env {
  PASSKEY_API_BASE: string;   // https://<id>.execute-api.<region>.amazonaws.com
  PASSKEY_PUBLIC_KEY: string; // PEM from GET /auth/public-key
  PROTECTED_PATHS: string;    // comma-separated: "/admin,/dashboard"
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cfg = resolveConfig({
      passkeyApiBase: env.PASSKEY_API_BASE,
      publicKey: env.PASSKEY_PUBLIC_KEY,
      protectedPaths: env.PROTECTED_PATHS.split(',').map(p => p.trim()),
    } satisfies GatewayConfig);

    const url = new URL(request.url);

    // ── Auth callback ────────────────────────────────────────────────────────
    if (url.pathname === cfg.callbackPath) {
      const code        = url.searchParams.get('code');
      const destination = url.searchParams.get('destination') ?? '/';
      if (!code) return new Response('Missing code', { status: 400 });

      const token = await exchangeCode(code, cfg.passkeyApiBase);
      if (!token)  return new Response('Invalid or expired code', { status: 401 });

      return new Response(null, {
        status: 302,
        headers: {
          'Location':   destination,
          'Set-Cookie': buildSetCookie(cfg.cookieName, token, cfg.cookieMaxAge),
        },
      });
    }

    // ── Pass through unprotected paths ───────────────────────────────────────
    if (!isProtectedPath(url.pathname, cfg.protectedPaths)) {
      return fetch(request);
    }

    // ── Verify JWT cookie ────────────────────────────────────────────────────
    const token   = parseCookie(request.headers.get('Cookie') ?? '', cfg.cookieName);
    const payload = token ? await verifyJWT(token, cfg.publicKey) : null;
    if (payload) return fetch(request);

    // ── Redirect to login ────────────────────────────────────────────────────
    const callbackUrl = `${url.origin}${cfg.callbackPath}`;
    return Response.redirect(buildLoginUrl(cfg.passkeyApiBase, callbackUrl, url.pathname), 302);
  },
};
```

**wrangler.toml**

```toml
name = "my-app"
main = "src/index.ts"
compatibility_date = "2024-05-29"

[vars]
PASSKEY_API_BASE  = "https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com"
PASSKEY_PUBLIC_KEY = """
-----BEGIN PUBLIC KEY-----
YOUR_PUBLIC_KEY_HERE
-----END PUBLIC KEY-----
"""
PROTECTED_PATHS   = "/admin,/dashboard,/private"
```

---

### Node.js — Express / Fastify / raw http

```typescript
// middleware/passkey.ts
import type { Request, Response, NextFunction } from 'express';
import {
  resolveConfig, isProtectedPath, buildLoginUrl,
  verifyJWT, exchangeCode,
  parseCookie, buildSetCookie,
} from '../gateway/src/index.js';

const cfg = resolveConfig({
  passkeyApiBase: process.env.PASSKEY_API_BASE!,
  publicKey:      process.env.PASSKEY_PUBLIC_KEY!,
  protectedPaths: (process.env.PROTECTED_PATHS ?? '').split(',').map(p => p.trim()),
});

export async function passkeyMiddleware(req: Request, res: Response, next: NextFunction) {
  // ── Auth callback ──────────────────────────────────────────────────────────
  if (req.path === cfg.callbackPath) {
    const { code, destination = '/' } = req.query as Record<string, string>;
    if (!code) return res.status(400).send('Missing code');

    const token = await exchangeCode(code, cfg.passkeyApiBase);
    if (!token)  return res.status(401).send('Invalid or expired code');

    res.setHeader('Set-Cookie', buildSetCookie(cfg.cookieName, token, cfg.cookieMaxAge));
    return res.redirect(302, destination);
  }

  // ── Pass through unprotected paths ─────────────────────────────────────────
  if (!isProtectedPath(req.path, cfg.protectedPaths)) return next();

  // ── Verify JWT cookie ───────────────────────────────────────────────────────
  const token   = parseCookie(req.headers.cookie ?? '', cfg.cookieName);
  const payload = token ? await verifyJWT(token, cfg.publicKey) : null;
  if (payload) return next();

  // ── Redirect to login ───────────────────────────────────────────────────────
  const origin      = `${req.protocol}://${req.get('host')}`;
  const callbackUrl = `${origin}${cfg.callbackPath}`;
  res.redirect(302, buildLoginUrl(cfg.passkeyApiBase, callbackUrl, req.path));
}
```

```typescript
// app.ts
import express from 'express';
import { passkeyMiddleware } from './middleware/passkey.js';

const app = express();
app.use(passkeyMiddleware);
// ... your routes
```

---

### Google Cloud Functions (Node.js 18+)

```typescript
// index.ts
import type { Request, Response } from '@google-cloud/functions-framework';
import {
  resolveConfig, isProtectedPath, buildLoginUrl,
  verifyJWT, exchangeCode,
  parseCookie, buildSetCookie,
} from '../gateway/src/index.js';

const cfg = resolveConfig({
  passkeyApiBase: process.env.PASSKEY_API_BASE!,
  publicKey:      process.env.PASSKEY_PUBLIC_KEY!,
  protectedPaths: ['/protected'],
});

export async function handler(req: Request, res: Response) {
  const pathname = new URL(req.url, `https://${req.headers.host}`).pathname;

  // ── Auth callback ──────────────────────────────────────────────────────────
  if (pathname === cfg.callbackPath) {
    const code        = String(req.query.code ?? '');
    const destination = String(req.query.destination ?? '/');
    if (!code) return res.status(400).send('Missing code');

    const token = await exchangeCode(code, cfg.passkeyApiBase);
    if (!token)  return res.status(401).send('Invalid or expired code');

    res.setHeader('Set-Cookie', buildSetCookie(cfg.cookieName, token, cfg.cookieMaxAge));
    return res.redirect(destination);
  }

  // ── Pass through unprotected paths ─────────────────────────────────────────
  if (!isProtectedPath(pathname, cfg.protectedPaths)) {
    return res.send('ok'); // delegate to your actual handler
  }

  // ── Verify JWT cookie ───────────────────────────────────────────────────────
  const token   = parseCookie(req.headers.cookie ?? '', cfg.cookieName);
  const payload = token ? await verifyJWT(token, cfg.publicKey) : null;
  if (payload) {
    return res.send('authenticated'); // delegate to your actual handler
  }

  // ── Redirect to login ───────────────────────────────────────────────────────
  const origin      = `https://${req.headers.host}`;
  const callbackUrl = `${origin}${cfg.callbackPath}`;
  res.redirect(buildLoginUrl(cfg.passkeyApiBase, callbackUrl, pathname));
}
```

---

### AWS Lambda@Edge (CloudFront)

> **Note:** Use Lambda@Edge (not CloudFront Functions). CloudFront Functions
> lack `fetch()` and full Web Crypto support, which are required for
> `exchangeCode` and `verifyJWT`.

```typescript
// handler.ts  (Node.js 18.x runtime, viewer-request event)
import type { CloudFrontRequestEvent, CloudFrontRequestResult } from 'aws-lambda';
import {
  resolveConfig, isProtectedPath, buildLoginUrl,
  verifyJWT, exchangeCode,
  parseCookie, buildSetCookie,
} from '../gateway/src/index.js';

const cfg = resolveConfig({
  passkeyApiBase: process.env.PASSKEY_API_BASE!,
  publicKey:      process.env.PASSKEY_PUBLIC_KEY!,
  protectedPaths: ['/admin', '/private'],
});

export async function handler(event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> {
  const cf       = event.Records[0].cf;
  const request  = cf.request;
  const pathname = request.uri;
  const host     = request.headers.host[0].value;
  const origin   = `https://${host}`;

  // ── Auth callback ──────────────────────────────────────────────────────────
  if (pathname === cfg.callbackPath) {
    const params      = new URLSearchParams(request.querystring);
    const code        = params.get('code');
    const destination = params.get('destination') ?? '/';
    if (!code) return { status: '400', body: 'Missing code' };

    const token = await exchangeCode(code, cfg.passkeyApiBase);
    if (!token)  return { status: '401', body: 'Invalid or expired code' };

    return {
      status: '302',
      headers: {
        location:    [{ key: 'Location',   value: destination }],
        'set-cookie': [{ key: 'Set-Cookie', value: buildSetCookie(cfg.cookieName, token, cfg.cookieMaxAge) }],
      },
    };
  }

  // ── Pass through unprotected paths ─────────────────────────────────────────
  if (!isProtectedPath(pathname, cfg.protectedPaths)) return request;

  // ── Verify JWT cookie ───────────────────────────────────────────────────────
  const cookieHeader = request.headers.cookie?.[0]?.value ?? '';
  const token        = parseCookie(cookieHeader, cfg.cookieName);
  const payload      = token ? await verifyJWT(token, cfg.publicKey) : null;
  if (payload) return request; // pass through to origin

  // ── Redirect to login ───────────────────────────────────────────────────────
  const callbackUrl = `${origin}${cfg.callbackPath}`;
  return {
    status: '302',
    headers: { location: [{ key: 'Location', value: buildLoginUrl(cfg.passkeyApiBase, callbackUrl, pathname) }] },
  };
}
```

---

## API reference

### `resolveConfig(config: GatewayConfig): ResolvedGatewayConfig`

Fill in defaults for optional fields. Call once at module load time.

| Field | Required | Default | Description |
|---|---|---|---|
| `passkeyApiBase` | yes | — | AWS API Gateway base URL |
| `publicKey` | yes | — | RS256 public key PEM |
| `protectedPaths` | yes | — | Path prefixes to protect |
| `callbackPath` | no | `/__auth/cb` | Auth callback path |
| `cookieName` | no | `psk_token` | JWT cookie name |
| `cookieMaxAge` | no | `28800` | Cookie lifetime (seconds) |
| `federatedProviders` | no | `[]` | Federated providers to show on login (e.g. `['google']`) |

### `verifyJWT(token, publicKeyPem): Promise<JWTPayload | null>`

Verify an RS256 JWT. Returns the decoded payload or `null` (invalid signature, expired, malformed). Never throws.

### `exchangeCode(code, passkeyApiBase): Promise<string | null>`

POST to `/auth/exchange`. Returns the JWT string or `null` (invalid/expired/used code, network error). Never throws.

### `parseCookie(cookieHeader, name): string | null`

Parse a single named cookie from a raw `Cookie` header string.

### `buildSetCookie(name, value, maxAge): string`

Build a `Set-Cookie` header value. Always sets `HttpOnly; Secure; SameSite=Lax; Path=/`.

### `buildClearCookie(name): string`

Build a `Set-Cookie` that immediately expires the cookie (sign-out).

### `isProtectedPath(pathname, protectedPaths): boolean`

Return `true` if `pathname` starts with any entry in `protectedPaths`.

### `buildLoginUrl(passkeyApiBase, callbackUrl, destination, federatedProviders?): string`

Build the full URL to the AWS-hosted login page, with `redirect` and `destination` query params encoded. Pass `federatedProviders` (e.g. `['google']`) to show federated login options on the login page.

---

## Security properties

| Threat | Mitigation |
|---|---|
| JWT forgery | RS256 — private key never leaves AWS |
| Code replay | DynamoDB conditional update — single-use + 60 s TTL |
| Code exposure in logs | Short-lived (60 s); JWT never appears in any URL |
| Token readable by JS | `HttpOnly` cookie |
| CSRF | `SameSite=Lax` cookie |
| Token theft via network | `Secure` cookie (HTTPS only) |
| Cloned authenticator | WebAuthn counter check on the server |
