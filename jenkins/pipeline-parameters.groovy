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
            choices: ['Build from Studio (CLI)', 'Upload APK/IPA manually'],
            description: '''Mobile app source (BrowserStack runs only):
  Build from Studio (CLI) - downloads RN project, applies tokens, builds APK/IPA via WaveMaker CLI
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
