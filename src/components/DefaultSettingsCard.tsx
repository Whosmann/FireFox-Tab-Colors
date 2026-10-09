import React, { useState } from 'react';
import { 
  Palette, 
  Shield, 
  Settings2, 
  RotateCcw, 
  Sparkles, 
  Check, 
  Info, 
  Sliders, 
  Layers, 
  Moon, 
  Sun, 
  Monitor, 
  Paintbrush,
  Share2,
  Download,
  Upload,
  Copy
} from 'lucide-react';
import { ExtensionConfig, FirefoxContainerColor, ColorMode, BaseThemeMode, HybridWindowBehavior, HybridTabIndicatorStyle } from '../types/extension';
import { FIREFOX_CONTAINER_COLORS, hexToRgba } from '../utils/urlMatcher';
import { ChromaTestLogo, LogoVariant } from './ChromaTestLogo';
import { ThemeImportExportModal } from './ThemeImportExportModal';

interface DefaultSettingsCardProps {
  config: ExtensionConfig;
  onChangeConfig: (updated: Partial<ExtensionConfig>) => void;
  onResetToDummyDefaults?: () => void;
}

export const DefaultSettingsCard: React.FC<DefaultSettingsCardProps> = ({
  config,
  onChangeConfig,
  onResetToDummyDefaults,
}) => {
  const [testLogoVariant, setTestLogoVariant] = useState<LogoVariant>('layers');
  const [testLogoColor, setTestLogoColor] = useState<string>('#ff4f5e');
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [themeModalTab, setThemeModalTab] = useState<'export' | 'import' | 'presets'>('export');
  const [copiedQuickCode, setCopiedQuickCode] = useState(false);

  const handleQuickCopyTheme = async () => {
    const themePkg = {
      format: 'tabchroma-theme',
      version: '1.0',
      themeName: 'TabChroma Custom Theme',
      createdAt: new Date().toISOString(),
      baseThemeMode: config.baseThemeMode || 'custom',
      customBaseFrameColor: config.customBaseFrameColor || '#1c1b22',
      customBaseToolbarColor: config.customBaseToolbarColor || '#2b2a33',
      customBaseTextColor: config.customBaseTextColor || '#fbfbfe',
      defaultColor: config.defaultColor || '#37adff',
      activeTabOpacity: config.activeTabOpacity ?? 0.35,
      enableFaviconContrastHalo: config.enableFaviconContrastHalo !== false,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(themePkg, null, 2));
      setCopiedQuickCode(true);
      setTimeout(() => setCopiedQuickCode(false), 2500);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = JSON.stringify(themePkg, null, 2);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedQuickCode(true);
      setTimeout(() => setCopiedQuickCode(false), 2500);
    }
  };
  const containerColors: FirefoxContainerColor[] = [
    'blue',
    'turquoise',
    'green',
    'yellow',
    'orange',
    'red',
    'pink',
    'purple',
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
      {/* Title & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-sky-600" />
            <span>Standard-Einstellungen & Farbschema (Defaults)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Diese Werte werden als Vorlage für neue Regeln und beim JSON-Import als Default verwendet.
          </p>
        </div>

        {onResetToDummyDefaults && (
          <button
            type="button"
            onClick={onResetToDummyDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0 self-start sm:self-center"
            title="Setzt Regeln sauber auf die generic Dummy-Regeln zurück"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
            <span>Dummy-Regeln zurücksetzen</span>
          </button>
        )}
      </div>

      {/* Grid Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Standard-Farbe & Container-Farbe */}
        <div className="space-y-2.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200">
          <label className="block text-xs font-bold text-slate-800">
            1. Standard-Container-Farbe
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {containerColors.map((c) => {
              const hex = FIREFOX_CONTAINER_COLORS[c].hex;
              const isSelected = config.defaultContainerColor === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChangeConfig({ defaultContainerColor: c, defaultColor: hex })}
                  className={`flex flex-col items-center justify-center p-1.5 rounded-md border text-center transition-all ${
                    isSelected
                      ? 'border-sky-500 bg-white ring-2 ring-sky-400/30 shadow-xs'
                      : 'border-slate-200 hover:bg-white bg-slate-100/50'
                  }`}
                  title={`${c} (${hex})`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-[10px] capitalize font-medium text-slate-700 mt-0.5 truncate w-full">
                    {c}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500 text-[11px]">Hex-Farbe:</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={config.defaultColor || '#37adff'}
                onChange={(e) => onChangeConfig({ defaultColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border border-slate-300"
              />
              <span className="font-mono text-xs text-slate-700 font-semibold">
                {config.defaultColor || '#37adff'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Standard-Farbmodus */}
        <div className="space-y-2.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200">
          <label className="block text-xs font-bold text-slate-800">
            2. Standard-Farbmodus
          </label>
          <div className="space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => onChangeConfig({ defaultMode: 'container' })}
              className={`w-full p-2 rounded-lg border text-left transition-all ${
                config.defaultMode === 'container'
                  ? 'border-sky-500 bg-white ring-2 ring-sky-400/20 shadow-xs'
                  : 'border-slate-200 bg-slate-100/50 text-slate-600 hover:bg-white'
              }`}
            >
              <div className="font-bold text-slate-900 text-xs">
                Nur Container (Empfohlen)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Farbschema von Firefox bleibt vollständig unverändert. Nur Tab-Linie & Container-Badge werden gefärbt.
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChangeConfig({ defaultMode: 'hybrid' })}
              className={`w-full p-2 rounded-lg border text-left transition-all ${
                config.defaultMode === 'hybrid'
                  ? 'border-sky-500 bg-white ring-2 ring-sky-400/20 shadow-xs'
                  : 'border-slate-200 bg-slate-100/50 text-slate-600 hover:bg-white'
              }`}
            >
              <div className="font-bold text-slate-900 text-xs">
                Hybrid (Container + Theme)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Färbt den Container und passt zusätzlich die Firefox-Toolbar dynamisch an.
              </div>
            </button>
          </div>
        </div>

        {/* 3. Browser-Farbschema Schutz & Isolation */}
        <div className="space-y-2.5 bg-slate-50/70 p-3 rounded-lg border border-slate-200">
          <label className="block text-xs font-bold text-slate-800">
            3. Browser-Farbschema Schutz
          </label>
          
          <div className="space-y-3 pt-1 text-xs">
            {/* enableActiveTabTheme */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!config.enableActiveTabTheme}
                onChange={(e) => onChangeConfig({ enableActiveTabTheme: e.target.checked })}
                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">
                  Firefox-Fenstertheme überschreiben (Experimentell)
                </span>
                <span className="text-[11px] text-slate-500 block leading-snug">
                  {config.enableActiveTabTheme ? (
                    <span className="text-amber-700 font-medium">
                      Aktiviert: Überschreibt das Fenster-Farbschema. (Achtung: Ersetzt Ihr persönliches Firefox-Theme bei Tabs mit Regel).
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      Deaktiviert (Empfohlen): Ihr persönliches Firefox-Theme bleibt 100% aktiv. Es werden nur Overlays &amp; Icons angepasst.
                    </span>
                  )}
                </span>
              </div>
            </label>

            {/* revertUnmatchedToDefault */}
            <label className="flex items-start gap-2.5 cursor-pointer pt-1 border-t border-slate-200/60">
              <input
                type="checkbox"
                checked={config.revertUnmatchedToDefault !== false}
                onChange={(e) => onChangeConfig({ revertUnmatchedToDefault: e.target.checked })}
                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">
                  Nicht zugeordnete URLs im Standard-Container
                </span>
                <span className="text-[11px] text-slate-500 block leading-snug">
                  Verhindert, dass fremde URLs im vorherigen Farb-Container verbleiben.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* 2b. Spezifische Konfiguration für Hybrid-Modus: Statisches Fenster vs. Dynamisch & Separater Tab-Farbindikator */}
      <div className={`p-4 rounded-xl border transition-all space-y-3.5 ${
        config.defaultMode === 'hybrid'
          ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-400/20 shadow-xs'
          : 'bg-slate-50/70 border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="text-xs font-bold text-slate-900">
                Hybrid-Modus Konfiguration: Fenster-Verhalten &amp; Separater Tab-Farbindikator
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                (config.hybridWindowBehavior || 'static_window') === 'static_window'
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {(config.hybridWindowBehavior || 'static_window') === 'static_window'
                  ? 'Statisches Fenster + Separater Tab-Indikator'
                  : 'Dynamische Toolbar'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Präzise Steuerung für den Hybrid-Modus: Das Browserfenster bleibt statisch in seiner Grundfarbe, während der aktive Tab einen gezielten Farbakzent erhält.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {config.defaultMode !== 'hybrid' && (
              <button
                type="button"
                onClick={() => onChangeConfig({ defaultMode: 'hybrid' })}
                className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-white hover:bg-purple-50 border border-purple-300 rounded-lg transition-colors shadow-2xs"
              >
                Als Standard-Modus aktivieren
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* A. Fenster-Verhalten */}
          <div className="space-y-2 bg-white/80 p-3 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              A. Fenster- &amp; Toolbar-Verhalten im Hybrid-Modus
            </label>
            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => onChangeConfig({ hybridWindowBehavior: 'static_window' })}
                className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                  (config.hybridWindowBehavior || 'static_window') === 'static_window'
                    ? 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-400/25 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                  <span>Statisches Fenster + Aktiver Tab-Farbindikator (Empfohlen)</span>
                  {(config.hybridWindowBehavior || 'static_window') === 'static_window' && (
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Das Browserfenster &amp; die Toolbar behalten dauerhaft die statische Basisfarbe (kein unruhiges Flackern/Umfärben beim schnellen Tab-Wechsel). Nur der gerade aktive Tab wird mit einem separaten Farbindikator hervorgehoben.
                </div>
              </button>

              <button
                type="button"
                onClick={() => onChangeConfig({ hybridWindowBehavior: 'dynamic_toolbar' })}
                className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                  config.hybridWindowBehavior === 'dynamic_toolbar'
                    ? 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-400/25 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                  <span>Dynamische Fenster-Anpassung</span>
                  {config.hybridWindowBehavior === 'dynamic_toolbar' && (
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Die gesamte Toolbar und Leiste passt sich der jeweiligen Farbe des aktiven Tabs an.
                </div>
              </button>
            </div>
          </div>

          {/* B. Aktiver Tab-Farbindikator Stil & Farbe */}
          <div className="space-y-2 bg-white/80 p-3 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              B. Separater Tab-Farbindikator (Optischer Stil)
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                {
                  id: 'accent_line_and_fill' as HybridTabIndicatorStyle,
                  label: 'Farblinie & Tönung',
                  desc: '3px Proton-Linie + sanfter Tab-Body',
                },
                {
                  id: 'line_only' as HybridTabIndicatorStyle,
                  label: 'Nur Farblinie',
                  desc: 'Minimalistisch, Fenster 100% einheitlich',
                },
                {
                  id: 'glow_border' as HybridTabIndicatorStyle,
                  label: 'Leucht-Kontur',
                  desc: 'Sanfte Halo-Umrandung des Tabs',
                },
              ].map((style) => {
                const isSelected = (config.hybridTabIndicatorStyle || 'accent_line_and_fill') === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => onChangeConfig({ hybridTabIndicatorStyle: style.id })}
                    className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-400/20 font-bold shadow-2xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span className="text-xs">{style.label}</span>
                    <span className="text-[10px] text-slate-400 font-normal mt-1 leading-tight">
                      {style.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Indikator-Farbe */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600 text-[11px]">Indikator-Farbe:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChangeConfig({ hybridIndicatorColor: undefined })}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                    !config.hybridIndicatorColor
                      ? 'bg-purple-100 text-purple-800 border-purple-300 font-bold'
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                  title="Nutzt immer die spezifische Farbe der URL-Regel"
                >
                  Regel-Farbe (Auto)
                </button>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={config.hybridIndicatorColor || config.defaultColor || '#37adff'}
                    onChange={(e) => onChangeConfig({ hybridIndicatorColor: e.target.value })}
                    className="w-5 h-5 rounded cursor-pointer border border-slate-300"
                    title="Feste benutzerdefinierte Indikator-Farbe wählen"
                  />
                  {config.hybridIndicatorColor && (
                    <span className="font-mono text-[10px] text-slate-600 font-bold">
                      {config.hybridIndicatorColor}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Basis-Farbschema für Hybrid-Modus & Menü-Layout (Vollbreite, kein Zusammendrücken!) */}
      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Paintbrush className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-800">
                4. Basis-Farbschema (Hybrid-Modus &amp; Menü-Layout)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                Verhindert harten Schwarz/Weiß-Wechsel
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Definiert die Grundfarben für Browserrahmen &amp; Symbolleiste im Hybrid-Modus und passt gleichzeitig das Farblayout für das Erweiterungs-Menü (Popup &amp; Einstellungen) an.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium shrink-0">
              Aktuell: <strong className="text-slate-700 capitalize">{config.baseThemeMode || 'system'}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setThemeModalTab('presets');
                setIsThemeModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-lg transition-colors shadow-2xs"
              title="Vorkonfigurierte Team-Themes (Catppuccin, Nord, Dracula, OLED, etc.) ansehen & anwenden"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Team-Presets</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setThemeModalTab('export');
                setIsThemeModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors shadow-2xs"
              title="Theme-Farben als .json exportieren oder Code kopieren"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Theme exportieren</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setThemeModalTab('import');
                setIsThemeModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors shadow-2xs"
              title="Theme von Kollegen (.json Datei oder Code) importieren"
            >
              <Upload className="w-3.5 h-3.5 text-purple-600" />
              <span>Theme importieren</span>
            </button>
          </div>
        </div>

        {/* 4 Theme Options Buttons in generous 4-column layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => onChangeConfig({ baseThemeMode: 'system' })}
            className={`p-3 rounded-xl border text-left transition-all ${
              (config.baseThemeMode || 'system') === 'system'
                ? 'border-sky-500 bg-white ring-2 ring-sky-400/25 shadow-xs'
                : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
              <Monitor className="w-4 h-4 text-sky-600 shrink-0" />
              <span>System / Automatisch</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Folgt Firefox- und Betriebssystem-Einstellung (Hell oder Dunkel).
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeConfig({ baseThemeMode: 'dark' })}
            className={`p-3 rounded-xl border text-left transition-all ${
              config.baseThemeMode === 'dark'
                ? 'border-sky-500 bg-slate-900 text-white ring-2 ring-sky-400/25 shadow-xs'
                : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              <Moon className={`w-4 h-4 shrink-0 ${config.baseThemeMode === 'dark' ? 'text-amber-400' : 'text-slate-600'}`} />
              <span className={config.baseThemeMode === 'dark' ? 'text-white' : 'text-slate-800'}>Dunkel (Firefox Dark)</span>
            </div>
            <div className={`text-[11px] mt-1 leading-snug ${config.baseThemeMode === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
              Rahmen: <code>#1c1b22</code>, Toolbar: <code>#2b2a33</code>. Verhindert grelles Aufblitzen.
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeConfig({ baseThemeMode: 'light' })}
            className={`p-3 rounded-xl border text-left transition-all ${
              config.baseThemeMode === 'light'
                ? 'border-sky-500 bg-white ring-2 ring-sky-400/25 shadow-xs'
                : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
              <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Hell (Firefox Light)</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Rahmen: <code>#ffffff</code>, Toolbar: <code>#f0f0f4</code>. Helles Menü-Design.
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeConfig({ baseThemeMode: 'custom' })}
            className={`p-3 rounded-xl border text-left transition-all ${
              config.baseThemeMode === 'custom'
                ? 'border-purple-500 bg-white ring-2 ring-purple-400/25 shadow-xs'
                : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-purple-900">
              <Paintbrush className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Individuell (Eigene Farben)</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              Exakte Hex-Farben für Rahmen, Symbolleiste und Schrift manuell festlegen.
            </div>
          </button>
        </div>

        {/* Individuelle Farbkonfiguration - Geräumig & ohne Überschneidungen! */}
        {config.baseThemeMode === 'custom' && (
          <div className="p-4 bg-white rounded-xl border border-purple-200/90 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-600" />
                  <span>Individuelle Basisfarben bearbeiten</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Hier können Sie die Farben für Browserrahmen, Toolbar und Schrift frei definieren. Die Eingabefelder sind großzügig getrennt.
                </div>
              </div>

              {/* Schnellauswahl-Voreinstellungen */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Presets:</span>
                <button
                  type="button"
                  onClick={() => onChangeConfig({
                    customBaseFrameColor: '#1c1b22',
                    customBaseToolbarColor: '#2b2a33',
                    customBaseTextColor: '#fbfbfe',
                  })}
                  className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  title="Klassisches Firefox Dark Theme"
                >
                  Firefox Dark
                </button>
                <button
                  type="button"
                  onClick={() => onChangeConfig({
                    customBaseFrameColor: '#090a0f',
                    customBaseToolbarColor: '#13151f',
                    customBaseTextColor: '#ffffff',
                  })}
                  className="px-2 py-1 text-[11px] font-medium bg-slate-900 hover:bg-black text-white rounded-md transition-colors"
                  title="OLED Tiefschwarz"
                >
                  OLED Schwarz
                </button>
                <button
                  type="button"
                  onClick={() => onChangeConfig({
                    customBaseFrameColor: '#0f172a',
                    customBaseToolbarColor: '#1e293b',
                    customBaseTextColor: '#f8fafc',
                  })}
                  className="px-2 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-sky-200 rounded-md transition-colors"
                  title="Nordisches Schiefergrau"
                >
                  Nordic Slate
                </button>
                <button
                  type="button"
                  onClick={() => onChangeConfig({
                    customBaseFrameColor: '#ffffff',
                    customBaseToolbarColor: '#f0f0f4',
                    customBaseTextColor: '#15141a',
                  })}
                  className="px-2 py-1 text-[11px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md transition-colors"
                  title="Helles Farbschema"
                >
                  Hell
                </button>
                <button
                  type="button"
                  onClick={() => onChangeConfig({
                    customBaseFrameColor: '#1c1b22',
                    customBaseToolbarColor: '#2b2a33',
                    customBaseTextColor: '#fbfbfe',
                  })}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors ml-1"
                  title="Auf Standard zurücksetzen (#1c1b22, #2b2a33, #fbfbfe)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                {/* Theme Sharing & Exchange Buttons for Colleagues */}
                <button
                  type="button"
                  onClick={() => {
                    setThemeModalTab('export');
                    setIsThemeModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
                  title="Exportiert dieses Theme als .json Datei oder Kopier-Code für Kollegen"
                >
                  <Share2 className="w-3 h-3 text-purple-600" />
                  <span>Theme teilen</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setThemeModalTab('import');
                    setIsThemeModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors"
                  title="Theme eines Kollegen (.json Datei oder Code) einfügen"
                >
                  <Upload className="w-3 h-3 text-slate-600" />
                  <span>Importieren</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickCopyTheme}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  title="Kopiert die aktuellen Theme-Farben direkt in die Zwischenablage"
                >
                  {copiedQuickCode ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Code kopieren</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Die 3 Eingabekarten nebeneinander mit ausreichend Abstand & ohne Überschneidung */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* 1. Rahmen (Frame) */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    1. Rahmen (Browser-Frame)
                  </label>
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                    style={{ backgroundColor: config.customBaseFrameColor || '#1c1b22' }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Hintergrund des Fensters und der inaktiven Tab-Reihe.
                </p>

                {/* Eingabebereich: Colorpicker & Textfeld sauber nebeneinander mit min-w-0 */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={config.customBaseFrameColor || '#1c1b22'}
                    onChange={(e) => onChangeConfig({ customBaseFrameColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5 shrink-0 bg-white shadow-2xs"
                    title="Farbwähler öffnen"
                  />
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-400 pointer-events-none">
                      #
                    </span>
                    <input
                      type="text"
                      maxLength={7}
                      value={(config.customBaseFrameColor || '#1c1b22').replace(/^#/, '')}
                      onChange={(e) => {
                        const val = e.target.value.trim().replace(/^#/, '');
                        const fullHex = '#' + val;
                        onChangeConfig({ customBaseFrameColor: fullHex });
                      }}
                      placeholder="1C1B22"
                      className="w-full pl-6 pr-2.5 py-2 font-mono text-xs font-semibold uppercase rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-2xs"
                    />
                  </div>
                </div>

                {/* Quick Swatches für Rahmen */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400">Schnell:</span>
                  {[
                    { hex: '#1c1b22', label: 'Dark' },
                    { hex: '#090a0f', label: 'OLED' },
                    { hex: '#0f172a', label: 'Slate' },
                    { hex: '#ffffff', label: 'Weiß' },
                  ].map((s) => (
                    <button
                      key={s.hex}
                      type="button"
                      onClick={() => onChangeConfig({ customBaseFrameColor: s.hex })}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Symbolleiste (Toolbar) */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    2. Symbolleiste (Toolbar)
                  </label>
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                    style={{ backgroundColor: config.customBaseToolbarColor || '#2b2a33' }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Adressleiste, Navigationsleiste und aktiver Tab.
                </p>

                {/* Eingabebereich: Colorpicker & Textfeld sauber nebeneinander mit min-w-0 */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={config.customBaseToolbarColor || '#2b2a33'}
                    onChange={(e) => onChangeConfig({ customBaseToolbarColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5 shrink-0 bg-white shadow-2xs"
                    title="Farbwähler öffnen"
                  />
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-400 pointer-events-none">
                      #
                    </span>
                    <input
                      type="text"
                      maxLength={7}
                      value={(config.customBaseToolbarColor || '#2b2a33').replace(/^#/, '')}
                      onChange={(e) => {
                        const val = e.target.value.trim().replace(/^#/, '');
                        const fullHex = '#' + val;
                        onChangeConfig({ customBaseToolbarColor: fullHex });
                      }}
                      placeholder="2B2A33"
                      className="w-full pl-6 pr-2.5 py-2 font-mono text-xs font-semibold uppercase rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-2xs"
                    />
                  </div>
                </div>

                {/* Quick Swatches für Toolbar */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400">Schnell:</span>
                  {[
                    { hex: '#2b2a33', label: 'Dark' },
                    { hex: '#13151f', label: 'OLED' },
                    { hex: '#1e293b', label: 'Slate' },
                    { hex: '#f0f0f4', label: 'Hell' },
                  ].map((s) => (
                    <button
                      key={s.hex}
                      type="button"
                      onClick={() => onChangeConfig({ customBaseToolbarColor: s.hex })}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Schrift & Icons (Text) */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    3. Schrift &amp; Icons (UI Text)
                  </label>
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                    style={{ backgroundColor: config.customBaseTextColor || '#fbfbfe' }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Farbe für Tab-Titel, Adressleistentext und Browser-Icons.
                </p>

                {/* Eingabebereich: Colorpicker & Textfeld sauber nebeneinander mit min-w-0 */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={config.customBaseTextColor || '#fbfbfe'}
                    onChange={(e) => onChangeConfig({ customBaseTextColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5 shrink-0 bg-white shadow-2xs"
                    title="Farbwähler öffnen"
                  />
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-400 pointer-events-none">
                      #
                    </span>
                    <input
                      type="text"
                      maxLength={7}
                      value={(config.customBaseTextColor || '#fbfbfe').replace(/^#/, '')}
                      onChange={(e) => {
                        const val = e.target.value.trim().replace(/^#/, '');
                        const fullHex = '#' + val;
                        onChangeConfig({ customBaseTextColor: fullHex });
                      }}
                      placeholder="FBFBFE"
                      className="w-full pl-6 pr-2.5 py-2 font-mono text-xs font-semibold uppercase rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-2xs"
                    />
                  </div>
                </div>

                {/* Quick Swatches für Text */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400">Schnell:</span>
                  {[
                    { hex: '#fbfbfe', label: 'Weiß' },
                    { hex: '#cbd5e1', label: 'Silber' },
                    { hex: '#0f172a', label: 'Dunkel' },
                    { hex: '#15141a', label: 'Schwarz' },
                  ].map((s) => (
                    <button
                      key={s.hex}
                      type="button"
                      onClick={() => onChangeConfig({ customBaseTextColor: s.hex })}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live-Vorschau der konfigurierten Basisfarben */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>Live-Vorschau Ihres individuellen Firefox-Layouts:</span>
                <span className="text-[10px] font-mono text-slate-500">
                  Rahmen: {config.customBaseFrameColor || '#1c1b22'} | Toolbar: {config.customBaseToolbarColor || '#2b2a33'} | Text: {config.customBaseTextColor || '#fbfbfe'}
                </span>
              </div>
              <div
                className="rounded-lg p-2.5 text-xs shadow-inner transition-colors"
                style={{ backgroundColor: config.customBaseFrameColor || '#1c1b22' }}
              >
                {/* Tabs bar */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="px-3 py-1 rounded-t-md text-xs font-semibold flex items-center gap-1.5 border-t-2"
                    style={{
                      backgroundColor: config.customBaseToolbarColor || '#2b2a33',
                      color: config.customBaseTextColor || '#fbfbfe',
                      borderTopColor: config.defaultColor || '#37adff',
                    }}
                  >
                    <span>🦊</span>
                    <span>Aktiver Tab (Vorschau)</span>
                  </div>
                  <div
                    className="px-2.5 py-1 text-xs opacity-60 flex items-center gap-1.5"
                    style={{ color: config.customBaseTextColor || '#fbfbfe' }}
                  >
                    <span>🌐</span>
                    <span>Inaktiver Tab</span>
                  </div>
                </div>

                {/* Toolbar bar */}
                <div
                  className="rounded-md p-1.5 flex items-center gap-2 text-xs"
                  style={{
                    backgroundColor: config.customBaseToolbarColor || '#2b2a33',
                    color: config.customBaseTextColor || '#fbfbfe',
                  }}
                >
                  <span className="opacity-75 text-xs">‹ › ↻</span>
                  <div
                    className="flex-1 px-2.5 py-0.5 rounded text-[11px] font-mono border"
                    style={{
                      backgroundColor: `${config.customBaseFrameColor || '#1c1b22'}88`,
                      borderColor: `${config.customBaseTextColor || '#fbfbfe'}22`,
                      color: config.customBaseTextColor || '#fbfbfe',
                    }}
                  >
                    https://example.com/meine-seite
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: `${config.defaultColor || '#37adff'}33`,
                      color: config.defaultColor || '#37adff',
                    }}
                  >
                    TabChroma
                  </span>
                </div>
              </div>
            </div>

            {/* Team Theme Share & Exchange Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-purple-50/80 border border-purple-200/80 rounded-lg text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-200/80 flex items-center justify-center text-purple-800 shrink-0">
                  <Share2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold text-purple-950 flex items-center gap-2">
                    <span>Theme mit Kollegen teilen oder übertragen</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-200 text-purple-800">1-Klick</span>
                  </div>
                  <div className="text-[11px] text-purple-700 leading-tight mt-0.5">
                    Geben Sie Ihren Kollegen nur das Theme (Farben, Kontraste &amp; Deckkraft) mit – Ihre privaten URL-Regeln bleiben vollständig bei Ihnen.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    setThemeModalTab('export');
                    setIsThemeModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-2xs"
                  title="Theme als .json herunterladen oder Code kopieren"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Theme exportieren</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setThemeModalTab('import');
                    setIsThemeModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-purple-300 text-purple-900 font-bold text-xs transition-colors shadow-2xs"
                  title="Theme von Kollegen importieren"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-600" />
                  <span>Theme importieren</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Deckkraft des aktiven Tabs & Favicon-Kontrast (Löst verschwommene Icons) */}
      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-bold text-slate-800">
                5. Deckkraft des aktiven Tabs &amp; Favicon-Erkennbarkeit
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                {Math.round((config.activeTabOpacity ?? 0.35) * 100)}% Deckkraft
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Verhindert, dass Favicons mit gleicher Farbe wie der Tab (z. B. rotes Symbol auf rotem Tab) unsichtbar werden.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { val: 0.25, label: '25% Dezent' },
              { val: 0.35, label: '35% Empfohlen' },
              { val: 0.50, label: '50% Ausgewogen' },
              { val: 0.75, label: '75% Kräftig' },
              { val: 1.00, label: '100% Vollflächig' },
            ].map(({ val, label }) => {
              const isSelected = Math.abs((config.activeTabOpacity ?? 0.35) - val) < 0.05;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChangeConfig({ activeTabOpacity: val })}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-all ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slider & Live Before/After Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Transparenter / Höchster Kontrast (15%)</span>
              <span>Vollflächig (100%)</span>
            </div>
            <input
              type="range"
              min="0.15"
              max="1.0"
              step="0.05"
              value={config.activeTabOpacity ?? 0.35}
              onChange={(e) => onChangeConfig({ activeTabOpacity: parseFloat(e.target.value) })}
              className="w-full accent-sky-600 cursor-pointer"
            />
            
            <label className="flex items-start gap-2.5 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={config.enableFaviconContrastHalo !== false}
                onChange={(e) => onChangeConfig({ enableFaviconContrastHalo: e.target.checked })}
                className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <div>
                <span className="font-semibold text-xs text-slate-800 block">
                  Automatischer Favicon-Kontrast-Schutz (Halo-Kontur)
                </span>
                <span className="text-[11px] text-slate-500 block leading-snug">
                  Legt einen subtilen Licht-/Schatten-Schutzrand um Website-Favicons, damit Konturen auch bei identischer Farbe messerscharf bleiben.
                </span>
              </div>
            </label>
          </div>

          {/* Visual comparison reproducing the user's exact scenario with custom test logo */}
          <div className="bg-[#181825] p-3 rounded-lg border border-slate-700/60 text-xs text-white space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-300">
                Eigenes Logo für Gleichfarbigkeits-Test:
              </span>
              
              {/* Select Logo Variant & Color */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setTestLogoVariant('layers')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      testLogoVariant === 'layers' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Schichten
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestLogoVariant('prism')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      testLogoVariant === 'prism' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Prisma
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestLogoVariant('hexagon')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      testLogoVariant === 'hexagon' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Hexagon
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {[
                    { hex: '#ff4f5e', name: 'Rot' },
                    { hex: '#37adff', name: 'Blau' },
                    { hex: '#51cf66', name: 'Grün' },
                    { hex: '#ff9400', name: 'Orange' },
                  ].map(({ hex, name }) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setTestLogoColor(hex)}
                      className={`w-4 h-4 rounded-full border transition-all ${
                        testLogoColor === hex ? 'ring-2 ring-white scale-110' : 'border-black/30 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Bad example: 100% opacity */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div 
                  className="relative w-14 h-12 rounded-t-lg border-t-2 flex items-center justify-center shadow-xs"
                  style={{
                    backgroundColor: testLogoColor,
                    borderTopColor: testLogoColor,
                  }}
                >
                  {/* Test logo on solid identical color (barely visible) */}
                  <ChromaTestLogo 
                    color={testLogoColor} 
                    size={20} 
                    variant={testLogoVariant} 
                    withHalo={false} 
                  />
                </div>
                <span className="text-[10px] text-rose-400 font-semibold text-center whitespace-nowrap">
                  100% (Verschwimmt)
                </span>
              </div>

              <div className="text-slate-500 font-bold text-sm shrink-0">→</div>

              {/* Good example: Selected opacity with halo */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div 
                  className="relative w-14 h-12 rounded-t-lg border-t-2 flex items-center justify-center transition-all shadow-xs"
                  style={{
                    backgroundColor: hexToRgba(testLogoColor, config.activeTabOpacity ?? 0.35),
                    borderTopColor: testLogoColor,
                  }}
                >
                  {/* Test logo on translucent background with contrast halo */}
                  <ChromaTestLogo 
                    color={testLogoColor} 
                    size={20} 
                    variant={testLogoVariant} 
                    withHalo={config.enableFaviconContrastHalo !== false} 
                  />
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold text-center whitespace-nowrap">
                  {Math.round((config.activeTabOpacity ?? 0.35) * 100)}% (Klar erkennbar!)
                </span>
              </div>

              <div className="flex-1 text-[11px] text-slate-400 pl-2 border-l border-slate-700/60 leading-snug">
                Das Logo und der Tab haben exakt dieselbe Farbe (<code className="font-mono text-slate-200">{testLogoColor}</code>). Dank reduzierter Deckkraft schimmert der dunkle Firefox-Hintergrund sanft durch und das Symbol hebt sich gestochen scharf ab!
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AMO Add-on ID Configuration */}
      <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Mozilla AMO Add-on-ID (manifest.json):</span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              AMO Übereinstimmung
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Wird für Updates auf Mozilla Add-ons (AMO) zwingend vorausgesetzt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={config.geckoId || 'tabchroma-tab-color@whosmann.de'}
            onChange={(e) => onChangeConfig({ geckoId: e.target.value })}
            placeholder="tabchroma-tab-color@whosmann.de"
            className="px-3 py-1.5 text-xs font-mono font-medium rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[280px]"
          />
        </div>
      </div>

      {/* Info Notice */}
      <div className="flex items-center gap-2 p-2.5 bg-sky-50 rounded-lg border border-sky-200 text-xs text-sky-900">
        <Info className="w-4 h-4 text-sky-600 shrink-0" />
        <span>
          <strong>Tipp für JSON-Import & neue Regeln:</strong> Beim Importieren von JSON werden Sie gefragt, ob das hier konfigurierte Standard-Farbschema auf alle importierten Regeln angewendet werden soll.
        </span>
      </div>

      {/* Theme Import / Export Modal */}
      <ThemeImportExportModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        config={config}
        onApplyTheme={(themeUpdates) => {
          onChangeConfig({
            ...themeUpdates,
            baseThemeMode: 'custom',
          });
        }}
        onUpdateSavedThemes={(savedThemes) => {
          onChangeConfig({ savedThemes });
        }}
        initialTab={themeModalTab}
      />
    </div>
  );
};
