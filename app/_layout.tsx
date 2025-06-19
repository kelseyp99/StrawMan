import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import * as dbServices from '../src/services/dbServices';

export default function RootLayout() {
  useEffect(() => {
    // Trigger legacy data import/sync on app startup
    console.log('[SYNC] Starting legacy data import...');
    dbServices
      .syncFromRemote()
      .then(() => console.log('[SYNC] Legacy data import complete'))
      .catch((err) => console.warn('[SYNC] Legacy data import failed', err));
  }, []);

  return (
    <AuthProvider>
      <SyncProvider>
        <Stack initialRouteName="splash">
          <Stack.Screen name="splash" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </SyncProvider>
    </AuthProvider>
  );
}
