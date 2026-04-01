# Prompt: Upload Any Automation Framework to Jenkins

Use this prompt when setting up a new test automation framework on Jenkins. Copy-paste it into your AI assistant or follow it manually.

---

## The Prompt

```
I want to set up my automation framework on Jenkins CI. Here's my setup:

- Jenkins URL: http://34.27.46.55:8080
- Jenkins User: qajenkins
- GitHub Account: sourab05
- Node.js on Jenkins: NodeJS 20.8.1 (configured in Global Tool Configuration)
- Jenkins runs on: Linux (Docker container, headless, no display)

Framework details:
- Repo: [PASTE GITHUB URL]
- Package manager: [npm / pnpm / yarn]
- Lock file: [package-lock.json / pnpm-lock.yaml / yarn.lock]
- Test runner: [playwright / wdio / jest / mocha / cypress]
- Auth method: [form login / Platform DB REST / Google OAuth / cookie-based / API key / none]

Please create a Jenkinsfile with:
1. A single RUN_TARGET dropdown parameter combining all test options
2. An optional TEST_WIDGETS/TEST_SUITE text parameter for filtering
3. Credentials stored as Jenkins Secret Text (Global scope, NOT System scope)
4. npm/pnpm/yarn install step matching my lock file
5. Any build steps needed before tests (e.g. token generation, compilation)
6. Test execution with xvfb-run if headed browser is needed on Linux
7. Report archiving (no publishHTML — plugin not installed)
8. Post block with only echo (no archiveArtifacts/sh in global post to avoid MissingContextVariableException)

IMPORTANT LESSONS FROM PAST SETUP:
- Jenkins credential scope MUST be "Global", NOT "System" — System scope is invisible to Pipeline jobs
- Use `npm install` or `pnpm install --frozen-lockfile`, NOT `npm ci` (fails without package-lock.json)
- If using pnpm, add `npm install -g pnpm` step before `pnpm install`
- BrowserStack credentials must use "Username with password" kind, NOT the BrowserStack plugin kind (credentials() doesn't support it)
- For wavemaker.ai domains (stage-platform, platform): auto-detected as "Platform DB" login — uses REST API with `X-WM-AUTH-PROVIDER: Platform DB` header. No browser or Google OAuth needed; works headless on Jenkins out of the box.
- For wavemakeronline.com domains: uses WaveMaker form login (browser-based).
- Google OAuth is only needed if AUTH_METHOD=google is forced (not recommended for Jenkins — Google blocks unknown devices).
- For headed browsers on headless Linux: wrap command with `xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24"`
- The `post { always { archiveArtifacts } }` block crashes with MissingContextVariableException when pipeline fails before workspace allocation — keep post block minimal
- Node label 'built-in' doesn't exist on all Jenkins setups — use `agent any` and don't wrap post steps in node()
```

---

## Pre-flight Checklist

Before running the Jenkins job for the first time:

### 1. Git Repository
- [ ] `.gitignore` covers: `node_modules/`, `.env`, `screenshots/`, `artifacts/`, `allure-results/`, `logs/`, `*.log`, `.test-cache/`, `certificates/`, `*.keystore`
- [ ] `.env` is NOT committed (only `.env.example` with placeholder values)
- [ ] No secrets, API keys, or passwords in any committed file
- [ ] Lock file (package-lock.json / pnpm-lock.yaml) is committed

### 2. Jenkins Plugins Required
- [ ] NodeJS Plugin (for Node.js tool)
- [ ] Pipeline Plugin (usually pre-installed)
- [ ] Git Plugin (usually pre-installed)
- [ ] Credentials Binding Plugin (usually pre-installed)
- [ ] Allure Plugin (only if using Allure reports)

### 3. Jenkins Global Tool Configuration
- [ ] NodeJS configured with name matching Jenkinsfile (e.g. `NodeJS 20.8.1`)

### 4. Jenkins Credentials (all Global scope)
Add each credential at: Manage Jenkins → Credentials → System → Global credentials

| Kind | When to use |
|------|-------------|
| Secret text | Single values (URLs, API keys, passwords) |
| Username with password | BrowserStack, database credentials |
| Secret file | Certificate files, auth.json |

**CRITICAL:** 
- ID must be EXACT match (case-sensitive) to what's in the Jenkinsfile `credentials('ID')`
- Scope must be `Global (Jenkins, nodes, items, all child items, etc)` — NOT `System`
- For BrowserStack: use "Username with password" kind, NOT "BrowserStack" kind

### 5. Jenkins Job Configuration
- Job type: **Pipeline**
- Definition: **Pipeline script from SCM**
- SCM: **Git**
- Repository URL: your GitHub repo URL
- Branch: `*/main`
- Script Path: `Jenkinsfile`

---

## Common Jenkins Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ERROR: CREDENTIAL_ID` | Credential not found | Check ID matches exactly, scope is Global not System |
| `npm ci` fails | No package-lock.json | Use `npm install` or `pnpm install` instead |
| `Tool type "nodejs" does not have an install of "X"` | Wrong tool name | Check exact name in Global Tool Configuration |
| `MissingContextVariableException: FilePath` | Post block has no workspace | Keep post block to just `echo`, no file operations |
| `No such DSL method 'publishHTML'` | Plugin not installed | Use `archiveArtifacts` in stage post, not global post |
| `Missing X server or $DISPLAY` | Headed browser on headless Linux | Wrap with `xvfb-run --auto-servernum` |
| `No suitable binding handler for BrowserStack` | Wrong credential type | Delete and recreate as "Username with password" |
| `Cannot navigate to invalid URL` | Empty/malformed credential value | Update credential — ensure no spaces, include https:// |
| Google "Verify it's you" | Unknown device/IP | Use wavemaker.ai URL (auto-uses Platform DB login) or set AUTH_METHOD=platformdb |

---

## Jenkinsfile Template

```groovy
pipeline {
    agent any

    parameters {
        choice(
            name: 'RUN_TARGET',
            choices: ['All Tests', 'Smoke Tests', 'Regression Tests'],
            description: 'What to run'
        )
        string(
            name: 'TEST_FILTER',
            defaultValue: '',
            description: 'Optional: filter tests (empty = all)'
        )
    }

    tools {
        nodejs 'NodeJS 20.8.1'
    }

    environment {
        // Add your credentials here — ID must match Jenkins credential store
        MY_SECRET = credentials('MY_SECRET')
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Install Dependencies') {
            steps {
                sh 'node --version && npm --version'
                // Pick ONE based on your package manager:
                // sh 'npm install'
                // sh 'npm install -g pnpm && pnpm install --frozen-lockfile'
                // sh 'yarn install --frozen-lockfile'
            }
        }

        stage('Run Tests') {
            steps {
                // For headless browser tests on Linux:
                sh '''
                    xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" \
                    npx playwright test --reporter=html,line
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'test-report/**', allowEmptyArchive: true
                }
            }
        }
    }

    post {
        failure {
            echo 'Build failed — check test reports above.'
        }
    }
}
```
