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
$firebaseAppId = "1:341732508688:android:4a8c275e1199f4e1c0e8b4"
$releaseNotes = "New build uploaded on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$testers = "email1@example.com,email2@example.com"  # Replace with real emails

Set-Location -Path $projectDir

# Debug: Show parameter values
Write-Host "Parameters: Local=$Local, Firebase=$Firebase, CloudMain=$CloudMain"

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
    Write-Host "Opening WSL and running build script..."
    $maxAttempts = 2
    $attempt = 1
    $success = $false
    $timeoutSeconds = 300  # 5 minutes timeout per attempt

    while ($attempt -le $maxAttempts -and -not $success) {
        Write-Host "Attempt $attempt of $maxAttempts..."
        try {
            # Run WSL command with timeout
            $job = Start-Job -ScriptBlock {
                param($wslDir)
                wsl -d Ubuntu -e bash -c "cd $wslDir && ./src/utils/scripts/build_and_distribute.sh --build-only" 2>&1
            } -ArgumentList $wslProjectDir

            $wslOutput = Wait-Job -Job $job -Timeout $timeoutSeconds | Receive-Job
            if ($job.State -eq "Completed") {
                $exitCode = 0
            } else {
                $exitCode = 1
            }
            Remove-Job -Job $job -Force

            Write-Host "WSL Output: $wslOutput"
            if ($exitCode -eq 0) {
                $success = $true
            } else {
                Write-Host "WSL attempt $attempt failed with exit code $exitCode" -ForegroundColor Yellow
                if ($attempt -lt $maxAttempts) {
                    Write-Host "Retrying due to failure..." -ForegroundColor Yellow
                } else {
                    Write-Host "Error: WSL build script failed after $maxAttempts attempts!" -ForegroundColor Red
                    exit 1
                }
            }
        } catch {
            Write-Host "Error: Failed to execute WSL command on attempt $attempt!" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            if ($attempt -eq $maxAttempts) {
                exit 1
            }
        }
        $attempt++
        if (-not $success -and $attempt -le $maxAttempts) {
            Start-Sleep -Seconds 5  # Wait before retrying
        }
    }

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
        
        Write-Host "Restarting emulator-5554..."
        adb -s emulator-5554 emu kill 2>$null
        Start-Sleep -Seconds 2
        Start-Process -NoNewWindow -FilePath "emulator" -ArgumentList "-avd emulator-5554" -RedirectStandardOutput "$env:TEMP\emulator.log"
        Start-Sleep -Seconds 30

        Write-Host "Installing APK on emulator-5554..."
        adb -s emulator-5554 install $apkPath
        if ($LASTEXITCODE -eq 0) {
            Write-Host "APK installed successfully!"
        } else {
            Write-Host "Failed to install APK!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "Closing any existing npx expo start instances..."
        taskkill /IM "node.exe" /FI "WINDOWTITLE eq *npx expo start*" /F 2>$null
        if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 128) {
            Write-Host "Existing Expo instances closed (or none found)."
        } else {
            Write-Host "Warning: Failed to close Expo instances, proceeding anyway." -ForegroundColor Yellow
        }

        Write-Host "Starting Expo dev client in a new terminal and selecting Android..."
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $projectDir; npx expo start --dev-client -c; 'a' | Out-Null"
    } else {
        Write-Host "No APK found in $downloadsDir!" -ForegroundColor Red
        exit 1
    }
}

# Upload to Firebase if -Firebase is specified
if ($Firebase) {
    Write-Host "Finding latest APK in Downloads..."
    $latestApk = Get-ChildItem -Path $downloadsDir -Filter "build-*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestApk) {
        $apkPath = $latestApk.FullName
        Write-Host "Latest APK found: $apkPath"
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
    } else {
        Write-Host "No APK found in $downloadsDir!" -ForegroundColor Red
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

# Backup after all operations (optional)
Write-Host "Backing up project files to Dropbox..."
if (Test-Path "src\utils\BackupScript.ps1") {
    & "src\utils\BackupScript.ps1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "BackupScript.ps1 executed successfully!"
    } else {
        Write-Host "Warning: BackupScript.ps1 failed, but build completed!" -ForegroundColor Yellow
    }
} else {
    Write-Host "Warning: BackupScript.ps1 not found in src\utils\, skipping backup..." -ForegroundColor Yellow
}

Write-Host "Script completed!"