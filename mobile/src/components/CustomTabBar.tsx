import React from 'react';
import { View } from 'react-native';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import FakeAdMobBanner from '../components/FakeAdMobBanner';
import InlineAd from '../components/InlineAd';
import Constants from 'expo-constants';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const isExpoGo = Constants.expoConfig?.extra?.EXPO_PUBLIC_IS_EXPO_GO === 'true';

export default function CustomTabBar(props: BottomTabBarProps) {
  return (
    <View>
      <BottomTabBar {...props} />
      {isExpoGo ? <FakeAdMobBanner /> : <InlineAd />}
    </View>
  );
}
