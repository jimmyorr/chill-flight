#!/bin/sh
# Git pre-push hook: Ensure no uncommitted source changes exist before pushing
node scripts/check-clean-source.js --mode=source
if [ $? -ne 0 ]; then
  echo "❌ Git push aborted: Uncommitted changes detected in source code."
  echo "Please commit your changes before pushing."
  exit 1
fi
