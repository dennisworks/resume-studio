#!/usr/bin/env bash
# Build Resume Studio and ad-hoc sign it so macOS Gatekeeper accepts it.
# Usage: scripts/build.sh
set -euo pipefail

cd "$(dirname "$0")/.."

source "$HOME/.cargo/env"

echo "==> Building..."
npm run tauri build

APP="src-tauri/target/release/bundle/macos/Resume Studio.app"

echo "==> Signing $APP (ad-hoc)..."
codesign --sign - --deep --force "$APP"
codesign --verify --verbose "$APP"

echo "==> Done. App is at: $(pwd)/$APP"
echo "    Drag it into /Applications to install."
