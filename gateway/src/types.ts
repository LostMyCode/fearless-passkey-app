/**
 * Configuration for the passkey gateway middleware.
 * Pass this to the helper functions exported from this package.
 */
export interface GatewayConfig {
  /**
   * Base URL of the deployed AWS passkey API (no trailing slash).
   * @example "https://abc123.execute-api.us-east-1.amazonaws.com"
   */
  passkeyApiBase: string;

  /**
   * RS256 public key PEM string, obtained from GET /auth/public-key.
   * Used to verify JWTs locally without calling AWS on every request.
   */
  publicKey: string;

  /**
   * Path prefixes to protect. Any request whose pathname starts with one
   * of these values will require a valid JWT cookie.
   * @example ["/admin", "/dashboard", "/api/private"]
   */
  protectedPaths: string[];

  /**
   * Path where the auth callback is handled. Must not conflict with
   * any path in your application. Default: "/__auth/cb"
   */
  callbackPath?: string;

  /**
   * Name of the cookie that stores the JWT. Default: "psk_token"
   */
  cookieName?: string;

  /**
   * Cookie Max-Age in seconds. Should match JWT_EXPIRY on the server.
   * Default: 28800 (8 hours)
   */
  cookieMaxAge?: number;

  /**
   * Federated identity providers allowed for this gateway instance.
   * When set, the login page will show these providers as alternative sign-in options.
   * The passkey option is always available regardless of this setting.
   * Requires `providersSecret` to be set for server-side enforcement.
   * @example ['google']
   */
  federatedProviders?: FederatedProvider[];

  /**
   * Shared HMAC secret used to sign the `providers` query parameter.
   * Must match the `PROVIDERS_SECRET` env var configured on the passkey server.
   * Required when `federatedProviders` is non-empty — prevents users from
   * enabling providers by tampering with query parameters.
   */
  providersSecret?: string;
}

/**
 * Supported federated identity providers.
 */
export type FederatedProvider = 'google';

/**
 * Resolved config with all optional fields filled in with defaults.
 */
export interface ResolvedGatewayConfig extends Required<GatewayConfig> {}

/**
 * The payload encoded inside a gateway JWT.
 */
export interface JWTPayload {
  /** The passkey credential ID that was used to authenticate. */
  sub: string;
  /** Issued-at timestamp (Unix seconds). */
  iat: number;
  /** Expiry timestamp (Unix seconds). */
  exp: number;
}
