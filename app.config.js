// NOTE: This project uses the bare workflow with native folders (android/ios).
// Expo doctor will warn about config fields not syncing automatically.
// This is expected and safe to ignore unless you use `expo prebuild`.
require('dotenv').config();

// Export a plain object instead of a function to ensure EAS/Metro always picks up the config
const isLive = process.env.AD_MOB_ENV === 'live';

module.exports = {
  'react-native-google-mobile-ads': {
    // Use live App IDs when AD_MOB_ENV=live; otherwise fall back to Google test IDs
    android_app_id:
      (isLive && process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID_LIVE) ||
      'ca-app-pub-3940256099942544~3347511713',
    ios_app_id:
      (isLive && process.env.EXPO_PUBLIC_IOS_ADMOB_APP_ID_LIVE) ||
      'ca-app-pub-3940256099942544~1458002511',
    googleMobileAdsJson: null,
  },
  expo: {
    slug: 'LifeLog',
    owner: 'tinman42',
    scheme: 'lifelog',
    icon: './assets/images/ask-janet-icon2.png',
    android: {
      package: 'com.anonymous.lifelog',
    },
    ios: {
      bundleIdentifier: 'com.anonymous.lifelog',
    },
    updates: {
      enabled: true,
      fallbackToCacheTimeout: 0,
      checkAutomatically: 'ON_LOAD',
    },
    extra: {
      EXPO_PUBLIC_IS_EXPO_GO: process.env.EXPO_PUBLIC_IS_EXPO_GO || 'true',
      googleClientIdAndroid: '341732508688-o2qbbr16g2qh3e8niofee9iv4tl6krhb.apps.googleusercontent.com',
      eas: {
  projectId: 'a27bcb78-af2a-4ef8-adeb-7fae3e17731d',
      },
    },
  plugins: ['expo-asset', 'react-native-google-mobile-ads'],
  },
};
