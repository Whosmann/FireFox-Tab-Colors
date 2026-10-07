/**
 * TabChroma - Firefox URL Tab Color Extension Studio
 * Main Application
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FirefoxTabSimulator } from './components/FirefoxTabSimulator';
import { UrlTesterBar } from './components/UrlTesterBar';
import { RuleManager } from './components/RuleManager';
import { RuleEditorModal } from './components/RuleEditorModal';
import { VersionBumpModal } from './components/VersionBumpModal';
import { DefaultSettingsCard } from './components/DefaultSettingsCard';
import { SourceCodeViewer } from './components/SourceCodeViewer';
import { InstallGuideView } from './components/InstallGuideView';
import { PublishGuideView } from './components/PublishGuideView';
import { ExtensionConfig, TabColorRule } from './types/extension';
import { PRESET_PACKS, DUMMY_RULES } from './utils/presetRules';
import { downloadExtensionZip, downloadExtensionXpi } from './utils/extensionGenerator';

const INITIAL_RULES: TabColorRule[] = [
  ...PRESET_PACKS[0].rules,
];

const INITIAL_CONFIG: ExtensionConfig = {
  extensionName: 'TabChroma - URL Tab Color',
  extensionVersion: '1.0.1',
  extensionDescription: 'Automatically colors Firefox tabs based on custom URL patterns, regex rules, and Firefox Containers.',
  geckoId: 'tabchroma-tab-color@whosmann.de',
  defaultColor: '#37adff',
  defaultContainerColor: 'blue',
  defaultMode: 'container', // 'container' leaves Firefox's native browser window Farbschema untouched!
  rules: INITIAL_RULES,
  enablePageTopBar: true,
  enableFaviconBadge: true,
  enableActiveTabTheme: false, // Default false: new containers do NOT alter Firefox's browser window Farbschema!
  revertUnmatchedToDefault: true,
  activeTabOpacity: 0.35, // 35% Deckkraft: Gleichfarbige Favicons bleiben 100% erkennbar
  enableFaviconContrastHalo: true, // Schutz-Halo für Favicons
};

export default function App() {
  const [config, setConfig] = useState<ExtensionConfig>(() => {
    try {
      const saved = localStorage.getItem('tabchroma_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.extensionVersion || parsed.extensionVersion === '1.0.0') {
          parsed.extensionVersion = '1.0.1';
        }

        // Restore exact Mozilla AMO Add-on ID for registered extensions
        if (!parsed.geckoId || parsed.geckoId.includes('@firefox-extension.local')) {
          parsed.geckoId = 'tabchroma-tab-color@whosmann.de';
        }

        if (parsed.activeTabOpacity === undefined) {
          parsed.activeTabOpacity = 0.35;
        }
        if (parsed.enableFaviconContrastHalo === undefined) {
          parsed.enableFaviconContrastHalo = true;
        }

        // Strictly sanitize any rule referencing azure or proprietary cloud
        if (parsed.rules && Array.isArray(parsed.rules)) {
          parsed.rules = parsed.rules.filter((r: TabColorRule) => {
            const name = String(r.name || '').toLowerCase();
            const pattern = String(r.pattern || '').toLowerCase();
            const container = String(r.containerName || '').toLowerCase();
            return !name.includes('azure') && !pattern.includes('azure') && !container.includes('azure');
          });
          if (parsed.rules.length === 0) {
            parsed.rules = INITIAL_RULES;
          }
        }

        // Default to safe container mode and disabled window theme override if not set
        if (!parsed.defaultColor) parsed.defaultColor = '#37adff';
        if (!parsed.defaultContainerColor) parsed.defaultContainerColor = 'blue';
        if (!parsed.defaultMode) parsed.defaultMode = 'container';
        if (parsed.enableActiveTabTheme === undefined) parsed.enableActiveTabTheme = false;

        return parsed;
      }
    } catch (e) {}
    return INITIAL_CONFIG;
  });

  const [activeTab, setActiveTab] = useState<'simulator' | 'rules' | 'code' | 'guide' | 'publish'>('simulator');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TabColorRule | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem('tabchroma_config', JSON.stringify(config));
    } catch (e) {}
  }, [config]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleChangeConfig = (updated: Partial<ExtensionConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...updated,
    }));
    showToast('Standard-Einstellungen aktualisiert!');
  };

  const handleResetToDummyDefaults = () => {
    setConfig((prev) => ({
      ...prev,
      rules: DUMMY_RULES,
    }));
    showToast('Standard-Dummy-Regeln erfolgreich wiederhergestellt!');
  };

  const handleUpdateRules = (newRules: TabColorRule[]) => {
    setConfig((prev) => ({
      ...prev,
      rules: newRules,
    }));
  };

  const handleSaveRule = (rule: TabColorRule) => {
    setConfig((prev) => {
      const existingIdx = prev.rules.findIndex((r) => r.id === rule.id);
      if (existingIdx >= 0) {
        const next = [...prev.rules];
        next[existingIdx] = rule;
        return { ...prev, rules: next };
      } else {
        return { ...prev, rules: [rule, ...prev.rules] };
      }
    });
    showToast(`Rule "${rule.name}" saved successfully!`);
  };

  const handleAddRuleForUrl = (url: string) => {
    try {
      let host = url;
      try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        host = u.hostname;
      } catch {}

      const cleanHost = host.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
      const newRuleTemplate: TabColorRule = {
        id: `rule-${Date.now()}`,
        name: cleanHost || 'Custom Rule',
        patternType: 'domain',
        pattern: cleanHost || url,
        color: config.defaultColor || '#37adff',
        firefoxContainerColor: config.defaultContainerColor || 'blue',
        firefoxContainerIcon: 'circle',
        containerName: cleanHost || 'Custom',
        colorMode: config.defaultMode || 'container',
        accentBorder: true,
        enabled: true,
        priority: 1,
      };

      setEditingRule(newRuleTemplate);
      setIsRuleModalOpen(true);
    } catch (err) {
      setEditingRule(null);
      setIsRuleModalOpen(true);
    }
  };

  const handleUpdateVersion = (newVersion: string, newGeckoId?: string) => {
    setConfig((prev) => ({
      ...prev,
      extensionVersion: newVersion,
      ...(newGeckoId ? { geckoId: newGeckoId } : {}),
    }));
    showToast(`Version v${newVersion} & Add-on-ID aktualisiert!`);
  };

  const handleExportZip = async () => {
    try {
      setIsExporting(true);
      await downloadExtensionZip(config);
      showToast('Extension source (.zip) downloaded! Ready to inspect or submit.');
    } catch (err) {
      console.error(err);
      alert('Failed to package extension.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXpi = async () => {
    try {
      setIsExporting(true);
      await downloadExtensionXpi(config);
      showToast('Firefox .xpi package downloaded! Drag into Firefox or install via about:addons.');
    } catch (err) {
      console.error(err);
      alert('Failed to package .xpi extension.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* Top Bar adhering to 3-zone contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportZip={handleExportZip}
        onExportXpi={handleExportXpi}
        isExporting={isExporting}
        currentVersion={config.extensionVersion}
        onOpenVersionModal={() => setIsVersionModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation Tabs Content */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <FirefoxTabSimulator
              rules={config.rules}
              activeTabOpacity={config.activeTabOpacity ?? 0.35}
              enableFaviconContrastHalo={config.enableFaviconContrastHalo !== false}
              onChangeOpacity={(op) => handleChangeConfig({ activeTabOpacity: op })}
              onToggleHalo={(halo) => handleChangeConfig({ enableFaviconContrastHalo: halo })}
              onAddRuleClick={() => {
                setEditingRule(null);
                setIsRuleModalOpen(true);
              }}
              onEditRule={(rule) => {
                setEditingRule(rule);
                setIsRuleModalOpen(true);
              }}
              onUpdateRule={(updatedRule) => {
                const nextRules = config.rules.map((r) => r.id === updatedRule.id ? updatedRule : r);
                handleUpdateRules(nextRules);
              }}
            />
            <UrlTesterBar
              rules={config.rules}
              onAddRuleForUrl={handleAddRuleForUrl}
            />
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-6">
            <DefaultSettingsCard
              config={config}
              onChangeConfig={handleChangeConfig}
              onResetToDummyDefaults={handleResetToDummyDefaults}
            />
            <UrlTesterBar
              rules={config.rules}
              onAddRuleForUrl={handleAddRuleForUrl}
            />
            <RuleManager
              rules={config.rules}
              onUpdateRules={handleUpdateRules}
              onOpenCreateModal={() => {
                setEditingRule(null);
                setIsRuleModalOpen(true);
              }}
              onEditRule={(rule) => {
                setEditingRule(rule);
                setIsRuleModalOpen(true);
              }}
              defaultColor={config.defaultColor}
              defaultContainerColor={config.defaultContainerColor}
              defaultMode={config.defaultMode}
              onResetToDummyDefaults={handleResetToDummyDefaults}
            />
          </div>
        )}

        {activeTab === 'code' && (
          <SourceCodeViewer
            config={config}
            onExportZip={handleExportZip}
            onExportXpi={handleExportXpi}
          />
        )}

        {activeTab === 'guide' && (
          <InstallGuideView
            onExportZip={handleExportZip}
            onExportXpi={handleExportXpi}
          />
        )}

        {activeTab === 'publish' && (
          <PublishGuideView
            config={config}
            onExportZip={handleExportZip}
            onExportXpi={handleExportXpi}
            onUpdateVersion={handleUpdateVersion}
            onOpenVersionModal={() => setIsVersionModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">TabChroma</span>
            <span>·</span>
            <span>Firefox WebExtension Manifest V3 Studio</span>
            <span>·</span>
            <span className="font-mono text-slate-400">v{config.extensionVersion}</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={() => setActiveTab('simulator')}
              className="hover:text-slate-800 transition-colors"
            >
              Simulator
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className="hover:text-slate-800 transition-colors"
            >
              Rules
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className="hover:text-slate-800 transition-colors"
            >
              Extension Code
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className="hover:text-slate-800 transition-colors"
            >
              How to Install
            </button>
            <button
              onClick={() => setActiveTab('publish')}
              className="hover:text-slate-800 transition-colors"
            >
              Publish to AMO
            </button>
          </div>
        </div>
      </footer>

      {/* Modal for creating/editing rule */}
      <RuleEditorModal
        isOpen={isRuleModalOpen}
        onClose={() => {
          setIsRuleModalOpen(false);
          setEditingRule(null);
        }}
        onSave={handleSaveRule}
        initialRule={editingRule}
        defaultColor={config.defaultColor}
        defaultContainerColor={config.defaultContainerColor}
        defaultMode={config.defaultMode}
        existingRules={config.rules}
      />

      {/* Modal for bumping extension version */}
      <VersionBumpModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        currentVersion={config.extensionVersion || '1.0.1'}
        geckoId={config.geckoId || 'tabchroma-tab-color@whosmann.de'}
        onSaveVersion={handleUpdateVersion}
        onExportZipWithVersion={async (v, gid) => {
          handleUpdateVersion(v, gid);
          await downloadExtensionZip({ 
            ...config, 
            extensionVersion: v, 
            geckoId: gid || config.geckoId || 'tabchroma-tab-color@whosmann.de' 
          });
        }}
        onExportXpiWithVersion={async (v, gid) => {
          handleUpdateVersion(v, gid);
          await downloadExtensionXpi({ 
            ...config, 
            extensionVersion: v, 
            geckoId: gid || config.geckoId || 'tabchroma-tab-color@whosmann.de' 
          });
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-800 text-xs animate-fade-in">
          <span>🦊</span>
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
