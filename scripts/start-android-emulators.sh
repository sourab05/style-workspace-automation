#!/bin/bash
# Start multiple Android emulators for parallel testing
# Usage: ./scripts/start-android-emulators.sh [count]

COUNT=${1:-5}

echo "🤖 Starting $COUNT Android emulators..."
echo ""

# Check if emulators exist
EMULATORS=($(emulator -list-avds))

if [ ${#EMULATORS[@]} -lt $COUNT ]; then
  echo "⚠️  Warning: Only ${#EMULATORS[@]} emulators found, need $COUNT"
  echo "Available emulators:"
  for emulator in "${EMULATORS[@]}"; do
    echo "  - $emulator"
  done
  echo ""
  echo "Create more emulators using:"
  echo "  avdmanager create avd -n [name] -k \"system-images;android-34;google_apis;x86_64\""
  exit 1
fi

# Start emulators
for i in $(seq 0 $((COUNT-1))); do
  PORT=$((5554 + i * 2))
  EMULATOR_NAME=${EMULATORS[$i]}
  
  echo "🚀 Starting emulator $((i+1)): $EMULATOR_NAME on port $PORT..."
  emulator -avd "$EMULATOR_NAME" -port $PORT -no-snapshot -no-boot-anim -no-audio > "logs/emulator-$PORT.log" 2>&1 &
done

echo ""
echo "⏳ Waiting for emulators to boot (this may take 2-3 minutes)..."
sleep 10

echo ""
echo "📱 Emulator status:"
adb devices

echo ""
echo "✅ Started $COUNT emulators"
echo "📋 Logs available in logs/emulator-*.log"
echo ""
echo "To stop all emulators:"
echo "  adb devices | grep emulator | cut -f1 | xargs -I {} adb -s {} emu kill"
