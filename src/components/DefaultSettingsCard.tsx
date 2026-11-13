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
  Copy,
  Eye,
  Wand2,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { ExtensionConfig, FirefoxContainerColor, ColorMode, BaseThemeMode, HybridWindowBehavior, HybridTabIndicatorStyle, UnmatchedActiveTabStyle } from '../types/extension';
import { 
  FIREFOX_CONTAINER_COLORS, 
  hexToRgba, 
  getContrastRatio, 
  getWcagRating, 
  getOptimalTextColor, 
  getUnmatchedActiveTabAppearance,
  shiftHexForTabLift,
  blendHexColors
} from '../utils/urlMatcher';
import { ChromaTestLogo, LogoVariant } from './ChromaTestLogo';
import { ThemeImportExportModal, POPULAR_THEME_PRESETS } from './ThemeImportExportModal';

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
  const [copiedPaletteCodes, setCopiedPaletteCodes] = useState(false);
  const [copiedSingleColor, setCopiedSingleColor] = useState<string | null>(null);
  const [paletteViewStyle, setPaletteViewStyle] = useState<'browser' | 'swatches'>('browser');
  const [previewActiveTabType, setPreviewActiveTabType] = useState<'unmatched' | 'matched'>('unmatched');

  const customFrame = config.customBaseFrameColor || '#1c1b22';
  const customToolbar = config.customBaseToolbarColor || '#2b2a33';
  const customText = config.customBaseTextColor || '#fbfbfe';
  const defaultAccent = config.defaultColor || '#37adff';

  // Effective colors for the currently selected baseThemeMode ('system' | 'dark' | 'light' | 'custom')
  const effectiveFrame = config.baseThemeMode === 'custom'
    ? customFrame
    : config.baseThemeMode === 'light'
    ? '#f0f0f4'
    : '#1c1b22';
  const effectiveToolbar = config.baseThemeMode === 'custom'
    ? customToolbar
    : config.baseThemeMode === 'light'
    ? '#ffffff'
    : '#2b2a33';
  const effectiveText = config.baseThemeMode === 'custom'
    ? customText
    : config.baseThemeMode === 'light'
    ? '#15141a'
    : '#fbfbfe';

  const toolbarContrast = getWcagRating(customText, customToolbar);
  const frameContrast = getWcagRating(customText, customFrame);

  // Evaluate Active Tab WITHOUT rule against the active theme
  const unmatchedEval = getUnmatchedActiveTabAppearance({
    frameHex: effectiveFrame,
    toolbarHex: effectiveToolbar,
    textHex: effectiveText,
    defaultColor: defaultAccent,
    activeTabOpacity: config.activeTabOpacity ?? 0.35,
    unmatchedActiveTabStyle: config.unmatchedActiveTabStyle || 'subtle_lift',
    unmatchedActiveTabBg: config.unmatchedActiveTabBg,
    unmatchedActiveTabLine: config.unmatchedActiveTabLine,
    enableUnmatchedTabLine: config.enableUnmatchedTabLine !== false,
  });

  const handleAutoOptimizeUnmatchedTab = () => {
    const liftedBg = shiftHexForTabLift(effectiveFrame, effectiveToolbar);
    const liftedLine = blendHexColors(effectiveText, defaultAccent, 0.45);
    onChangeConfig({
      unmatchedActiveTabStyle: 'custom_color',
      unmatchedActiveTabBg: liftedBg,
      unmatchedActiveTabLine: liftedLine,
      enableUnmatchedTabLine: true,
    });
  };

  const handleCopySingleColor = (colorHex: string, label: string) => {
    try {
      navigator.clipboard?.writeText(colorHex);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = colorHex;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedSingleColor(label);
    setTimeout(() => setCopiedSingleColor(null), 2000);
  };

  const handleCopyAllPalette = () => {
    const text = `Rahmen: ${customFrame} | Symbolleiste: ${customToolbar} | Schrift: ${customText} | Aktiv-Tab (ohne Regel): ${unmatchedEval.tabBgHex}`;
    try {
      navigator.clipboard?.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedPaletteCodes(true);
    setTimeout(() => setCopiedPaletteCodes(false), 2200);
  };

  const handleSwapFrameToolbar = () => {
    onChangeConfig({
      customBaseFrameColor: customToolbar,
      customBaseToolbarColor: customFrame,
    });
  };

  const handleAutoOptimizeTextColor = () => {
    const optimal = getOptimalTextColor(customToolbar);
    onChangeConfig({ customBaseTextColor: optimal });
  };

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
      unmatchedActiveTabStyle: config.unmatchedActiveTabStyle || 'subtle_lift',
      unmatchedActiveTabBg: config.unmatchedActiveTabBg,
      unmatchedActiveTabLine: config.unmatchedActiveTabLine,
      enableUnmatchedTabLine: config.enableUnmatchedTabLine !== false,
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

        {/* Schnelle Paletten-Vorschau wenn nicht im benutzerdefinierten Modus */}
        {config.baseThemeMode !== 'custom' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <span 
                  className="w-4 h-4 rounded-full border border-black/20 shadow-2xs" 
                  style={{ backgroundColor: customFrame }} 
                  title={`Gespeicherter Rahmen: ${customFrame}`}
                />
                <span 
                  className="w-4 h-4 rounded-full border border-black/20 shadow-2xs" 
                  style={{ backgroundColor: customToolbar }} 
                  title={`Gespeicherte Toolbar: ${customToolbar}`}
                />
                <span 
                  className="w-4 h-4 rounded-full border border-black/20 shadow-2xs" 
                  style={{ backgroundColor: customText }} 
                  title={`Gespeicherter Text: ${customText}`}
                />
              </div>
              <div>
                <span className="font-semibold text-slate-800">Gespeicherte individuelle Farbpalette:</span>{' '}
                <span className="font-mono text-[11px] text-slate-500">
                  Rahmen {customFrame} · Toolbar {customToolbar} · Text {customText}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChangeConfig({ baseThemeMode: 'custom' })}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors shrink-0 self-start sm:self-center"
            >
              <Paintbrush className="w-3.5 h-3.5 text-purple-600" />
              <span>Individuelle Palette bearbeiten &amp; anwenden</span>
            </button>
          </div>
        )}

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
                {POPULAR_THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChangeConfig({
                      customBaseFrameColor: preset.frame,
                      customBaseToolbarColor: preset.toolbar,
                      customBaseTextColor: preset.text,
                      defaultColor: preset.defaultColor || config.defaultColor,
                    })}
                    className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                    title={`${preset.name}: ${preset.description}`}
                  >
                    {preset.name}
                  </button>
                ))}
                {(config.savedThemes || []).map((saved) => (
                  <button
                    key={saved.id}
                    type="button"
                    onClick={() => onChangeConfig({
                      customBaseFrameColor: saved.frame,
                      customBaseToolbarColor: saved.toolbar,
                      customBaseTextColor: saved.text,
                      defaultColor: saved.defaultColor || config.defaultColor,
                    })}
                    className="px-2 py-1 text-[11px] font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-md transition-colors"
                    title={`Eigenes Theme: ${saved.name}`}
                  >
                    ⭐ {saved.name}
                  </button>
                ))}
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

            {/* Live-Farbpaletten-Vorschau: Zeigt customBaseFrameColor, customBaseToolbarColor & customBaseTextColor */}
            <div className="p-4 rounded-xl border border-purple-200 bg-gradient-to-b from-slate-50/80 to-white space-y-3.5 shadow-2xs">
              {/* Header mit Titel, Beschreibung & Schnell-Werkzeugen */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200/80 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Live-Farbpaletten-Vorschau (Echtes Erscheinungsbild)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live synchron
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Zeigt die ausgewählten Farben für Rahmen, Symbolleiste und Schrift in Echtzeit vor dem Speichern oder Anwenden.
                  </p>
                </div>

                {/* Schnell-Aktionen für die Palette */}
                <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-center">
                  <button
                    type="button"
                    onClick={handleSwapFrameToolbar}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors shadow-2xs"
                    title="Tauscht Rahmen- und Toolbar-Farbe für invertierten Tiefeneffekt"
                  >
                    <ArrowRightLeft className="w-3 h-3 text-slate-500" />
                    <span>Rahmen ↔ Toolbar tauschen</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoOptimizeTextColor}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors shadow-2xs"
                    title="Wählt automatisch die kontrastreichste Schriftfarbe (#fbfbfe oder #15141a) passend zur Symbolleiste"
                  >
                    <Wand2 className="w-3 h-3 text-purple-600" />
                    <span>Auto-Kontrast</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyAllPalette}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors shadow-2xs"
                    title="Kopiert alle drei Farb-Hex-Codes"
                  >
                    {copiedPaletteCodes ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Kopiert!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>Palette kopieren</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 3 Farbpaletten-Karten nebeneinander */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Rahmen (Frame) Card */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div 
                    className="w-9 h-9 rounded-lg border border-black/15 shadow-inner shrink-0 flex items-center justify-center font-mono text-[10px] font-bold text-white/90"
                    style={{ backgroundColor: customFrame }}
                  >
                    <span className="drop-shadow-sm">1</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Rahmen (Frame)
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs font-bold text-slate-800 truncate">
                        {customFrame}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySingleColor(customFrame, 'frame')}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        title="Hex-Code kopieren"
                      >
                        {copiedSingleColor === 'frame' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Fenster-Hintergrund &amp; inaktive Tabs
                    </div>
                  </div>
                </div>

                {/* 2. Symbolleiste (Toolbar) Card */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div 
                    className="w-9 h-9 rounded-lg border border-black/15 shadow-inner shrink-0 flex items-center justify-center font-mono text-[10px] font-bold text-white/90"
                    style={{ backgroundColor: customToolbar }}
                  >
                    <span className="drop-shadow-sm">2</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Symbolleiste (Toolbar)
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs font-bold text-slate-800 truncate">
                        {customToolbar}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySingleColor(customToolbar, 'toolbar')}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        title="Hex-Code kopieren"
                      >
                        {copiedSingleColor === 'toolbar' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Aktiver Tab &amp; Adressleiste
                    </div>
                  </div>
                </div>

                {/* 3. Schrift & Icons (Text) Card */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div 
                    className="w-9 h-9 rounded-lg border border-black/15 shadow-inner shrink-0 flex items-center justify-center font-mono text-[10px] font-bold"
                    style={{ backgroundColor: customText, color: customToolbar }}
                  >
                    <span className="font-black">Aa</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Schrift (UI Text)</span>
                      <span className={`text-[9px] font-bold px-1 rounded ${toolbarContrast.isGood ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {toolbarContrast.ratioStr}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs font-bold text-slate-800 truncate">
                        {customText}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySingleColor(customText, 'text')}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        title="Hex-Code kopieren"
                      >
                        {copiedSingleColor === 'text' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Tab-Titel &amp; Adress-URL
                    </div>
                  </div>
                </div>
              </div>

              {/* Harmonischer Paletten-Streifen mit Farbverteilung */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span>Proportionale Farbkomposition im Browser-UI:</span>
                  <span>Rahmen 45% · Toolbar 40% · Schrift &amp; Akzent 15%</span>
                </div>
                <div className="h-6 w-full rounded-lg overflow-hidden flex border border-black/10 shadow-2xs">
                  <div 
                    className="h-full flex items-center justify-center text-[10px] font-mono font-bold transition-all px-2"
                    style={{ width: '45%', backgroundColor: customFrame, color: customText }}
                    title={`Rahmen: ${customFrame}`}
                  >
                    <span className="truncate opacity-90">Rahmen ({customFrame})</span>
                  </div>
                  <div 
                    className="h-full flex items-center justify-center text-[10px] font-mono font-bold transition-all px-2"
                    style={{ width: '40%', backgroundColor: customToolbar, color: customText }}
                    title={`Toolbar: ${customToolbar}`}
                  >
                    <span className="truncate opacity-90">Toolbar ({customToolbar})</span>
                  </div>
                  <div 
                    className="h-full flex items-center justify-center text-[10px] font-mono font-bold transition-all px-1"
                    style={{ width: '15%', backgroundColor: defaultAccent, color: '#ffffff' }}
                    title={`Akzent: ${defaultAccent}`}
                  >
                    <span className="truncate">Akzent</span>
                  </div>
                </div>
              </div>

              {/* Realistische Live Firefox UI Simulation (Mit & Ohne Regel im direkten Vergleich) */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-purple-600" />
                    <span>Reales Firefox-Erscheinungsbild (Aktiv-Tab mit &amp; ohne Regel vs. Inaktive Tabs):</span>
                  </span>

                  {/* Umschalter zum Testen: Aktiver Tab OHNE Regel vs. MIT Regel */}
                  <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPreviewActiveTabType('unmatched')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                        previewActiveTabType === 'unmatched'
                          ? 'bg-white text-purple-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Prüft, wie sich ein aktiver Tab OHNE URL-Regel gegen den Rahmen und inaktive Tabs abhebt"
                    >
                      🔍 Aktiv-Tab OHNE Regel prüfen
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewActiveTabType('matched')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                        previewActiveTabType === 'matched'
                          ? 'bg-white text-purple-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Prüft einen aktiven Tab MIT zugewiesener URL-Regel"
                    >
                      🎨 Aktiv-Tab MIT Regel
                    </button>
                  </div>
                </div>

                <div
                  className="rounded-xl p-3 shadow-inner border border-black/15 transition-colors overflow-hidden"
                  style={{ backgroundColor: customFrame }}
                >
                  {/* Window Title & Tabs Bar */}
                  <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-0.5">
                    {/* Window Control Dots */}
                    <div className="flex items-center gap-1.5 pr-1 opacity-70 shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    </div>

                    {/* Tab 1: Tab OHNE Regel (Klickbar zum Aktivieren!) */}
                    <div
                      onClick={() => setPreviewActiveTabType('unmatched')}
                      title="Klicken, um diesen Tab ohne Regel als aktiven Tab zu testen"
                      className={`px-3 py-1.5 rounded-t-lg text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                        previewActiveTabType === 'unmatched'
                          ? 'font-bold shadow-xs'
                          : 'opacity-65 hover:opacity-95'
                      }`}
                      style={
                        previewActiveTabType === 'unmatched'
                          ? {
                              backgroundColor: unmatchedEval.tabBgCss,
                              color: customText,
                              borderTop: unmatchedEval.tabLineCss,
                            }
                          : {
                              backgroundColor: 'transparent',
                              color: customText,
                              borderTop: '3px solid transparent',
                            }
                      }
                    >
                      <span className="text-xs">🌐</span>
                      <span className="truncate max-w-[165px]">
                        wikipedia.org (Ohne Regel)
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider"
                        style={{
                          backgroundColor: previewActiveTabType === 'unmatched' ? `${customText}22` : `${customText}14`,
                          color: customText,
                        }}
                      >
                        {previewActiveTabType === 'unmatched' ? 'AKTIV' : 'Inaktiv'}
                      </span>
                    </div>

                    {/* Tab 2: Inaktiver Vergleichs-Tab direkt daneben auf Rahmenfarbe */}
                    <div
                      className="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors rounded-t-lg shrink-0"
                      style={{
                        backgroundColor: 'transparent',
                        color: customText,
                        opacity: 0.62,
                        borderTop: '3px solid transparent',
                      }}
                      title="Inaktiver Hintergrund-Tab auf Rahmenfarbe (#frame) zum direkten Kontrast-Vergleich"
                    >
                      <span className="text-xs">📄</span>
                      <span className="truncate max-w-[135px]">Startseite (Inaktiv)</span>
                    </div>

                    {/* Tab 3: Tab MIT URL-Regel (Klickbar zum Aktivieren!) */}
                    <div
                      onClick={() => setPreviewActiveTabType('matched')}
                      title="Klicken, um diesen Tab mit URL-Regel als aktiven Tab zu testen"
                      className={`relative px-3 py-1.5 rounded-t-lg text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                        previewActiveTabType === 'matched'
                          ? 'font-bold shadow-xs'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                      style={
                        previewActiveTabType === 'matched'
                          ? {
                              backgroundColor: hexToRgba(defaultAccent, config.activeTabOpacity ?? 0.35),
                              color: customText,
                              borderTop: `3px solid ${defaultAccent}`,
                            }
                          : {
                              backgroundColor: 'transparent',
                              color: customText,
                              borderTop: '3px solid transparent',
                            }
                      }
                    >
                      <span className="text-xs">🦊</span>
                      <span className="truncate max-w-[155px]">prod.app (Mit Regel)</span>
                      <span
                        className="text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider"
                        style={{
                          backgroundColor: `${defaultAccent}33`,
                          color: customText,
                        }}
                      >
                        {previewActiveTabType === 'matched' ? 'AKTIV' : 'Regel'}
                      </span>
                      {/* Container bottom line */}
                      <span
                        className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                        style={{ backgroundColor: defaultAccent }}
                      />
                    </div>

                    {/* New Tab Button */}
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-xs opacity-60 hover:opacity-100 transition-opacity shrink-0"
                      style={{ color: customText }}
                      title="Neuen Tab öffnen"
                    >
                      +
                    </div>
                  </div>

                  {/* Navigation & Toolbar Bar */}
                  <div
                    className="rounded-lg p-2 flex items-center gap-2 text-xs shadow-xs transition-colors"
                    style={{
                      backgroundColor: customToolbar,
                      color: customText,
                    }}
                  >
                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-1.5 px-1 opacity-80 shrink-0">
                      <span className="cursor-pointer hover:opacity-100">‹</span>
                      <span className="cursor-pointer hover:opacity-100">›</span>
                      <span className="cursor-pointer hover:opacity-100">↻</span>
                    </div>

                    {/* URL Omnibox */}
                    <div
                      className="flex-1 flex items-center gap-2 px-3 py-1 rounded-md text-[11px] font-mono border transition-colors shadow-2xs min-w-0"
                      style={{
                        backgroundColor: `${customFrame}99`,
                        borderColor: `${customText}26`,
                        color: customText,
                      }}
                    >
                      <span className="opacity-60 text-[10px]">🔒</span>
                      <span className="font-semibold truncate">
                        {previewActiveTabType === 'unmatched'
                          ? 'https://de.wikipedia.org/wiki/Firefox (Keine Regel aktiv)'
                          : 'https://prod.app/dashboard (Regel aktiv)'}
                      </span>
                    </div>

                    {/* Container Badge & Extension Icon */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {previewActiveTabType === 'matched' ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold shadow-2xs"
                          style={{
                            backgroundColor: `${defaultAccent}2b`,
                            color: defaultAccent,
                            border: `1px solid ${defaultAccent}55`,
                          }}
                        >
                          Container
                        </span>
                      ) : (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-medium opacity-75"
                          style={{
                            backgroundColor: `${customText}15`,
                            color: customText,
                          }}
                        >
                          Standard-Tab (Ohne Regel)
                        </span>
                      )}
                      <span 
                        className="w-5 h-5 rounded flex items-center justify-center text-[11px] opacity-80"
                        style={{ color: customText }}
                      >
                        ⚙️
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* WCAG Kontrast & Unterscheidbarkeits-Matrix (3 Spalten inkl. Aktiv-Tab ohne Regel vs. Inaktive Tabs) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs pt-0.5">
                {/* 1. Kontrast: Schrift auf Toolbar */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  toolbarContrast.isGood 
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
                    : 'bg-amber-50/60 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-center gap-2">
                    {toolbarContrast.isGood ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-[11px]">
                        Schrift auf Symbolleiste
                      </div>
                      <div className="text-[10px] opacity-75">
                        {toolbarContrast.label} (Stufe {toolbarContrast.level})
                      </div>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs">
                    {toolbarContrast.ratioStr}
                  </span>
                </div>

                {/* 2. Kontrast: Schrift auf Rahmen */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  frameContrast.isGood 
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
                    : 'bg-amber-50/60 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-center gap-2">
                    {frameContrast.isGood ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-[11px]">
                        Schrift auf Rahmen (Inaktiv)
                      </div>
                      <div className="text-[10px] opacity-75">
                        {frameContrast.label} (Stufe {frameContrast.level})
                      </div>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs">
                    {frameContrast.ratioStr}
                  </span>
                </div>

                {/* 3. Unterscheidbarkeit: Aktiv-Tab OHNE Regel vs. Inaktive Tabs */}
                <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  unmatchedEval.distinctionLevel === 'clear'
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    : unmatchedEval.distinctionLevel === 'moderate'
                    ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                    : 'bg-rose-50/70 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex items-center gap-2">
                    {unmatchedEval.distinctionLevel === 'clear' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className={`w-4 h-4 shrink-0 ${unmatchedEval.distinctionLevel === 'moderate' ? 'text-amber-600' : 'text-rose-600'}`} />
                    )}
                    <div>
                      <div className="font-bold text-[11px]">
                        Aktiv-Tab (ohne Regel) vs. Inaktiv
                      </div>
                      <div className="text-[10px] opacity-75">
                        {unmatchedEval.distinctionLabel}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs">
                    {unmatchedEval.frameContrastStr}
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

        {/* 4b. Aktiv-Tab Highlighting OHNE Regel – Gegen das Theme prüfen & einstellen (In allen Theme-Modi verfügbar!) */}
        <div className="p-4 bg-white rounded-xl border border-indigo-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-bold text-slate-900">
                  Aktiv-Tab Highlighting ohne Regel (Gegen das Theme prüfen &amp; einstellen)
                </span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                    unmatchedEval.distinctionLevel === 'clear'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : unmatchedEval.distinctionLevel === 'moderate'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                  }`}
                >
                  {unmatchedEval.distinctionLevel === 'clear'
                    ? '✓ Aktiv-Tab klar von anderen unterscheidbar'
                    : unmatchedEval.distinctionLevel === 'moderate'
                    ? '⚠️ Mäßig unterscheidbar'
                    : '⛔ Kaum von inaktiven Tabs unterscheidbar!'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Prüft und steuert, wie ein <strong>aktiver Tab ohne zutreffende URL-Regel</strong> (z. B. Startseite, Google, Wikipedia) gegen den Fensterrahmen (<code>{effectiveFrame}</code>) hervorgehoben wird, damit Sie den aktiven Tab jederzeit sofort von inaktiven Tabs unterscheiden können.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
              <button
                type="button"
                onClick={handleAutoOptimizeUnmatchedTab}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                title="Berechnet automatisch eine kontrastreiche Tab-Aufhellung und Fokus-Linie passend zum aktuellen Theme"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                <span>⚡ Optimal gegen Theme abheben</span>
              </button>
            </div>
          </div>

          {/* 4 Auswahl-Modi für Aktiv-Tab ohne Regel */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              1. Wie soll ein aktiver Tab OHNE Regel hervorgehoben werden?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              {[
                {
                  id: 'subtle_lift' as UnmatchedActiveTabStyle,
                  title: 'Kontrast-Lift & Fokus-Linie',
                  badge: 'Empfohlen',
                  desc: 'Hebt die Tab-Fläche automatisch vom Rahmen ab und zeigt eine dezente Fokus-Linie oben.',
                },
                {
                  id: 'default_accent' as UnmatchedActiveTabStyle,
                  title: 'Standard-Akzentfarbe',
                  badge: defaultAccent,
                  desc: 'Färbt auch aktive Tabs ohne Regel sanft in Ihrer Standard-Containerfarbe.',
                },
                {
                  id: 'custom_color' as UnmatchedActiveTabStyle,
                  title: 'Eigene Highlight-Farbe',
                  badge: 'Individuell',
                  desc: 'Eigene Hintergrund- und Linienfarbe speziell für aktive Tabs ohne Regel festlegen.',
                },
                {
                  id: 'toolbar_only' as UnmatchedActiveTabStyle,
                  title: 'Nur Toolbar-Farbe (Nativ)',
                  badge: 'Minimal',
                  desc: 'Kein Zusatz-Highlight; nutzt nur die reine Toolbar-Farbe ohne obere Linie.',
                },
              ].map((opt) => {
                const isSelected = (config.unmatchedActiveTabStyle || 'subtle_lift') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeConfig({ unmatchedActiveTabStyle: opt.id })}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-400/25 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 font-bold text-slate-900">
                        <span>{opt.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Farb- & Linien-Einstellungen + Live-Vergleich gegen das Theme */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Links (5 Spalten): Einstellungs-Regler für Fläche & Fokus-Linie */}
            <div className="lg:col-span-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>2. Feinabstimmung (Fläche &amp; Fokus-Linie)</span>
                  <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Tab: {unmatchedEval.tabBgHex}
                  </span>
                </div>

                {/* Schalter für obere Fokus-Linie (tab_line) */}
                {config.unmatchedActiveTabStyle !== 'toolbar_only' && (
                  <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg bg-white border border-slate-200">
                    <input
                      type="checkbox"
                      checked={config.enableUnmatchedTabLine !== false}
                      onChange={(e) => onChangeConfig({ enableUnmatchedTabLine: e.target.checked })}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800 block">
                        Obere 3px Fokus-Linie (tab_line) anzeigen
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                        Garantiert sofortige Erkennbarkeit des aktiven Tabs auch bei dunklen OLED-/Schiefer-Themes.
                      </span>
                    </div>
                  </label>
                )}

                {/* Farbwähler für Aktiv-Tab Hintergrund (ohne Regel) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">Aktiv-Tab Hintergrund (ohne Regel):</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={config.unmatchedActiveTabBg || unmatchedEval.tabBgHex}
                        onChange={(e) =>
                          onChangeConfig({
                            unmatchedActiveTabStyle: 'custom_color',
                            unmatchedActiveTabBg: e.target.value,
                          })
                        }
                        className="w-6 h-6 rounded cursor-pointer border border-slate-300 bg-white p-0.5"
                        title="Eigene Hintergrundfarbe für aktive Tabs ohne Regel wählen"
                      />
                      <span className="font-mono text-[11px] font-bold text-slate-800">
                        {unmatchedEval.tabBgHex}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-slate-400 mr-1">Schnell-Kontrast:</span>
                    {[
                      { hex: shiftHexForTabLift(effectiveFrame, effectiveToolbar), label: 'Auto-Lift' },
                      { hex: '#383747', label: 'Schiefer-Hell' },
                      { hex: '#2d3748', label: 'Blaugrau' },
                      { hex: '#e2e8f0', label: 'Silber (Light)' },
                    ].map((sw) => (
                      <button
                        key={sw.label}
                        type="button"
                        onClick={() =>
                          onChangeConfig({
                            unmatchedActiveTabStyle: 'custom_color',
                            unmatchedActiveTabBg: sw.hex,
                          })
                        }
                        className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-indigo-50 text-slate-700 font-medium cursor-pointer"
                      >
                        {sw.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Farbwähler für obere Fokus-Linie (tab_line) */}
                {config.unmatchedActiveTabStyle !== 'toolbar_only' && config.enableUnmatchedTabLine !== false && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">Fokus-Linie oben (tab_line):</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={config.unmatchedActiveTabLine || unmatchedEval.tabLineHex || defaultAccent}
                          onChange={(e) =>
                            onChangeConfig({
                              unmatchedActiveTabLine: e.target.value,
                            })
                          }
                          className="w-6 h-6 rounded cursor-pointer border border-slate-300 bg-white p-0.5"
                          title="Farbe der oberen 3px Fokus-Linie für aktive Tabs ohne Regel"
                        />
                        <span className="font-mono text-[11px] font-bold text-slate-800">
                          {unmatchedEval.tabLineHex || 'Auto'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-slate-400 mr-1">Linien-Farbe:</span>
                      {[
                        { hex: undefined, label: 'Auto (Theme)' },
                        { hex: defaultAccent, label: 'Standard-Akzent' },
                        { hex: '#94a3b8', label: 'Neutral-Silber' },
                        { hex: '#38bdf8', label: 'Sky-Blau' },
                        { hex: '#a855f7', label: 'Violett' },
                      ].map((sw) => (
                        <button
                          key={sw.label}
                          type="button"
                          onClick={() => onChangeConfig({ unmatchedActiveTabLine: sw.hex })}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-indigo-50 text-slate-700 font-medium cursor-pointer"
                        >
                          {sw.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Warnhinweis falls kaum unterscheidbar */}
              {!unmatchedEval.canDistinguish && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Warnung:</strong> {unmatchedEval.distinctionHint} Klicken Sie auf <strong>„⚡ Optimal gegen Theme abheben“</strong>, um den Aktiv-Tab sichtbar zu machen.
                  </div>
                </div>
              )}
            </div>

            {/* Rechts (7 Spalten): Live-Prüfung & direkter Tab-Unterscheidungs-Test gegen das Theme */}
            <div className="lg:col-span-7 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  3. Live-Prüfung gegen das Theme: Kann man den Aktiv-Tab unterscheiden?
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Rahmen: {effectiveFrame} · Toolbar: {effectiveToolbar}
                </span>
              </div>

              {/* Direkter visueller Tab-Leisten-Test auf echtem Theme-Rahmen */}
              <div
                className="p-3 rounded-xl border border-black/20 shadow-inner space-y-2"
                style={{ backgroundColor: effectiveFrame }}
              >
                <div className="text-[10px] font-mono opacity-75 flex items-center justify-between px-1" style={{ color: effectiveText }}>
                  <span>Hintergrund = Browser-Rahmen ({effectiveFrame})</span>
                  <span>Direkter 1:1 Vergleich der 3 Tab-Arten:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {/* Karte 1: AKTIVER TAB OHNE REGEL */}
                  <div
                    className="p-2.5 rounded-t-lg flex flex-col justify-between gap-1.5 shadow-sm transition-all"
                    style={{
                      backgroundColor: unmatchedEval.tabBgCss,
                      color: effectiveText,
                      borderTop: unmatchedEval.tabLineCss,
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">
                        1. Aktiv (Ohne Regel)
                      </span>
                      <span className="text-[10px] font-mono opacity-75">{unmatchedEval.tabBgHex}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold truncate py-0.5">
                      <span>🌐</span>
                      <span className="truncate">wikipedia.org</span>
                    </div>
                    <div className="text-[10px] opacity-80 leading-tight">
                      Abhebung: <strong>{unmatchedEval.frameContrastStr}</strong>
                      {unmatchedEval.hasVisibleTopLine ? ' + Linie' : ' (ohne Linie)'}
                    </div>
                  </div>

                  {/* Karte 2: INAKTIVER TAB */}
                  <div
                    className="p-2.5 rounded-t-lg flex flex-col justify-between gap-1.5 border border-dashed transition-all"
                    style={{
                      backgroundColor: effectiveFrame,
                      color: effectiveText,
                      borderColor: `${effectiveText}25`,
                      opacity: 0.72,
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-400/20">
                        2. Inaktiver Tab
                      </span>
                      <span className="text-[10px] font-mono opacity-75">{effectiveFrame}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium truncate py-0.5">
                      <span>📄</span>
                      <span className="truncate">duckduckgo.com</span>
                    </div>
                    <div className="text-[10px] opacity-75 leading-tight">
                      Liegt direkt auf dem Rahmen-Hintergrund
                    </div>
                  </div>

                  {/* Karte 3: AKTIVER TAB MIT REGEL */}
                  <div
                    className="relative p-2.5 rounded-t-lg flex flex-col justify-between gap-1.5 shadow-sm transition-all"
                    style={{
                      backgroundColor: hexToRgba(defaultAccent, config.activeTabOpacity ?? 0.35),
                      color: effectiveText,
                      borderTop: `3px solid ${defaultAccent}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/30 border border-sky-400/40">
                        3. Aktiv (Mit Regel)
                      </span>
                      <span className="text-[10px] font-mono opacity-85">{defaultAccent}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold truncate py-0.5">
                      <span>🚀</span>
                      <span className="truncate">prod.example.com</span>
                    </div>
                    <div className="text-[10px] opacity-85 leading-tight">
                      Container-Farbe ({Math.round((config.activeTabOpacity ?? 0.35) * 100)}% Deckkraft)
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Prüf-Kennzahlen unten */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className={`p-2 rounded-lg border ${
                  unmatchedEval.frameContrastRatio >= 1.18
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}>
                  <div className="text-[10px] font-semibold opacity-75">Flächen-Abhebung zum Rahmen</div>
                  <div className="font-bold font-mono text-xs mt-0.5">
                    {unmatchedEval.frameContrastStr} ({unmatchedEval.frameContrastRatio >= 1.18 ? 'Deutlich' : 'Gering'})
                  </div>
                </div>

                <div className={`p-2 rounded-lg border ${
                  unmatchedEval.hasVisibleTopLine
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}>
                  <div className="text-[10px] font-semibold opacity-75">Obere Fokus-Linie (tab_line)</div>
                  <div className="font-bold font-mono text-xs mt-0.5">
                    {unmatchedEval.tabLineHex ? `${unmatchedEval.lineContrastRatio.toFixed(1)}:1 (${unmatchedEval.tabLineHex})` : 'Deaktiviert'}
                  </div>
                </div>

                <div className={`p-2 rounded-lg border ${
                  unmatchedEval.textContrast.isGood
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/70 border-rose-200 text-rose-900'
                }`}>
                  <div className="text-[10px] font-semibold opacity-75">Text-Lesbarkeit im Aktiv-Tab</div>
                  <div className="font-bold font-mono text-xs mt-0.5">
                    {unmatchedEval.textContrast.ratioStr} (WCAG {unmatchedEval.textContrast.level})
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
