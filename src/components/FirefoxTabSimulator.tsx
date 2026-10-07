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
  ShieldCheck, 
  Sparkles,
  RotateCcw,
  Layers,
  Globe,
  Server,
  CheckCircle2,
  Terminal,
  Activity,
  Upload,
  Database,
  Trash2,
  Edit3
} from 'lucide-react';
import { TabColorRule, TabSimulatorItem } from '../types/extension';
import { matchUrlAgainstRules, hexToRgba } from '../utils/urlMatcher';
import { ChromaTestLogo } from './ChromaTestLogo';

interface FirefoxTabSimulatorProps {
  rules: TabColorRule[];
  onAddRuleClick?: () => void;
  onUpdateRule?: (rule: TabColorRule) => void;
  onEditRule?: (rule: TabColorRule) => void;
  activeTabOpacity?: number;
  enableFaviconContrastHalo?: boolean;
  onChangeOpacity?: (opacity: number) => void;
  onToggleHalo?: (enabled: boolean) => void;
}

export interface ExampleScenario {
  id: string;
  name: string;
  description: string;
  tabs: TabSimulatorItem[];
}

export const EXAMPLE_TAB_SCENARIOS: ExampleScenario[] = [
  {
    id: 'standard',
    name: 'Standard-Beispiele',
    description: 'Typische DevOps-, Import- und Entwicklungs-Umgebungen',
    tabs: [
      {
        id: 'tab-1',
        title: 'prod.example.com/app',
        url: 'https://prod.example.com/dashboard',
        favicon: '🚀',
        matchedRuleId: null,
      },
      {
        id: 'tab-2',
        title: 'import.example.com/data',
        url: 'https://import.example.com/data',
        favicon: '⬇️',
        matchedRuleId: null,
      },
      {
        id: 'tab-3',
        title: 'staging.example.org/health',
        url: 'https://api.staging.example.org/health',
        favicon: '🧪',
        matchedRuleId: null,
      },
      {
        id: 'tab-4',
        title: 'localhost:3000 - Dev Server',
        url: 'http://localhost:3000/dashboard',
        favicon: '⚡',
        matchedRuleId: null,
      },
      {
        id: 'tab-5',
        title: '248924.4.internal-cloud.net/app',
        url: 'https://248924.4.internal-cloud.net/app',
        favicon: '📦',
        matchedRuleId: null,
      },
      {
        id: 'tab-6',
        title: '248923.32.internal-cloud.net - Isoliert',
        url: 'https://248923.32.internal-cloud.net/app',
        favicon: '🌐',
        matchedRuleId: null,
      },
      {
        id: 'tab-7',
        title: 'Wikipedia - Freier Standard-Tab',
        url: 'https://de.wikipedia.org/wiki/Firefox',
        favicon: '📰',
        matchedRuleId: null,
      },
      {
        id: 'tab-chromastack',
        title: 'chromastack.internal (Gleichfarbiges Logo-Test)',
        url: 'https://chromastack.internal/dashboard',
        favicon: 'layers-logo',
        matchedRuleId: null,
      },
    ],
  },
  {
    id: 'colors',
    name: 'Farben & Symbole Demo',
    description: 'Farbzuordnungen Rot, Blau, Grün, Gelb mit Symbolen',
    tabs: [
      {
        id: 'tab-c1',
        title: 'red.example.net (Kritisch / Prod)',
        url: 'https://red.example.net',
        favicon: '🔴',
        matchedRuleId: null,
      },
      {
        id: 'tab-c2',
        title: 'blue.example.net (Import Service)',
        url: 'https://blue.example.net',
        favicon: '⬇️',
        matchedRuleId: null,
      },
      {
        id: 'tab-c3',
        title: 'green.example.net (Lokale Entwicklung)',
        url: 'https://green.example.net',
        favicon: '🟢',
        matchedRuleId: null,
      },
      {
        id: 'tab-c4',
        title: 'yellow.example.net (Finanzen & Abrechnung)',
        url: 'https://yellow.example.net',
        favicon: '🟡',
        matchedRuleId: null,
      },
    ],
  },
  {
    id: 'subdomains',
    name: 'Subdomain-Isolations-Test',
    description: 'Vergleich exakter Host vs. andere Subdomains',
    tabs: [
      {
        id: 'tab-s1',
        title: '248924.4.internal-cloud.net (Mit spezifischer Regel)',
        url: 'https://248924.4.internal-cloud.net/app',
        favicon: '📦',
        matchedRuleId: null,
      },
      {
        id: 'tab-s2',
        title: '248923.32.internal-cloud.net (Ohne Regel - isoliert)',
        url: 'https://248923.32.internal-cloud.net/app',
        favicon: '🌐',
        matchedRuleId: null,
      },
      {
        id: 'tab-s3',
        title: 'auth.internal-cloud.net (Login-Portal)',
        url: 'https://auth.internal-cloud.net/login',
        favicon: '🔒',
        matchedRuleId: null,
      },
    ],
  },
];

