import { Stack } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function ToolsLayout() {
  const { isLogged, isPaid } = useAuth();

  if (!isLogged && isPaid) {
    // Not logged in, but paid: show login
    return <Stack.Screen name="login" options={{ title: 'Login' }} />;
  }

  // If not paid, or logged in (paid or not), show the main stack
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Tools' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="explore" options={{ title: 'Explore' }} />
    </Stack>
  );
}
