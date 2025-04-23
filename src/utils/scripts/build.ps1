# build.ps1 (in src\utils\scripts\)

param (
    [switch]$Local,      # Build locally with development profile
    [switch]$Firebase,   # Upload to Firebase
    [switch]$CloudMain,  # Cloud build on main branch
    [switch]$Production, # Build local production APK (default)
    [switch]$Dev,        # Use development profile for cloud build
    [switch]$Android,    # Build for Android
    [switch]$Ios,        # Build for iOS
    [switch]$Both        # Build for both Android and iOS
)

$projectDir = "C:\Users\philk\Projects2\LifeLog"
# Get the current Git branch
$Branch = git rev-parse --abbrev-ref HEAD
$commitMessage = "Automated commit: Update and build for branch $Branch"
$downloadsDir = "C:\Users\philk\Downloads"
$wslProjectDir = "/mnt/c/Users/philk/Projects2/LifeLog"
$wslScriptsDir = "$wslProjectDir/src/utils/scripts"
$firebaseAppId = "1:341732508688:android:4a8c275e1199f4e1c0e8b4"
$releaseNotes = "New build uploaded on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$testers = "werkhardor@gmail.com"  # Updated with your email

Set-Location -Path $projectDir

Write-Host "Current branch: $Branch"
Write-Host "Committing and pushing changes from PowerShell to $Branch..."
git checkout $Branch
git add .
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    git push origin $Branch
} else {
    Write-Host "Nothing to commit, proceeding..."
}

# Determine platforms
$platforms = @()
if ($Android -or $Both -or (-not $Ios -and -not $Both)) {
    $platforms += "android"
}
if ($Ios -or $Both) {
    $platforms += "ios"
}
if (-not $platforms) {
    Write-Host "No platform specified, defaulting to Android..."
    $platforms += "android"
}

# Build locally or in cloud based on flags
if ($Local -or $Production -or $CloudMain -or -not ($Local -or $Production -or $CloudMain)) {
    Write-Host "Initializing WSL with pull and build script for branch $Branch..."
    Write-Host "Generating build_and_distribute.sh in WSL..."

    # Generate build_and_distribute.sh in WSL with LF line endings
    $scriptContent = @'
#!/bin/bash
# build_and_distribute.sh [--build-only | --production | --cloud | --dev] [--branch <branch-name>] [--android | --ios | --both]
PROJECT_DIR="/mnt/c/Users/philk/Projects2/LifeLog"
WINDOWS_DEST="/mnt/c/Users/philk/Downloads/"

set -e

BUILD_ONLY=false
PROFILE="production"
CLOUD=false
BRANCH="'$Branch'"
PLATFORMS="android"

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --build-only)
            BUILD_ONLY=true
            PROFILE="development"
            shift
            ;;
        --production)
            PROFILE="production"
            shift
            ;;
        --cloud)
            CLOUD=true
            shift
            ;;
        --dev)
            PROFILE="development"
            shift
            ;;
        --android)
            PLATFORMS="android"
            shift
            ;;
        --ios)
            PLATFORMS="ios"
            shift
            ;;
        --both)
            PLATFORMS="android,ios"
            shift
            ;;
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        *)
            echo "Error: Unknown option: $1"
            echo "Usage: $0 [--build-only | --production | --cloud | --dev] [--branch <branch-name>] [--android | --ios | --both]"
            exit 1
            ;;
    esac
done

echo "Setting up environment and pulling latest changes..."
cd "$PROJECT_DIR" || { echo "Error: Failed to change to $PROJECT_DIR"; exit 1; }
git fetch origin -v
git checkout -f "$BRANCH"
git clean -fd
git reset --hard "origin/$BRANCH"
npx expo-doctor || echo "Warning: expo-doctor issues"

echo "Setting up Android environment..."
export ANDROID_HOME=/home/kelseyp99/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

rm -rf ~/.gradle/caches ~/.eas/build

