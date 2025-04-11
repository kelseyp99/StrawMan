#!/bin/bash
# ./src/utils/scripts/pull_and_doctor.sh

PROJECT_DIR="/home/kelseyp99/projects/LifeLog"

echo "Force pulling latest changes from origin/develop..."
cd "$PROJECT_DIR"
git fetch origin -v
git reset --hard origin/develop || { echo "Error: Failed to force pull from Git"; exit 1; }

echo "Running expo-doctor to check dependencies (informational only)..."
npx expo-doctor
if [ $? -eq 0 ]; then
    echo "Expo doctor completed successfully!"
else
    echo "Warning: Expo doctor reported issues, proceeding anyway..." >&2
fi

echo "Pull and doctor steps completed successfully!"