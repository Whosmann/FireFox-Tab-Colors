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
    const data = await browser.storage.local.get(['tabChromaConfig']);
    if (data.tabChromaConfig) {
      appConfig = data.tabChromaConfig;
      currentRules = appConfig.rules || [];
    } else {
      await browser.storage.local.set({ tabChromaConfig: DEFAULT_CONFIG });
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

// Apply dynamic theme color to active window
async function applyThemeForTab(windowId, rule) {
  if (!appConfig.enableActiveTabTheme) return;

  if (rule && rule.color) {
    const hex = rule.color;
    try {
      await browser.theme.update(windowId, {
        colors: {
          frame: '#181825',
          toolbar: '#1e1e2e',
          tab_selected: hex,
          tab_line: hex,
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

// Update window theme when switching active tab
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (!tab || !tab.url) return;
    const rule = findMatchingRule(tab.url);
    await applyThemeForTab(activeInfo.windowId, rule);

    // Notify content script of accent color & custom tab symbol
    if (rule) {
      browser.tabs.sendMessage(tab.id, {
        action: 'UPDATE_ACCENT_COLOR',
        color: rule.color,
        accentBorder: rule.accentBorder,
        enableTopBar: appConfig.enablePageTopBar,
        customEmoji: rule.customEmoji,
        enableTitleEmoji: rule.enableTitleEmoji !== false,
        enableFaviconEmoji: rule.enableFaviconEmoji !== false,
      }).catch(() => {});
    }
  } catch (err) {}
});

// Listen for tab URL updates
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    const rule = findMatchingRule(changeInfo.url);
    await applyThemeForTab(tab.windowId, rule);
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

  function updateTitleEmoji(emoji) {
    if (!emoji) return;
    if (!document.title.startsWith(emoji)) {
      document.title = emoji + ' ' + document.title;
    }
  }

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
      }
      link.href = canvas.toDataURL('image/png');
    } catch (e) {}
  }

  function applyRuleVisuals(rule) {
    if (!rule) return;
    if (rule.accentBorder) {
      renderTopBar(rule.color);
    }
    if (rule.customEmoji) {
      if (rule.enableTitleEmoji !== false) {
        updateTitleEmoji(rule.customEmoji);
      }
      if (rule.enableFaviconEmoji !== false) {
        renderFaviconEmoji(rule.customEmoji, rule.color);
      }
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
      }
      if (msg.customEmoji) {
        if (msg.enableTitleEmoji) {
          updateTitleEmoji(msg.customEmoji);
        }
        if (msg.enableFaviconEmoji) {
          renderFaviconEmoji(msg.customEmoji, msg.color);
        }
      }
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TabChroma - Firefox URL Tab Color Rules</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b0f19; color: #f8fafc; padding: 28px; line-height: 1.5; }
    .container { max-width: 1040px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 20px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .desc { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: opacity 0.15s; }
    .btn-primary { background: #0284c7; color: white; }
    .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }
    .btn:hover { opacity: 0.9; }
    .actions-bar { display: flex; gap: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #111827; border-radius: 8px; overflow: hidden; border: 1px solid #1f2937; }
    th { text-align: left; padding: 12px 14px; font-size: 11px; text-transform: uppercase; color: #94a3b8; background: #1f2937; letter-spacing: 0.05em; }
    td { padding: 12px 14px; border-top: 1px solid #1f2937; font-size: 13px; vertical-align: middle; }
    .color-swatch { width: 16px; height: 16px; border-radius: 4px; display: inline-block; vertical-align: middle; margin-right: 8px; }
    .pattern-code { font-family: monospace; background: #1e293b; padding: 3px 7px; border-radius: 4px; font-size: 12px; color: #38bdf8; word-break: break-all; }
    .badge { font-size: 11px; padding: 2px 7px; border-radius: 4px; background: #374151; color: #d1d5db; font-family: monospace; }
    .btn-cell { display: flex; gap: 6px; align-items: center; justify-content: flex-end; }
    .edit-btn { background: #0284c7; color: white; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; }
    .del-btn { background: #ef4444; color: white; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; }
    .priority-btn { background: #1f2937; color: #94a3b8; border: 1px solid #374151; border-radius: 4px; width: 22px; height: 22px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .priority-btn:hover { color: #fff; background: #374151; }
    .edit-btn:hover, .del-btn:hover { opacity: 0.85; }

    /* Modal Styles */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 16px; backdrop-filter: blur(2px); }
    .modal-overlay.active { display: flex; }
    .modal { background: #111827; border: 1px solid #374151; border-radius: 12px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; padding-bottom: 12px; margin-bottom: 18px; }
    .modal-title { font-size: 17px; font-weight: 700; color: #f8fafc; }
    .close-btn { background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; line-height: 1; }
    .close-btn:hover { color: #fff; }
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 5px; }
    .form-input, .form-select { width: 100%; padding: 8px 12px; background: #1e293b; border: 1px solid #374151; border-radius: 6px; color: #f8fafc; font-size: 13px; outline: none; }
    .form-input:focus, .form-select:focus { border-color: #38bdf8; }
    .form-hint { font-size: 11px; color: #64748b; margin-top: 4px; }
    .color-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 6px; margin-bottom: 8px; }
    .color-opt { height: 32px; border-radius: 6px; border: 2px solid transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
    .color-opt.selected { border-color: #fff; box-shadow: 0 0 0 2px #38bdf8; }
    .icon-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 6px; }
    .icon-btn { background: #1e293b; border: 1px solid #374151; border-radius: 8px; padding: 6px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: #cbd5e1; transition: all 0.15s; }
    .icon-btn:hover { background: #334155; color: #fff; border-color: #64748b; }
    .icon-btn.selected { background: rgba(56, 189, 248, 0.15); border-color: #38bdf8; color: #38bdf8; font-weight: 700; box-shadow: 0 0 0 1px #38bdf8; }
    .icon-sym { font-size: 16px; margin-bottom: 2px; }
    .icon-lbl { font-size: 10px; }
    .update-banner { background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 14px 18px; margin-top: 24px; font-size: 12px; color: #94a3b8; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .update-banner code { background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    .preview-box { background: #1e293b; border-radius: 8px; padding: 12px; margin-top: 14px; border: 1px solid #334155; }
    .preview-tab { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 6px 6px 0 0; background: #0f172a; color: #fff; font-size: 12px; font-weight: 600; border-top: 3px solid #ff4f5e; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 14px; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>TabChroma Rules Configuration</h1>
        <div class="desc">Define and edit which URLs should get which Firefox tab color and container identity.</div>
      </div>
      <div class="actions-bar">
        <button id="btn-export" class="btn btn-secondary">Export JSON</button>
        <button id="btn-import" class="btn btn-secondary">Import JSON</button>
        <button id="btn-add-rule" class="btn btn-primary">+ Add New Rule</button>
      </div>
    </header>

    <table id="rules-table">
      <thead>
        <tr>
          <th style="width: 70px;">Priority</th>
          <th>Color</th>
          <th>Rule Name</th>
          <th>Match Type</th>
          <th>Pattern</th>
          <th>Container</th>
          <th>Status</th>
          <th style="text-align: right;">Action</th>
        </tr>
      </thead>
      <tbody id="rules-body">
        <!-- Rendered by options.js -->
      </tbody>
    </table>

    <div class="update-banner">
      <div>
        <strong style="color: #f8fafc;">📦 How to update this package in Firefox:</strong>
        <span style="margin-left: 6px;">Open <code>about:addons</code> &rarr; click <strong>⚙️ (Gear icon)</strong> &rarr; <strong>"Install Add-on From File..."</strong> and select your newly downloaded <code>.xpi</code>. Firefox will update TabChroma in-place and preserve your rules!</span>
      </div>
    </div>
  </div>

  <!-- Rule Edit & Create Modal -->
  <div id="modal-overlay" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">Edit Tab Color Rule</h2>
        <button id="modal-close" class="close-btn">&times;</button>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-name">Rule Name / Label</label>
        <input type="text" id="inp-name" class="form-input" placeholder="e.g. AWS Production Console, GitHub">
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-type">Match Type</label>
        <select id="inp-type" class="form-select">
          <option value="domain">Domain (Matches domain and all subdomains)</option>
          <option value="exact_host">Exact Host (Only this exact host/subdomain, e.g. 248924.4.whomsann.de)</option>
          <option value="wildcard">Wildcard (e.g. *.staging.com/*, localhost:*)</option>
          <option value="prefix">Prefix (e.g. https://console.aws.amazon.com/)</option>
          <option value="regex">Regular Expression (e.g. ^https?:\/\/(prod|live)\..*)</option>
          <option value="exact">Exact URL (Full address equality)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-pattern">URL Pattern</label>
        <input type="text" id="inp-pattern" class="form-input" style="font-family: monospace;" placeholder="e.g. github.com or *.staging.internal/*">
        <div id="pattern-hint" class="form-hint">Matches exact domain and any subdomains.</div>
      </div>

      <div class="form-group">
        <label class="form-label">Firefox Container Color</label>
        <div class="color-grid" id="color-grid">
          <button type="button" class="color-opt" data-color="blue" data-hex="#37adff" style="background:#37adff;">Blue</button>
          <button type="button" class="color-opt" data-color="turquoise" data-hex="#00c79a" style="background:#00c79a;">Turquoise</button>
          <button type="button" class="color-opt" data-color="green" data-hex="#51cf66" style="background:#51cf66;">Green</button>
          <button type="button" class="color-opt" data-color="yellow" data-hex="#ffcb00" style="background:#ffcb00; color:#000;">Yellow</button>
          <button type="button" class="color-opt" data-color="orange" data-hex="#ff9400" style="background:#ff9400;">Orange</button>
          <button type="button" class="color-opt" data-color="red" data-hex="#ff4f5e" style="background:#ff4f5e;">Red</button>
          <button type="button" class="color-opt" data-color="pink" data-hex="#ff4ba0" style="background:#ff4ba0;">Pink</button>
          <button type="button" class="color-opt" data-color="purple" data-hex="#9059ff" style="background:#9059ff;">Purple</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
          <span style="font-size:12px; color:#94a3b8;">Custom Hex:</span>
          <input type="text" id="inp-hex" class="form-input" style="width:100px; font-family:monospace;" value="#ff4f5e">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-container-name">Container Name</label>
        <input type="text" id="inp-container-name" class="form-input" placeholder="e.g. Production [Red], Work">
        <div class="form-hint">Displayed in the Firefox address bar container pill.</div>
      </div>

      <div class="form-group">
        <label class="form-label">Custom Tab Symbol / Emoji (e.g. ⬇️ for Import)</label>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
          <input type="text" id="inp-emoji" class="form-input" style="width:72px; text-align:center; font-size:16px;" placeholder="⬇️">
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="⬇️" style="padding:4px 8px; font-size:12px;">⬇️ Import</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="⬆️" style="padding:4px 8px; font-size:12px;">⬆️ Export</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="📥" style="padding:4px 8px; font-size:12px;">📥 Inbox</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="📦" style="padding:4px 8px; font-size:12px;">📦 Paket</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="🚀" style="padding:4px 8px; font-size:12px;">🚀 Prod</button>
            <button type="button" class="btn btn-secondary opt-sym-btn" data-sym="⚡" style="padding:4px 8px; font-size:12px;">⚡ Dev</button>
          </div>
        </div>
        <div class="form-hint">Custom symbol prepended to the tab title, favicon, and container name.</div>
      </div>

      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <label class="form-label" style="margin-bottom:0;">Firefox Container Icon Picker</label>
          <span id="icon-selected-label" style="font-size:11px; color:#38bdf8; font-weight:600;">● Circle</span>
        </div>
        <input type="hidden" id="inp-icon" value="circle">
        <div class="icon-grid" id="icon-grid">
          <button type="button" class="icon-btn" data-icon="circle" data-label="Circle"><span class="icon-sym">●</span><span class="icon-lbl">Circle</span></button>
          <button type="button" class="icon-btn" data-icon="briefcase" data-label="Briefcase"><span class="icon-sym">💼</span><span class="icon-lbl">Briefcase</span></button>
          <button type="button" class="icon-btn" data-icon="fingerprint" data-label="Security"><span class="icon-sym">🔒</span><span class="icon-lbl">Security</span></button>
          <button type="button" class="icon-btn" data-icon="dollar" data-label="Finance"><span class="icon-sym">💰</span><span class="icon-lbl">Finance</span></button>
          <button type="button" class="icon-btn" data-icon="cart" data-label="Shopping"><span class="icon-sym">🛒</span><span class="icon-lbl">Shopping</span></button>
          <button type="button" class="icon-btn" data-icon="tree" data-label="Dev / Tree"><span class="icon-sym">🌲</span><span class="icon-lbl">Dev / Tree</span></button>
          <button type="button" class="icon-btn" data-icon="chill" data-label="Chill"><span class="icon-sym">☕</span><span class="icon-lbl">Chill</span></button>
          <button type="button" class="icon-btn" data-icon="vacation" data-label="Vacation"><span class="icon-sym">🏖️</span><span class="icon-lbl">Vacation</span></button>
          <button type="button" class="icon-btn" data-icon="food" data-label="Food"><span class="icon-sym">🍔</span><span class="icon-lbl">Food</span></button>
          <button type="button" class="icon-btn" data-icon="fruit" data-label="Fruit"><span class="icon-sym">🍎</span><span class="icon-lbl">Fruit</span></button>
          <button type="button" class="icon-btn" data-icon="pet" data-label="Pet"><span class="icon-sym">🐾</span><span class="icon-lbl">Pet</span></button>
          <button type="button" class="icon-btn" data-icon="gift" data-label="Gift"><span class="icon-sym">🎁</span><span class="icon-lbl">Gift</span></button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-mode">Coloring Mode</label>
        <select id="inp-mode" class="form-select">
          <option value="hybrid">Hybrid (Container Tab Stripe + Dynamic Window Theme)</option>
          <option value="container">Container Tab Only (Native stripe and cookie isolation)</option>
          <option value="theme">Active Theme Only (Tints browser tab bar when active)</option>
        </select>
      </div>

      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="inp-topbar" checked style="cursor:pointer;">
        <label for="inp-topbar" style="font-size:12px; color:#cbd5e1; cursor:pointer;">
          Show 3px colored accent stripe across the top of matching web pages
        </label>
      </div>

      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="inp-enabled" checked style="cursor:pointer;">
        <label for="inp-enabled" style="font-size:12px; color:#cbd5e1; cursor:pointer;">
          Enable this rule
        </label>
      </div>

      <div class="preview-box">
        <div style="font-size:11px; text-transform:uppercase; color:#94a3b8; font-weight:700; margin-bottom:8px;">Tab Preview</div>
        <div id="preview-tab-elem" class="preview-tab">
          <span>🦊</span>
          <span id="preview-name-text">Rule Name</span>
        </div>
      </div>

      <div class="modal-footer">
        <button id="modal-cancel" class="btn btn-secondary">Cancel</button>
        <button id="modal-save" class="btn btn-primary">Save Rule</button>
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
 * TabChroma - Options Page Script
 * Full Edit, Create, Delete, and Priority Manager
 */

const DEFAULT_CONFIG = ${JSON.stringify(config, null, 2)};
let appConfig = DEFAULT_CONFIG;
let editingRuleIndex = -1; // -1 means creating new rule

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

async function loadConfig() {
  try {
    const data = await browser.storage.local.get(['tabChromaConfig']);
    if (data && data.tabChromaConfig && data.tabChromaConfig.rules) {
      appConfig = data.tabChromaConfig;
    } else {
      const response = await browser.runtime.sendMessage({ action: 'GET_CONFIG' });
      if (response && response.rules) {
        appConfig = response;
      }
    }
  } catch (e) {
    console.warn('[TabChroma] Fallback to embedded rules:', e);
  }
  if (!appConfig) appConfig = DEFAULT_CONFIG;
  if (!appConfig.rules) appConfig.rules = [];
  renderRules();
}

function renderRules() {
  const tbody = document.getElementById('rules-body');
  if (!tbody) return;

  tbody.textContent = '';

  if (!appConfig || !appConfig.rules || appConfig.rules.length === 0) {
    const emptyTr = document.createElement('tr');
    const emptyTd = document.createElement('td');
    emptyTd.colSpan = 8;
    emptyTd.style.textAlign = 'center';
    emptyTd.style.padding = '36px';
    emptyTd.style.color = '#64748b';
    emptyTd.textContent = 'No rules configured. Click "+ Add New Rule" to create one.';
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    return;
  }

  appConfig.rules.forEach((rule, idx) => {
    const tr = document.createElement('tr');

    // 1. Priority controls
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
      upBtn.title = 'Move Up';
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

    if (idx < appConfig.rules.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.className = 'priority-btn';
      downBtn.textContent = '▼';
      downBtn.title = 'Move Down';
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

    // 2. Color swatch
    const tdColor = document.createElement('td');
    const swatch = document.createElement('span');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = rule.color || '#37adff';
    tdColor.appendChild(swatch);
    tdColor.appendChild(document.createTextNode(rule.firefoxContainerColor || 'blue'));
    tr.appendChild(tdColor);

    // 3. Name (clickable to edit)
    const tdName = document.createElement('td');
    tdName.style.fontWeight = '600';
    tdName.style.cursor = 'pointer';
    tdName.title = 'Click to edit rule';
    tdName.textContent = rule.name || '';
    tdName.addEventListener('click', () => openModal(idx));
    tr.appendChild(tdName);

    // 4. Pattern type badge
    const tdType = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = rule.patternType || 'domain';
    tdType.appendChild(badge);
    tr.appendChild(tdType);

    // 5. Pattern code
    const tdPattern = document.createElement('td');
    const code = document.createElement('code');
    code.className = 'pattern-code';
    code.textContent = rule.pattern || '';
    tdPattern.appendChild(code);
    tr.appendChild(tdPattern);

    // 6. Container
    const tdContainer = document.createElement('td');
    const sym = iconSymbols[rule.firefoxContainerIcon || 'circle'] || '●';
    tdContainer.textContent = sym + ' ' + (rule.containerName || '-');
    tr.appendChild(tdContainer);

    // 7. Status
    const tdStatus = document.createElement('td');
    const statusBtn = document.createElement('span');
    statusBtn.style.cursor = 'pointer';
    if (rule.enabled) {
      statusBtn.style.color = '#10b981';
      statusBtn.textContent = '● Enabled';
    } else {
      statusBtn.style.color = '#64748b';
      statusBtn.textContent = '○ Disabled';
    }
    statusBtn.addEventListener('click', async () => {
      rule.enabled = !rule.enabled;
      await saveConfigToStorage();
      renderRules();
    });
    tdStatus.appendChild(statusBtn);
    tr.appendChild(tdStatus);

    // 8. Actions (EDIT + DELETE)
    const tdAction = document.createElement('td');
    tdAction.className = 'btn-cell';

    // Prominent EDIT button
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.title = 'Edit this rule';
    editBtn.addEventListener('click', () => openModal(idx));
    tdAction.appendChild(editBtn);

    // DELETE button
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = 'Delete';
    delBtn.title = 'Delete this rule';
    delBtn.addEventListener('click', async () => {
      if (confirm('Delete rule "' + (rule.name || rule.pattern) + '"?')) {
        appConfig.rules.splice(idx, 1);
        appConfig.rules.forEach((r, i) => r.priority = i + 1);
        await saveConfigToStorage();
        renderRules();
      }
    });
    tdAction.appendChild(delBtn);

    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

async function saveConfigToStorage() {
  try {
    await browser.storage.local.set({ tabChromaConfig: appConfig });
  } catch (e) {}
  try {
    await browser.runtime.sendMessage({ action: 'SAVE_CONFIG', config: appConfig });
  } catch (e) {}
}

// Modal handling
let selectedColorName = 'red';
let selectedColorHex = '#ff4f5e';
let selectedIcon = 'circle';

const iconSymbols = {
  circle: '●', briefcase: '💼', fingerprint: '🔒', dollar: '💰', cart: '🛒',
  tree: '🌲', chill: '☕', vacation: '🏖️', food: '🍔', fruit: '🍎', pet: '🐾', gift: '🎁'
};

function updateIconButtons() {
  document.querySelectorAll('.icon-btn').forEach((btn) => {
    if (btn.getAttribute('data-icon') === selectedIcon) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
  const lbl = document.getElementById('icon-selected-label');
  if (lbl) {
    const sym = iconSymbols[selectedIcon] || '●';
    lbl.textContent = sym + ' ' + selectedIcon.charAt(0).toUpperCase() + selectedIcon.slice(1);
  }
}

function openModal(index) {
  editingRuleIndex = index;
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const inpName = document.getElementById('inp-name');
  const inpType = document.getElementById('inp-type');
  const inpPattern = document.getElementById('inp-pattern');
  const inpHex = document.getElementById('inp-hex');
  const inpContainerName = document.getElementById('inp-container-name');
  const inpEmoji = document.getElementById('inp-emoji');
  const inpIcon = document.getElementById('inp-icon');
  const inpMode = document.getElementById('inp-mode');
  const inpTopBar = document.getElementById('inp-topbar');
  const inpEnabled = document.getElementById('inp-enabled');

  if (index >= 0) {
    const rule = appConfig.rules[index];
    title.textContent = 'Edit Rule: ' + (rule.name || rule.pattern);
    inpName.value = rule.name || '';
    inpType.value = rule.patternType || 'domain';
    inpPattern.value = rule.pattern || '';
    inpHex.value = rule.color || '#ff4f5e';
    selectedColorName = rule.firefoxContainerColor || 'red';
    selectedColorHex = rule.color || '#ff4f5e';
    selectedIcon = rule.firefoxContainerIcon || 'circle';
    inpIcon.value = selectedIcon;
    inpContainerName.value = rule.containerName || rule.name || '';
    if (inpEmoji) inpEmoji.value = rule.customEmoji || '';
    inpMode.value = rule.colorMode || 'hybrid';
    inpTopBar.checked = rule.accentBorder !== false;
    inpEnabled.checked = rule.enabled !== false;
  } else {
    title.textContent = 'Create New Tab Color Rule';
    inpName.value = '';
    inpType.value = 'domain';
    inpPattern.value = '';
    inpHex.value = '#37adff';
    selectedColorName = 'blue';
    selectedColorHex = '#37adff';
    selectedIcon = 'circle';
    inpIcon.value = selectedIcon;
    inpContainerName.value = '';
    if (inpEmoji) inpEmoji.value = '';
    inpMode.value = 'hybrid';
    inpTopBar.checked = true;
    inpEnabled.checked = true;
  }

  updateColorButtons();
  updateIconButtons();
  updatePreview();
  overlay.classList.add('active');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
  editingRuleIndex = -1;
}

function updateColorButtons() {
  document.querySelectorAll('.color-opt').forEach((btn) => {
    if (btn.getAttribute('data-color') === selectedColorName) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

function updatePreview() {
  const inpName = document.getElementById('inp-name');
  const previewTab = document.getElementById('preview-tab-elem');
  const previewText = document.getElementById('preview-name-text');
  const sym = iconSymbols[selectedIcon] || '🦊';
  previewText.textContent = sym + ' ' + (inpName.value || 'Tab Preview');
  previewTab.style.borderTopColor = selectedColorHex;
}

// Modal Icon buttons listener
document.querySelectorAll('.icon-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedIcon = btn.getAttribute('data-icon') || 'circle';
    document.getElementById('inp-icon').value = selectedIcon;
    updateIconButtons();
    updatePreview();
  });
});

// Modal Color options click listener
document.querySelectorAll('.color-opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedColorName = btn.getAttribute('data-color');
    selectedColorHex = btn.getAttribute('data-hex') || hexMap[selectedColorName] || '#37adff';
    document.getElementById('inp-hex').value = selectedColorHex;
    updateColorButtons();
    updatePreview();
  });
});

document.getElementById('inp-hex').addEventListener('input', (e) => {
  selectedColorHex = e.target.value;
  updatePreview();
});

document.getElementById('inp-name').addEventListener('input', updatePreview);

document.getElementById('inp-type').addEventListener('change', (e) => {
  const hint = document.getElementById('pattern-hint');
  const val = e.target.value;
  if (val === 'domain') hint.textContent = 'Matches exact domain and all subdomains (e.g. whomsann.de matches 248924.4.whomsann.de).';
  else if (val === 'exact_host') hint.textContent = 'Matches ONLY this exact host/subdomain (e.g. 248924.4.whomsann.de). Subdomains are isolated!';
  else if (val === 'wildcard') hint.textContent = 'Supports * for multiple characters and ? for single character (e.g. *.staging.com/*).';
  else if (val === 'prefix') hint.textContent = 'Matches any URL beginning with this exact text prefix.';
  else if (val === 'regex') hint.textContent = 'JavaScript regular expression (case-insensitive).';
  else if (val === 'exact') hint.textContent = 'Full exact URL match.';
});

// Modal save
document.getElementById('modal-save').addEventListener('click', async () => {
  const inpName = document.getElementById('inp-name').value.trim();
  const inpPattern = document.getElementById('inp-pattern').value.trim();
  const inpType = document.getElementById('inp-type').value;
  const inpHex = document.getElementById('inp-hex').value.trim() || selectedColorHex;
  const inpContainerName = document.getElementById('inp-container-name').value.trim() || inpName || inpPattern;
  const inpEmoji = (document.getElementById('inp-emoji')?.value || '').trim();
  const inpIcon = document.getElementById('inp-icon').value;
  const inpMode = document.getElementById('inp-mode').value;
  const inpTopBar = document.getElementById('inp-topbar').checked;
  const inpEnabled = document.getElementById('inp-enabled').checked;

  if (!inpPattern) {
    alert('Please enter a URL pattern.');
    return;
  }

  const finalName = inpName || inpPattern;

  if (editingRuleIndex >= 0) {
    // Edit existing rule
    const rule = appConfig.rules[editingRuleIndex];
    rule.name = finalName;
    rule.patternType = inpType;
    rule.pattern = inpPattern;
    rule.color = inpHex;
    rule.firefoxContainerColor = selectedColorName;
    rule.containerName = inpContainerName;
    rule.customEmoji = inpEmoji;
    rule.firefoxContainerIcon = inpIcon;
    rule.colorMode = inpMode;
    rule.accentBorder = inpTopBar;
    rule.enabled = inpEnabled;
  } else {
    // Create new rule
    const newRule = {
      id: 'rule-' + Date.now(),
      name: finalName,
      patternType: inpType,
      pattern: inpPattern,
      color: inpHex,
      firefoxContainerColor: selectedColorName,
      containerName: inpContainerName,
      customEmoji: inpEmoji,
      firefoxContainerIcon: inpIcon,
      colorMode: inpMode,
      accentBorder: inpTopBar,
      enabled: inpEnabled,
      priority: (appConfig.rules?.length || 0) + 1,
    };
    appConfig.rules = [...(appConfig.rules || []), newRule];
  }

  await saveConfigToStorage();
  closeModal();
  renderRules();
});

// Quick symbol buttons
document.querySelectorAll('.opt-sym-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sym = btn.getAttribute('data-sym');
    const inp = document.getElementById('inp-emoji');
    if (inp) {
      inp.value = sym;
    }
  });
});

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);

document.getElementById('btn-add-rule').addEventListener('click', () => {
  openModal(-1);
});

document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(appConfig, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tabchroma-rules.json';
  a.click();
});

document.getElementById('btn-import').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          appConfig.rules = parsed;
          await saveConfigToStorage();
          renderRules();
          alert('Rules imported successfully!');
        } else if (parsed.rules && Array.isArray(parsed.rules)) {
          appConfig = parsed;
          await saveConfigToStorage();
          renderRules();
          alert('Rules imported successfully!');
        }
      } catch (err) {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

document.addEventListener('DOMContentLoaded', loadConfig);
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
