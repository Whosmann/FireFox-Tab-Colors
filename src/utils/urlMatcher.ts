/**
 * URL Matching Engine for Firefox Tab Color Extension
 * Evaluates URLs against Wildcards, Domains, Prefixes, Regex, and Exact URLs
 */

import { FirefoxContainerColor, MatchResult, TabColorRule } from '../types/extension';

export const FIREFOX_CONTAINER_COLORS: Record<FirefoxContainerColor, { name: string; hex: string; bg: string }> = {
  blue: { name: 'Blue', hex: '#37adff', bg: 'rgba(55, 173, 255, 0.15)' },
  turquoise: { name: 'Turquoise', hex: '#00c79a', bg: 'rgba(0, 199, 154, 0.15)' },
  green: { name: 'Green', hex: '#51cf66', bg: 'rgba(81, 207, 102, 0.15)' },
  yellow: { name: 'Yellow', hex: '#ffcb00', bg: 'rgba(255, 203, 0, 0.15)' },
  orange: { name: 'Orange', hex: '#ff9400', bg: 'rgba(255, 148, 0, 0.15)' },
  red: { name: 'Red', hex: '#ff4f5e', bg: 'rgba(255, 79, 94, 0.15)' },
  pink: { name: 'Pink', hex: '#ff4ba0', bg: 'rgba(255, 75, 160, 0.15)' },
  purple: { name: 'Purple', hex: '#9059ff', bg: 'rgba(144, 89, 255, 0.15)' },
};

/**
 * Converts a wildcard glob string (e.g. *.example.com/*) to a valid RegExp
 */
export function wildcardToRegExp(pattern: string): RegExp {
  const normalized = pattern.trim();
  // Escape special regex chars except * and ?
  const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // Convert glob * to .* and ? to .
  const regexStr = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
  return new RegExp(regexStr, 'i');
}

/**
 * Validates whether a regex or wildcard pattern is syntactically valid
 */
export function validatePattern(pattern: string, type: TabColorRule['patternType']): { valid: boolean; error?: string } {
  if (!pattern || pattern.trim() === '') {
    return { valid: false, error: 'Pattern cannot be empty' };
  }

  if (type === 'regex') {
    try {
      new RegExp(pattern);
      return { valid: true };
    } catch (e: any) {
      return { valid: false, error: e.message || 'Invalid regular expression syntax' };
    }
  }

  return { valid: true };
}

/**
 * Tests if a URL string matches a specific rule
 */
