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

export type BaseThemeMode = 'system' | 'dark' | 'light' | 'custom';

export type HybridWindowBehavior = 'static_window' | 'dynamic_toolbar';
export type HybridTabIndicatorStyle = 'accent_line_and_fill' | 'line_only' | 'glow_border';

export interface SavedTheme {
  id: string;
  name: string;
  description?: string;
  frame: string;
  toolbar: string;
  text: string;
  defaultColor?: string;
  defaultContainerColor?: FirefoxContainerColor;
  date?: string;
  hybridWindowBehavior?: HybridWindowBehavior;
  hybridTabIndicatorStyle?: HybridTabIndicatorStyle;
  activeTabOpacity?: number;
  isCustom?: boolean;
}

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
  tabOpacity?: number; // Optional opacity override (0.15 - 1.0)
  enableFaviconHalo?: boolean; // Subtle contrast halo for icons
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
  activeTabOpacity?: number; // Deckkraft des aktiven Tabs (0.15 bis 1.0, z. B. 0.35 für perfekten Favicon-Kontrast)
  enableFaviconContrastHalo?: boolean; // Schützt gleichfarbige Favicons vor dem Verschwimmen im Tab-Hintergrund
  baseThemeMode?: BaseThemeMode; // Basis-Farbschema für Hybrid/Theme-Modus & Menü-Layout (system, dark, light, custom)
  customBaseFrameColor?: string; // Optionale benutzerdefinierte Rahmenfarbe
  customBaseToolbarColor?: string; // Optionale benutzerdefinierte Toolbarfarbe
  customBaseTextColor?: string; // Optionale Textfarbe
  hybridWindowBehavior?: HybridWindowBehavior; // 'static_window' (Fenster bleibt fix, nur aktiver Tab akzentuiert) | 'dynamic_toolbar'
  hybridTabIndicatorStyle?: HybridTabIndicatorStyle; // 'accent_line_and_fill' | 'line_only' | 'glow_border'
  hybridIndicatorColor?: string; // Optionaler Farbindikator-Farbton (standardmäßig Regel-/Container-Farbe)
  savedThemes?: SavedTheme[]; // Gespeicherte benutzerdefinierte Theme-Profile
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
