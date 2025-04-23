#!/bin/bash
# ./src/utils/scripts/build_and_distribute.sh [--build-only|--production] [--branch <branch>]
buildFlag="$1"; shift
branch="$2"
cd "$PROJECT_DIR"
git fetch origin
git checkout -f "$branch"
npm install
npx expo build:android ${buildFlag}
# (add your distribution/upload commands here)
