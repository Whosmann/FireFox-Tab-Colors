/**
 * TabChroma - Semantic Versioning Helper for Firefox Add-on Re-uploads
 */

export type VersionBumpType = 'patch' | 'minor' | 'major';

/**
 * Validates standard Firefox extension version strings (e.g. 1.0.1 or 2.1)
 */
export function isValidVersion(version: string): boolean {
  if (!version || typeof version !== 'string') return false;
  const trimmed = version.trim();
  return /^\d+(\.\d+)*$/.test(trimmed);
}

/**
 * Increments semantic version based on bump type
 * @example bumpVersion('1.0.0', 'patch') => '1.0.1'
 * @example bumpVersion('1.0.1', 'minor') => '1.1.0'
 * @example bumpVersion('1.1.0', 'major') => '2.0.0'
 */
export function bumpVersion(currentVersion: string, type: VersionBumpType = 'patch'): string {
  const clean = (currentVersion || '1.0.0').trim();
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);

  // Normalize to at least 3 parts (major.minor.patch)
  while (parts.length < 3) {
    parts.push(0);
  }

  if (type === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else {
    // patch
    parts[2] += 1;
  }

  return parts.slice(0, 3).join('.');
}

/**
 * Compares two versions: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = (v1 || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = (v2 || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
