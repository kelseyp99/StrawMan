# build.ps1

# Set project directory
$projectDir = "C:\Users\philk\Projects2\LifeLog"
$commitMessage = "Automated commit: Update and build"
$downloadsDir = "C:\Users\philk\Downloads"

# Navigate to project directory
Set-Location -Path $projectDir

# Git commit and push
Write-Host "Committing and pushing changes..."
git add .
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    git push origin develop
} else {
    Write-Host "Nothing to commit, proceeding to build..."
}

# Open WSL and run build script
Write-Host "Opening WSL and running build script..."
wsl -d Ubuntu -e bash -c "cd /mnt/c/Users/philk/Projects2/LifeLog && ./src/utils/scripts/build_and_distribute.sh --build-only"

# Find the latest APK in Downloads
Write-Host "Finding latest APK in Downloads..."
$latestApk = Get-ChildItem -Path $downloadsDir -Filter "build-*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestApk) {
    $apkPath = $latestApk.FullName
    Write-Host "Latest APK found: $apkPath"
    
    # Install APK on emulator-5554
    Write-Host "Installing APK on emulator-5554..."
    adb -s emulator-5554 install $apkPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "APK installed successfully!"
    } else {
        Write-Host "Failed to install APK!" -ForegroundColor Red
        exit 1
    }
    
    # Start Expo dev client
    Write-Host "Starting Expo dev client..."
    npx expo start --dev-client -c
} else {
    Write-Host "No APK found in $downloadsDir!" -ForegroundColor Red
    exit 1
}

Write-Host "Script completed!"