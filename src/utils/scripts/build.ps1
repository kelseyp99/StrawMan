# build.ps1 (in src\utils\scripts\)
#https://grok.com/chat/c08b2890-7511-4f92-a020-ac6487cf8184
#search term:  Build.ps1 with Safety Prompt
#adb install /home/kelseyp99/projects/LifeLog/build-1745596504143.apk
#for now run it manually in wsl with:
#    EXPO_NO_PREBUILD=1 EXPO_DEBUG=true npx eas build --platform android --profile production --local --non-interactive
param (
    [switch]$Local,
    [switch]$Firebase,
    [switch]$CloudMain,
    [switch]$Production,
    [switch]$Dev,
    [switch]$Android,
    [switch]$Ios,
    [switch]$Both
)

$projectDir = "C:\Users\philk\Projects2\LifeLog"
$Branch = git rev-parse --abbrev-ref HEAD
$commitMessage = "Automated commit: Update and build for branch $Branch"
$downloadsDir = "C:\Users\philk\Downloads"
$lifeLogDir = "$downloadsDir\LifeLog"
$wslProjectDir = "/mnt/c/Users/philk/Projects2/LifeLog"
$wslScriptsDir = "$wslProjectDir/src/utils/scripts"
$firebaseAppId = "1:341732508688:android:4a8c275e1199f4e1c0e8b4"
$releaseNotes = "New build uploaded on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$testers = "werkhardor@gmail.com"

Set-Location -Path $projectDir

Write-Host "Current branch: $Branch"
Write-Host "Committing and pushing changes..."
git checkout $Branch
git add .
git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    git push origin $Branch
} else {
    Write-Host "Nothing to commit, proceeding..."
}

$platforms = @()
if ($Android -or -not ($Ios -or $Both)) {
    $platforms += "android"
}
if (($Ios -or $Both) -and $CloudMain) {
    $platforms += "ios"
} elseif ($Ios -or $Both) {
    Write-Host "Error: iOS builds only supported for cloud builds (-CloudMain)." -ForegroundColor Red
    exit 1
}
if (-not $platforms) {
    Write-Host "No platform specified, defaulting to Android..."
    $platforms += "android"
}

if ($Local -or $Production -or $CloudMain -or -not ($Local -or $Production -or $CloudMain)) {
    Write-Host "Initializing WSL with pull and build script for branch $Branch..."

    # Compare WSL and PowerShell configs
    Write-Host "Comparing WSL and PowerShell configs..."
    $wslDir = "\\wsl$\Ubuntu\home\kelseyp99\projects\LifeLog"
    $psDir = "C:\Users\philk\Projects2\LifeLog"
    $files = @("app.json", "app.config.js", "eas.json", "package.json", "package-lock.json")

    $differences = $false
    foreach ($file in $files) {
        $wslFile = Join-Path $wslDir $file
        $psFile = Join-Path $psDir $file
        if (Test-Path $wslFile -and Test-Path $psFile) {
            $wslContent = Get-Content $wslFile -Raw
            $psContent = Get-Content $psFile -Raw
            if ($wslContent -ne $psContent) {
                Write-Host "Difference detected in $file"
                Write-Host "Run 'diff $wslFile $psFile' in WSL for details"
                $differences = $true
            }
        } else {
            Write-Host "File $file missing in one repository"
            $differences = $true
        }
    }

    if ($differences) {
        Write-Host "Config differences found. Proceed with Build.ps1? This may affect WSL state. (Y/N)"
        $response = Read-Host
        if ($response -ne "Y") {
            Write-Host "Build cancelled. Vet changes in WSL first."
            exit 1
        }
    } else {
        Write-Host "Configs match. Proceeding with Build.ps1."
    }

    Write-Host "Generating build_and_distribute.sh in WSL..."

    $scriptContent = @'
#!/bin/bash
PROJECT_DIR="/mnt/c/Users/philk/Projects2/LifeLog"
WINDOWS_DEST="/mnt/c/Users/philk/Downloads"
LIFELOG_DEST="/mnt/c/Users/philk/Downloads/LifeLog"

set -e

BUILD_ONLY=false
PROFILE="production"
CLOUD=false
BRANCH="'$Branch'"
PLATFORMS="android"

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

echo "Setting up build environment..."
export EXPO_PUBLIC_IS_EXPO_GO=false
export EXPO_NO_PREBUILD=1

rm -rf ~/.eas/build ~/.gradle/caches ~/.metro
npm cache clean --force

echo "Running EAS build for platforms: $PLATFORMS with profile $PROFILE..."
IFS=',' read -ra PLATFORM_ARRAY <<< "$PLATFORMS"
for PLATFORM in "${PLATFORM_ARRAY[@]}"; do
    if [ "$CLOUD" = true ]; then
        eas build --platform $PLATFORM --profile $PROFILE --no-wait --non-interactive
    else
        eas build --platform $PLATFORM --local --profile $PROFILE --no-wait --non-interactive --clear-cache
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
    if [ "$BUILD_ONLY" = true ]; then
        mkdir -p "$LIFELOG_DEST"
    fi

    if [ -n "$LATEST_APK" ]; then
        if [ "$BUILD_ONLY" = true ]; then
            mv "$LATEST_APK" "$LIFELOG_DEST"
            if [ $? -eq 0 ]; then
                echo "Successfully moved $LATEST_APK to $LIFELOG_DEST for development build"
            else
                echo "Error: Failed to move $LATEST_APK to $LIFELOG_DEST"
                exit 1
            fi
        else
            mv "$LATEST_APK" "$WINDOWS_DEST"
            if [ $? -eq 0 ]; then
                echo "Successfully moved $LATEST_APK to $WINDOWS_DEST for production build"
            else
                echo "Error: Failed to move $LATEST_APK to $WINDOWS_DEST"
                exit 1
            fi
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

echo "Script completed successfully!"
'@

    try {
        wsl -d Ubuntu -e bash -c "mkdir -p $wslScriptsDir"
        $scriptContent | Out-File -FilePath "$projectDir\src\utils\scripts\build_and_distribute.sh" -Encoding ASCII
        wsl -d Ubuntu -e bash -c "chmod +x $wslScriptsDir/build_and_distribute.sh"
        Write-Host "Generated build_and_distribute.sh in WSL."
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
        $Branch = "main"
    } elseif ($Local) {
        $buildFlag = "--build-only"
    } else {
        $buildFlag = "--production"
    }
    $platformFlag = ""
    if ($Android) {
        $platformFlag = "--android"
    } elseif ($Ios -and $CloudMain) {
        $platformFlag = "--ios"
    } elseif ($Both -and $CloudMain) {
        $platformFlag = "--both"
    } else {
        $platformFlag = "--android"
    }
    $buildOutput = wsl -d Ubuntu -e bash -c "cd $wslScriptsDir && ./build_and_distribute.sh $buildFlag $platformFlag --branch $Branch" 2>&1
    $buildOutput = $buildOutput -replace "`r`n", "`n"
    Write-Host "WSL Build Output:`n$buildOutput`n"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: WSL build script failed!" -ForegroundColor Red
        exit 1
    }
    if ($CloudMain) {
        git checkout $Branch
    }
}

