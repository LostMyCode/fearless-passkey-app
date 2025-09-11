import {
  RegistrationOptionsRequest,
  RegistrationOptionsResponse,
  RegistrationVerifyRequest,
  RegistrationVerifyResponse,
  AuthenticationOptionsRequest,
  AuthenticationOptionsResponse,
  AuthenticationVerifyRequest,
  AuthenticationVerifyResponse,
  ErrorResponse
} from './types';

class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

class PasskeyApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      // Include credentials for CORS if needed
      credentials: 'omit',
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      console.log(`API Request: ${method} ${url}`);

      const response = await fetch(url, {
        ...config,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data as ErrorResponse;
        throw new ApiError(
          error.error?.code || 'UNKNOWN_ERROR',
          error.error?.message || 'An error occurred',
          response.status
        );
      }

      console.log(`API Success: ${method} ${url}`);
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      console.error(`API Error: ${method} ${url}`, error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(
          'NETWORK_ERROR',
          'Unable to connect to the server. Please check your connection.',
          0
        );
      }

      throw new ApiError(
        'UNKNOWN_ERROR',
        'An unexpected error occurred',
        0
      );
    }
  }

  // Registration endpoints
  async getRegistrationOptions(
    request: RegistrationOptionsRequest = {}
  ): Promise<RegistrationOptionsResponse> {
    return this.request<RegistrationOptionsResponse>(
      '/webauthn/registration/options',
      'POST',
      request
    );
  }

  async verifyRegistration(
    request: RegistrationVerifyRequest
  ): Promise<RegistrationVerifyResponse> {
    return this.request<RegistrationVerifyResponse>(
      '/webauthn/registration/verify',
      'POST',
      request
    );
  }

  // Authentication endpoints
  async getAuthenticationOptions(
    request: AuthenticationOptionsRequest = {}
  ): Promise<AuthenticationOptionsResponse> {
    return this.request<AuthenticationOptionsResponse>(
      '/webauthn/authentication/options',
      'POST',
      request
    );
  }

  async verifyAuthentication(
    request: AuthenticationVerifyRequest
  ): Promise<AuthenticationVerifyResponse> {
    return this.request<AuthenticationVerifyResponse>(
      '/webauthn/authentication/verify',
      'POST',
      request
    );
  }
}

export const api = new PasskeyApi();
export { ApiError };
