#!/bin/bash

# Variables
PROJECT_DIR="/home/kelseyp99/projects/LifeLog"
SOURCE_FILE="$PROJECT_DIR/build-1743087341496.aab"  # Adjust if the build name changes
APK_FILE="$PROJECT_DIR/build-1742956284567.apk"     # From your build output
WINDOWS_DEST="/mnt/c/Windows/"  # Adjust this to your desired Windows directory
FIREBASE_PROJECT="lifelog-f2904"  # Replace with your Firebase Project ID
APP_ID="1:341732508688:android:4a8c275e1199f4e1c0e8b4"  # Replace with your Firebase App ID
RELEASE_NOTES="New build uploaded on $(date '+%Y-%m-%d %H:%M:%S')"
TESTERS_FILE="testers.txt"  # Path to your testers file (optional)
TEMP_DIR="/tmp/lifelog_temp"  # Temporary directory for file operations

# Ensure the script exits on error
set -e

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Set up Android environment and build the app
echo "Setting up Android environment and building the app..."
cd "$PROJECT_DIR"
export ANDROID_HOME=/home/kelseyp99/Android/Sdk
unset ANDROID_SDK_ROOT
export PATH=$PATH:$ANDROID_HOME/platform-tools
export CC=/home/kelseyp99/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/bin/clang
export CXX=/home/kelseyp99/Android/Sdk/ndk/26.1.10909125/toolchains/llvm/prebuilt/linux-x86_64/bin/clang++

# Clean caches
rm -rf ~/.gradle/caches ~/.eas/build

# Configure and build with EAS
echo "Configuring EAS build..."
eas build:configure
echo "Running EAS build for Android..."
eas build --platform android --local --profile development --clear-cache

# Step 2: Verify the generated APK (optional)
if [ -f "$APK_FILE" ]; then
    echo "Verifying APK..."
    ls -lh "$APK_FILE"
    echo "Installing APK to connected device..."
    adb install "$APK_FILE"
    if [ $? -eq 0 ]; then
        echo "APK installed successfully."
    else
        echo "Warning: APK installation failed. Proceeding anyway."
    fi
else
    echo "Warning: APK file $APK_FILE not found. Assuming .aab is the target."
fi

# Add an exit condition
echo "Build completed. Exiting script as requested."
exit 0  # Exit with success status

# Step 3: Check if the source .aab file exists
if [ ! -f "$SOURCE_FILE" ]; then
    echo "Error: Source .aab file $SOURCE_FILE does not exist."
    exit 1
fi

# Step 4: Copy the .aab file to the Windows directory (optional)
echo "Copying $SOURCE_FILE to $WINDOWS_DEST..."
if [ -d "$WINDOWS_DEST" ]; then
    cp "$SOURCE_FILE" "$WINDOWS_DEST"
    if [ $? -eq 0 ]; then
        echo "Successfully copied to $WINDOWS_DEST"
    else
        echo "Error: Failed to copy file to $WINDOWS_DEST"
        exit 1
    fi
else
    echo "Warning: $WINDOWS_DEST not accessible. Skipping copy to Windows."
fi

# Step 5: Check and install Firebase CLI if not installed
if ! command_exists firebase; then
    echo "Firebase CLI not found. Installing..."
    if command_exists npm; then
        npm install -g firebase-tools
        if [ $? -eq 0 ]; then
            echo "Firebase CLI installed successfully."
        else
            echo "Error: Failed to install Firebase CLI."
            exit 1
        fi
    else
        echo "Error: npm is required to install Firebase CLI. Please install Node.js first."
        exit 1
    fi
else
    echo "Firebase CLI is already installed."
fi

# Step 6: Log in to Firebase (skip if already logged in)
echo "Checking Firebase login status..."
firebase login --no-localhost > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "Successfully logged in to Firebase."
else
    echo "Firebase login required. Opening browser for authentication..."
    firebase login
    if [ $? -ne 0 ]; then
        echo "Error: Firebase login failed."
        exit 1
    fi
fi

# Step 7: Set the Firebase project
echo "Linking to Firebase project: $FIREBASE_PROJECT"
firebase use "$FIREBASE_PROJECT"
if [ $? -ne 0 ]; then
    echo "Error: Failed to link to Firebase project $FIREBASE_PROJECT."
    exit 1
fi

# Step 8: Copy file to a temporary directory for upload
mkdir -p "$TEMP_DIR"
cp "$SOURCE_FILE" "$TEMP_DIR/build.aab"

# Step 9: Upload to Firebase App Distribution
echo "Uploading .aab to Firebase App Distribution..."
if [ -f "$TESTERS_FILE" ]; then
    firebase appdistribution:distribute "$TEMP_DIR/build.aab" \
        --app "$APP_ID" \
        --release-notes "$RELEASE_NOTES" \
        --testers-file "$TESTERS_FILE"
else
    firebase appdistribution:distribute "$TEMP_DIR/build.aab" \
        --app "$APP_ID" \
        --release-notes "$RELEASE_NOTES" \
        --testers "email1@example.com,email2@example.com"  # Replace with actual tester emails
fi

if [ $? -eq 0 ]; then
    echo "Successfully uploaded to Firebase App Distribution!"
else
    echo "Error: Failed to upload to Firebase App Distribution."
    exit 1
fi

# Clean up temporary directory
rm -rf "$TEMP_DIR"
echo "Cleaned up temporary files."