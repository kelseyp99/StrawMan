const { getDefaultConfig } = require("expo/metro-config");

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);
  config.resolver.assetExts.push("png");  // Ensure PNGs are handled
  
  // Exclude react-native-google-mobile-ads from web builds to prevent native module errors
  config.resolver.platforms = ['ios', 'android', 'native', 'web'];
  
  // Add platform-specific resolver to exclude native modules on web
  const originalResolver = config.resolver.resolverMainFields;
  config.resolver.resolverMainFields = ['react-native', 'browser', 'main', ...originalResolver];
  
  // Add resolver alias to prevent Node.js imports in React Native
  config.resolver.alias = {
    ...(config.resolver.alias || {}),
    '#realm.node': false, // Prevent Node.js realm binding from loading
  };
  
  // Block problematic packages
  config.resolver.blockList = [
    ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
    // /node_modules\/react-native-google-mobile-ads\/.*/, // Block on all platforms for now (DISABLED FOR NATIVE BUILDS)
    /#realm\.node$/, // Block Node.js realm bindings
    /node_modules\/realm\/prebuilds\/node\/.*/, // Block Node.js prebuilds
  ];
  
  return config;
})();
