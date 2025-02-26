import { Stack } from "expo-router";
import React from "react";

export default function RootLayout() {
  console.log("RootLayout loaded"); // Debug log for terminal/browser console
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      {/* Optionally include index if you want AskJanet as a separate route */}
      {/* <Stack.Screen name="index" options={{ headerShown: false }} /> */}
    </Stack>
  );
}