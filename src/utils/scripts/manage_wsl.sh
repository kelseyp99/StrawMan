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