export function testRuleMatch(url: string, rule: TabColorRule): { matched: boolean; reason?: string } {
  if (!rule.enabled) {
    return { matched: false, reason: 'Rule is disabled' };
  }

  if (!url || typeof url !== 'string') {
    return { matched: false, reason: 'Empty URL' };
  }

  const cleanUrl = url.trim();

  // Try parsing the URL for structured components
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') ? cleanUrl : `https://${cleanUrl}`);
  } catch {
    // If not standard URL format, fallback to raw string testing
  }

  switch (rule.patternType) {
    case 'wildcard': {
      try {
        const regex = wildcardToRegExp(rule.pattern);
        const matchesFull = regex.test(cleanUrl);
        const matchesWithoutProto = parsedUrl ? regex.test(cleanUrl.replace(/^https?:\/\//i, '')) : false;
        if (matchesFull || matchesWithoutProto) {
          return { matched: true, reason: `Matches wildcard pattern: ${rule.pattern}` };
        }
      } catch (err: any) {
        return { matched: false, reason: `Wildcard compilation error: ${err.message}` };
      }
      return { matched: false };
    }

    case 'domain': {
      const targetDomain = rule.pattern.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
      if (parsedUrl) {
        const host = parsedUrl.hostname.toLowerCase();
        if (host === targetDomain) {
          return { matched: true, reason: `Host ${host} matches domain rule ${targetDomain}` };
        }
        if (host.endsWith(`.${targetDomain}`)) {
          return { matched: true, reason: `Host ${host} matches as a subdomain of domain rule ${targetDomain}` };
        }
      }
      // String fallback only if URL could not be parsed
      if (!parsedUrl && cleanUrl.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').startsWith(targetDomain)) {
        return { matched: true, reason: `Host matches domain token ${targetDomain}` };
      }
      return { matched: false };
    }

    case 'exact_host': {
      const targetHost = rule.pattern.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
      if (parsedUrl) {
        const host = parsedUrl.hostname.toLowerCase();
        if (host === targetHost) {
          return { matched: true, reason: `Host ${host} exactly matches host rule ${targetHost} (subdomains isolated)` };
        }
        return { matched: false, reason: `Host ${host} does not equal exact host ${targetHost}` };
      }
      const rawHost = cleanUrl.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '').toLowerCase();
      if (rawHost === targetHost) {
        return { matched: true, reason: `Exact host match: ${targetHost}` };
      }
      return { matched: false };
    }

    case 'prefix': {
      const targetPrefix = rule.pattern.toLowerCase();
      if (cleanUrl.toLowerCase().startsWith(targetPrefix)) {
        return { matched: true, reason: `URL starts with prefix: ${rule.pattern}` };
      }
      if (parsedUrl && cleanUrl.replace(/^https?:\/\//i, '').toLowerCase().startsWith(targetPrefix.replace(/^https?:\/\//i, ''))) {
        return { matched: true, reason: `URL (protocol agnostic) matches prefix: ${rule.pattern}` };
      }
      return { matched: false };
    }

    case 'exact': {
      const normalizedTarget = rule.pattern.replace(/\/+$/, '').toLowerCase();
      const normalizedUrl = cleanUrl.replace(/\/+$/, '').toLowerCase();
      if (normalizedTarget === normalizedUrl) {
        return { matched: true, reason: `Exact URL match` };
      }
      return { matched: false };
    }

    case 'regex': {
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(cleanUrl)) {
          return { matched: true, reason: `Matches regular expression: /${rule.pattern}/i` };
        }
      } catch (err: any) {
        return { matched: false, reason: `Regex syntax error: ${err.message}` };
      }
      return { matched: false };
    }

    default:
      return { matched: false };
  }
}

/**
 * Finds the highest-priority matching rule for a given URL
 */
export function matchUrlAgainstRules(url: string, rules: TabColorRule[]): MatchResult {
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (!rule.enabled) continue;
    const result = testRuleMatch(url, rule);
    if (result.matched) {
      return {
        matched: true,
        rule,
        reason: result.reason,
      };
    }
  }

  return {
    matched: false,
    reason: 'No configured rules matched this URL.',
  };
}

/**
 * Maps a hex color to the closest standard Firefox Container Color
 */
export function findClosestContainerColor(hex: string): FirefoxContainerColor {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return 'blue';

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  let closest: FirefoxContainerColor = 'blue';
  let minDistance = Infinity;

  const hexMap: Record<FirefoxContainerColor, [number, number, number]> = {
    blue: [55, 173, 255],
    turquoise: [0, 199, 154],
    green: [81, 207, 102],
    yellow: [255, 203, 0],
    orange: [255, 148, 0],
    red: [255, 79, 94],
    pink: [255, 75, 160],
    purple: [144, 89, 255],
  };

  for (const [colorName, [cr, cg, cb]] of Object.entries(hexMap)) {
    const dist = Math.sqrt(
      Math.pow(r - cr, 2) + Math.pow(g - cg, 2) + Math.pow(b - cb, 2)
    );
    if (dist < minDistance) {
      minDistance = dist;
      closest = colorName as FirefoxContainerColor;
    }
  }

  return closest;
}

/**
 * Converts a hex color string (#RRGGBB or #RGB) and opacity (0 to 1) into an rgba(...) string.
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  if (!hex) return `rgba(55, 173, 255, ${alpha})`;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
  }
  return hex;
}

