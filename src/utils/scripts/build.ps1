# build.ps1 (in src\utils\scripts\)

param (
    [switch]$Local,      # Build locally in WSL
    [switch]$Firebase,   # Upload to Firebase
    [switch]$CloudMain,  # Copy develop to main for cloud build
    [switch]$Production  # Build production APK with developmentClient: false
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
# -------------------------------------------------
# Part of build.ps1: recreate manage_wsl.sh reliably
# -------------------------------------------------

# 1. Put the exact contents of manage_wsl.sh into a PowerShell here‑string.
$scriptContent = @'
#!/bin/bash
# ./src/utils/scripts/manage_wsl.sh [--branch <branch-name>]

PROJECT_DIR="/home/kelseyp99/projects/LifeLog"
DEFAULT_BRANCH="develop"
BRANCH="$DEFAULT_BRANCH"

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        *)
            echo "Error: Unknown option: $1"
            echo "Usage: $0 [--branch <branch-name>]"
            exit 1
            ;;
    esac
done

echo "Force pulling latest changes from origin/$BRANCH..."
cd "$PROJECT_DIR"
git fetch origin -v
git checkout -f "$BRANCH" || { echo "Error: Branch $BRANCH does not exist locally"; exit 1; }
git clean -fd
git reset --hard "origin/$BRANCH" || { echo "Error: Failed to force pull from Git"; exit 1; }

echo "Running expo-doctor to check dependencies (informational only)..."
npx expo-doctor
if [ $? -eq 0 ]; then
    echo "Expo doctor completed successfully!"
else
    echo "Warning: Expo doctor reported issues, proceeding anyway..." >&2
fi

echo "Pull and doctor steps completed successfully!"
'@

# 2. Write it out with UTF8 no BOM
$scriptContent | Out-File -FilePath ".\manage_wsl.sh" -Encoding UTF8NoBOM -Force

# 3. Normalize to Unix line endings (LF)
(Get-Content ".\manage_wsl.sh" -Raw) -replace "`r`n", "`n" |
    Set-Content ".\manage_wsl.sh" -NoNewline

# 4. Give it execute permission in WSL
bash -c "chmod +x ./manage_wsl.sh"

Write-Host "manage_wsl.sh recreated with proper encoding, line endings, and +x permission."


# Find latest APK if building locally or uploading to Firebase
$latestApk = $null
if ($Local -or $Firebase -or $Production) {
    Write-Host "Finding latest APK in Downloads..."
    $latestApk = Get-ChildItem -Path $downloadsDir -Filter "*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestApk) {
        $apkPath = $latestApk.FullName
        Write-Host "Latest APK found: $apkPath"
    } else {
        Write-Host "No APK found in $downloadsDir!" -ForegroundColor Red
        exit 1
    }
}

# Install APK on connected devices & emulators if -Local or -Production is specified
if (($Local -or $Production) -and $latestApk) {
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

# Copy develop to main if -CloudMain is specified
if ($CloudMain) {
    Write-Host "Copying develop to main for Expo cloud build..."
    git checkout main
    git merge develop --ff-only
    if ($LASTEXITCODE -eq 0) {
        git push origin main
        Write-Host "Successfully copied develop to main for Expo cloud build!"
    } else {
        Write-Host "Error: Failed to merge develop into main!" -ForegroundColor Red
        git checkout $Branch
        exit 1
    }
    git checkout $Branch
}

# Start Expo dev client if local build was done (not for production)
if ($Local -and -not $Production) {
    Write-Host "Closing any existing npx expo start instances..."
    taskkill /IM "node.exe" /FI "WINDOWTITLE eq *npx expo start*" /F 2>$null
    if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 128) {
        Write-Host "Existing Expo instances closed (or none found)."
    } else {
        Write-Host "Warning: Failed to close Expo instances, proceeding anyway." -ForegroundColor Yellow
    }

    Write-Host "Starting Expo dev client in a new terminal and selecting Android..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $projectDir; npx expo start --dev-client -c; 'a' | Out-Null"
}

Write-Host "Script completed!"