/**
 * TabChroma - Firefox WebExtension Code & Package Generator
 * Builds complete Manifest V3 WebExtension source files and packages to .zip
 */

import JSZip from 'jszip';
import { ExtensionConfig, GeneratedFile, TabColorRule } from '../types/extension';
import { FIREFOX_CONTAINER_COLORS } from './urlMatcher';

/**
 * Creates SVG icon file content for the extension
 */
function createExtensionSvgIcon(primaryColor = '#ff4f5e'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <rect width="48" height="48" rx="10" fill="#1e1e2e"/>
  <rect x="6" y="8" width="16" height="10" rx="3" fill="${primaryColor}"/>
  <rect x="24" y="8" width="18" height="10" rx="3" fill="#37adff" opacity="0.8"/>
  <rect x="6" y="22" width="36" height="18" rx="4" fill="#2d2d3f"/>
  <circle cx="12" cy="31" r="3" fill="#51cf66"/>
  <line x1="20" y1="31" x2="36" y2="31" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}

/**
 * Generates all files required for a fully working Firefox Add-on
 */
export function generateExtensionFiles(config: ExtensionConfig): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // 1. manifest.json
  const manifest = {
    manifest_version: 3,
    name: config.extensionName || 'TabChroma - URL Tab Color',
    version: config.extensionVersion || '1.0.0',
    description: config.extensionDescription || 'Automatically colors Firefox tabs based on custom URL rules and Firefox Containers.',
    author: 'TabChroma Studio',
    browser_specific_settings: {
      gecko: {
        id: config.geckoId || 'tabchroma-tab-color@whosmann.de',
        strict_min_version: '109.0',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
    permissions: [
      'contextualIdentities',
      'cookies',
      'tabs',
      'webNavigation',
      'storage',
      'theme',
      'alarms',
    ],
    host_permissions: ['<all_urls>'],
    background: {
      scripts: ['background.js'],
    },
    action: {
      default_title: 'TabChroma - Tab Color',
      default_popup: 'popup.html',
      default_icon: 'icons/icon-48.svg',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_start',
      },
    ],
    icons: {
      '48': 'icons/icon-48.svg',
      '96': 'icons/icon-96.svg',
      '128': 'icons/icon-128.svg',
    },
  };

  files.push({
    name: 'manifest.json',
    path: 'manifest.json',
    content: JSON.stringify(manifest, null, 2),
    language: 'json',
  });

  // 2. background.js
  const backgroundJs = `/**
 * TabChroma - Firefox Tab Color Extension
 * Background Script
 */

const DEFAULT_CONFIG = ${JSON.stringify(config, null, 2)};

// In-memory runtime state
let currentRules = DEFAULT_CONFIG.rules;
let appConfig = DEFAULT_CONFIG;
const containerCache = new Map(); // name -> cookieStoreId
let isInitialized = false;
let initPromise = null;

const CONTAINER_COLOR_MAP = {
  blue: '#37adff',
  turquoise: '#00c79a',
  green: '#51cf66',
  yellow: '#ffcb00',
  orange: '#ff9400',
  red: '#ff4f5e',
  pink: '#ff4ba0',
  purple: '#9059ff',
};

// Ensures config and rules are fully loaded from storage before handling events
function ensureInitialized() {
  if (isInitialized) return Promise.resolve();
  if (!initPromise) {
    initPromise = initExtension()
      .then(() => {
        isInitialized = true;
      })
      .catch((err) => {
        console.warn('[TabChroma] Init error:', err);
        isInitialized = true;
      });
  }
  return initPromise;
}

// Initialize extension storage and load rules
async function initExtension() {
  try {
    const data = await browser.storage.local.get(['tabChromaConfig', 'extensionVersion']);
    const isNewVersion = !data.extensionVersion || data.extensionVersion !== DEFAULT_CONFIG.extensionVersion;

    if (data.tabChromaConfig) {
      // Merge stored config with defaults to ensure all fields exist
      appConfig = {
        ...DEFAULT_CONFIG,
        ...data.tabChromaConfig,
      };

      // Ensure standard settings are present
      if (!appConfig.defaultColor) appConfig.defaultColor = DEFAULT_CONFIG.defaultColor || '#37adff';
      if (!appConfig.defaultContainerColor) appConfig.defaultContainerColor = DEFAULT_CONFIG.defaultContainerColor || 'blue';
      if (!appConfig.defaultMode) appConfig.defaultMode = DEFAULT_CONFIG.defaultMode || 'container';
      if (appConfig.enableFaviconContrastHalo === undefined) appConfig.enableFaviconContrastHalo = DEFAULT_CONFIG.enableFaviconContrastHalo !== false;

      // If re-packaged or updated with new version, ensure new default rules and settings are merged
      if (isNewVersion) {
        const existingRuleKeys = new Set(
          (appConfig.rules || []).map((r) => ((r.patternType || 'domain') + '::' + (r.pattern || '')).toLowerCase())
        );
        (DEFAULT_CONFIG.rules || []).forEach((defRule) => {
          const key = ((defRule.patternType || 'domain') + '::' + (defRule.pattern || '')).toLowerCase();
          if (!existingRuleKeys.has(key)) {
            appConfig.rules.push(defRule);
          }
        });
        if (DEFAULT_CONFIG.defaultColor) appConfig.defaultColor = DEFAULT_CONFIG.defaultColor;
        if (DEFAULT_CONFIG.defaultContainerColor) appConfig.defaultContainerColor = DEFAULT_CONFIG.defaultContainerColor;
        if (DEFAULT_CONFIG.defaultMode) appConfig.defaultMode = DEFAULT_CONFIG.defaultMode;
        // Protect user's Firefox theme by disabling window theme overrides
        appConfig.enableActiveTabTheme = false;
        // Ensure rules default to container mode so window theme is never touched
        (appConfig.rules || []).forEach((r) => {
          if (!r.colorMode || r.colorMode === 'hybrid') {
            r.colorMode = 'container';
          }
        });
      }

      currentRules = appConfig.rules || [];
      await browser.storage.local.set({
        tabChromaConfig: appConfig,
        extensionVersion: DEFAULT_CONFIG.extensionVersion,
      });
    } else {
      appConfig = { ...DEFAULT_CONFIG };
      currentRules = appConfig.rules || [];
      await browser.storage.local.set({
        tabChromaConfig: DEFAULT_CONFIG,
        extensionVersion: DEFAULT_CONFIG.extensionVersion,
      });
    }
  } catch (err) {
    console.warn('[TabChroma] Using default embedded rules:', err);
  }
}

// Convert wildcard string (*.domain.com/*) to RegExp
function wildcardToRegExp(pattern) {
  const normalized = pattern.trim();
  const escaped = normalized.replace(/[.+^$\{}()|[\\]\\\\]/g, '\\\\$&');
  const regexStr = '^' + escaped.replace(/\\*/g, '.*').replace(/\\?/g, '.') + '$';
  return new RegExp(regexStr, 'i');
}

// Evaluates whether a URL matches a rule
function evaluateUrlMatch(url, rule) {
  if (!rule.enabled || !url) return false;
  const cleanUrl = url.trim();

  try {
    switch (rule.patternType) {
      case 'wildcard': {
        const regex = wildcardToRegExp(rule.pattern);
        if (regex.test(cleanUrl)) return true;
        const noProto = cleanUrl.replace(/^https?:\\/\\//i, '');
        return regex.test(noProto);
      }
      case 'domain': {
        const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl);
        const host = parsed.hostname.toLowerCase();
        const target = rule.pattern.toLowerCase().replace(/^(https?:\\/\\/)?(www\\.)?/, '').replace(/\\/.*$/, '');
        return host === target || host.endsWith('.' + target);
      }
      case 'exact_host': {
        const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl);
        const host = parsed.hostname.toLowerCase();
        const target = rule.pattern.toLowerCase().replace(/^(https?:\\/\\/)?(www\\.)?/, '').replace(/\\/.*$/, '');
        return host === target;
      }
      case 'prefix': {
        return cleanUrl.toLowerCase().startsWith(rule.pattern.toLowerCase());
      }
      case 'exact': {
        return cleanUrl.replace(/\\/+$/, '').toLowerCase() === rule.pattern.replace(/\\/+$/, '').toLowerCase();
      }
      case 'regex': {
        const re = new RegExp(rule.pattern, 'i');
        return re.test(cleanUrl);
      }
      default:
        return false;
    }
  } catch (e) {
    return false;
  }
}

// Find matching rule sorted by priority
function findMatchingRule(url) {
  const sorted = [...currentRules].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (evaluateUrlMatch(url, rule)) {
      return rule;
    }
  }
  return null;
}

// Ensure contextual identity (container) exists in Firefox
async function getOrCreateContainer(name, color, icon) {
  if (containerCache.has(name)) {
    return containerCache.get(name);
  }

  try {
    const existing = await browser.contextualIdentities.query({ name });
    if (existing.length > 0) {
      containerCache.set(name, existing[0]);
      return existing[0];
    }

    const created = await browser.contextualIdentities.create({
      name,
      color: color || 'blue',
      icon: icon || 'fingerprint',
    });
    containerCache.set(name, created);
    return created;
  } catch (err) {
    console.error('[TabChroma] Failed to manage container:', err);
    return null;
  }
}

// Helper to convert hex + opacity to rgba string
function hexToRgba(hex, alpha) {
  if (!hex) return 'rgba(55, 173, 255, ' + (alpha !== undefined ? alpha : 0.35) + ')';
  var clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(function(c) { return c + c; }).join('');
  }
  if (clean.length >= 6) {
    var r = parseInt(clean.substring(0, 2), 16) || 0;
    var g = parseInt(clean.substring(2, 4), 16) || 0;
    var b = parseInt(clean.substring(4, 6), 16) || 0;
    var a = (alpha !== undefined && alpha !== null) ? Math.max(0, Math.min(1, Number(alpha))) : 0.35;
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
  }
  return hex;
}

// Cache base themes per window to preserve user's original Firefox theme and never override frame/toolbar
const baseThemeCache = new Map(); // windowId -> base colors

function getBaseThemePalette() {
  const mode = appConfig.baseThemeMode || 'system';
  let isDark = true;
  if (mode === 'dark') {
    isDark = true;
  } else if (mode === 'light') {
    isDark = false;
  } else if (mode === 'system') {
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch (e) {
      isDark = true;
    }
  } else if (mode === 'custom') {
    return {
      frame: appConfig.customBaseFrameColor || '#1c1b22',
      frame_inactive: appConfig.customBaseFrameColor || '#2b2a33',
      toolbar: appConfig.customBaseToolbarColor || '#2b2a33',
      toolbar_text: appConfig.customBaseTextColor || '#fbfbfe',
      toolbar_field: appConfig.customBaseFrameColor || '#1c1b22',
      toolbar_field_text: appConfig.customBaseTextColor || '#fbfbfe',
      toolbar_field_border: 'rgba(255,255,255,0.2)',
      tab_background_text: appConfig.customBaseTextColor || '#fbfbfe',
      icons: appConfig.customBaseTextColor || '#fbfbfe',
      ntp_background: appConfig.customBaseToolbarColor || '#2b2a33',
      ntp_text: appConfig.customBaseTextColor || '#fbfbfe',
      popup: appConfig.customBaseToolbarColor || '#2b2a33',
      popup_text: appConfig.customBaseTextColor || '#fbfbfe'
    };
  }

  if (isDark) {
    return {
      frame: '#1c1b22',
      frame_inactive: '#2b2a33',
      toolbar: '#2b2a33',
      toolbar_text: '#fbfbfe',
      toolbar_field: '#1c1b22',
      toolbar_field_text: '#fbfbfe',
      toolbar_field_border: '#38383d',
      tab_background_text: '#fbfbfe',
      icons: '#fbfbfe',
      ntp_background: '#2b2a33',
      ntp_text: '#fbfbfe',
      popup: '#2b2a33',
      popup_text: '#fbfbfe'
    };
  } else {
    return {
      frame: '#f0f0f4',
      frame_inactive: '#f9f9fb',
      toolbar: '#ffffff',
      toolbar_text: '#15141a',
      toolbar_field: '#f0f0f4',
      toolbar_field_text: '#15141a',
      toolbar_field_border: '#cfcfd8',
      tab_background_text: '#15141a',
      icons: '#15141a',
      ntp_background: '#ffffff',
      ntp_text: '#15141a',
      popup: '#ffffff',
      popup_text: '#15141a'
    };
  }
}

// Clean up window cache on window close
if (browser.windows && browser.windows.onRemoved) {
  browser.windows.onRemoved.addListener((windowId) => {
    baseThemeCache.delete(windowId);
  });
}

// Apply dynamic theme color to active window only if explicitly requested
async function applyThemeForTab(windowId, rule) {
  // Ensure valid windowId
  if (!windowId || windowId === (browser.windows ? browser.windows.WINDOW_ID_NONE : -1)) {
    try {
      const win = await browser.windows.getCurrent();
      if (win && win.id) windowId = win.id;
    } catch (e) {}
  }

  // 1. Theme-Schutz: Wenn Fenstertheme-Überschreiben deaktiviert ist (Standard & Empfohlen),
  // bleibt das persönliche Firefox-Theme des Nutzers zu 100% erhalten.
  // Wir stellen sicher, dass etwaige frühere Theme-Änderungen zurückgesetzt werden und greifen NIEMALS ein.
  if (!appConfig.enableActiveTabTheme) {
    if (windowId) {
      try {
        await browser.theme.reset(windowId);
      } catch (e) {}
    }
    return;
  }

  if (!windowId) return;

  // 2. Nur ausführen, wenn die Regel explizit 'theme' oder 'hybrid' Modus verlangt.
  // Standard-Container-Regeln ('container') verändern das Fenstertheme niemals!
  const shouldApplyTheme = rule && rule.color && (rule.colorMode === 'theme' || rule.colorMode === 'hybrid');

  if (shouldApplyTheme) {
    const hex = rule.color;
    // Deckkraft des aktiven Tabs reduzieren, damit Favicons mit gleicher Farbe deutlich sichtbar bleiben
    const opacity = (typeof rule.tabOpacity === 'number')
      ? rule.tabOpacity
      : ((typeof appConfig.activeTabOpacity === 'number') ? appConfig.activeTabOpacity : 0.35);
    const tabSelectedColor = hexToRgba(hex, opacity);

    try {
      const baseColors = getBaseThemePalette();
      const isStaticWindow = (appConfig.hybridWindowBehavior || 'static_window') === 'static_window';
      const indStyle = appConfig.hybridTabIndicatorStyle || 'accent_line_and_fill';
      const indicatorColor = appConfig.hybridIndicatorColor || hex;

      let selectedTabColor = tabSelectedColor;
      if (isStaticWindow && indStyle === 'line_only') {
        // Fenster & aktiver Tab bleiben in einheitlicher Basisfarbe; nur 3px Proton-Linie hebt sich hervor
        selectedTabColor = baseColors.toolbar;
      }

      const colorsToApply = {
        ...baseColors,
        tab_selected: selectedTabColor,
        tab_line: indicatorColor,
        tab_loading: indicatorColor
      };

      if (!isStaticWindow) {
        colorsToApply.toolbar = hexToRgba(hex, 0.45);
      }

      await browser.theme.update(windowId, {
        colors: colorsToApply
      });
    } catch (e) {
      console.warn('[TabChroma] Theme update error:', e);
    }
  } else {
    // Unmatched Tab im Hybrid-Modus:
    // Wendet das stabile Basis-Farbschema ohne Tab-Akzent an,
    // um ein plötzliches Umschalten zwischen Weiß und Schwarz beim Tab-Wechsel zu verhindern!
    try {
      const baseColors = getBaseThemePalette();
      await browser.theme.update(windowId, {
        colors: {
          ...baseColors,
          tab_line: 'transparent'
        }
      });
    } catch (e) {
      try {
        await browser.theme.reset(windowId);
      } catch (err) {}
    }
  }
}

// Intercept top-level navigations to route URLs to colored containers
browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // Top-level tab frame only
  if (!details.url || details.url.startsWith('about:') || details.url.startsWith('moz-extension:')) return;

  await ensureInitialized();
  const rule = findMatchingRule(details.url);

  try {
    const tab = await browser.tabs.get(details.tabId);

    // If no rule matches, but the current tab is in a colored container:
    // Reopen in default container so it doesn't get stuck in the previous container
    if (!rule) {
      if (appConfig.revertUnmatchedToDefault !== false && tab.cookieStoreId && tab.cookieStoreId !== 'firefox-default') {
        await browser.tabs.create({
          url: details.url,
          cookieStoreId: 'firefox-default',
          index: tab.index,
          active: tab.active,
          windowId: tab.windowId,
        });
        await browser.tabs.remove(details.tabId);
      }
      return;
    }

    // If container routing is active for this rule
    if (rule.colorMode === 'container' || rule.colorMode === 'hybrid') {
      let baseName = (rule.containerName || rule.name || 'Container').trim();
      if (rule.customEmoji && !baseName.startsWith(rule.customEmoji)) {
        baseName = rule.customEmoji + ' ' + baseName;
      }
      const containerTitle = baseName;
      const container = await getOrCreateContainer(
        containerTitle,
        rule.firefoxContainerColor || 'blue',
        rule.firefoxContainerIcon || 'circle'
      );

      if (container && tab.cookieStoreId !== container.cookieStoreId) {
        // Tab not yet in target colored container: reopen in the designated container!
        await browser.tabs.create({
          url: details.url,
          cookieStoreId: container.cookieStoreId,
          index: tab.index,
          active: tab.active,
          windowId: tab.windowId,
        });
        await browser.tabs.remove(details.tabId);
      }
    }
  } catch (err) {
    console.warn('[TabChroma] Tab routing error:', err);
  }
});

// Resolves color rule for tab by URL, or falls back to container color if in a container
async function resolveRuleOrContainerColor(tab) {
  if (!tab) return null;
  const targetUrl = tab.url || tab.pendingUrl || '';
  if (targetUrl && !targetUrl.startsWith('about:') && !targetUrl.startsWith('moz-extension:')) {
    const rule = findMatchingRule(targetUrl);
    if (rule) return rule;
  }

  // Fallback: If tab is in a colored Firefox Container, inherit container's color!
  if (tab.cookieStoreId && tab.cookieStoreId !== 'firefox-default') {
    try {
      const identity = await browser.contextualIdentities.get(tab.cookieStoreId);
      if (identity && identity.color) {
        const hex = CONTAINER_COLOR_MAP[identity.color] || '#37adff';
        return {
          id: 'container-fallback-' + tab.cookieStoreId,
          name: identity.name || 'Container',
          color: hex,
          firefoxContainerColor: identity.color,
          firefoxContainerIcon: identity.icon || 'circle',
          enabled: true,
          colorMode: 'container',
        };
      }
    } catch (e) {}
  }

  return null;
}

// Synchronizes theme and visual cues for the specified tab
async function updateTabThemeAndVisuals(tab) {
  if (!tab) return;
  const ruleOrContainer = await resolveRuleOrContainerColor(tab);
  await applyThemeForTab(tab.windowId, ruleOrContainer);
  if (tab.id) {
    await notifyTabVisuals(tab.id, ruleOrContainer);
  }
}

// Notify content script of accent color & custom tab symbol
async function notifyTabVisuals(tabId, rule) {
  try {
    if (rule) {
      await browser.tabs.sendMessage(tabId, {
        action: 'UPDATE_ACCENT_COLOR',
        color: rule.color || appConfig.defaultColor || '#37adff',
        accentBorder: rule.accentBorder !== false,
        enableTopBar: appConfig.enablePageTopBar,
        customEmoji: rule.customEmoji,
        enableTitleEmoji: rule.enableTitleEmoji !== false,
        enableFaviconEmoji: rule.enableFaviconEmoji !== false,
        enableFaviconHalo: rule.enableFaviconHalo !== undefined ? rule.enableFaviconHalo : (appConfig.enableFaviconContrastHalo !== false),
      });
    } else {
      await browser.tabs.sendMessage(tabId, {
        action: 'CLEAR_ACCENT_COLOR',
        enableFaviconHalo: appConfig.enableFaviconContrastHalo !== false,
      });
    }
  } catch (err) {}
}

// Update window theme when switching active tab
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    await ensureInitialized();
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (!tab) return;
    await updateTabThemeAndVisuals(tab);
  } catch (err) {
    console.warn('[TabChroma] onActivated error:', err);
  }
});

// Listen for tab URL updates, navigation, or restored tabs (discarded / sleeping tabs waking up)
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    await ensureInitialized();
    if (changeInfo.url || (tab.active && (changeInfo.status === 'complete' || changeInfo.discarded === false))) {
      if (tab.active) {
        await updateTabThemeAndVisuals(tab);
      } else {
        const ruleOrContainer = await resolveRuleOrContainerColor(tab);
        await notifyTabVisuals(tabId, ruleOrContainer);
      }
    }
  } catch (err) {}
});

// Update theme when window focus changes (multi-window support or refocusing Firefox)
browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) return;
  try {
    await ensureInitialized();
    const activeTabs = await browser.tabs.query({ active: true, windowId });
    if (activeTabs && activeTabs[0]) {
      await updateTabThemeAndVisuals(activeTabs[0]);
    }
  } catch (err) {}
});

// Keep-alive heartbeat alarm for Manifest V3 background script to stay responsive
try {
  browser.alarms.create('tabChromaHeartbeat', { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'tabChromaHeartbeat') {
      await ensureInitialized();
    }
  });
} catch (e) {}

// Message listener for popup & options communication
browser.runtime.onMessage.addListener(async (message) => {
  await ensureInitialized();
  if (message.action === 'GET_CONFIG') {
    return appConfig;
  }
  if (message.action === 'SAVE_CONFIG') {
    appConfig = message.config;
    currentRules = appConfig.rules || [];
    containerCache.clear();
    await browser.storage.local.set({ tabChromaConfig: appConfig });
    return { success: true };
  }
  if (message.action === 'MATCH_URL') {
    const rule = findMatchingRule(message.url);
    return { matched: !!rule, rule, enableFaviconContrastHalo: appConfig.enableFaviconContrastHalo !== false };
  }
  return null;
});

// React immediately when user changes settings in options.html
browser.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes.tabChromaConfig) {
    appConfig = changes.tabChromaConfig.newValue || appConfig;
    currentRules = appConfig.rules || [];
    containerCache.clear();
    try {
      const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (activeTabs && activeTabs[0]) {
        await updateTabThemeAndVisuals(activeTabs[0]);
      }
    } catch (e) {}
  }
});

// Initialize on load
initExtension();
`;

  files.push({
    name: 'background.js',
    path: 'background.js',
    content: backgroundJs,
    language: 'javascript',
  });

  // 3. content.js
  const contentJs = `/**
 * TabChroma - Content Script
 * Injects subtle top color bar, title symbol badge, or custom colored favicon
 */

(function () {
  let indicatorEl = null;

  function renderTopBar(color) {
    if (!indicatorEl) {
      indicatorEl = document.createElement('div');
      indicatorEl.id = 'tabchroma-top-bar';
      indicatorEl.style.position = 'fixed';
      indicatorEl.style.top = '0';
      indicatorEl.style.left = '0';
      indicatorEl.style.width = '100%';
      indicatorEl.style.height = '3px';
      indicatorEl.style.zIndex = '2147483647';
      indicatorEl.style.pointerEvents = 'none';
      indicatorEl.style.transition = 'background-color 0.2s ease';
      document.documentElement.appendChild(indicatorEl);
    }
    indicatorEl.style.backgroundColor = color;
  }

  let titleObserver = null;
  let activeEmoji = null;
  let isUpdatingTitle = false;
  let titleIntervalId = null;

  function ensureTitlePrefix() {
    if (!activeEmoji || isUpdatingTitle) return;
    const current = document.title || '';
    if (!current.startsWith(activeEmoji)) {
      isUpdatingTitle = true;
      try {
        document.title = activeEmoji + ' ' + current;
      } catch (e) {}
      setTimeout(() => { isUpdatingTitle = false; }, 20);
    }
  }

  function updateTitleEmoji(emoji) {
    if (!emoji) return;
    activeEmoji = emoji;
    ensureTitlePrefix();

    // 1. Observe entire document head and title for DOM changes
    if (!titleObserver) {
      try {
        const root = document.head || document.documentElement;
        if (root) {
          titleObserver = new MutationObserver(() => {
            ensureTitlePrefix();
          });
          titleObserver.observe(root, { subtree: true, characterData: true, childList: true });
        }
      } catch (e) {}
    }

    // 2. Continuous guard for SPAs and in-page function clicks that overwrite document.title
    if (!titleIntervalId) {
      titleIntervalId = setInterval(ensureTitlePrefix, 300);
    }
  }

  // Intercept client-side SPA navigation & clicks
  window.addEventListener('popstate', () => { setTimeout(ensureTitlePrefix, 50); });
  window.addEventListener('hashchange', () => { setTimeout(ensureTitlePrefix, 50); });

  let originalFaviconLinks = [];
  let customFaviconElement = null;

  function injectCustomFavicon(dataUrl) {
    const targetParent = document.head || document.documentElement;
    if (!targetParent) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => injectCustomFavicon(dataUrl), { once: true });
      }
      return;
    }

    // Cache original favicon links before modifying
    if (originalFaviconLinks.length === 0) {
      const existing = document.querySelectorAll("link[rel*='icon']");
      existing.forEach((el) => {
        originalFaviconLinks.push({ rel: el.rel, href: el.href, type: el.type || '', sizes: el.getAttribute('sizes') || '' });
        el.remove();
      });
    } else {
      document.querySelectorAll("link[rel*='icon']:not(#tabchroma-custom-favicon)").forEach((el) => el.remove());
    }

    if (!customFaviconElement || !customFaviconElement.parentNode) {
      customFaviconElement = document.createElement('link');
      customFaviconElement.id = 'tabchroma-custom-favicon';
      customFaviconElement.rel = 'icon';
      customFaviconElement.type = 'image/png';
      targetParent.appendChild(customFaviconElement);
    }
    customFaviconElement.href = dataUrl;
  }

  function renderFaviconEmoji(emoji, color, withHalo) {
    if (!emoji) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Container background circle
      ctx.fillStyle = color || '#38bdf8';
      ctx.beginPath();
      ctx.arc(16, 16, 14, 0, Math.PI * 2);
      ctx.fill();

      // Halo-Kontur / Contrast border & shadow
      if (withHalo !== false) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.stroke();
      }

      // Draw custom symbol / emoji in the center
      ctx.font = '17px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (withHalo !== false) {
        ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowBlur = 4;
      }
      ctx.fillText(emoji, 16, 17);

      injectCustomFavicon(canvas.toDataURL('image/png'));
    } catch (e) {}
  }

  function applyFaviconHalo(withHalo) {
    if (!withHalo) {
      removeFaviconEmoji();
      return;
    }

    let existingLink = document.querySelector("link[rel*='icon']");
    let candidateSrc = existingLink ? existingLink.href : (window.location.origin ? (window.location.origin + '/favicon.ico') : null);
    if (!candidateSrc) return;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.filter = 'drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 2px rgba(0, 0, 0, 0.85))';
          ctx.drawImage(img, 2, 2, 28, 28);
          injectCustomFavicon(canvas.toDataURL('image/png'));
        } catch (e) {}
      };
      img.src = candidateSrc;
    } catch (e) {}
  }

  function removeFaviconEmoji() {
    try {
      if (customFaviconElement) {
        customFaviconElement.remove();
        customFaviconElement = null;
      }
      const targetParent = document.head || document.documentElement;
      if (targetParent && originalFaviconLinks.length > 0) {
        originalFaviconLinks.forEach((item) => {
          const link = document.createElement('link');
          link.rel = item.rel;
          link.href = item.href;
          if (item.type) link.type = item.type;
          if (item.sizes) link.setAttribute('sizes', item.sizes);
          targetParent.appendChild(link);
        });
        originalFaviconLinks = [];
      }
    } catch (e) {}
  }

  function removeTopBar() {
    if (indicatorEl) {
      indicatorEl.remove();
      indicatorEl = null;
    }
  }

  function removeTitleEmoji() {
    if (titleIntervalId) {
      clearInterval(titleIntervalId);
      titleIntervalId = null;
    }
    if (titleObserver) {
      titleObserver.disconnect();
      titleObserver = null;
    }
    if (activeEmoji) {
      if (document.title.startsWith(activeEmoji + ' ')) {
        document.title = document.title.substring((activeEmoji + ' ').length);
      } else if (document.title.startsWith(activeEmoji)) {
        document.title = document.title.substring(activeEmoji.length).trimStart();
      }
      activeEmoji = null;
    }
    const knownSymbols = [
      '⬇️', '⬇', '⬆️', '⬆', '📥', '📦', '🚀', '⚡', '🔒', '📁', '🛒', '🧪', '📊', '⚙️', '⚙',
      '🔴', '🔵', '🟢', '🟡', '💰'
    ];
    for (let i = 0; i < knownSymbols.length; i++) {
      const sym = knownSymbols[i];
      if (document.title.startsWith(sym + ' ')) {
        document.title = document.title.substring((sym + ' ').length);
        break;
      } else if (document.title.startsWith(sym)) {
        document.title = document.title.substring(sym.length).trimStart();
        break;
      }
    }
  }

  function applyRuleVisuals(rule, globalHalo) {
    if (!rule) {
      removeTopBar();
      removeTitleEmoji();
      removeFaviconEmoji();
      applyFaviconHalo(false);
      return;
    }
    if (rule.accentBorder) {
      renderTopBar(rule.color);
    } else {
      removeTopBar();
    }
    const withHalo = (rule.enableFaviconHalo !== undefined) ? rule.enableFaviconHalo : (globalHalo !== false);
    if (rule.customEmoji) {
      if (rule.enableTitleEmoji !== false) {
        updateTitleEmoji(rule.customEmoji);
      } else {
        removeTitleEmoji();
      }
      if (rule.enableFaviconEmoji !== false) {
        renderFaviconEmoji(rule.customEmoji, rule.color, withHalo);
      } else {
        removeFaviconEmoji();
        if (withHalo) applyFaviconHalo(true);
      }
    } else {
      removeTitleEmoji();
      removeFaviconEmoji();
      if (withHalo) applyFaviconHalo(true);
    }
  }

  // Request initial color matching from background
  try {
    browser.runtime.sendMessage({ action: 'MATCH_URL', url: window.location.href }).then((response) => {
      if (response && response.matched && response.rule) {
        applyRuleVisuals(response.rule, response.enableFaviconContrastHalo);
      }
    }).catch(() => {});
  } catch (e) {}

  // Listen for real-time accent updates
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'UPDATE_ACCENT_COLOR') {
      if (msg.accentBorder || msg.enableTopBar) {
        renderTopBar(msg.color);
      } else {
        removeTopBar();
      }
      const withHalo = msg.enableFaviconHalo !== false;
      if (msg.customEmoji) {
        if (msg.enableTitleEmoji !== false) {
          updateTitleEmoji(msg.customEmoji);
        } else {
          removeTitleEmoji();
        }
        if (msg.enableFaviconEmoji !== false) {
          renderFaviconEmoji(msg.customEmoji, msg.color, withHalo);
        } else {
          removeFaviconEmoji();
          if (withHalo) applyFaviconHalo(true);
        }
      } else {
        removeTitleEmoji();
        removeFaviconEmoji();
        if (withHalo) applyFaviconHalo(true);
      }
    } else if (msg.action === 'CLEAR_ACCENT_COLOR') {
      removeTopBar();
      removeTitleEmoji();
      removeFaviconEmoji();
      applyFaviconHalo(false);
    }
  });
})();
`;

  files.push({
    name: 'content.js',
    path: 'content.js',
    content: contentJs,
    language: 'javascript',
  });

  // 4. popup.html
  const popupHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/svg+xml" href="icons/icon-48.svg">
  <title>TabChroma</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    :root, body.theme-dark {
      --bg: #0f172a;
      --text: #f8fafc;
      --card-bg: #1e293b;
      --border: #334155;
      --muted: #94a3b8;
      --subtext: #64748b;
      --input-bg: #090e17;
      --btn-secondary-bg: #334155;
      --btn-secondary-text: #cbd5e1;
    }
    body.theme-light {
      --bg: #ffffff;
      --text: #0f172a;
      --card-bg: #f8fafc;
      --border: #e2e8f0;
      --muted: #475569;
      --subtext: #64748b;
      --input-bg: #ffffff;
      --btn-secondary-bg: #f1f5f9;
      --btn-secondary-text: #334155;
    }
    @media (prefers-color-scheme: light) {
      body.theme-system {
        --bg: #ffffff;
        --text: #0f172a;
        --card-bg: #f8fafc;
        --border: #e2e8f0;
        --muted: #475569;
        --subtext: #64748b;
        --input-bg: #ffffff;
        --btn-secondary-bg: #f1f5f9;
        --btn-secondary-text: #334155;
      }
    }
    body {
      width: 360px;
      background: var(--bg);
      color: var(--text);
      padding: 14px;
      font-size: 12px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .brand { font-size: 13px; font-weight: 700; color: #0284c7; display: flex; align-items: center; gap: 6px; }
    
    .status-card {
      background: var(--card-bg);
      border-radius: 8px;
      padding: 10px;
      border: 1px solid var(--border);
      border-left: 4px solid #64748b;
      margin-bottom: 10px;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .status-card.matched { border-left-color: var(--accent-color, #0284c7); }
    .status-header { display: flex; align-items: center; justify-content: space-between; }
    .rule-name { font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 5px; font-size: 12px; }
    .url-text { font-family: monospace; font-size: 10.5px; color: var(--muted); word-break: break-all; margin-top: 3px; }
    .btn-delete-rule { background: none; border: none; color: #ef4444; font-size: 11px; cursor: pointer; padding: 2px 4px; border-radius: 4px; }
    .btn-delete-rule:hover { background: rgba(239, 68, 68, 0.15); }

    .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--subtext); margin: 8px 0 4px 0; display: flex; align-items: center; justify-content: space-between; }
    
    /* Segmented Pattern Type Pills */
    .pattern-type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 6px; }
    .pattern-type-btn {
      padding: 5px 2px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--muted);
      font-size: 10.5px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: all 0.12s ease;
    }
    .pattern-type-btn.active {
      border-color: #0284c7;
      background: rgba(2, 132, 199, 0.15);
      color: #38bdf8;
    }

    .form-input {
      width: 100%;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--text);
      font-family: monospace;
      font-size: 11px;
      margin-bottom: 8px;
      outline: none;
    }
    .form-input:focus { border-color: #0284c7; }

    /* Emoji / Symbol Row */
    .symbol-row { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; overflow-x: auto; padding-bottom: 2px; }
    .symbol-btn {
      padding: 3px 6px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
      shrink: 0;
    }
    .symbol-btn.active { border-color: #f59e0b; background: rgba(245, 158, 11, 0.15); font-weight: bold; }

    /* Color Grid */
    .color-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-bottom: 10px; }
    .color-btn {
      height: 26px;
      border-radius: 6px;
      border: 2px solid transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #fff;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0,0,0,0.6);
      transition: all 0.1s;
    }
    .color-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
    .color-btn.selected { border-color: #ffffff; box-shadow: 0 0 0 2px #0284c7; }

    .actions { display: flex; gap: 6px; margin-top: 4px; }
    .btn { flex: 1; padding: 7px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer; text-align: center; border: none; }
    .btn-save { background: #0284c7; color: white; }
    .btn-save:hover { background: #0369a1; }
    .btn-secondary { background: var(--btn-secondary-bg); color: var(--btn-secondary-text); border: 1px solid var(--border); }
    .btn-secondary:hover { opacity: 0.9; }
  </style>
</head>
<body class="theme-system">
  <div class="header">
    <div class="brand">🎨 TabChroma</div>
    <span id="rule-count" style="color: var(--subtext); font-size: 10.5px;"></span>
  </div>

  <!-- Current Tab Status Card -->
  <div id="status-card" class="status-card">
    <div class="status-header">
      <div class="rule-name" id="status-title">Aktuelle URL wird geprüft...</div>
      <button id="btn-delete-rule" class="btn-delete-rule" style="display:none;" title="Diese Regel löschen">🗑️ Löschen</button>
    </div>
    <div class="url-text" id="status-url"></div>
    <div id="status-badge" style="font-size:10px; color:var(--muted); margin-top:4px; display:none;"></div>
  </div>

  <!-- 1. Muster-Typ (Pattern Type: Domain, Host, Prefix, Pattern) -->
  <div class="section-label">
    <span>1. Regel-Muster (Pattern-Typ)</span>
    <span id="pattern-type-desc" style="font-weight:400; text-transform:none; font-size:10px;"></span>
  </div>
  <div class="pattern-type-grid">
    <button type="button" class="pattern-type-btn active" data-type="domain" title="Matcht die gesamte Domain inkl. aller Subdomains und Pfade">Domain</button>
    <button type="button" class="pattern-type-btn" data-type="exact_host" title="Matcht nur exakt diesen Subdomain-Host">Exakter Host</button>
    <button type="button" class="pattern-type-btn" data-type="prefix" title="Matcht alle URLs beginnend mit diesem Pfad">Präfix</button>
    <button type="button" class="pattern-type-btn" data-type="wildcard" title="Freies Wildcard-Muster mit *">Pattern</button>
  </div>

  <!-- Editable Pattern Box -->
  <input type="text" id="pattern-input" class="form-input" placeholder="example.com" spellcheck="false">

  <!-- 2. Tab-Symbol (Optional) -->
  <div class="section-label">
    <span>2. Tab-Symbol / Emoji</span>
    <span style="font-weight:400; text-transform:none; font-size:10px; color:var(--muted);">(Optional)</span>
  </div>
  <div class="symbol-row">
    <button type="button" class="symbol-btn active" data-symbol="">Kein</button>
    <button type="button" class="symbol-btn" data-symbol="🚀">🚀 Prod</button>
    <button type="button" class="symbol-btn" data-symbol="⬇️">⬇️ Import</button>
    <button type="button" class="symbol-btn" data-symbol="📦">📦 Cloud</button>
    <button type="button" class="symbol-btn" data-symbol="⚡">⚡ Dev</button>
    <button type="button" class="symbol-btn" data-symbol="🧪">🧪 Test</button>
    <button type="button" class="symbol-btn" data-symbol="🔒">🔒 Auth</button>
    <button type="button" class="symbol-btn" data-symbol="💰">💰 Pay</button>
  </div>

  <!-- 3. Container-Farbe -->
  <div class="section-label">
    <span>3. Farbe wählen</span>
    <span id="selected-color-name" style="font-weight:600; text-transform:none; font-size:10.5px;">Blue</span>
  </div>
  <div class="color-grid">
    <button type="button" class="color-btn" style="background:#ff4f5e" data-color="red" data-hex="#ff4f5e">Red</button>
    <button type="button" class="color-btn" style="background:#ff9400" data-color="orange" data-hex="#ff9400">Orange</button>
    <button type="button" class="color-btn" style="background:#51cf66" data-color="green" data-hex="#51cf66">Green</button>
    <button type="button" class="color-btn selected" style="background:#37adff" data-color="blue" data-hex="#37adff">Blue</button>
    <button type="button" class="color-btn" style="background:#00c79a" data-color="turquoise" data-hex="#00c79a">Turq</button>
    <button type="button" class="color-btn" style="background:#9059ff" data-color="purple" data-hex="#9059ff">Purple</button>
    <button type="button" class="color-btn" style="background:#ff4ba0" data-color="pink" data-hex="#ff4ba0">Pink</button>
    <button type="button" class="color-btn" style="background:#ffcb00; color: #000" data-color="yellow" data-hex="#ffcb00">Yellow</button>
  </div>

  <!-- Actions -->
  <div class="actions">
    <button type="button" id="btn-save" class="btn btn-save">✓ Regel für Tab speichern</button>
    <button type="button" id="btn-options" class="btn btn-secondary">Studio</button>
  </div>

  <script src="popup.js"></script>
</body>
</html>`;

  files.push({
    name: 'popup.html',
    path: 'popup.html',
    content: popupHtml,
    language: 'html',
  });

  // 5. popup.js
  const popupJs = `/**
 * TabChroma - Popup Script
 * Allows choosing patternType (Domain, Exact Host, Prefix, Pattern), custom symbol, and color
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusTitle = document.getElementById('status-title');
  const statusUrl = document.getElementById('status-url');
  const statusBadge = document.getElementById('status-badge');
  const statusCard = document.getElementById('status-card');
  const btnDeleteRule = document.getElementById('btn-delete-rule');
  const btnSave = document.getElementById('btn-save');
  const btnOptions = document.getElementById('btn-options');
  const ruleCountEl = document.getElementById('rule-count');
  const patternInput = document.getElementById('pattern-input');
  const patternTypeDesc = document.getElementById('pattern-type-desc');
  const selectedColorNameEl = document.getElementById('selected-color-name');

  let currentTab = null;
  let currentConfig = null;
  let activeMatchedRule = null;
  
  // Selected state
  let selectedPatternType = 'domain';
  let selectedColor = 'blue';
  let selectedHex = '#37adff';
  let selectedSymbol = '';

  // Patterns calculated from active tab URL
  let candidateDomain = '';
  let candidateExactHost = '';
  let candidatePrefix = '';
  let candidateWildcard = '';

  const TYPE_DESCRIPTIONS = {
    domain: 'Matcht alle Subdomains & Pfade',
    exact_host: 'Nur diese exakte Subdomain',
    prefix: 'URL beginnt mit diesem Pfad',
    wildcard: 'Benutzerdefiniertes Wildcard-Pattern'
  };

  function updatePatternInputForType(type) {
    selectedPatternType = type;
    if (patternTypeDesc) patternTypeDesc.textContent = TYPE_DESCRIPTIONS[type] || '';
    if (!patternInput) return;

    if (type === 'domain') {
      patternInput.value = candidateDomain;
    } else if (type === 'exact_host') {
      patternInput.value = candidateExactHost;
    } else if (type === 'prefix') {
      patternInput.value = candidatePrefix;
    } else if (type === 'wildcard') {
      patternInput.value = candidateWildcard;
    }
  }

  try {
    currentConfig = await browser.runtime.sendMessage({ action: 'GET_CONFIG' });
    if (currentConfig) {
      const themeMode = currentConfig.baseThemeMode || 'system';
      document.body.className = 'theme-' + themeMode;
      if (themeMode === 'custom' && currentConfig.customBaseFrameColor) {
        document.body.style.setProperty('--bg', currentConfig.customBaseFrameColor);
        document.body.style.setProperty('--card-bg', currentConfig.customBaseToolbarColor || '#2b2a33');
        document.body.style.setProperty('--text', currentConfig.customBaseTextColor || '#fbfbfe');
      }
      if (currentConfig.rules && ruleCountEl) {
        ruleCountEl.textContent = currentConfig.rules.length + ' Regeln aktiv';
      }
      if (currentConfig.defaultColor) {
        selectedHex = currentConfig.defaultColor;
      }
      if (currentConfig.defaultContainerColor) {
        selectedColor = currentConfig.defaultContainerColor;
      }
    }

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];

    if (currentTab && currentTab.url) {
      statusUrl.textContent = currentTab.url;

      try {
        const urlObj = new URL(currentTab.url);
        candidateExactHost = urlObj.hostname;
        candidateDomain = urlObj.hostname.replace(/^(www\.)/i, '');
        candidatePrefix = urlObj.origin + urlObj.pathname;
        candidateWildcard = '*' + candidateDomain + '*';
      } catch (e) {
        candidateDomain = currentTab.url;
        candidateExactHost = currentTab.url;
        candidatePrefix = currentTab.url;
        candidateWildcard = '*' + currentTab.url + '*';
      }

      // Check if URL matches an existing rule
      const response = await browser.runtime.sendMessage({
        action: 'MATCH_URL',
        url: currentTab.url,
      });

      if (response && response.matched && response.rule) {
        activeMatchedRule = response.rule;
        statusTitle.textContent = '● ' + activeMatchedRule.name;
        statusCard.style.setProperty('--accent-color', activeMatchedRule.color);
        statusCard.classList.add('matched');
        if (btnDeleteRule) btnDeleteRule.style.display = 'block';

        if (statusBadge) {
          statusBadge.style.display = 'block';
          statusBadge.textContent = 'Muster: [' + activeMatchedRule.patternType + '] ' + activeMatchedRule.pattern;
        }

        // Prepopulate with existing rule settings
        selectedPatternType = activeMatchedRule.patternType || 'domain';
        selectedColor = activeMatchedRule.firefoxContainerColor || 'blue';
        selectedHex = activeMatchedRule.color || '#37adff';
        selectedSymbol = activeMatchedRule.customEmoji || '';
        patternInput.value = activeMatchedRule.pattern;
        btnSave.textContent = '✓ Regel aktualisieren';
      } else {
        statusTitle.textContent = 'Keine Regel für diesen Tab';
        statusCard.classList.remove('matched');
        if (btnDeleteRule) btnDeleteRule.style.display = 'none';
        updatePatternInputForType('domain');
      }

      // Sync active state on type buttons
      document.querySelectorAll('.pattern-type-btn').forEach((btn) => {
        if (btn.getAttribute('data-type') === selectedPatternType) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Sync active color button
      document.querySelectorAll('.color-btn').forEach((btn) => {
        if (btn.getAttribute('data-color') === selectedColor) {
          btn.classList.add('selected');
          if (selectedColorNameEl) selectedColorNameEl.textContent = btn.textContent;
        } else {
          btn.classList.remove('selected');
        }
      });

      // Sync symbol button
      document.querySelectorAll('.symbol-btn').forEach((btn) => {
        if (btn.getAttribute('data-symbol') === selectedSymbol) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  } catch (err) {
    statusTitle.textContent = 'Bereit';
  }

  // 1. Listen for Pattern Type switch
  document.querySelectorAll('.pattern-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pattern-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.getAttribute('data-type') || 'domain';
      updatePatternInputForType(type);
    });
  });

  // 2. Listen for Symbol switch
  document.querySelectorAll('.symbol-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.symbol-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSymbol = btn.getAttribute('data-symbol') || '';
    });
  });

  // 3. Listen for Color switch
  document.querySelectorAll('.color-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.getAttribute('data-color') || 'blue';
      selectedHex = btn.getAttribute('data-hex') || '#37adff';
      if (selectedColorNameEl) selectedColorNameEl.textContent = btn.textContent;
      statusCard.style.setProperty('--accent-color', selectedHex);
    });
  });

  // 4. Save Rule
  btnSave?.addEventListener('click', async () => {
    if (!currentTab || !currentTab.url) return;
    const finalPattern = patternInput.value.trim();
    if (!finalPattern) return;

    try {
      const config = await browser.runtime.sendMessage({ action: 'GET_CONFIG' }) || { rules: [] };
      let rules = config.rules || [];

      let ruleName = candidateDomain || finalPattern;
      if (selectedSymbol) {
        ruleName = selectedSymbol + ' ' + ruleName;
      }

      if (activeMatchedRule) {
        // Update existing rule
        rules = rules.map((r) => {
          if (r.id === activeMatchedRule.id) {
            return {
              ...r,
              name: ruleName,
              patternType: selectedPatternType,
              pattern: finalPattern,
              color: selectedHex,
              firefoxContainerColor: selectedColor,
              customEmoji: selectedSymbol,
              containerName: candidateDomain || 'Container',
            };
          }
          return r;
        });
      } else {
        // Create new rule
        const newRule = {
          id: 'rule-' + Date.now(),
          name: ruleName,
          patternType: selectedPatternType,
          pattern: finalPattern,
          color: selectedHex,
          firefoxContainerColor: selectedColor,
          firefoxContainerIcon: 'circle',
          customEmoji: selectedSymbol,
          enableTitleEmoji: true,
          enableFaviconEmoji: true,
          containerName: candidateDomain || 'Container',
          colorMode: config.defaultMode || 'container',
          accentBorder: true,
          enabled: true,
          priority: 1,
        };
        rules = [newRule, ...rules];
      }

      config.rules = rules;
      await browser.runtime.sendMessage({ action: 'SAVE_CONFIG', config });

      statusTitle.textContent = '● ' + ruleName;
      statusCard.style.setProperty('--accent-color', selectedHex);
      statusCard.classList.add('matched');
      if (statusBadge) {
        statusBadge.style.display = 'block';
        statusBadge.textContent = 'Muster: [' + selectedPatternType + '] ' + finalPattern;
      }
      if (btnDeleteRule) btnDeleteRule.style.display = 'block';
      btnSave.textContent = '✓ Gespeichert!';
      setTimeout(() => { btnSave.textContent = '✓ Regel aktualisieren'; }, 1500);
    } catch (err) {
      console.error('Failed to save rule from popup:', err);
    }
  });

  // 5. Delete active rule
  btnDeleteRule?.addEventListener('click', async () => {
    if (!activeMatchedRule) return;
    try {
      const config = await browser.runtime.sendMessage({ action: 'GET_CONFIG' });
      if (config && config.rules) {
        config.rules = config.rules.filter((r) => r.id !== activeMatchedRule.id);
        await browser.runtime.sendMessage({ action: 'SAVE_CONFIG', config });
      }
      activeMatchedRule = null;
      statusTitle.textContent = 'Regel gelöscht';
      statusCard.classList.remove('matched');
      statusCard.style.removeProperty('--accent-color');
      if (statusBadge) statusBadge.style.display = 'none';
      if (btnDeleteRule) btnDeleteRule.style.display = 'none';
      btnSave.textContent = '✓ Regel für Tab speichern';
      updatePatternInputForType('domain');
    } catch (err) {
      console.error('Failed to delete rule from popup:', err);
    }
  });

  // 6. Open Rules Studio
  btnOptions?.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
});
`;

  files.push({
    name: 'popup.js',
    path: 'popup.js',
    content: popupJs,
    language: 'javascript',
  });

  // 6. options.html
  const optionsHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/svg+xml" href="icons/icon-48.svg">
  <title>TabChroma - Firefox URL Tab Color & Container Studio</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    :root, body.theme-dark {
      --bg: #0b0f19;
      --text: #f8fafc;
      --card-bg: #111827;
      --card-border: #1f2937;
      --col-bg: #182234;
      --col-border: #283548;
      --muted: #94a3b8;
      --input-bg: #1e293b;
      --input-border: #374151;
      --btn-sec-bg: #1e293b;
      --btn-sec-text: #cbd5e1;
      --btn-sec-border: #334155;
    }
    body.theme-light {
      --bg: #f8fafc;
      --text: #0f172a;
      --card-bg: #ffffff;
      --card-border: #e2e8f0;
      --col-bg: #f1f5f9;
      --col-border: #cbd5e1;
      --muted: #64748b;
      --input-bg: #ffffff;
      --input-border: #cbd5e1;
      --btn-sec-bg: #f1f5f9;
      --btn-sec-text: #334155;
      --btn-sec-border: #cbd5e1;
    }
    body.theme-custom {
      background: var(--bg);
      color: var(--text);
    }
    @media (prefers-color-scheme: light) {
      body.theme-system {
        --bg: #f8fafc;
        --text: #0f172a;
        --card-bg: #ffffff;
        --card-border: #e2e8f0;
        --col-bg: #f1f5f9;
        --col-border: #cbd5e1;
        --muted: #64748b;
        --input-bg: #ffffff;
        --input-border: #cbd5e1;
        --btn-sec-bg: #f1f5f9;
        --btn-sec-text: #334155;
        --btn-sec-border: #cbd5e1;
      }
    }
    body { background: var(--bg); color: var(--text); padding: 24px; line-height: 1.5; font-size: 13px; transition: background 0.15s ease, color 0.15s ease; }
    .container { max-width: 1080px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--card-border); padding-bottom: 16px; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 20px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .desc { font-size: 13px; color: var(--muted); margin-top: 3px; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary { background: #0284c7; color: white; }
    .btn-secondary { background: var(--btn-sec-bg); color: var(--btn-sec-text); border: 1px solid var(--btn-sec-border); }
    .btn-danger { background: #ef4444; color: white; }
    .btn:hover { opacity: 0.9; }
    .actions-bar { display: flex; gap: 8px; flex-wrap: wrap; }
    
    /* Defaults Card matching Studio Preview */
    .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid var(--card-border); padding-bottom: 12px; }
    .card-title { font-size: 15px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
    .card-subtitle { font-size: 12px; color: var(--muted); margin-top: 3px; }
    .defaults-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .default-col { background: var(--col-bg); border: 1px solid var(--col-border); border-radius: 8px; padding: 14px; }
    .col-title { font-size: 12px; font-weight: 700; color: var(--text); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
    
    .color-swatch-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
    .swatch-btn { height: 28px; border-radius: 6px; border: 2px solid transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
    .swatch-btn.selected { border-color: #fff; box-shadow: 0 0 0 2px #38bdf8; }
    
    .mode-radio-box { border: 1px solid var(--col-border); border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.15s; background: var(--input-bg); }
    .mode-radio-box.selected { border-color: #38bdf8; background: rgba(56,189,248,0.15); }
    .mode-radio-title { font-weight: 700; font-size: 12px; color: var(--text); margin-bottom: 2px; }
    .mode-radio-desc { font-size: 11px; color: var(--muted); line-height: 1.3; }
    
    .check-label { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--text); cursor: pointer; margin-bottom: 10px; }
    .check-label input { margin-top: 2px; }
    .check-label strong { color: var(--text); display: block; }
    .check-label span { font-size: 11px; color: var(--muted); }

    .matcher-sample-chip { background: var(--input-bg); color: var(--muted); border: 1px solid var(--col-border); border-radius: 4px; padding: 2px 7px; font-size: 11px; font-family: monospace; cursor: pointer; transition: all 0.15s ease; }
    .matcher-sample-chip:hover { background: var(--btn-sec-bg); color: #38bdf8; border-color: #38bdf8; }
    
    .tip-banner { background: var(--col-bg); border: 1px solid var(--col-border); border-radius: 8px; padding: 10px 14px; font-size: 11px; color: var(--text); display: flex; align-items: center; gap: 8px; margin-top: 14px; }
    
    /* Table */
    table { width: 100%; border-collapse: collapse; background: var(--card-bg); border-radius: 8px; overflow: hidden; border: 1px solid var(--card-border); margin-top: 12px; }
    th { text-align: left; padding: 11px 13px; font-size: 11px; text-transform: uppercase; color: var(--muted); background: var(--col-bg); border-bottom: 1px solid var(--card-border); letter-spacing: 0.05em; }
    td { padding: 11px 13px; border-top: 1px solid var(--card-border); font-size: 12px; vertical-align: middle; color: var(--text); }
    .color-swatch { width: 15px; height: 15px; border-radius: 4px; display: inline-block; vertical-align: middle; margin-right: 6px; }
    .pattern-code { font-family: monospace; background: var(--input-bg); padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #38bdf8; word-break: break-all; border: 1px solid var(--col-border); }
    .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--input-bg); color: var(--text); font-family: monospace; border: 1px solid var(--col-border); }
    .badge-sym { font-size: 10px; padding: 1px 5px; border-radius: 3px; background: #0369a1; color: #e0f2fe; font-weight: 700; margin-left: 4px; }
    .btn-cell { display: flex; gap: 6px; align-items: center; justify-content: flex-end; }
    .edit-btn { background: #0284c7; color: white; padding: 4px 10px; border-radius: 5px; font-size: 11px; font-weight: 600; border: none; cursor: pointer; }
    .del-btn { background: #ef4444; color: white; padding: 4px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; border: none; cursor: pointer; }
    .priority-btn { background: var(--btn-sec-bg); color: var(--muted); border: 1px solid var(--btn-sec-border); border-radius: 4px; width: 22px; height: 22px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .priority-btn:hover { color: var(--text); background: var(--input-bg); }
    tr.selected-row { background: rgba(56, 189, 248, 0.12) !important; }
    .bulk-btn-group { display: inline-flex; border-radius: 6px; overflow: hidden; border: 1px solid var(--col-border); }
    .bulk-sub-btn { background: var(--btn-sec-bg); color: var(--btn-sec-text); border: none; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .bulk-sub-btn:hover { background: var(--input-bg); color: var(--text); }

    /* Modals */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 16px; backdrop-filter: blur(3px); }
    .modal-overlay.active { display: flex; }
    .modal { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 620px; max-height: 92vh; overflow-y: auto; padding: 22px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); color: var(--text); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--card-border); padding-bottom: 12px; margin-bottom: 16px; }
    .modal-title { font-size: 16px; font-weight: 700; color: var(--text); }
    .close-btn { background: transparent; border: none; color: var(--muted); font-size: 20px; cursor: pointer; line-height: 1; }
    .close-btn:hover { color: var(--text); }
    .form-group { margin-bottom: 13px; }
    .form-label { display: block; font-size: 11px; font-weight: 700; color: var(--text); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
    .form-input, .form-select, .form-textarea { width: 100%; padding: 8px 11px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; color: var(--text); font-size: 12px; outline: none; }
    .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #38bdf8; }
    .form-hint { font-size: 11px; color: var(--muted); margin-top: 3px; }
    .icon-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 5px; }
    .icon-btn { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; padding: 5px 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: var(--text); }
    .icon-btn.selected { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; color: #38bdf8; font-weight: 700; }
    .icon-sym { font-size: 15px; }
    .icon-lbl { font-size: 10px; margin-top: 2px; }

    /* Realistic Tab Preview in Modal */
    .preview-card { background: var(--col-bg); border: 1px solid var(--col-border); border-radius: 8px; padding: 12px; margin-top: 14px; }
    .preview-header { font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 8px; text-transform: uppercase; display: flex; justify-content: space-between; }
    .sim-tab-bar { background: var(--input-bg); padding: 6px 8px 0 8px; border-radius: 6px 6px 0 0; display: flex; align-items: flex-end; }
    .sim-tab { background: var(--card-bg); border-radius: 6px 6px 0 0; padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px; border-top: 3px solid #37adff; color: var(--text); font-size: 12px; font-weight: 600; box-shadow: 0 -2px 5px rgba(0,0,0,0.3); }
    .sim-favicon { width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .sim-title { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .sim-pill { background: rgba(55,173,255,0.2); border: 1px solid #37adff; color: #38bdf8; font-size: 10px; padding: 1px 6px; border-radius: 10px; margin-left: 8px; font-weight: 600; }
    
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--card-border); }
    
    /* Tabs inside Import Modal */
    .tab-nav { display: flex; gap: 4px; border-bottom: 1px solid var(--card-border); margin-bottom: 14px; }
    .tab-nav-btn { padding: 7px 14px; border: none; background: transparent; color: var(--muted); font-size: 12px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; }
    .tab-nav-btn.active { color: #38bdf8; border-bottom-color: #38bdf8; }
    .stats-card { background: var(--col-bg); border: 1px solid var(--col-border); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px; color: var(--text); }
    .conflict-box { background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 6px; padding: 10px; max-height: 140px; overflow-y: auto; font-size: 11px; margin-top: 8px; color: var(--text); }
    .conflict-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--card-border); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🎨 TabChroma - Firefox URL Tab Color Studio</h1>
        <div class="desc">Definiere Standard-Farben, URL-Regeln, Symbole und Multi-Account Container für Firefox Tabs.</div>
      </div>
      <div class="actions-bar">
        <button id="btn-quick-bulk" class="btn btn-secondary" title="Massenbearbeitungs-Dialog für ausgewählte Regeln öffnen">⚡ Massenbearbeitung</button>
        <button id="btn-import-modal-open" class="btn btn-secondary">📥 Import JSON (Distinct)</button>
        <button id="btn-export" class="btn btn-secondary">📤 Export JSON</button>
        <button id="btn-add-rule" class="btn btn-primary">+ Neue Regel erstellen</button>
      </div>
    </header>

    <!-- Standard-Einstellungen & Farbschema (Defaults) Card matching Studio Preview -->
    <div class="card" id="card-defaults">
      <div class="card-header">
        <div>
          <div class="card-title">⚙️ Standard-Einstellungen &amp; Farbschema (Defaults)</div>
          <div class="card-subtitle">Diese Werte werden als Vorlage für neue Regeln und beim JSON-Import als Default verwendet.</div>
        </div>
        <button id="btn-reset-defaults" class="btn btn-secondary" style="font-size:11px;" title="Setzt alle Dummy-Regeln auf Standard zurück">
          🔄 Dummy-Regeln zurücksetzen
        </button>
      </div>

      <div class="defaults-grid">
        <!-- 1. Standard-Container-Farbe -->
        <div class="default-col">
          <div class="col-title">1. Standard-Container-Farbe</div>
          <div class="color-swatch-grid" id="def-color-grid">
            <button type="button" class="swatch-btn" data-color="blue" data-hex="#37adff" style="background:#37adff;">Blue</button>
            <button type="button" class="swatch-btn" data-color="turquoise" data-hex="#00c79a" style="background:#00c79a;">Turquoise</button>
            <button type="button" class="swatch-btn" data-color="green" data-hex="#51cf66" style="background:#51cf66;">Green</button>
            <button type="button" class="swatch-btn" data-color="yellow" data-hex="#ffcb00" style="background:#ffcb00; color:#000;">Yellow</button>
            <button type="button" class="swatch-btn" data-color="orange" data-hex="#ff9400" style="background:#ff9400;">Orange</button>
            <button type="button" class="swatch-btn" data-color="red" data-hex="#ff4f5e" style="background:#ff4f5e;">Red</button>
            <button type="button" class="swatch-btn" data-color="pink" data-hex="#ff4ba0" style="background:#ff4ba0;">Pink</button>
            <button type="button" class="swatch-btn" data-color="purple" data-hex="#9059ff" style="background:#9059ff;">Purple</button>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; color:#94a3b8;">Hex-Farbe:</span>
            <input type="color" id="def-picker" style="width:26px; height:26px; border:none; border-radius:4px; cursor:pointer; background:transparent;">
            <input type="text" id="def-hex" class="form-input" style="width:85px; font-family:monospace; padding:4px 8px; font-size:11px;" value="#37adff">
          </div>
        </div>

        <!-- 2. Standard-Farbmodus -->
        <div class="default-col">
          <div class="col-title">2. Standard-Farbmodus</div>
          <div id="mode-opt-container" class="mode-radio-box selected">
            <div class="mode-radio-title">Nur Container (Empfohlen)</div>
            <div class="mode-radio-desc">Farbschema von Firefox bleibt vollständig unverändert. Nur Tab-Linie &amp; Container-Badge werden gefärbt.</div>
          </div>
          <div id="mode-opt-hybrid" class="mode-radio-box">
            <div class="mode-radio-title">Hybrid (Container + Theme)</div>
            <div class="mode-radio-desc">Färbt den Container und hebt den aktiven Tab mit separatem Farbindikator hervor.</div>
          </div>

          <div id="def-hybrid-options" style="margin-top: 8px; padding: 8px; background: rgba(147, 51, 234, 0.08); border-radius: 6px; border: 1px solid rgba(147, 51, 234, 0.2); font-size: 11px;">
            <div style="font-weight: 700; color: var(--text, #f8fafc); margin-bottom: 4px;">Hybrid-Fensterverhalten:</div>
            <label style="display:flex; align-items:center; gap:6px; margin-bottom:4px; cursor:pointer;">
              <input type="radio" name="opt-hybrid-win" id="opt-hybrid-win-static" value="static_window" checked>
              <span>Statisches Fenster + Aktiver Tab-Indikator</span>
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="radio" name="opt-hybrid-win" id="opt-hybrid-win-dynamic" value="dynamic_toolbar">
              <span>Dynamische Toolbar</span>
            </label>
            <div style="margin-top: 6px; font-weight: 700; color: var(--text, #f8fafc);">Tab-Indikator Stil:</div>
            <select id="def-hybrid-indicator-style" class="form-select" style="margin-top:2px; font-size:11px; padding:3px 6px;">
              <option value="accent_line_and_fill">Farblinie &amp; Tönung</option>
              <option value="line_only">Nur Farblinie (Minimal)</option>
              <option value="glow_border">Leucht-Kontur</option>
            </select>
          </div>
        </div>

        <!-- 3. Browser-Farbschema Schutz & Minimaler Eingriff -->
        <div class="default-col">
          <div class="col-title">3. Minimaler Eingriff & Theme-Schutz</div>
          <label class="check-label">
            <input type="checkbox" id="def-active-theme">
            <div>
              <strong>Firefox-Theme Schutz (Empfohlen: Aus)</strong>
              <span>Ausgeschaltet: Ihr persönliches Firefox-Theme bleibt immer 100% erhalten. Es werden ausschließlich Seiten-Overlays &amp; Icons gemäß Regeln angewendet.</span>
            </div>
          </label>
          <label class="check-label">
            <input type="checkbox" id="def-revert-unmatched" checked>
            <div>
              <strong>Nicht zugeordnete URLs im Standard-Container</strong>
              <span>Verhindert, dass fremde URLs im vorherigen Farb-Container verbleiben.</span>
            </div>
          </label>
          <label class="check-label">
            <input type="checkbox" id="def-enable-topbar" checked>
            <div>
              <strong>3px Seiten-Akzentleiste</strong>
              <span>Zeigt farbigen 3px Strich am oberen Rand passender Webseiten.</span>
            </div>
          </label>
        </div>

        <!-- 4. Basis-Farbschema für Hybrid & Menü -->
        <div class="default-col">
          <div class="col-title">4. Basis-Farbschema (Hybrid &amp; Menü)</div>
          <div style="font-size: 11px; color: var(--muted, #94a3b8); margin-bottom: 8px;">
            Verhindert harten Weiß-/Schwarz-Wechsel beim Tab-Wechsel und passt das Menü-Design an.
          </div>
          
          <label style="display:block; font-size:11px; font-weight:700; color:var(--text); margin-bottom:3px;">
            Farbschema-Modus:
          </label>
          <select id="def-base-theme" class="form-select" style="margin-bottom: 8px;">
            <option value="system">💻 Automatisch (System / Firefox)</option>
            <option value="dark">🌙 Dunkel (Firefox Dark #1c1b22)</option>
            <option value="light">☀️ Hell (Firefox Light #ffffff)</option>
            <option value="custom">🎨 Individuell (Eigene Farben &amp; Vorlagen)</option>
          </select>

          <!-- Theme-Vorlagen (Presets) Dropdown -->
          <div style="margin-top: 10px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label for="def-theme-preset" style="font-size: 11px; font-weight: 700; color: var(--text);">
                ✨ Theme-Vorlagen (Presets):
              </label>
              <span id="lbl-preset-badge" style="font-size: 10px; color: var(--muted); font-weight: 600;"></span>
            </div>
            <select id="def-theme-preset" class="form-select" style="margin-bottom: 8px;">
              <option value="">-- Theme-Vorlage auswählen --</option>
              <optgroup label="🎨 Beliebte Theme-Vorlagen">
                <option value="catppuccin-mocha">🌸 Catppuccin Mocha (Pastell / Slate)</option>
                <option value="nord-aurora">❄️ Nord Aurora (Polar Cyan &amp; Frost)</option>
                <option value="dracula-pro">🧛 Dracula Dark (Pink &amp; Violett)</option>
                <option value="tokyo-night">🌃 Tokyo Night (Neon &amp; Nachtblau)</option>
                <option value="oled-midnight">⬛ OLED Pure Black (Tiefschwarz #000000)</option>
                <option value="firefox-proton-dark">🦊 Firefox Dark Pure (#1c1b22)</option>
                <option value="clean-light">☀️ Firefox Light Pure (#ffffff)</option>
              </optgroup>
              <optgroup id="optgroup-saved-themes" label="💾 Gespeicherte Vorlagen">
              </optgroup>
            </select>
          </div>

          <div id="custom-theme-fields" style="display: none; gap: 8px; flex-direction: column; margin-top: 8px; padding: 10px; background: var(--card-bg, #0f172a); border-radius: 8px; border: 1px solid var(--col-border, #334155);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <div style="font-size: 11px; font-weight: 700; color: var(--text, #f8fafc);">Individuelle Basisfarben:</div>
              <button type="button" id="btn-save-as-preset" class="btn btn-secondary" style="font-size:10px; padding:2px 7px;" title="Aktuelle Farbkombination als eigene Vorlage speichern">
                💾 Als Vorlage speichern
              </button>
            </div>

            <!-- Schnellauswahl-Chips für Vorlagen -->
            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">
              <button type="button" class="btn-quick-theme" data-theme="catppuccin-mocha" style="font-size:10px; padding:3px 6px; border-radius:4px; border:1px solid var(--col-border); background:var(--input-bg); color:var(--text); cursor:pointer;">🌸 Catppuccin</button>
              <button type="button" class="btn-quick-theme" data-theme="nord-aurora" style="font-size:10px; padding:3px 6px; border-radius:4px; border:1px solid var(--col-border); background:var(--input-bg); color:var(--text); cursor:pointer;">❄️ Nord</button>
              <button type="button" class="btn-quick-theme" data-theme="dracula-pro" style="font-size:10px; padding:3px 6px; border-radius:4px; border:1px solid var(--col-border); background:var(--input-bg); color:var(--text); cursor:pointer;">🧛 Dracula</button>
              <button type="button" class="btn-quick-theme" data-theme="tokyo-night" style="font-size:10px; padding:3px 6px; border-radius:4px; border:1px solid var(--col-border); background:var(--input-bg); color:var(--text); cursor:pointer;">🌃 Tokyo</button>
              <button type="button" class="btn-quick-theme" data-theme="oled-midnight" style="font-size:10px; padding:3px 6px; border-radius:4px; border:1px solid var(--col-border); background:var(--input-bg); color:var(--text); cursor:pointer;">⬛ OLED</button>
              <button type="button" class="btn-quick-theme" data-theme="firefox-proton-dark" style="font-size:10px; padding:3px 6px; border-radius:4px; border:1px solid var(--col-border); background:var(--input-bg); color:var(--text); cursor:pointer;">🦊 Dark</button>
              <button type="button" class="btn-quick-theme" data-theme="clean-light" style="font-size:10px; padding:3px 6px; border-radius:4px; border:1px solid var(--col-border); background:var(--input-bg); color:var(--text); cursor:pointer;">☀️ Hell</button>
            </div>

            <!-- Rahmen -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap: 8px; font-size:11px;">
              <span style="min-width: 55px; color: var(--muted, #94a3b8);">Rahmen:</span>
              <div style="display: flex; align-items: center; gap: 6px; flex: 1; justify-content: flex-end;">
                <input type="color" id="def-frame-picker" style="width:26px; height:26px; border:none; cursor:pointer; background:none; border-radius:4px;" value="#1c1b22">
                <input type="text" id="def-frame-input" maxLength="7" style="width:70px; font-family:monospace; font-size:11px; padding:3px 6px; border-radius:4px; border:1px solid var(--input-border, #475569); background:var(--input-bg, #1e293b); color:var(--text, #f8fafc); text-transform:uppercase;" value="#1C1B22">
              </div>
            </div>
            <!-- Toolbar -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap: 8px; font-size:11px;">
              <span style="min-width: 55px; color: var(--muted, #94a3b8);">Toolbar:</span>
              <div style="display: flex; align-items: center; gap: 6px; flex: 1; justify-content: flex-end;">
                <input type="color" id="def-toolbar-picker" style="width:26px; height:26px; border:none; cursor:pointer; background:none; border-radius:4px;" value="#2b2a33">
                <input type="text" id="def-toolbar-input" maxLength="7" style="width:70px; font-family:monospace; font-size:11px; padding:3px 6px; border-radius:4px; border:1px solid var(--input-border, #475569); background:var(--input-bg, #1e293b); color:var(--text, #f8fafc); text-transform:uppercase;" value="#2B2A33">
              </div>
            </div>
            <!-- Text / Icons -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap: 8px; font-size:11px;">
              <span style="min-width: 55px; color: var(--muted, #94a3b8);">Schrift:</span>
              <div style="display: flex; align-items: center; gap: 6px; flex: 1; justify-content: flex-end;">
                <input type="color" id="def-text-picker" style="width:26px; height:26px; border:none; cursor:pointer; background:none; border-radius:4px;" value="#fbfbfe">
                <input type="text" id="def-text-input" maxLength="7" style="width:70px; font-family:monospace; font-size:11px; padding:3px 6px; border-radius:4px; border:1px solid var(--input-border, #475569); background:var(--input-bg, #1e293b); color:var(--text, #f8fafc); text-transform:uppercase;" value="#FBFBFE">
              </div>
            </div>

            <!-- Theme Export / Import Buttons für Kollegen -->
            <div style="display:flex; gap:6px; margin-top:8px; border-top: 1px solid var(--col-border, #334155); padding-top: 8px;">
              <button type="button" id="btn-export-theme" class="btn btn-secondary" style="font-size:10px; padding:4px 8px; flex:1;" title="Exportiert nur die Theme-Farben als JSON-Datei für Kollegen">
                📤 Theme exportieren
              </button>
              <button type="button" id="btn-import-theme" class="btn btn-secondary" style="font-size:10px; padding:4px 8px; flex:1;" title="Importiert ein Theme von einem Kollegen">
                📥 Theme importieren
              </button>
              <input type="file" id="theme-file-addon-input" accept=".json,application/json" style="display:none;">
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Deckkraft des aktiven Tabs & Favicon-Kontrast -->
      <div style="margin-top: 14px; padding: 14px 16px; background: var(--col-bg, #182234); border: 1px solid var(--col-border, #283548); border-radius: 8px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: var(--text, #f8fafc); display: flex; align-items: center; gap: 6px;">
              <span>🔍 Deckkraft des aktiven Tabs &amp; Favicon-Erkennbarkeit</span>
              <span id="lbl-opacity-val" style="background:#0369a1; color:#e0f2fe; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700;">35% Deckkraft</span>
            </div>
            <div style="font-size: 11px; color: var(--muted, #94a3b8); margin-top: 3px;">
              Reduziert die Deckkraft des aktiven Tabs, damit Favicons mit gleicher Farbe wie der Tab (z. B. rotes Symbol auf rotem Tab) sichtbar bleiben.
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary op-preset-btn" data-val="0.25" style="font-size:11px; padding:3px 8px;">25% Dezent</button>
            <button type="button" class="btn btn-secondary op-preset-btn" data-val="0.35" style="font-size:11px; padding:3px 8px;">35% Empfohlen</button>
            <button type="button" class="btn btn-secondary op-preset-btn" data-val="0.50" style="font-size:11px; padding:3px 8px;">50% Ausgewogen</button>
            <button type="button" class="btn btn-secondary op-preset-btn" data-val="0.75" style="font-size:11px; padding:3px 8px;">75% Kräftig</button>
            <button type="button" class="btn btn-secondary op-preset-btn" data-val="1.00" style="font-size:11px; padding:3px 8px;">100% Vollflächig</button>
          </div>
        </div>

        <!-- Slider row -->
        <div style="margin: 10px 0 14px 0;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted, #94a3b8); margin-bottom: 4px;">
            <span>Transparenter / Höchster Kontrast (15%)</span>
            <span>Vollflächig (100%)</span>
          </div>
          <input type="range" id="def-opacity" min="0.15" max="1.0" step="0.05" value="0.35" style="width: 100%; cursor: pointer;">
        </div>

        <!-- Halo-Kontur Schalter -->
        <div style="padding-top: 10px; border-top: 1px solid var(--col-border, #283548); margin-bottom: 14px;">
          <label class="check-label" style="margin-bottom: 0; cursor: pointer;">
            <input type="checkbox" id="def-favicon-halo" checked>
            <div>
              <strong style="color: var(--text, #f8fafc); display: flex; align-items: center; gap: 6px;">
                <span>✨ Automatischer Favicon-Kontrast-Schutz (Halo-Kontur)</span>
                <span id="badge-halo-status" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 9px; padding: 1px 6px; border-radius: 4px; font-weight: 600;">Aktiv</span>
              </strong>
              <span style="color: var(--muted, #94a3b8); font-size: 11px; line-height: 1.4; display: block; margin-top: 2px;">
                Legt einen subtilen Licht-/Schatten-Schutzrand um Website-Favicons, damit Konturen auch bei identischer Farbe wie der Tab messerscharf bleiben.
              </span>
            </div>
          </label>
        </div>

        <!-- Live-Vorschau der Deckkraft (Echtzeit-Vergleich) -->
        <div style="background: var(--input-bg, #0b1120); border: 1px solid var(--card-border, #1e293b); border-radius: 8px; padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--col-border, rgba(255,255,255,0.08)); padding-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text, #f8fafc); display: flex; align-items: center; gap: 6px;">
              <span>👁️ Live-Vorschau der Deckkraft (Echtzeit-Vergleich)</span>
            </span>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                <span style="color: var(--muted, #94a3b8);">Farbe:</span>
                <div style="display: flex; align-items: center; gap: 4px;" id="opacity-test-color-group">
                  <button type="button" class="test-color-btn" data-color="#ff4f5e" title="Rot" style="width: 18px; height: 18px; border-radius: 50%; background: #ff4f5e; border: 2px solid #fff; cursor: pointer; transition: transform 0.1s; transform: scale(1.15);"></button>
                  <button type="button" class="test-color-btn" data-color="#37adff" title="Blau" style="width: 18px; height: 18px; border-radius: 50%; background: #37adff; border: 1px solid rgba(0,0,0,0.4); opacity: 0.65; cursor: pointer; transition: transform 0.1s;"></button>
                  <button type="button" class="test-color-btn" data-color="#51cf66" title="Grün" style="width: 18px; height: 18px; border-radius: 50%; background: #51cf66; border: 1px solid rgba(0,0,0,0.4); opacity: 0.65; cursor: pointer; transition: transform 0.1s;"></button>
                  <button type="button" class="test-color-btn" data-color="#ff9400" title="Orange" style="width: 18px; height: 18px; border-radius: 50%; background: #ff9400; border: 1px solid rgba(0,0,0,0.4); opacity: 0.65; cursor: pointer; transition: transform 0.1s;"></button>
                  <button type="button" class="test-color-btn" data-color="#a855f7" title="Lila" style="width: 18px; height: 18px; border-radius: 50%; background: #a855f7; border: 1px solid rgba(0,0,0,0.4); opacity: 0.65; cursor: pointer; transition: transform 0.1s;"></button>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 4px; font-size: 11px;" id="opacity-test-icon-group">
                <span style="color: var(--muted, #94a3b8);">Icon:</span>
                <button type="button" class="test-icon-btn" data-icon="🔴" style="font-size: 12px; padding: 1px 4px; border-radius: 4px; border: 1px solid #0284c7; background: rgba(2, 132, 199, 0.25); cursor: pointer;">🔴</button>
                <button type="button" class="test-icon-btn" data-icon="🌐" style="font-size: 12px; padding: 1px 4px; border-radius: 4px; border: 1px solid transparent; background: transparent; cursor: pointer;">🌐</button>
                <button type="button" class="test-icon-btn" data-icon="⚡" style="font-size: 12px; padding: 1px 4px; border-radius: 4px; border: 1px solid transparent; background: transparent; cursor: pointer;">⚡</button>
                <button type="button" class="test-icon-btn" data-icon="🦊" style="font-size: 12px; padding: 1px 4px; border-radius: 4px; border: 1px solid transparent; background: transparent; cursor: pointer;">🦊</button>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: flex-start; gap: 14px; flex-wrap: wrap;">
            <!-- Bad Example: 100% Solid (Verschwimmt) -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
              <div id="preview-tab-solid" style="width: 130px; height: 38px; border-radius: 6px 6px 0 0; border-top: 2px solid #ff4f5e; background: #ff4f5e; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.4); transition: background 0.15s ease, border-color 0.15s ease;">
                <span id="preview-tab-solid-icon" style="font-size: 14px;">🔴</span>
                <span style="font-size: 11px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">YouTube</span>
              </div>
              <span style="font-size: 10px; color: #f43f5e; font-weight: 700;">100% (Verschwimmt)</span>
            </div>

            <div style="font-size: 18px; font-weight: 700; color: var(--muted, #64748b);">➔</div>

            <!-- Good Example: Selected Opacity with Halo (Klar erkennbar) -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
              <div id="preview-tab-opacity" style="width: 140px; height: 38px; border-radius: 6px 6px 0 0; border-top: 2px solid #ff4f5e; background: rgba(255, 79, 94, 0.35); display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.4); transition: background 0.15s ease, border-color 0.15s ease;">
                <span id="preview-tab-opacity-icon" style="font-size: 14px; filter: drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 2px rgba(0, 0, 0, 0.85));">🔴</span>
                <span style="font-size: 11px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">YouTube</span>
              </div>
              <span id="preview-tab-badge" style="font-size: 10px; color: #10b981; font-weight: 700;">35% (Klar erkennbar!)</span>
            </div>

            <div style="flex: 1; min-width: 200px; font-size: 11px; color: var(--muted, #94a3b8); border-left: 2px solid var(--col-border, #334155); padding-left: 12px; line-height: 1.45;">
              Das Logo und der Tab haben dieselbe Farbe (<code id="preview-test-color-code" style="color: #f8fafc; font-weight: 600;">#ff4f5e</code>). Dank reduzierter Deckkraft schimmert der Hintergrund sanft durch und das Symbol hebt sich zusammen mit der Halo-Kontur gestochen scharf ab!
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <button id="btn-save-defaults" class="btn btn-primary">💾 Standard-Einstellungen speichern</button>
        <span id="defaults-feedback" style="font-size:12px; color:#10b981; font-weight:700; display:none;">✓ Standard-Einstellungen live in Firefox gespeichert!</span>
      </div>

      <div class="tip-banner">
        <span>ℹ️</span>
        <span><strong>Tipp für JSON-Import &amp; neue Regeln:</strong> Beim Importieren von JSON werden Sie gefragt, ob das hier konfigurierte Standard-Farbschema auf alle importierten Regeln angewendet werden soll.</span>
      </div>
    </div>

    <!-- 5. Live URL Match Evaluator (Echtzeit-URL-Tester) -->
    <div class="card" id="card-url-matcher" style="margin-bottom: 20px; border-color: #0284c7; background: #0b1329;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <div>
          <div style="font-size:14px; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:8px;">
            <span>🔍 Live URL Match Evaluator &amp; Tester</span>
            <span style="font-size:10px; background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); padding:1px 6px; border-radius:4px;">Echtzeit</span>
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:3px;">
            Testen Sie beliebige URLs in Echtzeit, um sofort zu sehen, welche Farbregel mit welcher Priorität greift und welcher Container geöffnet wird.
          </div>
        </div>
        <button type="button" id="btn-matcher-current-tab" class="btn btn-secondary" style="font-size:11px; padding:5px 10px;" title="Übernimmt die URL des aktuell in Firefox geöffneten Tabs">
          🌐 Aktuelle Tab-URL testen
        </button>
      </div>

      <!-- Quick sample chips -->
      <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:10px; font-size:11px;">
        <span style="color:#64748b; font-size:11px;">Beispiel-URLs:</span>
        <button type="button" class="matcher-sample-chip" data-url="https://app.staging.example.com/api/v1/health">app.staging.example.com</button>
        <button type="button" class="matcher-sample-chip" data-url="https://248924.4.internal-cloud.net/app">internal-cloud.net</button>
        <button type="button" class="matcher-sample-chip" data-url="https://github.com/mozilla/gecko-dev">github.com</button>
        <button type="button" class="matcher-sample-chip" data-url="http://localhost:3000/dashboard">localhost:3000</button>
        <button type="button" class="matcher-sample-chip" data-url="https://api.prod.company.net/v2/orders">api.prod.company.net</button>
      </div>

      <!-- URL Input -->
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <input 
          type="text" 
          id="matcher-url-input" 
          class="form-input" 
          style="font-family:monospace; font-size:12px; background:#0f172a;" 
          placeholder="URL eingeben oder einfügen (z. B. https://staging.example.com oder localhost:8080)..."
          value="https://app.staging.example.com/api/v1/health"
        >
        <button type="button" id="btn-matcher-eval" class="btn btn-primary" style="padding:6px 14px; font-size:11px; white-space:nowrap;">Prüfen</button>
      </div>

      <!-- Result Container -->
      <div id="matcher-result-box" style="padding:12px; border-radius:8px; background:#111c35; border:1px solid #1e293b;">
        <!-- Dynamic Result rendered by options.js -->
      </div>
    </div>

    <!-- URL Rules Table & Search/Filter Header -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
      <h2 style="font-size:16px; font-weight:700; color:#f8fafc;" id="table-heading">Konfigurierte URL-Regeln</h2>
      <span id="rules-count-pill" style="font-size:11px; background:#1e293b; color:#38bdf8; padding:3px 8px; border-radius:12px; border:1px solid #334155;">0 Regeln</span>
    </div>

    <!-- Such- und Filterleiste für Regeln (nach Regelname, Container-Name oder Pattern) -->
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
      <div style="position: relative; flex: 1; min-width: 280px;">
        <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; color: #64748b; pointer-events: none;">🔍</span>
        <input 
          type="text" 
          id="rules-filter-input" 
          placeholder="Regeln filtern nach Name, Container oder URL-Pattern..." 
          style="width: 100%; padding: 7px 32px 7px 32px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; font-size: 12px; color: #f8fafc; outline: none;"
        >
        <button 
          type="button" 
          id="btn-rules-filter-clear" 
          style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px 6px;"
          title="Filter zurücksetzen"
        >✕</button>
      </div>
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <span id="filter-result-badge" style="font-size: 11px; color: #94a3b8; background: #1e293b; padding: 5px 10px; border-radius: 6px; border: 1px solid #334155; white-space: nowrap;">
          Alle Regeln angezeigt
        </span>

        <!-- Filter auf nur ausgewählte Regeln umschalten -->
        <button type="button" id="btn-filter-only-selected" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px; cursor: pointer; transition: all 0.15s;" title="Filtert die Tabelle, sodass nur die aktuell ausgewählten Regeln angezeigt werden">
          ⭐ Nur Ausgewählte anzeigen (<span id="only-selected-count">0</span>)
        </button>

        <!-- Treffer zur Auswahl hinzufügen (selektiv vergrößern) -->
        <button type="button" id="btn-add-filtered-to-selection" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px; display: none; background: #064e3b; border-color: #059669; color: #6ee7b7;" title="Fügt die aktuellen Suchtreffer zur bestehenden Auswahl hinzu (Auswahl schrittweise erweitern)">
          ➕ Zu Auswahl hinzufügen (<span id="add-filtered-count">0</span>)
        </button>

        <!-- Nur diese Treffer auswählen -->
        <button type="button" id="btn-select-filtered" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px; display: none; background: #0c4a6e; border-color: #0284c7; color: #38bdf8;" title="Wählt ausschließlich die aktuellen Treffer aus und deselektiert alle anderen">
          ☑️ Nur diese Treffer
        </button>
      </div>
    </div>

    <!-- Massenbearbeitung & Bulk Action Toolbar (Immer sichtbar & direkt erreichbar) -->
    <div class="card" id="card-bulk" style="margin-bottom: 16px; padding: 14px 16px; background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.4);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-size: 13px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
            <span>⚡ Massenbearbeitung (Bulk Edit) &amp; Aktionen</span>
            <span id="bulk-count-badge" style="background: #334155; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">0 Regeln ausgewählt</span>
          </span>
          <span id="bulk-stats-text" style="font-size: 11px; color: #94a3b8; border-left: 1px solid #334155; padding-left: 10px;">0 aktiv · 0 inaktiv</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button type="button" id="btn-bulk-restrict-to-filter" class="btn btn-secondary" style="font-size: 11px; padding: 5px 10px; display: none; background: #0c4a6e; border-color: #0284c7; color: #38bdf8;" title="Entfernt alle nicht sichtbaren Regeln aus der Auswahl und behält nur die Filter-Treffer">🎯 Nur Treffer auswählen</button>
          <button type="button" id="btn-bulk-filter-selected" class="btn btn-secondary" style="font-size: 11px; padding: 5px 10px; display: none; background: #854d0e; border-color: #ca8a04; color: #fef08a;" title="Tabelle so filtern, dass nur diese ausgewählten Regeln angezeigt werden">⭐ Auf Ausgewählte filtern</button>
          <button type="button" id="btn-bulk-select-all" class="btn btn-secondary" style="font-size: 11px; padding: 5px 10px;">☑️ Alle auswählen</button>
          <button type="button" id="btn-bulk-select-all-global" class="btn btn-secondary" style="font-size: 11px; padding: 5px 10px; display: none;" title="Wählt ausnahmslos alle Regeln in Firefox aus, auch jene außerhalb des aktuellen Suchfilters">🌐 Alle Regeln (global)</button>
          <button type="button" id="btn-bulk-clear" class="btn btn-secondary" style="font-size: 11px; padding: 5px 10px;">✕ Auswahl aufheben</button>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; position: relative;">
        <!-- Massenbearbeitung Dialog button -->
        <button type="button" id="btn-open-bulk-edit" class="btn btn-primary" style="font-size: 11px; padding: 6px 12px; background: #4f46e5; border-color: #6366f1;" title="Öffnet den Dialog für gemeinsame Massenbearbeitung mehrerer Regeln">
          ✏️ Massenbearbeitung...
        </button>

        <!-- Status Group -->
        <div class="bulk-btn-group">
          <button type="button" id="btn-bulk-enable" class="bulk-sub-btn" style="color: #34d399;" title="Alle ausgewählten Regeln aktivieren">✓ Aktivieren</button>
          <button type="button" id="btn-bulk-disable" class="bulk-sub-btn" style="color: #94a3b8;" title="Alle ausgewählten Regeln deaktivieren">✕ Deaktivieren</button>
          <button type="button" id="btn-bulk-toggle" class="bulk-sub-btn" style="color: #38bdf8;" title="Status aller ausgewählten Regeln umkehren">🔄 Umschalten</button>
        </div>

        <!-- Farb-Sync -->
        <div style="position: relative;">
          <button type="button" id="btn-bulk-colorsync-toggle" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px;" title="Farbe für ausgewählte Regeln synchronisieren">🎨 Farb-Sync ▼</button>
          <div id="bulk-color-popover" style="display: none; position: absolute; left: 0; top: 100%; margin-top: 6px; width: 280px; background: #111827; border: 1px solid #334155; border-radius: 8px; padding: 12px; z-index: 200; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
            <div style="font-size: 11px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">Container-Farbe synchronisieren:</div>
            <div id="bulk-swatch-list" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 8px;"></div>
            <div style="border-top: 1px solid #1f2937; padding-top: 8px; display: flex; gap: 6px; align-items: center;">
              <input type="color" id="bulk-color-input" value="#37adff" style="width: 28px; height: 28px; border: none; border-radius: 4px; cursor: pointer; background: transparent;">
              <input type="text" id="bulk-hex-input" value="#37adff" style="flex: 1; padding: 4px 8px; background: #1e293b; border: 1px solid #374151; border-radius: 4px; font-size: 11px; color: #fff; font-family: monospace;">
              <button type="button" id="btn-bulk-hex-apply" class="btn btn-primary" style="font-size: 10px; padding: 4px 8px;">OK</button>
            </div>
          </div>
        </div>

        <!-- Icon-Sync -->
        <div style="position: relative;">
          <button type="button" id="btn-bulk-iconsync-toggle" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px;" title="Container-Icon oder Tab-Symbol synchronisieren">✨ Icon-Sync ▼</button>
          <div id="bulk-icon-popover" style="display: none; position: absolute; left: 0; top: 100%; margin-top: 6px; width: 300px; background: #111827; border: 1px solid #334155; border-radius: 8px; padding: 12px; z-index: 200; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
            <div style="font-size: 11px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Container-Icon wählen:</div>
            <div id="bulk-icon-list" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 10px;"></div>
            <div style="border-top: 1px solid #1f2937; padding-top: 8px;">
              <div style="font-size: 11px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Tab-Symbol / Emoji wählen:</div>
              <div id="bulk-emoji-quick-list" style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;"></div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <input type="text" id="bulk-emoji-input" placeholder="z. B. 📦" maxlength="10" style="flex: 1; padding: 4px 8px; background: #1e293b; border: 1px solid #374151; border-radius: 4px; font-size: 11px; color: #fff;">
                <button type="button" id="btn-bulk-emoji-apply" class="btn btn-primary" style="font-size: 10px; padding: 4px 8px;">Setzen</button>
                <button type="button" id="btn-bulk-emoji-clear" class="btn btn-secondary" style="font-size: 10px; padding: 4px 8px; color: #f87171;">Löschen</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Export Selected -->
        <button type="button" id="btn-bulk-export" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px;" title="Nur ausgewählte Regeln als JSON exportieren">📤 Export (<span id="bulk-export-count">0</span>)</button>

        <!-- Löschen -->
        <button type="button" id="btn-bulk-delete" class="btn btn-danger" style="font-size: 11px; padding: 6px 10px;" title="Ausgewählte Regeln löschen">🗑️ Löschen (<span id="bulk-delete-count">0</span>)</button>
      </div>

      <div id="bulk-hint" style="font-size: 11px; color: #64748b; margin-top: 8px;">
        💡 Markieren Sie Regeln in der Tabelle über die Checkboxen links für gemeinsame Massenbearbeitung, Status-Änderungen oder Farb-Sync.
      </div>
    </div>

    <table id="rules-table">
      <thead>
        <tr>
          <th style="width: 36px; text-align: center;"><input type="checkbox" id="chk-all-rules" title="Alle Regeln auswählen oder abwählen"></th>
          <th style="width: 60px;">Priorität</th>
          <th>Farbe</th>
          <th>Regel-Name &amp; Symbol</th>
          <th>Match-Typ</th>
          <th>Pattern</th>
          <th>Container</th>
          <th>Status</th>
          <th style="text-align: right;">Aktionen</th>
        </tr>
      </thead>
      <tbody id="rules-body">
        <!-- Rendered by options.js -->
      </tbody>
    </table>
  </div>

  <!-- Rule Edit & Create Modal -->
  <div id="modal-overlay" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">Regel bearbeiten</h2>
        <button id="modal-close" class="close-btn">&times;</button>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-name">Regel-Name / Label</label>
        <input type="text" id="inp-name" class="form-input" placeholder="z. B. Production Service, Staging API">
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-type">Match-Typ</label>
        <select id="inp-type" class="form-select">
          <option value="domain">Domain (Gleicht Domain &amp; alle Subdomains ab)</option>
          <option value="exact_host">Exact Host (Nur exakt dieser Hostname, z. B. app.staging.internal.net)</option>
          <option value="wildcard">Wildcard (z. B. *.staging.com/*, localhost:*)</option>
          <option value="prefix">Prefix (z. B. https://prod.example.com/)</option>
          <option value="regex">RegEx (z. B. ^https?:\/\/(prod|live)\..*)</option>
          <option value="exact">Exakte URL (Volle Gleichheit)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-pattern">URL-Pattern</label>
        <input type="text" id="inp-pattern" class="form-input" style="font-family: monospace;" placeholder="z. B. github.com oder *.internal/*">
        <div id="pattern-hint" class="form-hint">Matches exact domain and any subdomains.</div>
      </div>

      <div class="form-group">
        <label class="form-label">Firefox Container-Farbe</label>
        <div class="color-swatch-grid" id="modal-color-grid">
          <button type="button" class="swatch-btn" data-color="blue" data-hex="#37adff" style="background:#37adff;">Blue</button>
          <button type="button" class="swatch-btn" data-color="turquoise" data-hex="#00c79a" style="background:#00c79a;">Turquoise</button>
          <button type="button" class="swatch-btn" data-color="green" data-hex="#51cf66" style="background:#51cf66;">Green</button>
          <button type="button" class="swatch-btn" data-color="yellow" data-hex="#ffcb00" style="background:#ffcb00; color:#000;">Yellow</button>
          <button type="button" class="swatch-btn" data-color="orange" data-hex="#ff9400" style="background:#ff9400;">Orange</button>
          <button type="button" class="swatch-btn" data-color="red" data-hex="#ff4f5e" style="background:#ff4f5e;">Red</button>
          <button type="button" class="swatch-btn" data-color="pink" data-hex="#ff4ba0" style="background:#ff4ba0;">Pink</button>
          <button type="button" class="swatch-btn" data-color="purple" data-hex="#9059ff" style="background:#9059ff;">Purple</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:11px; color:#94a3b8;">Custom Hex:</span>
          <input type="text" id="inp-hex" class="form-input" style="width:90px; font-family:monospace;" value="#ff4f5e">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-container-name">Container-Name</label>
        <input type="text" id="inp-container-name" class="form-input" placeholder="z. B. Production, Work">
      </div>

      <!-- Custom Tab Symbol / Emoji mit Favicon & Title Checkboxen -->
      <div class="form-group" style="background:#182234; border:1px solid #283548; padding:12px; border-radius:8px;">
        <label class="form-label" style="color:#38bdf8;">Tab-Symbol / Emoji Konfiguration</label>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
          <input type="text" id="inp-emoji" class="form-input" style="width:70px; text-align:center; font-size:16px;" placeholder="⬇️">
          <button type="button" id="btn-clear-emoji" class="btn btn-secondary" style="padding:4px 8px; font-size:11px; color:#f43f5e;" title="Symbol entfernen">✕ Symbol entfernen</button>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="⬇️" style="padding:4px 7px; font-size:11px;">⬇️ Import</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="⬆️" style="padding:4px 7px; font-size:11px;">⬆️ Export</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="📥" style="padding:4px 7px; font-size:11px;">📥 Inbox</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="📦" style="padding:4px 7px; font-size:11px;">📦 Paket</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="🚀" style="padding:4px 7px; font-size:11px;">🚀 Deploy</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="⚡" style="padding:4px 7px; font-size:11px;">⚡ Dev</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="🔒" style="padding:4px 7px; font-size:11px;">🔒 Auth</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="🛒" style="padding:4px 7px; font-size:11px;">🛒 Shop</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px; padding-top:8px; border-top:1px solid #283548;">
          <label class="check-label" style="margin-bottom:0;">
            <input type="checkbox" id="inp-enable-favicon-emoji" checked>
            <div>
              <strong>Symbol als Tab-Favicon darstellen (Icon als Favicon / Favicon-Badge)</strong>
              <span>Rendert das gewählte Symbol als dynamisches rundes Favicon-Badge in den Firefox Tab.</span>
            </div>
          </label>
          <label class="check-label" style="margin-bottom:0;">
            <input type="checkbox" id="inp-enable-title-emoji" checked>
            <div>
              <strong>Symbol im Tab-Titel voranstellen</strong>
              <span>Setzt das Symbol vor den Tab-Titel (z. B. 🚀 Dashboard).</span>
            </div>
          </label>
          <label class="check-label" style="margin-bottom:0;">
            <input type="checkbox" id="inp-enable-favicon-halo" checked>
            <div>
              <strong>✨ Favicon-Kontrast-Schutz (Halo-Kontur) für diese Regel</strong>
              <span>Subtiler Licht-/Schatten-Schutzrand um das Favicon, verhindert Verschwimmen bei gleicher Tab-Farbe.</span>
            </div>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Firefox Container-Icon</label>
        <input type="hidden" id="inp-icon" value="circle">
        <div class="icon-grid" id="modal-icon-grid">
          <button type="button" class="icon-btn" data-icon="circle"><span class="icon-sym">●</span><span class="icon-lbl">Circle</span></button>
          <button type="button" class="icon-btn" data-icon="briefcase"><span class="icon-sym">💼</span><span class="icon-lbl">Briefcase</span></button>
          <button type="button" class="icon-btn" data-icon="fingerprint"><span class="icon-sym">🔒</span><span class="icon-lbl">Security</span></button>
          <button type="button" class="icon-btn" data-icon="dollar"><span class="icon-sym">💰</span><span class="icon-lbl">Finance</span></button>
          <button type="button" class="icon-btn" data-icon="cart"><span class="icon-sym">🛒</span><span class="icon-lbl">Shopping</span></button>
          <button type="button" class="icon-btn" data-icon="tree"><span class="icon-sym">🌲</span><span class="icon-lbl">Tree</span></button>
          <button type="button" class="icon-btn" data-icon="chill"><span class="icon-sym">☕</span><span class="icon-lbl">Chill</span></button>
          <button type="button" class="icon-btn" data-icon="vacation"><span class="icon-sym">🏖️</span><span class="icon-lbl">Vacation</span></button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-mode">Farbmodus</label>
        <select id="inp-mode" class="form-select">
          <option value="container">Nur Container (Farbiger Tab-Strich &amp; Cookie-Isolation)</option>
          <option value="hybrid">Hybrid (Container Tab + Dynamisches Window Theme)</option>
          <option value="theme">Nur aktives Theme (Färbt Tab-Leiste)</option>
        </select>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px;">
        <label class="check-label" style="margin-bottom:0;">
          <input type="checkbox" id="inp-topbar" checked>
          <span>3px farbige Akzentleiste am Seitenrand anzeigen</span>
        </label>
        <label class="check-label" style="margin-bottom:0;">
          <input type="checkbox" id="inp-enabled" checked>
          <span>Regel aktivieren</span>
        </label>
      </div>

      <!-- Live Tab Preview -->
      <div class="preview-card">
        <div class="preview-header">
          <span>Vorschau: So wird der Tab in Firefox dargestellt</span>
          <span id="preview-mode-tag" style="color:#38bdf8;">Container</span>
        </div>
        <div class="sim-tab-bar">
          <div id="sim-tab-elem" class="sim-tab">
            <div id="sim-favicon-elem" class="sim-favicon">🌐</div>
            <span id="sim-title-elem" class="sim-title">Tab Vorschau</span>
            <span id="sim-pill-elem" class="sim-pill">Default</span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button id="modal-cancel" class="btn btn-secondary">Abbrechen</button>
        <button id="modal-save" class="btn btn-primary">Regel speichern</button>
      </div>
    </div>
  </div>

  <!-- Import Rules Modal (Distinct & Conflict Management) -->
  <div id="import-modal-overlay" class="modal-overlay">
    <div class="modal" style="max-width: 660px;">
      <div class="modal-header">
        <div>
          <h2 class="modal-title">URL-Regeln importieren (Distinct &amp; Konfliktprüfung)</h2>
          <div style="font-size:11px; color:#94a3b8;">Regeln werden anhand von Pattern-Typ &amp; Pattern eindeutig abgeglichen</div>
        </div>
        <button id="import-modal-close" class="close-btn">&times;</button>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-nav">
        <button id="tab-btn-file" class="tab-nav-btn active">📁 JSON-Datei hochladen</button>
        <button id="tab-btn-text" class="tab-nav-btn">📝 JSON-Text einfügen</button>
      </div>

      <!-- Tab Content File -->
      <div id="tab-content-file">
        <div style="border: 2px dashed #374151; border-radius: 8px; padding: 20px; text-align: center; background:#1e293b; cursor:pointer;" id="drop-zone">
          <div style="font-size:24px; margin-bottom:6px;">📄</div>
          <div style="font-weight:600; color:#f8fafc; font-size:13px;">JSON-Datei auswählen</div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px;">Klicken oder .json Datei hierhin ziehen</div>
          <input type="file" id="import-file-input" accept=".json" style="display:none;">
          <div id="import-file-name" style="font-size:11px; color:#38bdf8; margin-top:8px; font-weight:700;"></div>
        </div>
      </div>

      <!-- Tab Content Text -->
      <div id="tab-content-text" style="display:none;">
        <textarea id="import-textarea" class="form-textarea" rows="6" placeholder='[ { "name": "Prod", "patternType": "domain", "pattern": "app.com", "color": "#ff4f5e" } ]'></textarea>
      </div>

      <!-- Error Message -->
      <div id="import-error" style="background:#7f1d1d; border:1px solid #ef4444; color:#fecaca; padding:8px 12px; border-radius:6px; font-size:11px; margin-top:10px; display:none;"></div>

      <!-- Analysis Results & Conflict Resolution -->
      <div id="import-analysis" style="display:none; margin-top:14px;">
        <div class="stats-card">
          <div style="font-weight:700; color:#38bdf8; margin-bottom:4px;" id="import-stats-title">Analyse-Ergebnis</div>
          <div id="import-stats-desc" style="color:#cbd5e1; font-size:11px;"></div>
        </div>

        <div style="background:#182234; border:1px solid #283548; border-radius:8px; padding:12px; margin-bottom:12px;">
          <div style="font-size:11px; font-weight:700; color:#cbd5e1; text-transform:uppercase; margin-bottom:8px;">Aktion bei doppelten Regeln (Konflikten):</div>
          
          <label class="check-label" style="margin-bottom:6px;">
            <input type="radio" name="conflict-mode" value="update_conflicts" checked>
            <div>
              <strong style="color:#38bdf8;">Bestehende Regeln aktualisieren (Update)</strong>
              <span>Aktualisiert Farbe, Container, Symbole bestehender Regeln und fügt neue Regeln hinzu.</span>
            </div>
          </label>

          <label class="check-label" style="margin-bottom:6px;">
            <input type="radio" name="conflict-mode" value="keep_existing">
            <div>
              <strong>Bestehende Regeln beibehalten / Konflikte ignorieren</strong>
              <span>Vorhandene Regeln bleiben unberührt, nur komplett neue Regeln werden ergänzt.</span>
            </div>
          </label>

          <label class="check-label" style="margin-bottom:0;">
            <input type="radio" name="conflict-mode" value="replace_all">
            <div>
              <strong style="color:#f43f5e;">Alle bestehenden Regeln überschreiben</strong>
              <span>Ersetzt die gesamte Regelliste durch den importierten Datensatz.</span>
            </div>
          </label>
        </div>

        <!-- Force defaults checkbox -->
        <label class="check-label" style="background:#182234; border:1px solid #283548; border-radius:8px; padding:10px 12px;">
          <input type="checkbox" id="import-force-defaults">
          <div>
            <strong>Standard-Farbschema auf importierte Regeln anwenden</strong>
            <span id="import-defaults-hint">Verwendet Standard-Farbe &amp; Container</span>
          </div>
        </label>

        <!-- Collapsible Conflict List -->
        <div id="conflict-list-container" style="display:none; margin-top:10px;">
          <div style="font-size:11px; font-weight:700; color:#f59e0b;">Erkannte Konflikte:</div>
          <div class="conflict-box" id="conflict-items"></div>
        </div>
      </div>

      <div class="modal-footer">
        <button id="import-cancel" class="btn btn-secondary">Abbrechen</button>
        <button id="import-execute" class="btn btn-primary" disabled>Regeln importieren</button>
      </div>
    </div>
  </div>

  <!-- Massenbearbeitung Modal (Bulk Edit Dialog) -->
  <div id="bulk-edit-modal-overlay" class="modal-overlay">
    <div class="modal" style="max-width: 640px;">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="bulk-edit-title">✏️ Massenbearbeitung (Bulk Edit)</h2>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Wählen Sie die Eigenschaften, die für alle ausgewählten Regeln gleichzeitig aktualisiert werden sollen.</div>
        </div>
        <button id="bulk-edit-close" class="close-btn">&times;</button>
      </div>

      <!-- Option 1: Status -->
      <div class="form-group" style="background:#182234; padding:10px 12px; border-radius:8px; border:1px solid #283548;">
        <label class="form-label" style="font-size:11px; font-weight:700; color:#38bdf8; margin-bottom:6px;">1. Aktivierungsstatus anpassen:</label>
        <select id="be-status" class="form-select">
          <option value="keep">-- Keine Änderung (beibehalten) --</option>
          <option value="enable">Alle auf Aktiv setzen (● Aktiv)</option>
          <option value="disable">Alle auf Deaktiviert setzen (○ Inaktiv)</option>
          <option value="toggle">Status umkehren (Aktiv ↔ Inaktiv)</option>
        </select>
      </div>

      <!-- Option 2: Container-Farbe -->
      <div class="form-group" style="background:#182234; padding:10px 12px; border-radius:8px; border:1px solid #283548;">
        <label class="check-label" style="margin-bottom:6px;">
          <input type="checkbox" id="be-apply-color">
          <div>
            <strong style="color:#f8fafc;">2. Container-Farbe überschreiben</strong>
            <span>Wendet eine gemeinsame Farbe auf alle ausgewählten Regeln an.</span>
          </div>
        </label>
        <div id="be-color-controls" style="display:none; margin-top:8px;">
          <div class="color-swatch-grid" id="be-color-grid" style="grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:8px;">
            <button type="button" class="swatch-btn selected" data-color="blue" data-hex="#37adff" style="background:#37adff;">Blue</button>
            <button type="button" class="swatch-btn" data-color="turquoise" data-hex="#00c79a" style="background:#00c79a;">Turquoise</button>
            <button type="button" class="swatch-btn" data-color="green" data-hex="#51cf66" style="background:#51cf66;">Green</button>
            <button type="button" class="swatch-btn" data-color="yellow" data-hex="#ffcb00" style="background:#ffcb00; color:#000;">Yellow</button>
            <button type="button" class="swatch-btn" data-color="orange" data-hex="#ff9400" style="background:#ff9400;">Orange</button>
            <button type="button" class="swatch-btn" data-color="red" data-hex="#ff4f5e" style="background:#ff4f5e;">Red</button>
            <button type="button" class="swatch-btn" data-color="pink" data-hex="#ff4ba0" style="background:#ff4ba0;">Pink</button>
            <button type="button" class="swatch-btn" data-color="purple" data-hex="#9059ff" style="background:#9059ff;">Purple</button>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; color:#94a3b8;">Eigener Hex-Code:</span>
            <input type="color" id="be-picker" value="#37adff" style="width:26px; height:26px; border:none; border-radius:4px; cursor:pointer; background:transparent;">
            <input type="text" id="be-hex" class="form-input" style="width:90px; font-family:monospace; padding:4px 8px; font-size:11px;" value="#37adff">
          </div>
        </div>
      </div>

      <!-- Option 3: Container-Icon -->
      <div class="form-group" style="background:#182234; padding:10px 12px; border-radius:8px; border:1px solid #283548;">
        <label class="check-label" style="margin-bottom:6px;">
          <input type="checkbox" id="be-apply-icon">
          <div>
            <strong style="color:#f8fafc;">3. Container-Icon überschreiben</strong>
            <span>Weist allen ausgewählten Regeln das gleiche Firefox Container-Icon zu.</span>
          </div>
        </label>
        <div id="be-icon-controls" style="display:none; margin-top:8px;">
          <select id="be-icon-select" class="form-select">
            <option value="circle">● Circle (Standard-Kreis)</option>
            <option value="briefcase">💼 Briefcase (Arbeit)</option>
            <option value="fingerprint">🔒 Security (Sicherheit)</option>
            <option value="dollar">💰 Finance (Finanzen)</option>
            <option value="cart">🛒 Shopping (Einkaufen)</option>
            <option value="tree">🌲 Dev / Nature (Entwicklung)</option>
            <option value="chill">☕ Chill (Freizeit)</option>
            <option value="vacation">🏖️ Vacation (Urlaub)</option>
            <option value="food">🍔 Food (Essen)</option>
            <option value="fruit">🍎 Fruit (Obst)</option>
            <option value="pet">🐾 Pet (Haustier)</option>
            <option value="gift">🎁 Gift (Geschenk)</option>
          </select>
        </div>
      </div>

      <!-- Option 4: Tab-Symbol / Emoji -->
      <div class="form-group" style="background:#182234; padding:10px 12px; border-radius:8px; border:1px solid #283548;">
        <label class="check-label" style="margin-bottom:6px;">
          <input type="checkbox" id="be-apply-emoji">
          <div>
            <strong style="color:#f8fafc;">4. Tab-Symbol / Emoji anpassen</strong>
            <span>Zuweisen oder Entfernen von Favicon-/Titel-Symbolen.</span>
          </div>
        </label>
        <div id="be-emoji-controls" style="display:none; margin-top:8px;">
          <div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
            <input type="text" id="be-emoji-input" class="form-input" placeholder="z. B. 📦 oder [API]" maxlength="10" style="flex:1;">
            <button type="button" id="btn-be-emoji-empty" class="btn btn-secondary" style="font-size:11px; color:#f87171;">Symbole löschen</button>
          </div>
          <div id="be-quick-emojis" style="display:flex; gap:4px; flex-wrap:wrap;"></div>
        </div>
      </div>

      <!-- Option 5: Farbmodus -->
      <div class="form-group" style="background:#182234; padding:10px 12px; border-radius:8px; border:1px solid #283548;">
        <label class="form-label" style="font-size:11px; font-weight:700; color:#38bdf8; margin-bottom:6px;">5. Farbmodus anpassen:</label>
        <select id="be-mode" class="form-select">
          <option value="keep">-- Keine Änderung (beibehalten) --</option>
          <option value="container">Nur Container (Empfohlen: Firefox Theme bleibt unverändert)</option>
          <option value="hybrid">Hybrid (Container + Firefox Fenstertheme)</option>
        </select>
      </div>

      <!-- Option 6: 3px Akzentleiste -->
      <div class="form-group" style="background:#182234; padding:10px 12px; border-radius:8px; border:1px solid #283548; margin-bottom:10px;">
        <label class="form-label" style="font-size:11px; font-weight:700; color:#38bdf8; margin-bottom:6px;">6. 3px Seiten-Akzentleiste:</label>
        <select id="be-topbar" class="form-select">
          <option value="keep">-- Keine Änderung (beibehalten) --</option>
          <option value="enable">Akzentleiste aktivieren (ein)</option>
          <option value="disable">Akzentleiste deaktivieren (aus)</option>
        </select>
      </div>

      <!-- Option 7: Favicon-Kontrast-Schutz (Halo-Kontur) -->
      <div class="form-group" style="background:#182234; padding:10px 12px; border-radius:8px; border:1px solid #283548; margin-bottom:0;">
        <label class="form-label" style="font-size:11px; font-weight:700; color:#38bdf8; margin-bottom:6px;">7. Favicon-Kontrast-Schutz (Halo-Kontur):</label>
        <select id="be-halo" class="form-select">
          <option value="keep">-- Keine Änderung (beibehalten) --</option>
          <option value="enable">Halo-Kontur aktivieren (Schutzrand an)</option>
          <option value="disable">Halo-Kontur deaktivieren (aus)</option>
        </select>
      </div>

      <div class="modal-footer">
        <button id="bulk-edit-cancel" class="btn btn-secondary">Abbrechen</button>
        <button id="bulk-edit-apply" class="btn btn-primary">✓ Auf ausgewählte Regeln anwenden</button>
      </div>
    </div>
  </div>

  <script src="options.js"></script>
</body>
</html>`;

  files.push({
    name: 'options.html',
    path: 'options.html',
    content: optionsHtml,
    language: 'html',
  });

  // 7. options.js
  const optionsJs = `/**
 * TabChroma - Firefox URL Tab Color Studio
 * Options Script with Standard-Einstellungen, Edit Modal & Distinct Import
 */

const DEFAULT_CONFIG = ${JSON.stringify(config, null, 2)};
let appConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let editingRuleIndex = -1;

const hexMap = {
  blue: '#37adff',
  turquoise: '#00c79a',
  green: '#51cf66',
  yellow: '#ffcb00',
  orange: '#ff9400',
  red: '#ff4f5e',
  pink: '#ff4ba0',
  purple: '#9059ff',
};

const iconSymbols = {
  circle: '●', briefcase: '💼', fingerprint: '🔒', dollar: '💰', cart: '🛒',
  tree: '🌲', chill: '☕', vacation: '🏖️', food: '🍔', fruit: '🍎', pet: '🐾', gift: '🎁'
};

// -------------------------------------------------------------
// Configuration & Storage
// -------------------------------------------------------------
async function loadConfig() {
  try {
    const data = await browser.storage.local.get(['tabChromaConfig']);
    if (data && data.tabChromaConfig) {
      appConfig = { ...DEFAULT_CONFIG, ...data.tabChromaConfig };
    } else {
      const response = await browser.runtime.sendMessage({ action: 'GET_CONFIG' });
      if (response && response.rules) {
        appConfig = { ...DEFAULT_CONFIG, ...response };
      }
    }
  } catch (e) {
    console.warn('[TabChroma] Fallback to defaults:', e);
  }

  if (!appConfig.rules) appConfig.rules = DEFAULT_CONFIG.rules || [];
  if (!appConfig.defaultColor) appConfig.defaultColor = DEFAULT_CONFIG.defaultColor || '#37adff';
  if (!appConfig.defaultContainerColor) appConfig.defaultContainerColor = DEFAULT_CONFIG.defaultContainerColor || 'blue';
  if (!appConfig.defaultMode) appConfig.defaultMode = DEFAULT_CONFIG.defaultMode || 'container';
  if (appConfig.enableFaviconContrastHalo === undefined) {
    appConfig.enableFaviconContrastHalo = DEFAULT_CONFIG.enableFaviconContrastHalo !== false;
  }

  renderDefaultsCard();
  initLiveUrlMatcher();
  renderRules();
  initBulkToolbar();
}

async function saveConfigToStorage() {
  try {
    await browser.storage.local.set({ tabChromaConfig: appConfig });
  } catch (e) {}
  try {
    await browser.runtime.sendMessage({ action: 'SAVE_CONFIG', config: appConfig });
  } catch (e) {}
}

// -------------------------------------------------------------
// Defaults Card (Standard-Einstellungen & Farbschema)
// -------------------------------------------------------------
let currentOpacityTestColor = '#ff4f5e';
let currentOpacityTestIcon = '🔴';

function hexToRgba(hex, alpha) {
  if (!hex) return 'rgba(55, 173, 255, ' + (alpha !== undefined ? alpha : 0.35) + ')';
  var clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(function(c) { return c + c; }).join('');
  }
  if (clean.length >= 6) {
    var r = parseInt(clean.substring(0, 2), 16) || 0;
    var g = parseInt(clean.substring(2, 4), 16) || 0;
    var b = parseInt(clean.substring(4, 6), 16) || 0;
    var a = (alpha !== undefined && alpha !== null) ? Math.max(0, Math.min(1, Number(alpha))) : 0.35;
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
  }
  return hex;
}

function updateOpacityPreview() {
  const opacityVal = (typeof appConfig.activeTabOpacity === 'number') ? appConfig.activeTabOpacity : 0.35;
  const isHalo = appConfig.enableFaviconContrastHalo !== false;
  const pct = Math.round(opacityVal * 100);

  // 1. Text badge next to header
  const lblOpacityVal = document.getElementById('lbl-opacity-val');
  if (lblOpacityVal) lblOpacityVal.textContent = pct + '% Deckkraft';

  // 2. Slider value sync
  const defOpacity = document.getElementById('def-opacity');
  if (defOpacity && Math.abs(parseFloat(defOpacity.value) - opacityVal) > 0.01) {
    defOpacity.value = String(opacityVal);
  }

  // 3. Preset button active highlights
  document.querySelectorAll('.op-preset-btn').forEach((btn) => {
    const val = parseFloat(btn.getAttribute('data-val'));
    if (Math.abs(val - opacityVal) < 0.03) {
      btn.style.borderColor = '#0284c7';
      btn.style.background = 'rgba(2, 132, 199, 0.25)';
      btn.style.color = '#38bdf8';
      btn.style.fontWeight = '700';
    } else {
      btn.style.borderColor = '';
      btn.style.background = '';
      btn.style.color = '';
      btn.style.fontWeight = '';
    }
  });

  // 4. Halo badge status
  const haloBadge = document.getElementById('badge-halo-status');
  if (haloBadge) {
    haloBadge.textContent = isHalo ? 'Aktiv' : 'Deaktiviert';
    haloBadge.style.color = isHalo ? '#38bdf8' : '#94a3b8';
    haloBadge.style.borderColor = isHalo ? 'rgba(56, 189, 248, 0.4)' : '#334155';
    haloBadge.style.background = isHalo ? 'rgba(56, 189, 248, 0.2)' : 'rgba(100, 116, 139, 0.2)';
  }

  // 5. Solid bad example tab (100% opacity)
  const tabSolid = document.getElementById('preview-tab-solid');
  const iconSolid = document.getElementById('preview-tab-solid-icon');
  if (tabSolid) {
    tabSolid.style.backgroundColor = currentOpacityTestColor;
    tabSolid.style.borderTopColor = currentOpacityTestColor;
  }
  if (iconSolid) {
    iconSolid.textContent = currentOpacityTestIcon;
    iconSolid.style.filter = 'none';
  }

  // 6. Good live example tab (with dynamic opacity & halo)
  const tabOpacity = document.getElementById('preview-tab-opacity');
  const iconOpacity = document.getElementById('preview-tab-opacity-icon');
  if (tabOpacity) {
    tabOpacity.style.backgroundColor = hexToRgba(currentOpacityTestColor, opacityVal);
    tabOpacity.style.borderTopColor = currentOpacityTestColor;
  }
  if (iconOpacity) {
    iconOpacity.textContent = currentOpacityTestIcon;
    iconOpacity.style.filter = isHalo
      ? 'drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 2px rgba(0, 0, 0, 0.85))'
      : 'none';
  }

  // 7. Preview status text
  const badge = document.getElementById('preview-tab-badge');
  if (badge) {
    if (pct <= 50) {
      badge.textContent = pct + '% (Klar erkennbar!)';
      badge.style.color = '#10b981';
    } else if (pct <= 75) {
      badge.textContent = pct + '% (Ausgewogen)';
      badge.style.color = '#38bdf8';
    } else if (pct < 100) {
      badge.textContent = pct + '% (Kräftig / Reduzierter Kontrast)';
      badge.style.color = '#f59e0b';
    } else {
      badge.textContent = '100% (Verschwimmt bei gleicher Farbe)';
      badge.style.color = '#f43f5e';
    }
  }

  // 8. Color code label in description
  const codeElem = document.getElementById('preview-test-color-code');
  if (codeElem) codeElem.textContent = currentOpacityTestColor;

  // 9. Legacy pill if element exists
  const haloPill = document.getElementById('halo-preview-pill');
  if (haloPill) {
    haloPill.style.backgroundColor = hexToRgba(currentOpacityTestColor, opacityVal);
    haloPill.style.borderTopColor = currentOpacityTestColor;
  }
  const demoHaloIcon = document.getElementById('demo-halo-icon');
  if (demoHaloIcon) {
    demoHaloIcon.textContent = currentOpacityTestIcon;
    demoHaloIcon.style.filter = isHalo
      ? 'drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 2px rgba(0, 0, 0, 0.85))'
      : 'none';
  }
}

function updateHaloPreview(isHalo) {
  updateOpacityPreview();
}

function renderDefaultsCard() {
  const defHex = document.getElementById('def-hex');
  const defPicker = document.getElementById('def-picker');
  const defActiveTheme = document.getElementById('def-active-theme');
  const defRevertUnmatched = document.getElementById('def-revert-unmatched');
  const defEnableTopbar = document.getElementById('def-enable-topbar');

  if (defHex) defHex.value = appConfig.defaultColor || '#37adff';
  if (defPicker) defPicker.value = (appConfig.defaultColor && appConfig.defaultColor.startsWith('#')) ? appConfig.defaultColor : '#37adff';

  // Highlight active default container color swatch
  document.querySelectorAll('#def-color-grid .swatch-btn').forEach((btn) => {
    if (btn.getAttribute('data-color') === appConfig.defaultContainerColor) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });

  // Mode radio cards
  const modeContainer = document.getElementById('mode-opt-container');
  const modeHybrid = document.getElementById('mode-opt-hybrid');
  const hybridOptions = document.getElementById('def-hybrid-options');
  if (appConfig.defaultMode === 'hybrid') {
    modeHybrid?.classList.add('selected');
    modeContainer?.classList.remove('selected');
    if (hybridOptions) hybridOptions.style.display = 'block';
  } else {
    modeContainer?.classList.add('selected');
    modeHybrid?.classList.remove('selected');
    if (hybridOptions) hybridOptions.style.display = 'none';
  }

  // Hybrid sub-options
  const winBehavior = appConfig.hybridWindowBehavior || 'static_window';
  const optStatic = document.getElementById('opt-hybrid-win-static');
  const optDynamic = document.getElementById('opt-hybrid-win-dynamic');
  if (optStatic && optDynamic) {
    if (winBehavior === 'dynamic_toolbar') optDynamic.checked = true;
    else optStatic.checked = true;
  }
  const indStyle = document.getElementById('def-hybrid-indicator-style');
  if (indStyle) {
    indStyle.value = appConfig.hybridTabIndicatorStyle || 'accent_line_and_fill';
  }

  if (defActiveTheme) defActiveTheme.checked = !!appConfig.enableActiveTabTheme;
  if (defRevertUnmatched) defRevertUnmatched.checked = appConfig.revertUnmatchedToDefault !== false;
  if (defEnableTopbar) defEnableTopbar.checked = appConfig.enablePageTopBar !== false;

  const defOpacity = document.getElementById('def-opacity');
  const lblOpacityVal = document.getElementById('lbl-opacity-val');
  const opacityVal = (typeof appConfig.activeTabOpacity === 'number') ? appConfig.activeTabOpacity : 0.35;
  if (defOpacity) defOpacity.value = String(opacityVal);
  if (lblOpacityVal) lblOpacityVal.textContent = Math.round(opacityVal * 100) + '%';

  const defHalo = document.getElementById('def-favicon-halo');
  const isHalo = appConfig.enableFaviconContrastHalo !== false;
  if (defHalo) defHalo.checked = isHalo;
  updateHaloPreview(isHalo);

  // Base theme mode
  const defBaseTheme = document.getElementById('def-base-theme');
  const customThemeFields = document.getElementById('custom-theme-fields');
  const defFramePicker = document.getElementById('def-frame-picker');
  const defFrameInput = document.getElementById('def-frame-input');
  const defToolbarPicker = document.getElementById('def-toolbar-picker');
  const defToolbarInput = document.getElementById('def-toolbar-input');
  const defTextPicker = document.getElementById('def-text-picker');
  const defTextInput = document.getElementById('def-text-input');

  const currentThemeMode = appConfig.baseThemeMode || 'system';
  if (defBaseTheme) defBaseTheme.value = currentThemeMode;
  if (customThemeFields) {
    customThemeFields.style.display = (currentThemeMode === 'custom') ? 'flex' : 'none';
  }
  const frameColor = appConfig.customBaseFrameColor || '#1c1b22';
  const toolbarColor = appConfig.customBaseToolbarColor || '#2b2a33';
  const textColor = appConfig.customBaseTextColor || '#fbfbfe';

  if (defFramePicker) defFramePicker.value = frameColor;
  if (defFrameInput) defFrameInput.value = frameColor.toUpperCase();
  if (defToolbarPicker) defToolbarPicker.value = toolbarColor;
  if (defToolbarInput) defToolbarInput.value = toolbarColor.toUpperCase();
  if (defTextPicker) defTextPicker.value = textColor;
  if (defTextInput) defTextInput.value = textColor.toUpperCase();

  // Apply base theme mode & custom variables directly to options page layout!
  applyOptionsPageTheme();
  updateThemePresetDropdown();
}

// -------------------------------------------------------------
// Theme Presets & Custom Theme Styling Engine
// -------------------------------------------------------------
const THEME_PRESETS_LIST = [
  {
    id: 'catppuccin-mocha',
    name: '🌸 Catppuccin Mocha',
    description: 'Moderne Pastelltöne auf samtigem Schiefer',
    frame: '#181825',
    toolbar: '#1e1e2e',
    text: '#cdd6f4',
    defaultColor: '#cba6f7',
    opacity: 0.35,
  },
  {
    id: 'nord-aurora',
    name: '❄️ Nord Aurora',
    description: 'Arktisches Dunkelblau mit Polar-Frost Cyan-Akzenten',
    frame: '#242933',
    toolbar: '#2e3440',
    text: '#eceff4',
    defaultColor: '#88c0d0',
    opacity: 0.35,
  },
  {
    id: 'dracula-pro',
    name: '🧛 Dracula Dark',
    description: 'Beliebtes Entwickler-Theme mit markantem Pink & Violett',
    frame: '#21222c',
    toolbar: '#282a36',
    text: '#f8f8f2',
    defaultColor: '#ff79c6',
    opacity: 0.35,
  },
  {
    id: 'tokyo-night',
    name: '🌃 Tokyo Night',
    description: 'Tiefes Nachtblau mit leuchtenden Neon-Akzenten',
    frame: '#16161e',
    toolbar: '#1a1b26',
    text: '#c0caf5',
    defaultColor: '#7aa2f7',
    opacity: 0.35,
  },
  {
    id: 'oled-midnight',
    name: '⬛ OLED Pure Black',
    description: 'Tiefschwarz für stromsparendes OLED ohne Graustufen',
    frame: '#000000',
    toolbar: '#0c0d12',
    text: '#ffffff',
    defaultColor: '#38bdf8',
    opacity: 0.40,
  },
  {
    id: 'firefox-proton-dark',
    name: '🦊 Firefox Dark Pure',
    description: 'Klassisches Mozilla Dark Theme (#1c1b22, #2b2a33)',
    frame: '#1c1b22',
    toolbar: '#2b2a33',
    text: '#fbfbfe',
    defaultColor: '#37adff',
    opacity: 0.35,
  },
  {
    id: 'clean-light',
    name: '☀️ Firefox Light Pure',
    description: 'Helles Tageslicht-Design mit hohem Lesekontrast',
    frame: '#ffffff',
    toolbar: '#f0f0f4',
    text: '#15141a',
    defaultColor: '#0060df',
    opacity: 0.30,
  },
];

function isColorDark(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return true;
  const c = hex.replace('#', '');
  if (c.length < 6) return true;
  const r = parseInt(c.substr(0, 2), 16) || 0;
  const g = parseInt(c.substr(2, 2), 16) || 0;
  const b = parseInt(c.substr(4, 2), 16) || 0;
  return (r * 0.299 + g * 0.587 + b * 0.114) < 140;
}

function applyOptionsPageTheme() {
  const currentThemeMode = appConfig.baseThemeMode || 'system';
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-system', 'theme-custom');
  document.body.classList.add('theme-' + currentThemeMode);

  const root = document.documentElement;
  if (currentThemeMode === 'custom') {
    const fColor = appConfig.customBaseFrameColor || '#1c1b22';
    const tbColor = appConfig.customBaseToolbarColor || '#2b2a33';
    const txtColor = appConfig.customBaseTextColor || '#fbfbfe';
    const darkTb = isColorDark(tbColor);

    root.style.setProperty('--bg', fColor);
    root.style.setProperty('--card-bg', tbColor);
    root.style.setProperty('--text', txtColor);

    if (darkTb) {
      root.style.setProperty('--card-border', 'rgba(255, 255, 255, 0.12)');
      root.style.setProperty('--col-bg', 'rgba(0, 0, 0, 0.24)');
      root.style.setProperty('--col-border', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--input-bg', 'rgba(0, 0, 0, 0.32)');
      root.style.setProperty('--input-border', 'rgba(255, 255, 255, 0.16)');
      root.style.setProperty('--btn-sec-bg', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--btn-sec-text', txtColor);
      root.style.setProperty('--btn-sec-border', 'rgba(255, 255, 255, 0.18)');
      root.style.setProperty('--muted', 'rgba(255, 255, 255, 0.65)');
    } else {
      root.style.setProperty('--card-border', 'rgba(0, 0, 0, 0.12)');
      root.style.setProperty('--col-bg', 'rgba(0, 0, 0, 0.04)');
      root.style.setProperty('--col-border', 'rgba(0, 0, 0, 0.10)');
      root.style.setProperty('--input-bg', '#ffffff');
      root.style.setProperty('--input-border', 'rgba(0, 0, 0, 0.18)');
      root.style.setProperty('--btn-sec-bg', 'rgba(0, 0, 0, 0.05)');
      root.style.setProperty('--btn-sec-text', txtColor);
      root.style.setProperty('--btn-sec-border', 'rgba(0, 0, 0, 0.18)');
      root.style.setProperty('--muted', 'rgba(0, 0, 0, 0.60)');
    }
  } else {
    const vars = ['--bg', '--card-bg', '--text', '--card-border', '--col-bg', '--col-border', '--input-bg', '--input-border', '--btn-sec-bg', '--btn-sec-text', '--btn-sec-border', '--muted'];
    vars.forEach((v) => root.style.removeProperty(v));
  }
}

function updateThemePresetDropdown() {
  const sel = document.getElementById('def-theme-preset');
  const optSaved = document.getElementById('optgroup-saved-themes');
  const badge = document.getElementById('lbl-preset-badge');
  if (!sel) return;

  if (optSaved) {
    optSaved.innerHTML = '';
    const saved = appConfig.savedThemes || [];
    saved.forEach((st) => {
      const opt = document.createElement('option');
      opt.value = st.id;
      opt.textContent = '⭐ ' + st.name;
      optSaved.appendChild(opt);
    });
    optSaved.style.display = saved.length > 0 ? '' : 'none';
  }

  const curFrame = (appConfig.customBaseFrameColor || '').toLowerCase();
  const curToolbar = (appConfig.customBaseToolbarColor || '').toLowerCase();
  const curText = (appConfig.customBaseTextColor || '').toLowerCase();

  let matched = THEME_PRESETS_LIST.find((p) =>
    p.frame.toLowerCase() === curFrame &&
    p.toolbar.toLowerCase() === curToolbar &&
    p.text.toLowerCase() === curText
  );
  if (!matched && appConfig.savedThemes) {
    matched = appConfig.savedThemes.find((p) =>
      p.frame.toLowerCase() === curFrame &&
      p.toolbar.toLowerCase() === curToolbar &&
      p.text.toLowerCase() === curText
    );
  }

  if (matched) {
    sel.value = matched.id;
    if (badge) badge.textContent = matched.name;
  } else {
    sel.value = '';
    if (badge) badge.textContent = (appConfig.baseThemeMode === 'custom') ? 'Eigene Farben' : '';
  }
}

async function applyThemePreset(presetId) {
  if (!presetId) return;
  let found = THEME_PRESETS_LIST.find((p) => p.id === presetId);
  if (!found && appConfig.savedThemes) {
    found = appConfig.savedThemes.find((p) => p.id === presetId);
  }
  if (!found) return;

  appConfig.baseThemeMode = 'custom';
  appConfig.customBaseFrameColor = found.frame;
  appConfig.customBaseToolbarColor = found.toolbar;
  appConfig.customBaseTextColor = found.text;
  if (found.defaultColor) appConfig.defaultColor = found.defaultColor;
  if (typeof found.opacity === 'number') appConfig.activeTabOpacity = found.opacity;
  if (found.hybridWindowBehavior) appConfig.hybridWindowBehavior = found.hybridWindowBehavior;
  if (found.hybridTabIndicatorStyle) appConfig.hybridTabIndicatorStyle = found.hybridTabIndicatorStyle;

  const defBaseTheme = document.getElementById('def-base-theme');
  if (defBaseTheme) defBaseTheme.value = 'custom';
  const customThemeFields = document.getElementById('custom-theme-fields');
  if (customThemeFields) customThemeFields.style.display = 'flex';

  const defFramePicker = document.getElementById('def-frame-picker');
  const defFrameInput = document.getElementById('def-frame-input');
  const defToolbarPicker = document.getElementById('def-toolbar-picker');
  const defToolbarInput = document.getElementById('def-toolbar-input');
  const defTextPicker = document.getElementById('def-text-picker');
  const defTextInput = document.getElementById('def-text-input');

  if (defFramePicker) defFramePicker.value = found.frame;
  if (defFrameInput) defFrameInput.value = found.frame.toUpperCase();
  if (defToolbarPicker) defToolbarPicker.value = found.toolbar;
  if (defToolbarInput) defToolbarInput.value = found.toolbar.toUpperCase();
  if (defTextPicker) defTextPicker.value = found.text;
  if (defTextInput) defTextInput.value = found.text.toUpperCase();

  applyOptionsPageTheme();
  updateThemePresetDropdown();
  await saveConfigToStorage();
}

// Preset dropdown listener
document.getElementById('def-theme-preset')?.addEventListener('change', (e) => {
  if (e.target.value) {
    applyThemePreset(e.target.value);
  }
});

// Quick-theme preset buttons
document.querySelectorAll('.btn-quick-theme').forEach((btn) => {
  btn.addEventListener('click', () => {
    const themeId = btn.getAttribute('data-theme');
    if (themeId) {
      applyThemePreset(themeId);
    }
  });
});

// Save as new custom preset
document.getElementById('btn-save-as-preset')?.addEventListener('click', async () => {
  const name = prompt('Geben Sie einen Namen für diese Theme-Vorlage ein:');
  if (!name || !name.trim()) return;

  if (!appConfig.savedThemes) appConfig.savedThemes = [];
  const newPreset = {
    id: 'user-theme-' + Date.now(),
    name: name.trim(),
    frame: appConfig.customBaseFrameColor || '#1c1b22',
    toolbar: appConfig.customBaseToolbarColor || '#2b2a33',
    text: appConfig.customBaseTextColor || '#fbfbfe',
    defaultColor: appConfig.defaultColor || '#37adff',
    opacity: appConfig.activeTabOpacity ?? 0.35,
    isCustom: true,
  };
  appConfig.savedThemes.push(newPreset);
  await saveConfigToStorage();
  updateThemePresetDropdown();
  const sel = document.getElementById('def-theme-preset');
  if (sel) sel.value = newPreset.id;
  const badge = document.getElementById('lbl-preset-badge');
  if (badge) badge.textContent = newPreset.name;
  alert('Theme-Vorlage "' + newPreset.name + '" erfolgreich gespeichert!');
});

// Defaults listeners
document.getElementById('def-base-theme')?.addEventListener('change', (e) => {
  appConfig.baseThemeMode = e.target.value;
  const customThemeFields = document.getElementById('custom-theme-fields');
  if (customThemeFields) {
    customThemeFields.style.display = (e.target.value === 'custom') ? 'flex' : 'none';
  }
  applyOptionsPageTheme();
  updateThemePresetDropdown();
  saveConfigToStorage();
});

// Frame color sync
document.getElementById('def-frame-picker')?.addEventListener('input', (e) => {
  appConfig.customBaseFrameColor = e.target.value;
  const inp = document.getElementById('def-frame-input');
  if (inp) inp.value = e.target.value.toUpperCase();
  applyOptionsPageTheme();
  updateThemePresetDropdown();
  saveConfigToStorage();
});
document.getElementById('def-frame-input')?.addEventListener('input', (e) => {
  let val = e.target.value.trim();
  if (!val.startsWith('#')) val = '#' + val;
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    appConfig.customBaseFrameColor = val;
    const picker = document.getElementById('def-frame-picker');
    if (picker) picker.value = val;
    applyOptionsPageTheme();
    updateThemePresetDropdown();
    saveConfigToStorage();
  }
});

// Toolbar color sync
document.getElementById('def-toolbar-picker')?.addEventListener('input', (e) => {
  appConfig.customBaseToolbarColor = e.target.value;
  const inp = document.getElementById('def-toolbar-input');
  if (inp) inp.value = e.target.value.toUpperCase();
  applyOptionsPageTheme();
  updateThemePresetDropdown();
  saveConfigToStorage();
});
document.getElementById('def-toolbar-input')?.addEventListener('input', (e) => {
  let val = e.target.value.trim();
  if (!val.startsWith('#')) val = '#' + val;
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    appConfig.customBaseToolbarColor = val;
    const picker = document.getElementById('def-toolbar-picker');
    if (picker) picker.value = val;
    applyOptionsPageTheme();
    updateThemePresetDropdown();
    saveConfigToStorage();
  }
});

// Text color sync
document.getElementById('def-text-picker')?.addEventListener('input', (e) => {
  appConfig.customBaseTextColor = e.target.value;
  const inp = document.getElementById('def-text-input');
  if (inp) inp.value = e.target.value.toUpperCase();
  applyOptionsPageTheme();
  updateThemePresetDropdown();
  saveConfigToStorage();
});
document.getElementById('def-text-input')?.addEventListener('input', (e) => {
  let val = e.target.value.trim();
  if (!val.startsWith('#')) val = '#' + val;
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    appConfig.customBaseTextColor = val;
    const picker = document.getElementById('def-text-picker');
    if (picker) picker.value = val;
    applyOptionsPageTheme();
    updateThemePresetDropdown();
    saveConfigToStorage();
  }
});

// Hybrid options listeners
document.getElementById('opt-hybrid-win-static')?.addEventListener('change', () => {
  appConfig.hybridWindowBehavior = 'static_window';
  saveConfigToStorage();
});
document.getElementById('opt-hybrid-win-dynamic')?.addEventListener('change', () => {
  appConfig.hybridWindowBehavior = 'dynamic_toolbar';
  saveConfigToStorage();
});
document.getElementById('def-hybrid-indicator-style')?.addEventListener('change', (e) => {
  appConfig.hybridTabIndicatorStyle = e.target.value;
  saveConfigToStorage();
});

// Theme export button for colleagues
document.getElementById('btn-export-theme')?.addEventListener('click', () => {
  const themePkg = {
    format: 'tabchroma-theme',
    version: '1.0',
    themeName: 'TabChroma Custom Theme',
    createdAt: new Date().toISOString(),
    baseThemeMode: appConfig.baseThemeMode || 'custom',
    customBaseFrameColor: appConfig.customBaseFrameColor || '#1c1b22',
    customBaseToolbarColor: appConfig.customBaseToolbarColor || '#2b2a33',
    customBaseTextColor: appConfig.customBaseTextColor || '#fbfbfe',
    defaultColor: appConfig.defaultColor || '#37adff',
    activeTabOpacity: appConfig.activeTabOpacity ?? 0.35,
    enableFaviconContrastHalo: appConfig.enableFaviconContrastHalo !== false,
    hybridWindowBehavior: appConfig.hybridWindowBehavior || 'static_window',
    hybridTabIndicatorStyle: appConfig.hybridTabIndicatorStyle || 'accent_line_and_fill',
  };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(themePkg, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', 'tabchroma-theme.json');
  document.body.appendChild(a);
  a.click();
  a.remove();
});

// Theme import button for colleagues
document.getElementById('btn-import-theme')?.addEventListener('click', () => {
  document.getElementById('theme-file-addon-input')?.click();
});

document.getElementById('theme-file-addon-input')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.customBaseFrameColor) appConfig.customBaseFrameColor = data.customBaseFrameColor;
      if (data.customBaseToolbarColor) appConfig.customBaseToolbarColor = data.customBaseToolbarColor;
      if (data.customBaseTextColor) appConfig.customBaseTextColor = data.customBaseTextColor;
      if (data.defaultColor) appConfig.defaultColor = data.defaultColor;
      if (typeof data.activeTabOpacity === 'number') appConfig.activeTabOpacity = data.activeTabOpacity;
      if (typeof data.enableFaviconContrastHalo === 'boolean') appConfig.enableFaviconContrastHalo = data.enableFaviconContrastHalo;
      appConfig.baseThemeMode = 'custom';
      await saveConfigToStorage();
      renderDefaultsCard();
      applyOptionsPageTheme();
      updateThemePresetDropdown();
      alert('Theme erfolgreich importiert und angewendet!');
    } catch (err) {
      alert('Fehler beim Importieren der Theme-Datei: ' + err.message);
    }
  };
  reader.readAsText(file);
});

document.querySelectorAll('#def-color-grid .swatch-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const col = btn.getAttribute('data-color');
    const hex = btn.getAttribute('data-hex') || hexMap[col] || '#37adff';
    appConfig.defaultContainerColor = col;
    appConfig.defaultColor = hex;
    renderDefaultsCard();
  });
});

document.getElementById('def-opacity')?.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  appConfig.activeTabOpacity = val;
  updateOpacityPreview();
});

document.getElementById('def-favicon-halo')?.addEventListener('change', (e) => {
  appConfig.enableFaviconContrastHalo = e.target.checked;
  updateOpacityPreview();
});

document.querySelectorAll('.op-preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const val = parseFloat(btn.getAttribute('data-val'));
    appConfig.activeTabOpacity = val;
    updateOpacityPreview();
  });
});

// Opacity Preview Test Color listeners
document.querySelectorAll('#opacity-test-color-group .test-color-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentOpacityTestColor = btn.getAttribute('data-color') || '#ff4f5e';
    document.querySelectorAll('#opacity-test-color-group .test-color-btn').forEach((b) => {
      if (b === btn) {
        b.style.border = '2px solid #fff';
        b.style.opacity = '1';
        b.style.transform = 'scale(1.15)';
      } else {
        b.style.border = '1px solid rgba(0,0,0,0.4)';
        b.style.opacity = '0.65';
        b.style.transform = 'scale(1)';
      }
    });
    updateOpacityPreview();
  });
});

// Opacity Preview Test Icon listeners
document.querySelectorAll('#opacity-test-icon-group .test-icon-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentOpacityTestIcon = btn.getAttribute('data-icon') || '🔴';
    document.querySelectorAll('#opacity-test-icon-group .test-icon-btn').forEach((b) => {
      if (b === btn) {
        b.style.borderColor = '#0284c7';
        b.style.background = 'rgba(2, 132, 199, 0.25)';
      } else {
        b.style.borderColor = 'transparent';
        b.style.background = 'transparent';
      }
    });
    updateOpacityPreview();
  });
});

document.getElementById('def-picker')?.addEventListener('input', (e) => {
  appConfig.defaultColor = e.target.value;
  const defHex = document.getElementById('def-hex');
  if (defHex) defHex.value = e.target.value;
});

document.getElementById('def-hex')?.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    appConfig.defaultColor = val;
    const defPicker = document.getElementById('def-picker');
    if (defPicker) defPicker.value = val;
  }
});

