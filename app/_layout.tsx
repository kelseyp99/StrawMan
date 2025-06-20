import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as dbServices from '../src/services/dbServices';

export default function RootLayout() {
  useEffect(() => {
    // Run legacy data sync only if user is paid and has sync enabled
    const runLegacySync = async () => {
      try {
        const paid = await AsyncStorage.getItem('isPaidCustomer');
        const syncEnabled = await AsyncStorage.getItem('syncWithCloud');
        
        if (paid === 'true' && syncEnabled === 'true') {
          console.log('[SYNC] Starting legacy data import for paid user...');
          await dbServices.syncFromRemote();
          console.log('[SYNC] Legacy data import complete');
        } else {
          console.log('[SYNC] Skipping legacy sync - user not paid or sync disabled');
        }
      } catch (err) {
        console.warn('[SYNC] Legacy data import failed:', err);
      }
    };
    
    // Run with a small delay to not block app startup
    setTimeout(runLegacySync, 2000);
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
