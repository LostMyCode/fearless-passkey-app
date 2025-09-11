import { APIGatewayProxyResult } from 'aws-lambda';
import { addCorsHeaders } from './cors';
import { ErrorResponse } from '../types';

/**
 * Create a successful JSON response with CORS headers
 */
export function successResponse<T>(data: T, statusCode = 200): APIGatewayProxyResult {
  return addCorsHeaders({
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}

/**
 * Create an error response with consistent format
 */
export function errorResponse(
  code: string,
  message: string,
  statusCode = 400
): APIGatewayProxyResult {
  const errorData: ErrorResponse = {
    error: { code, message }
  };

  return addCorsHeaders({
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(errorData)
  });
}

/**
 * Handle unexpected errors with proper logging and response
 */
export function handleError(error: unknown, action: string): APIGatewayProxyResult {
  console.error(JSON.stringify({
    action: `${action}_failed`,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  }));

  if (error instanceof Error) {
    // Don't leak internal error details to client
    return errorResponse(
      'INTERNAL_ERROR',
      'An internal server error occurred',
      500
    );
  }

  return errorResponse(
    'UNKNOWN_ERROR',
    'An unknown error occurred',
    500
  );
}