document.getElementById('mode-opt-container')?.addEventListener('click', () => {
  appConfig.defaultMode = 'container';
  renderDefaultsCard();
});

document.getElementById('mode-opt-hybrid')?.addEventListener('click', () => {
  appConfig.defaultMode = 'hybrid';
  renderDefaultsCard();
});

document.getElementById('btn-save-defaults')?.addEventListener('click', async () => {
  const defHex = document.getElementById('def-hex');
  const defActiveTheme = document.getElementById('def-active-theme');
  const defRevertUnmatched = document.getElementById('def-revert-unmatched');
  const defEnableTopbar = document.getElementById('def-enable-topbar');

  if (defHex && defHex.value.trim()) {
    appConfig.defaultColor = defHex.value.trim();
  }
  if (defActiveTheme) appConfig.enableActiveTabTheme = defActiveTheme.checked;
  if (defRevertUnmatched) appConfig.revertUnmatchedToDefault = defRevertUnmatched.checked;
  if (defEnableTopbar) appConfig.enablePageTopBar = defEnableTopbar.checked;
  const defOpacity = document.getElementById('def-opacity');
  if (defOpacity) appConfig.activeTabOpacity = parseFloat(defOpacity.value);
  const defHalo = document.getElementById('def-favicon-halo');
  if (defHalo) appConfig.enableFaviconContrastHalo = defHalo.checked;
  const defBaseTheme = document.getElementById('def-base-theme');
  if (defBaseTheme) appConfig.baseThemeMode = defBaseTheme.value;
  const defFramePicker = document.getElementById('def-frame-picker');
  if (defFramePicker) appConfig.customBaseFrameColor = defFramePicker.value;
  const defToolbarPicker = document.getElementById('def-toolbar-picker');
  if (defToolbarPicker) appConfig.customBaseToolbarColor = defToolbarPicker.value;
  const defTextPicker = document.getElementById('def-text-picker');
  if (defTextPicker) appConfig.customBaseTextColor = defTextPicker.value;

  applyOptionsPageTheme();
  updateThemePresetDropdown();
  await saveConfigToStorage();

  const feedback = document.getElementById('defaults-feedback');
  if (feedback) {
    feedback.style.display = 'inline';
    setTimeout(() => { feedback.style.display = 'none'; }, 3000);
  }
});

