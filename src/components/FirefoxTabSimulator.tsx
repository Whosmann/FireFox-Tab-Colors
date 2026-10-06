import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Lock, 
  Star, 
  Plus, 
  X, 
  Puzzle, 
  ExternalLink,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { TabColorRule, TabSimulatorItem } from '../types/extension';
import { matchUrlAgainstRules } from '../utils/urlMatcher';

interface FirefoxTabSimulatorProps {
  rules: TabColorRule[];
  onAddRuleClick?: () => void;
}

const DEFAULT_SIMULATOR_TABS: TabSimulatorItem[] = [
  {
    id: 'tab-1',
    title: 'console.aws.amazon.com/ecs',
    url: 'https://console.aws.amazon.com/ecs/home',
    favicon: '☁️',
    matchedRuleId: null,
  },
  {
    id: 'tab-2',
    title: 'app.staging.example.com',
    url: 'https://app.staging.example.com/api/v1/health',
    favicon: '🧪',
    matchedRuleId: null,
  },
  {
    id: 'tab-3',
    title: 'localhost:3000 - Local Dev Server',
    url: 'http://localhost:3000/dashboard',
    favicon: '⚡',
    matchedRuleId: null,
  },
  {
    id: 'tab-4',
    title: 'github.com/organization/repo',
    url: 'https://github.com/organization/main-service',
    favicon: '🐙',
    matchedRuleId: null,
  },
  {
    id: 'tab-5',
    title: 'Hacker News - Unmatched URL',
    url: 'https://news.ycombinator.com',
    favicon: '📰',
    matchedRuleId: null,
  },
];

