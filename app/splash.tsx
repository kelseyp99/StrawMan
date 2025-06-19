import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from './context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Splash() {
  const router = useRouter();
  const { isLogged } = useAuth();

  useEffect(() => {
    setTimeout(async () => {
      // Replace this with your real onboarding check
      const hasOnboarded = await AsyncStorage.getItem('hasOnboarded');
      const isPaidCustomer = false;
      if (!hasOnboarded) {
        router.replace('/onboarding');
      } else if (!isLogged && isPaidCustomer) {
        router.replace('/(tabs)/(profile)/login');
      } else {
        router.replace('/(tabs)/(profile)/index');
      }
    }, 1500); // 1.5s splash
  }, [isLogged]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 32 }}>LifeLog</Text>
      <ActivityIndicator size="large" />
    </View>
  );
}