document.getElementById('btn-reset-defaults')?.addEventListener('click', async () => {
  if (confirm('Möchten Sie alle Standard-Einstellungen und Dummy-Regeln auf die Werkseinstellungen zurücksetzen?')) {
    appConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    await saveConfigToStorage();
    renderDefaultsCard();
    initLiveUrlMatcher();
    renderRules();
  }
});

// -------------------------------------------------------------
// Live URL Match Evaluator & Tester
// -------------------------------------------------------------
function testRuleMatchDetailed(url, rule) {
  if (!rule.enabled) return { matched: false, reason: 'Regel ist deaktiviert' };
  if (!url || typeof url !== 'string') return { matched: false, reason: 'Keine URL angegeben' };

  const cleanUrl = url.trim();
  let parsedUrl = null;
  try {
    parsedUrl = new URL(cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') ? cleanUrl : ('https://' + cleanUrl));
  } catch (e) {}

  switch (rule.patternType) {
    case 'wildcard': {
      try {
        const regex = wildcardToRegExp(rule.pattern);
        if (regex.test(cleanUrl)) return { matched: true, reason: 'Entspricht Wildcard-Muster: ' + rule.pattern };
        if (parsedUrl && regex.test(cleanUrl.replace(/^https?:\\/\\//i, ''))) {
          return { matched: true, reason: 'Entspricht Wildcard (ohne Protokoll): ' + rule.pattern };
        }
      } catch (err) {
        return { matched: false, reason: 'Wildcard-Fehler: ' + err.message };
      }
      return { matched: false };
    }
    case 'domain': {
      const targetDomain = rule.pattern.toLowerCase().replace(/^(https?:\\/\\/)?(www\\.)?/, '').replace(/\\/.*$/, '');
      if (parsedUrl) {
        const host = parsedUrl.hostname.toLowerCase();
        if (host === targetDomain) {
          return { matched: true, reason: 'Host ' + host + ' entspricht exakt der Domain ' + targetDomain };
        }
        if (host.endsWith('.' + targetDomain)) {
          return { matched: true, reason: 'Host ' + host + ' ist eine Subdomain von ' + targetDomain };
        }
      }
      if (!parsedUrl && cleanUrl.toLowerCase().replace(/^(https?:\\/\\/)?(www\\.)?/, '').startsWith(targetDomain)) {
        return { matched: true, reason: 'Host beginnt mit Domain ' + targetDomain };
      }
      return { matched: false };
    }
    case 'exact_host': {
      const targetHost = rule.pattern.toLowerCase().replace(/^(https?:\\/\\/)?(www\\.)?/, '').replace(/\\/.*$/, '');
      if (parsedUrl) {
        const host = parsedUrl.hostname.toLowerCase();
        if (host === targetHost) {
          return { matched: true, reason: 'Host ' + host + ' stimmt exakt überein (Subdomains isoliert)' };
        }
      } else {
        const rawHost = cleanUrl.replace(/^(https?:\\/\\/)?(www\\.)?/, '').replace(/\\/.*$/, '').toLowerCase();
        if (rawHost === targetHost) {
          return { matched: true, reason: 'Exakter Host-Treffer: ' + targetHost };
        }
      }
      return { matched: false };
    }
    case 'prefix': {
      const targetPrefix = rule.pattern.toLowerCase();
      if (cleanUrl.toLowerCase().startsWith(targetPrefix)) {
        return { matched: true, reason: 'URL beginnt mit Präfix: ' + rule.pattern };
      }
      if (parsedUrl && cleanUrl.replace(/^https?:\\/\\//i, '').toLowerCase().startsWith(targetPrefix.replace(/^https?:\\/\\//i, ''))) {
        return { matched: true, reason: 'URL (protokoll-unabhängig) beginnt mit Präfix: ' + rule.pattern };
      }
      return { matched: false };
    }
    case 'exact': {
      const normTarget = rule.pattern.replace(/\\/+$/, '').toLowerCase();
      const normUrl = cleanUrl.replace(/\\/+$/, '').toLowerCase();
      if (normTarget === normUrl) {
        return { matched: true, reason: 'Exakte URL-Übereinstimmung' };
      }
      return { matched: false };
    }
    case 'regex': {
      try {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(cleanUrl)) {
          return { matched: true, reason: 'Entspricht regulärem Ausdruck: /' + rule.pattern + '/i' };
        }
      } catch (err) {
        return { matched: false, reason: 'RegEx-Fehler: ' + err.message };
      }
      return { matched: false };
    }
    default:
      return { matched: false };
  }
}

function evaluateUrlMatcher(url) {
  const box = document.getElementById('matcher-result-box');
  if (!box) return;

  if (!url || !url.trim()) {
    box.innerHTML = '<div style="font-size:11px; color:#94a3b8;">Geben Sie eine URL oben ein oder klicken Sie auf eine der Beispiel-URLs.</div>';
    return;
  }

  const cleanUrl = url.trim();
  const sorted = [...(appConfig.rules || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  let matchedRule = null;
  let matchReason = '';

  for (const rule of sorted) {
    if (!rule.enabled) continue;
    const res = testRuleMatchDetailed(cleanUrl, rule);
    if (res.matched) {
      matchedRule = rule;
      matchReason = res.reason;
      break;
    }
  }

  if (!matchedRule) {
    const fallbackColor = appConfig.defaultColor || '#37adff';
    const fallbackContainer = appConfig.defaultContainerColor || 'blue';
    box.innerHTML = [
      '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">',
      '  <div style="display:flex; align-items:center; gap:10px;">',
      '    <div style="width:6px; height:36px; border-radius:3px; background:' + fallbackColor + ';"></div>',
      '    <div>',
      '      <div style="font-size:12px; font-weight:700; color:#f87171; display:flex; align-items:center; gap:6px;">',
      '        <span>⚠️ Keine Regel trifft zu</span>',
      '        <span style="font-size:10px; background:#334155; color:#cbd5e1; padding:1px 6px; border-radius:4px;">Standard-Fallback</span>',
      '      </div>',
      '      <div style="font-size:11px; color:#94a3b8; margin-top:2px;">',
      '        ' + escapeHtml(matchReason || 'Kein Muster passte auf die URL.') + ' Tab öffnet im Standard-Container: <strong>' + escapeHtml(fallbackContainer) + '</strong> (' + escapeHtml(fallbackColor) + ')',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <button type="button" id="btn-matcher-create-rule" class="btn btn-primary" style="font-size:11px; padding:5px 10px;">',
      '    ➕ Neue Regel für diese URL anlegen',
      '  </button>',
      '</div>'
    ].join('\\n');
    document.getElementById('btn-matcher-create-rule')?.addEventListener('click', () => {
      let host = cleanUrl;
      try {
        const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl);
        host = parsed.hostname;
      } catch (e) {}
      openRuleModal(-1);
      const inpPattern = document.getElementById('inp-pattern');
      const inpName = document.getElementById('inp-name');
      const inpType = document.getElementById('inp-type');
      if (inpPattern) inpPattern.value = host;
      if (inpName) inpName.value = host;
      if (inpType) inpType.value = 'domain';
      updateModalPreview();
    });
    return;
  }

  const hex = matchedRule.color || hexMap[matchedRule.firefoxContainerColor] || '#37adff';
  const emoji = matchedRule.customEmoji || '';
  const containerName = matchedRule.containerName || matchedRule.name || 'Container';
  const prio = matchedRule.priority || 1;

  box.innerHTML = [
    '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">',
    '  <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:280px;">',
    '    <div style="width:6px; height:42px; border-radius:3px; background:' + hex + '; box-shadow:0 0 8px ' + hex + '66;"></div>',
    '    <div>',
    '      <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">',
    '        <span style="font-size:12px; font-weight:700; color:#34d399;">✓ Regel #' + prio + ' trifft zu:</span>',
    '        <strong style="font-size:13px; color:#f8fafc;">' + escapeHtml(matchedRule.name) + '</strong>',
    emoji ? ('<span style="font-size:13px;">' + escapeHtml(emoji) + '</span>') : '',
    '        <span style="font-size:10px; font-family:monospace; background:#1e293b; color:#38bdf8; border:1px solid #334155; padding:1px 6px; border-radius:4px;">' + escapeHtml(matchedRule.patternType) + '</span>',
    '        <span style="font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; color:#fff; background:' + hex + ';">' + escapeHtml(matchedRule.firefoxContainerColor || 'blue') + '</span>',
    '      </div>',
    '      <div style="font-size:11px; color:#94a3b8; margin-top:3px;">',
    '        ' + escapeHtml(matchReason || '') + ' &bull; Container: <strong style="color:#e2e8f0;">' + escapeHtml(containerName) + '</strong>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div style="display:flex; align-items:center; gap:8px;">',
    '    <div style="background:#1e1e2e; padding:4px 8px 0 8px; border-radius:5px 5px 0 0; display:inline-flex;">',
    '      <div style="background:#2d2d3f; border-top:3px solid ' + hex + '; border-radius:5px 5px 0 0; padding:4px 8px; display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:#fff;">',
    '        <span>' + (emoji || '🌐') + '</span>',
    '        <span style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(matchedRule.name) + '</span>',
    '        <span style="background:' + hex + '33; border:1px solid ' + hex + '; color:' + hex + '; font-size:9px; padding:0 4px; border-radius:8px;">' + escapeHtml(containerName) + '</span>',
    '      </div>',
    '    </div>',
    '    <button type="button" id="btn-matcher-edit-rule" class="btn btn-secondary" style="font-size:11px; padding:5px 10px;">',
    '      ✏️ Regel bearbeiten',
    '    </button>',
    '  </div>',
    '</div>'
  ].join('\\n');

  document.getElementById('btn-matcher-edit-rule')?.addEventListener('click', () => {
    const idx = (appConfig.rules || []).findIndex(r => r.id === matchedRule.id);
    if (idx !== -1) {
      openRuleModal(idx);
    }
  });
}

function initLiveUrlMatcher() {
  const matcherInp = document.getElementById('matcher-url-input');
  if (matcherInp) {
    matcherInp.addEventListener('input', (e) => evaluateUrlMatcher(e.target.value));
    evaluateUrlMatcher(matcherInp.value);
  }
  document.getElementById('btn-matcher-eval')?.addEventListener('click', () => {
    if (matcherInp) evaluateUrlMatcher(matcherInp.value);
  });
  document.querySelectorAll('.matcher-sample-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const u = chip.getAttribute('data-url');
      if (matcherInp && u) {
        matcherInp.value = u;
        evaluateUrlMatcher(u);
      }
    });
  });
  document.getElementById('btn-matcher-current-tab')?.addEventListener('click', async () => {
    try {
      const allTabs = await browser.tabs.query({ active: true });
      const normalTab = allTabs.find(t => t.url && !t.url.startsWith('moz-extension:')) || allTabs[0];
      if (normalTab && normalTab.url && matcherInp) {
        matcherInp.value = normalTab.url;
        evaluateUrlMatcher(normalTab.url);
      }
    } catch (e) {}
  });
}

// -------------------------------------------------------------
// Rules Table, Filter/Search & Bulk Actions
// -------------------------------------------------------------
const selectedRuleIds = new Set();
let rulesFilterQuery = '';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let showOnlySelectedMode = false;

function getFilteredRules() {
  let list = appConfig.rules || [];
  if (showOnlySelectedMode) {
    list = list.filter((r) => selectedRuleIds.has(r.id));
  }
  const query = rulesFilterQuery.toLowerCase().trim();
  if (!query) return list;
  return list.filter((r) => {
    const name = (r.name || '').toLowerCase();
    const container = (r.containerName || '').toLowerCase();
    const pattern = (r.pattern || '').toLowerCase();
    const color = (r.firefoxContainerColor || '').toLowerCase();
    const type = (r.patternType || '').toLowerCase();
    return name.includes(query) || container.includes(query) || pattern.includes(query) || color.includes(query) || type.includes(query);
  });
}

function getEffectiveBulkTargetRules() {
  const visible = getFilteredRules();
  const isFiltered = !!rulesFilterQuery.trim() || showOnlySelectedMode;
  if (selectedRuleIds.size > 0) {
    return (appConfig.rules || []).filter((r) => selectedRuleIds.has(r.id));
  }
  return isFiltered ? visible : (appConfig.rules || []);
}

function renderRules() {
  const tbody = document.getElementById('rules-body');
  const countPill = document.getElementById('rules-count-pill');
  const filterBadge = document.getElementById('filter-result-badge');
  const btnSelectFiltered = document.getElementById('btn-select-filtered');
  const btnAddFiltered = document.getElementById('btn-add-filtered-to-selection');
  const btnOnlySelected = document.getElementById('btn-filter-only-selected');
  const btnClearFilter = document.getElementById('btn-rules-filter-clear');
  if (!tbody) return;

  tbody.textContent = '';
  const allRules = appConfig.rules || [];
  const visibleRules = getFilteredRules();
  const isFiltered = !!rulesFilterQuery.trim() || showOnlySelectedMode;

  if (countPill) {
    if (showOnlySelectedMode && rulesFilterQuery.trim()) {
      countPill.textContent = visibleRules.length + ' von ' + selectedRuleIds.size + ' ausgewählten (gefiltert)';
    } else if (showOnlySelectedMode) {
      countPill.textContent = visibleRules.length + ' von ' + selectedRuleIds.size + ' ausgewählten Regeln';
    } else if (isFiltered) {
      countPill.textContent = visibleRules.length + ' von ' + allRules.length + ' Regeln';
    } else {
      countPill.textContent = allRules.length + ' Regeln';
    }
  }

  if (filterBadge) {
    if (showOnlySelectedMode && rulesFilterQuery.trim()) {
      filterBadge.textContent = visibleRules.length + ' Treffer in ' + selectedRuleIds.size + ' Ausgewählten';
      filterBadge.style.color = '#38bdf8';
      filterBadge.style.borderColor = '#0284c7';
    } else if (showOnlySelectedMode) {
      filterBadge.textContent = '⭐ Filter: ' + visibleRules.length + ' Ausgewählte aktiv';
      filterBadge.style.color = '#fef08a';
      filterBadge.style.borderColor = '#eab308';
    } else if (isFiltered) {
      filterBadge.textContent = visibleRules.length + ' von ' + allRules.length + ' Treffern';
      filterBadge.style.color = '#38bdf8';
      filterBadge.style.borderColor = '#0284c7';
    } else {
      filterBadge.textContent = 'Alle ' + allRules.length + ' Regeln';
      filterBadge.style.color = '#94a3b8';
      filterBadge.style.borderColor = '#334155';
    }
  }

  // Button: Nur Ausgewählte anzeigen
  if (btnOnlySelected) {
    if (showOnlySelectedMode) {
      btnOnlySelected.style.background = '#0284c7';
      btnOnlySelected.style.borderColor = '#38bdf8';
      btnOnlySelected.style.color = '#ffffff';
      btnOnlySelected.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.4)';
      btnOnlySelected.innerHTML = '✓ Nur Ausgewählte (' + selectedRuleIds.size + ') <span style="font-size:10px; opacity:0.8; margin-left:4px;">[Alle zeigen]</span>';
    } else {
      btnOnlySelected.style.background = '#1e293b';
      btnOnlySelected.style.borderColor = '#334155';
      btnOnlySelected.style.color = selectedRuleIds.size > 0 ? '#fef08a' : '#cbd5e1';
      btnOnlySelected.style.boxShadow = 'none';
      btnOnlySelected.innerHTML = '⭐ Nur Ausgewählte anzeigen (<span id="only-selected-count">' + selectedRuleIds.size + '</span>)';
    }
  }

  // Button: Treffer zur Auswahl hinzufügen (kumulativ)
  if (btnAddFiltered) {
    const isSearchActive = !!rulesFilterQuery.trim();
    btnAddFiltered.style.display = (isSearchActive && visibleRules.length > 0) ? 'inline-block' : 'none';
    const allVisibleAlreadySelected = visibleRules.length > 0 && visibleRules.every((r) => selectedRuleIds.has(r.id));
    const unselectedCount = visibleRules.filter((r) => !selectedRuleIds.has(r.id)).length;
    if (allVisibleAlreadySelected) {
      btnAddFiltered.textContent = '✓ Alle ' + visibleRules.length + ' Treffer in Auswahl';
      btnAddFiltered.style.opacity = '0.7';
    } else {
      btnAddFiltered.textContent = '➕ +' + unselectedCount + ' Treffer zur Auswahl hinzufügen';
      btnAddFiltered.style.opacity = '1';
    }
  }

  // Button: Nur diese Treffer auswählen (exklusiv)
  if (btnSelectFiltered) {
    const isSearchActive = !!rulesFilterQuery.trim();
    btnSelectFiltered.style.display = (isSearchActive && visibleRules.length > 0) ? 'inline-block' : 'none';
    btnSelectFiltered.textContent = '☑️ Nur diese ' + visibleRules.length + ' Treffer';
  }

  if (btnClearFilter) {
    btnClearFilter.style.display = rulesFilterQuery.trim() ? 'inline' : 'none';
  }

  if (visibleRules.length === 0) {
    const emptyTr = document.createElement('tr');
    const emptyTd = document.createElement('td');
    emptyTd.colSpan = 9;
    emptyTd.style.textAlign = 'center';
    emptyTd.style.padding = '36px';
    emptyTd.style.color = '#64748b';
    if (showOnlySelectedMode) {
      emptyTd.innerHTML = 'Aktuell sind keine Regeln als ausgewählt markiert.<br><button type="button" id="btn-empty-clear-selected-filter" class="btn btn-primary" style="margin-top:10px; font-size:11px;">Alle ' + allRules.length + ' Regeln anzeigen</button>';
      setTimeout(() => {
        document.getElementById('btn-empty-clear-selected-filter')?.addEventListener('click', () => {
          showOnlySelectedMode = false;
          renderRules();
          updateBulkToolbar();
        });
      }, 0);
    } else if (isFiltered) {
      emptyTd.innerHTML = 'Keine Regeln passend zu <strong>"' + escapeHtml(rulesFilterQuery) + '"</strong> gefunden.<br><button type="button" id="btn-empty-clear-filter" class="btn btn-secondary" style="margin-top:10px; font-size:11px;">Filter zurücksetzen</button>';
      setTimeout(() => {
        document.getElementById('btn-empty-clear-filter')?.addEventListener('click', () => {
          const inp = document.getElementById('rules-filter-input');
          if (inp) inp.value = '';
          rulesFilterQuery = '';
          renderRules();
        });
      }, 0);
    } else {
      emptyTd.textContent = 'Keine Regeln konfiguriert. Klicken Sie auf "+ Neue Regel erstellen", um eine hinzuzufügen.';
    }
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    updateBulkToolbar();
    return;
  }

  visibleRules.forEach((rule, visibleIdx) => {
    const globalIdx = (appConfig.rules || []).findIndex((r) => r.id === rule.id);
    const tr = document.createElement('tr');
    const isSelected = selectedRuleIds.has(rule.id);
    if (isSelected) {
      tr.classList.add('selected-row');
    }

    // 0. Selection Checkbox
    const tdCheck = document.createElement('td');
    tdCheck.style.textAlign = 'center';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = isSelected;
    chk.addEventListener('click', (e) => e.stopPropagation());
    chk.addEventListener('change', () => {
      if (chk.checked) {
        selectedRuleIds.add(rule.id);
      } else {
        selectedRuleIds.delete(rule.id);
      }
      updateBulkToolbar();
      renderRules();
    });
    tdCheck.appendChild(chk);
    tr.appendChild(tdCheck);

    // 1. Priority
    const tdPriority = document.createElement('td');
    const pContainer = document.createElement('div');
    pContainer.style.display = 'flex';
    pContainer.style.alignItems = 'center';
    pContainer.style.gap = '4px';

    const pNum = document.createElement('span');
    pNum.style.fontFamily = 'monospace';
    pNum.style.color = '#94a3b8';
    pNum.style.marginRight = '4px';
    pNum.textContent = String(rule.priority || (globalIdx + 1));
    pContainer.appendChild(pNum);

    if (globalIdx > 0) {
      const upBtn = document.createElement('button');
      upBtn.className = 'priority-btn';
      upBtn.textContent = '▲';
      upBtn.title = 'Nach oben';
      upBtn.addEventListener('click', async () => {
        const curIdx = (appConfig.rules || []).findIndex((r) => r.id === rule.id);
        if (curIdx > 0) {
          const temp = appConfig.rules[curIdx];
          appConfig.rules[curIdx] = appConfig.rules[curIdx - 1];
          appConfig.rules[curIdx - 1] = temp;
          appConfig.rules.forEach((r, i) => r.priority = i + 1);
          await saveConfigToStorage();
          renderRules();
        }
      });
      pContainer.appendChild(upBtn);
    }

    if (globalIdx !== -1 && globalIdx < (appConfig.rules?.length || 0) - 1) {
      const downBtn = document.createElement('button');
      downBtn.className = 'priority-btn';
      downBtn.textContent = '▼';
      downBtn.title = 'Nach unten';
      downBtn.addEventListener('click', async () => {
        const curIdx = (appConfig.rules || []).findIndex((r) => r.id === rule.id);
        if (curIdx !== -1 && curIdx < (appConfig.rules?.length || 0) - 1) {
          const temp = appConfig.rules[curIdx];
          appConfig.rules[curIdx] = appConfig.rules[curIdx + 1];
          appConfig.rules[curIdx + 1] = temp;
          appConfig.rules.forEach((r, i) => r.priority = i + 1);
          await saveConfigToStorage();
          renderRules();
        }
      });
      pContainer.appendChild(downBtn);
    }

    tdPriority.appendChild(pContainer);
    tr.appendChild(tdPriority);

    // 2. Color
    const tdColor = document.createElement('td');
    const swatch = document.createElement('span');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = rule.color || '#37adff';
    tdColor.appendChild(swatch);
    tdColor.appendChild(document.createTextNode(rule.firefoxContainerColor || 'blue'));
    tr.appendChild(tdColor);

    // 3. Name & Symbol
    const tdName = document.createElement('td');
    tdName.style.fontWeight = '600';
    tdName.style.cursor = 'pointer';
    tdName.addEventListener('click', () => {
      const curIdx = (appConfig.rules || []).findIndex((r) => r.id === rule.id);
      if (curIdx !== -1) openRuleModal(curIdx);
    });

    if (rule.customEmoji) {
      const symSpan = document.createElement('span');
      symSpan.style.marginRight = '6px';
      symSpan.textContent = rule.customEmoji;
      tdName.appendChild(symSpan);
    }
    tdName.appendChild(document.createTextNode(rule.name || rule.pattern));

    if (rule.customEmoji) {
      if (rule.enableFaviconEmoji !== false) {
        const fBadge = document.createElement('span');
        fBadge.className = 'badge-sym';
        fBadge.textContent = 'Favicon';
        tdName.appendChild(fBadge);
      }
      if (rule.enableTitleEmoji !== false) {
        const tBadge = document.createElement('span');
        tBadge.className = 'badge-sym';
        tBadge.style.backgroundColor = '#d97706';
        tBadge.textContent = 'Titel';
        tdName.appendChild(tBadge);
      }
    }
    tr.appendChild(tdName);

    // 4. Match type
    const tdType = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = rule.patternType || 'domain';
    tdType.appendChild(badge);
    tr.appendChild(tdType);

    // 5. Pattern
    const tdPattern = document.createElement('td');
    const code = document.createElement('code');
    code.className = 'pattern-code';
    code.textContent = rule.pattern || '';
    tdPattern.appendChild(code);

    const dupIdx = (appConfig.rules || []).findIndex(
      (r, rIdx) => rIdx < globalIdx && r.patternType === rule.patternType && (r.pattern || '').trim().toLowerCase() === (rule.pattern || '').trim().toLowerCase()
    );
    if (dupIdx >= 0) {
      const warn = document.createElement('span');
      warn.style.marginLeft = '6px';
      warn.style.fontSize = '10px';
      warn.style.color = '#f59e0b';
      warn.style.background = 'rgba(245, 158, 11, 0.15)';
      warn.style.padding = '1px 5px';
      warn.style.borderRadius = '3px';
      warn.textContent = '⚠️ Doppelt (Regel #' + (dupIdx + 1) + ' greift zuerst)';
      warn.title = 'Regel #' + (dupIdx + 1) + ' hat Vorrang, da sie weiter oben steht.';
      tdPattern.appendChild(warn);
    }
    tr.appendChild(tdPattern);

    // 6. Container
    const tdContainer = document.createElement('td');
    const iconSym = iconSymbols[rule.firefoxContainerIcon || 'circle'] || '●';
    tdContainer.textContent = iconSym + ' ' + (rule.containerName || '-');
    tr.appendChild(tdContainer);

    // 7. Status
    const tdStatus = document.createElement('td');
    const statusBtn = document.createElement('span');
    statusBtn.style.cursor = 'pointer';
    if (rule.enabled) {
      statusBtn.style.color = '#10b981';
      statusBtn.textContent = '● Aktiv';
    } else {
      statusBtn.style.color = '#64748b';
      statusBtn.textContent = '○ Deaktiviert';
    }
    statusBtn.addEventListener('click', async () => {
      rule.enabled = !rule.enabled;
      await saveConfigToStorage();
      renderRules();
    });
    tdStatus.appendChild(statusBtn);
    tr.appendChild(tdStatus);

    // 8. Actions
    const tdAction = document.createElement('td');
    tdAction.className = 'btn-cell';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => {
      const curIdx = (appConfig.rules || []).findIndex((r) => r.id === rule.id);
      if (curIdx !== -1) openRuleModal(curIdx);
    });
    tdAction.appendChild(editBtn);

    const dupBtn = document.createElement('button');
    dupBtn.className = 'priority-btn';
    dupBtn.textContent = '📋';
    dupBtn.title = 'Regel als Vorlage duplizieren';
    dupBtn.addEventListener('click', async () => {
      const copy = JSON.parse(JSON.stringify(rule));
      copy.id = 'rule-' + Date.now();
      copy.name = (rule.name || rule.pattern) + ' (Kopie)';
      copy.priority = (appConfig.rules || []).length + 1;
      appConfig.rules.push(copy);
      await saveConfigToStorage();
      renderRules();
      openRuleModal(appConfig.rules.length - 1);
    });
    tdAction.appendChild(dupBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = 'Löschen';
    delBtn.addEventListener('click', async () => {
      if (confirm('Regel "' + (rule.name || rule.pattern) + '" wirklich löschen?')) {
        const curIdx = (appConfig.rules || []).findIndex((r) => r.id === rule.id);
        if (curIdx !== -1) {
          appConfig.rules.splice(curIdx, 1);
          appConfig.rules.forEach((r, i) => r.priority = i + 1);
          selectedRuleIds.delete(rule.id);
          await saveConfigToStorage();
          renderRules();
        }
      }
    });
    tdAction.appendChild(delBtn);

    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });

  updateBulkToolbar();
}