$latestApk = $null
$latestIpa = $null
if ($Local -or $Production -or $CloudMain -or -not ($Local -or $Production -or $CloudMain)) {
    Write-Host "Finding latest build artifacts in Downloads..."
    if ($platforms -contains "android") {
        $latestApk = Get-ChildItem -Path $downloadsDir -Filter "*.apk" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestApk) {
            $apkPath = $latestApk.FullName
            Write-Host "Latest APK found: $apkPath"
        } else {
            Write-Host "No APK found in $downloadsDir!" -ForegroundColor Yellow
        }
    }
    if ($platforms -contains "ios") {
        $latestIpa = Get-ChildItem -Path $downloadsDir -Filter "*.ipa" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latestIpa) {
            $ipaPath = $latestIpa.FullName
            Write-Host "Latest IPA found: $ipaPath"
        } else {
            Write-Host "No IPA found in $downloadsDir!" -ForegroundColor Yellow
        }
    }
}

if ($Local -and $latestApk) {
    if (-not (Test-Path $lifeLogDir)) {
        New-Item -ItemType Directory -Path $lifeLogDir
    }
    Move-Item -Path $apkPath -Destination $lifeLogDir
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully moved $apkPath to $lifeLogDir for development build"
    } else {
        Write-Host "Error: Failed to move $apkPath to $lifeLogDir" -ForegroundColor Red
        exit 1
    }
} elseif ($Production -and $latestApk) {
    Write-Host "Uploading production APK to Firebase App Distribution..."
    if (Test-Path "firebase.cmd") {
        firebase appdistribution:distribute $apkPath --app $firebaseAppId --release-notes $releaseNotes --testers $testers
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Upload complete! Deleting $apkPath..."
            Remove-Item -Path $apkPath -Force
        } else {
            Write-Host "Error: Failed to upload APK to Firebase!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Firebase CLI not found, attempting to use npm firebase-tools..."
        npm install firebase-tools
        npx firebase appdistribution:distribute $apkPath --app $firebaseAppId --release-notes "$releaseNotes" --testers $testers
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Upload complete using npm firebase-tools! Deleting $apkPath..."
            Remove-Item -Path $apkPath -Force
        } else {
            Write-Host "Error: Failed to upload APK to Firebase using npm firebase-tools!" -ForegroundColor Red
            exit 1
        }
    }
}

if ($Firebase -and $latestApk -and -not ($Local -or $Production)) {
    Write-Host "Uploading APK to Firebase App Distribution (explicit -Firebase flag)..."
    if (Test-Path "firebase.cmd") {
        firebase appdistribution:distribute $apkPath --app $firebaseAppId --release-notes $releaseNotes --testers $testers
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Upload complete!"
        } else {
            Write-Host "Error: Failed to upload APK to Firebase!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Firebase CLI not found, attempting to use npm firebase-tools..."
        npm install firebase-tools
        npx firebase appdistribution:distribute $apkPath --app $firebaseAppId --release-notes "$releaseNotes" --testers $testers
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Upload complete using npm firebase-tools!"
        } else {
            Write-Host "Error: Failed to upload APK to Firebase using npm firebase-tools!" -ForegroundColor Red
            exit 1
        }
    }
}

if (($Local -or $Production -or $CloudMain) -and $latestApk) {
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

Write-Host "Running BackupScript.ps1..."
powershell -ExecutionPolicy Bypass -File "$projectDir\src\utils\scripts\BackupScript.ps1"

Write-Host "Script completed!"