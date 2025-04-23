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

# Build locally in WSL if -Local or -Production is specified
if ($Local -or $Production) {
    Write-Host "Initializing WSL with pull and doctor script for branch $Branch..."
    Write-Host "Running WSL pull and doctor script..."
    try {
        # Check if the script exists before running
        $scriptCheck = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ls -la ./manage_wsl.sh" 2>&1
        Write-Host "Script Check Output: $scriptCheck"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: manage_wsl.sh not found in $wslScriptsDir/!" -ForegroundColor Red
            exit 1
        }

        # Fix line endings and permissions for manage_wsl.sh
        $fixScript = wsl -d Ubuntu -e bash -c "sed -i 's/\r$//' $wslScriptsDir/manage_wsl.sh && chmod +x $wslScriptsDir/manage_wsl.sh" 2>&1
        Write-Host "Fix Script Output: $fixScript"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Failed to fix line endings or permissions for manage_wsl.sh!" -ForegroundColor Red
            exit 1
        }

        $pullOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./manage_wsl.sh --branch $Branch" 2>&1
        Write-Host "WSL Pull Output: $pullOutput"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: WSL pull and doctor script failed!" -ForegroundColor Red
            exit 1
        }

        Write-Host "Running WSL build script..."
        $buildFlag = if ($Production) { "--production" } else { "--build-only" }
        $buildOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./build_and_distribute.sh $buildFlag --branch $Branch" 2>&1
        Write-Host "WSL Build Output: $buildOutput"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: WSL build script failed!" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "Error: WSL operation failed: $_" -ForegroundColor Red
        exit 1
    }
}

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
    } else {f
        Write-Host "Warning: Failed to close Expo instances, proceeding anyway." -ForegroundColor Yellow
    }

    Write-Host "Starting Expo dev client in a new terminal and selecting Android..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $projectDir; npx expo start --dev-client -c; 'a' | Out-Null"
}

Write-Host "Script completed!"