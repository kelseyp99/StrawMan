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
