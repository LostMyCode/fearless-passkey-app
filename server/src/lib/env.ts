// Environment variable validation and access
export interface ServerConfig {
  rpId: string;
  rpName: string;
  origin: string;
  ddbTableName: string;
}

export function getConfig(): ServerConfig {
  const rpId = process.env.RP_ID;
  const rpName = process.env.RP_NAME;
  const origin = process.env.ORIGIN;
  const ddbTableName = process.env.DDB_TABLE_NAME;

  if (!rpId || !rpName || !origin || !ddbTableName) {
    throw new Error('Missing required environment variables: RP_ID, RP_NAME, ORIGIN, DDB_TABLE_NAME');
  }

  return {
    rpId,
    rpName,
    origin,
    ddbTableName
  };
}
