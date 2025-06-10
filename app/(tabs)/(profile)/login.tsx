import React from 'react';
import { View, Text, Button } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function Login() {
  const { setIsLogged } = useAuth();
  const router = useRouter();

  const handleLogin = () => {
    setIsLogged(true);
    router.replace('/(tabs)/index');
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Please log in to continue</Text>
      <Button title="Log In" onPress={handleLogin} />
    </View>
  );
}
