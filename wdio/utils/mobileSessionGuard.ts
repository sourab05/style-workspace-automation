type Browser = WebdriverIO.Browser;

const DEAD_SESSION_PATTERN =
  /session (not started|terminated|invalid)|invalid session id|no such driver|ECONNREFUSED|socket hang up|A session is either terminated or not started/i;

export class MobileSessionDeadError extends Error {
  readonly name = 'MobileSessionDeadError';

  constructor(message = 'Appium session is dead or terminated') {
    super(message);
  }
}

export function isSessionDeadError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return DEAD_SESSION_PATTERN.test(message);
}

/**
 * Tracks BrowserStack / Appium sessions that have died so later token tests
 * fail fast instead of waiting for Mocha timeout on every command.
 */
export class MobileSessionGuard {
  private static deadSessionIds = new Set<string>();

  private static sessionKey(browser: Browser): string {
    const sessionId = (browser as { sessionId?: string }).sessionId;
    return sessionId || String((browser as { capabilities?: { sessionId?: string } }).capabilities?.sessionId ?? 'unknown');
  }

  static markDead(browser: Browser, reason?: string): void {
    const key = MobileSessionGuard.sessionKey(browser);
    MobileSessionGuard.deadSessionIds.add(key);
    console.error(`   💀 Session marked dead (${key})${reason ? `: ${reason}` : ''}`);
  }

  static isDead(browser: Browser): boolean {
    return MobileSessionGuard.deadSessionIds.has(MobileSessionGuard.sessionKey(browser));
  }

  static assertAlive(browser: Browser): void {
    if (MobileSessionGuard.isDead(browser)) {
      throw new MobileSessionDeadError();
    }
  }

  /**
   * Runs fn and marks the session dead when Appium returns a terminal error.
   */
  static async run<T>(browser: Browser, fn: () => Promise<T>): Promise<T> {
    MobileSessionGuard.assertAlive(browser);
    try {
      return await fn();
    } catch (err: unknown) {
      if (isSessionDeadError(err)) {
        MobileSessionGuard.markDead(browser, err instanceof Error ? err.message : String(err));
        throw new MobileSessionDeadError(err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
}