echo "Running EAS build for platforms: $PLATFORMS with profile $PROFILE..."
IFS=',' read -ra PLATFORM_ARRAY <<< "$PLATFORMS"
for PLATFORM in "${PLATFORM_ARRAY[@]}"; do
    if [ "$CLOUD" = true ]; then
        EXPO_PUBLIC_IS_EXPO_GO=false eas build --platform $PLATFORM --profile $PROFILE --clear-cache
    else
        EXPO_PUBLIC_IS_EXPO_GO=false eas build --platform $PLATFORM --local --profile $PROFILE --clear-cache
    fi
done

echo "Locating latest build artifacts..."
if [[ "$PLATFORMS" == *"android"* ]]; then
    LATEST_APK=$(find "$PROJECT_DIR" -maxdepth 1 -name '*.apk' -exec stat -c '%Y %n' {} + | sort -nr | head -n1 | awk '{print $2}')
    LATEST_AAB=$(find "$PROJECT_DIR" -maxdepth 1 -name '*.aab' -exec stat -c '%Y %n' {} + | sort -nr | head -n1 | awk '{print $2}')
    echo "Latest APK: $LATEST_APK"
    echo "Latest AAB: $LATEST_AAB"
fi
if [[ "$PLATFORMS" == *"ios"* ]]; then
    LATEST_IPA=$(find "$PROJECT_DIR" -maxdepth 1 -name '*.ipa' -exec stat -c '%Y %n' {} + | sort -nr | head -n1 | awk '{print $2}')
    echo "Latest IPA: $LATEST_IPA"
fi

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
    if [ -n "$LATEST_IPA" ]; then
        mv "$LATEST_IPA" "$WINDOWS_DEST"
        if [ $? -eq 0 ]; then
            echo "Successfully moved $LATEST_IPA to $WINDOWS_DEST"
        else
            echo "Error: Failed to move $LATEST_IPA to $WINDOWS_DEST"
            exit 1
        fi
    fi
else
    echo "Error: $WINDOWS_DEST not accessible."
    exit 1
fi

if [ "$BUILD_ONLY" = false ]; then
    echo "Committing and pushing changes from WSL to origin/$BRANCH..."
    git checkout "$BRANCH" || { echo "Error: Branch $BRANCH does not exist locally"; exit 1; }
    git add .
    git commit -m "Automated commit from WSL: Build artifacts for $PROFILE profile on $BRANCH" || echo "Nothing to commit in WSL"
    git push origin "$BRANCH" || { echo "Error: Failed to push from WSL"; exit 1; }
fi

echo "Running BackupScript.ps1..."
powershell -ExecutionPolicy Bypass -File "$PROJECT_DIR/src/utils/scripts/BackupScript.ps1"

echo "Script completed successfully!"
'@

    # Write script to WSL
    try {
        # Ensure the scripts directory exists
        wsl -d Ubuntu -e bash -c "mkdir -p $wslScriptsDir"
        # Write the script with LF endings
        $scriptContent | Out-File -FilePath "$projectDir\src\utils\scripts\build_and_distribute.sh" -Encoding ASCII
        # Fix permissions in WSL
        wsl -d Ubuntu -e bash -c "chmod +x $wslScriptsDir/build_and_distribute.sh"
        Write-Host "Generated build_and_distribute.sh in WSL."
        # Fallback: Fix line endings for all .sh files
        wsl -d Ubuntu -e bash -c "find $wslScriptsDir -name '*.sh' -exec sed -i 's/\r$//' {} \;"
        Write-Host "Applied line-ending fix to all .sh files."
    } catch {
        Write-Host "Error: Failed to generate or fix build_and_distribute.sh in WSL: $_" -ForegroundColor Red
        exit 1
    }

    Write-Host "Running WSL build script..."
    if ($CloudMain) {
        Write-Host "Preparing cloud build by merging develop to main..."
        git checkout main
        git merge develop --ff-only
        if ($LASTEXITCODE -eq 0) {
            git push origin main
            Write-Host "Successfully merged develop to main for cloud build!"
        } else {
            Write-Host "Error: Failed to merge develop into main!" -ForegroundColor Red
            git checkout $Branch
            exit 1
        }
        $buildFlag = if ($Dev) { "--cloud --dev" } else { "--cloud" }
        $Branch = "main"  # Cloud build uses main branch
    } elseif ($Production) {
        $buildFlag = "--production"
    } else {
        $buildFlag = "--build-only"
    }
    $platformFlag = ""
    if ($Android) { $platformFlag = "--android" }
    elseif ($Ios) { $platformFlag = "--ios" }
    elseif ($Both) { $platformFlag = "--both" }
    else { $platformFlag = "--android" }  # Default to Android
    $buildOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./build_and_distribute.sh $buildFlag $platformFlag --branch $Branch" 2>&1
    Write-Host "WSL Build Output: $buildOutput"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: WSL build script failed!" -ForegroundColor Red
        exit 1
    }
    if ($CloudMain) {
        git checkout $Branch  # Return to original branch
    }
}

