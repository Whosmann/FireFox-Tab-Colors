import React, { useState, useMemo, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Check, 
  AlertCircle, 
  X, 
  Sparkles, 
  Layers, 
  ArrowRight,
  Info,
  RefreshCw,
  ShieldCheck,
  HelpCircle,
  Copy
} from 'lucide-react';
import { TabColorRule, FirefoxContainerColor, ColorMode } from '../types/extension';

export type DuplicateConflictStrategy = 'update_conflicts' | 'keep_existing' | 'replace_all';

interface ImportRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (
    rules: TabColorRule[],
    strategy: DuplicateConflictStrategy,
    stats: { newCount: number; updatedCount: number; skippedCount: number; totalImported: number }
  ) => void;
  defaultColor: string;
  defaultContainerColor: FirefoxContainerColor;
  defaultMode: ColorMode;
  currentRuleCount: number;
  existingRules?: TabColorRule[];
}

export const getRuleKey = (patternType: string, pattern: string) => {
  return `${(patternType || 'domain').toLowerCase().trim()}::${(pattern || '').toLowerCase().trim()}`;
};

export const ImportRulesModal: React.FC<ImportRulesModalProps> = ({
  isOpen,
  onClose,
  onImport,
  defaultColor,
  defaultContainerColor,
  defaultMode,
  currentRuleCount,
  existingRules = [],
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<DuplicateConflictStrategy>('update_conflicts');
  const [applyDefaultColors, setApplyDefaultColors] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedRules, setDetectedRules] = useState<any[] | null>(null);
  const [showConflictDetails, setShowConflictDetails] = useState(false);

  // Reset state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setDetectedRules(null);
      setRawText('');
      setFileName(null);
      setShowConflictDetails(false);
    }
  }, [isOpen]);

  // Parses and extracts raw rules from JSON string
  const parseRulesFromJson = (jsonStr: string): { rules: any[]; error?: string } => {
    if (!jsonStr.trim()) {
      return { rules: [], error: 'Bitte JSON-Inhalt eingeben oder Datei auswählen.' };
    }

    try {
      const parsed = JSON.parse(jsonStr);
      let raw: any[] = [];

      if (Array.isArray(parsed)) {
        raw = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.rules)) {
          raw = parsed.rules;
        } else if (parsed.tabChromaConfig && Array.isArray(parsed.tabChromaConfig.rules)) {
          raw = parsed.tabChromaConfig.rules;
        } else if (parsed.config && Array.isArray(parsed.config.rules)) {
          raw = parsed.config.rules;
        } else if (Array.isArray(parsed.data)) {
          raw = parsed.data;
        } else if (Array.isArray(parsed.identities)) {
          // Firefox Multi-Account Containers format
          raw = parsed.identities.map((id: any) => ({
            name: id.name || 'Container',
            pattern: id.name ? `*.${id.name.toLowerCase()}.com` : '',
            patternType: 'wildcard',
            firefoxContainerColor: id.color || 'blue',
            firefoxContainerIcon: id.icon || 'circle',
            containerName: id.name || 'Container',
          }));
        } else if (parsed.pattern || parsed.url || parsed.host || parsed.name) {
          // Single rule object
          raw = [parsed];
        } else {
          return {
            rules: [],
            error: 'Die JSON-Struktur enthält keine Regelliste (erwartet: Array [ ... ] oder Objekt { "rules": [ ... ] }).',
          };
        }
      } else {
        return { rules: [], error: 'Ungültiges Format: Inhalt muss ein JSON-Objekt oder JSON-Array sein.' };
      }

      if (raw.length === 0) {
        return { rules: [], error: 'Die Datei enthält 0 Regeln.' };
      }

      return { rules: raw };
    } catch (err: any) {
      return {
        rules: [],
        error: `Ungültige JSON-Syntax: ${err.message || 'Syntaxfehler beim Parsen.'}`,
      };
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setRawText(content);
      const res = parseRulesFromJson(content);
      if (res.error) {
        setErrorMessage(res.error);
        setDetectedRules(null);
      } else {
        setDetectedRules(res.rules);
        setErrorMessage(null);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Fehler beim Lesen der Datei vom Dateisystem.');
      setDetectedRules(null);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setDetectedRules(null);
      setErrorMessage(null);
      return;
    }
    const res = parseRulesFromJson(text);
    if (res.error) {
      setErrorMessage(res.error);
      setDetectedRules(null);
    } else {
      setDetectedRules(res.rules);
      setErrorMessage(null);
    }
  };

  // Analyze distinct rules and conflicts with existing rules
  const analysis = useMemo(() => {
    if (!detectedRules || detectedRules.length === 0) return null;

    // 1. Deduplicate imported rules by distinct (patternType, pattern)
    const distinctImportedMap = new Map<string, any>();
    let internalDuplicateCount = 0;

    detectedRules.forEach((r, idx) => {
      const patternVal = String(r.pattern || r.url || r.host || r.domain || r.match || '').trim();
      const patternTypeVal = (r.patternType || 'domain').toLowerCase().trim();
      const key = `${patternTypeVal}::${patternVal.toLowerCase()}`;

      if (!distinctImportedMap.has(key)) {
        distinctImportedMap.set(key, { ...r, _origIndex: idx, _key: key, pattern: patternVal, patternType: patternTypeVal });
      } else {
        internalDuplicateCount++;
      }
    });

    const distinctRulesList = Array.from(distinctImportedMap.values());

    // 2. Build map of existing rules
    const existingKeyMap = new Map<string, TabColorRule>();
    existingRules.forEach((ex) => {
      const key = getRuleKey(ex.patternType, ex.pattern);
      existingKeyMap.set(key, ex);
    });

    // 3. Find conflicts (rules with matching patternType & pattern in existing rules)
    const newRules: any[] = [];
    const conflictRules: { imported: any; existing: TabColorRule }[] = [];

    distinctRulesList.forEach((imp) => {
      const key = imp._key;
      if (existingKeyMap.has(key)) {
        conflictRules.push({
          imported: imp,
          existing: existingKeyMap.get(key)!,
        });
      } else {
        newRules.push(imp);
      }
    });

    return {
      totalInFile: detectedRules.length,
      distinctCount: distinctRulesList.length,
      internalDuplicateCount,
      distinctRulesList,
      newRules,
      conflictRules,
      hasConflicts: conflictRules.length > 0,
    };
  }, [detectedRules, existingRules]);

  const handleExecuteImport = () => {
    if (!analysis || analysis.distinctRulesList.length === 0) {
      setErrorMessage('Keine gültigen Regeln zum Importieren vorhanden.');
      return;
    }

    // Convert distinct raw rules to valid TabColorRule objects
    const processed: TabColorRule[] = analysis.distinctRulesList.map((r, idx) => {
      const patternVal = String(r.pattern || '').trim();
      const nameVal = String(r.name || r.title || r.label || patternVal || `Regel ${idx + 1}`).trim();
      const containerVal = String(r.containerName || r.name || nameVal || 'Container').trim();

      return {
        id: r.id ? String(r.id) : `rule-${Date.now()}-${idx}`,
        name: nameVal,
        patternType: r.patternType || 'domain',
        pattern: patternVal,
        color: applyDefaultColors ? defaultColor : (r.color || defaultColor),
        firefoxContainerColor: applyDefaultColors ? defaultContainerColor : (r.firefoxContainerColor || defaultContainerColor),
        firefoxContainerIcon: r.firefoxContainerIcon || 'circle',
        customEmoji: r.customEmoji || '',
        enableTitleEmoji: r.enableTitleEmoji !== false,
        enableFaviconEmoji: r.enableFaviconEmoji !== false,
        containerName: containerVal,
        colorMode: applyDefaultColors ? defaultMode : (r.colorMode || defaultMode),
        accentBorder: r.accentBorder !== false,
        enabled: r.enabled !== false,
        priority: idx + 1,
      };
    });

    const stats = {
      newCount: analysis.newRules.length,
      updatedCount: conflictStrategy === 'update_conflicts' ? analysis.conflictRules.length : 0,
      skippedCount: conflictStrategy === 'keep_existing' ? analysis.conflictRules.length : 0,
      totalImported: processed.length,
    };

    onImport(processed, conflictStrategy, stats);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">URL-Regeln importieren (Distinct & Konfliktprüfung)</h3>
              <p className="text-xs text-slate-500">
                Regeln werden anhand von <strong>Pattern-Typ</strong> &amp; <strong>Pattern</strong> eindeutig (distinct) abgeglichen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2.5 px-4 text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'file'
                ? 'border-sky-600 text-sky-600 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Datei (.json) hochladen</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2.5 px-4 text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'text'
                ? 'border-sky-600 text-sky-600 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>JSON-Code direkt einfügen</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {activeTab === 'file' ? (
            <div className="space-y-3">
              <label className="border-2 border-dashed border-slate-300 hover:border-sky-400 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-sky-50/30">
                <Upload className="w-7 h-7 text-sky-500 mb-2" />
                <span className="font-semibold text-slate-800 text-sm">
                  {fileName ? fileName : 'JSON-Datei hier ablegen oder klicken'}
                </span>
                <span className="text-slate-400 text-xs mt-1">Unterstützt tabchroma-rules.json oder exportierte Regeldateien</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {fileName && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 text-slate-700">
                  <span className="font-mono truncate">{fileName}</span>
                  <button
                    onClick={() => {
                      setFileName(null);
                      setRawText('');
                      setDetectedRules(null);
                      setErrorMessage(null);
                    }}
                    className="text-slate-400 hover:text-rose-500 text-xs font-semibold"
                  >
                    Entfernen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">JSON-Regelcode hier einfügen:</label>
                <button
                  type="button"
                  onClick={() => {
                    const sample = JSON.stringify(
                      [
                        {
                          name: 'Beispiel Prod-Server',
                          pattern: 'prod.example.com',
                          patternType: 'domain',
                          color: '#e11d48',
                          containerName: 'Production Live',
                          customEmoji: '🚀',
                        },
                        {
                          name: 'Import Pipeline',
                          pattern: 'import.example.com/*',
                          patternType: 'wildcard',
                          color: '#0284c7',
                          containerName: 'Import Queue',
                          customEmoji: '⬇️',
                        },
                      ],
                      null,
                      2
                    );
                    handleTextChange(sample);
                  }}
                  className="text-[11px] text-sky-600 hover:underline"
                >
                  Beispiel-JSON einfügen
                </button>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => handleTextChange(e.target.value)}
                rows={6}
                placeholder='[&#10;  {&#10;    "name": "Mein Service",&#10;    "pattern": "prod.example.com",&#10;    "patternType": "domain",&#10;    "color": "#0284c7"&#10;  }&#10;]'
                className="w-full font-mono text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
              />
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">Fehler beim Einlesen:</span>
                <p className="text-[11px] leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Analysis / Status Banner */}
          {analysis && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-sky-50/80 border border-sky-200 text-sky-950 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sky-900">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Distinct-Analyse: {analysis.distinctCount} eindeutige Regeln erkannt</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-200/80 text-sky-900 font-semibold">
                    {analysis.totalInFile} in Datei
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="bg-white/80 p-2 rounded-lg border border-sky-100">
                    <span className="text-slate-500 block text-[10px]">Neue Regeln</span>
                    <strong className="text-emerald-700 text-xs font-bold">+{analysis.newRules.length} neu</strong>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-sky-100">
                    <span className="text-slate-500 block text-[10px]">Bereits vorhanden</span>
                    <strong className={analysis.hasConflicts ? 'text-amber-700 text-xs font-bold' : 'text-slate-700 text-xs'}>
                      {analysis.conflictRules.length} Duplikate
                    </strong>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-sky-100 col-span-2 sm:col-span-1">
                    <span className="text-slate-500 block text-[10px]">Distinct Pattern-Schlüssel</span>
                    <span className="text-slate-700 font-medium">Typ + Pattern</span>
                  </div>
                </div>

                {analysis.internalDuplicateCount > 0 && (
                  <p className="text-[10px] text-sky-700 italic">
                    ℹ️ Hinweis: {analysis.internalDuplicateCount} mehrfach vorkommende Duplikate innerhalb der Datei wurden automatisch auf distinct Typ+Pattern gefiltert.
                  </p>
                )}
              </div>

              {/* Conflict / Duplicate Strategy Selector */}
              {analysis.hasConflicts && (
                <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <HelpCircle className="w-4 h-4 text-amber-600" />
                      <span>Wie sollen die {analysis.conflictRules.length} bestehenden Duplikate behandelt werden?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConflictDetails(!showConflictDetails)}
                      className="text-[11px] text-amber-800 hover:underline font-semibold"
                    >
                      {showConflictDetails ? 'Details ausblenden' : 'Details anzeigen'}
                    </button>
                  </div>

                  <div className="space-y-2 pt-1 text-slate-800">
                    {/* Strategy 1: Update existing rules */}
                    <label className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                      conflictStrategy === 'update_conflicts' 
                        ? 'bg-white border-amber-400 ring-2 ring-amber-300/60 shadow-xs' 
                        : 'bg-white/50 border-amber-200 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="conflict_mode"
                        checked={conflictStrategy === 'update_conflicts'}
                        onChange={() => setConflictStrategy('update_conflicts')}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="space-y-0.5">
                        <strong className="text-slate-900 font-semibold block">
                          Bestehende Regeln aktualisieren (Update mit neuen Farben &amp; Einstellungen)
                        </strong>
                        <span className="text-[11px] text-slate-600 block">
                          Die vorhandenen Regeln mit gleichem Typ und Pattern werden mit den importierten Werten (Name, Farbe, Container, Symbol) überschrieben.
                        </span>
                      </div>
                    </label>

                    {/* Strategy 2: Keep existing rules */}
                    <label className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                      conflictStrategy === 'keep_existing' 
                        ? 'bg-white border-amber-400 ring-2 ring-amber-300/60 shadow-xs' 
                        : 'bg-white/50 border-amber-200 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="conflict_mode"
                        checked={conflictStrategy === 'keep_existing'}
                        onChange={() => setConflictStrategy('keep_existing')}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="space-y-0.5">
                        <strong className="text-slate-900 font-semibold block">
                          Bestehende Regeln beibehalten (Lassen / Duplikate überspringen)
                        </strong>
                        <span className="text-[11px] text-slate-600 block">
                          Bereits vorhandene Regeln bleiben unverändert. Es werden nur die {analysis.newRules.length} neuen Regeln hinzugefügt.
                        </span>
                      </div>
                    </label>

                    {/* Strategy 3: Replace all */}
                    <label className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                      conflictStrategy === 'replace_all' 
                        ? 'bg-white border-amber-400 ring-2 ring-amber-300/60 shadow-xs' 
                        : 'bg-white/50 border-amber-200 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="conflict_mode"
                        checked={conflictStrategy === 'replace_all'}
                        onChange={() => setConflictStrategy('replace_all')}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="space-y-0.5">
                        <strong className="text-slate-900 font-semibold block">
                          Alle bisherigen Regeln komplett ersetzen
                        </strong>
                        <span className="text-[11px] text-slate-600 block">
                          Löscht alle {currentRuleCount} bisherigen Regeln und übernimmt ausschließlich die {analysis.distinctCount} importierten Regeln.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Collapsible Conflict Detail List */}
                  {showConflictDetails && (
                    <div className="mt-2 pt-2 border-t border-amber-200/80 space-y-1.5 max-h-40 overflow-y-auto">
                      <span className="text-[11px] font-bold text-amber-900 block">Betroffene Duplikate (Typ + Pattern):</span>
                      {analysis.conflictRules.map((c, i) => (
                        <div key={i} className="p-2 rounded bg-white text-[11px] border border-amber-200 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-amber-800 mr-2">[{c.imported.patternType}] {c.imported.pattern}</span>
                            <span className="text-slate-500 text-[10px]">
                              Bisher: "{c.existing.name}" ({c.existing.color}) → Import: "{c.imported.name || c.imported.pattern}"
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-semibold shrink-0">
                            Identisches Pattern
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* If no conflicts, simple merge / replace toggle */}
              {!analysis.hasConflicts && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-800 block text-xs">Aktion bei Import:</span>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="no_conflict_mode"
                        checked={conflictStrategy !== 'replace_all'}
                        onChange={() => setConflictStrategy('keep_existing')}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-slate-700">
                        Zu bestehenden Regeln hinzufügen (+ {analysis.distinctCount} Regeln anfügen)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="no_conflict_mode"
                        checked={conflictStrategy === 'replace_all'}
                        onChange={() => setConflictStrategy('replace_all')}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span className="text-slate-700">
                        Bestehende Regeln ersetzen ({currentRuleCount} vorhandene Regeln überschreiben)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Default Colors Toggle */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyDefaultColors}
                    onChange={(e) => setApplyDefaultColors(e.target.checked)}
                    className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-slate-700 leading-tight">
                    <strong>Standard-Farbschema auf importierte Regeln erzwingen</strong>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Verwendet Standard-Farbe ({defaultColor}), Container-Farbe ({defaultContainerColor}) und Modus ({defaultMode}).
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Abbrechen
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={!analysis || analysis.distinctRulesList.length === 0}
            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 ${
              analysis && analysis.distinctRulesList.length > 0
                ? 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>
              {analysis && analysis.distinctRulesList.length > 0
                ? conflictStrategy === 'update_conflicts' && analysis.hasConflicts
                  ? `${analysis.newRules.length} neu + ${analysis.conflictRules.length} aktualisieren`
                  : conflictStrategy === 'keep_existing' && analysis.hasConflicts
                  ? `${analysis.newRules.length} neue Regeln importieren (${analysis.conflictRules.length} behalten)`
                  : `${analysis.distinctCount} Regeln importieren`
                : 'Regeln importieren'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
