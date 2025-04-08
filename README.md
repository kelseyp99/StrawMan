GIT WSL token
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

google service  key
lifelog-f2904-b5d58f4dfdec.json


To run emulator

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

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
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

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
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