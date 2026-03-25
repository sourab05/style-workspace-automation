import { test, expect } from '@playwright/test';
import { loadAllTokens } from '../src/tokens';

// Smoke test to ensure tokens are discoverable and valid

test('discover and validate token files', async () => {
  const all = loadAllTokens();
  expect(all.length).toBeGreaterThan(0);
  for (const t of all) {
    expect(t.data).toBeTruthy();
  }
});
