#!/bin/bash
# Check if the system is ready for parallel testing
# Usage: ./scripts/check-parallel-setup.sh [platform] [count]

PLATFORM=${1:-android}
COUNT=${2:-5}

echo "🔍 Checking parallel setup for $COUNT $PLATFORM devices..."
echo ""

# Check Appium installation
echo "1️⃣  Checking Appium..."
if command -v appium &> /dev/null; then
  APPIUM_VERSION=$(appium --version)
  echo "   ✅ Appium installed (version $APPIUM_VERSION)"
else
  echo "   ❌ Appium not found. Install: npm install -g appium"
  exit 1
fi

# Check running Appium servers
echo ""
echo "2️⃣  Checking Appium servers..."
RUNNING_SERVERS=$(ps aux | grep -E 'appium -p' | grep -v grep | wc -l)
if [ $RUNNING_SERVERS -ge $COUNT ]; then
  echo "   ✅ $RUNNING_SERVERS Appium server(s) running"
  ps aux | grep -E 'appium -p' | grep -v grep | awk '{print "      Port", $12, "PID", $2}'
elif [ $RUNNING_SERVERS -gt 0 ]; then
  echo "   ⚠️  Only $RUNNING_SERVERS Appium server(s) running (need $COUNT)"
else
  echo "   ❌ No Appium servers running"
  echo "      Start with: ./scripts/start-parallel-appium.sh $PLATFORM $COUNT"
fi

# Platform-specific checks
if [ "$PLATFORM" = "android" ]; then
  echo ""
  echo "3️⃣  Checking Android setup..."
  
  # Check Android SDK
  if command -v adb &> /dev/null; then
    echo "   ✅ Android SDK installed"
  else
    echo "   ❌ Android SDK not found"
    exit 1
  fi
  
  # Check emulators
  echo ""
  echo "4️⃣  Checking Android emulators..."
  AVAILABLE_EMULATORS=$(emulator -list-avds | wc -l)
  if [ $AVAILABLE_EMULATORS -ge $COUNT ]; then
    echo "   ✅ $AVAILABLE_EMULATORS emulator(s) available"
  else
    echo "   ⚠️  Only $AVAILABLE_EMULATORS emulator(s) available (need $COUNT)"
  fi
  
  # Check running emulators
  RUNNING_EMULATORS=$(adb devices | grep emulator | wc -l)
  if [ $RUNNING_EMULATORS -ge $COUNT ]; then
    echo "   ✅ $RUNNING_EMULATORS emulator(s) running"
    adb devices | grep emulator
  elif [ $RUNNING_EMULATORS -gt 0 ]; then
    echo "   ⚠️  Only $RUNNING_EMULATORS emulator(s) running (need $COUNT)"
    adb devices | grep emulator
  else
    echo "   ❌ No emulators running"
    echo "      Start with: ./scripts/start-android-emulators.sh $COUNT"
  fi
  
else
  echo ""
  echo "3️⃣  Checking iOS setup..."
  
  # Check Xcode
  if command -v xcrun &> /dev/null; then
    echo "   ✅ Xcode installed"
  else
    echo "   ❌ Xcode not found"
    exit 1
  fi
  
  # Check simulators
  echo ""
  echo "4️⃣  Checking iOS simulators..."
  BOOTED_SIMS=$(xcrun simctl list devices | grep Booted | wc -l)
  if [ $BOOTED_SIMS -ge $COUNT ]; then
    echo "   ✅ $BOOTED_SIMS simulator(s) booted"
    xcrun simctl list devices | grep Booted
  elif [ $BOOTED_SIMS -gt 0 ]; then
    echo "   ⚠️  Only $BOOTED_SIMS simulator(s) booted (need $COUNT)"
    xcrun simctl list devices | grep Booted
  else
    echo "   ❌ No simulators booted"
    echo "      Boot with: xcrun simctl boot [simulator-name]"
  fi
fi

# Check system resources
echo ""
echo "5️⃣  Checking system resources..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  TOTAL_RAM=$(sysctl -n hw.memsize | awk '{print $1/1024/1024/1024}')
  echo "   RAM: ${TOTAL_RAM}GB"
  if (( $(echo "$TOTAL_RAM < 16" | bc -l) )); then
    echo "   ⚠️  Recommended: 16GB+ for $COUNT parallel sessions"
  else
    echo "   ✅ Sufficient RAM"
  fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

READY=true

if [ $RUNNING_SERVERS -lt $COUNT ]; then
  echo "❌ Need to start Appium servers: ./scripts/start-parallel-appium.sh $PLATFORM $COUNT"
  READY=false
fi

if [ "$PLATFORM" = "android" ] && [ $RUNNING_EMULATORS -lt $COUNT ]; then
  echo "❌ Need to start emulators: ./scripts/start-android-emulators.sh $COUNT"
  READY=false
elif [ "$PLATFORM" = "ios" ] && [ $BOOTED_SIMS -lt $COUNT ]; then
  echo "❌ Need to boot simulators"
  READY=false
fi

if [ "$READY" = true ]; then
  echo "✅ System ready for $COUNT parallel sessions!"
  echo ""
  echo "Run tests with:"
  echo "  RUN_LOCAL=true PLATFORM=$PLATFORM npx wdio run wdio/config/wdio.local.parallel.conf.ts"
else
  echo ""
  echo "⚠️  System not ready. Complete the steps above."
fi
