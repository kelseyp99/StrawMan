import React from 'react';
import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Onboarding() {
  const router = useRouter();

  const finishOnboarding = async () => {
    await AsyncStorage.setItem('hasOnboarded', 'true');
    // TODO: Replace this with your real paid customer check
    const isPaidCustomer = false; // Set this based on your logic
    if (isPaidCustomer) {
      router.replace('/(tabs)/(profile)/login');
    } else {
      // Show a paywall, message, or handle non-paid users here
      // For now, do nothing or add your paywall navigation
      // Example: router.replace('/paywall');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>
        Welcome to LifeLog!
      </Text>
      <Text style={{ marginBottom: 40 }}>Track your life, your way.</Text>
      <Button title="Get Started" onPress={finishOnboarding} />
    </View>
  );
}
