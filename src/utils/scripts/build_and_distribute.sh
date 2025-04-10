#!/bin/bash
# ./src/utils/scripts/build_and_distribute.sh --build-only
# cd C:\Users\philk\Downloads
# adb -s emulator-5554 install build-1744246199106.apk

# Variables
PROJECT_DIR="/home/kelseyp99/projects/LifeLog"
WINDOWS_DEST="/mnt/c/Users/philk/Downloads/"  # Windows Downloads directory
FIREBASE_PROJECT="lifelog-f2904"
APP_ID="1:341732508688:android:4a8c275e1199f4e1c0e8b4"
RELEASE_NOTES="New build uploaded on $(date '+%Y-%m-%d %H:%M:%S')"
TESTERS_FILE="testers.txt"  # Optional, create if needed

# Ensure script exits on error
set -e

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

BUILD_ONLY=false
if [[ "$1" == "--build-only" ]]; then
    BUILD_ONLY=true
fi

# Step 1: Build the app
echo "Setting up Android environment and building the app..."
cd "$PROJECT_DIR"
export ANDROID_HOME=/home/kelseyp99/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Clean caches
rm -rf ~/.gradle/caches ~/.eas/build

# Build with EAS
echo "Running EAS build for Android..."
EXPO_PUBLIC_IS_EXPO_GO=false eas build --platform android --local --profile development --clear-cache

# Step 2: Find latest APK/AAB
echo "Locating latest build artifacts..."
LATEST_APK=$(find "$PROJECT_DIR" -maxdepth 1 -name "*.apk" -printf "%T@ %p\n" | sort -nr | head -n1 | cut -d' ' -f2-)
LATEST_AAB=$(find "$PROJECT_DIR" -maxdepth 1 -name "*.aab" -printf "%T@ %p\n" | sort -nr | head -n1 | cut -d' ' -f2-)

echo "Latest APK: $LATEST_APK"
echo "Latest AAB: $LATEST_AAB"

# Step 3: Conditional Firebase upload (if not build-only)
if ! $BUILD_ONLY; then
    if ! command_exists firebase; then
        echo "Firebase CLI not found. Installing..."
        npm install -g firebase-tools || { echo "Error: Failed to install Firebase CLI"; exit 1; }
    fi

    echo "Checking Firebase login..."
    firebase login --no-localhost > /dev/null 2>&1 || firebase login || { echo "Error: Firebase login failed"; exit 1; }

    echo "Linking to Firebase project: $FIREBASE_PROJECT"
    firebase use "$FIREBASE_PROJECT" || { echo "Error: Failed to link project"; exit 1; }

    echo "Uploading APK to Firebase App Distribution..."
    if [ -n "$LATEST_APK" ]; then
        if [ -f "$TESTERS_FILE" ]; then
            firebase appdistribution:distribute "$LATEST_APK" --app "$APP_ID" --release-notes "$RELEASE_NOTES" --testers-file "$TESTERS_FILE"
        else
            firebase appdistribution:distribute "$LATEST_APK" --app "$APP_ID" --release-notes "$RELEASE_NOTES" --testers "email1@example.com,email2@example.com"  # Replace with real emails
        fi
        echo "Upload complete!"
    else
        echo "Error: No APK found to upload."
        exit 1
    fi
else
    echo "Build-only flag detected. Skipping Firebase upload."
fi

# Step 4: Move files to Windows Downloads
if [ -d "$WINDOWS_DEST" ]; then
    if [ -n "$LATEST_APK" ]; then
        mv "$LATEST_APK" "$WINDOWS_DEST"
        if [ $? -eq 0 ]; then
            echo "Successfully moved $LATEST_APK to $WINDOWS_DEST"
        else
            echo "Error: Failed to move $LATEST_APK to $WINDOWS_DEST"
            exit 1
        fi
    fi
    if [ -n "$LATEST_AAB" ]; then
        mv "$LATEST_AAB" "$WINDOWS_DEST"
        if [ $? -eq 0 ]; then
            echo "Successfully moved $LATEST_AAB to $WINDOWS_DEST"
        else
            echo "Error: Failed to move $LATEST_AAB to $WINDOWS_DEST"
            exit 1
        fi
    fi
else
    echo "Error: $WINDOWS_DEST not accessible."
    exit 1
fi

echo "Script completed successfully!"