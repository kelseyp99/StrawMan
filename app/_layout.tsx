import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  console.log('RootLayout loaded');
  return (
    <Stack initialRouteName="(tabs)">
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
