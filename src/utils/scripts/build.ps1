# build.ps1 (in src\utils\scripts\)

$projectDir = "C:\Users\philk\Projects2\LifeLog"
$commitMessage = "Automated commit: Update and build"
$downloadsDir = "C:\Users\philk\Downloads"
$wslProjectDir = "/home/kelseyp99/projects/LifeLog"

Set-Location -Path $projectDir

Write-Host "Committing and pushing changes from PowerShell..."
git add .
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    git push origin develop
} else {
    Write-Host "Nothing to commit, proceeding to build..."
}

Write-Host "Opening WSL and running build script..."
wsl -d Ubuntu -e bash -c "cd $wslProjectDir && ./src/utils/scripts/build_and_distribute.sh --build-only"

Write-Host "Pulling latest changes from WSL build..."
try {
    git pull origin develop --ff-only -ErrorAction Stop
} catch {
    Write-Host "Error: Pull failed, merge required!" -ForegroundColor Red
    exit 1
}

Write-Host "Finding latest APK in Downloads..."
$latestApk = Get-ChildItem -Path $downloadsDir -Filter "build-*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestApk) {
    $apkPath = $latestApk.FullName
    Write-Host "Latest APK found: $apkPath"
    
    Write-Host "Installing APK on emulator-5554..."
    adb -s emulator-5554 install $apkPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "APK installed successfully!"
    } else {
        Write-Host "Failed to install APK!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Starting Expo dev client..."
    npx expo start --dev-client -c
} else {
    Write-Host "No APK found in $downloadsDir!" -ForegroundColor Red
    exit 1
}

Write-Host "Backinging up project files to Dropbox"
if (Test-Path "src\utils\BackupScript.ps1") {
    & "src\utils\BackupScript.ps1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "BackupScript.ps1 executed successfully!"
    } else {
        Write-Host "Error: BackupScript.ps1 failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Error: BackupScript.ps1 not found in src\utils\!" -ForegroundColor Red
    exit 1
}

Write-Host "Script completed!"