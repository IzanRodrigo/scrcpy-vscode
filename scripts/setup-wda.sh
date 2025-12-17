#!/bin/bash
#
# WebDriverAgent Setup Script for scrcpy-vscode
# This script automatically sets up and starts WebDriverAgent for iOS touch/keyboard input.
#
# Requirements:
#   - macOS with Xcode installed
#   - iOS device connected via USB
#   - Apple ID (free account works, but apps expire after 7 days)
#
# Usage: ./scripts/setup-wda.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
WDA_DIR="$HOME/.scrcpy-vscode/WebDriverAgent"
WDA_REPO="https://github.com/appium/WebDriverAgent.git"
NEEDS_FIRST_TIME_SETUP=false

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}▶${NC} ${BOLD}$1${NC}"
}

print_info() {
    echo -e "  ${CYAN}ℹ${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "  ${RED}✖${NC} $1"
}

print_success() {
    echo -e "  ${GREEN}✔${NC} $1"
}

print_skip() {
    echo -e "  ${CYAN}↷${NC} $1"
}

check_macos() {
    if [[ "$(uname)" != "Darwin" ]]; then
        print_error "This script only runs on macOS"
        exit 1
    fi
}

check_xcode() {
    print_step "Checking Xcode..."

    if ! command -v xcodebuild &> /dev/null; then
        print_error "Xcode is not installed"
        print_info "Please install Xcode from the App Store"
        exit 1
    fi

    if ! xcode-select -p &> /dev/null; then
        print_warning "Xcode command line tools not configured"
        print_info "Running: xcode-select --install"
        xcode-select --install
        exit 1
    fi

    local xcode_version
    xcode_version=$(xcodebuild -version 2>/dev/null | head -n1)
    print_success "$xcode_version"
}

check_iproxy() {
    print_step "Checking iproxy..."

    if ! command -v iproxy &> /dev/null; then
        print_warning "iproxy not installed, installing..."

        if ! command -v brew &> /dev/null; then
            print_error "Homebrew is not installed"
            print_info "Install from: https://brew.sh"
            exit 1
        fi

        brew install libimobiledevice
        print_success "iproxy installed"
    else
        print_success "iproxy available"
    fi
}

build_ios_helper() {
    print_step "Checking ios-helper..."

    local script_dir
    script_dir="$(cd "$(dirname "$0")" && pwd)"
    local project_root
    project_root="$(dirname "$script_dir")"
    local helper_dir="$project_root/native/ios-helper"
    local build_dir="$helper_dir/.build"

    # Check if already built
    for arch in "arm64-apple-macosx" "x86_64-apple-macosx" ""; do
        local check_path="$build_dir/${arch:+$arch/}release/ios-helper"
        if [[ -f "$check_path" ]]; then
            print_success "ios-helper ready"
            return 0
        fi
    done

    if [[ ! -d "$helper_dir" ]]; then
        print_error "ios-helper source not found at $helper_dir"
        exit 1
    fi

    if ! command -v swift &> /dev/null; then
        print_error "Swift is not installed (comes with Xcode)"
        exit 1
    fi

    print_info "Building ios-helper..."
    cd "$helper_dir"

    if swift build -c release > /dev/null 2>&1; then
        print_success "ios-helper built"
    else
        print_error "Failed to build ios-helper"
        exit 1
    fi
}

check_ios_device() {
    print_step "Checking iOS device..."

    if ! command -v idevice_id &> /dev/null; then
        print_error "idevice_id not found (part of libimobiledevice)"
        exit 1
    fi

    local devices
    devices=$(idevice_id -l 2>/dev/null || true)

    if [[ -z "$devices" ]]; then
        print_error "No iOS device found"
        print_info "Connect your iOS device via USB and trust the computer"
        exit 1
    fi

    DEVICE_UDID=$(echo "$devices" | head -n1)
    DEVICE_NAME=$(ideviceinfo -u "$DEVICE_UDID" -k DeviceName 2>/dev/null || echo "iOS Device")
    local ios_version
    ios_version=$(ideviceinfo -u "$DEVICE_UDID" -k ProductVersion 2>/dev/null || echo "?")

    print_success "$DEVICE_NAME (iOS $ios_version)"
}

setup_wda_repo() {
    print_step "Checking WebDriverAgent..."

    if [[ -d "$WDA_DIR" ]]; then
        print_success "WDA repository ready"
    else
        print_info "Cloning WebDriverAgent..."
        mkdir -p "$(dirname "$WDA_DIR")"
        git clone --depth 1 "$WDA_REPO" "$WDA_DIR" 2>/dev/null
        print_success "WDA cloned"
        NEEDS_FIRST_TIME_SETUP=true
    fi
}

