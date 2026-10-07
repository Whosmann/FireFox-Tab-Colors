import React, { useState } from 'react';
import { Palette, Shield, Settings2, RotateCcw, Sparkles, Check, Info, Sliders, Layers } from 'lucide-react';
import { ExtensionConfig, FirefoxContainerColor, ColorMode } from '../types/extension';
import { FIREFOX_CONTAINER_COLORS, hexToRgba } from '../utils/urlMatcher';
import { ChromaTestLogo, LogoVariant } from './ChromaTestLogo';

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
                  Firefox-Fenstertheme überschreiben
                </span>
                <span className="text-[11px] text-slate-500 block leading-snug">
                  {config.enableActiveTabTheme ? (
                    <span className="text-amber-700 font-medium">
                      Aktiv: Firefox-Symbolleisten wechseln beim Tab-Wechsel die Farbe.
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      Deaktiviert: Ihr persönliches Firefox-Farbschema bleibt 100% geschützt.
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

      {/* 4. Deckkraft des aktiven Tabs & Favicon-Kontrast (Löst verschwommene Icons) */}
      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-bold text-slate-800">
                Deckkraft des aktiven Tabs &amp; Favicon-Erkennbarkeit
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
    </div>
  );
};
