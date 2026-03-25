#!/bin/bash
# Start multiple Appium servers for parallel testing
# Usage: ./scripts/start-parallel-appium.sh [platform] [count]

PLATFORM=${1:-android}
COUNT=${2:-5}

echo "🚀 Starting $COUNT Appium servers for $PLATFORM..."

if [ "$PLATFORM" = "ios" ]; then
  echo "📱 iOS mode: Including WDA ports"
  for i in $(seq 0 $((COUNT-1))); do
    PORT=$((4723 + i))
    WDA_PORT=$((8100 + i))
    echo "  Starting Appium server on port $PORT (WDA: $WDA_PORT)..."
    appium -p $PORT --default-capabilities "{\"wdaLocalPort\": $WDA_PORT}" --session-override > "logs/appium-$PORT.log" 2>&1 &
  done
else
  echo "🤖 Android mode"
  for i in $(seq 0 $((COUNT-1))); do
    PORT=$((4723 + i))
    echo "  Starting Appium server on port $PORT..."
    appium -p $PORT --session-override > "logs/appium-$PORT.log" 2>&1 &
  done
fi

echo "✅ Started $COUNT Appium servers (ports 4723-$((4722 + COUNT)))"
echo "📋 Logs available in logs/appium-*.log"
echo ""
echo "To stop all servers:"
echo "  pkill -f 'appium -p'"
echo ""
echo "To check running servers:"
echo "  ps aux | grep appium"
