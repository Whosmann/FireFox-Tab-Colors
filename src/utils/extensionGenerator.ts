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

// Apply dynamic theme color to active window
async function applyThemeForTab(windowId, rule) {
  if (!appConfig.enableActiveTabTheme) return;

  if (rule && rule.color) {
    const hex = rule.color;
    // Deckkraft des aktiven Tabs reduzieren, damit Favicons mit gleicher Farbe deutlich sichtbar bleiben
    const opacity = (typeof rule.tabOpacity === 'number')
      ? rule.tabOpacity
      : ((typeof appConfig.activeTabOpacity === 'number') ? appConfig.activeTabOpacity : 0.35);
    const tabSelectedColor = hexToRgba(hex, opacity);

    try {
      await browser.theme.update(windowId, {
        colors: {
          frame: '#181825',
          toolbar: '#1e1e2e',
          tab_selected: tabSelectedColor, // Reduzierte Deckkraft / Transparenz
          tab_line: hex, // 100% kräftige Farblinie am oberen Rand
          tab_loading: hex,
          toolbar_field_focus: hex,
          toolbar_text: '#f8fafc',
          tab_background_text: '#94a3b8'
        }
      });
    } catch (e) {
      console.warn('[TabChroma] Theme update error:', e);
    }
  } else {
    try {
      await browser.theme.reset(windowId);
    } catch (e) {}
  }
}

// Intercept top-level navigations to route URLs to colored containers
browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // Top-level tab frame only
  if (!details.url || details.url.startsWith('about:') || details.url.startsWith('moz-extension:')) return;

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
      const containerTitle = (rule.customEmoji ? rule.customEmoji + ' ' : '') + (rule.containerName || rule.name);
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
      });
    } else {
      await browser.tabs.sendMessage(tabId, {
        action: 'CLEAR_ACCENT_COLOR',
      });
    }
  } catch (err) {}
}

// Update window theme when switching active tab
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (!tab || !tab.url) return;
    const rule = findMatchingRule(tab.url);
    await applyThemeForTab(activeInfo.windowId, rule);
    await notifyTabVisuals(tab.id, rule);
  } catch (err) {}
});

// Listen for tab URL updates
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const rule = findMatchingRule(changeInfo.url);
    if (tab.active) {
      await applyThemeForTab(tab.windowId, rule);
    }
    await notifyTabVisuals(tabId, rule);
  }
});