function updateBulkToolbar() {
  const card = document.getElementById('card-bulk');
  const countBadge = document.getElementById('bulk-count-badge');
  const statsText = document.getElementById('bulk-stats-text');
  const exportCount = document.getElementById('bulk-export-count');
  const deleteCount = document.getElementById('bulk-delete-count');
  const masterChk = document.getElementById('chk-all-rules');
  const hint = document.getElementById('bulk-hint');
  const openModalBtn = document.getElementById('btn-open-bulk-edit');
  const btnSelectAll = document.getElementById('btn-bulk-select-all');
  const btnSelectAllGlobal = document.getElementById('btn-bulk-select-all-global');
  const btnRestrictFiltered = document.getElementById('btn-bulk-restrict-to-filter');
  if (!card) return;

  const allRules = appConfig.rules || [];
  const visible = getFilteredRules();
  const isFiltered = !!rulesFilterQuery.trim();

  const visibleSelectedCount = visible.filter((r) => selectedRuleIds.has(r.id)).length;
  const hiddenSelectedCount = selectedRuleIds.size - visibleSelectedCount;
  const totalSelectedCount = selectedRuleIds.size;

  if (masterChk) {
    if (visible.length === 0 || visibleSelectedCount === 0) {
      masterChk.checked = false;
      masterChk.indeterminate = false;
    } else if (visibleSelectedCount === visible.length) {
      masterChk.checked = true;
      masterChk.indeterminate = false;
    } else {
      masterChk.checked = false;
      masterChk.indeterminate = true;
    }
  }

  // Dynamic button labels
  if (btnSelectAll) {
    if (isFiltered) {
      btnSelectAll.textContent = (visibleSelectedCount === visible.length && hiddenSelectedCount === 0)
        ? '✓ Alle ' + visible.length + ' Treffer gewählt'
        : '☑️ Alle ' + visible.length + ' Treffer auswählen';
      btnSelectAll.title = 'Beschränkt die Auswahl strikt auf die ' + visible.length + ' gefilterten Treffer';
    } else {
      btnSelectAll.textContent = '☑️ Alle auswählen';
      btnSelectAll.title = 'Wählt alle ' + allRules.length + ' Regeln aus';
    }
  }

  if (btnSelectAllGlobal) {
    btnSelectAllGlobal.style.display = (isFiltered && visible.length < allRules.length) ? 'inline-block' : 'none';
    btnSelectAllGlobal.textContent = '🌐 Alle ' + allRules.length + ' (global)';
  }

  if (btnRestrictFiltered) {
    btnRestrictFiltered.style.display = (isFiltered && hiddenSelectedCount > 0) ? 'inline-block' : 'none';
    btnRestrictFiltered.textContent = '🎯 Nur die ' + visibleSelectedCount + ' Treffer (' + hiddenSelectedCount + ' abwählen)';
  }

  const btnBulkFilterSelected = document.getElementById('btn-bulk-filter-selected');
  if (btnBulkFilterSelected) {
    if (showOnlySelectedMode) {
      btnBulkFilterSelected.textContent = '🌐 Alle Regeln anzeigen';
      btnBulkFilterSelected.style.background = '#0284c7';
      btnBulkFilterSelected.style.borderColor = '#38bdf8';
      btnBulkFilterSelected.style.color = '#ffffff';
    } else {
      btnBulkFilterSelected.textContent = '⭐ Auf Ausgewählte filtern (' + totalSelectedCount + ')';
      btnBulkFilterSelected.style.background = '#854d0e';
      btnBulkFilterSelected.style.borderColor = '#ca8a04';
      btnBulkFilterSelected.style.color = '#fef08a';
    }
    btnBulkFilterSelected.style.display = totalSelectedCount > 0 ? 'inline-block' : 'none';
  }

  const btnSelectFiltered = document.getElementById('btn-select-filtered');
  if (btnSelectFiltered) {
    btnSelectFiltered.style.display = (isFiltered && visible.length > 0) ? 'inline-block' : 'none';
    btnSelectFiltered.textContent = (visibleSelectedCount === visible.length && hiddenSelectedCount === 0)
      ? '✓ ' + visible.length + ' Treffer ausgewählt'
      : '☑️ ' + visible.length + ' Treffer auswählen';
  }

  if (countBadge) {
    if (isFiltered) {
      if (hiddenSelectedCount > 0) {
        countBadge.textContent = totalSelectedCount + ' ausgewählt (' + visibleSelectedCount + ' Treffer + ' + hiddenSelectedCount + ' außerhalb)';
        countBadge.style.background = '#d97706';
      } else {
        countBadge.textContent = visibleSelectedCount + ' von ' + visible.length + ' Treffern ausgewählt';
        countBadge.style.background = visibleSelectedCount > 0 ? '#0284c7' : '#334155';
      }
    } else {
      countBadge.textContent = totalSelectedCount + ' von ' + allRules.length + ' ' + (totalSelectedCount === 1 ? 'Regel ausgewählt' : 'Regeln ausgewählt');
      countBadge.style.background = totalSelectedCount > 0 ? '#0284c7' : '#334155';
    }
  }

  if (exportCount) exportCount.textContent = String(totalSelectedCount);
  if (deleteCount) deleteCount.textContent = String(totalSelectedCount);
  if (openModalBtn) {
    openModalBtn.textContent = totalSelectedCount > 0 ? '✏️ Massenbearbeitung (' + totalSelectedCount + ')...' : '✏️ Massenbearbeitung...';
  }

  let activeCount = 0;
  allRules.forEach((r) => {
    if (selectedRuleIds.has(r.id) && r.enabled) activeCount++;
  });
  const inactiveCount = totalSelectedCount - activeCount;
  if (statsText) {
    statsText.textContent = activeCount + ' aktiv · ' + inactiveCount + ' inaktiv';
  }

  if (hint) {
    if (isFiltered && hiddenSelectedCount > 0) {
      hint.innerHTML = '<span style="color:#f59e0b; font-weight:700;">⚠️ Hinweis:</span> Es sind noch <strong>' + hiddenSelectedCount + ' Regeln außerhalb des Filters</strong> markiert. Klicken Sie auf <strong>"🎯 Nur Treffer"</strong>, um Aktionen auf die ' + visible.length + ' Suchtreffer zu beschränken.';
    } else if (totalSelectedCount > 0) {
      hint.innerHTML = '<span style="color:#38bdf8; font-weight:700;">✓ ' + totalSelectedCount + ' ' + (totalSelectedCount === 1 ? 'Regel ausgewählt.' : 'Regeln ausgewählt.') + '</span> Klicken Sie auf <strong>"Massenbearbeitung"</strong>, <strong>"Farb-Sync"</strong> oder eine der Schnellaktionen oben.';
    } else {
      hint.textContent = '💡 Markieren Sie Regeln in der Tabelle über die Checkboxen links für gemeinsame Massenbearbeitung, Status-Änderungen oder Farb-Sync.';
    }
  }
}

