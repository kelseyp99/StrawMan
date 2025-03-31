import { Stack } from "expo-router";
import React, { useEffect } from "react";
import Constants from 'expo-constants';
import InlineAd from "../src/components/InlineAd"; // adjust path as needed

const isExpoGo = Constants.expoConfig?.extra?.EXPO_PUBLIC_IS_EXPO_GO === "true";
console.log("EXPO_PUBLIC_IS_EXPO_GO (runtime):", isExpoGo);

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      if (!isExpoGo) {
        try {
          const adMobModule = require("react-native-google-mobile-ads");
          if (adMobModule?.default) {
            await adMobModule.default().initialize();
            console.log("✅ AdMob initialized");
          } else {
            console.log("🛑 AdMob module not available (undefined)");
          }
        } catch (err) {
          console.error("❌ AdMob init failed:", err);
        }
      } else {
        console.log("🛑 Skipping AdMob init in Expo Go");
      }
    })();
  }, []);

  console.log("RootLayout loaded");

  return (
    <><Stack initialRouteName="login">
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack><InlineAd /></>

  );
}
