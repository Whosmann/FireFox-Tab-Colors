/**
 * URL Matching Engine for Firefox Tab Color Extension
 * Evaluates URLs against Wildcards, Domains, Prefixes, Regex, and Exact URLs
 */

import { FirefoxContainerColor, MatchResult, TabColorRule, UnmatchedActiveTabStyle } from '../types/extension';

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

/**
 * Calculates relative luminance according to WCAG 2.1 specs.
 */
export function getRelativeLuminance(hex: string): number {
  if (!hex) return 0.5;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length < 6) return 0.5;

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculates the WCAG contrast ratio (1:1 to 21:1) between foreground and background.
 */
export function getContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = getRelativeLuminance(fgHex);
  const l2 = getRelativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Evaluates WCAG rating and recommendations.
 */
export function getWcagRating(fgHex: string, bgHex: string): {
  ratio: number;
  ratioStr: string;
  level: 'AAA' | 'AA' | 'Fail';
  label: string;
  isGood: boolean;
} {
  const ratio = getContrastRatio(fgHex, bgHex);
  const ratioStr = ratio.toFixed(1) + ':1';
  if (ratio >= 7.0) {
    return { ratio, ratioStr, level: 'AAA', label: 'Hervorragend (AAA)', isGood: true };
  } else if (ratio >= 4.5) {
    return { ratio, ratioStr, level: 'AA', label: 'Gut lesbar (AA)', isGood: true };
  } else if (ratio >= 3.0) {
    return { ratio, ratioStr, level: 'AA', label: 'Ausreichend (Großtext)', isGood: true };
  } else {
    return { ratio, ratioStr, level: 'Fail', label: 'Zu wenig Kontrast (Schwer lesbar)', isGood: false };
  }
}

/**
 * Suggests an optimal high-contrast text color for a given background (#fbfbfe or #15141a).
 */
export function getOptimalTextColor(bgHex: string): string {
  const lum = getRelativeLuminance(bgHex);
  return lum > 0.4 ? '#15141a' : '#fbfbfe';
}

/**
 * Parses a hex color into { r, g, b } components (0-255).
 */
export function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  if (!hex) return { r: 43, g: 42, b: 51 };
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length < 6) return { r: 43, g: 42, b: 51 };
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0,
  };
}

/**
 * Blends foreground hex with background hex at alpha (0..1) and returns resulting #rrggbb hex.
 */
