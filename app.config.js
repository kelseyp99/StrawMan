import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    name: "LifeLog",
    slug: "LifeLog",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "lifelog",
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
      }
    },
    owner: "kelseyp99"
  };
};
