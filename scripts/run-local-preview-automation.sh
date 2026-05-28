#!/usr/bin/env bash
# Run preview token-console automation against a local RN dev server.
#
# Prerequisites:
#   1. Local RN preview running (default http://localhost:19009)
#   2. pnpm/npm install completed in this repo
#
# Usage:
#   ./scripts/run-local-preview-automation.sh
#   ./scripts/run-local-preview-automation.sh --widget button
#   ./scripts/run-local-preview-automation.sh --widget button,accordion --headless
#   ./scripts/run-local-preview-automation.sh --compare          # also run remote vs local style diff
#   ./scripts/run-local-preview-automation.sh --open-report      # open HTML report when done
#   LOCAL_PREVIEW_URL=http://127.0.0.1:19009 ./scripts/run-local-preview-automation.sh
#
# npm:
#   npm run test:preview:local
#   npm run test:preview:local -- --widget button --headless

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCAL_URL="${LOCAL_PREVIEW_URL:-http://localhost:19009}"
LOCAL_URL="${LOCAL_URL%/}"
HEALTH_PATH="${LOCAL_PREVIEW_HEALTH_PATH:-/rn-bundle/index.html}"

WIDGET=""
HEADLESS=false
COMPARE=false
OPEN_REPORT=false
SKIP_GENERATE=false
SKIP_HEALTH=false
EXTRA_ARGS=()

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --widget) WIDGET="${2:-}"; shift 2 ;;
    --headless) HEADLESS=true; shift ;;
    --compare|--compare-styles) COMPARE=true; shift ;;
    --open-report) OPEN_REPORT=true; shift ;;
    --skip-generate) SKIP_GENERATE=true; shift ;;
    --skip-health) SKIP_HEALTH=true; shift ;;
    --url|--local-url)
      LOCAL_URL="${2:-}"
      LOCAL_URL="${LOCAL_URL%/}"
      shift 2
      ;;
    --) shift; EXTRA_ARGS+=("$@"); break ;;
    *) EXTRA_ARGS+=("$1"); shift ;;
  esac
done

CONSOLE_REPORT="${ROOT_DIR}/artifacts/preview-console-validation/preview-console-report.html"
SLOT_CASES="${ROOT_DIR}/.test-cache/slot-test-cases.json"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Local preview automation"
echo "  Preview URL: ${LOCAL_URL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# --- dependency check ---
if ! command -v npx >/dev/null 2>&1; then
  echo "❌ npx not found. Run npm install or pnpm install first."
  exit 1
fi

# --- health check ---
if [[ "$SKIP_HEALTH" != true ]]; then
  echo "1️⃣  Checking local RN preview..."
  HEALTH_URL="${LOCAL_URL}${HEALTH_PATH}"
  if curl -sf --max-time 10 -o /dev/null "$HEALTH_URL" 2>/dev/null; then
    echo "   ✅ Reachable: ${HEALTH_URL}"
  elif curl -sf --max-time 10 -o /dev/null "$LOCAL_URL" 2>/dev/null; then
    echo "   ⚠️  ${HEALTH_URL} not found; base URL responds: ${LOCAL_URL}"
    echo "      Continuing — ensure pages load at ${LOCAL_URL}/rn-bundle/index.html#/<Page>"
  else
    echo "   ❌ Cannot reach local preview at ${LOCAL_URL}"
    echo ""
    echo "   Start your local RN bundle dev server, then re-run."
    echo "   Override URL: LOCAL_PREVIEW_URL=http://host:port $0"
    exit 1
  fi
  echo ""
fi

# --- slot test cases ---
if [[ "$SKIP_GENERATE" != true && ! -f "$SLOT_CASES" ]]; then
  echo "2️⃣  Generating slot test cases (.test-cache/slot-test-cases.json)..."
  npm run generate:slot-tests
  echo ""
elif [[ ! -f "$SLOT_CASES" ]]; then
  echo "❌ Missing ${SLOT_CASES}"
  echo "   Run: npm run generate:slot-tests"
  exit 1
else
  echo "2️⃣  Slot test cases: $(basename "$SLOT_CASES") ✓"
  echo ""
fi

# --- token console verification ---
echo "3️⃣  Running preview token console checks..."
VERIFY_ARGS=(--local-url "$LOCAL_URL")
[[ -n "$WIDGET" ]] && VERIFY_ARGS+=(--widget "$WIDGET")
[[ "$HEADLESS" == true ]] && VERIFY_ARGS+=(--headless)
VERIFY_ARGS+=("${EXTRA_ARGS[@]}")

set +e
npx ts-node scripts/verify-preview-token-console.ts "${VERIFY_ARGS[@]}"
VERIFY_EXIT=$?
set -e
echo ""

# --- optional style comparison ---
if [[ "$COMPARE" == true ]]; then
  echo "4️⃣  Comparing remote vs local RN styles..."
  COMPARE_ARGS=(--local-url "$LOCAL_URL")
  [[ -n "$WIDGET" ]] && COMPARE_ARGS+=(--widget "$WIDGET")
  [[ "$HEADLESS" == true ]] && COMPARE_ARGS+=(--headless)
  set +e
  npx ts-node scripts/compare-styles.ts "${COMPARE_ARGS[@]}"
  COMPARE_EXIT=$?
  set -e
  echo ""
  if [[ $COMPARE_EXIT -ne 0 ]]; then
    VERIFY_EXIT=$COMPARE_EXIT
  fi
  if [[ -f "${ROOT_DIR}/artifacts/style-comparison/style-comparison-report.html" ]]; then
    echo "   Style report: artifacts/style-comparison/style-comparison-report.html"
  fi
fi

# --- summary ---
if [[ $VERIFY_EXIT -eq 0 ]]; then
  echo "✅ Local preview automation passed."
else
  echo "❌ Local preview automation failed (see reports above)."
fi

echo ""
echo "📄 Console report: artifacts/preview-console-validation/"
echo "   - preview-console-report.html"
echo "   - preview-console-report.json"
echo "   - preview-console-report.txt"

if [[ "$OPEN_REPORT" == true && -f "$CONSOLE_REPORT" ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$CONSOLE_REPORT"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$CONSOLE_REPORT"
  fi
fi

exit "$VERIFY_EXIT"