check_wda_built() {
    print_step "Checking WDA build status..."

    # Check if we can run test-without-building successfully
    # This is a quick check - if it fails immediately, WDA isn't built
    cd "$WDA_DIR"

    # Look for build products in DerivedData
    local derived_data="$HOME/Library/Developer/Xcode/DerivedData"
    local wda_build_found=false

    if [[ -d "$derived_data" ]]; then
        # Check if any WDA build exists
        if find "$derived_data" -name "WebDriverAgentRunner-Runner.app" -type d 2>/dev/null | head -1 | grep -q .; then
            wda_build_found=true
        fi
    fi

    if $wda_build_found && ! $NEEDS_FIRST_TIME_SETUP; then
        print_success "WDA already built"
        return 0
    else
        print_info "WDA needs to be built"
        return 1
    fi
}

configure_signing() {
    print_step "Configuring code signing..."

    echo ""
    print_warning "First-time setup: You need to configure code signing in Xcode."
    print_info "This requires an Apple ID (free account works)."
    print_warning "Free accounts expire after 7 days - you'll need to re-run this script."
    echo ""

    print_info "Opening Xcode project..."
    open "$WDA_DIR/WebDriverAgent.xcodeproj"

    echo ""
    echo -e "${BOLD}In Xcode, configure these TWO targets:${NC}"
    echo ""
    echo "  ${BOLD}1. WebDriverAgentRunner${NC}"
    echo "     • Select target in sidebar → Signing & Capabilities"
    echo "     • Enable 'Automatically manage signing'"
    echo "     • Select your Team (Apple ID)"
    echo "     • If bundle ID error: change to com.YOURNAME.WebDriverAgentRunner"
    echo ""
    echo "  ${BOLD}2. IntegrationApp${NC}"
    echo "     • Same steps as above"
    echo ""

    read -p "Press Enter once BOTH targets are configured..."
}

build_wda() {
    print_step "Building WebDriverAgent..."

    cd "$WDA_DIR"

    print_info "This may take a minute..."
    echo ""

    local build_log
    build_log=$(mktemp)

    if xcodebuild build-for-testing \
        -project WebDriverAgent.xcodeproj \
        -scheme WebDriverAgentRunner \
        -destination "id=$DEVICE_UDID" \
        -allowProvisioningUpdates 2>&1 | tee "$build_log"; then

        if grep -q "BUILD SUCCEEDED" "$build_log"; then
            print_success "WDA built successfully"
            rm -f "$build_log"
            return 0
        fi
    fi

    echo ""
    print_error "Build failed!"

    if grep -q "Signing for\|code signing" "$build_log"; then
        print_warning "Code signing error - please check Xcode signing configuration"
    fi

    if grep -q "device is locked" "$build_log"; then
        print_warning "Device is locked - please unlock and try again"
    fi

    rm -f "$build_log"
    exit 1
}

start_wda() {
    print_step "Starting WebDriverAgent..."

    cd "$WDA_DIR"

    # Kill any existing sessions
    pkill -f "iproxy.*8100" 2>/dev/null || true
    pkill -f "xcodebuild.*WebDriverAgent" 2>/dev/null || true
    sleep 1

    # Start xcodebuild
    xcodebuild test-without-building \
        -project WebDriverAgent.xcodeproj \
        -scheme WebDriverAgentRunner \
        -destination "id=$DEVICE_UDID" \
        > /dev/null 2>&1 &

    XCODE_PID=$!
    sleep 5

    # Start iproxy
    iproxy 8100 8100 -u "$DEVICE_UDID" > /dev/null 2>&1 &
    IPROXY_PID=$!
    sleep 2

    # Cleanup handler
    cleanup() {
        echo ""
        print_info "Stopping WebDriverAgent..."
        kill $XCODE_PID $IPROXY_PID 2>/dev/null
        pkill -f "iproxy.*8100" 2>/dev/null
        pkill -f "xcodebuild.*WebDriverAgent" 2>/dev/null
        exit 0
    }
    trap cleanup INT TERM

    # Verify connection
    if curl -s http://localhost:8100/status | grep -q "ready"; then
        print_success "WebDriverAgent running at http://localhost:8100"
        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}  ✓ Ready! Touch input is now available in VS Code${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        print_info "Keep this terminal open. Press Ctrl+C to stop."
        echo ""
        wait $XCODE_PID 2>/dev/null
    else
        print_error "Failed to connect to WebDriverAgent"
        print_info "You may need to trust the developer on your device:"
        print_info "Settings > General > VPN & Device Management"
        kill $XCODE_PID $IPROXY_PID 2>/dev/null
        exit 1
    fi
}

# Main
main() {
    print_header "WebDriverAgent for scrcpy-vscode"

    # Always run these checks
    check_macos
    check_xcode
    check_iproxy
    build_ios_helper
    check_ios_device
    setup_wda_repo

    # Check if WDA is built, build if needed
    if ! check_wda_built; then
        configure_signing
        build_wda
    fi

    # Start WDA
    start_wda
}

main "$@"
