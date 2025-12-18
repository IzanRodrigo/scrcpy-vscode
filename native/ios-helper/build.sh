#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Building ios-helper..."
swift build -c release --product ios-helper

# Simple ad-hoc signing - the binary inherits Screen Recording permission from parent process
echo "Signing ios-helper with ad-hoc signature..."
codesign --force --sign - .build/release/ios-helper

echo "Build complete: .build/release/ios-helper"
