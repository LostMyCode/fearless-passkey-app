import { MantineProvider, Container, Title, Tabs } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Register } from './pages/Register';
import { Authenticate } from './pages/Authenticate';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

export function App() {
  return (
    <MantineProvider>
      <Notifications />
      <Container size="sm" py="xl">
        <Title order={1} ta="center" mb="xl">
          Passkey Demo
        </Title>

        <Tabs defaultValue="register" variant="outline">
          <Tabs.List grow>
            <Tabs.Tab value="register">
              Register Passkey
            </Tabs.Tab>
            <Tabs.Tab value="authenticate">
              Sign In
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="register" pt="xl">
            <Register />
          </Tabs.Panel>

          <Tabs.Panel value="authenticate" pt="xl">
            <Authenticate />
          </Tabs.Panel>
        </Tabs>
      </Container>
    </MantineProvider>
  );
}
