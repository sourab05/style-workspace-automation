import fs from 'fs';

/** Reject placeholder/corrupt builds before BrowserStack upload or WDIO runs. */
const MIN_APK_BYTES = 512 * 1024;
const MIN_IPA_BYTES = 512 * 1024;

export function validateMobileAppArtifact(
  platform: 'android' | 'ios',
  filePath: string,
  label: string,
): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label}: file not found at ${filePath}`);
  }

  const { size } = fs.statSync(filePath);
  const minBytes = platform === 'android' ? MIN_APK_BYTES : MIN_IPA_BYTES;
  const sizeMb = (size / (1024 * 1024)).toFixed(2);

  if (size < minBytes) {
    throw new Error(
      `${label}: ${filePath} is only ${size} bytes (${sizeMb} MB) — likely a blank or corrupt ${platform.toUpperCase()} artifact. ` +
        'Rebuild the app (AppChef/CLI) or re-upload a valid IPA/APK before running mobile tests.',
    );
  }

  const header = Buffer.alloc(2);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, header, 0, 2, 0);
  } finally {
    fs.closeSync(fd);
  }

  // APK/IPA are ZIP archives (PK..).
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    throw new Error(
      `${label}: ${filePath} is not a valid ZIP archive — file may be corrupt or a placeholder, not a real ${platform.toUpperCase()} build.`,
    );
  }

  console.log(`✓ ${label}: ${filePath} (${sizeMb} MB)`);
}
