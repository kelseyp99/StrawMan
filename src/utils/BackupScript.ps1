#https://chatgpt.com/share/678fc6c8-75a0-8001-ad31-09c87f47c824
#C:\Users\philk\Projects\LifeLog3\src\utils\BackupScript.ps1
#powershell -ExecutionPolicy Bypass -File "C:\Users\philk\Projects\LifeLog3\utils\BackupScript.ps1"
# Define paths
$projectName = "LifeLog"
$rootProjectsFolder = "C:\Users\philk\Projects"
$srcFolder = Join-Path -Path $rootProjectsFolder -ChildPath ($projectName + "\src")
$rootFolder = Join-Path -Path $rootProjectsFolder -ChildPath $projectName
$destinationRoot = "C:\Users\philk\Dropbox\smartCity\backups"
$destination = Join-Path -Path $destinationRoot -ChildPath $projectName

# Specify additional files located at the root of the project
$rootFilesToInclude = @(
    ".gitignore",
    "BackupScript.ps1",
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

# Step 1: Ensure the destination folder exists
if (!(Test-Path -Path $destination)) {
    New-Item -ItemType Directory -Force -Path $destination
}

# Step 2: Copy all contents of the `src` folder, including subdirectories
Write-Host "Copying all contents from src (including subfolders)..."
Robocopy $srcFolder $destination /E /XO
Write-Host "All contents from src copied successfully."

# Step 3: Copy specific files from the root folder
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

# Step 4: Log the operation in two locations
# Log file in the destination folder
$destinationLogFile = Join-Path -Path $destination -ChildPath "backup_log.txt"
"Backup completed on $(Get-Date)" | Out-File -Append -FilePath $destinationLogFile

# Log file in the project root folder
$projectRootLogFile = Join-Path -Path $rootFolder -ChildPath "backup_log.txt"
"Backup completed on $(Get-Date)" | Out-File -Append -FilePath $projectRootLogFile

Write-Host "Backup completed and logs saved to both the destination and project root."

