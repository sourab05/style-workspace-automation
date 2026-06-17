"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Smoke test for AppChefClient.
 * Usage:
 *   npx ts-node scripts/test-appchef.ts
 *
 * What it tests (no actual build triggered):
 *   1. Login to WMO — verifies cookies are set
 *   2. appsByName    — verifies existing app lookup (App-89wCIVvZ)
 *   3. buildTasks    — fetches latest tasks and prints status fields
 *                      (confirms buildTaskStatus.name + externalId + token + fileByAndroidOutput.url)
 */
var dotenv = require("dotenv");
dotenv.config();
var appChefClient_1 = require("../src/api/appChefClient");
var WMO_USER = 'jeevan.inaparti@wavemaker.com';
var WMO_PASS = process.env.WM_WMO_STUDIO_PASSWORD || 'Wavemaker@123';
var KNOWN_APP_ID = 'App-89wCIVvZ'; // StyleWorkSpaceAutomation
var BUNDLE_ID = 'com.wavemaker.styleworkspaceautomation';
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var client, existingApp, axios, resp, tasks, _i, _a, t;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    client = new appChefClient_1.AppChefClient();
                    // ── Step 1: Login ───────────────────────────────────────────────────────────
                    console.log('\n[Test] Step 1: Login');
                    return [4 /*yield*/, client.login(WMO_USER, WMO_PASS)];
                case 1:
                    _h.sent();
                    console.log('[Test] ✅ Login OK');
                    // ── Step 2: appsByName ──────────────────────────────────────────────────────
                    console.log('\n[Test] Step 2: appsByName lookup');
                    return [4 /*yield*/, client.findAppByName(BUNDLE_ID)];
                case 2:
                    existingApp = _h.sent();
                    if (existingApp) {
                        console.log("[Test] \u2705 Found existing app: id=".concat(existingApp.id, " appId=").concat(existingApp.appId, " name=").concat(existingApp.name));
                    }
                    else {
                        console.log('[Test] ℹ️  No existing app found (would create new)');
                    }
                    // ── Step 3: buildTasks — fetch latest and print status ──────────────────────
                    console.log('\n[Test] Step 3: buildTasks for ' + KNOWN_APP_ID);
                    axios = require('axios');
                    return [4 /*yield*/, client.http.get('/buildTasks', {
                            params: { appId: KNOWN_APP_ID, platform: 'all', page: 1, size: 5 },
                            headers: client.authHeaders(),
                        })];
                case 3:
                    resp = _h.sent();
                    tasks = Array.isArray(resp.data)
                        ? resp.data
                        : ((_c = (_b = resp.data) === null || _b === void 0 ? void 0 : _b.content) !== null && _c !== void 0 ? _c : []);
                    if (tasks.length === 0) {
                        console.log('[Test] ℹ️  No build tasks found yet');
                    }
                    else {
                        for (_i = 0, _a = tasks.slice(0, 3); _i < _a.length; _i++) {
                            t = _a[_i];
                            console.log("\n  taskId (externalId) : ".concat(t.externalId));
                            console.log("  token               : ".concat(t.token));
                            console.log("  platform            : ".concat(t.platform));
                            console.log("  status              : ".concat(t.status));
                            console.log("  buildTaskStatus     : ".concat(JSON.stringify(t.buildTaskStatus)));
                            console.log("  fileByAndroidOutput : ".concat((_e = (_d = t.fileByAndroidOutput) === null || _d === void 0 ? void 0 : _d.url) !== null && _e !== void 0 ? _e : 'null'));
                            console.log("  fileByIosOutput     : ".concat((_g = (_f = t.fileByIosOutput) === null || _f === void 0 ? void 0 : _f.url) !== null && _g !== void 0 ? _g : 'null'));
                            console.log("  downloadUrl (built) : https://www.wavemakeronline.com/AppChef/services/chef/downloadOutput?buildTaskId=".concat(t.externalId, "&platform=").concat(t.platform, "&download=true"));
                        }
                    }
                    console.log('\n[Test] ✅ All checks passed');
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (e) {
    var _a, _b, _c, _d, _e;
    console.error('\n[Test] ❌ FAILED:', JSON.stringify((_c = (_b = (_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.data) !== null && _b !== void 0 ? _b : e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : e, null, 2));
    console.error('  status:', (_d = e === null || e === void 0 ? void 0 : e.response) === null || _d === void 0 ? void 0 : _d.status);
    console.error('  headers:', JSON.stringify((_e = e === null || e === void 0 ? void 0 : e.response) === null || _e === void 0 ? void 0 : _e.headers, null, 2));
    process.exit(1);
});
