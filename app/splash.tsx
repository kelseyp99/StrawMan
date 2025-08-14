import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from './context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeDefaultCategories } from '../src/services/dbServicesLocal';

export default function Splash() {
  const router = useRouter();
  const { isLogged, loading } = useAuth();
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Only navigate once after auth state is determined
    if (!hasNavigated.current && !loading) {
      hasNavigated.current = true;
      
      const navigate = async () => {
        try {
          console.log('[SPLASH] Auth state - isLogged:', isLogged, 'loading:', loading);
          
          // Ensure minimum categories exist even if onboarding was previously completed
          try {
            await initializeDefaultCategories();
          } catch (seedErr) {
            console.warn('[SPLASH] Category seeding skipped/failed:', seedErr);
          }

          const hasOnboarded = await AsyncStorage.getItem('hasOnboarded');
          console.log('[SPLASH] Has onboarded:', hasOnboarded);
          
          if (!hasOnboarded) {
            console.log('[SPLASH] Navigating to onboarding');
            router.replace('/onboarding');
          } else if (!isLogged) {
            console.log('[SPLASH] Navigating to login');
            router.replace('/login');
          } else {
            console.log('[SPLASH] Navigating to main app');
            router.replace('/(tabs)');
          }
        } catch (error) {
          console.error('[SPLASH] Navigation error:', error);
          // Fallback to login on error
          router.replace('/login');
        }
      };

      // Small delay for smooth transition
      setTimeout(navigate, 1000);
    }
  }, [isLogged, loading, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 32, marginBottom: 20, color: '#333' }}>LifeLog</Text>
      <ActivityIndicator size="large" color="#007bff" />
      <Text style={{ marginTop: 10, color: '#666' }}>Loading...</Text>
    </View>
  );
}
