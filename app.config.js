import 'dotenv/config';

export default ({ config }) => {
  // Ensure Expo picks up the environment variable
  const androidAdMobAppId = process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID || "YOUR_FALLBACK_ADMOB_APP_ID";

  return {
    ...config,
    name: "LifeLog",
    slug: "LifeLog",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      usesAppTrackingTransparency: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      buildProperties: {
        enableHermes: true
      },
      permissions: ["com.google.android.gms.permission.AD_ID"],
      package: "com.anonymous.LifeLog"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ]
    ],
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "a27bcb78-af2a-4ef8-adeb-7fae3e17731d"
      },
      androidAdMobAppId
    },
    "react-native-google-mobile-ads": {
      android_app_id: androidAdMobAppId
    },
    owner: "kelseyp99"
  };
};
