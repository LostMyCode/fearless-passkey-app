import { Alert } from '@mantine/core';

interface ApiStatusProps {
  loading?: boolean;
  error?: string;
  success?: string;
}

export function ApiStatus({ loading, error, success }: ApiStatusProps) {
  if (loading) {
    return (
      <Alert color="blue" title="Processing">
        Please wait while we process your request...
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Error">
        {error}
      </Alert>
    );
  }

  if (success) {
    return (
      <Alert color="green" title="Success">
        {success}
      </Alert>
    );
  }

  return null;
}
