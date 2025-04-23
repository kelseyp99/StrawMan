param (
    [string]$Arg1, # First argument: environment (local/cloud) or profile (dev/prod)
    [string]$Arg2  # Second argument: profile (dev/prod) if Arg1 is environment
)

$buildScript = ".\src\utils\scripts\build.ps1"

# Normalize arguments
$Environment = $null
$Profile = $null

# Handle cases based on arguments
if (-not $Arg1) {
    # No arguments: default to local dev
    Write-Host "No arguments provided, defaulting to local development build..."
    & $buildScript -Local
    exit 0
}

# Check if Arg1 is an environment or profile
switch ($Arg1.ToLower()) {
    {$_ -in "local", "cloud"} {
        # Arg1 is environment
        $Environment = $Arg1.ToLower()
        if ($Arg2) {
            $Profile = $Arg2.ToLower()
        } else {
            # Only environment specified, default to dev
            $Profile = "dev"
        }
    }
    {$_ -in "dev", "development", "prod", "production"} {
        # Arg1 is profile, default to local
        $Environment = "local"
        $Profile = $Arg1.ToLower()
        if ($Arg2) {
            Write-Host "Error: Invalid second argument '$Arg2'. Usage: npm start [{local,cloud} | {dev,prod}] [{dev,prod}]" -ForegroundColor Red
            exit 1
        }
    }
    default {
        Write-Host "Error: Invalid first argument '$Arg1'. Use 'local', 'cloud', 'dev', 'development', 'prod', or 'production'." -ForegroundColor Red
        exit 1
    }
}

# Validate and execute build
switch ($Environment) {
    "local" {
        switch ($Profile) {
            {$_ -in "dev", "development"} {
                Write-Host "Running local development build..."
                & $buildScript -Local
            }
            {$_ -in "prod", "production"} {
                Write-Host "Running local production build..."
                & $buildScript -Production
            }
            default {
                Write-Host "Error: Invalid profile '$Profile'. Use 'dev', 'development', 'prod', or 'production'." -ForegroundColor Red
                exit 1
            }
        }
    }
    "cloud" {
        switch ($Profile) {
            {$_ -in "dev", "development"} {
                Write-Host "Running cloud development build..."
                & $buildScript -CloudMain -Dev
            }
            {$_ -in "prod", "production"} {
                Write-Host "Running cloud production build..."
                & $buildScript -CloudMain
            }
            default {
                Write-Host "Error: Invalid profile '$Profile'. Use 'dev', 'development', 'prod', or 'production'." -ForegroundColor Red
                exit 1
            }
        }
    }
    default {
        Write-Host "Error: Invalid environment '$Environment'. Use 'local' or 'cloud'." -ForegroundColor Red
        exit 1
    }
}