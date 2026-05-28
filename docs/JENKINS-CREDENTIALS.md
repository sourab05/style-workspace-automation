# Jenkins Credentials Setup

Create all credentials at: **Manage Jenkins → Credentials → System → Global credentials (unrestricted)**

Credential **ID must match exactly** (case-sensitive). Scope must be **Global**.

---

## Required for every build

| Credential ID | Kind | Username | Secret value |
|---------------|------|----------|--------------|
| `BROWSERSTACK_CREDS` | Username with password | BrowserStack username | BrowserStack access key |
| `AWS_ACCESS_KEY_ID` | Secret text | — | AWS access key ID |
| `AWS_SECRET_ACCESS_KEY` | Secret text | — | AWS secret access key |
| `S3_BUCKET_NAME` | Secret text | — | `wm-qa-automation` (or your bucket name) |

---

## Studio login — one per WM_ENV (Username with password)

Create **all six** if your team uses every environment. Only the credential matching the selected `WM_ENV` build parameter is used.

| Credential ID | WM_ENV value | Username | Password |
|---------------|--------------|----------|----------|
| `WM_STAGE_AI_CREDS` | `stage-ai` | `testuser1.rn@wavemaker.com` | *(stage-ai testuser password)* |
| `WM_STAGE_AI_JEEVAN_CREDS` | `stage-ai-jeevan` | `jeevan.inaparti@wavemaker.com` | `@Nbi8VTPKv` |
| `WM_STAGE_CREDS` | `stage` | `jeevan.sourab@wavemaker.com` | *(stage ES password)* |
| `WM_DEV_CREDS` | `dev` | `jeevan.inaparti@wavemaker.com` | `Wavemaker@123` |
| `WM_WMO_CREDS` | `wmo` | `jeevan.inaparti@wavemaker.com` | `Wavemaker@123` |
| `WM_PREPROD_CREDS` | `preprod` | `jeevan.inaparti@wavemaker.com` | `Wavemaker@123` |

### What each WM_ENV sets automatically

| WM_ENV | Studio URL | Project ID |
|--------|------------|------------|
| `stage-ai` | https://stage-platform.wavemaker.ai/ | WMPRJ2c9180879d41cfdf019d482aa382004c |
| `stage-ai-jeevan` | https://stage-platform.wavemaker.ai/ | WMPRJ2c9180879c721827019c757fb4ee0023 |
| `stage` | https://stage-studio.wavemakeronline.com/ | WMPRJ2c9180879b8c2464019b8ca78bde000e |
| `dev` | https://dev-studio.wavemakeronline.com/ | WMPRJ2c91808e9b382f28019b4b3d6faf1157 |
| `wmo` | https://www.wavemakeronline.com/ | WMPRJ2c9180889ad75b5a019b01f3c0120213 |
| `preprod` | https://stage-studio.wavemakeronline.com/ | WMPRJ2c91808e9d97d113019d9a6ce22f0011 |

---

## Legacy fallback (optional)

Used only when the matching `WM_*_CREDS` credential is missing:

| Credential ID | Kind |
|---------------|------|
| `STUDIO_USERNAME` | Secret text |
| `STUDIO_PASSWORD` | Secret text |

---

## Global Tool Configuration

| Tool name | Type | Notes |
|-----------|------|-------|
| `NodeJS 20.8.1` | NodeJS | Must match Jenkinsfile `tools { nodejs 'NodeJS 20.8.1' }` |

---

## Plugins

| Plugin | Purpose |
|--------|---------|
| Pipeline | Core |
| Git | SCM checkout |
| Credentials Binding | Inject secrets |
| NodeJS | Node tool |
| Allure | Mobile reports |

---

## Build parameters (no credentials — configured by Jenkinsfile)

Upload file fields are always visible on Build with Parameters. The pipeline validates at runtime which uploads are required based on `RUN_TARGET`, `MOBILE_APP_SOURCE`, and `SKIP_VISUAL_VERIFICATION`.

| Parameter | When upload is required |
|-----------|-------------------------|
| `RUN_TARGET` = Mobile — Android only | Android APK fields only |
| `RUN_TARGET` = Mobile — iOS only | iOS IPA fields only |
| `RUN_TARGET` = Mobile — Android + iOS or All | Both Android + iOS fields |
| `MOBILE_APP_SOURCE` = Upload APK/IPA manually | Upload fields enforced (for mobile targets) |
| `MOBILE_APP_SOURCE` = Build from Studio (CLI) | Agent needs Android SDK/Gradle (`Setup Android Build Tools` stage) |
| `MOBILE_APP_SOURCE` = Build with AppChef | Uses WMO AppChef API; set **WM_ENV=wmo** (same Studio creds as `WM_WMO_CREDS`) |
| `SKIP_VISUAL_VERIFICATION` = checked | Baseline upload fields not required |
