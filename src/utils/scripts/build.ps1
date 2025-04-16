# build.ps1 (in src\utils\scripts\)

param (
    [switch]$Local,      # Build locally in WSL
    [switch]$Firebase,   # Upload to Firebase
    [switch]$CloudMain   # Copy develop to main for cloud build
)

$projectDir = "C:\Users\philk\Projects2\LifeLog"
$commitMessage = "Automated commit: Update and build"
$downloadsDir = "C:\Users\philk\Downloads"
$wslProjectDir = "/home/kelseyp99/projects/LifeLog"
$wslScriptsDir = "$wslProjectDir/src/utils/scripts"
$firebaseAppId = "1:341732508688:android:4a8c275e1199f4e1c0e8b4"
$releaseNotes = "New build uploaded on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$testers = "email1@example.com,email2@example.com"  # Replace with real emails

Set-Location -Path $projectDir

Write-Host "Committing and pushing changes from PowerShell..."
git add .
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    git push origin develop
} else {
    Write-Host "Nothing to commit, proceeding..."
}

# Build locally in WSL if -Local is specified
if ($Local) {
    Write-Host "Initializing WSL with pull and doctor script..."
    Write-Host "Running WSL pull and doctor script..."
    try {
        # Check if the script exists before running
        $scriptCheck = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ls -la ./manage_wsl.sh" 2>&1
        Write-Host "Script Check Output: $scriptCheck"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: manage_wsl.sh not found in $wslScriptsDir/!" -ForegroundColor Red
            exit 1
        }

        $pullOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./manage_wsl.sh" 2>&1
        Write-Host "WSL Pull Output: $pullOutput"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: WSL pull and doctor script failed!" -ForegroundColor Red
            exit 1
        }

        Write-Host "Running WSL build script..."
        $buildOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./build_and_distribute.sh --build-only" 2>&1
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
if ($Local -or $Firebase) {
    Write-Host "Finding latest APK in Downloads..."
    $latestApk = Get-ChildItem -Path $downloadsDir -Filter "build-*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestApk) {
        $apkPath = $latestApk.FullName
        Write-Host "Latest APK found: $apkPath"
    } else {
        Write-Host "No APK found in $downloadsDir!" -ForegroundColor Red
        exit 1
    }
}

# Install APK locally if built
if ($Local -and $latestApk) {
    Write-Host "Installing APK on emulator-5554..."
    adb -s emulator-5554 install $apkPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "APK installed successfully!"
    } else {
        Write-Host "Failed to install APK!" -ForegroundColor Red
        exit 1
    }
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
        git checkout develop
        exit 1
    }
    git checkout develop
}

# Start Expo dev client if local build was done
if ($Local) {
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