# Find latest build artifacts if building locally or uploading to Firebase
$latestApk = $null
$latestIpa = $null
if ($Local -or $Firebase -or $Production -or $CloudMain -or -not ($Local -or $Production -or $CloudMain)) {
    Write-Host "Finding latest build artifacts in Downloads..."
    if ($Android -or $Both -or -not ($Ios -or $Both)) {
        $latestApk = Get-ChildItem -Path $downloadsDir -Filter "*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestApk) {
            $apkPath = $latestApk.FullName
            Write-Host "Latest APK found: $apkPath"
        } else {
            Write-Host "No APK found in $downloadsDir!" -ForegroundColor Yellow
        }
    }
    if ($Ios -or $Both) {
        $latestIpa = Get-ChildItem -Path $downloadsDir -Filter "*.ipa" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestIpa) {
            $ipaPath = $latestIpa.FullName
            Write-Host "Latest IPA found: $ipaPath"
        } else {
            Write-Host "No IPA found in $downloadsDir!" -ForegroundColor Yellow
        }
    }
}

# Install APK on connected devices & emulators if -Local or -Production is specified
if (($Local -or $Production -or $CloudMain) -and $latestApk) {
    # Get list of connected devices (emulators + real devices)
    $deviceList = adb devices | Select-String "^(emulator-[0-9]+|\w+)\s+device" | ForEach-Object { $_.Matches.Groups[1].Value }

    if ($deviceList.Count -eq 0) {
        Write-Host "No devices or emulators are currently running." -ForegroundColor Red
        exit 1
    }

    foreach ($device in $deviceList) {
        Write-Host "`nInstalling APK on $device..."
        adb -s $device install -r $apkPath

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ APK installed successfully on $device."
            # Launch the app
            $packageName = "com.anonymous.lifelog"
            $mainActivity = "com.anonymous.lifelog.MainActivity"
            adb -s $device shell am start -n "$packageName/$mainActivity"
        } else {
            Write-Host "❌ Failed to install APK on $device." -ForegroundColor Red
        }
    }
} else {
    Write-Host "No APK to install on devices." -ForegroundColor Yellow
}

# Upload to Firebase if -Firebase is specified
if ($Firebase -and $latestApk) {
    Write-Host "Uploading APK to Firebase App Distribution..."
    if (Test-Path "firebase.cmd") {
        firebase appdistribution:distribute $apkPath --app $firebaseAppId --release-notes $releaseNotes --testers $testers
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Upload complete!"
        } else {
            Write-Host "Error: Failed to upload APK to Firebase!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Error: Firebase CLI not found, please install with 'npm install -g firebase-tools'!" -ForegroundColor Red
        exit 1
    }
}

# Run BackupScript.ps1
Write-Host "Running BackupScript.ps1..."
powershell -ExecutionPolicy Bypass -File "$projectDir\src\utils\scripts\BackupScript.ps1"

Write-Host "Script completed!"