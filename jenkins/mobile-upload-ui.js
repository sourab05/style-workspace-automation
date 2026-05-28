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
