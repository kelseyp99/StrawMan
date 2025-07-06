// Injects the AdMob App ID from .env into AndroidManifest.xml for local/EAS builds
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const manifestPath = path.resolve(__dirname, '../android/app/src/main/AndroidManifest.xml');
const appId = process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID;

if (!appId) {
  console.error('EXPO_PUBLIC_ANDROID_ADMOB_APP_ID not found in .env');
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
