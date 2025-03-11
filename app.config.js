import 'dotenv/config';

export default ({ config }) => {
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
        package: "com.anonymous.lifelog"
      },
      plugins: ["expo-router"],
      web: {
        bundler: "metro",
        output: "static",
        favicon: "./assets/images/favicon.png"
      },
      extra: {
        eas: {
          projectId: "a27bcb78-af2a-4ef8-adeb-7fae3e17731d"
        }
      },
      owner: "kelseyp99"
    }
  };
};