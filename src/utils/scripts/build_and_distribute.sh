#!/bin/bash
# ./src/utils/scripts/build_and_distribute.sh --build-only
PROJECT_DIR="/home/kelseyp99/projects/LifeLog"
WINDOWS_DEST="/mnt/c/Users/philk/Downloads/"

set -e

BUILD_ONLY=false
if [[ "$1" == "--build-only" ]]; then
    BUILD_ONLY=true
fi

echo "Setting up Android environment and building the app..."
cd "$PROJECT_DIR"
export ANDROID_HOME=/home/kelseyp99/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

rm -rf ~/.gradle/caches ~/.eas/build

echo "Running EAS build for Android..."
EXPO_PUBLIC_IS_EXPO_GO=false eas build --platform android --local --profile development --clear-cache

echo "Locating latest build artifacts..."
LATEST_APK=$(find "$PROJECT_DIR" -maxdepth 1 -name "*.apk" -printf "%T@ %p\n" | sort -nr | head -n1 | cut -d' ' -f2-)
LATEST_AAB=$(find "$PROJECT_DIR" -maxdepth 1 -name "*.aab" -printf "%T@ %p\n" | sort -nr | head -n1 | cut -d' ' -f2-)

echo "Latest APK: $LATEST_APK"
echo "Latest AAB: $LATEST_AAB"

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

echo "Committing and pushing changes from WSL..."
git add .
git commit -m "Automated commit from WSL: Build artifacts" || echo "Nothing to commit in WSL"
git push origin develop || { echo "Error: Failed to push from WSL"; exit 1; }

echo "Script completed successfully!"