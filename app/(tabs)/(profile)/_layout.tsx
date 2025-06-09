import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
// import { IconSymbol } from "../../src/components/ui/IconSymbol";
// import TabBarBackground from "../../src/components/ui/TabBarBackground";
// import { Colors } from "../../constants/Colors";
// import { useColorScheme } from "../../hooks/useColorScheme";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// import FakeAdMobBanner from "../../src/components/FakeAdMobBanner";
// import InlineAd from "../../src/components/InlineAd";
import Constants from 'expo-constants';
import React from 'react';

const isExpoGo = Constants.expoConfig?.extra?.EXPO_PUBLIC_IS_EXPO_GO === 'true';

export default function TabLayout() {
  // const colorScheme = useColorScheme();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          // tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
          headerShown: false,
          // tabBarButton: HapticTab, // Removed because HapticTab is missing
          // tabBarBackground: TabBarBackground,
          tabBarStyle: { paddingBottom: 55 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            // tabBarIcon: ({ color }) => <IconSymbol size={35} name="house.fill" color={color} />, // Removed missing IconSymbol
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            // tabBarIcon: ({ color }) => <IconSymbol size={33} name="paperplane.fill" color={color} />, // Removed missing IconSymbol
          }}
        />
        <Tabs.Screen
          name="tables"
          options={{
            title: 'Tables',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons
                name="table-large"
                size={30}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
      {/* {isExpoGo ? <FakeAdMobBanner /> : <InlineAd />} */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