function closeBulkPopovers() {
  const cPop = document.getElementById('bulk-color-popover');
  const iPop = document.getElementById('bulk-icon-popover');
  if (cPop) cPop.style.display = 'none';
  if (iPop) iPop.style.display = 'none';
}

const BULK_CONTAINER_COLORS = [
  { id: 'blue', name: 'Blau', hex: '#37adff' },
  { id: 'turquoise', name: 'Türkis', hex: '#00c79a' },
  { id: 'green', name: 'Grün', hex: '#51cf66' },
  { id: 'yellow', name: 'Gelb', hex: '#ffcb00' },
  { id: 'orange', name: 'Orange', hex: '#ff9400' },
  { id: 'red', name: 'Rot', hex: '#ff4f5e' },
  { id: 'pink', name: 'Pink', hex: '#ff4ba0' },
  { id: 'purple', name: 'Lila', hex: '#9059ff' },
];

const BULK_CONTAINER_ICONS = [
  { id: 'circle', sym: '●', label: 'Circle' },
  { id: 'briefcase', sym: '💼', label: 'Briefcase' },
  { id: 'fingerprint', sym: '🔒', label: 'Security' },
  { id: 'dollar', sym: '💰', label: 'Finance' },
  { id: 'cart', sym: '🛒', label: 'Shopping' },
  { id: 'tree', sym: '🌲', label: 'Dev' },
  { id: 'chill', sym: '☕', label: 'Chill' },
  { id: 'vacation', sym: '🏖️', label: 'Vacation' },
  { id: 'food', sym: '🍔', label: 'Food' },
  { id: 'fruit', sym: '🍎', label: 'Fruit' },
  { id: 'pet', sym: '🐾', label: 'Pet' },
  { id: 'gift', sym: '🎁', label: 'Gift' }
];

