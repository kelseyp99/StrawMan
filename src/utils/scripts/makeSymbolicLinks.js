#!/bin/bash

//Script to set symbolic links for Android SDK tools across versions in WSL2
//Run in WSL2 (Ubuntu) with sudo privileges

//Android SDK base path
ANDROID_SDK="/mnt/c/Users/philk/AppData/Local/Android/Sdk"
BUILD_TOOLS_35="$ANDROID_SDK/build-tools/35.0.0"
BUILD_TOOLS_34="$ANDROID_SDK/build-tools/34.0.0"
PLATFORM_TOOLS="$ANDROID_SDK/platform-tools"

//Project directory (for env setup)
PROJECT_DIR="$(pwd)"

//Check if Android SDK exists
if [ ! -d "$ANDROID_SDK" ]; then
    echo "Error: Android SDK not found at $ANDROID_SDK. Update the path in the script."
    exit 1
fi

//Function to create a symbolic link if the source exists
create_link() {
    local src="$1"
    local dest="$2"
    if [ -f "$src" ]; then
        sudo ln -sf "$src" "$dest"
        echo "Linked: $dest -> $src"
        ls -l "$dest"
    else
        echo "Warning: $src not found, skipping."
    fi
}

//Set links in build-tools/35.0.0
cd "$BUILD_TOOLS_35" || {
    echo "Error: Cannot cd to $BUILD_TOOLS_35"
    exit 1
}
echo "Setting links in $BUILD_TOOLS_35:"
create_link "aapt.exe" "aapt"
create_link "zipalign.exe" "zipalign"
create_link "d8.exe" "d8"
create_link "apkanalyzer.exe" "apkanalyzer"
create_link "dx.exe" "dx"
create_link "lib64/libc++_shared.so" "libc++_shared.so"  //Sometimes needed for NDK

//Set links in build-tools/34.0.0
if [ -d "$BUILD_TOOLS_34" ]; then
    cd "$BUILD_TOOLS_34" || {
        echo "Error: Cannot cd to $BUILD_TOOLS_34"
        exit 1
    }
    echo "Setting links in $BUILD_TOOLS_34:"
    create_link "aapt.exe" "aapt"
    create_link "zipalign.exe" "zipalign"
    create_link "d8.exe" "d8"
    create_link "apkanalyzer.exe" "apkanalyzer"
    create_link "dx.exe" "dx"
    create_link "lib64/libc++_shared.so" "libc++_shared.so"
else
    echo "Warning: $BUILD_TOOLS_34 not found, skipping."
fi

//Set links in platform-tools
cd "$PLATFORM_TOOLS" || {
    echo "Error: Cannot cd to $PLATFORM_TOOLS"
    exit 1
}
echo "Setting links in $PLATFORM_TOOLS:"
create_link "adb.exe" "adb"
create_link "fastboot.exe" "fastboot"
create_link "mksdcard.exe" "mksdcard"

//Set environment variables
export ANDROID_HOME="$ANDROID_SDK"
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
export PATH="/usr/bin:$JAVA_HOME/bin:$PATH:$PLATFORM_TOOLS:$BUILD_TOOLS_35${BUILD_TOOLS_34:+:$BUILD_TOOLS_34}"
export GRADLE_USER_HOME="$HOME/gradle-cache"

//Verify key tools
echo "Verifying tools:"
/usr/bin/cmake --version || echo "CMake not working! Install with 'sudo apt install cmake'"
java -version || echo "Java not working! Install with 'sudo apt install openjdk-17-jdk'"
"$BUILD_TOOLS_35/aapt" v || echo "AAPT (35) not working!"
"$PLATFORM_TOOLS/adb" --version || echo "ADB not working!"

//Save environment to a file for sourcing later
cat << EOF > "$PROJECT_DIR/set-env.sh"
export ANDROID_HOME="$ANDROID_SDK"
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
export PATH="/usr/bin:$JAVA_HOME/bin:\$PATH:$PLATFORM_TOOLS:$BUILD_TOOLS_35${BUILD_TOOLS_34:+:$BUILD_TOOLS_34}"
export GRADLE_USER_HOME="$HOME/gradle-cache"
EOF

echo "Environment variables set and saved to $PROJECT_DIR/set-env.sh"
echo "Source it with: source $PROJECT_DIR/set-env.sh"
echo "Run your build with: npx expo run:android"