// app.config.js
require('dotenv').config();

module.exports = ({ config }) => {
  const updatedConfig = {
    ...config,
    expo: {
      ...config.expo,
      scheme: "lifelog",
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
        }
      },
      extra: {
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
  console.log("Config:", JSON.stringify(updatedConfig, null, 2));
  return updatedConfig;
};