const BULK_QUICK_EMOJIS = ['📦', '⚡', '🚀', '🔒', '🌐', '🧪', '🛒', '💼', '🛠️', '🎯', '⭐', '🔥'];

let selectedBulkModalColor = 'blue';
let selectedBulkModalHex = '#37adff';

function openBulkEditModal() {
  const allRules = appConfig.rules || [];
  const visible = getFilteredRules();
  const isFiltered = !!rulesFilterQuery.trim();

  if (selectedRuleIds.size === 0) {
    if (visible.length === 0) {
      alert('Es sind keine Regeln passend zum aktuellen Filter vorhanden.');
      return;
    }
    // Automatically select visible rules if none were explicitly checked
    (isFiltered ? visible : allRules).forEach((r) => selectedRuleIds.add(r.id));
    updateBulkToolbar();
    renderRules();
  }

  const count = selectedRuleIds.size;
  const overlay = document.getElementById('bulk-edit-modal-overlay');
  const title = document.getElementById('bulk-edit-title');
  if (title) {
    const visibleSelectedCount = visible.filter((r) => selectedRuleIds.has(r.id)).length;
    const hiddenSelectedCount = selectedRuleIds.size - visibleSelectedCount;
    if (isFiltered && hiddenSelectedCount > 0) {
      title.textContent = '✏️ Massenbearbeitung (' + count + ' Regeln: ' + visibleSelectedCount + ' Treffer + ' + hiddenSelectedCount + ' außerhalb)';
    } else {
      title.textContent = '✏️ Massenbearbeitung (' + count + ' ' + (count === 1 ? 'Regel' : 'Regeln') + ')';
    }
  }

  // Reset form controls
  const statusSel = document.getElementById('be-status');
  if (statusSel) statusSel.value = 'keep';
  const modeSel = document.getElementById('be-mode');
  if (modeSel) modeSel.value = 'keep';
  const topbarSel = document.getElementById('be-topbar');
  if (topbarSel) topbarSel.value = 'keep';
  const haloSel = document.getElementById('be-halo');
  if (haloSel) haloSel.value = 'keep';

  const chkColor = document.getElementById('be-apply-color');
  if (chkColor) chkColor.checked = false;
  const colCtrl = document.getElementById('be-color-controls');
  if (colCtrl) colCtrl.style.display = 'none';

  const chkIcon = document.getElementById('be-apply-icon');
  if (chkIcon) chkIcon.checked = false;
  const iconCtrl = document.getElementById('be-icon-controls');
  if (iconCtrl) iconCtrl.style.display = 'none';

  const chkEmoji = document.getElementById('be-apply-emoji');
  if (chkEmoji) chkEmoji.checked = false;
  const emojiCtrl = document.getElementById('be-emoji-controls');
  if (emojiCtrl) emojiCtrl.style.display = 'none';
  const emojiInp = document.getElementById('be-emoji-input');
  if (emojiInp) emojiInp.value = '';

  overlay?.classList.add('active');
}

