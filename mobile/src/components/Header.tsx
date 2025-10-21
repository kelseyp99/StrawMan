import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { Platform } from 'react-native';


export default function Header() {
  const clientId = Platform.OS === 'ios'
    ? (Constants.expoConfig?.extra as any)?.googleClientIdIos
    : (Constants.expoConfig?.extra as any)?.googleClientIdAndroid;
  console.log('GOOGLE SIGN-IN CLIENT ID:', clientId);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId,
    scopes: ['profile', 'email'],
  });

  return (
    <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 40 }}>
      <Text style={{ fontSize: 26, fontWeight: "bold", textAlign: "center", color: '#AA2222' }}>StrawMan</Text>
    </View>
  );
}
