#!/usr/bin/env bash
# Source workspace Android CI env written by scripts/setup-android-ci.sh
if [ -f "${WORKSPACE}/.ci-env.sh" ]; then
  echo "--- Loading Android CI env ---"
  set -a
  # shellcheck disable=SC1091
  . "${WORKSPACE}/.ci-env.sh"
  set +a
  gradle --version || echo "WARNING: gradle not on PATH after loading .ci-env.sh"
  echo "ANDROID_HOME=${ANDROID_HOME:-not set}"
  echo "GRADLE_HOME=${GRADLE_HOME:-not set}"
else
  echo "NOTE: ${WORKSPACE}/.ci-env.sh not found — using agent defaults"
fi
