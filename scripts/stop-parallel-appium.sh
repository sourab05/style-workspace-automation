#!/bin/bash
# Stop all running Appium servers

echo "🛑 Stopping all Appium servers..."

# Kill all Appium processes
pkill -f 'appium'

# Wait a moment
sleep 2

# Check if any are still running
REMAINING=$(ps aux | grep appium | grep -v grep | wc -l)

if [ $REMAINING -eq 0 ]; then
  echo "✅ All Appium servers stopped successfully"
else
  echo "⚠️  Warning: $REMAINING Appium process(es) still running"
  echo "Use 'ps aux | grep appium' to check"
fi
