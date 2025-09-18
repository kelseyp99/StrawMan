import React from 'react';
import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeDefaultCategories } from '../src/services/dbServicesLocal';

export default function Onboarding() {
  const router = useRouter();

  const finishOnboarding = async () => {
    await initializeDefaultCategories();
    await AsyncStorage.setItem('hasOnboarded', 'true');
    // Always navigate to main tabs after onboarding
    router.replace('/tabs');
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