// Message listener for popup & options communication
browser.runtime.onMessage.addListener(async (message) => {
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
    return { matched: !!rule, rule };
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
      if (activeTabs && activeTabs[0] && activeTabs[0].url) {
        const rule = findMatchingRule(activeTabs[0].url);
        await applyThemeForTab(activeTabs[0].windowId, rule);
        await notifyTabVisuals(activeTabs[0].id, rule);
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

  let originalFaviconHref = null;

  function renderFaviconEmoji(emoji, color) {
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
      ctx.arc(16, 16, 15, 0, Math.PI * 2);
      ctx.fill();

      // Draw custom symbol / emoji in the center
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 16, 18);

      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.head.appendChild(link);
      } else if (!originalFaviconHref) {
        originalFaviconHref = link.href;
      }
      link.href = canvas.toDataURL('image/png');
    } catch (e) {}
  }

  function removeFaviconEmoji() {
    try {
      let link = document.querySelector("link[rel*='icon']");
      if (link && originalFaviconHref) {
        link.href = originalFaviconHref;
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

  function applyRuleVisuals(rule) {
    if (!rule) {
      removeTopBar();
      removeTitleEmoji();
      removeFaviconEmoji();
      return;
    }
    if (rule.accentBorder) {
      renderTopBar(rule.color);
    } else {
      removeTopBar();
    }
    if (rule.customEmoji) {
      if (rule.enableTitleEmoji !== false) {
        updateTitleEmoji(rule.customEmoji);
      } else {
        removeTitleEmoji();
      }
      if (rule.enableFaviconEmoji !== false) {
        renderFaviconEmoji(rule.customEmoji, rule.color);
      } else {
        removeFaviconEmoji();
      }
    } else {
      removeTitleEmoji();
      removeFaviconEmoji();
    }
  }

  // Request initial color matching from background
  try {
    browser.runtime.sendMessage({ action: 'MATCH_URL', url: window.location.href }).then((response) => {
      if (response && response.matched && response.rule) {
        applyRuleVisuals(response.rule);
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
      if (msg.customEmoji) {
        if (msg.enableTitleEmoji !== false) {
          updateTitleEmoji(msg.customEmoji);
        } else {
          removeTitleEmoji();
        }
        if (msg.enableFaviconEmoji !== false) {
          renderFaviconEmoji(msg.customEmoji, msg.color);
        } else {
          removeFaviconEmoji();
        }
      } else {
        removeTitleEmoji();
        removeFaviconEmoji();
      }
    } else if (msg.action === 'CLEAR_ACCENT_COLOR') {
      removeTopBar();
      removeTitleEmoji();
      removeFaviconEmoji();
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TabChroma</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { width: 320px; background: #0f172a; color: #f8fafc; padding: 14px; font-size: 13px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 10px; margin-bottom: 12px; }
    .brand { font-size: 14px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
    .status-card { background: #1e293b; border-radius: 8px; padding: 12px; border-left: 4px solid #64748b; margin-bottom: 12px; }
    .status-card.matched { border-left-color: var(--accent-color, #38bdf8); }
    .url-text { font-family: monospace; font-size: 11px; color: #94a3b8; word-break: break-all; margin-top: 4px; }
    .rule-name { font-weight: 600; color: #f1f5f9; display: flex; align-items: center; gap: 6px; }
    .quick-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    .color-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }
    .color-btn { height: 26px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #fff; font-weight: 600; }
    .color-btn:hover { filter: brightness(1.2); }
    .actions { display: flex; gap: 8px; }
    .btn { flex: 1; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; text-align: center; border: none; }
    .btn-primary { background: #0284c7; color: white; }
    .btn-secondary { background: #334155; color: #cbd5e1; }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">🎨 TabChroma</div>
    <span id="rule-count" style="color: #64748b; font-size: 11px;">Rules active</span>
  </div>

  <div id="status-card" class="status-card">
    <div class="rule-name" id="status-title">Checking tab...</div>
    <div class="url-text" id="status-url"></div>
  </div>

  <div class="quick-title">Quick Color This Site</div>
  <div class="color-grid">
    <button class="color-btn" style="background:#ff4f5e" data-color="red" data-hex="#ff4f5e">Red</button>
    <button class="color-btn" style="background:#ff9400" data-color="orange" data-hex="#ff9400">Orange</button>
    <button class="color-btn" style="background:#51cf66" data-color="green" data-hex="#51cf66">Green</button>
    <button class="color-btn" style="background:#37adff" data-color="blue" data-hex="#37adff">Blue</button>
    <button class="color-btn" style="background:#00c79a" data-color="turquoise" data-hex="#00c79a">Turq</button>
    <button class="color-btn" style="background:#9059ff" data-color="purple" data-hex="#9059ff">Purple</button>
    <button class="color-btn" style="background:#ff4ba0" data-color="pink" data-hex="#ff4ba0">Pink</button>
    <button class="color-btn" style="background:#ffcb00; color: #000" data-color="yellow" data-hex="#ffcb00">Yellow</button>
  </div>

  <div class="actions">
    <button id="btn-options" class="btn btn-primary">Open Rules Editor</button>
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
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusTitle = document.getElementById('status-title');
  const statusUrl = document.getElementById('status-url');
  const statusCard = document.getElementById('status-card');
  const btnOptions = document.getElementById('btn-options');
  const ruleCountEl = document.getElementById('rule-count');

  let currentTab = null;

  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    if (currentTab && currentTab.url) {
      statusUrl.textContent = currentTab.url;

      const response = await browser.runtime.sendMessage({
        action: 'MATCH_URL',
        url: currentTab.url,
      });

      if (response && response.matched && response.rule) {
        statusTitle.textContent = '● ' + response.rule.name;
        statusCard.style.setProperty('--accent-color', response.rule.color);
        statusCard.classList.add('matched');
      } else {
        statusTitle.textContent = 'No Color Rule Matched';
        statusCard.classList.remove('matched');
      }
    }

    const config = await browser.runtime.sendMessage({ action: 'GET_CONFIG' });
    if (config && config.rules) {
      ruleCountEl.textContent = config.rules.length + ' rules';
    }
  } catch (err) {
    statusTitle.textContent = 'Ready';
  }

  // Quick color buttons
  document.querySelectorAll('.color-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!currentTab || !currentTab.url) return;
      try {
        const urlObj = new URL(currentTab.url);
        const domain = urlObj.hostname;
        const colorName = btn.getAttribute('data-color');
        const hex = btn.getAttribute('data-hex');

        const config = await browser.runtime.sendMessage({ action: 'GET_CONFIG' });
        const newRule = {
          id: 'rule-' + Date.now(),
          name: domain + ' (' + colorName + ')',
          patternType: 'domain',
          pattern: domain,
          color: hex,
          firefoxContainerColor: colorName,
          firefoxContainerIcon: 'circle',
          containerName: domain,
          colorMode: 'hybrid',
          accentBorder: true,
          enabled: true,
          priority: 1,
        };

        config.rules = [newRule, ...(config.rules || [])];
        await browser.runtime.sendMessage({ action: 'SAVE_CONFIG', config });

        statusTitle.textContent = '● ' + newRule.name;
        statusCard.style.setProperty('--accent-color', hex);
        statusCard.classList.add('matched');
      } catch (e) {
        console.error('Failed to add quick rule:', e);
      }
    });
  });

  btnOptions.addEventListener('click', () => {
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
  <title>TabChroma - Firefox URL Tab Color & Container Studio</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b0f19; color: #f8fafc; padding: 24px; line-height: 1.5; font-size: 13px; }
    .container { max-width: 1080px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 20px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .desc { font-size: 13px; color: #94a3b8; margin-top: 3px; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
    .btn-primary { background: #0284c7; color: white; }
    .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }
    .btn-danger { background: #ef4444; color: white; }
    .btn:hover { opacity: 0.9; }
    .actions-bar { display: flex; gap: 8px; flex-wrap: wrap; }
    
    /* Defaults Card matching Studio Preview */
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #1f2937; padding-bottom: 12px; }
    .card-title { font-size: 15px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
    .card-subtitle { font-size: 12px; color: #94a3b8; margin-top: 3px; }
    .defaults-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .default-col { background: #182234; border: 1px solid #283548; border-radius: 8px; padding: 14px; }
    .col-title { font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
    
    .color-swatch-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
    .swatch-btn { height: 28px; border-radius: 6px; border: 2px solid transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
    .swatch-btn.selected { border-color: #fff; box-shadow: 0 0 0 2px #38bdf8; }
    
    .mode-radio-box { border: 1px solid #334155; border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer; transition: all 0.15s; background: #1e293b; }
    .mode-radio-box.selected { border-color: #38bdf8; background: rgba(56,189,248,0.1); }
    .mode-radio-title { font-weight: 700; font-size: 12px; color: #f8fafc; margin-bottom: 2px; }
    .mode-radio-desc { font-size: 11px; color: #94a3b8; line-height: 1.3; }
    
    .check-label { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #cbd5e1; cursor: pointer; margin-bottom: 10px; }
    .check-label input { margin-top: 2px; }
    .check-label strong { color: #f8fafc; display: block; }
    .check-label span { font-size: 11px; color: #94a3b8; }
    
    .tip-banner { background: #0c4a6e; border: 1px solid #0284c7; border-radius: 8px; padding: 10px 14px; font-size: 11px; color: #bae6fd; display: flex; align-items: center; gap: 8px; margin-top: 14px; }
    
    /* Table */
    table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 8px; overflow: hidden; border: 1px solid #1f2937; margin-top: 12px; }
    th { text-align: left; padding: 11px 13px; font-size: 11px; text-transform: uppercase; color: #94a3b8; background: #1f2937; letter-spacing: 0.05em; }
    td { padding: 11px 13px; border-top: 1px solid #1f2937; font-size: 12px; vertical-align: middle; }
    .color-swatch { width: 15px; height: 15px; border-radius: 4px; display: inline-block; vertical-align: middle; margin-right: 6px; }
    .pattern-code { font-family: monospace; background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #38bdf8; word-break: break-all; }
    .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #374151; color: #d1d5db; font-family: monospace; }
    .badge-sym { font-size: 10px; padding: 1px 5px; border-radius: 3px; background: #0369a1; color: #e0f2fe; font-weight: 700; margin-left: 4px; }
    .btn-cell { display: flex; gap: 6px; align-items: center; justify-content: flex-end; }
    .edit-btn { background: #0284c7; color: white; padding: 4px 10px; border-radius: 5px; font-size: 11px; font-weight: 600; border: none; cursor: pointer; }
    .del-btn { background: #ef4444; color: white; padding: 4px 8px; border-radius: 5px; font-size: 11px; font-weight: 600; border: none; cursor: pointer; }
    .priority-btn { background: #1f2937; color: #94a3b8; border: 1px solid #374151; border-radius: 4px; width: 22px; height: 22px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .priority-btn:hover { color: #fff; background: #374151; }
    tr.selected-row { background: rgba(56, 189, 248, 0.12) !important; }
    .bulk-btn-group { display: inline-flex; border-radius: 6px; overflow: hidden; border: 1px solid #334155; }
    .bulk-sub-btn { background: #1e293b; color: #cbd5e1; border: none; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .bulk-sub-btn:hover { background: #334155; color: #fff; }

    /* Modals */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 16px; backdrop-filter: blur(3px); }
    .modal-overlay.active { display: flex; }
    .modal { background: #111827; border: 1px solid #374151; border-radius: 12px; width: 100%; max-width: 620px; max-height: 92vh; overflow-y: auto; padding: 22px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; padding-bottom: 12px; margin-bottom: 16px; }
    .modal-title { font-size: 16px; font-weight: 700; color: #f8fafc; }
    .close-btn { background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; line-height: 1; }
    .close-btn:hover { color: #fff; }
    .form-group { margin-bottom: 13px; }
    .form-label { display: block; font-size: 11px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
    .form-input, .form-select, .form-textarea { width: 100%; padding: 8px 11px; background: #1e293b; border: 1px solid #374151; border-radius: 6px; color: #f8fafc; font-size: 12px; outline: none; }
    .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #38bdf8; }
    .form-hint { font-size: 11px; color: #64748b; margin-top: 3px; }
    .icon-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 5px; }
    .icon-btn { background: #1e293b; border: 1px solid #374151; border-radius: 6px; padding: 5px 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: #cbd5e1; }
    .icon-btn.selected { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; color: #38bdf8; font-weight: 700; }
    .icon-sym { font-size: 15px; }
    .icon-lbl { font-size: 10px; margin-top: 2px; }

    /* Realistic Tab Preview in Modal */
    .preview-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; margin-top: 14px; }
    .preview-header { font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; display: flex; justify-content: space-between; }
    .sim-tab-bar { background: #1e1e2e; padding: 6px 8px 0 8px; border-radius: 6px 6px 0 0; display: flex; align-items: flex-end; }
    .sim-tab { background: #2d2d3f; border-radius: 6px 6px 0 0; padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px; border-top: 3px solid #37adff; color: #f8fafc; font-size: 12px; font-weight: 600; box-shadow: 0 -2px 5px rgba(0,0,0,0.3); }
    .sim-favicon { width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .sim-title { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .sim-pill { background: rgba(55,173,255,0.2); border: 1px solid #37adff; color: #38bdf8; font-size: 10px; padding: 1px 6px; border-radius: 10px; margin-left: 8px; font-weight: 600; }
    
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; padding-top: 12px; border-top: 1px solid #1f2937; }
    
    /* Tabs inside Import Modal */
    .tab-nav { display: flex; gap: 4px; border-bottom: 1px solid #374151; margin-bottom: 14px; }
    .tab-nav-btn { padding: 7px 14px; border: none; background: transparent; color: #94a3b8; font-size: 12px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; }
    .tab-nav-btn.active { color: #38bdf8; border-bottom-color: #38bdf8; }
    .stats-card { background: #182234; border: 1px solid #283548; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px; }
    .conflict-box { background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 10px; max-height: 140px; overflow-y: auto; font-size: 11px; margin-top: 8px; }
    .conflict-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #374151; }
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
            <div class="mode-radio-desc">Färbt den Container und passt zusätzlich die Firefox-Toolbar dynamisch an.</div>
          </div>
        </div>

        <!-- 3. Browser-Farbschema Schutz -->
        <div class="default-col">
          <div class="col-title">3. Browser-Farbschema Schutz</div>
          <label class="check-label">
            <input type="checkbox" id="def-active-theme">
            <div>
              <strong>Firefox-Fenstertheme überschreiben</strong>
              <span>Aktiv: Firefox-Symbolleisten wechseln beim Tab-Wechsel die Farbe.</span>
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
      </div>

      <!-- 4. Deckkraft des aktiven Tabs & Favicon-Kontrast -->
      <div style="margin-top: 14px; padding: 12px 14px; background: #182234; border: 1px solid #283548; border-radius: 8px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <span>🔍 Deckkraft des aktiven Tabs (Favicon-Kontrast)</span>
              <span id="lbl-opacity-val" style="background:#0369a1; color:#e0f2fe; padding:2px 7px; border-radius:10px; font-size:10px; font-weight:700;">35%</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
              Reduziert die Deckkraft des aktiven Tabs, damit Favicons mit gleicher Farbe wie der Tab (z. B. rotes Icon auf rotem Tab) sichtbar bleiben.
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="range" id="def-opacity" min="0.15" max="1.0" step="0.05" value="0.35" style="width: 130px; cursor: pointer;">
            <button type="button" class="btn btn-secondary op-preset-btn" data-val="0.25" style="font-size:10px; padding:3px 6px;">25%</button>
            <button type="button" class="btn btn-secondary op-preset-btn" data-val="0.35" style="font-size:10px; padding:3px 6px;">35%</button>
            <button type="button" class="btn btn-secondary op-preset-btn" data-val="0.50" style="font-size:10px; padding:3px 6px;">50%</button>
            <button type="button" class="btn btn-secondary op-preset-btn" data-val="1.00" style="font-size:10px; padding:3px 6px;">100%</button>
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

    <!-- URL Rules Table -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <h2 style="font-size:16px; font-weight:700; color:#f8fafc;" id="table-heading">Konfigurierte URL-Regeln</h2>
      <span id="rules-count-pill" style="font-size:11px; background:#1e293b; color:#38bdf8; padding:3px 8px; border-radius:12px; border:1px solid #334155;">0 Regeln</span>
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
          <button type="button" id="btn-bulk-select-all" class="btn btn-secondary" style="font-size: 11px; padding: 5px 10px;">☑️ Alle auswählen</button>
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
      <div class="form-group" style="background:#182234; padding:10px 12px; border-radius:8px; border:1px solid #283548; margin-bottom:0;">
        <label class="form-label" style="font-size:11px; font-weight:700; color:#38bdf8; margin-bottom:6px;">6. 3px Seiten-Akzentleiste:</label>
        <select id="be-topbar" class="form-select">
          <option value="keep">-- Keine Änderung (beibehalten) --</option>
          <option value="enable">Akzentleiste aktivieren (ein)</option>
          <option value="disable">Akzentleiste deaktivieren (aus)</option>
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

  renderDefaultsCard();
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
  if (appConfig.defaultMode === 'hybrid') {
    modeHybrid?.classList.add('selected');
    modeContainer?.classList.remove('selected');
  } else {
    modeContainer?.classList.add('selected');
    modeHybrid?.classList.remove('selected');
  }

  if (defActiveTheme) defActiveTheme.checked = !!appConfig.enableActiveTabTheme;
  if (defRevertUnmatched) defRevertUnmatched.checked = appConfig.revertUnmatchedToDefault !== false;
  if (defEnableTopbar) defEnableTopbar.checked = appConfig.enablePageTopBar !== false;

  const defOpacity = document.getElementById('def-opacity');
  const lblOpacityVal = document.getElementById('lbl-opacity-val');
  const opacityVal = (typeof appConfig.activeTabOpacity === 'number') ? appConfig.activeTabOpacity : 0.35;
  if (defOpacity) defOpacity.value = String(opacityVal);
  if (lblOpacityVal) lblOpacityVal.textContent = Math.round(opacityVal * 100) + '%';
}

// Defaults listeners
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
  const lbl = document.getElementById('lbl-opacity-val');
  if (lbl) lbl.textContent = Math.round(val * 100) + '%';
});

document.querySelectorAll('.op-preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const val = parseFloat(btn.getAttribute('data-val'));
    appConfig.activeTabOpacity = val;
    const defOpacity = document.getElementById('def-opacity');
    const lbl = document.getElementById('lbl-opacity-val');
    if (defOpacity) defOpacity.value = String(val);
    if (lbl) lbl.textContent = Math.round(val * 100) + '%';
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
    renderRules();
  }
});

// -------------------------------------------------------------
// Rules Table & Bulk Actions
// -------------------------------------------------------------
const selectedRuleIds = new Set();

function renderRules() {
  const tbody = document.getElementById('rules-body');
  const countPill = document.getElementById('rules-count-pill');
  if (!tbody) return;

  tbody.textContent = '';
  const rules = appConfig.rules || [];
  if (countPill) countPill.textContent = rules.length + ' Regeln';

  if (rules.length === 0) {
    const emptyTr = document.createElement('tr');
    const emptyTd = document.createElement('td');
    emptyTd.colSpan = 9;
    emptyTd.style.textAlign = 'center';
    emptyTd.style.padding = '36px';
    emptyTd.style.color = '#64748b';
    emptyTd.textContent = 'Keine Regeln konfiguriert. Klicken Sie auf "+ Neue Regel erstellen", um eine hinzuzufügen.';
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    updateBulkToolbar();
    return;
  }

  rules.forEach((rule, idx) => {
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
    pNum.textContent = String(idx + 1);
    pContainer.appendChild(pNum);

    if (idx > 0) {
      const upBtn = document.createElement('button');
      upBtn.className = 'priority-btn';
      upBtn.textContent = '▲';
      upBtn.title = 'Nach oben';
      upBtn.addEventListener('click', async () => {
        const temp = appConfig.rules[idx];
        appConfig.rules[idx] = appConfig.rules[idx - 1];
        appConfig.rules[idx - 1] = temp;
        appConfig.rules.forEach((r, i) => r.priority = i + 1);
        await saveConfigToStorage();
        renderRules();
      });
      pContainer.appendChild(upBtn);
    }

    if (idx < rules.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.className = 'priority-btn';
      downBtn.textContent = '▼';
      downBtn.title = 'Nach unten';
      downBtn.addEventListener('click', async () => {
        const temp = appConfig.rules[idx];
        appConfig.rules[idx] = appConfig.rules[idx + 1];
        appConfig.rules[idx + 1] = temp;
        appConfig.rules.forEach((r, i) => r.priority = i + 1);
        await saveConfigToStorage();
        renderRules();
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
    tdName.addEventListener('click', () => openRuleModal(idx));

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
      (r, rIdx) => rIdx < idx && r.patternType === rule.patternType && (r.pattern || '').trim().toLowerCase() === (rule.pattern || '').trim().toLowerCase()
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
    editBtn.addEventListener('click', () => openRuleModal(idx));
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
        appConfig.rules.splice(idx, 1);
        appConfig.rules.forEach((r, i) => r.priority = i + 1);
        selectedRuleIds.delete(rule.id);
        await saveConfigToStorage();
        renderRules();
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
  if (!card) return;

  const count = selectedRuleIds.size;
  const rules = appConfig.rules || [];

  if (masterChk) {
    if (rules.length === 0 || count === 0) {
      masterChk.checked = false;
      masterChk.indeterminate = false;
    } else if (count === rules.length) {
      masterChk.checked = true;
      masterChk.indeterminate = false;
    } else {
      masterChk.checked = false;
      masterChk.indeterminate = true;
    }
  }

  if (countBadge) {
    countBadge.textContent = count + ' von ' + rules.length + ' ' + (count === 1 ? 'Regel ausgewählt' : 'Regeln ausgewählt');
    countBadge.style.background = count > 0 ? '#0284c7' : '#334155';
  }
  if (exportCount) exportCount.textContent = String(count);
  if (deleteCount) deleteCount.textContent = String(count);
  if (openModalBtn) {
    openModalBtn.textContent = count > 0 ? '✏️ Massenbearbeitung (' + count + ')...' : '✏️ Massenbearbeitung...';
  }

  let activeCount = 0;
  rules.forEach((r) => {
    if (selectedRuleIds.has(r.id) && r.enabled) activeCount++;
  });
  const inactiveCount = count - activeCount;
  if (statsText) {
    statsText.textContent = activeCount + ' aktiv · ' + inactiveCount + ' inaktiv';
  }

  if (hint) {
    if (count > 0) {
      hint.innerHTML = '<span style="color:#38bdf8; font-weight:700;">✓ ' + count + ' ' + (count === 1 ? 'Regel ausgewählt.' : 'Regeln ausgewählt.') + '</span> Klicken Sie auf <strong>"Massenbearbeitung"</strong>, <strong>"Farb-Sync"</strong> oder eine der Schnellaktionen oben.';
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
  const rules = appConfig.rules || [];
  if (selectedRuleIds.size === 0) {
    if (rules.length === 0) {
      alert('Es sind noch keine Regeln vorhanden, die bearbeitet werden könnten.');
      return;
    }
    // Automatically select all rules if none were explicitly checked
    rules.forEach((r) => selectedRuleIds.add(r.id));
    updateBulkToolbar();
    renderRules();
  }

  const count = selectedRuleIds.size;
  const overlay = document.getElementById('bulk-edit-modal-overlay');
  const title = document.getElementById('bulk-edit-title');
  if (title) {
    title.textContent = '✏️ Massenbearbeitung (' + count + ' ' + (count === 1 ? 'Regel' : 'Regeln') + ')';
  }

  // Reset form controls
  const statusSel = document.getElementById('be-status');
  if (statusSel) statusSel.value = 'keep';
  const modeSel = document.getElementById('be-mode');
  if (modeSel) modeSel.value = 'keep';
  const topbarSel = document.getElementById('be-topbar');
  if (topbarSel) topbarSel.value = 'keep';

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
        if (selectedRuleIds.size === 0) {
          (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
        }
        (appConfig.rules || []).forEach((r) => {
          if (selectedRuleIds.has(r.id)) {
            r.color = opt.hex;
            r.firefoxContainerColor = opt.id;
          }
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
        if (selectedRuleIds.size === 0) {
          (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
        }
        (appConfig.rules || []).forEach((r) => {
          if (selectedRuleIds.has(r.id)) {
            r.firefoxContainerIcon = opt.id;
          }
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
        if (selectedRuleIds.size === 0) {
          (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
        }
        (appConfig.rules || []).forEach((r) => {
          if (selectedRuleIds.has(r.id)) {
            let clean = r.containerName || '';
            if (r.customEmoji && clean.startsWith(r.customEmoji)) {
              clean = clean.slice(r.customEmoji.length).trim();
            }
            r.customEmoji = em;
            r.containerName = em + ' ' + clean;
          }
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
    if (selectedRuleIds.size === 0) {
      (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
    }
    (appConfig.rules || []).forEach((r) => {
      if (selectedRuleIds.has(r.id)) {
        r.color = hex;
      }
    });
    await saveConfigToStorage();
    closeBulkPopovers();
    renderRules();
  });

  document.getElementById('btn-bulk-emoji-apply')?.addEventListener('click', async () => {
    const em = (document.getElementById('bulk-emoji-input')?.value || '').trim();
    if (!em) return;
    if (selectedRuleIds.size === 0) {
      (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
    }
    (appConfig.rules || []).forEach((r) => {
      if (selectedRuleIds.has(r.id)) {
        let clean = r.containerName || '';
        if (r.customEmoji && clean.startsWith(r.customEmoji)) {
          clean = clean.slice(r.customEmoji.length).trim();
        }
        r.customEmoji = em;
        r.containerName = em + ' ' + clean;
      }
    });
    await saveConfigToStorage();
    closeBulkPopovers();
    renderRules();
  });

  document.getElementById('btn-bulk-emoji-clear')?.addEventListener('click', async () => {
    if (selectedRuleIds.size === 0) {
      (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
    }
    (appConfig.rules || []).forEach((r) => {
      if (selectedRuleIds.has(r.id)) {
        let clean = r.containerName || '';
        if (r.customEmoji && clean.startsWith(r.customEmoji)) {
          clean = clean.slice(r.customEmoji.length).trim();
        }
        r.customEmoji = '';
        r.containerName = clean;
      }
    });
    await saveConfigToStorage();
    closeBulkPopovers();
    renderRules();
  });

  // Master Checkbox
  document.getElementById('chk-all-rules')?.addEventListener('change', () => {
    const rules = appConfig.rules || [];
    if (selectedRuleIds.size === rules.length) {
      selectedRuleIds.clear();
    } else {
      rules.forEach((r) => selectedRuleIds.add(r.id));
    }
    updateBulkToolbar();
    renderRules();
  });

  // Select all & clear buttons
  document.getElementById('btn-bulk-select-all')?.addEventListener('click', () => {
    (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
    updateBulkToolbar();
    renderRules();
  });

  document.getElementById('btn-bulk-clear')?.addEventListener('click', () => {
    selectedRuleIds.clear();
    updateBulkToolbar();
    renderRules();
  });

  // Enable / Disable / Toggle buttons
  document.getElementById('btn-bulk-enable')?.addEventListener('click', async () => {
    if (selectedRuleIds.size === 0) {
      (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
    }
    (appConfig.rules || []).forEach((r) => {
      if (selectedRuleIds.has(r.id)) r.enabled = true;
    });
    await saveConfigToStorage();
    renderRules();
  });

  document.getElementById('btn-bulk-disable')?.addEventListener('click', async () => {
    if (selectedRuleIds.size === 0) {
      (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
    }
    (appConfig.rules || []).forEach((r) => {
      if (selectedRuleIds.has(r.id)) r.enabled = false;
    });
    await saveConfigToStorage();
    renderRules();
  });

  document.getElementById('btn-bulk-toggle')?.addEventListener('click', async () => {
    if (selectedRuleIds.size === 0) {
      (appConfig.rules || []).forEach((r) => selectedRuleIds.add(r.id));
    }
    (appConfig.rules || []).forEach((r) => {
      if (selectedRuleIds.has(r.id)) r.enabled = !r.enabled;
    });
    await saveConfigToStorage();
    renderRules();
  });

  // Bulk Delete
  document.getElementById('btn-bulk-delete')?.addEventListener('click', async () => {
    const count = selectedRuleIds.size;
    if (count === 0) {
      alert('Bitte markieren Sie zuerst mindestens eine Regel zum Löschen.');
      return;
    }
    if (confirm('Möchten Sie alle ' + count + ' ausgewählten Regeln wirklich löschen?')) {
      appConfig.rules = (appConfig.rules || []).filter((r) => !selectedRuleIds.has(r.id));
      appConfig.rules.forEach((r, i) => r.priority = i + 1);
      selectedRuleIds.clear();
      await saveConfigToStorage();
      renderRules();
    }
  });

  // Bulk Export
  document.getElementById('btn-bulk-export')?.addEventListener('click', () => {
    const selectedRules = (appConfig.rules || []).filter((r) => selectedRuleIds.has(r.id));
    if (selectedRules.length === 0) {
      alert('Bitte markieren Sie mindestens eine Regel für den Export.');
      return;
    }
    const blob = new Blob([JSON.stringify(selectedRules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tabchroma-rules-selected-' + selectedRules.length + '.json';
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
