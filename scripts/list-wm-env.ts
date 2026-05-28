#!/usr/bin/env npx ts-node
import { listWmEnvProfiles } from '../src/utils/wm-env-profiles';

console.log('Available WM_ENV profiles (set WM_ENV in .env or Jenkins):\n');
listWmEnvProfiles();
