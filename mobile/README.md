GIT WSL token
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

google service  key
lifelog-f2904-b5d58f4dfdec.json


**************************
#To run emulator
#kill and restart the adb server if needed
adb kill-server
adb start-server
#view the available devices
adb devices
db -s emulator-5554 reverse tcp:8081 tcp:8081
#run expo and metro
npx expo start -c
npx expo start --port 8081 --dev-client --tunnel
#install an apk on device - mhst be development build (check eas.json "developmentClient": true,  ) 
adb -s emulator-5556 install "C:\Users\philk\Downloads\build-1743806235439.apk"
#metro/expo Press "a" to load android JS project 
#select "Open JS Debugger" if prompted
#if not already, place emulator into dev mode.  try ctrl M in emulator
emulator-5554 shell input keyevent 82
#select "Open JS Debugger"
#install react dev client in vscode is needed
#press J in metro/expo
#select emulaor at top

#to GIT commit and push
git branch
git checkout develop  (or "git checkout -b develop" If develop Doesn’t Exist)
git status
git add . #Stage it
git status #verifiy
git commit -m "a useful message"  #commit
git push origin develop  #Push to Remote
If you created develop locally (new branch)
git push --set-upstream origin 
#Verify
git log --oneline

## Google Sign-In Setup

This section outlines the successful steps to configure Google Sign-In for the LifeLog Android app using Firebase Authentication and `expo-auth-session`. The process resolved the "Error 400: invalid_request, Custom URI scheme is not enabled for your Android client" and related authentication errors.

### Steps

1. **Create Android OAuth Client ID in Google Cloud Console**:
   - Navigated to [Google Cloud Console](https://console.cloud.google.com) > **APIs & Services > Credentials**.
   - Created an OAuth 2.0 Client ID for Android:
     - **Name**: `LifeLog Android Debug`.
     - **Package name**: `com.anonymous.lifelog`.
     - **SHA-1 fingerprint**: `2F:48:17:82:A9:5C:48:1A:AA:0C:8D:4D:13:49:64:42:F3:BC:33:0F` (obtained via `keytool -list -v -keystore C:\Users\philk\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android`).
     - **Custom URI scheme**: Added `com.anonymous.lifelog:/oauth2redirect` to enable `expo-auth-session` redirects.
   - Copied the Client ID: `341732508688-o2qbbr16g2qh3e8niofee9iv4tl6krhb.apps.googleusercontent.com`.

2. **Enable Google Sign-In in Firebase**:
   - In Firebase Console (`lifelog-f2904`) > **Authentication > Sign-in method**, enabled the Google provider.
   - Did **not** modify **Web SDK configuration** to avoid the UI’s invalid requirement for a Web client secret, as Android Client IDs have no secret.

3. **Update `app.config.js`**:
   - Added the Android Client ID to `extra.googleClientIdAndroid` in `app.config.js` to ensure `expo-auth-session` uses the correct credentials.
   - Included `scheme: "com.anonymous.lifelog"` to resolve linking scheme warnings.
   - Example:
     ```javascript
     extra: {
   EXPO_PUBLIC_IS_EXPO_GO: process.env.EXPO_PUBLIC_IS_EXPO_GO || "false",
       googleClientIdAndroid: "341732508688-o2qbbr16g2qh3e8niofee9iv4tl6krhb.apps.googleusercontent.com",
       eas: {
         projectId: "a27bcb78-af2a-4ef8-adeb-7fae3e17731d"
       }
     }

# Welcome to your Expo app 👋
 is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


Final Successful Steps to Build Expo APK Locally on WSL2
After extensive trial and error, the key was replacing a Windows-specific NDK with a Linux-compatible one in WSL2. Here’s what worked:
https://grok.com/chat/37cce1c9-95d8-478c-bfb7-f32e2fd09b12?referrer=website
Set Up WSL2 SDK:
Copied the Android SDK from Windows (C:\Users\philk\AppData\Local\Android\Sdk) to WSL (~/Android/Sdk):
bash



cd ~/Android/Sdk
rm -rf *
cp -r /mnt/c/Users/philk/AppData/Local/Android/Sdk/* .
This brought over platform-tools, build-tools, platforms, cmake, etc., but the NDK was Windows-specific.
Replaced NDK with Linux Version:
Removed the incompatible Windows NDK:
bash



rm -rf ~/Android/Sdk/ndk/26.1.10909125
Downloaded and installed NDK r26b (26.1.10909125) for Linux:
bash



cd ~/Android/Sdk/ndk
wget https://dl.google.com/android/repository/android-ndk-r26b-linux.zip
unzip android-ndk-r26b-linux.zip
mv android-ndk-r26b 26.1.10909125
Verified compilers:
bash



ls -l ~/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/bin/clang
ls -l ~/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/bin/clang++
Ran the Build:
Set environment and built the APK:
bash



cd ~/projects/LifeLog
export ANDROID_HOME=/home/kelseyp99/Android/Sdk
unset ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_HOME/platform-tools
export CC=/home/kelseyp99/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/bin/clang
export CXX=/home/kelseyp99/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/bin/clang++
rm -rf ~/.gradle/caches ~/.eas/build
eas build:configure
eas build --platform android --local --profile development --clear-cache
Output: APK at ~/projects/LifeLog/build-1742956284567.apk (143 MB).
Key Insight
The Windows NDK (prebuilt/windows-x86_64) lacked Linux binaries (clang, clang++), causing CMake errors. Downloading the Linux NDK directly resolved this.
Verification
Confirm APK:
bash



ls -lh ~/projects/LifeLog/build-1742956284567.apk
Install:
bash



adb install ~/projects/LifeLog/build-1742956284567.apk