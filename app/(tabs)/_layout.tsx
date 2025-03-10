//\app\(tabs)\_layout.tsx  
import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { HapticTab } from "../../src/components/HapticTab";
import { IconSymbol } from "../../src/components/ui/IconSymbol";
import TabBarBackground from "../../src/components/ui/TabBarBackground";
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "../../hooks/useColorScheme";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import FakeAdMobBanner from "../../src/components/FakeAdMobBanner";
import React from "react";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: { paddingBottom: 55 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <IconSymbol size={35} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: "Explore",
            tabBarIcon: ({ color }) => <IconSymbol size={33} name="paperplane.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="tables"
          options={{
            title: "Tables",
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="table-large" size={30} color={color} />
            ),
          }}
        />
      </Tabs>
      <FakeAdMobBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  adBanner: { position: "absolute", bottom: 0, width: "100%" },
});