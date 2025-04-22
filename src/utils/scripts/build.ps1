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
    try {
        # Verify manage_wsl.sh exists
        $scriptCheck = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ls -la manage_wsl.sh" 2>&1
        Write-Host "Script Check Output: $scriptCheck"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: manage_wsl.sh not found in $wslScriptsDir!" -ForegroundColor Red
            exit 1
        }

        # Recreate manage_wsl.sh on Windows side
        $manageContent = @'
#!/bin/bash
# ./src/utils/scripts/manage_wsl.sh [--branch <branch-name>]
PROJECT_DIR="/home/kelseyp99/projects/LifeLog"
DEFAULT_BRANCH="develop"
BRANCH="$DEFAULT_BRANCH"
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --branch) BRANCH="$2"; shift 2 ;;
        *) echo "Usage: $0 [--branch <branch-name>]"; exit 1 ;;
    esac
done
cd "$PROJECT_DIR"
git fetch origin -v
git checkout -f "$BRANCH"
git clean -fd
git reset --hard "origin/$BRANCH"
npx expo-doctor || echo "Warning: expo-doctor issues"
'@
        $winManagePath = Join-Path $projectDir 'src\utils\scripts\manage_wsl.sh'
        $manageContent | Out-File -FilePath $winManagePath -Encoding ascii -Force
        (Get-Content $winManagePath -Raw) -replace "`r`n","`n" | Set-Content $winManagePath -Encoding ascii -NoNewline
        wsl -d Ubuntu -e bash -c "chmod +x $wslScriptsDir/manage_wsl.sh" | Out-Null

        # Run the manage script
        $pullOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./manage_wsl.sh --branch $Branch" 2>&1
        Write-Host "WSL Pull Output: $pullOutput"
        if ($LASTEXITCODE -ne 0) { throw "manage_wsl.sh failed" }

        # Show build_and_distribute.sh on WSL for debugging
        Write-Host "Contents of build_and_distribute.sh in WSL:"
        $catOut = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && cat build_and_distribute.sh" 2>&1
        Write-Host $catOut

        # Recreate build_and_distribute.sh on Windows side
        $buildDistContent = @'
#!/bin/bash
# ./src/utils/scripts/build_and_distribute.sh [--build-only|--production] [--branch <branch>]
buildFlag="$1"; shift
branch="$2"
cd "$PROJECT_DIR"
git fetch origin
git checkout -f "$branch"
npm install
npx expo build:android ${buildFlag}
# (add your distribution/upload commands here)
'@
        $winBuildDistPath = Join-Path $projectDir 'src\utils\scripts\build_and_distribute.sh'
        $buildDistContent | Out-File -FilePath $winBuildDistPath -Encoding ascii -Force
        (Get-Content $winBuildDistPath -Raw) -replace "`r`n","`n" | Set-Content $winBuildDistPath -Encoding ascii -NoNewline
        wsl -d Ubuntu -e bash -c "chmod +x $wslScriptsDir/build_and_distribute.sh" | Out-Null

        # Run the build_and_distribute script
        Write-Host "Running build_and_distribute.sh..."
        $flag = if ($Production) { "--production" } else { "--build-only" }
        $buildOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./build_and_distribute.sh $flag $Branch" 2>&1
        Write-Host "WSL Build Output: $buildOutput"
        if ($LASTEXITCODE -ne 0) { throw "build_and_distribute.sh failed" }
    }
    catch {
        Write-Host "Error during WSL steps: $_" -ForegroundColor Red
        exit 1
    }
}

# Find the latest APK in Downloads
if ($Local -or $Firebase -or $Production) {
    Write-Host "Finding latest APK in Downloads..."
    $latestApk = Get-ChildItem $downloadsDir -Filter "*.apk" |
                 Sort LastWriteTime -Descending | Select -First 1
    if (-not $latestApk) {
        Write-Host "No APK found!" -ForegroundColor Red
        exit 1
    }
    $apkPath = $latestApk.FullName
    Write-Host "Latest APK: $apkPath"
}

# Install APK on emulator and devices
if ($Local -or $Production) {
    adb -s emulator-5554 install -r $apkPath
    adb devices | Where { $_ -match "device$" -and $_ -notmatch "emulator" } |
        ForEach {
            $id = ($_ -split "`t")[0]
            adb -s $id install -r $apkPath
        }
}

# Upload to Firebase if needed
if ($Firebase) {
    firebase appdistribution:distribute $apkPath --app your_firebase_app_id --groups testers
}

# Merge develop → main if requested
if ($CloudMain) {
    git checkout main
    git merge --no-ff develop -m "Merge develop into main"
    git push origin main
    git checkout develop
}

# Start Expo dev client
if ($Local -and -not $Production) {
    Start-Process powershell -Arg "-NoExit","-Command","cd `"$projectDir`"; npx expo start --dev-client -c"
}

Write-Host "build.ps1 completed successfully!"
