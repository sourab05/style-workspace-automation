#!/bin/bash
# Stop all running Android emulators

echo "🛑 Stopping all Android emulators..."

# Get list of running emulators
EMULATORS=($(adb devices | grep emulator | cut -f1))

if [ ${#EMULATORS[@]} -eq 0 ]; then
  echo "ℹ️  No emulators running"
  exit 0
fi

echo "Found ${#EMULATORS[@]} running emulator(s)"

for emulator in "${EMULATORS[@]}"; do
  echo "  Stopping $emulator..."
  adb -s "$emulator" emu kill
done

sleep 2

echo "✅ All emulators stopped"
