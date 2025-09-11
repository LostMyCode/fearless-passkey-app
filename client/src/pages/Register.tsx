import { useState } from 'preact/hooks';
import { Button, Card, Text, Stack } from '@mantine/core';
import { startRegistration } from '@simplewebauthn/browser';
import { api, ApiError } from '../lib/api';
import { ApiStatus } from '../components/ApiStatus';

export function Register() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      console.log('Starting passkey registration...');

      // Step 1: Get registration options from server
      const options = await api.getRegistrationOptions();
      console.log('Got registration options:', {
        rpId: options.rp.id,
        rpName: options.rp.name,
        challengeLength: options.challenge.length
      });

      // Step 2: Start registration ceremony with browser
      const attestation = await startRegistration({ optionsJSON: options });
      console.log('Registration ceremony completed:', {
        credentialId: attestation.id,
        type: attestation.type
      });

      // Step 3: Verify registration with server
      const result = await api.verifyRegistration({ 
        attestation, 
        challenge: options.challenge 
      });
      console.log('Registration verified:', result);

      setSuccess(
        `Passkey registered successfully! Credential ID: ${result.credentialId.substring(0, 16)}...`
      );

    } catch (err) {
      console.error('Registration failed:', err);

      if (err instanceof ApiError) {
        setError(`Registration failed: ${err.message}`);
      } else if (err instanceof Error) {
        if (err.name === 'NotSupportedError') {
          setError('Passkeys are not supported on this device or browser');
        } else if (err.name === 'NotAllowedError') {
          setError('Registration was cancelled or not allowed');
        } else if (err.name === 'AbortError') {
          setError('Registration timed out');
        } else {
          setError(`Registration failed: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred during registration');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="md">
        <div>
          <Text size="xl" fw={500}>Register New Passkey</Text>
          <Text c="dimmed" size="sm" mt="xs">
            Create a new passkey for passwordless authentication. This will use your device's
            built-in security (TouchID, FaceID, Windows Hello, etc.) or a security key.
          </Text>
        </div>

        <ApiStatus loading={loading} error={error} success={success} />

        <Button
          onClick={handleRegister}
          loading={loading}
          size="lg"
          fullWidth
        >
          {loading ? 'Creating Passkey...' : 'Create Passkey'}
        </Button>

        <Text size="xs" c="dimmed">
          <strong>Note:</strong> You'll be prompted to use your device's security features
          (fingerprint, face recognition, PIN, or security key) to create your passkey.
        </Text>
      </Stack>
    </Card>
  );
}
