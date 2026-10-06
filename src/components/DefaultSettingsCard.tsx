import React from 'react';
import { Palette, Shield, Settings2, RotateCcw, Sparkles, Check, Info } from 'lucide-react';
import { ExtensionConfig, FirefoxContainerColor, ColorMode } from '../types/extension';
import { FIREFOX_CONTAINER_COLORS } from '../utils/urlMatcher';

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