function closeBulkEditModal() {
  document.getElementById('bulk-edit-modal-overlay')?.classList.remove('active');
}

let isBulkToolbarInitialized = false;

function initBulkToolbar() {
  if (isBulkToolbarInitialized) return;
  isBulkToolbarInitialized = true;

  // Swatch list in Farb-Sync dropdown
  const swatchList = document.getElementById('bulk-swatch-list');
  if (swatchList && swatchList.children.length === 0) {
    BULK_CONTAINER_COLORS.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.style.fontSize = '11px';
      btn.style.padding = '5px 8px';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '6px';
      btn.style.justifyContent = 'flex-start';

      const dot = document.createElement('span');
      dot.style.width = '12px';
      dot.style.height = '12px';
      dot.style.borderRadius = '50%';
      dot.style.backgroundColor = opt.hex;
      dot.style.flexShrink = '0';
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(opt.name));

      btn.addEventListener('click', async () => {
        const targetRules = getEffectiveBulkTargetRules();
        targetRules.forEach((r) => {
          r.color = opt.hex;
          r.firefoxContainerColor = opt.id;
        });
        await saveConfigToStorage();
        closeBulkPopovers();
        renderRules();
      });
      swatchList.appendChild(btn);
    });
  }

  // Icon list in Icon-Sync dropdown
  const iconList = document.getElementById('bulk-icon-list');
  if (iconList && iconList.children.length === 0) {
    BULK_CONTAINER_ICONS.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-btn';
      btn.style.padding = '4px 2px';
      btn.title = opt.label;

      const sym = document.createElement('span');
      sym.className = 'icon-sym';
      sym.textContent = opt.sym;
      btn.appendChild(sym);

      const lbl = document.createElement('span');
      lbl.className = 'icon-lbl';
      lbl.textContent = opt.label;
      btn.appendChild(lbl);

      btn.addEventListener('click', async () => {
        const targetRules = getEffectiveBulkTargetRules();
        targetRules.forEach((r) => {
          r.firefoxContainerIcon = opt.id;
        });
        await saveConfigToStorage();
        closeBulkPopovers();
        renderRules();
      });
      iconList.appendChild(btn);
    });
  }

  // Emoji list in Icon-Sync dropdown
  const emojiList = document.getElementById('bulk-emoji-quick-list');
  if (emojiList && emojiList.children.length === 0) {
    BULK_QUICK_EMOJIS.forEach((em) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.style.padding = '3px 6px';
      btn.style.fontSize = '13px';
      btn.textContent = em;
      btn.addEventListener('click', async () => {
        const targetRules = getEffectiveBulkTargetRules();
        targetRules.forEach((r) => {
          let clean = r.containerName || '';
          if (r.customEmoji && clean.startsWith(r.customEmoji)) {
            clean = clean.slice(r.customEmoji.length).trim();
          }
          r.customEmoji = em;
          r.containerName = em + ' ' + clean;
        });
        await saveConfigToStorage();
        closeBulkPopovers();
        renderRules();
      });
      emojiList.appendChild(btn);
    });
  }

  // Quick emojis in Bulk Edit Modal
  const beEmojiList = document.getElementById('be-quick-emojis');
  if (beEmojiList && beEmojiList.children.length === 0) {
    BULK_QUICK_EMOJIS.forEach((em) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.style.padding = '3px 6px';
      btn.style.fontSize = '13px';
      btn.textContent = em;
      btn.addEventListener('click', () => {
        const inp = document.getElementById('be-emoji-input');
        if (inp) inp.value = em;
      });
      beEmojiList.appendChild(btn);
    });
  }

  // Swatch grid in Bulk Edit Modal
  document.querySelectorAll('#be-color-grid .swatch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#be-color-grid .swatch-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedBulkModalColor = btn.getAttribute('data-color') || 'blue';
      selectedBulkModalHex = btn.getAttribute('data-hex') || '#37adff';
      const beHex = document.getElementById('be-hex');
      const bePicker = document.getElementById('be-picker');
      if (beHex) beHex.value = selectedBulkModalHex;
      if (bePicker) bePicker.value = selectedBulkModalHex;
    });
  });

  const bePicker = document.getElementById('be-picker');
  const beHex = document.getElementById('be-hex');
  if (bePicker && beHex) {
    bePicker.addEventListener('input', () => {
      beHex.value = bePicker.value;
      selectedBulkModalHex = bePicker.value;
    });
    beHex.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(beHex.value)) {
        bePicker.value = beHex.value;
        selectedBulkModalHex = beHex.value;
      }
    });
  }

  // Toggle controls inside Bulk Edit Modal
  document.getElementById('be-apply-color')?.addEventListener('change', (e) => {
    const el = document.getElementById('be-color-controls');
    if (el) el.style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('be-apply-icon')?.addEventListener('change', (e) => {
    const el = document.getElementById('be-icon-controls');
    if (el) el.style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('be-apply-emoji')?.addEventListener('change', (e) => {
    const el = document.getElementById('be-emoji-controls');
    if (el) el.style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('btn-be-emoji-empty')?.addEventListener('click', () => {
    const inp = document.getElementById('be-emoji-input');
    if (inp) inp.value = '';
  });

  // Open & Close Bulk Edit Modal
  document.getElementById('btn-open-bulk-edit')?.addEventListener('click', openBulkEditModal);
  document.getElementById('btn-quick-bulk')?.addEventListener('click', openBulkEditModal);
  document.getElementById('bulk-edit-close')?.addEventListener('click', closeBulkEditModal);
  document.getElementById('bulk-edit-cancel')?.addEventListener('click', closeBulkEditModal);

  // Apply Bulk Edit Modal changes
  document.getElementById('bulk-edit-apply')?.addEventListener('click', async () => {
    const count = selectedRuleIds.size;
    if (count === 0) {
      alert('Keine Regeln ausgewählt.');
      return;
    }

    const beStatus = document.getElementById('be-status')?.value;
    const applyColor = document.getElementById('be-apply-color')?.checked;
    const applyIcon = document.getElementById('be-apply-icon')?.checked;
    const applyEmoji = document.getElementById('be-apply-emoji')?.checked;
    const beMode = document.getElementById('be-mode')?.value;
    const beTopbar = document.getElementById('be-topbar')?.value;

    const newColorHex = document.getElementById('be-hex')?.value || selectedBulkModalHex || '#37adff';
    const newColorId = selectedBulkModalColor || 'blue';
    const newIconId = document.getElementById('be-icon-select')?.value || 'circle';
    const newEmoji = (document.getElementById('be-emoji-input')?.value || '').trim();

    (appConfig.rules || []).forEach((r) => {
      if (selectedRuleIds.has(r.id)) {
        if (beStatus === 'enable') r.enabled = true;
        if (beStatus === 'disable') r.enabled = false;
        if (beStatus === 'toggle') r.enabled = !r.enabled;

        if (applyColor) {
          r.color = newColorHex;
          r.firefoxContainerColor = newColorId;
        }

        if (applyIcon) {
          r.firefoxContainerIcon = newIconId;
        }

        if (applyEmoji) {
          let clean = r.containerName || '';
          if (r.customEmoji && clean.startsWith(r.customEmoji)) {
            clean = clean.slice(r.customEmoji.length).trim();
          }
          r.customEmoji = newEmoji;
          r.containerName = newEmoji ? newEmoji + ' ' + clean : clean;
        }

        if (beMode && beMode !== 'keep') {
          r.colorMode = beMode;
        }

        if (beTopbar && beTopbar !== 'keep') {
          r.accentBorder = beTopbar === 'enable';
        }

        const beHalo = document.getElementById('be-halo')?.value;
        if (beHalo && beHalo !== 'keep') {
          r.enableFaviconHalo = beHalo === 'enable';
        }
      }
    });

    await saveConfigToStorage();
    closeBulkEditModal();
    renderRules();
    alert('✓ Massenbearbeitung erfolgreich auf ' + count + ' ' + (count === 1 ? 'Regel' : 'Regeln') + ' angewendet!');
  });

  // Farb-Sync dropdown toggle
  document.getElementById('btn-bulk-colorsync-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const cPop = document.getElementById('bulk-color-popover');
    const iPop = document.getElementById('bulk-icon-popover');
    if (iPop) iPop.style.display = 'none';
    if (cPop) {
      cPop.style.display = cPop.style.display === 'block' ? 'none' : 'block';
    }
  });

  // Icon-Sync dropdown toggle
  document.getElementById('btn-bulk-iconsync-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const cPop = document.getElementById('bulk-color-popover');
    const iPop = document.getElementById('bulk-icon-popover');
    if (cPop) cPop.style.display = 'none';
    if (iPop) {
      iPop.style.display = iPop.style.display === 'block' ? 'none' : 'block';
    }
  });

  const cInp = document.getElementById('bulk-color-input');
  const hInp = document.getElementById('bulk-hex-input');
  if (cInp && hInp) {
    cInp.addEventListener('input', () => { hInp.value = cInp.value; });
    hInp.addEventListener('input', () => { if (/^#[0-9A-Fa-f]{6}$/.test(hInp.value)) cInp.value = hInp.value; });
  }

  document.getElementById('btn-bulk-hex-apply')?.addEventListener('click', async () => {
    const hex = document.getElementById('bulk-hex-input')?.value || '#37adff';
    const targetRules = getEffectiveBulkTargetRules();
    targetRules.forEach((r) => {
      r.color = hex;
    });
    await saveConfigToStorage();
    closeBulkPopovers();
    renderRules();
  });

  document.getElementById('btn-bulk-emoji-apply')?.addEventListener('click', async () => {
    const em = (document.getElementById('bulk-emoji-input')?.value || '').trim();
    if (!em) return;
    const targetRules = getEffectiveBulkTargetRules();
    targetRules.forEach((r) => {
      let clean = r.containerName || '';
      if (r.customEmoji && clean.startsWith(r.customEmoji)) {
        clean = clean.slice(r.customEmoji.length).trim();
      }
      r.customEmoji = em;
      r.containerName = em + ' ' + clean;
    });
    await saveConfigToStorage();
    closeBulkPopovers();
    renderRules();
  });

  document.getElementById('btn-bulk-emoji-clear')?.addEventListener('click', async () => {
    const targetRules = getEffectiveBulkTargetRules();
    targetRules.forEach((r) => {
      let clean = r.containerName || '';
      if (r.customEmoji && clean.startsWith(r.customEmoji)) {
        clean = clean.slice(r.customEmoji.length).trim();
      }
      r.customEmoji = '';
      r.containerName = clean;
    });
    await saveConfigToStorage();
    closeBulkPopovers();
    renderRules();
  });

  // Master Checkbox (Table Header)
  document.getElementById('chk-all-rules')?.addEventListener('change', () => {
    const visible = getFilteredRules();
    const allVisibleSelected = visible.length > 0 && visible.every((r) => selectedRuleIds.has(r.id));
    if (allVisibleSelected) {
      // Deselect only the visible rules
      visible.forEach((r) => selectedRuleIds.delete(r.id));
    } else {
      // Add visible rules to selection without wiping selections from previous searches!
      visible.forEach((r) => selectedRuleIds.add(r.id));
    }
    updateBulkToolbar();
    renderRules();
  });

  // Select all & clear buttons
  document.getElementById('btn-bulk-select-all')?.addEventListener('click', () => {
    const visible = getFilteredRules();
    const isFiltered = !!rulesFilterQuery.trim() || showOnlySelectedMode;
    if (isFiltered) {
      // Add all visible filtered rules to selection without wiping previous selections!
      visible.forEach((r) => selectedRuleIds.add(r.id));
    } else {
      (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
    }
    updateBulkToolbar();
    renderRules();
  });

  document.getElementById('btn-bulk-filter-selected')?.addEventListener('click', () => {
    showOnlySelectedMode = !showOnlySelectedMode;
    renderRules();
    updateBulkToolbar();
  });

  document.getElementById('btn-select-filtered')?.addEventListener('click', () => {
    const visible = getFilteredRules();
    // Click on "Nur diese Treffer": clear non-matching rules and select ONLY the filtered hits!
    selectedRuleIds.clear();
    visible.forEach((r) => selectedRuleIds.add(r.id));
    updateBulkToolbar();
    renderRules();
  });

  document.getElementById('btn-add-filtered-to-selection')?.addEventListener('click', () => {
    const visible = getFilteredRules();
    // Add current matches to selection without clearing previous ones (kumulative Auswahl)!
    visible.forEach((r) => selectedRuleIds.add(r.id));
    updateBulkToolbar();
    renderRules();
  });

  document.getElementById('btn-filter-only-selected')?.addEventListener('click', () => {
    if (selectedRuleIds.size === 0 && !showOnlySelectedMode) {
      alert('Es sind aktuell keine Regeln ausgewählt. Markieren Sie zuerst einige Regeln über die Suchfilter oder Checkboxen, um danach nur diese anzuzeigen.');
      return;
    }
    showOnlySelectedMode = !showOnlySelectedMode;
    renderRules();
    updateBulkToolbar();
  });

  document.getElementById('btn-bulk-restrict-to-filter')?.addEventListener('click', () => {
    const visible = getFilteredRules();
    selectedRuleIds.clear();
    visible.forEach((r) => selectedRuleIds.add(r.id));
    updateBulkToolbar();
    renderRules();
  });

  document.getElementById('btn-bulk-select-all-global')?.addEventListener('click', () => {
    (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
    updateBulkToolbar();
    renderRules();
  });

  // Filter input and clear listeners
  document.getElementById('rules-filter-input')?.addEventListener('input', (e) => {
    const prevQuery = rulesFilterQuery;
    rulesFilterQuery = e.target.value.trim();
    const allRules = appConfig.rules || [];
    // If all rules were previously selected and the user begins filtering,
    // automatically restrict selection to the filtered matches!
    if (!prevQuery && rulesFilterQuery && selectedRuleIds.size === allRules.length) {
      const visible = getFilteredRules();
      selectedRuleIds.clear();
      visible.forEach((r) => selectedRuleIds.add(r.id));
    }
    renderRules();
  });

  document.getElementById('btn-rules-filter-clear')?.addEventListener('click', () => {
    const inp = document.getElementById('rules-filter-input');
    if (inp) inp.value = '';
    rulesFilterQuery = '';
    renderRules();
  });

  document.getElementById('btn-bulk-clear')?.addEventListener('click', () => {
    selectedRuleIds.clear();
    updateBulkToolbar();
    renderRules();
  });

  // Enable / Disable / Toggle buttons
  document.getElementById('btn-bulk-enable')?.addEventListener('click', async () => {
    const targetRules = getEffectiveBulkTargetRules();
    targetRules.forEach((r) => {
      r.enabled = true;
    });
    await saveConfigToStorage();
    renderRules();
  });

  document.getElementById('btn-bulk-disable')?.addEventListener('click', async () => {
    const targetRules = getEffectiveBulkTargetRules();
    targetRules.forEach((r) => {
      r.enabled = false;
    });
    await saveConfigToStorage();
    renderRules();
  });

  document.getElementById('btn-bulk-toggle')?.addEventListener('click', async () => {
    const targetRules = getEffectiveBulkTargetRules();
    targetRules.forEach((r) => {
      r.enabled = !r.enabled;
    });
    await saveConfigToStorage();
    renderRules();
  });

  // Bulk Delete
  document.getElementById('btn-bulk-delete')?.addEventListener('click', async () => {
    if (selectedRuleIds.size === 0) {
      alert('Bitte markieren Sie zuerst mindestens eine Regel zum Löschen.');
      return;
    }
    const count = selectedRuleIds.size;
    const isFiltered = !!rulesFilterQuery.trim();
    const visible = getFilteredRules();
    const visibleSelected = visible.filter((r) => selectedRuleIds.has(r.id)).length;
    const hiddenSelected = count - visibleSelected;

    let msg = 'Möchten Sie alle ' + count + ' ausgewählten Regeln wirklich löschen?';
    if (isFiltered && hiddenSelected > 0) {
      msg = 'ACHTUNG: Es sind aktuell ' + count + ' Regeln markiert:\\n• ' + visibleSelected + ' sichtbare Filter-Treffer\\n• ' + hiddenSelected + ' verborgene Regeln außerhalb des Filters\\n\\nWirklich alle ' + count + ' Regeln löschen?';
    }
    if (confirm(msg)) {
      appConfig.rules = (appConfig.rules || []).filter((r) => !selectedRuleIds.has(r.id));
      appConfig.rules.forEach((r, i) => r.priority = i + 1);
      selectedRuleIds.clear();
      await saveConfigToStorage();
      renderRules();
    }
  });

  // Bulk Export
  document.getElementById('btn-bulk-export')?.addEventListener('click', () => {
    const targetRules = getEffectiveBulkTargetRules();
    if (targetRules.length === 0) {
      alert('Bitte markieren Sie mindestens eine Regel für den Export.');
      return;
    }
    const blob = new Blob([JSON.stringify(targetRules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tabchroma-rules-selected-' + targetRules.length + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  // Close popovers on click outside
  window.addEventListener('click', (e) => {
    const cPop = document.getElementById('bulk-color-popover');
    const iPop = document.getElementById('bulk-icon-popover');
    const cBtn = document.getElementById('btn-bulk-colorsync-toggle');
    const iBtn = document.getElementById('btn-bulk-iconsync-toggle');
    if (cPop && cPop.style.display === 'block') {
      if (!cPop.contains(e.target) && !cBtn?.contains(e.target)) {
        cPop.style.display = 'none';
      }
    }
    if (iPop && iPop.style.display === 'block') {
      if (!iPop.contains(e.target) && !iBtn?.contains(e.target)) {
        iPop.style.display = 'none';
      }
    }
  });
}

// -------------------------------------------------------------
// Rule Edit & Create Modal
// -------------------------------------------------------------
let selectedModalColor = 'red';
let selectedModalHex = '#ff4f5e';
let selectedModalIcon = 'circle';

function openRuleModal(index) {
  editingRuleIndex = index;
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const inpName = document.getElementById('inp-name');
  const inpType = document.getElementById('inp-type');
  const inpPattern = document.getElementById('inp-pattern');
  const inpHex = document.getElementById('inp-hex');
  const inpContainerName = document.getElementById('inp-container-name');
  const inpEmoji = document.getElementById('inp-emoji');
  const inpEnableFavicon = document.getElementById('inp-enable-favicon-emoji');
  const inpEnableTitle = document.getElementById('inp-enable-title-emoji');
  const inpIcon = document.getElementById('inp-icon');
  const inpMode = document.getElementById('inp-mode');
  const inpTopBar = document.getElementById('inp-topbar');
  const inpEnabled = document.getElementById('inp-enabled');

  if (index >= 0) {
    const rule = appConfig.rules[index];
    title.textContent = 'Regel bearbeiten: ' + (rule.name || rule.pattern);
    inpName.value = rule.name || '';
    inpType.value = rule.patternType || 'domain';
    inpPattern.value = rule.pattern || '';
    selectedModalColor = rule.firefoxContainerColor || 'red';
    selectedModalHex = rule.color || hexMap[selectedModalColor] || '#ff4f5e';
    inpHex.value = selectedModalHex;
    inpContainerName.value = rule.containerName || rule.name || '';
    if (inpEmoji) inpEmoji.value = rule.customEmoji || '';
    if (inpEnableFavicon) inpEnableFavicon.checked = rule.enableFaviconEmoji !== false;
    if (inpEnableTitle) inpEnableTitle.checked = rule.enableTitleEmoji !== false;
    const inpHalo = document.getElementById('inp-enable-favicon-halo');
    if (inpHalo) inpHalo.checked = rule.enableFaviconHalo !== undefined ? rule.enableFaviconHalo : (appConfig.enableFaviconContrastHalo !== false);
    selectedModalIcon = rule.firefoxContainerIcon || 'circle';
    inpIcon.value = selectedModalIcon;
    inpMode.value = rule.colorMode || 'container';
    inpTopBar.checked = rule.accentBorder !== false;
    inpEnabled.checked = rule.enabled !== false;
  } else {
    title.textContent = 'Neue Tab-Farbregel erstellen';
    inpName.value = '';
    inpType.value = 'domain';
    inpPattern.value = '';
    selectedModalColor = appConfig.defaultContainerColor || 'blue';
    selectedModalHex = appConfig.defaultColor || '#37adff';
    inpHex.value = selectedModalHex;
    inpContainerName.value = '';
    if (inpEmoji) inpEmoji.value = '';
    if (inpEnableFavicon) inpEnableFavicon.checked = true;
    if (inpEnableTitle) inpEnableTitle.checked = true;
    const inpHalo = document.getElementById('inp-enable-favicon-halo');
    if (inpHalo) inpHalo.checked = appConfig.enableFaviconContrastHalo !== false;
    selectedModalIcon = 'circle';
    inpIcon.value = selectedModalIcon;
    inpMode.value = appConfig.defaultMode || 'container';
    inpTopBar.checked = true;
    inpEnabled.checked = true;
  }

  updateModalColorButtons();
  updateModalIconButtons();
  updateModalPreview();
  overlay?.classList.add('active');
}

function closeRuleModal() {
  document.getElementById('modal-overlay')?.classList.remove('active');
  editingRuleIndex = -1;
}

function updateModalColorButtons() {
  document.querySelectorAll('#modal-color-grid .swatch-btn').forEach((btn) => {
    if (btn.getAttribute('data-color') === selectedModalColor) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

function updateModalIconButtons() {
  document.querySelectorAll('#modal-icon-grid .icon-btn').forEach((btn) => {
    if (btn.getAttribute('data-icon') === selectedModalIcon) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

function updateModalPreview() {
  const inpName = document.getElementById('inp-name');
  const inpEmoji = document.getElementById('inp-emoji');
  const inpEnableFavicon = document.getElementById('inp-enable-favicon-emoji');
  const inpEnableTitle = document.getElementById('inp-enable-title-emoji');
  const inpContainerName = document.getElementById('inp-container-name');
  const inpMode = document.getElementById('inp-mode');

  const simTab = document.getElementById('sim-tab-elem');
  const simFavicon = document.getElementById('sim-favicon-elem');
  const simTitle = document.getElementById('sim-title-elem');
  const simPill = document.getElementById('sim-pill-elem');
  const simModeTag = document.getElementById('preview-mode-tag');

  const emoji = (inpEmoji?.value || '').trim();
  const name = (inpName?.value || '').trim() || 'Tab Vorschau';
  const container = (inpContainerName?.value || '').trim() || name;

  if (simTab) simTab.style.borderTopColor = selectedModalHex;

  // Favicon dynamic preview
  if (simFavicon) {
    const inpHalo = document.getElementById('inp-enable-favicon-halo');
    const hasHalo = inpHalo ? inpHalo.checked : true;
    simFavicon.style.filter = hasHalo
      ? 'drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 2px rgba(0, 0, 0, 0.85))'
      : 'none';

    if (emoji && inpEnableFavicon?.checked) {
      simFavicon.textContent = emoji;
      simFavicon.style.background = selectedModalHex;
      simFavicon.style.borderRadius = '50%';
    } else {
      const sym = iconSymbols[selectedModalIcon] || '🌐';
      simFavicon.textContent = sym;
      simFavicon.style.background = 'transparent';
      simFavicon.style.borderRadius = '4px';
    }
  }

  // Title dynamic preview
  if (simTitle) {
    if (emoji && inpEnableTitle?.checked) {
      simTitle.textContent = emoji + ' ' + name;
    } else {
      simTitle.textContent = name;
    }
  }

  // Pill dynamic preview
  if (simPill) {
    simPill.textContent = container;
    simPill.style.color = selectedModalHex;
    simPill.style.borderColor = selectedModalHex;
  }

  if (simModeTag) {
    simModeTag.textContent = inpMode?.value === 'hybrid' ? 'Hybrid (Container + Theme)' : 'Nur Container';
  }
}

// Modal Color & Icon listeners
document.querySelectorAll('#modal-color-grid .swatch-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedModalColor = btn.getAttribute('data-color');
    selectedModalHex = btn.getAttribute('data-hex') || hexMap[selectedModalColor] || '#ff4f5e';
    const inpHex = document.getElementById('inp-hex');
    if (inpHex) inpHex.value = selectedModalHex;
    updateModalColorButtons();
    updateModalPreview();
  });
});

document.getElementById('inp-hex')?.addEventListener('input', (e) => {
  selectedModalHex = e.target.value;
  updateModalPreview();
});

document.querySelectorAll('#modal-icon-grid .icon-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedModalIcon = btn.getAttribute('data-icon') || 'circle';
    const inpIcon = document.getElementById('inp-icon');
    if (inpIcon) inpIcon.value = selectedModalIcon;
    updateModalIconButtons();
    updateModalPreview();
  });
});

// Quick symbol chips in modal
document.querySelectorAll('.opt-sym-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sym = btn.getAttribute('data-sym');
    const inp = document.getElementById('inp-emoji');
    if (inp) {
      inp.value = (inp.value === sym) ? '' : sym;
      updateModalPreview();
    }
  });
});

document.getElementById('btn-clear-emoji')?.addEventListener('click', () => {
  const inp = document.getElementById('inp-emoji');
  if (inp) {
    inp.value = '';
    updateModalPreview();
  }
});

document.getElementById('inp-emoji')?.addEventListener('input', updateModalPreview);
document.getElementById('inp-name')?.addEventListener('input', updateModalPreview);
document.getElementById('inp-container-name')?.addEventListener('input', updateModalPreview);
document.getElementById('inp-enable-favicon-emoji')?.addEventListener('change', updateModalPreview);
document.getElementById('inp-enable-title-emoji')?.addEventListener('change', updateModalPreview);
document.getElementById('inp-enable-favicon-halo')?.addEventListener('change', updateModalPreview);
document.getElementById('inp-mode')?.addEventListener('change', updateModalPreview);

document.getElementById('inp-type')?.addEventListener('change', (e) => {
  const hint = document.getElementById('pattern-hint');
  const val = e.target.value;
  if (val === 'domain') hint.textContent = 'Gleicht exakte Domain & alle Subdomains ab (z. B. example.com matcht sub.example.com).';
  else if (val === 'exact_host') hint.textContent = 'Gleicht NUR diesen exakten Host ab (Subdomains bleiben separat isoliert!).';
  else if (val === 'wildcard') hint.textContent = 'Unterstützt * für beliebig viele Zeichen und ? für ein Zeichen (z. B. *.staging.com/*).';
  else if (val === 'prefix') hint.textContent = 'Gleicht jede URL ab, die mit diesem Präfix beginnt.';
  else if (val === 'regex') hint.textContent = 'JavaScript Regulärer Ausdruck (case-insensitive).';
  else if (val === 'exact') hint.textContent = 'Volle URL-Gleichheit.';
});

document.getElementById('modal-close')?.addEventListener('click', closeRuleModal);
document.getElementById('modal-cancel')?.addEventListener('click', closeRuleModal);
document.getElementById('btn-add-rule')?.addEventListener('click', () => openRuleModal(-1));

// Save Rule
document.getElementById('modal-save')?.addEventListener('click', async () => {
  const inpName = document.getElementById('inp-name').value.trim();
  const inpPattern = document.getElementById('inp-pattern').value.trim();
  const inpType = document.getElementById('inp-type').value;
  const inpHex = document.getElementById('inp-hex').value.trim() || selectedModalHex;
  const inpContainerName = document.getElementById('inp-container-name').value.trim() || inpName || inpPattern;
  const inpEmoji = (document.getElementById('inp-emoji')?.value || '').trim();
  const inpEnableFavicon = document.getElementById('inp-enable-favicon-emoji')?.checked !== false;
  const inpEnableTitle = document.getElementById('inp-enable-title-emoji')?.checked !== false;
  const inpEnableHalo = document.getElementById('inp-enable-favicon-halo')?.checked !== false;
  const inpIcon = document.getElementById('inp-icon').value;
  const inpMode = document.getElementById('inp-mode').value;
  const inpTopBar = document.getElementById('inp-topbar').checked;
  const inpEnabled = document.getElementById('inp-enabled').checked;

  if (!inpPattern) {
    alert('Bitte geben Sie ein URL-Pattern ein.');
    return;
  }

  const finalName = inpName || inpPattern;

  if (editingRuleIndex >= 0) {
    const rule = appConfig.rules[editingRuleIndex];
    rule.name = finalName;
    rule.patternType = inpType;
    rule.pattern = inpPattern;
    rule.color = inpHex;
    rule.firefoxContainerColor = selectedModalColor;
    rule.containerName = inpContainerName;
    rule.customEmoji = inpEmoji;
    rule.enableFaviconEmoji = inpEnableFavicon;
    rule.enableTitleEmoji = inpEnableTitle;
    rule.enableFaviconHalo = inpEnableHalo;
    rule.firefoxContainerIcon = inpIcon;
    rule.colorMode = inpMode;
    rule.accentBorder = inpTopBar;
    rule.enabled = inpEnabled;
  } else {
    const newRule = {
      id: 'rule-' + Date.now(),
      name: finalName,
      patternType: inpType,
      pattern: inpPattern,
      color: inpHex,
      firefoxContainerColor: selectedModalColor,
      containerName: inpContainerName,
      customEmoji: inpEmoji,
      enableFaviconEmoji: inpEnableFavicon,
      enableTitleEmoji: inpEnableTitle,
      enableFaviconHalo: inpEnableHalo,
      firefoxContainerIcon: inpIcon,
      colorMode: inpMode,
      accentBorder: inpTopBar,
      enabled: inpEnabled,
      priority: (appConfig.rules?.length || 0) + 1,
    };
    appConfig.rules = [...(appConfig.rules || []), newRule];
  }

  await saveConfigToStorage();
  closeRuleModal();
  renderRules();
});

// -------------------------------------------------------------
// Import Rules Modal (Distinct & Conflict Management)
// -------------------------------------------------------------
let pendingImportAnalysis = null;

function getRuleKey(pType, pattern) {
  return (pType || 'domain').toLowerCase().trim() + '::' + (pattern || '').toLowerCase().trim();
}

function parseRulesFromJson(jsonStr) {
  if (!jsonStr.trim()) return { rules: [], error: 'Inhalt ist leer.' };
  try {
    const parsed = JSON.parse(jsonStr);
    let raw = [];
    if (Array.isArray(parsed)) {
      raw = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.rules)) raw = parsed.rules;
      else if (parsed.tabChromaConfig && Array.isArray(parsed.tabChromaConfig.rules)) raw = parsed.tabChromaConfig.rules;
      else if (parsed.config && Array.isArray(parsed.config.rules)) raw = parsed.config.rules;
      else if (Array.isArray(parsed.data)) raw = parsed.data;
      else if (parsed.pattern || parsed.url || parsed.host || parsed.name) raw = [parsed];
      else return { rules: [], error: 'Keine Regelliste im JSON gefunden.' };
    }
    if (raw.length === 0) return { rules: [], error: 'Datei enthält 0 Regeln.' };
    return { rules: raw };
  } catch (err) {
    return { rules: [], error: 'Ungültige JSON-Syntax: ' + err.message };
  }
}

function analyzeImportRules(rawRules) {
  const distinctImportedMap = new Map();
  rawRules.forEach((r, idx) => {
    const pat = String(r.pattern || r.url || r.host || '').trim();
    const pType = (r.patternType || 'domain').toLowerCase().trim();
    const key = pType + '::' + pat.toLowerCase();
    if (!distinctImportedMap.has(key)) {
      distinctImportedMap.set(key, { ...r, pattern: pat, patternType: pType, _key: key });
    }
  });

  const distinctRulesList = Array.from(distinctImportedMap.values());
  const existingKeyMap = new Map();
  (appConfig.rules || []).forEach((ex) => {
    existingKeyMap.set(getRuleKey(ex.patternType, ex.pattern), ex);
  });

  const newRules = [];
  const conflictRules = [];

  distinctRulesList.forEach((imp) => {
    if (existingKeyMap.has(imp._key)) {
      conflictRules.push({ imported: imp, existing: existingKeyMap.get(imp._key) });
    } else {
      newRules.push(imp);
    }
  });

  return {
    totalInFile: rawRules.length,
    distinctCount: distinctRulesList.length,
    distinctRulesList,
    newRules,
    conflictRules,
    hasConflicts: conflictRules.length > 0,
  };
}

function handleImportContentChanged(content) {
  const errEl = document.getElementById('import-error');
  const analysisEl = document.getElementById('import-analysis');
  const executeBtn = document.getElementById('import-execute');

  if (!content.trim()) {
    if (errEl) errEl.style.display = 'none';
    if (analysisEl) analysisEl.style.display = 'none';
    if (executeBtn) executeBtn.disabled = true;
    pendingImportAnalysis = null;
    return;
  }

  const res = parseRulesFromJson(content);
  if (res.error) {
    if (errEl) {
      errEl.textContent = res.error;
      errEl.style.display = 'block';
    }
    if (analysisEl) analysisEl.style.display = 'none';
    if (executeBtn) executeBtn.disabled = true;
    pendingImportAnalysis = null;
    return;
  }

  if (errEl) errEl.style.display = 'none';
  const analysis = analyzeImportRules(res.rules);
  pendingImportAnalysis = analysis;

  if (analysisEl) analysisEl.style.display = 'block';
  const statsTitle = document.getElementById('import-stats-title');
  const statsDesc = document.getElementById('import-stats-desc');
  const defaultsHint = document.getElementById('import-defaults-hint');

  if (statsTitle) statsTitle.textContent = '✓ ' + analysis.distinctCount + ' distinct Regeln erkannt';
  if (statsDesc) {
    statsDesc.textContent = analysis.newRules.length + ' neu hinzuzufügen, ' + analysis.conflictRules.length + ' Konflikte mit bestehenden Regeln.';
  }
  if (defaultsHint) {
    defaultsHint.textContent = 'Verwendet Standard-Farbe (' + appConfig.defaultColor + ') und Container (' + appConfig.defaultContainerColor + ').';
  }

  // Conflict items container
  const conflictListContainer = document.getElementById('conflict-list-container');
  const conflictItems = document.getElementById('conflict-items');
  if (analysis.hasConflicts) {
    if (conflictListContainer) conflictListContainer.style.display = 'block';
    if (conflictItems) {
      conflictItems.innerHTML = '';
      analysis.conflictRules.forEach((c) => {
        const item = document.createElement('div');
        item.className = 'conflict-item';
        item.innerHTML = '<span><code>' + c.imported.patternType + '</code> ' + c.imported.pattern + '</span><span style="color:#f59e0b;">Bestehend: ' + (c.existing.name || 'Regel') + '</span>';
        conflictItems.appendChild(item);
      });
    }
  } else {
    if (conflictListContainer) conflictListContainer.style.display = 'none';
  }

  if (executeBtn) {
    executeBtn.disabled = false;
    executeBtn.textContent = analysis.hasConflicts
      ? analysis.newRules.length + ' neu + ' + analysis.conflictRules.length + ' aktualisieren'
      : analysis.distinctCount + ' Regeln importieren';
  }
}

// Wire Import Modal Buttons
document.getElementById('btn-import-modal-open')?.addEventListener('click', () => {
  document.getElementById('import-modal-overlay')?.classList.add('active');
  const err = document.getElementById('import-error');
  if (err) err.style.display = 'none';
  const ana = document.getElementById('import-analysis');
  if (ana) ana.style.display = 'none';
  const exec = document.getElementById('import-execute');
  if (exec) exec.disabled = true;
  const txt = document.getElementById('import-textarea');
  if (txt) txt.value = '';
  const fname = document.getElementById('import-file-name');
  if (fname) fname.textContent = '';
  pendingImportAnalysis = null;
});

document.getElementById('import-modal-close')?.addEventListener('click', () => {
  document.getElementById('import-modal-overlay')?.classList.remove('active');
});

document.getElementById('import-cancel')?.addEventListener('click', () => {
  document.getElementById('import-modal-overlay')?.classList.remove('active');
});

// Import Dual Tabs
document.getElementById('tab-btn-file')?.addEventListener('click', () => {
  document.getElementById('tab-btn-file')?.classList.add('active');
  document.getElementById('tab-btn-text')?.classList.remove('active');
  const f = document.getElementById('tab-content-file');
  if (f) f.style.display = 'block';
  const t = document.getElementById('tab-content-text');
  if (t) t.style.display = 'none';
});

document.getElementById('tab-btn-text')?.addEventListener('click', () => {
  document.getElementById('tab-btn-text')?.classList.add('active');
  document.getElementById('tab-btn-file')?.classList.remove('active');
  const t = document.getElementById('tab-content-text');
  if (t) t.style.display = 'block';
  const f = document.getElementById('tab-content-file');
  if (f) f.style.display = 'none';
});

// File upload in modal
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('import-file-input');

dropZone?.addEventListener('click', () => fileInput?.click());
fileInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const fname = document.getElementById('import-file-name');
  if (fname) fname.textContent = 'Ausgewählt: ' + file.name;
  const reader = new FileReader();
  reader.onload = (event) => {
    handleImportContentChanged(event.target.result || '');
  };
  reader.readAsText(file);
});

document.getElementById('import-textarea')?.addEventListener('input', (e) => {
  handleImportContentChanged(e.target.value);
});

// Execute Import with conflict resolution
document.getElementById('import-execute')?.addEventListener('click', async () => {
  if (!pendingImportAnalysis || pendingImportAnalysis.distinctRulesList.length === 0) return;

  const strategy = document.querySelector('input[name="conflict-mode"]:checked')?.value || 'update_conflicts';
  const forceDefaults = document.getElementById('import-force-defaults')?.checked;

  const defColor = appConfig.defaultColor || '#37adff';
  const defContainer = appConfig.defaultContainerColor || 'blue';
  const defMode = appConfig.defaultMode || 'container';

  const processed = pendingImportAnalysis.distinctRulesList.map((r, idx) => {
    const pat = String(r.pattern || '').trim();
    const nm = String(r.name || pat || ('Regel ' + (idx + 1))).trim();
    return {
      id: r.id ? String(r.id) : ('rule-' + Date.now() + '-' + idx),
      name: nm,
      patternType: r.patternType || 'domain',
      pattern: pat,
      color: forceDefaults ? defColor : (r.color || defColor),
      firefoxContainerColor: forceDefaults ? defContainer : (r.firefoxContainerColor || defContainer),
      firefoxContainerIcon: r.firefoxContainerIcon || 'circle',
      customEmoji: r.customEmoji || '',
      enableTitleEmoji: r.enableTitleEmoji !== false,
      enableFaviconEmoji: r.enableFaviconEmoji !== false,
      containerName: String(r.containerName || nm || 'Container').trim(),
      colorMode: forceDefaults ? defMode : (r.colorMode || defMode),
      accentBorder: r.accentBorder !== false,
      enabled: r.enabled !== false,
      priority: idx + 1,
    };
  });

  let finalRules = [];
  if (strategy === 'replace_all') {
    finalRules = processed.map((r, i) => ({ ...r, priority: i + 1 }));
  } else {
    const resultList = [...(appConfig.rules || [])];
    processed.forEach((imp) => {
      const key = getRuleKey(imp.patternType, imp.pattern);
      const exIdx = resultList.findIndex((r) => getRuleKey(r.patternType, r.pattern) === key);
      if (exIdx >= 0) {
        if (strategy === 'update_conflicts') {
          resultList[exIdx] = {
            ...imp,
            id: resultList[exIdx].id,
            priority: resultList[exIdx].priority,
          };
        }
      } else {
        resultList.push(imp);
      }
    });
    finalRules = resultList.map((r, i) => ({ ...r, priority: i + 1 }));
  }

  appConfig.rules = finalRules;
  await saveConfigToStorage();
  document.getElementById('import-modal-overlay')?.classList.remove('active');
  renderRules();
  alert('✓ ' + processed.length + ' Regeln erfolgreich verarbeitet (Gesamtbestand: ' + finalRules.length + ' Regeln)!');
});

// -------------------------------------------------------------
// Export JSON
// -------------------------------------------------------------
document.getElementById('btn-export')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(appConfig.rules || [], null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tabchroma-rules.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  initBulkToolbar();
});
`;

  files.push({
    name: 'options.js',
    path: 'options.js',
    content: optionsJs,
    language: 'javascript',
  });

  // 8. icons
  files.push({
    name: 'icon-48.svg',
    path: 'icons/icon-48.svg',
    content: createExtensionSvgIcon(),
    language: 'html',
  });
  files.push({
    name: 'icon-96.svg',
    path: 'icons/icon-96.svg',
    content: createExtensionSvgIcon('#37adff'),
    language: 'html',
  });
  files.push({
    name: 'icon-128.svg',
    path: 'icons/icon-128.svg',
    content: createExtensionSvgIcon('#ff4f5e'),
    language: 'html',
  });

  // 9. README.md
  const readmeMd = `# TabChroma - Firefox URL Tab Color Add-on

Automatically colors Firefox tabs based on custom URL patterns, domain names, regex expressions, and Firefox Containers.

## How to Install in Firefox (30 Seconds)

1. Unzip the downloaded \`tabchroma-firefox-addon.zip\` into any folder.
2. In your Firefox browser, open a new tab and navigate to:
   \`about:debugging#/runtime/this-firefox\`
3. Click the **"Load Temporary Add-on..."** button.
4. Select the \`manifest.json\` file located inside the unzipped folder.
5. TabChroma is now active! As you navigate to matching URLs, Firefox tabs will automatically display in your chosen colors.

## Features
- **URL-Based Color Routing**: Define exact URLs, wildcards (\`*.staging.org/*\`), domains (\`github.com\`), or regular expressions.
- **Firefox Native Containers**: Assigns URLs to container tabs with native colored tab underlines and address bar badges.
- **Adaptive Window Themes**: Tints active tab headers and browser toolbar dynamically.
- **Top Accent Line**: Optional 3px colored accent line on matching pages.
- **Built-in Options & Popup**: Tweak rules or quick-color any domain on the fly.
`;

  files.push({
    name: 'README.md',
    path: 'README.md',
    content: readmeMd,
    language: 'markdown',
  });

  // 10. PRIVACY.md (Compliant with Mozilla AMO Privacy Policy Requirements)
  const privacyMd = `# Privacy Policy for TabChroma

Last updated: October 2026

TabChroma is committed to protecting your privacy.

## Data Collection & Handling
- **Zero Remote Tracking:** TabChroma does not collect, record, track, transmit, or sell any personal data, browsing history, tabs, or visited URLs.
- **Local Storage Only:** All user configurations, URL rules, and container color associations are stored strictly locally on your device via Firefox's standard \`browser.storage.local\` API.
- **No Third-Party Analytics or Services:** The extension contains zero external trackers, analytics SDKs, advertising beacons, or telemetry.
- **Permissions Justification:**
  - \`contextualIdentities\` & \`cookies\`: Required solely to open matching URLs in designated Firefox colored container tabs.
  - \`tabs\` & \`webNavigation\`: Required to evaluate the current tab URL against your configured color rules.
  - \`theme\`: Required to dynamically adjust the active tab header accent color.
`;

  files.push({
    name: 'PRIVACY.md',
    path: 'PRIVACY.md',
    content: privacyMd,
    language: 'markdown',
  });

  // 10. rules.json
  files.push({
    name: 'rules.json',
    path: 'rules.json',
    content: JSON.stringify(config.rules, null, 2),
    language: 'json',
  });

  return files;
}

/**
 * Packs all files into a ZIP archive and triggers browser download
 */
export async function downloadExtensionZip(config: ExtensionConfig, filename?: string): Promise<void> {
  const version = config.extensionVersion || '1.0.1';
  const defaultName = `tabchroma-firefox-v${version}.zip`;
  const files = generateExtensionFiles(config);
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || defaultName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Packs all files into a Firefox .xpi archive with application/x-xpinstall MIME type
 * Firefox can install this file directly via "Install Add-on From File..." or Drag & Drop.
 */
export async function downloadExtensionXpi(config: ExtensionConfig, filename?: string): Promise<void> {
  const version = config.extensionVersion || '1.0.1';
  const defaultName = `tabchroma-tab-color-v${version}.xpi`;
  const files = generateExtensionFiles(config);
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/x-xpinstall',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || defaultName;
  anchor.setAttribute('type', 'application/x-xpinstall');
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Downloads an enterprise policies.json file for permanent installation on standard Firefox
 */
export function downloadPoliciesJson(extensionId = 'tabchroma-tab-color@extension.local'): void {
  const policies = {
    policies: {
      ExtensionSettings: {
        [extensionId]: {
          installation_mode: 'normal_installed',
          install_url: 'file:///path/to/tabchroma-tab-color.xpi'
        }
      }
    }
  };
  const blob = new Blob([JSON.stringify(policies, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'policies.json';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
