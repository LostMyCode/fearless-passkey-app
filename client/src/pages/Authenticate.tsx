import { useState } from 'preact/hooks';
import { Button, Card, Text, Stack } from '@mantine/core';
import { startAuthentication } from '@simplewebauthn/browser';
import { api, ApiError } from '../lib/api';
import { ApiStatus } from '../components/ApiStatus';

export function Authenticate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleAuthenticate = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      console.log('Starting passkey authentication...');

      // Step 1: Get authentication options from server
      const options = await api.getAuthenticationOptions();
      console.log('Got authentication options:', {
        rpId: options.rpId,
        challengeLength: options.challenge.length,
        allowedCredentials: options.allowCredentials?.length || 0
      });

      // Step 2: Start authentication ceremony with browser
      const assertion = await startAuthentication({ optionsJSON: options });
      console.log('Authentication ceremony completed:', {
        credentialId: assertion.id,
        type: assertion.type
      });

      // Step 3: Verify authentication with server
      const result = await api.verifyAuthentication({ 
        assertion, 
        challenge: options.challenge 
      });
      console.log('Authentication verified:', result);

      setSuccess(
        `Signed in successfully! Credential: ${result.credentialId.substring(0, 16)}... (Counter: ${result.newCounter})`
      );

    } catch (err) {
      console.error('Authentication failed:', err);

      if (err instanceof ApiError) {
        if (err.code === 'CREDENTIAL_NOT_FOUND') {
          setError('No passkey found. Please register a passkey first.');
        } else if (err.code === 'INVALID_COUNTER') {
          setError('Security error: Possible cloned authenticator detected');
        } else {
          setError(`Sign-in failed: ${err.message}`);
        }
      } else if (err instanceof Error) {
        if (err.name === 'NotSupportedError') {
          setError('Passkeys are not supported on this device or browser');
        } else if (err.name === 'NotAllowedError') {
          setError('Authentication was cancelled or not allowed');
        } else if (err.name === 'AbortError') {
          setError('Authentication timed out');
        } else if (err.name === 'InvalidStateError') {
          setError('No passkey found. Please register a passkey first.');
        } else {
          setError(`Sign-in failed: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred during authentication');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="md">
        <div>
          <Text size="xl" fw={500}>Sign In with Passkey</Text>
          <Text c="dimmed" size="sm" mt="xs">
            Use your existing passkey to sign in. You'll be prompted to use your device's
            security features to authenticate.
          </Text>
        </div>

        <ApiStatus loading={loading} error={error} success={success} />

        <Button
          onClick={handleAuthenticate}
          loading={loading}
          size="lg"
          fullWidth
          variant="filled"
        >
          {loading ? 'Authenticating...' : 'Sign In with Passkey'}
        </Button>

        <Text size="xs" c="dimmed">
          <strong>Note:</strong> If you haven't registered a passkey yet,
          switch to the Register tab first.
        </Text>
      </Stack>
    </Card>
  );
}
