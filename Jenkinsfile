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

        stage('Mobile — Setup') {
            when { expression { env.RUN_MOBILE == 'true' } }
            steps {
                sh 'npx ts-node wdio/specs/mobile.global.setup.ts'
            }
        }

        stage('Mobile — Run on BrowserStack') {
            when { expression { env.RUN_MOBILE == 'true' } }
            steps {
                sh '''
                    rm -rf allure-results
                    PLATFORM=${MOBILE_PLATFORM} \
                    wdio run wdio/config/wdio.browserstack.conf.ts
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