export function blendHexColors(fgHex: string, bgHex: string, alpha: number): string {
  const fg = parseHexRgb(fgHex);
  const bg = parseHexRgb(bgHex);
  const a = Math.max(0, Math.min(1, alpha));
  const r = Math.round(fg.r * a + bg.r * (1 - a));
  const g = Math.round(fg.g * a + bg.g * (1 - a));
  const b = Math.round(fg.b * a + bg.b * (1 - a));
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Shifts the brightness of a hex color away from the frame background so an active tab stands out clearly.
 */
export function shiftHexForTabLift(frameHex: string, toolbarHex: string): string {
  const frameLum = getRelativeLuminance(frameHex);
  const ratio = getContrastRatio(toolbarHex, frameHex);
  // If toolbar already has a clear contrast ratio >= 1.28 against frame, use a slight boost of toolbar
  if (ratio >= 1.28) {
    return frameLum < 0.35
      ? blendHexColors('#ffffff', toolbarHex, 0.08)
      : blendHexColors('#000000', toolbarHex, 0.07);
  }
  // Otherwise, lift significantly from frame so the active tab is unmistakably distinct from inactive tabs
  return frameLum < 0.35
    ? blendHexColors('#ffffff', toolbarHex, 0.16)
    : blendHexColors('#000000', toolbarHex, 0.12);
}

export interface UnmatchedActiveTabEvaluation {
  styleMode: UnmatchedActiveTabStyle;
  tabBgCss: string;
  tabBgHex: string;
  tabLineCss: string;
  tabLineHex: string | null;
  hasVisibleTopLine: boolean;
  frameContrastRatio: number;
  frameContrastStr: string;
  lineContrastRatio: number;
  textContrast: {
    ratio: number;
    ratioStr: string;
    level: 'AAA' | 'AA' | 'Fail';
    label: string;
    isGood: boolean;
  };
  distinctionLevel: 'clear' | 'moderate' | 'poor';
  distinctionLabel: string;
  distinctionHint: string;
  canDistinguish: boolean;
}

/**
 * Computes the exact appearance and visual distinction metrics for an Active Tab WITHOUT a rule
 * against the current Theme (frame / toolbar / text).
 */
export function getUnmatchedActiveTabAppearance(params: {
  frameHex: string;
  toolbarHex: string;
  textHex: string;
  defaultColor?: string;
  activeTabOpacity?: number;
  unmatchedActiveTabStyle?: UnmatchedActiveTabStyle;
  unmatchedActiveTabBg?: string;
  unmatchedActiveTabLine?: string;
  enableUnmatchedTabLine?: boolean;
}): UnmatchedActiveTabEvaluation {
  const frameHex = params.frameHex || '#1c1b22';
  const toolbarHex = params.toolbarHex || '#2b2a33';
  const textHex = params.textHex || '#fbfbfe';
  const defaultColor = params.defaultColor || '#37adff';
  const opacity = params.activeTabOpacity ?? 0.35;
  const styleMode: UnmatchedActiveTabStyle = params.unmatchedActiveTabStyle || 'subtle_lift';
  const showLine = params.enableUnmatchedTabLine !== false;

  let tabBgCss = toolbarHex;
  let tabBgHex = toolbarHex;
  let tabLineHex: string | null = null;

  if (styleMode === 'subtle_lift') {
    tabBgHex = shiftHexForTabLift(frameHex, toolbarHex);
    tabBgCss = tabBgHex;
    if (showLine) {
      tabLineHex = params.unmatchedActiveTabLine || blendHexColors(textHex, toolbarHex, 0.55);
    }
  } else if (styleMode === 'default_accent') {
    tabBgHex = blendHexColors(defaultColor, frameHex, opacity);
    tabBgCss = hexToRgba(defaultColor, opacity);
    if (showLine) {
      tabLineHex = defaultColor;
    }
  } else if (styleMode === 'custom_color') {
    const customBg = params.unmatchedActiveTabBg || shiftHexForTabLift(frameHex, toolbarHex);
    tabBgHex = customBg;
    tabBgCss = customBg;
    if (showLine) {
      tabLineHex = params.unmatchedActiveTabLine || defaultColor;
    }
  } else {
    // 'toolbar_only'
    tabBgHex = toolbarHex;
    tabBgCss = toolbarHex;
    tabLineHex = null;
  }

  const tabLineCss = tabLineHex ? `3px solid ${tabLineHex}` : '3px solid transparent';
  const frameContrastRatio = getContrastRatio(tabBgHex, frameHex);
  const frameContrastStr = frameContrastRatio.toFixed(2) + ':1';
  const lineContrastRatio = tabLineHex ? getContrastRatio(tabLineHex, frameHex) : 1.0;
  const hasVisibleTopLine = !!tabLineHex && lineContrastRatio >= 1.35;
  const textContrast = getWcagRating(textHex, tabBgHex);

  let distinctionLevel: 'clear' | 'moderate' | 'poor' = 'clear';
  let distinctionLabel = 'Klar unterscheidbar';
  let distinctionHint = 'Der aktive Tab ohne Regel hebt sich durch Flächenkontrast und Fokus-Linie eindeutig von inaktiven Tabs ab.';
  let canDistinguish = true;

  if (frameContrastRatio >= 1.25 && hasVisibleTopLine) {
    distinctionLevel = 'clear';
    distinctionLabel = 'Sehr gut unterscheidbar (Fläche + Fokus-Linie)';
    distinctionHint = `Starker Kontrast (${frameContrastStr}) zum Rahmen plus sichtbare obere Fokus-Linie.`;
    canDistinguish = true;
  } else if (frameContrastRatio >= 1.30) {
    distinctionLevel = 'clear';
    distinctionLabel = 'Klar über Tab-Fläche unterscheidbar';
    distinctionHint = `Deutlicher Flächenkontrast (${frameContrastStr}) zwischen aktivem Tab und inaktiven Tabs.`;
    canDistinguish = true;
  } else if (hasVisibleTopLine && frameContrastRatio >= 1.08) {
    distinctionLevel = 'clear';
    distinctionLabel = 'Gut unterscheidbar (Fokus-Linie + Tönung)';
    distinctionHint = `Obere Fokus-Linie (${lineContrastRatio.toFixed(1)}:1) und Tab-Tönung (${frameContrastStr}) markieren den aktiven Tab klar.`;
    canDistinguish = true;
  } else if (hasVisibleTopLine || frameContrastRatio >= 1.15) {
    distinctionLevel = 'moderate';
    distinctionLabel = 'Mäßig unterscheidbar (Dezenter Kontrast)';
    distinctionHint = `Geringer Flächenkontrast (${frameContrastStr}) zum Rahmen. Tipp: Kontrast-Abhebung oder Fokus-Linie verstärken.`;
    canDistinguish = true;
  } else {
    distinctionLevel = 'poor';
    distinctionLabel = 'Kaum unterscheidbar! (Verschmilzt mit Rahmen)';
    distinctionHint = `Achtung: Aktiv-Tab (${tabBgHex}) und Rahmen (${frameHex}) haben fast identische Farben (${frameContrastStr}) und keine Fokus-Linie!`;
    canDistinguish = false;
  }

  return {
    styleMode,
    tabBgCss,
    tabBgHex,
    tabLineCss,
    tabLineHex,
    hasVisibleTopLine,
    frameContrastRatio,
    frameContrastStr,
    lineContrastRatio,
    textContrast,
    distinctionLevel,
    distinctionLabel,
    distinctionHint,
    canDistinguish,
  };
}



