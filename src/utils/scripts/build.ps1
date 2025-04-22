```powershell
# build.ps1 (in src\utils\scripts)

param (
    [switch]$Local,      # Build locally in WSL
    [switch]$Firebase,   # Upload to Firebase
    [switch]$CloudMain,  # Copy develop to main for cloud build
    [switch]$Production  # Build production APK with developmentClient: false
)

# Paths and branch info
$projectDir    = "C:\Users\philk\Projects2\LifeLog"
$wslProjectDir = "/mnt/c/Users/philk/Projects2/LifeLog"
$wslScriptsDir = "$wslProjectDir/src/utils/scripts"
$downloadsDir  = "C:\Users\philk\Downloads"

# Determine current Git branch
$Branch = git rev-parse --abbrev-ref HEAD
$commitMessage = "Automated commit: Update and build for branch $Branch"

# Stage and push any pending changes
git add .
$diff = git diff --cached --name-only
if ($diff) {
    Write-Host "Committing and pushing changes from PowerShell to $Branch..."
    git commit -m $commitMessage
    git push origin $Branch
} else {
    Write-Host "Nothing to commit, proceeding..."
}

# If building locally (or production), run WSL pull+doctor+build
if ($Local -or $Production) {
    Write-Host "Initializing WSL with pull and doctor script for branch $Branch..."
    Write-Host "Running WSL pull and doctor script..."
    try {
        # Verify manage_wsl.sh exists
        $scriptCheck = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ls -la manage_wsl.sh" 2>&1
        Write-Host "Script Check Output: $scriptCheck"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: manage_wsl.sh not found in $wslScriptsDir!" -ForegroundColor Red
            exit 1
        }

        # Recreate manage_wsl.sh on Windows side with proper encoding & line endings
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

        # Write the script out (UTF-8 no BOM)
        $windowsScriptPath = Join-Path $projectDir 'src\utils\scripts\manage_wsl.sh'
        $scriptContent | Out-File -FilePath $windowsScriptPath -Encoding UTF8NoBOM -Force

        # Normalize to Unix line endings
        (Get-Content $windowsScriptPath -Raw) -replace "`r`n", "`n" |
            Set-Content $windowsScriptPath -NoNewline

        Write-Host "manage_wsl.sh recreated on Windows side at $windowsScriptPath"

        # Make it executable in WSL
        $chmodOutput = wsl -d Ubuntu -e bash -c "chmod +x $wslScriptsDir/manage_wsl.sh" 2>&1
        Write-Host "chmod Output: $chmodOutput"

        # Run the pull & doctor steps in WSL
        $pullOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./manage_wsl.sh --branch $Branch" 2>&1
        Write-Host "WSL Pull Output: $pullOutput"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: WSL pull and doctor script failed!" -ForegroundColor Red
            exit 1
        }

        # Now run the WSL build script
        Write-Host "Running WSL build script..."
        $buildFlag = if ($Production) { "--production" } else { "--build-only" }
        $buildOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./build_and_distribute.sh $buildFlag --branch $Branch" 2>&1
        Write-Host "WSL Build Output: $buildOutput"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: WSL build script failed!" -ForegroundColor Red
            exit 1
        }
    }
    catch {
        Write-Host "Error: WSL operation failed: $_" -ForegroundColor Red
        exit 1
    }
}

# Find the latest APK in Downloads (for install or Firebase)
if ($Local -or $Firebase -or $Production) {
    Write-Host "Finding latest APK in Downloads..."
    $latestApk = Get-ChildItem -Path $downloadsDir -Filter "*.apk" |
                 Sort-Object LastWriteTime -Descending |
                 Select-Object -First 1
    if (-not $latestApk) {
        Write-Host "No APK found in $downloadsDir!" -ForegroundColor Red
        exit 1
    }
    $apkPath = $latestApk.FullName
    Write-Host "Latest APK found: $apkPath"
}

# Install APK on emulator and any attached devices
if ($Local -or $Production) {
    Write-Host "`nInstalling APK on emulator and attached devices..."
    # Emulator
    adb -s emulator-5554 install -r $apkPath
    # All other devices
    adb devices | Where-Object { $_ -match "device$" -and $_ -notmatch "emulator" } |
        ForEach-Object {
            $id = ($_ -split "`t")[0]
            Write-Host "Installing on $id..."
            adb -s $id install -r $apkPath
        }
}

# Upload to Firebase App Distribution if requested
if ($Firebase) {
    Write-Host "Uploading APK to Firebase App Distribution..."
    firebase appdistribution:distribute $apkPath --app your_firebase_app_id --groups testers
}

# Copy develop to main for Expo cloud build if requested
if ($CloudMain) {
    Write-Host "Copying develop to main for Expo cloud build..."
    git checkout main
    git merge --no-ff develop -m "Merge develop into main for cloud build"
    git push origin main
    git checkout develop
}

# Start Expo dev client (non-production)
if ($Local -and -not $Production) {
    Write-Host "Closing any existing Expo instances..."
    taskkill /IM "node.exe" /FI "WINDOWTITLE eq *npx expo start*" /F 2>$null

    Write-Host "Starting Expo dev client in a new terminal..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$projectDir`"; npx expo start --dev-client -c" 
}

Write-Host "build.ps1 script completed successfully!"
```