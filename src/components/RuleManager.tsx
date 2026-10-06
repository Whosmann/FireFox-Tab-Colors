import React, { useState } from 'react';
import { 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  Edit3, 
  Trash2, 
  Copy, 
  Download, 
  Upload, 
  Sparkles,
  Search,
  Check,
  RotateCcw
} from 'lucide-react';
import { TabColorRule, FirefoxContainerColor, ColorMode } from '../types/extension';
import { PRESET_PACKS } from '../utils/presetRules';

interface RuleManagerProps {
  rules: TabColorRule[];
  onUpdateRules: (rules: TabColorRule[]) => void;
  onOpenCreateModal: () => void;
  onEditRule: (rule: TabColorRule) => void;
  defaultColor?: string;
  defaultContainerColor?: FirefoxContainerColor;
  defaultMode?: ColorMode;
  onResetToDummyDefaults?: () => void;
}

export const RuleManager: React.FC<RuleManagerProps> = ({
  rules,
  onUpdateRules,
  onOpenCreateModal,
  onEditRule,
  defaultColor = '#37adff',
  defaultContainerColor = 'blue',
  defaultMode = 'container',
  onResetToDummyDefaults,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter rules by query
  const filteredRules = rules.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.containerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleEnabled = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    onUpdateRules(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newRules = [...rules];
    const temp = newRules[index];
    newRules[index] = newRules[index - 1];
    newRules[index - 1] = temp;
    // Re-index priority
    newRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    onUpdateRules(newRules);
  };

  const handleMoveDown = (index: number) => {
    if (index === rules.length - 1) return;
    const newRules = [...rules];
    const temp = newRules[index];
    newRules[index] = newRules[index + 1];
    newRules[index + 1] = temp;
    // Re-index priority
    newRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    onUpdateRules(newRules);
  };

  const handleDeleteRule = (id: string) => {
    const target = rules.find((r) => r.id === id);
    const label = target?.name || target?.pattern || 'diese Regel';
    if (confirm(`Regel "${label}" wirklich entfernen?`)) {
      const newRules = rules.filter((r) => r.id !== id);
      newRules.forEach((r, idx) => {
        r.priority = idx + 1;
      });
      onUpdateRules(newRules);
    }
  };

  const handleRemoveRuleEmoji = (id: string) => {
    const updated = rules.map((r) => {
      if (r.id !== id) return r;
      let cleanContainer = r.containerName || '';
      if (r.customEmoji && cleanContainer.startsWith(r.customEmoji)) {
        cleanContainer = cleanContainer.slice(r.customEmoji.length).trim();
      }
      return {
        ...r,
        customEmoji: '',
        containerName: cleanContainer || r.name,
      };
    });
    onUpdateRules(updated);
  };

  const handleDuplicateRule = (rule: TabColorRule) => {
    const duplicated: TabColorRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      name: `${rule.name} (Copy)`,
      priority: rules.length + 1,
    };
    onUpdateRules([...rules, duplicated]);
  };

  const handleLoadPreset = (packId: string) => {
    const pack = PRESET_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    if (confirm(`Preset-Pack "${pack.name}" laden? Dies ersetzt die aktuellen Regeln durch ${pack.rules.length} Beispiel-Regeln.`)) {
      onUpdateRules(pack.rules);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rules, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'tabchroma-rules.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        let rawRules: any[] = [];
        if (Array.isArray(parsed)) {
          rawRules = parsed;
        } else if (parsed && Array.isArray(parsed.rules)) {
          rawRules = parsed.rules;
        } else {
          alert('Ungültige Struktur: Datei enthält keine Regeln.');
          return;
        }

        // Strictly filter out any rule referencing azure (im default darf kein azure auftauchen)
        const sanitized = rawRules.filter((r) => {
          const name = String(r.name || '').toLowerCase();
          const pattern = String(r.pattern || '').toLowerCase();
          const container = String(r.containerName || '').toLowerCase();
          return !name.includes('azure') && !pattern.includes('azure') && !container.includes('azure');
        });

        // Prompt user: Apply standard default color scheme to imported rules?
        const applyDefaults = confirm(
          `Möchten Sie das konfigurierte Standard-Farbschema (Farbe: ${defaultColor}, Container: ${defaultContainerColor}, Modus: ${defaultMode}) als Default auf alle ${sanitized.length} importierten Regeln anwenden?\n\n[OK] = Standard-Farbschema auf alle Regeln anwenden\n[Abbrechen] = Farben aus der Datei beibehalten (und nur fehlende Werte mit Default auffüllen)`
        );

        const processed: TabColorRule[] = sanitized.map((r, idx) => ({
          id: r.id || `rule-${Date.now()}-${idx}`,
          name: r.name || `Importierte Regel ${idx + 1}`,
          patternType: r.patternType || 'domain',
          pattern: r.pattern || '',
          color: applyDefaults ? defaultColor : (r.color || defaultColor),
          firefoxContainerColor: applyDefaults ? defaultContainerColor : (r.firefoxContainerColor || defaultContainerColor),
          firefoxContainerIcon: r.firefoxContainerIcon || 'circle',
          customEmoji: r.customEmoji || '',
          enableTitleEmoji: r.enableTitleEmoji ?? true,
          enableFaviconEmoji: r.enableFaviconEmoji ?? true,
          containerName: r.containerName || r.name || 'Container',
          colorMode: applyDefaults ? defaultMode : (r.colorMode || defaultMode),
          accentBorder: r.accentBorder ?? true,
          enabled: r.enabled ?? true,
          priority: idx + 1,
        }));

        onUpdateRules(processed);
        alert(`${processed.length} Regeln erfolgreich importiert!`);
      } catch (err) {
        alert('Fehler beim Einlesen der JSON-Datei.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Top action toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span>URL Color Rules</span>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              ({rules.length} {rules.length === 1 ? 'rule' : 'rules'})
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rules are evaluated from top to bottom. Click the <strong>Edit</strong> button or click on any rule name to modify its URL pattern, color, or container.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset pack dropdown */}
          <div className="relative inline-block text-xs">
            <button
              onClick={() => {
                const nextId = prompt(
                  'Wählen Sie ein Dummy-Preset zum Laden:\n1 = Standard Dummy Rules (Beispiel-Regeln)\n2 = Farbcodierte Muster (Farben-Demo)'
                );
                if (nextId === '1') handleLoadPreset('dummy-standard');
                if (nextId === '2') handleLoadPreset('dummy-colors');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Dummy-Presets</span>
            </button>
          </div>

          {onResetToDummyDefaults && (
            <button
              onClick={onResetToDummyDefaults}
              title="Setzt alle Regeln auf die sauberen Standard-Dummy-Regeln zurück (ohne Cloud/Azure)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
              <span>Dummy-Reset</span>
            </button>
          )}

          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer" title="Importiert Regeln und bietet an, das Standard-Farbschema als Default zu verwenden">
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add URL Rule</span>
          </button>
        </div>
      </div>

      {/* Search and Preset Quick Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rules by name, pattern, or container..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="text-slate-400">Presets:</span>
          {PRESET_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => handleLoadPreset(pack.id)}
              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors text-xs whitespace-nowrap"
            >
              {pack.name}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3 w-12 text-center">Priority</th>
                <th className="py-3 px-3">Tab Color</th>
                <th className="py-3 px-3">Rule Name</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">URL Pattern</th>
                <th className="py-3 px-3">Firefox Container</th>
                <th className="py-3 px-3 w-20 text-center">Active</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRules.length > 0 ? (
                filteredRules.map((rule, idx) => {
                  const originalIndex = rules.findIndex((r) => r.id === rule.id);
                  return (
                    <tr
                      key={rule.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !rule.enabled ? 'opacity-50 bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Priority Ordering */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="font-mono text-slate-400 text-xs tabular-nums mr-1">
                            {originalIndex + 1}
                          </span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => handleMoveUp(originalIndex)}
                              disabled={originalIndex === 0}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-0.5"
                              title="Move up in priority"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveDown(originalIndex)}
                              disabled={originalIndex === rules.length - 1}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-0.5"
                              title="Move down in priority"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Tab Color Swatch */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full shadow-xs shrink-0"
                            style={{ backgroundColor: rule.color }}
                            title={`Hex: ${rule.color}`}
                          />
                          <span className="font-medium text-slate-800 capitalize">
                            {rule.firefoxContainerColor}
                          </span>
                        </div>
                      </td>

                      {/* Rule Name (Clickable to edit) */}
                      <td
                        onClick={() => onEditRule(rule)}
                        className="py-2.5 px-3 font-semibold text-slate-900 cursor-pointer hover:text-sky-600 transition-colors"
                        title="Click to edit this rule"
                      >
                        <div className="flex items-center gap-1.5 group">
                          {rule.customEmoji && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold border border-amber-300 text-xs shrink-0 shadow-2xs"
                              title={`Angehängtes Tab-Symbol: ${rule.customEmoji} (Klicken zum Entfernen)`}
                            >
                              <span>{rule.customEmoji}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveRuleEmoji(rule.id);
                                }}
                                className="text-amber-600 hover:text-rose-700 hover:bg-rose-100 rounded px-1 transition-colors text-[10px] font-bold"
                                title="Dieses Symbol aus der Regel entfernen"
                              >
                                ✕
                              </button>
                            </span>
                          )}
                          <span>{rule.name}</span>
                          <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-sky-500 transition-opacity" />
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono capitalize bg-slate-100 text-slate-700 border border-slate-200">
                          {rule.patternType}
                        </span>
                      </td>

                      {/* URL Pattern */}
                      <td
                        onClick={() => onEditRule(rule)}
                        className="py-2.5 px-3 font-mono text-[11px] text-sky-800 max-w-xs truncate cursor-pointer hover:text-sky-900"
                        title="Click to edit pattern"
                      >
                        <code className="bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 hover:bg-sky-100 transition-colors">
                          {rule.pattern}
                        </code>
                      </td>

                      {/* Container Info */}
                      <td className="py-2.5 px-3 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {rule.customEmoji && (
                            <span className="font-bold text-amber-600 text-xs shrink-0" title={`Angehängt: ${rule.customEmoji}`}>
                              {rule.customEmoji}
                            </span>
                          )}
                          <span className="text-xs font-medium">{rule.containerName}</span>
                          <span className="text-[10px] text-slate-400">({rule.firefoxContainerIcon})</span>
                        </div>
                      </td>

                      {/* Enabled Toggle */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleEnabled(rule.id)}
                          className={`w-8 h-4 rounded-full transition-colors relative inline-flex items-center ${
                            rule.enabled ? 'bg-sky-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`w-3 h-3 rounded-full bg-white transition-transform ${
                              rule.enabled ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Actions: Prominent Edit button */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditRule(rule)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold text-xs border border-sky-200 transition-colors shadow-2xs"
                            title="Edit rule"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDuplicateRule(rule)}
                            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Duplicate rule"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="text-2xl">📋</div>
                      <div className="font-semibold text-slate-800">No matching rules found</div>
                      <p className="text-xs text-slate-500">
                        {searchQuery
                          ? 'Try clearing your search query or create a new rule.'
                          : 'Get started by creating your first URL color rule or loading a preset pack.'}
                      </p>
                      <button
                        onClick={onOpenCreateModal}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Rule</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
