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
  if (!rule) return;

  // If container routing is active for this rule
  if (rule.colorMode === 'container' || rule.colorMode === 'hybrid') {
    try {
      const tab = await browser.tabs.get(details.tabId);
      const container = await getOrCreateContainer(
        rule.containerName || rule.name,
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
    } catch (err) {
      console.warn('[TabChroma] Tab routing error:', err);
    }
  }
});

// Update window theme when switching active tab
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (!tab || !tab.url) return;
    const rule = findMatchingRule(tab.url);
    await applyThemeForTab(activeInfo.windowId, rule);

    // Notify content script of accent color
    if (rule) {
      browser.tabs.sendMessage(tab.id, {
        action: 'UPDATE_ACCENT_COLOR',
        color: rule.color,
        accentBorder: rule.accentBorder,
        enableTopBar: appConfig.enablePageTopBar,
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
 * Injects subtle top color bar or colored favicon indicator
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

  // Request initial color matching from background
  try {
    browser.runtime.sendMessage({ action: 'MATCH_URL', url: window.location.href }).then((response) => {
      if (response && response.matched && response.rule) {
        if (response.rule.accentBorder) {
          renderTopBar(response.rule.color);
        }
      }
    }).catch(() => {});
  } catch (e) {}

  // Listen for real-time accent updates
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'UPDATE_ACCENT_COLOR') {
      if (msg.accentBorder || msg.enableTopBar) {
        renderTopBar(msg.color);
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
    .container { max-width: 960px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .desc { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: #0284c7; color: white; }
    .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }
    .btn:hover { opacity: 0.9; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #111827; border-radius: 8px; overflow: hidden; border: 1px solid #1f2937; }
    th { text-align: left; padding: 12px 16px; font-size: 12px; text-transform: uppercase; color: #6b7280; background: #1f2937; }
    td { padding: 12px 16px; border-top: 1px solid #1f2937; font-size: 13px; vertical-align: middle; }
    .color-swatch { width: 16px; height: 16px; border-radius: 4px; display: inline-block; vertical-align: middle; margin-right: 8px; }
    .pattern-code { font-family: monospace; background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #38bdf8; }
    .badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #374151; color: #d1d5db; }
    .actions-bar { display: flex; gap: 10px; margin-bottom: 16px; }
    .del-btn { background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; border: none; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>TabChroma Rules Configuration</h1>
        <div class="desc">Define which URLs should get which Firefox tab color and container identity.</div>
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
          <th>Color</th>
          <th>Rule Name</th>
          <th>Match Type</th>
          <th>Pattern</th>
          <th>Container</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="rules-body">
        <!-- Rendered by options.js -->
      </tbody>
    </table>
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
 */

let appConfig = null;

async function loadConfig() {
  try {
    appConfig = await browser.runtime.sendMessage({ action: 'GET_CONFIG' });
    renderRules();
  } catch (e) {
    console.error('Failed to load rules:', e);
  }
}

function renderRules() {
  const tbody = document.getElementById('rules-body');
  if (!tbody) return;

  tbody.textContent = '';

  if (!appConfig || !appConfig.rules || appConfig.rules.length === 0) {
    const emptyTr = document.createElement('tr');
    const emptyTd = document.createElement('td');
    emptyTd.colSpan = 7;
    emptyTd.style.textAlign = 'center';
    emptyTd.style.padding = '32px';
    emptyTd.style.color = '#64748b';
    emptyTd.textContent = 'No rules configured. Click "+ Add New Rule" to create one.';
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    return;
  }

  appConfig.rules.forEach((rule, idx) => {
    const tr = document.createElement('tr');

    const tdColor = document.createElement('td');
    const swatch = document.createElement('span');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = rule.color || '#37adff';
    tdColor.appendChild(swatch);
    tdColor.appendChild(document.createTextNode(rule.firefoxContainerColor || 'blue'));
    tr.appendChild(tdColor);

    const tdName = document.createElement('td');
    tdName.style.fontWeight = '600';
    tdName.textContent = rule.name || '';
    tr.appendChild(tdName);

    const tdType = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = rule.patternType || 'domain';
    tdType.appendChild(badge);
    tr.appendChild(tdType);

    const tdPattern = document.createElement('td');
    const code = document.createElement('code');
    code.className = 'pattern-code';
    code.textContent = rule.pattern || '';
    tdPattern.appendChild(code);
    tr.appendChild(tdPattern);

    const tdContainer = document.createElement('td');
    tdContainer.textContent = rule.containerName || '-';
    tr.appendChild(tdContainer);

    const tdStatus = document.createElement('td');
    const statusSpan = document.createElement('span');
    if (rule.enabled) {
      statusSpan.style.color = '#10b981';
      statusSpan.textContent = 'Enabled';
    } else {
      statusSpan.style.color = '#64748b';
      statusSpan.textContent = 'Disabled';
    }
    tdStatus.appendChild(statusSpan);
    tr.appendChild(tdStatus);

    const tdAction = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      appConfig.rules.splice(idx, 1);
      await browser.runtime.sendMessage({ action: 'SAVE_CONFIG', config: appConfig });
      renderRules();
    });
    tdAction.appendChild(delBtn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}

document.getElementById('btn-add-rule').addEventListener('click', async () => {
  const pattern = prompt('Enter URL or Domain pattern (e.g., github.com or *.staging.com/*):');
  if (!pattern) return;
  const name = prompt('Enter a label for this rule:', pattern);
  const color = prompt('Choose color (blue, turquoise, green, yellow, orange, red, pink, purple):', 'blue') || 'blue';

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

  const newRule = {
    id: 'rule-' + Date.now(),
    name: name || pattern,
    patternType: pattern.includes('*') ? 'wildcard' : 'domain',
    pattern,
    color: hexMap[color] || '#37adff',
    firefoxContainerColor: color,
    firefoxContainerIcon: 'circle',
    containerName: name || pattern,
    colorMode: 'hybrid',
    accentBorder: true,
    enabled: true,
    priority: (appConfig.rules?.length || 0) + 1,
  };

  appConfig.rules = [...(appConfig.rules || []), newRule];
  await browser.runtime.sendMessage({ action: 'SAVE_CONFIG', config: appConfig });
  renderRules();
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
        if (parsed.rules) {
          appConfig = parsed;
          await browser.runtime.sendMessage({ action: 'SAVE_CONFIG', config: appConfig });
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
export async function downloadExtensionZip(config: ExtensionConfig, filename = 'tabchroma-firefox-addon.zip'): Promise<void> {
  const files = generateExtensionFiles(config);
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Packs all files into a Firefox .xpi archive with application/x-xpinstall MIME type
 * Firefox can install this file directly via "Install Add-on From File..." or Drag & Drop.
 */
export async function downloadExtensionXpi(config: ExtensionConfig, filename = 'tabchroma-tab-color.xpi'): Promise<void> {
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
  anchor.download = filename;
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
