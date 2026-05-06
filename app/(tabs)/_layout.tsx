import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { HapticTab } from '../../src/components/HapticTab';
import { IconSymbol } from '../../src/components/ui/IconSymbol';
import TabBarBackground from '../../src/components/ui/TabBarBackground';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from '../../hooks/useColorScheme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FakeAdMobBanner from '../../src/components/FakeAdMobBanner';
import InlineAd from '../../src/components/InlineAd';
import Constants from 'expo-constants';
import React from 'react';

const isExpoGo = Constants.expoConfig?.extra?.EXPO_PUBLIC_IS_EXPO_GO === 'true';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: { paddingBottom: 55 },
        }}
      >
  {/* Removed IndexScreen and index tab from tabs menu as requested */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={35} name="house.fill" color={color} />
            ),
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
        <Tabs.Screen
          name="Reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="file-document-outline" size={30} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tools"
          options={{
            title: 'Tools',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="tools" size={30} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="about"
          options={{
            title: 'About',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="information" size={30} color={color} />
            ),
          }}
        />
      </Tabs>
      {isExpoGo ? <FakeAdMobBanner /> : <InlineAd />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
