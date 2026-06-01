def uploadReportsToS3(Map args = [:]) {
    def nonFatal = args.nonFatal == true
    if (!env.S3_BUCKET_NAME?.trim()) {
        return
    }
    if (!params.S3_VERSION?.trim()) {
        echo '⚠️ S3_VERSION is empty — skipping S3 report upload. Set the build parameter to upload under react_native/releases/<version>/Style Workspace/...'
        return
    }
    def cmd = 'npx ts-node scripts/generate-and-upload-reports.ts'
    if (nonFatal) {
        sh "${cmd} || echo \"S3 upload skipped or failed (non-fatal)\""
    } else {
        sh cmd
    }
}

def applyWmEnvProfile() {
    def envKey = params.WM_ENV

    // Use node to parse JSON and write a .env file (Jenkins sandbox blocks all Groovy map operations)
    sh "node scripts/resolve-wm-env.js '${envKey}' > ${WORKSPACE}/.wm-env-profile"

    // Read individual values using shell grep
    env.WM_ENV = envKey
    env.STUDIO_BASE_URL = sh(script: "grep '^STUDIO_BASE_URL=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    env.PROJECT_ID = sh(script: "grep '^PROJECT_ID=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    env.STUDIO_PROJECT_ID = sh(script: "grep '^STUDIO_PROJECT_ID=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    env.STUDIO_USERNAME = sh(script: "grep '^STUDIO_USERNAME=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    env.AUTH_METHOD = sh(script: "grep '^AUTH_METHOD=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    env.STUDIO_LOGIN_PATH = sh(script: "grep '^STUDIO_LOGIN_PATH=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    env.STUDIO_DEPLOY_PATH = sh(script: "grep '^STUDIO_DEPLOY_PATH=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    env.CANVAS_PATH = sh(script: "grep '^CANVAS_PATH=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    env.PREVIEW_PATH = sh(script: "grep '^PREVIEW_PATH=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    env.RUNTIME_BASE_URL = sh(script: "grep '^RUNTIME_BASE_URL=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()

    def credId = sh(script: "grep '^JENKINS_CRED_ID=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    if (!credId) {
        credId = "WM_${envKey.toUpperCase().replace('-', '_')}_CREDS"
    }

    try {
        withCredentials([usernamePassword(credentialsId: credId, usernameVariable: 'WM_CREDS_USER', passwordVariable: 'WM_CREDS_PASS')]) {
            env.STUDIO_USERNAME = env.WM_CREDS_USER
            env.STUDIO_PASSWORD = env.WM_CREDS_PASS
        }
    } catch (Exception e) {
        echo "⚠️ Credential '${credId}' not found — trying legacy STUDIO_USERNAME / STUDIO_PASSWORD"
        try {
            withCredentials([
                string(credentialsId: 'STUDIO_USERNAME', variable: 'LEGACY_STUDIO_USER'),
                string(credentialsId: 'STUDIO_PASSWORD', variable: 'LEGACY_STUDIO_PASS'),
            ]) {
                env.STUDIO_USERNAME = env.LEGACY_STUDIO_USER ?: env.STUDIO_USERNAME
                env.STUDIO_PASSWORD = env.LEGACY_STUDIO_PASS
            }
        } catch (Exception e2) {
            error("No Studio credentials available for WM_ENV=${envKey}. Create Jenkins credential '${credId}' (Username with password) — see docs/JENKINS-CREDENTIALS.md")
        }
    }

    def profileLabel = sh(script: "grep '^PROFILE_LABEL=' ${WORKSPACE}/.wm-env-profile | cut -d= -f2-", returnStdout: true).trim()
    echo "▶ WM_ENV=${envKey} (${profileLabel ?: envKey})"
    echo "   STUDIO_BASE_URL=${env.STUDIO_BASE_URL}"
    echo "   PROJECT_ID=${env.PROJECT_ID}"
    echo "   STUDIO_PROJECT_ID=${env.STUDIO_PROJECT_ID}"
    echo "   STUDIO_USERNAME=${env.STUDIO_USERNAME}"
    echo "   AUTH_METHOD=${env.AUTH_METHOD ?: '(auto-detect from URL)'}"
}

def isManualMobileUpload() {
    return params.MOBILE_APP_SOURCE == 'Upload APK/IPA manually'
}

def isCliMobileBuild() {
    return params.MOBILE_APP_SOURCE == 'Build from Studio (CLI)'
}

def isAppChefMobileBuild() {
    return params.MOBILE_APP_SOURCE == 'Build with AppChef'
}

def isStudioMobileBuild() {
    return isCliMobileBuild() || isAppChefMobileBuild()
}

def prepareUploadedMobileApps() {
    if (!isManualMobileUpload()) {
        return
    }

    def mobileBuildDir = (env.MOBILE_BUILD_DIR?.trim() ?: 'mobile-builds').replaceFirst(/^\\.\\//, '')
    def androidApkRel = 'android/app/build/outputs/apk/debug/app-debug.apk'
    def iosIpaRel = 'output/ios/app-debug.ipa'

    def copyUpload = { paramName, destPath ->
        def fileName = params[paramName]?.trim()
        if (!fileName) {
            return null
        }
        sh """
            set -e
            mkdir -p "\$(dirname '${destPath}')"
            cp '${env.WORKSPACE}/${fileName}' '${destPath}'
            ls -lh '${destPath}'
        """
        return destPath
    }

    def needsBaseline = !params.SKIP_VISUAL_VERIFICATION
    def runAndroid = env.MOBILE_PLATFORM == 'android' || env.MOBILE_PLATFORM == 'both'
    def runIos = env.MOBILE_PLATFORM == 'ios' || env.MOBILE_PLATFORM == 'both'

    def actualAndroidPath = "${env.WORKSPACE}/${mobileBuildDir}/actual/build-out-android/${androidApkRel}"
    def actualIosPath = "${env.WORKSPACE}/${mobileBuildDir}/actual/build-out-ios/${iosIpaRel}"
    def baselineAndroidPath = "${env.WORKSPACE}/${mobileBuildDir}/baseline/build-out-android/${androidApkRel}"
    def baselineIosPath = "${env.WORKSPACE}/${mobileBuildDir}/baseline/build-out-ios/${iosIpaRel}"

    env.JENKINS_UPLOAD_ANDROID_ACTUAL = copyUpload('UPLOAD_ANDROID_ACTUAL_APK', actualAndroidPath) ?: ''
    env.JENKINS_UPLOAD_IOS_ACTUAL = copyUpload('UPLOAD_IOS_ACTUAL_IPA', actualIosPath) ?: ''

    if (needsBaseline) {
        env.JENKINS_UPLOAD_ANDROID_BASELINE = copyUpload('UPLOAD_ANDROID_BASELINE_APK', baselineAndroidPath) ?: ''
        env.JENKINS_UPLOAD_IOS_BASELINE = copyUpload('UPLOAD_IOS_BASELINE_IPA', baselineIosPath) ?: ''
    } else {
        env.JENKINS_UPLOAD_ANDROID_BASELINE = ''
        env.JENKINS_UPLOAD_IOS_BASELINE = ''
        echo '⏭ Baseline APK/IPA upload disabled (SKIP_VISUAL_VERIFICATION=true) — only actual apps are required'
    }

    if (runAndroid && !env.JENKINS_UPLOAD_ANDROID_ACTUAL?.trim()) {
        error('Manual upload mode: UPLOAD_ANDROID_ACTUAL_APK is required for Android mobile runs.')
    }
    if (runIos && !env.JENKINS_UPLOAD_IOS_ACTUAL?.trim()) {
        error('Manual upload mode: UPLOAD_IOS_ACTUAL_IPA is required for iOS mobile runs.')
    }
    if (needsBaseline) {
        if (runAndroid && !env.JENKINS_UPLOAD_ANDROID_BASELINE?.trim()) {
            error('Manual upload mode with visual verification: UPLOAD_ANDROID_BASELINE_APK is required.')
        }
        if (runIos && !env.JENKINS_UPLOAD_IOS_BASELINE?.trim()) {
            error('Manual upload mode with visual verification: UPLOAD_IOS_BASELINE_IPA is required.')
        }
    }

    env.ANDROID_ACTUAL_APK_PATH = env.JENKINS_UPLOAD_ANDROID_ACTUAL
    env.ANDROID_BASELINE_APK_PATH = env.JENKINS_UPLOAD_ANDROID_BASELINE
    env.IOS_IPA_PATH = env.JENKINS_UPLOAD_IOS_ACTUAL
    env.IOS_BASELINE_IPA_PATH = env.JENKINS_UPLOAD_IOS_BASELINE
    env.USE_UPLOADED_MOBILE_APPS = 'true'
    env.JENKINS_REQUIRE_BASELINE_UPLOAD = needsBaseline ? 'true' : 'false'

    echo "📁 Uploaded apps stored under ${mobileBuildDir}/"
    echo "   actual Android:   ${env.JENKINS_UPLOAD_ANDROID_ACTUAL ?: '(none)'}"
    echo "   actual iOS:       ${env.JENKINS_UPLOAD_IOS_ACTUAL ?: '(none)'}"
    echo "   baseline Android: ${env.JENKINS_UPLOAD_ANDROID_BASELINE ?: '(skipped)'}"
    echo "   baseline iOS:     ${env.JENKINS_UPLOAD_IOS_BASELINE ?: '(skipped)'}"

    sh 'npx ts-node scripts/jenkins-prepare-mobile-apps.ts'
}

def pipelineParameters() {
    return [
        [
            $class: 'ChoiceParameterDefinition',
            name: 'WM_ENV',
            choices: ['stage-ai', 'stage-ai-jeevan', 'stage', 'dev', 'wmo', 'preprod'],
            description: '''Target WaveMaker environment (URL, project IDs, username, auth set automatically). Jenkins credential per env - see docs/JENKINS-CREDENTIALS.md:
  stage-ai        -> WM_STAGE_AI_CREDS
  stage-ai-jeevan -> WM_STAGE_AI_JEEVAN_CREDS
  stage           -> WM_STAGE_CREDS
  dev             -> WM_DEV_CREDS
  wmo             -> WM_WMO_CREDS
  preprod         -> WM_PREPROD_CREDS'''
        ],
        [
            $class: 'ChoiceParameterDefinition',
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
  Web options   -> Playwright token slot validation
  Mobile options -> WDIO on BrowserStack
  All           -> Full suite (web + mobile)'''
        ],
        [
            $class: 'StringParameterDefinition',
            name: 'TEST_WIDGETS',
            defaultValue: '',
            description: 'Optional: comma-separated widgets to test (empty = all). e.g. button,accordion,label'
        ],
        [
            $class: 'StringParameterDefinition',
            name: 'S3_VERSION',
            defaultValue: '',
            description: '''Release version folder for S3 report uploads (required for upload).
  e.g. WM-AI-Beta-2, 12.0.0
  Path: s3://<bucket>/react_native/releases/<S3_VERSION>/Style Workspace/<platform>/<date-time>'''
        ],
        [
            $class: 'BooleanParameterDefinition',
            name: 'SKIP_VISUAL_VERIFICATION',
            defaultValue: true,
            description: 'Mobile WDIO: skip baseline screenshots and visual diff (token value checks only). Uncheck to run full visual verification.'
        ],
        [
            $class: 'ChoiceParameterDefinition',
            name: 'MOBILE_APP_SOURCE',
            choices: ['Build from Studio (CLI)', 'Build with AppChef', 'Upload APK/IPA manually'],
            description: '''Mobile app source (BrowserStack runs only):
  Build from Studio (CLI) - RN ZIP from Studio, build APK/IPA locally via wm-reactnative-cli (needs Android SDK on agent)
  Build with AppChef - RN ZIP from Studio, build APK/IPA on WaveMaker Online AppChef (use WM_ENV=wmo)
  Upload APK/IPA manually - upload pre-built apps below (skips Studio mobile build)'''
        ],
        [
            $class: 'FileParameterDefinition',
            name: 'UPLOAD_ANDROID_ACTUAL_APK',
            description: 'Manual upload only: Android APK (required for Android mobile targets). Ignored for CLI build or web-only runs.'
        ],
        [
            $class: 'FileParameterDefinition',
            name: 'UPLOAD_IOS_ACTUAL_IPA',
            description: 'Manual upload only: iOS IPA (required for iOS mobile targets). Ignored for CLI build or web-only runs.'
        ],
        [
            $class: 'FileParameterDefinition',
            name: 'UPLOAD_ANDROID_BASELINE_APK',
            description: 'Manual upload only: baseline Android APK (required when SKIP_VISUAL_VERIFICATION is unchecked).'
        ],
        [
            $class: 'FileParameterDefinition',
            name: 'UPLOAD_IOS_BASELINE_IPA',
            description: 'Manual upload only: baseline iOS IPA (required when SKIP_VISUAL_VERIFICATION is unchecked).'
        ],
    ]
}

properties([parameters(pipelineParameters())])

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


    tools {
        nodejs 'NodeJS 20.8.1'
    }

    environment {
        // Android SDK / Gradle — bootstrap via scripts/setup-android-ci.sh when agent lacks them.
        // .ci-env.sh (sourced before mobile CLI builds) overrides these workspace defaults.
        ANDROID_HOME          = "${env.ANDROID_HOME ?: "${WORKSPACE}/.ci-tools/android-sdk"}"
        GRADLE_HOME           = "${env.GRADLE_HOME ?: "${WORKSPACE}/.ci-tools/gradle-8.10.2"}"
        WM_BUILD_TIMEOUT_MINUTES = '90'

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
        S3_REPORT_VERSION     = "${params.S3_VERSION}"
        RUN_LOCAL             = 'false'
        MOBILE_BUILD_DIR      = './mobile-builds'
        SKIP_VISUAL_VERIFICATION = "${params.SKIP_VISUAL_VERIFICATION}"
        // BrowserStack plan: max 2 parallel sessions — see Mobile stage for per-run maxInstances.
        // Standard CI flag so Playwright config can apply CI-specific options (forbidOnly, trace, etc.)
        CI                    = 'true'
    }

    stages {

        stage('Checkout') {
            steps {
                script {
                    // File parameters land in workspace before stages run; deleteDir() would wipe them.
                    def uploadParamNames = [
                        'UPLOAD_ANDROID_ACTUAL_APK',
                        'UPLOAD_IOS_ACTUAL_IPA',
                        'UPLOAD_ANDROID_BASELINE_APK',
                        'UPLOAD_IOS_BASELINE_IPA',
                    ]
                    def stashedUploads = []
                    uploadParamNames.each { paramName ->
                        def fileName = params[paramName]?.trim()
                        if (fileName && fileExists(fileName)) {
                            stash name: "upload-${paramName}", includes: fileName
                            stashedUploads << paramName
                            echo "📦 Stashed upload for ${paramName}: ${fileName}"
                        }
                    }

                    deleteDir()
                    checkout scm

                    stashedUploads.each { paramName ->
                        unstash "upload-${paramName}"
                        echo "📦 Restored upload for ${paramName}: ${params[paramName]}"
                    }
                }
            }
        }

        stage('Resolve WM Environment') {
            steps {
                script {
                    applyWmEnvProfile()
                }
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

                    if (isAppChefMobileBuild()) {
                        env.MOBILE_BUILD_METHOD = 'appchef'
                    } else if (isCliMobileBuild()) {
                        env.MOBILE_BUILD_METHOD = 'cli'
                    } else {
                        env.MOBILE_BUILD_METHOD = ''
                    }

                    echo "▶ WM_ENV=${params.WM_ENV}  |  RUN_WEB=${env.RUN_WEB}  |  RUN_MOBILE=${env.RUN_MOBILE}  |  SLOT_VERIFY_TARGET=${env.SLOT_VERIFY_TARGET}  |  MOBILE_PLATFORM=${env.MOBILE_PLATFORM}  |  MOBILE_APP_SOURCE=${params.MOBILE_APP_SOURCE}  |  MOBILE_BUILD_METHOD=${env.MOBILE_BUILD_METHOD ?: '(manual upload)'}  |  S3_VERSION=${params.S3_VERSION ?: '(not set — S3 upload skipped)'}  |  SKIP_VISUAL_VERIFICATION=${params.SKIP_VISUAL_VERIFICATION}"
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

        stage('Setup Android Build Tools') {
            when {
                expression {
                    env.RUN_MOBILE == 'true' &&
                    params.MOBILE_APP_SOURCE == 'Build from Studio (CLI)' &&
                    !params.RUN_TARGET.contains('iOS only')
                }
            }
            steps {
                sh '''
                    chmod +x scripts/setup-android-ci.sh
                    bash scripts/setup-android-ci.sh
                '''
            }
        }

        stage('Mobile — Prepare Uploaded Apps') {
            when {
                expression {
                    env.RUN_MOBILE == 'true' &&
                    params.MOBILE_APP_SOURCE == 'Upload APK/IPA manually'
                }
            }
            steps {
                script {
                    prepareUploadedMobileApps()
                }
            }
        }

        stage('Mobile — Setup (CLI / AppChef)') {
            when {
                expression {
                    env.RUN_MOBILE == 'true' && isStudioMobileBuild()
                }
            }
            steps {
                script {
                    // AppChef always uses WMO credentials regardless of WM_ENV
                    if (isAppChefMobileBuild()) {
                        withCredentials([usernamePassword(credentialsId: 'WM_WMO_CREDS', usernameVariable: 'WMO_USER', passwordVariable: 'WMO_PASS')]) {
                            env.WMO_USERNAME = env.WMO_USER
                            env.WMO_PASSWORD = env.WMO_PASS
                        }
                    }
                }
                sh '''
                    set -a
                    if [ "${MOBILE_BUILD_METHOD}" = "cli" ]; then
                      # shellcheck disable=SC1091
                      . scripts/load-ci-env.sh
                    fi
                    set +a
                    npx ts-node wdio/specs/mobile.global.setup.ts
                '''
            }
        }

        stage('Mobile — Run on BrowserStack') {
            when { expression { env.RUN_MOBILE == 'true' } }
            steps {
                sh '''
                    rm -rf allure-results allure-results-android allure-results-ios
                    mkdir -p allure-results allure-results-android allure-results-ios
                '''
                script {
                    def runAndroidTests = env.MOBILE_PLATFORM == 'android' || env.MOBILE_PLATFORM == 'both'
                    def runIosTests = env.MOBILE_PLATFORM == 'ios' || env.MOBILE_PLATFORM == 'both'
                    def bothPlatforms = runAndroidTests && runIosTests
                    // Both platforms in parallel: 1 spec worker each → same spec on Android+iOS (2 BS sessions).
                    // Single platform: 2 spec workers → up to 2 BS sessions.
                    def bsMaxInstances = bothPlatforms ? '1' : '2'
                    echo "▶ BrowserStack maxInstances=${bsMaxInstances} per WDIO run (both platforms=${bothPlatforms})"

                    def branches = [:]

                    if (runAndroidTests) {
                        branches['Android'] = {
                            sh """
                                echo "🤖 Running Android token validation on BrowserStack (maxInstances=${bsMaxInstances})"
                                MOBILE_PLATFORM=android MOBILE_STRICT_WIDGET_WAIT=true \
                                BROWSERSTACK_MAX_INSTANCES=${bsMaxInstances} \
                                ALLURE_RESULTS_DIR=allure-results-android \
                                npx wdio run wdio/config/wdio.browserstack.conf.ts \
                                    --spec "wdio/specs/mobile.*.token.validate.spec.ts" \
                                    || echo "⚠️  Android WDIO run completed with failures"
                            """
                        }
                    }
                    if (runIosTests) {
                        branches['iOS'] = {
                            sh """
                                echo "🍎 Running iOS token validation on BrowserStack (maxInstances=${bsMaxInstances})"
                                MOBILE_PLATFORM=ios MOBILE_STRICT_WIDGET_WAIT=true \
                                BROWSERSTACK_MAX_INSTANCES=${bsMaxInstances} \
                                ALLURE_RESULTS_DIR=allure-results-ios \
                                npx wdio run wdio/config/wdio.browserstack.conf.ts \
                                    --spec "wdio/specs/mobile.*.token.validate.spec.ts" \
                                    || echo "⚠️  iOS WDIO run completed with failures"
                            """
                        }
                    }
                    if (branches.size() == 1) {
                        branches.values()[0].call()
                    } else {
                        parallel branches
                    }
                }
                sh 'echo "✅ Mobile test runs completed"'
            }
        }

        stage('Mobile — Generate Allure Report') {
            when { expression { env.RUN_MOBILE == 'true' } }
            steps {
                sh '''
                    mkdir -p allure-results
                    cp -r allure-results-android/* allure-results/ 2>/dev/null || true
                    cp -r allure-results-ios/* allure-results/ 2>/dev/null || true
                    npx allure generate --clean allure-results -o allure-report || echo "allure generate skipped (using Jenkins Allure plugin instead)"
                '''
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
                uploadReportsToS3()
            }
        }
        failure {
            script {
                uploadReportsToS3(nonFatal: true)
            }
            echo 'Build failed — check Playwright / Allure report above.'
        }
        unstable {
            script {
                uploadReportsToS3(nonFatal: true)
            }
        }
    }
}
