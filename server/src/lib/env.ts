// Environment variable validation and access
export interface ServerConfig {
  rpId: string;
  rpName: string;
  origin: string;
  ddbTableName: string;
  jwtPublicKey: string;
  jwtExpiry: number;        // seconds, default 28800 (8h)
  authCodesTable: string;
  invitesTable: string;
  loginPageTitle: string;
  federatedAccountsTable: string;
  googleClientId: string;
  allowedProviders: string[];
}

export function getConfig(): ServerConfig {
  const rpId = process.env.RP_ID;
  const rpName = process.env.RP_NAME;
  const origin = process.env.ORIGIN;
  const ddbTableName = process.env.DDB_TABLE_NAME;
  const jwtPublicKey = process.env.JWT_PUBLIC_KEY;
  const jwtExpiryRaw = process.env.JWT_EXPIRY;
  const authCodesTable = process.env.AUTH_CODES_TABLE;
  const invitesTable = process.env.INVITES_TABLE;
  const loginPageTitle = process.env.LOGIN_PAGE_TITLE;

  if (!rpId || !rpName || !origin || !ddbTableName) {
    throw new Error('Missing required environment variables: RP_ID, RP_NAME, ORIGIN, DDB_TABLE_NAME');
  }

  if (!jwtPublicKey) {
    throw new Error('Missing required environment variable: JWT_PUBLIC_KEY');
  }

  if (!authCodesTable) {
    throw new Error('Missing required environment variable: AUTH_CODES_TABLE');
  }

  if (!invitesTable) {
    throw new Error('Missing required environment variable: INVITES_TABLE');
  }

  const jwtExpiry = jwtExpiryRaw ? parseInt(jwtExpiryRaw, 10) : 28800;

  const federatedAccountsTable = process.env.FEDERATED_ACCOUNTS_TABLE || '';
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const allowedProvidersRaw = process.env.ALLOWED_PROVIDERS || '';
  const allowedProviders = allowedProvidersRaw
    ? allowedProvidersRaw.split(',').map(p => p.trim()).filter(Boolean)
    : [];

  return {
    rpId,
    rpName,
    origin,
    ddbTableName,
    jwtPublicKey,
    jwtExpiry,
    authCodesTable,
    invitesTable,
    loginPageTitle: loginPageTitle || 'Sign In',
    federatedAccountsTable,
    googleClientId,
    allowedProviders,
  };
}
