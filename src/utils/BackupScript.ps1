# Define paths  
$projectName = "LifeLog"
$rootProjectsFolder = "C:\Users\philk\Projects2"
$srcFolder = Join-Path -Path $rootProjectsFolder -ChildPath ($projectName + "\src")
$rootFolder = Join-Path -Path $rootProjectsFolder -ChildPath $projectName
$destinationRoot = "C:\Users\philk\Dropbox\smartCity\backups"
$destination = Join-Path -Path $destinationRoot -ChildPath $projectName
# New folder to include in the backup
$appFolder = "C:\Users\philk\Projects2\LifeLog\app"
# Define subfolder destinations
$srcDestination = Join-Path -Path $destination -ChildPath "src"
$appDestination = Join-Path -Path $destination -ChildPath "app"

# Specify additional files located at the root of the project
$rootFilesToInclude = @(
    ".gitignore",
    "BackupScript.ps1",
    "build_and_distribute.sh",
    "App.tsx",
    "App.css",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "README.md",
    "index.js",
    "react.d.ts",
    "react-native-realm.d.ts",
    "metro-config.js",
    "local.properties",
    "jest.config.js",
    "babel.config.js",
    "watchman.config"
)

# Step 1: Ensure the destination folder and subfolders exist
if (!(Test-Path -Path $destination)) {
    New-Item -ItemType Directory -Force -Path $destination
}
if (!(Test-Path -Path $srcDestination)) {
    New-Item -ItemType Directory -Force -Path $srcDestination
}
if (!(Test-Path -Path $appDestination)) {
    New-Item -ItemType Directory -Force -Path $appDestination
}

# Step 2: Copy all contents of the `src` folder to `LifeLog/src`, including subdirectories
Write-Host "Copying all contents from src to LifeLog/src (including subfolders)..."
Robocopy $srcFolder $srcDestination /E /XO
Write-Host "All contents from src copied successfully."

# Step 3: Copy all contents of the `app` folder to `LifeLog/app`, including subdirectories
Write-Host "Copying all contents from app to LifeLog/app (including subfolders)..."
Robocopy $appFolder $appDestination /E /XO
Write-Host "All contents from app copied successfully."

# Step 4: Copy specific files from the root folder to the root of `LifeLog`
Write-Host "Copying specific root-level files..."
foreach ($file in $rootFilesToInclude) {
    $sourceFile = Join-Path -Path $rootFolder -ChildPath $file
    $destinationFile = Join-Path -Path $destination -ChildPath $file

    if (Test-Path -Path $sourceFile) {
        Copy-Item -Path $sourceFile -Destination $destinationFile -Force
        Write-Host "Copied: $file"
    } else {
        Write-Host "File not found: $file"
    }
}

# Step 5: Log the operation in two locations
# Log file in the destination folder
$destinationLogFile = Join-Path -Path $destination -ChildPath "backup_log.txt"
"Backup completed on $(Get-Date)" | Out-File -Append -FilePath $destinationLogFile

# Log file in the project root folder
$projectRootLogFile = Join-Path -Path $rootFolder -ChildPath "backup_log.txt"
"Backup completed on $(Get-Date)" | Out-File -Append -FilePath $projectRootLogFile

Write-Host "Backup completed and logs saved to both the destination and project root."