import React from "react";
import { Tabs } from "expo-router";

export default function TabLayout() {
  console.log("TabLayout loaded"); // Debug log for terminal/browser console
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Home" }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explore" }}
      />
      <Tabs.Screen
        name="tables"
        options={{ title: "Tables" }}
      />
    </Tabs>
  );
}