export const FirefoxTabSimulator: React.FC<FirefoxTabSimulatorProps> = ({ rules, onAddRuleClick }) => {
  const [tabs, setTabs] = useState<TabSimulatorItem[]>(DEFAULT_SIMULATOR_TABS);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [inputUrl, setInputUrl] = useState<string>('https://console.aws.amazon.com/ecs/home');
  const [browserTheme, setBrowserTheme] = useState<'dark' | 'light'>('dark');

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activeMatch = matchUrlAgainstRules(activeTab?.url || '', rules);

  const handleSelectTab = (tab: TabSimulatorItem) => {
    setActiveTabId(tab.id);
    setInputUrl(tab.url);
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTab) return;
    const updated = tabs.map((t) => {
      if (t.id === activeTabId) {
        let clean = inputUrl.trim();
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
          clean = `https://${clean}`;
        }
        return {
          ...t,
          url: clean,
          title: clean.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') || 'Web Page',
        };
      }
      return t;
    });
    setTabs(updated);
  };

  const handleAddTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: TabSimulatorItem = {
      id: newId,
      title: 'New Tab',
      url: 'https://api.prod.company.net/v2/orders',
      favicon: '🌐',
      matchedRuleId: null,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
    setInputUrl(newTab.url);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return; // Keep at least one tab
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[0].id);
      setInputUrl(nextTabs[0].url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span className="text-orange-500">🦊</span>
            Interactive Firefox Browser Simulator
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time preview of Firefox tabs with container stripes, adaptive active theme tinting, and address bar badges.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setBrowserTheme('dark')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                browserTheme === 'dark' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dark Theme
            </button>
            <button
              onClick={() => setBrowserTheme('light')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                browserTheme === 'light' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Light Theme
            </button>
          </div>

          <button
            onClick={handleAddTab}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Open Tab</span>
          </button>
        </div>
      </div>

      {/* Firefox Browser Window Frame */}
      <div
        className={`rounded-2xl border shadow-lg overflow-hidden transition-all duration-300 ${
          browserTheme === 'dark'
            ? 'bg-[#181825] border-slate-800 text-slate-100'
            : 'bg-[#e3e5e8] border-slate-300 text-slate-800'
        }`}
      >
        {/* Top Window Titlebar & Tab Strip */}
        <div
          className={`pt-2 px-2 flex items-end gap-1 overflow-x-auto select-none ${
            browserTheme === 'dark' ? 'bg-[#11111b]' : 'bg-[#d0d3d8]'
          }`}
          style={{ minHeight: '44px' }}
        >
          {/* Window action dots */}
          <div className="flex items-center gap-1.5 px-2 pb-2.5 mr-2 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]" />
          </div>

          {/* Tab Strip Items */}
          <div className="flex items-end gap-1 flex-1 overflow-x-auto pb-0">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const match = matchUrlAgainstRules(tab.url, rules);
              const tabColor = match.matched && match.rule ? match.rule.color : null;
              const containerName = match.matched && match.rule ? match.rule.containerName : null;

              return (
                <div
                  key={tab.id}
                  onClick={() => handleSelectTab(tab)}
                  className={`group relative flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer transition-all duration-150 min-w-[140px] max-w-[220px] rounded-t-lg select-none shrink-0 ${
                    isActive
                      ? browserTheme === 'dark'
                        ? 'bg-[#1e1e2e] text-white shadow-sm'
                        : 'bg-white text-slate-900 shadow-sm'
                      : browserTheme === 'dark'
                      ? 'text-slate-400 hover:bg-[#181825]/80 hover:text-slate-200'
                      : 'text-slate-600 hover:bg-[#e3e5e8] hover:text-slate-900'
                  }`}
                  style={{
                    borderTop: tabColor ? `3px solid ${tabColor}` : '3px solid transparent',
                  }}
                >
                  {/* Favicon */}
                  <span className="text-sm shrink-0">
                    {match.matched && match.rule?.customEmoji && match.rule.enableFaviconEmoji !== false
                      ? match.rule.customEmoji
                      : (tab.favicon || '🌐')}
                  </span>

                  {/* Title & Container Subtitle */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate text-xs font-medium leading-tight">
                      {match.matched && match.rule?.customEmoji && match.rule.enableTitleEmoji !== false
                        ? `${match.rule.customEmoji} `
                        : ''}
                      {tab.title}
                    </span>
                    {containerName && (
                      <span
                        className="text-[10px] truncate font-normal opacity-80 leading-none mt-0.5"
                        style={{ color: tabColor || '#38bdf8' }}
                      >
                        {match.matched && match.rule?.customEmoji && !containerName.startsWith(match.rule.customEmoji)
                          ? `${match.rule.customEmoji} `
                          : ''}
                        {containerName}
                      </span>
                    )}
                  </div>

                  {/* Close Tab Button */}
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-slate-500/20 text-slate-400 hover:text-slate-200 transition-opacity shrink-0"
                    title="Close tab"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  {/* Firefox Container Bottom Indicator */}
                  {tabColor && (
                    <div
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                      style={{ backgroundColor: tabColor }}
                    />
                  )}
                </div>
              );
            })}

            {/* New Tab Button */}
            <button
              onClick={handleAddTab}
              className={`p-1.5 mb-1 rounded-md text-xs transition-colors shrink-0 ${
                browserTheme === 'dark'
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Open a new tab"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Firefox Proton Navigation Toolbar */}
        <div
          className={`px-3 py-2 flex items-center gap-2 border-b transition-colors ${
            browserTheme === 'dark'
              ? 'bg-[#1e1e2e] border-slate-800/80'
              : 'bg-white border-slate-200'
          }`}
          style={
            activeMatch.matched && activeMatch.rule
              ? { borderBottomColor: activeMatch.rule.color }
              : {}
          }
        >
          {/* Navigation Controls */}
          <div className="flex items-center gap-1 text-slate-400 shrink-0">
            <button className="p-1.5 rounded-md hover:bg-slate-500/15 hover:text-slate-200 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-slate-500/15 hover:text-slate-200 transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-slate-500/15 hover:text-slate-200 transition-colors">
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Address Bar Form */}
          <form onSubmit={handleNavigate} className="flex-1 flex items-center min-w-0">
            <div
              className={`relative flex items-center w-full rounded-lg px-3 py-1.5 text-xs font-mono transition-all border ${
                browserTheme === 'dark'
                  ? 'bg-[#11111b] border-slate-700/60 text-slate-200 focus-within:border-sky-500'
                  : 'bg-slate-100 border-slate-300 text-slate-800 focus-within:border-sky-500'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-emerald-500 mr-2 shrink-0" />

              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full bg-transparent focus:outline-none text-xs truncate"
                placeholder="Search or enter address"
              />

              {/* Firefox Native Container Pill in Omnibox */}
              {activeMatch.matched && activeMatch.rule && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-sans font-medium shrink-0 ml-2 shadow-xs"
                  style={{
                    backgroundColor: `${activeMatch.rule.color}22`,
                    color: activeMatch.rule.color,
                    border: `1px solid ${activeMatch.rule.color}55`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeMatch.rule.color }}
                  />
                  <span className="truncate max-w-[130px] font-semibold">
                    {activeMatch.rule.containerName}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-slate-400 ml-2 shrink-0">
                <Star className="w-3.5 h-3.5 hover:text-amber-400 cursor-pointer transition-colors" />
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              </div>
            </div>
          </form>

          {/* Extensions Puzzle Piece */}
          <div className="flex items-center gap-1 text-slate-400 shrink-0">
            <div
              className="p-1.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-400/20 cursor-pointer"
              title="TabChroma Extension Active"
            >
              <Puzzle className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Tab Viewport / Simulated Page Canvas */}
        <div
          className={`p-6 min-h-[300px] relative transition-colors ${
            browserTheme === 'dark' ? 'bg-[#181825]' : 'bg-[#f8fafc]'
          }`}
        >
          {/* Top Page Accent Strip (if enabled) */}
          {activeMatch.matched && activeMatch.rule?.accentBorder && (
            <div
              className="absolute top-0 left-0 right-0 h-1 shadow-sm"
              style={{ backgroundColor: activeMatch.rule.color }}
            />
          )}

          {/* Active Container Status Banner */}
          {activeMatch.matched && activeMatch.rule ? (
            <div className="max-w-2xl mx-auto space-y-4">
              <div
                className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{
                  backgroundColor: `${activeMatch.rule.color}10`,
                  borderColor: `${activeMatch.rule.color}40`,
                }}
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm"
                    style={{ backgroundColor: activeMatch.rule.color }}
                  >
                    🦊
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Active Rule Matched
                      </span>
                      <span className="text-slate-400">·</span>
                      <span
                        className="text-xs font-bold"
                        style={{ color: activeMatch.rule.color }}
                      >
                        {activeMatch.rule.name}
                      </span>
                    </div>
                    <div
                      className={`text-sm font-semibold mt-0.5 ${
                        browserTheme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      Container: {activeMatch.rule.containerName} ({activeMatch.rule.firefoxContainerColor})
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                  <span
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: activeMatch.rule.color }}
                  >
                    {activeMatch.rule.color}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Mode: {activeMatch.rule.colorMode}
                  </span>
                </div>
              </div>

              {/* Technical Pipeline Explanation */}
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  browserTheme === 'dark'
                    ? 'bg-[#11111b] border-slate-800 text-slate-300'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  How Firefox Applies This Tab Color:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
                  <li>
                    <strong>WebNavigation Intercept:</strong> Intercepted navigation to{' '}
                    <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[11px]">
                      {activeTab.url}
                    </code>
                  </li>
                  <li>
                    <strong>Pattern Evaluation:</strong> Matched{' '}
                    <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[11px]">
                      {activeMatch.rule.patternType}: {activeMatch.rule.pattern}
                    </code>
                  </li>
                  <li>
                    <strong>Firefox Contextual Identity:</strong> Opened in container{' '}
                    <span className="font-semibold text-sky-500">
                      "{activeMatch.rule.containerName}"
                    </span>{' '}
                    with color{' '}
                    <span className="font-mono text-xs">{activeMatch.rule.firefoxContainerColor}</span>.
                  </li>
                  <li>
                    <strong>Dynamic Theme API:</strong> Updated Firefox window theme accent line to{' '}
                    <span className="font-mono text-xs">{activeMatch.rule.color}</span>.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="max-w-lg mx-auto text-center py-10 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
                🌐
              </div>
              <h3 className={`text-sm font-semibold ${browserTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Standard Tab (No Color Rule)
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                The current URL{' '}
                <code className="font-mono text-[11px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">
                  {activeTab?.url}
                </code>{' '}
                did not match any configured rule. It renders with standard Firefox gray chrome.
              </p>
              {onAddRuleClick && (
                <button
                  onClick={onAddRuleClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Define Rule for This URL</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
