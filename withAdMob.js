const { withPlugins, withAndroidBuildProperties } = require('@expo/config-plugins');

module.exports = function withAdMob(config) {
  return withPlugins(config, [
    [
      withAndroidBuildProperties,
      {
        'googleMobileAdsJson': JSON.stringify({ admob_app_id: 'ca-app-pub-1315319831980259~1158662288' }),
        'compileSdkVersion': 33
      }
    ]
  ]);
};