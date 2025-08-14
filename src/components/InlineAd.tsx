import React, { useEffect, useState } from "react";
import { View } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";

const isExpoGo = Constants.expoConfig?.extra?.EXPO_PUBLIC_IS_EXPO_GO === "true";

const isLive = process.env.AD_MOB_ENV === 'live';
const liveBannerUnitIdAndroid = process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
const liveBannerUnitIdIOS = process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS;
const bannerUnitId = isLive
  ? Device.osName === 'Android'
    ? (liveBannerUnitIdAndroid || 'ca-app-pub-3940256099942544/6300978111')
    : (liveBannerUnitIdIOS || 'ca-app-pub-3940256099942544/2934735716')
  : Device.osName === 'Android'
    ? 'ca-app-pub-3940256099942544/6300978111'
    : 'ca-app-pub-3940256099942544/2934735716';

const InlineAd = () => {
  const [AdMobBanner, setAdMobBanner] = useState<any>(null);
  const [BannerAdSize, setBannerAdSize] = useState<any>(null);
  const [TestIds, setTestIds] = useState<any>(null);

  useEffect(() => {
    if (!isExpoGo) {
      const admob = require("react-native-google-mobile-ads");
      setAdMobBanner(() => admob.BannerAd);
      setBannerAdSize(admob.BannerAdSize);
      setTestIds(admob.TestIds);
    }
  }, []);

  if (!AdMobBanner || !BannerAdSize || !TestIds) return null;

  // Use a smaller top margin and enable adaptive banners for better fit
  return (
    <View style={{ alignItems: "center", marginTop: 2 }}>
      <AdMobBanner
  unitId={__DEV__ ? TestIds.BANNER : bannerUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => console.log("✅ Ad loaded")}
        onAdFailedToLoad={(err: any) => console.error("❌ Ad load failed", err)}
      />
    </View>
  );
};

export default InlineAd;
