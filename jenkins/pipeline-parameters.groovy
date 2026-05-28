def hasActiveChoicesPlugin() {
    try {
        def plugin = jenkins.model.Jenkins.instance?.pluginManager?.getPlugin('uno-choice')
        return plugin != null && plugin.isEnabled()
    } catch (Throwable ignored) {
        return false
    }
}

def pipelineParameters() {
    def uploadUiScript = '''
(function () {
  var PARAMS = [
    'UPLOAD_ANDROID_ACTUAL_APK',
    'UPLOAD_IOS_ACTUAL_IPA',
    'UPLOAD_ANDROID_BASELINE_APK',
    'UPLOAD_IOS_BASELINE_IPA',
  ];

  function rowFor(name) {
    var fileInputs = document.querySelectorAll('input[type=file]');
    for (var i = 0; i < fileInputs.length; i++) {
      var inputName = fileInputs[i].name || '';
      if (inputName === name || inputName === '.' + name || inputName.indexOf(name) >= 0) {
        return (
          fileInputs[i].closest('.jenkins-form-item') ||
          fileInputs[i].closest('.parameter') ||
          fileInputs[i].closest('tr')
        );
      }
    }
    var items = document.querySelectorAll('.jenkins-form-item, .parameter');
    for (var j = 0; j < items.length; j++) {
      if ((items[j].textContent || '').indexOf(name) >= 0) {
        return items[j];
      }
    }
    return null;
  }

  function setVisible(name, show) {
    var row = rowFor(name);
    if (row) row.style.display = show ? '' : 'none';
  }

  function selectValue(name) {
    var el = document.querySelector('select[name="' + name + '"]');
    return el ? el.value : '';
  }

  function skipVisual() {
    var cb = document.querySelector('input[name="SKIP_VISUAL_VERIFICATION"]');
    return cb ? cb.checked : true;
  }

  function applyUploadVisibility() {
    PARAMS.forEach(function (p) {
      setVisible(p, false);
    });

    var manual = selectValue('MOBILE_APP_SOURCE') === 'Upload APK/IPA manually';
    var runTarget = selectValue('RUN_TARGET');
    var mobileRun = runTarget.indexOf('Mobile') >= 0 || runTarget.indexOf('All') >= 0;

    if (!manual || !mobileRun) {
      return;
    }

    var needAndroid = runTarget.indexOf('Android') >= 0 || runTarget.indexOf('All') >= 0;
    var needIos = runTarget.indexOf('iOS') >= 0 || runTarget.indexOf('All') >= 0;
    var needBaseline = !skipVisual();

    if (needAndroid) setVisible('UPLOAD_ANDROID_ACTUAL_APK', true);
    if (needIos) setVisible('UPLOAD_IOS_ACTUAL_IPA', true);
    if (needBaseline && needAndroid) setVisible('UPLOAD_ANDROID_BASELINE_APK', true);
    if (needBaseline && needIos) setVisible('UPLOAD_IOS_BASELINE_IPA', true);
  }

  function bindUploadVisibility() {
    applyUploadVisibility();
    ['RUN_TARGET', 'MOBILE_APP_SOURCE'].forEach(function (name) {
      var el = document.querySelector('select[name="' + name + '"]');
      if (el && !el.dataset.uploadUiBound) {
        el.dataset.uploadUiBound = '1';
        el.addEventListener('change', applyUploadVisibility);
      }
    });
    var skipCb = document.querySelector('input[name="SKIP_VISUAL_VERIFICATION"]');
    if (skipCb && !skipCb.dataset.uploadUiBound) {
      skipCb.dataset.uploadUiBound = '1';
      skipCb.addEventListener('change', applyUploadVisibility);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUploadVisibility);
  } else {
    bindUploadVisibility();
  }
  setInterval(applyUploadVisibility, 700);
})();
'''.trim()

    def activeChoiceScript = "return '<script>' + ${groovy.json.JsonOutput.toJson(uploadUiScript)} + '</script>'"

    def params = [
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
            description: 'Manual upload: Android APK -> mobile-builds/actual/build-out-android/.../app-debug.apk'
        ],
        [
            $class: 'FileParameterDefinition',
            name: 'UPLOAD_IOS_ACTUAL_IPA',
            description: 'Manual upload: iOS IPA -> mobile-builds/actual/build-out-ios/output/ios/app-debug.ipa'
        ],
        [
            $class: 'FileParameterDefinition',
            name: 'UPLOAD_ANDROID_BASELINE_APK',
            description: 'Manual upload: baseline Android APK (only when SKIP_VISUAL_VERIFICATION is unchecked)'
        ],
        [
            $class: 'FileParameterDefinition',
            name: 'UPLOAD_IOS_BASELINE_IPA',
            description: 'Manual upload: baseline iOS IPA (only when SKIP_VISUAL_VERIFICATION is unchecked)'
        ],
    ]

    if (hasActiveChoicesPlugin()) {
        params.add([
            $class: 'DynamicReferenceParameter',
            choiceType: 'ET_FORMATTED_HTML',
            name: 'MOBILE_UPLOAD_HELPER',
            description: 'Dynamic upload field visibility (Active Choices plugin). Helper only - no value submitted.',
            omitValueField: true,
            referencedParameters: 'RUN_TARGET,MOBILE_APP_SOURCE,SKIP_VISUAL_VERIFICATION',
            script: [
                $class: 'GroovyScript',
                fallbackScript: [
                    classpath: [],
                    sandbox: true,
                    script: 'return "<p>Active Choices upload helper failed to load.</p>"'
                ],
                script: [
                    classpath: [],
                    sandbox: true,
                    script: activeChoiceScript
                ]
            ]
        ])
    }

    return params
}

properties([parameters(pipelineParameters())])