export const FirefoxTabSimulator: React.FC<FirefoxTabSimulatorProps> = ({ 
  rules, 
  onAddRuleClick,
  onUpdateRule,
  onEditRule,
  activeTabOpacity = 0.35,
  enableFaviconContrastHalo = true,
  onChangeOpacity,
  onToggleHalo,
}) => {
  const [tabs, setTabs] = useState<TabSimulatorItem[]>(EXAMPLE_TAB_SCENARIOS[0].tabs);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [inputUrl, setInputUrl] = useState<string>(EXAMPLE_TAB_SCENARIOS[0].tabs[0].url);
  const [browserTheme, setBrowserTheme] = useState<'dark' | 'light'>('dark');
  const [titleSimulationNotice, setTitleSimulationNotice] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const activeMatch = matchUrlAgainstRules(activeTab?.url || '', rules);

  const handleSelectTab = (tab: TabSimulatorItem) => {
    setActiveTabId(tab.id);
    setInputUrl(tab.url);
    setTitleSimulationNotice(null);
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
    setTitleSimulationNotice(null);
  };

  const handleLoadScenario = (scenarioId: string) => {
    const sc = EXAMPLE_TAB_SCENARIOS.find((s) => s.id === scenarioId);
    if (!sc) return;
    setTabs(sc.tabs);
    setActiveTabId(sc.tabs[0].id);
    setInputUrl(sc.tabs[0].url);
    setTitleSimulationNotice(null);
  };

  const handleQuickAdd = (url: string, title: string, favicon: string) => {
    const newId = `tab-${Date.now()}`;
    const newTab: TabSimulatorItem = {
      id: newId,
      title,
      url,
      favicon,
      matchedRuleId: null,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
    setInputUrl(url);
    setTitleSimulationNotice(null);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return; // Keep at least one tab
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[0].id);
      setInputUrl(nextTabs[0].url);
      setTitleSimulationNotice(null);
    }
  };

  // Simulates in-page JavaScript functions altering document.title
  const handleSimulatePageTitleChange = (newTitle: string) => {
    if (!activeTab) return;
    const updated = tabs.map((t) => {
      if (t.id === activeTabId) {
        return {
          ...t,
          title: newTitle,
        };
      }
      return t;
    });
    setTabs(updated);
    const sym = activeMatch.rule?.customEmoji;
    if (sym) {
      setTitleSimulationNotice(`Webseite hat document.title geändert auf: "${newTitle}". Das angehängte Symbol "${sym}" bleibt dank dauerhaftem Schutz fest im Tab-Reiter vorangestellt!`);
    } else {
      setTitleSimulationNotice(`Webseite hat document.title geändert auf: "${newTitle}".`);
    }
  };

  // Removes the attached symbol from the current rule
  const handleRemoveSymbol = () => {
    if (!activeMatch.rule || !onUpdateRule) return;
    onUpdateRule({
      ...activeMatch.rule,
      customEmoji: '',
    });
    setTitleSimulationNotice(`Angehängtes Symbol für Regel "${activeMatch.rule.name}" wurde erfolgreich entfernt.`);
  };

  // Attaches or updates the symbol for the current rule
  const handleAttachSymbol = (sym: string) => {
    if (!activeMatch.rule || !onUpdateRule) return;
    onUpdateRule({
      ...activeMatch.rule,
      customEmoji: sym,
      enableTitleEmoji: true,
      enableFaviconEmoji: true,
    });
    setTitleSimulationNotice(`Symbol "${sym}" wurde der Regel "${activeMatch.rule.name}" angehängt.`);
  };

  // Helper to render mock website body based on URL
  const renderSimulatedPageContent = () => {
    const url = activeTab?.url || '';
    const isDark = browserTheme === 'dark';

    let specificContent = null;

    if (url.includes('prod.example.com')) {
      specificContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">🚀</span>
              <div>
                <h4 className="font-bold text-sm text-rose-400">Production Web App · Live Cluster</h4>
                <div className="text-[11px] text-slate-400">Environment: PROD-EU-WEST-1 · Node ID: prd-srv-04</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              ● High Alert Production
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-black/20 border border-slate-700/40">
              <div className="text-slate-400 text-[10px]">System Health</div>
              <div className="font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 99.99% Uptime
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-black/20 border border-slate-700/40">
              <div className="text-slate-400 text-[10px]">Requests / sec</div>
              <div className="font-bold text-sky-400 mt-1">14,250 req/s</div>
            </div>
            <div className="p-2.5 rounded-lg bg-black/20 border border-slate-700/40">
              <div className="text-slate-400 text-[10px]">Avg Latency</div>
              <div className="font-bold text-slate-200 mt-1">18 ms</div>
            </div>
          </div>
        </div>
      );
    } else if (url.includes('import.example.com') || url.includes('import') || url.includes('blue.example.net')) {
      specificContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">⬇️</span>
              <div>
                <h4 className="font-bold text-sm text-sky-400">Data Import Pipeline & Upload Service</h4>
                <div className="text-[11px] text-slate-400">Bulk Ingestion Engine · Worker: worker-import-02</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              ⬇️ Import Service
            </span>
          </div>

          <div className="p-4 rounded-lg border border-dashed border-sky-500/40 bg-sky-500/5 text-center space-y-1">
            <Upload className="w-6 h-6 mx-auto text-sky-400" />
            <div className="text-xs font-semibold text-sky-300">CSV- oder JSON-Dateien hier ablegen</div>
            <div className="text-[10px] text-slate-400">Automatische Validierung & Schema-Zuordnung (Ingestion Queue: 0 wartend)</div>
          </div>
        </div>
      );
    } else if (url.includes('staging')) {
      specificContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧪</span>
              <div>
                <h4 className="font-bold text-sm text-amber-400">Staging QA & Integration Test Suite</h4>
                <div className="text-[11px] text-slate-400">Branch: release/v2.4.0 · Test-Cluster Online</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              🧪 Staging Sandbox
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-black/20 border border-slate-700/40 text-xs font-mono space-y-1">
            <div className="text-emerald-400">✓ 42 / 42 E2E Tests bestanden</div>
            <div className="text-slate-400">Testing container isolation and network mock APIs</div>
          </div>
        </div>
      );
    } else if (url.includes('localhost') || url.includes('3000') || url.includes('green.example.net')) {
      specificContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <div>
                <h4 className="font-bold text-sm text-emerald-400">Local Development Server</h4>
                <div className="text-[11px] text-slate-400">Vite Dev Server · Port 3000 · Hot Reload Active</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ⚡ Localhost / Sandbox
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-black/30 border border-slate-700/40 text-xs font-mono text-emerald-300 space-y-0.5">
            <div>$ npm run dev</div>
            <div className="text-slate-400">&gt; vite ready in 142 ms</div>
            <div className="text-sky-400">&gt; Local: http://localhost:3000/</div>
          </div>
        </div>
      );
    } else if (url.includes('red.example.net')) {
      specificContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔴</span>
              <div>
                <h4 className="font-bold text-sm text-rose-400">Kritischer Produktions-Sicherheitsbereich</h4>
                <div className="text-[11px] text-slate-400">Host: red.example.net · Vollständig isolierter Container</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              🔴 Kritisch / Prod
            </span>
          </div>

          <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs space-y-1">
            <div className="font-semibold text-rose-300">Produktions-Datenbank & Sicherheitsrichtlinien aktiv</div>
            <div className="text-slate-400 text-[11px]">Cookies, Sessions und Browser-Speicher sind streng in diesem roten Container isoliert.</div>
          </div>
        </div>
      );
    } else if (url.includes('yellow.example.net')) {
      specificContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">🟡</span>
              <div>
                <h4 className="font-bold text-sm text-amber-300">Finanzen & Buchhaltungs-Portal</h4>
                <div className="text-[11px] text-slate-400">Host: yellow.example.net · Rechnungen, Steuern & Zahlungsverkehr</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              🟡 Finanzen
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded bg-black/20 border border-slate-700/40">
              <div className="text-slate-400 text-[10px]">Offene Rechnungen</div>
              <div className="font-bold text-amber-300 text-sm mt-0.5">14 Belege</div>
            </div>
            <div className="p-2.5 rounded bg-black/20 border border-slate-700/40">
              <div className="text-slate-400 text-[10px]">Zahlungsstatus</div>
              <div className="font-bold text-emerald-400 text-sm mt-0.5">Ausgeglichen</div>
            </div>
          </div>
        </div>
      );
    } else if (url.includes('chromastack')) {
      specificContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
            <div className="flex items-center gap-2.5">
              <ChromaTestLogo color="#ff4f5e" size={26} variant="layers" withHalo />
              <div>
                <h4 className="font-bold text-sm text-rose-300">
                  ChromaStack · Gleichfarbigkeits-Testlabor
                </h4>
                <div className="text-[11px] text-slate-400">
                  Gleichfarbiges Logo-Szenario wie in Ihrem Foto
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Logo = Tab-Farbe (#ff4f5e)
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-black/30 border border-slate-700/60 text-xs text-slate-300 space-y-2">
            <div className="font-bold text-slate-200 flex items-center gap-2">
              <span>🔍 Sichtbarkeits-Ergebnis:</span>
              <span className="text-emerald-400 text-[11px]">Gestochen scharf</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Dieses Test-Logo besitzt exakt denselben roten Farbcode (<code className="text-rose-300 font-mono">#ff4f5e</code>) wie die zugeordnete Firefox-Farbregel. 
              Beachten Sie oben den aktiven Tab: Dank der reduzierten Deckkraft ({Math.round((activeTabOpacity ?? 0.35) * 100)}%) und der Kontur-Hinterlegung verschwimmt das Symbol nicht mehr im Hintergrund, sondern bleibt optimal differenziert!
            </p>
          </div>
        </div>
      );
    } else if (url.includes('internal-cloud.net')) {
      const isExactHost = url.includes('248924.4.internal-cloud.net');
      const isAuth = url.includes('auth.internal-cloud.net');
      specificContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">{isAuth ? '🔒' : isExactHost ? '📦' : '🌐'}</span>
              <div>
                <h4 className="font-bold text-sm text-sky-300">
                  {isAuth ? 'SSO Authentifizierungs-Zentrale' : `Instance Console · ${url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')}`}
                </h4>
                <div className="text-[11px] text-slate-400">
                  {isAuth 
                    ? 'Zentrale Identitätsverwaltung & 2FA-Authentifizierung' 
                    : isExactHost 
                    ? 'Zugeordneter exakter Mandant (Host: 248924.4)' 
                    : 'Unzugeordnete Subdomain (Isoliert im Standard)'}
                </div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
              isAuth || isExactHost 
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' 
                : 'bg-slate-700/50 text-slate-300 border border-slate-600'
            }`}>
              {isAuth ? '🔒 Auth-Container' : isExactHost ? 'Regel aktiv' : 'Keine Regel (Isoliert)'}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {isAuth
              ? 'Login-Sessions und Auth-Token werden in einem geschützten Authentifizierungs-Container verwaltet.'
              : isExactHost 
              ? 'Dieser Host entspricht exakt der Regel für 248924.4.internal-cloud.net und wird dem konfigurierten Container zugeordnet.'
              : 'Diese Subdomain unterscheidet sich vom konfigurierten Host und wird dank exakter Host-Prüfung getrennt gehalten.'}
          </p>
        </div>
      );
    } else {
      specificContent = (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌐</span>
              <div>
                <h4 className="font-bold text-sm text-slate-300">
                  {activeTab?.title || 'Web Page'}
                </h4>
                <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">{url}</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700/50 text-slate-300 border border-slate-600">
              {activeMatch.matched ? 'Regel aktiv' : 'Standard-Tab'}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {activeMatch.matched 
              ? `Diese URL wurde erfolgreich der Regel "${activeMatch.rule?.name}" und dem Firefox Container "${activeMatch.rule?.containerName}" zugeordnet.`
              : 'Diese URL entspricht keiner aktiven Farbregel und wird als normaler, ungefilterter Firefox-Tab dargestellt.'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {specificContent}

        {/* Dynamic Title / In-Page Function Click Simulation */}
        <div className="pt-4 border-t border-slate-700/40 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Interaktiver Funktionstest: Dynamische Seitennamen-Änderung (SPA)</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Wenn Sie in Web-Apps (SPAs) auf Funktionen klicken, ändert die Webseite per JavaScript ihren Titel. Das Tab-Symbol bleibt dauerhaft im Tab-Reiter fixiert:
              </div>
            </div>
            {activeMatch.rule?.customEmoji && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30">
                Fixiertes Symbol: {activeMatch.rule.customEmoji}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 mr-1">Funktion anklicken:</span>
            <button
              onClick={() => handleSimulatePageTitleChange('Übersicht & Live-Status')}
              className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-colors"
            >
              📊 Übersicht laden
            </button>
            <button
              onClick={() => handleSimulatePageTitleChange('Echtzeit-Metriken & Logs #84')}
              className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-colors"
            >
              📈 Metriken öffnen
            </button>
            <button
              onClick={() => handleSimulatePageTitleChange('Import-Vorgang läuft (100% fertig)')}
              className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-colors"
            >
              ⚡ Job ausführen
            </button>
            <button
              onClick={() => handleSimulatePageTitleChange('Benutzer-Profil & Einstellungen')}
              className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-colors"
            >
              ⚙️ Einstellungen
            </button>
          </div>

          {titleSimulationNotice && (
            <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{titleSimulationNotice}</span>
              </div>
              <button
                onClick={() => setTitleSimulationNotice(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Symbol Management Bar (Entfernen & Hinzufügen) */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Tab-Symbol Status:</span>
              {activeMatch.rule?.customEmoji ? (
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  <span>Angehängt:</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-400/25 border border-amber-300/40 text-amber-200">{activeMatch.rule.customEmoji}</span>
                </span>
              ) : (
                <span className="text-slate-500 italic">Kein Symbol angehängt</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeMatch.rule?.customEmoji ? (
                <button
                  onClick={handleRemoveSymbol}
                  className="px-2.5 py-1 rounded text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors flex items-center gap-1 shadow-2xs"
                  title="Entfernt das angehängte Symbol aus dieser Regel"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>✕ Symbol entfernen</span>
                </button>
              ) : activeMatch.matched && activeMatch.rule ? (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[11px] mr-1">Symbol anhängen:</span>
                  {['🚀', '⬇️', '📦', '⚡', '🧪', '🔒'].map((sym) => (
                    <button
                      key={sym}
                      onClick={() => handleAttachSymbol(sym)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition-colors"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              ) : null}

              {activeMatch.rule && onEditRule && (
                <button
                  onClick={() => onEditRule(activeMatch.rule!)}
                  className="px-2.5 py-1 rounded text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Regel bearbeiten</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span className="text-orange-500">🦊</span>
            Interactive Firefox Browser Simulator
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Echtzeit-Simulation von Firefox-Tabs mit Container-Farblinien, Tab-Symbolen und Adressleisten-Badges.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Theme switcher */}
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

          {/* Active Tab Opacity Control */}
          {onChangeOpacity && (
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
              <span className="text-[11px] font-semibold text-slate-600">Tab-Deckkraft:</span>
              <input 
                type="range"
                min="0.15"
                max="1.0"
                step="0.05"
                value={activeTabOpacity ?? 0.35}
                onChange={(e) => onChangeOpacity(parseFloat(e.target.value))}
                className="w-16 accent-sky-600 cursor-pointer h-1.5"
                title="Deckkraft des aktiven Tabs anpassen (z. B. 35% für optimalen Favicon-Kontrast)"
              />
              <span className="font-mono text-[11px] font-bold text-sky-700 min-w-[28px]">
                {Math.round((activeTabOpacity ?? 0.35) * 100)}%
              </span>
            </div>
          )}

          {/* Regenerate Sample Tabs Button */}
          <button
            onClick={() => handleLoadScenario('standard')}
            title="Generiert einen frischen Satz aussagekräftiger Beispiel-Tabs unabhängig vom Rest"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Beispiel-Tabs neu generieren</span>
          </button>
        </div>
      </div>

      {/* Example Scenarios Bar & Quick Add Pills */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 font-bold text-[11px] mr-1">Beispiel-Szenarien:</span>
          {EXAMPLE_TAB_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => handleLoadScenario(sc.id)}
              className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium transition-colors text-xs shadow-2xs"
              title={sc.description}
            >
              {sc.name}
            </button>
          ))}
        </div>

        {/* Quick Add Specific Samples */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
          <span className="text-slate-400 text-[11px] shrink-0 mr-1">+ Schnell-Beispiel:</span>
          <button
            onClick={() => handleQuickAdd('https://prod.example.com/dashboard', 'prod.example.com', '🚀')}
            className="px-2 py-0.5 rounded bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-medium whitespace-nowrap shadow-2xs"
          >
            + Prod 🚀
          </button>
          <button
            onClick={() => handleQuickAdd('https://import.example.com/data', 'import.example.com', '⬇️')}
            className="px-2 py-0.5 rounded bg-white hover:bg-sky-50 text-sky-700 border border-slate-200 hover:border-sky-200 text-xs font-medium whitespace-nowrap shadow-2xs"
          >
            + Import ⬇️
          </button>
          <button
            onClick={() => handleQuickAdd('https://api.staging.example.org/health', 'staging.example.org', '🧪')}
            className="px-2 py-0.5 rounded bg-white hover:bg-amber-50 text-amber-700 border border-slate-200 hover:border-amber-200 text-xs font-medium whitespace-nowrap shadow-2xs"
          >
            + Staging 🧪
          </button>
          <button
            onClick={() => handleQuickAdd('http://localhost:3000/dashboard', 'localhost:3000', '⚡')}
            className="px-2 py-0.5 rounded bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-200 text-xs font-medium whitespace-nowrap shadow-2xs"
          >
            + Dev ⚡
          </button>
          <button
            onClick={() => handleQuickAdd('https://248924.4.internal-cloud.net/app', '248924.4.internal-cloud.net', '📦')}
            className="px-2 py-0.5 rounded bg-white hover:bg-sky-50 text-sky-800 border border-slate-200 hover:border-sky-200 text-xs font-mono whitespace-nowrap shadow-2xs"
          >
            + 248924.4
          </button>
          <button
            onClick={() => handleQuickAdd('https://de.wikipedia.org/wiki/Firefox', 'Wikipedia', '📰')}
            className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium whitespace-nowrap shadow-2xs"
          >
            + Unmatched
          </button>
          <button
            onClick={() => handleQuickAdd('https://chromastack.internal/dashboard', 'chromastack.internal', 'layers-logo')}
            className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold whitespace-nowrap shadow-2xs flex items-center gap-1"
            title="Testet ein rotes Logo auf einem gleichfarbig roten Tab"
          >
            <ChromaTestLogo color="#ff4f5e" size={13} variant="layers" />
            <span>+ Rotes Logo-Test</span>
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

              const opacity = (match.matched && typeof match.rule?.tabOpacity === 'number')
                ? match.rule.tabOpacity
                : (activeTabOpacity !== undefined ? activeTabOpacity : 0.35);

              const activeBg = tabColor 
                ? hexToRgba(tabColor, opacity)
                : (browserTheme === 'dark' ? '#1e1e2e' : '#ffffff');

              return (
                <div
                  key={tab.id}
                  onClick={() => handleSelectTab(tab)}
                  className={`group relative flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer transition-all duration-150 min-w-[140px] max-w-[220px] rounded-t-lg select-none shrink-0 ${
                    isActive
                      ? browserTheme === 'dark'
                        ? 'text-white shadow-sm'
                        : 'text-slate-900 shadow-sm'
                      : browserTheme === 'dark'
                      ? 'text-slate-400 hover:bg-[#181825]/80 hover:text-slate-200'
                      : 'text-slate-600 hover:bg-[#e3e5e8] hover:text-slate-900'
                  }`}
                  style={{
                    backgroundColor: isActive ? activeBg : undefined,
                    borderTop: tabColor ? `3px solid ${tabColor}` : '3px solid transparent',
                  }}
                >
                  {/* Favicon */}
                  <span 
                    className="text-sm shrink-0 flex items-center justify-center transition-all"
                    style={{
                      filter: (enableFaviconContrastHalo !== false && isActive && tabColor)
                        ? (browserTheme === 'dark'
                            ? 'drop-shadow(0 0 1.5px rgba(255,255,255,0.85))'
                            : 'drop-shadow(0 0 1.5px rgba(0,0,0,0.75))')
                        : 'none',
                    }}
                  >
                    {tab.favicon === 'layers-logo' ? (
                      <ChromaTestLogo 
                        color={tabColor || '#ff4f5e'} 
                        size={16} 
                        variant="layers" 
                        withHalo={enableFaviconContrastHalo !== false && isActive} 
                      />
                    ) : match.matched && match.rule?.customEmoji && match.rule.enableFaviconEmoji !== false ? (
                      match.rule.customEmoji
                    ) : (
                      tab.favicon || '🌐'
                    )}
                  </span>

                  {/* Title & Container Subtitle */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate text-xs font-medium leading-tight flex items-center gap-1.5">
                      {match.matched && match.rule?.customEmoji && match.rule.enableTitleEmoji !== false && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-400/25 text-amber-300 font-bold text-[11px] border border-amber-300/40 shrink-0 shadow-2xs"
                          title={`Angehängtes Tab-Symbol: ${match.rule.customEmoji} (bleibt bei JavaScript-Funktionsklicks dauerhaft vorangestellt)`}
                        >
                          <span>{match.rule.customEmoji}</span>
                          <span className="text-[9px] uppercase tracking-wide opacity-80 hidden sm:inline">Angehängt</span>
                        </span>
                      )}
                      <span className="truncate font-semibold">{tab.title}</span>
                    </span>
                    {containerName && (
                      <span
                        className="text-[10px] truncate font-normal opacity-90 leading-none mt-0.5 flex items-center gap-1"
                        style={{ color: tabColor || '#38bdf8' }}
                      >
                        {match.matched && match.rule?.customEmoji && (
                          <span className="font-bold">{match.rule.customEmoji}</span>
                        )}
                        <span>{containerName}</span>
                      </span>
                    )}
                  </div>

                  {/* Close Tab Button */}
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-slate-500/20 text-slate-400 hover:text-slate-200 transition-opacity shrink-0"
                    title="Tab schließen"
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
              onClick={() => handleQuickAdd('https://generic.example.net', 'New Example Tab', '🌐')}
              className={`p-1.5 mb-1 rounded-md text-xs transition-colors shrink-0 ${
                browserTheme === 'dark'
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Neuen Beispiel-Tab öffnen"
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
                  {activeMatch.rule.customEmoji && (
                    <span className="font-bold text-xs">{activeMatch.rule.customEmoji}</span>
                  )}
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
          className={`p-6 min-h-[340px] relative transition-colors ${
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

          {/* Main Simulated Page Container */}
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Active Container Status Banner */}
            {activeMatch.matched && activeMatch.rule ? (
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
                    {activeMatch.rule.customEmoji || '🦊'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Zugeordnete Farbregel
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
                      className={`text-sm font-semibold mt-0.5 flex items-center gap-1.5 ${
                        browserTheme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      <span>Container:</span>
                      {activeMatch.rule.customEmoji && (
                        <span className="font-bold text-amber-500">{activeMatch.rule.customEmoji}</span>
                      )}
                      <span>{activeMatch.rule.containerName}</span>
                      <span className="text-xs font-normal text-slate-400">
                        ({activeMatch.rule.firefoxContainerColor})
                      </span>
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
                    Modus: {activeMatch.rule.colorMode}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-slate-700/50 bg-black/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span>Keine Regel zugeordnet · Läuft im Standard-Firefox-Container</span>
                </div>
                {onAddRuleClick && (
                  <button
                    onClick={onAddRuleClick}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-white bg-sky-600 hover:bg-sky-500 transition-colors"
                  >
                    + Regel für diese URL definieren
                  </button>
                )}
              </div>
            )}

            {/* Simulated Live Web Content (Realistic Webpage Mock) */}
            <div
              className={`p-5 rounded-xl border ${
                browserTheme === 'dark'
                  ? 'bg-[#11111b] border-slate-800 text-slate-200'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              {renderSimulatedPageContent()}
            </div>

            {/* Technical Pipeline Explanation */}
            {activeMatch.matched && activeMatch.rule && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  browserTheme === 'dark'
                    ? 'bg-[#11111b]/80 border-slate-800/80 text-slate-300'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span>Firefox-Container Verhalten für diesen Tab:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
                  <li>
                    <strong>Muster-Treffer:</strong> Regel-Typ{' '}
                    <code className="px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[11px]">
                      {activeMatch.rule.patternType}: {activeMatch.rule.pattern}
                    </code>
                  </li>
                  <li>
                    <strong>Container-Identität:</strong> Geöffnet in{' '}
                    <span className="font-semibold text-sky-400">
                      "{activeMatch.rule.containerName}"
                    </span>{' '}
                    ({activeMatch.rule.firefoxContainerColor}).
                  </li>
                  {activeMatch.rule.customEmoji && (
                    <li>
                      <strong>Angehängtes Symbol:</strong> {activeMatch.rule.customEmoji} ist im Tab-Titel und im Container-Badge sichtbar.
                    </li>
                  )}
                  <li>
                    <strong>Browser-Farbschema:</strong>{' '}
                    {activeMatch.rule.colorMode === 'container' 
                      ? 'Geschützt (Firefox-Browserfarbschema bleibt unberührt)' 
                      : 'Hybrid (Tab-Stripe & Toolbar-Akzent)'}
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
