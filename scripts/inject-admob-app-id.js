// Injects the AdMob App ID into AndroidManifest.xml for local/EAS builds
const fs = require('fs');
const path = require('path');
// Optionally load local .env for dev; EAS will provide env at runtime
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const manifestPath = path.resolve(__dirname, '../android/app/src/main/AndroidManifest.xml');
const isLive = process.env.AD_MOB_ENV === 'live';
const appId = isLive
  ? process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID_LIVE || process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID
  : process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID;

if (!appId) {
  console.error('AdMob App ID not found in env (checked EXPO_PUBLIC_ANDROID_ADMOB_APP_ID[_LIVE])');
  process.exit(1);
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
const metaTagRegex = /(<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value=")([^"]+)("\/>)/;

if (!metaTagRegex.test(manifest)) {
  console.error('Could not find AdMob meta-data tag in AndroidManifest.xml');
  process.exit(1);
}

manifest = manifest.replace(metaTagRegex, `$1${appId}$3`);
fs.writeFileSync(manifestPath, manifest, 'utf8');
console.log(`Injected AdMob App ID (${appId}) into AndroidManifest.xml`);
