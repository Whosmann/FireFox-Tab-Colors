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
  Check
} from 'lucide-react';
import { TabColorRule } from '../types/extension';
import { PRESET_PACKS } from '../utils/presetRules';

interface RuleManagerProps {
  rules: TabColorRule[];
  onUpdateRules: (rules: TabColorRule[]) => void;
  onOpenCreateModal: () => void;
  onEditRule: (rule: TabColorRule) => void;
}

export const RuleManager: React.FC<RuleManagerProps> = ({
  rules,
  onUpdateRules,
  onOpenCreateModal,
  onEditRule,
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
    const newRules = rules.filter((r) => r.id !== id);
    newRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    onUpdateRules(newRules);
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
    if (confirm(`Load the "${pack.name}" preset pack? This will add ${pack.rules.length} pre-configured rules.`)) {
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
        if (Array.isArray(parsed)) {
          onUpdateRules(parsed);
          alert(`Successfully imported ${parsed.length} rules!`);
        } else if (parsed.rules && Array.isArray(parsed.rules)) {
          onUpdateRules(parsed.rules);
          alert(`Successfully imported ${parsed.rules.length} rules!`);
        } else {
          alert('Invalid rules file structure.');
        }
      } catch (err) {
        alert('Could not parse JSON file.');
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
            Rules are evaluated from top to bottom. The first rule matching the browser URL determines the tab color.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset pack dropdown */}
          <div className="relative inline-block text-xs">
            <button
              onClick={() => {
                const nextId = prompt(
                  'Select Preset to load:\n1 = DevOps & Environments\n2 = Work vs Personal\n3 = Multi-Cloud Consoles'
                );
                if (nextId === '1') handleLoadPreset('devops-environments');
                if (nextId === '2') handleLoadPreset('work-life-balance');
                if (nextId === '3') handleLoadPreset('cloud-infrastructure');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Load Preset Pack</span>
            </button>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
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

                      {/* Rule Name */}
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {rule.name}
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono capitalize bg-slate-100 text-slate-700 border border-slate-200">
                          {rule.patternType}
                        </span>
                      </td>

                      {/* URL Pattern */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-sky-800 max-w-xs truncate" title={rule.pattern}>
                        <code className="bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                          {rule.pattern}
                        </code>
                      </td>

                      {/* Container Info */}
                      <td className="py-2.5 px-3 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{rule.containerName}</span>
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

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEditRule(rule)}
                            className="p-1 rounded text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                            title="Edit rule"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
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
