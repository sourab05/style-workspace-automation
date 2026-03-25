import fs from 'fs';
import path from 'path';

/**
 * Simple file + console logger used by Playwright tests.
 *
 * The tests expect the following API:
 *   - logger.initialize()
 *   - logger.log(message: string)
 *   - logger.writeOrthogonalMatrix(matrix: any[])
 *   - logger.writeTokenVariantPairs(pairs: any[])
 *   - logger.writeTokenMappings(mappings: Record<string, any>)
 *   - logger.writeVariantMappings(mappings: any[])
 *
 * This implementation is intentionally lightweight: it writes human-readable
 * JSON/NDJSON files under debug/logs and also echoes messages to console.
 */

class Logger {
  private logStream: fs.WriteStream | null = null;
  private logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'debug', 'logs');
  }

  initialize(): void {
    // Ensure logs directory exists
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(this.logsDir, `playwright-${timestamp}.log`);

    // Close any existing stream
    if (this.logStream) {
      this.logStream.end();
    }

    this.logStream = fs.createWriteStream(logFile, { flags: 'a' });
    this.log(`Logger initialized. Writing to ${logFile}`);
  }

  log(message: string): void {
    const line = `[${new Date().toISOString()}] ${message}`;
    // Always echo to console for visibility
    // eslint-disable-next-line no-console
    console.log(line);

    if (this.logStream) {
      this.logStream.write(line + '\n');
    }
  }

  private writeJsonArtifact(fileName: string, data: any): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
      const filePath = path.join(this.logsDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      // NOTE: Intentionally no console log here to keep test output concise.
      // The JSON artifact on disk under debug/logs is the source of truth.
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to write debug artifact', fileName, e);
    }
  }

  writeOrthogonalMatrix(matrix: any[]): void {
    this.writeJsonArtifact('orthogonal-matrix.json', matrix);
  }

  writeTokenVariantPairs(pairs: any[]): void {
    this.writeJsonArtifact('token-variant-pairs.json', pairs);
  }

  writeTokenMappings(mappings: Record<string, any>): void {
    this.writeJsonArtifact('token-mappings.json', mappings);
  }

  writeVariantMappings(mappings: any[]): void {
    // Accumulate all variant mappings across the run so we can
    // later replay/test all payloads via a separate script.
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
      const filePath = path.join(this.logsDir, 'variant-mappings.json');
      let existing: any[] = [];
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8').trim();
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              existing = parsed;
            }
          }
        } catch {
          // Ignore parse errors and start fresh
          existing = [];
        }
      }
      const combined = [...existing, ...mappings];
      fs.writeFileSync(filePath, JSON.stringify(combined, null, 2), 'utf-8');
      // Do not log per-write to console; this gets very noisy. The JSON file
      // under debug/logs/variant-mappings.json is the source of truth.
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to write debug artifact variant-mappings.json', e);
    }
  }
}

export const logger = new Logger();
