pipeline {
    agent any

    // ─── Build parameters — choose what to run from the Jenkins UI ───────────
    parameters {
        choice(
            name: 'TEST_TYPE',
            choices: ['web', 'mobile', 'both'],
            description: 'Which test suite to run'
        )
        choice(
            name: 'SLOT_VERIFY_TARGET',
            choices: ['both', 'canvas', 'preview'],
            description: 'Web: which target to validate token slots against'
        )
        choice(
            name: 'MOBILE_PLATFORM',
            choices: ['android', 'ios', 'both'],
            description: 'Mobile: which platform to run on BrowserStack'
        )
        string(
            name: 'TEST_WIDGETS',
            defaultValue: '',
            description: 'Optional: comma-separated widgets to test (empty = all)'
        )
    }

    // ─── Tool versions (configure these names in Jenkins → Global Tool Config) ─
    tools {
        nodejs 'NodeJS 20.8.1'
    }

    environment {
        // Studio / Auth — stored as Jenkins Secret Text credentials
        STUDIO_BASE_URL       = credentials('STUDIO_BASE_URL')
        PROJECT_ID            = credentials('PROJECT_ID')
        STUDIO_PROJECT_ID     = credentials('STUDIO_PROJECT_ID')
        STUDIO_USERNAME       = credentials('STUDIO_USERNAME')
        STUDIO_PASSWORD       = credentials('STUDIO_PASSWORD')
        STUDIO_API_KEY        = credentials('STUDIO_API_KEY')

        // BrowserStack — stored as Jenkins Username+Password credential named BROWSERSTACK
        BROWSERSTACK_USERNAME   = credentials('BROWSERSTACK_CREDS_USR')
        BROWSERSTACK_ACCESS_KEY = credentials('BROWSERSTACK_CREDS_PSW')

        // AWS S3 — stored as Jenkins Secret Text credentials
        AWS_ACCESS_KEY_ID     = credentials('AWS_ACCESS_KEY_ID')
        AWS_SECRET_ACCESS_KEY = credentials('AWS_SECRET_ACCESS_KEY')
        AWS_REGION            = 'us-west-2'
        S3_BUCKET_NAME        = credentials('S3_BUCKET_NAME')

        // Pass through build parameters as env vars
        SLOT_VERIFY_TARGET    = "${params.SLOT_VERIFY_TARGET}"
        MOBILE_PLATFORM       = "${params.MOBILE_PLATFORM}"
        TEST_WIDGETS          = "${params.TEST_WIDGETS}"
        RUN_LOCAL             = 'false'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'node --version && npm --version'
                sh 'npm ci'
            }
        }

        stage('Install Playwright Browsers') {
            when {
                expression { params.TEST_TYPE in ['web', 'both'] }
            }
            steps {
                sh 'npx playwright install --with-deps chromium'
            }
        }

        // ── WEB: Playwright token slot validation ─────────────────────────────
        stage('Web — Token Slot Validation') {
            when {
                expression { params.TEST_TYPE in ['web', 'both'] }
            }
            steps {
                sh '''
                    PW_WORKERS=8 \
                    npx playwright test tests/token_slot_validation.spec.ts \
                    --reporter=html,line
                '''
            }
            post {
                always {
                    publishHTML(target: [
                        allowMissing         : true,
                        alwaysLinkToLastBuild: true,
                        keepAll              : true,
                        reportDir            : 'playwright-report',
                        reportFiles          : 'index.html',
                        reportName           : 'Playwright Report'
                    ])
                }
            }
        }

        // ── MOBILE: WDIO + BrowserStack ───────────────────────────────────────
        stage('Mobile — Setup') {
            when {
                expression { params.TEST_TYPE in ['mobile', 'both'] }
            }
            steps {
                sh 'npx ts-node wdio/specs/mobile.global.setup.ts'
            }
        }

        stage('Mobile — Run on BrowserStack') {
            when {
                expression { params.TEST_TYPE in ['mobile', 'both'] }
            }
            steps {
                sh '''
                    rm -rf allure-results
                    PLATFORM=${MOBILE_PLATFORM} \
                    wdio run wdio/config/wdio.browserstack.conf.ts
                '''
            }
        }

        stage('Mobile — Generate Allure Report') {
            when {
                expression { params.TEST_TYPE in ['mobile', 'both'] }
            }
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

        // ── OPTIONAL: Upload reports to S3 ───────────────────────────────────
        stage('Upload Reports to S3') {
            when {
                allOf {
                    expression { env.S3_BUCKET_NAME != '' }
                    expression { currentBuild.result == null || currentBuild.result == 'SUCCESS' }
                }
            }
            steps {
                sh 'npx ts-node scripts/generate-and-upload-reports.ts'
            }
        }
    }

    post {
        always {
            // Archive raw artifacts for download from Jenkins
            archiveArtifacts artifacts: 'playwright-report/**,allure-report/**,artifacts/**',
                             allowEmptyArchive: true
        }
        failure {
            echo 'Tests failed — check the Playwright / Allure report above.'
        }
        cleanup {
            // Keep workspace lean between builds
            sh 'rm -rf allure-results playwright-report'
        }
    }
}
