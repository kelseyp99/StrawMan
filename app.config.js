require("dotenv").config();

module.exports = ({ config }) => {
  const expoConfig = config && config.expo ? config.expo : {};
  const updatedConfig = {
    ...config,
    expo: {
      ...expoConfig,
      slug: expoConfig.slug || "LifeLog",
      scheme: "com.anonymous.lifelog",
      android: {
        ...(expoConfig.android || {}),
        package: expoConfig.android && expoConfig.android.package ? expoConfig.android.package : "com.anonymous.lifelog"
      },
      extra: {
        ...(expoConfig.extra || {}),
        EXPO_PUBLIC_IS_EXPO_GO: process.env.EXPO_PUBLIC_IS_EXPO_GO || "true",
        googleClientIdAndroid: "341732508688-o2qbbr16g2qh3e8niofee9iv4tl6krhb.apps.googleusercontent.com",
        eas: {
          projectId: "a27bcb78-af2a-4ef8-adeb-7fae3e17731d"
        }
      }
    }
  };
  console.log("Config:", JSON.stringify(updatedConfig, null, 2));
  return updatedConfig;
};