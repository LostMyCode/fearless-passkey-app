/**
 * @fearless-sdk/gateway
 *
 * Platform-agnostic primitives for integrating with the passkey authentication
 * gateway. Import these helpers into any JavaScript/TypeScript runtime that
 * supports the Web Crypto API (Cloudflare Workers, Node.js ≥ 18, Deno, Bun,
 * Google Cloud Functions, AWS Lambda, browsers, …).
 *
 * See README.md for complete integration recipes per platform.
 */

export type { GatewayConfig, ResolvedGatewayConfig, JWTPayload, FederatedProvider } from './types.js';

export { verifyJWT } from './jwt.js';
export { exchangeCode } from './exchange.js';
export { parseCookie, buildSetCookie, buildClearCookie } from './cookie.js';
export { resolveConfig, isProtectedPath, buildLoginUrl } from './config.js';
