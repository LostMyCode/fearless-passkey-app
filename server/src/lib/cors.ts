import { APIGatewayProxyResult } from 'aws-lambda';
import { getConfig } from './env';

/**
 * Add CORS headers to Lambda response
 * Restricts access to configured origin only for security
 */
export function addCorsHeaders(response: APIGatewayProxyResult): APIGatewayProxyResult {
  const config = getConfig();

  return {
    ...response,
    headers: {
      ...response.headers,
      'Access-Control-Allow-Origin': config.origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '600'
    }
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleOptions(): APIGatewayProxyResult {
  return addCorsHeaders({
    statusCode: 200,
    headers: {},
    body: ''
  });
}
