// Injects the AdMob App ID into AndroidManifest.xml for local/EAS builds (Android only)
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const isAndroidBuild = process.env.EAS_BUILD_PLATFORM === 'android' || process.env.RN_PLATFORM === 'android';
const manifestPath = path.resolve(__dirname, '../android/app/src/main/AndroidManifest.xml');
if (!isAndroidBuild) {
  console.log('[inject-admob-app-id] Non-Android context, skipping.');
  process.exit(0);
}
if (!fs.existsSync(manifestPath)) {
  console.log('[inject-admob-app-id] AndroidManifest.xml missing, skipping injection.');
  process.exit(0);
}

// Remove duplicate PNG launcher icons if WebP exists to avoid resource merge conflicts
const cleanDuplicateLauncherIcons = () => {
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  let removed = 0;
  for (const d of densities) {
    const pngPath = path.resolve(__dirname, `../android/app/src/main/res/mipmap-${d}/ic_launcher.png`);
    const webpPath = path.resolve(__dirname, `../android/app/src/main/res/mipmap-${d}/ic_launcher.webp`);
    try {
      if (fs.existsSync(pngPath) && fs.existsSync(webpPath)) {
        fs.unlinkSync(pngPath);
        removed++;
      }
    } catch (e) {
      // ignore
    }
  }
  if (removed > 0) {
    console.log(`Removed ${removed} duplicate ic_launcher.png files (kept .webp)`);
  }
};
const isLive = process.env.AD_MOB_ENV === 'live';
const appId = isLive
  ? process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID_LIVE || process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID
  : process.env.EXPO_PUBLIC_ANDROID_ADMOB_APP_ID;

if (!appId) {
  console.warn('[inject-admob-app-id] AdMob App ID env missing; skipping.');
  process.exit(0);
}

// First, clean duplicates if present
cleanDuplicateLauncherIcons();

let manifest = fs.readFileSync(manifestPath, 'utf8');
// Match existing AdMob meta-data (regardless of attributes order)
const metaTagRegex = /<meta-data\s+android:name="com.google.android.gms.ads.APPLICATION_ID"[^>]*>/g;

// Ensure the manifest has the tools namespace so we can use tools:replace
const ensureToolsNamespace = (xml) => {
  if (/xmlns:tools=/.test(xml)) return xml;
  return xml.replace(
    /<manifest(\s[^>]*)?>/,
    (match) => match.replace('>', ' xmlns:tools="http://schemas.android.com/tools">')
  );
};


manifest = ensureToolsNamespace(manifest);

const newMeta = `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${appId}" tools:replace="android:value" tools:node="replace"/>`;

// Remove any existing AdMob meta-data entries in the app manifest to avoid duplicates
manifest = manifest.replace(metaTagRegex, '');

if (!/<meta-data\s+android:name="com.google.android.gms.ads.APPLICATION_ID"/.test(manifest)) {
  // Insert meta-data tag inside <application>
  const appTagRegex = /(<application[\s\S]*?>)/;
  if (appTagRegex.test(manifest)) {
    manifest = manifest.replace(appTagRegex, `$1\n    ${newMeta}`);
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log(`Created and injected AdMob App ID (${appId}) into AndroidManifest.xml with tools:replace`);
    process.exit(0);
  } else {
    console.error('Could not find <application> tag in AndroidManifest.xml');
    process.exit(1);
  }
} else {
  // Replace the entire existing tag with a canonical tag that includes tools:replace
  manifest = manifest.replace(metaTagRegex, newMeta);
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log(`Injected AdMob App ID (${appId}) into AndroidManifest.xml with tools:replace`);
}
