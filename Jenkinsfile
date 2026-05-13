pipeline {
    agent any

    options {
        // Cap stored builds + archived artifacts on the controller (reduces disk growth over time).
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
        skipDefaultCheckout(true)
    }

    // If post-stage archive fails with java.nio.file.FileSystemException "No space left on device",
    // free disk on the Jenkins controller (discard old builds, prune jobs/*/builds/*/archive, expand volume).
    // Archiving slim artifacts below avoids copying playwright-report/data trace zips into every build archive.

    // ─── Single dropdown — pick exactly what you want to run ─────────────────
    parameters {
        choice(
            name: 'RUN_TARGET',
            choices: [
                'Web — Canvas only',
                'Web — Preview only',
                'Web — Canvas + Preview',
                'Mobile — Android only',
                'Mobile — iOS only',
                'Mobile — Android + iOS',
                'All — Web (Canvas+Preview) + Mobile (Android+iOS)'
            ],
            description: '''What to run:
  Web options   → Playwright token slot validation
  Mobile options → WDIO on BrowserStack
  All           → Full suite (web + mobile)'''
        )
        string(
            name: 'TEST_WIDGETS',
            defaultValue: '',
            description: 'Optional: comma-separated widgets to test (empty = all). e.g. button,accordion,label'
        )
    }

    tools {
        nodejs 'NodeJS 20.8.1'
    }

    environment {
        // Studio / Auth — forced to Platform DB REST login (API-based, no browser/Google OAuth).
        // AUTH_METHOD=platformdb bypasses domain-based Google auth detection so Jenkins
        // uses STUDIO_USERNAME + STUDIO_PASSWORD via /login/authenticate directly.
        AUTH_METHOD           = 'platformdb'

        // Android SDK — Jenkins agent must have ANDROID_HOME set or sdk installed at this path.
        // gradle is resolved via ANDROID_HOME/cmdline-tools or a local gradle wrapper.
        ANDROID_HOME          = "${env.ANDROID_HOME ?: '/opt/android-sdk'}"
        GRADLE_HOME           = "${env.GRADLE_HOME ?: '/opt/gradle/gradle-8.7'}"
        STUDIO_BASE_URL       = credentials('STUDIO_BASE_URL')
        PROJECT_ID            = credentials('PROJECT_ID')
        STUDIO_PROJECT_ID     = credentials('STUDIO_PROJECT_ID')
        STUDIO_USERNAME       = credentials('STUDIO_USERNAME')
        STUDIO_PASSWORD       = credentials('STUDIO_PASSWORD')

        // BrowserStack (BrowserStack plugin credential — auto-splits into _USR and _PSW)
        BROWSERSTACK_CREDS      = credentials('BROWSERSTACK_CREDS')
        BROWSERSTACK_USERNAME   = "${env.BROWSERSTACK_CREDS_USR}"
        BROWSERSTACK_ACCESS_KEY = "${env.BROWSERSTACK_CREDS_PSW}"

        // AWS S3
        AWS_ACCESS_KEY_ID     = credentials('AWS_ACCESS_KEY_ID')
        AWS_SECRET_ACCESS_KEY = credentials('AWS_SECRET_ACCESS_KEY')
        AWS_REGION            = 'us-west-2'
        S3_BUCKET_NAME        = credentials('S3_BUCKET_NAME')

        TEST_WIDGETS          = "${params.TEST_WIDGETS}"
        RUN_LOCAL             = 'false'
        // Standard CI flag so Playwright config can apply CI-specific options (forbidOnly, trace, etc.)
        CI                    = 'true'
    }

    stages {

        stage('Checkout') {
            steps {
                deleteDir()
                checkout scm
            }
        }

        // Derive run flags from the single RUN_TARGET param
        stage('Resolve Run Target') {
            steps {
                script {
                    def target = params.RUN_TARGET

                    env.RUN_WEB    = (target.startsWith('Web') || target.startsWith('All')) ? 'true' : 'false'
                    env.RUN_MOBILE = (target.startsWith('Mobile') || target.startsWith('All')) ? 'true' : 'false'

                    if (target.contains('Canvas + Preview') || target.startsWith('All')) {
                        env.SLOT_VERIFY_TARGET = 'both'
                    } else if (target.contains('Canvas')) {
                        env.SLOT_VERIFY_TARGET = 'canvas'
                    } else if (target.contains('Preview')) {
                        env.SLOT_VERIFY_TARGET = 'preview'
                    } else {
                        env.SLOT_VERIFY_TARGET = 'both'
                    }

                    if (target.contains('Android + iOS') || target.startsWith('All')) {
                        env.MOBILE_PLATFORM = 'both'
                    } else if (target.contains('Android')) {
                        env.MOBILE_PLATFORM = 'android'
                    } else if (target.contains('iOS')) {
                        env.MOBILE_PLATFORM = 'ios'
                    } else {
                        env.MOBILE_PLATFORM = 'both'
                    }

                    echo "▶ RUN_WEB=${env.RUN_WEB}  |  RUN_MOBILE=${env.RUN_MOBILE}  |  SLOT_VERIFY_TARGET=${env.SLOT_VERIFY_TARGET}  |  MOBILE_PLATFORM=${env.MOBILE_PLATFORM}"
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'node --version && npm --version'
                sh 'npm install -g pnpm@9.15.9'
                sh 'pnpm install --frozen-lockfile'
            }
        }

        stage('Build Token Map') {
            steps {
                sh 'npx ts-node scripts/generate-token-values.ts mobile'
            }
        }

        // ── WEB ───────────────────────────────────────────────────────────────

        stage('Web — Install Playwright Browsers') {
            when { expression { env.RUN_WEB == 'true' } }
            steps {
                sh 'npx playwright install --with-deps chromium'
            }
        }

        stage('Web — Token Slot Validation') {
            when { expression { env.RUN_WEB == 'true' } }
            steps {
                sh '''
                    PW_WORKERS=8 \
                    SLOT_VERIFY_TARGET=${SLOT_VERIFY_TARGET} \
                    xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" \
                    npx playwright test tests/token_slot_validation.spec.ts
                '''
            }
            post {
                always {
                    sh '''
                        if [ -f logs/playwright-log.json ]; then
                            npx ts-node scripts/generate-playwright-report.ts || echo "generate-playwright-report.ts exited non-zero"
                        fi
                    '''
                    archiveArtifacts artifacts: 'reports/playwright-report.html,logs/playwright-log.json', allowEmptyArchive: true
                }
            }
        }

        // ── MOBILE ────────────────────────────────────────────────────────────

        stage('Mobile — Verify Android Environment') {
            when { expression { env.RUN_MOBILE == 'true' && !params.RUN_TARGET.contains('iOS only') } }
            steps {
                sh '''
                    echo "=== Checking Android build environment ==="

                    # Ensure ANDROID_HOME and Gradle are on PATH
                    export PATH="${GRADLE_HOME}/bin:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

                    echo "ANDROID_HOME=${ANDROID_HOME}"
                    echo "GRADLE_HOME=${GRADLE_HOME}"

                    # Verify gradle is callable
                    if ! command -v gradle &>/dev/null; then
                        echo "❌ gradle not found on PATH — attempting to install via sdkman or direct download"

                        # Try sdkman if available
                        if [ -f "$HOME/.sdkman/bin/sdkman-init.sh" ]; then
                            source "$HOME/.sdkman/bin/sdkman-init.sh"
                            sdk install gradle 8.7 || true
                        else
                            # Install gradle directly
                            GRADLE_VERSION=8.7
                            GRADLE_ZIP="gradle-${GRADLE_VERSION}-bin.zip"
                            GRADLE_URL="https://services.gradle.org/distributions/${GRADLE_ZIP}"
                            GRADLE_INSTALL_DIR="/opt/gradle"

                            mkdir -p "${GRADLE_INSTALL_DIR}"
                            curl -fsSL "${GRADLE_URL}" -o "/tmp/${GRADLE_ZIP}"
                            unzip -q "/tmp/${GRADLE_ZIP}" -d "${GRADLE_INSTALL_DIR}" || true
                            rm -f "/tmp/${GRADLE_ZIP}"

                            export GRADLE_HOME="${GRADLE_INSTALL_DIR}/gradle-${GRADLE_VERSION}"
                            export PATH="${GRADLE_HOME}/bin:${PATH}"
                        fi
                    fi

                    gradle --version || echo "⚠️ gradle still not available — build may fail"

                    # Check Java
                    java -version 2>&1 || echo "⚠️ Java not found — required for Android builds"

                    echo "=== Environment check complete ==="
                '''
            }
        }

        stage('Mobile — Setup') {
            when { expression { env.RUN_MOBILE == 'true' } }
            steps {
                sh '''
                    export PATH="${GRADLE_HOME}/bin:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"
                    npx ts-node wdio/specs/mobile.global.setup.ts
                '''
            }
        }

        stage('Mobile — Run on BrowserStack') {
            when { expression { env.RUN_MOBILE == 'true' } }
            steps {
                sh '''
                    # Clear previous results once before all batches
                    rm -rf allure-results
                    mkdir -p allure-results

                    run_batch() {
                        local BATCH_NUM=$1
                        local SPEC_GLOB=$2
                        echo ""
                        echo "============================================"
                        echo "  BATCH ${BATCH_NUM}: ${SPEC_GLOB}"
                        echo "============================================"
                        MOBILE_PLATFORM=${MOBILE_PLATFORM} \
                        wdio run wdio/config/wdio.browserstack.conf.ts \
                            --spec "${SPEC_GLOB}" || echo "⚠️  Batch ${BATCH_NUM} had failures (continuing)"
                    }

                    run_batch 1 "wdio/specs/mobile.{accordion,accordion-pane,anchor,audio,barcodescanner,bottomsheet,button,button-group,calendar,camera}.token.validate.spec.ts"
                    run_batch 2 "wdio/specs/mobile.{cards,carousel,checkbox,checkboxset,chips,container,currency,datetime,dropdown-menu,fileupload}.token.validate.spec.ts"
                    run_batch 3 "wdio/specs/mobile.{form-wrapper,formcontrols,icon,label,list,login,lottie,message,modal,navbar}.token.validate.spec.ts"
                    run_batch 4 "wdio/specs/mobile.{panel,panel-footer,picture,popover,progress-bar,progress-circle,radioset,rating,search,select}.token.validate.spec.ts"
                    run_batch 5 "wdio/specs/mobile.{slider,spinner,switch,tabbar,tabs,tile,toggle,video,webview,wizard}.token.validate.spec.ts"

                    echo ""
                    echo "✅ All 5 batches complete. allure-results accumulated."
                '''
            }
        }

        stage('Mobile — Generate Allure Report') {
            when { expression { env.RUN_MOBILE == 'true' } }
            steps {
                sh 'allure generate --clean allure-results -o allure-report'
            }
            post {
                always {
                    allure includeProperties: false,
                           jdk              : '',
                           results          : [[path: 'allure-results']],
                           reportBuildPolicy: 'ALWAYS'
                }
            }
        }

        // S3 upload runs in post { success | failure | unstable } so it still runs when an earlier stage fails
        // (skipped stages would never reach a dedicated Upload stage).
    }

    post {
        success {
            script {
                if (env.S3_BUCKET_NAME?.trim()) {
                    sh 'npx ts-node scripts/generate-and-upload-reports.ts'
                }
            }
        }
        failure {
            script {
                if (env.S3_BUCKET_NAME?.trim()) {
                    sh 'npx ts-node scripts/generate-and-upload-reports.ts || echo "S3 upload skipped or failed (non-fatal for failed build)"'
                }
            }
            echo 'Build failed — check Playwright / Allure report above.'
        }
        unstable {
            script {
                if (env.S3_BUCKET_NAME?.trim()) {
                    sh 'npx ts-node scripts/generate-and-upload-reports.ts || echo "S3 upload skipped or failed (non-fatal for unstable build)"'
                }
            }
        }
    }
}
