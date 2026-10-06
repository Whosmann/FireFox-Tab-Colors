/**
 * TabChroma - Firefox URL Tab Color Extension Studio
 * Core Types & Schema
 */

export type UrlPatternType = 'wildcard' | 'domain' | 'exact_host' | 'prefix' | 'regex' | 'exact';

export type FirefoxContainerColor =
  | 'blue'
  | 'turquoise'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple';

export type FirefoxContainerIcon =
  | 'fingerprint'
  | 'briefcase'
  | 'dollar'
  | 'cart'
  | 'circle'
  | 'gift'
  | 'vacation'
  | 'food'
  | 'fruit'
  | 'pet'
  | 'tree'
  | 'chill';

export type ColorMode = 'container' | 'theme' | 'hybrid';

export interface TabColorRule {
  id: string;
  name: string;
  patternType: UrlPatternType;
  pattern: string;
  color: string; // Hex color e.g. #EF4444
  firefoxContainerColor: FirefoxContainerColor;
  firefoxContainerIcon: FirefoxContainerIcon;
  customEmoji?: string; // Custom symbol or emoji e.g. '⬇️' for import tabs, '⬆️', '📦'
  enableTitleEmoji?: boolean; // Prepends symbol to document.title so it appears on the tab
  enableFaviconEmoji?: boolean; // Badges the tab's favicon with this emoji
  containerName: string;
  colorMode: ColorMode;
  accentBorder: boolean;
  enabled: boolean;
  priority: number; // lower number = evaluated first
}

export interface ExtensionConfig {
  extensionName: string;
  extensionVersion: string;
  extensionDescription: string;
  geckoId?: string;
  defaultColor: string;
  defaultContainerColor: FirefoxContainerColor;
  defaultMode: ColorMode;
  rules: TabColorRule[];
  enablePageTopBar: boolean;
  enableFaviconBadge: boolean;
  enableActiveTabTheme: boolean;
  revertUnmatchedToDefault?: boolean;
}

export interface MatchResult {
  matched: boolean;
  rule?: TabColorRule;
  reason?: string;
  regexPattern?: string;
}

export interface TabSimulatorItem {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  matchedRuleId: string | null;
  isPinned?: boolean;
}

export interface GeneratedFile {
  name: string;
  path: string;
  content: string;
  language: 'json' | 'javascript' | 'html' | 'css' | 'markdown';
}
