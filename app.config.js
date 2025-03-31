// app.config.js
const { config } = require('dotenv').config();

module.exports = ({ config }) => {
  return {
    ...config,
    expo: {
      name: "LifeLog",
      slug: "LifeLog",
      scheme: "lifelog",
      version: "1.0.0",
      orientation: "portrait",
      icon: "src/assets/images/ask-janet-icon.png",
      userInterfaceStyle: "automatic",
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
        package: "com.anonymous.lifelog2"
      },
      extra: {
        "react-native-google-mobile-ads": {
          "android_app_id": "ca-app-pub-1315319831980259~1158662288"
        },
        EXPO_PUBLIC_IS_EXPO_GO: process.env.EXPO_PUBLIC_IS_EXPO_GO || "true",
        eas: {
          projectId: "a27bcb78-af2a-4ef8-adeb-7fae3e17731d"
        }
      },
      plugins: ["expo-router"],
      web: {
        bundler: "metro",
        output: "static",
        favicon: "./assets/images/favicon.png"
      },
      owner: "kelseyp99"
    }
  };
};