import React, { useState, useMemo } from 'react';
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
  RotateCcw,
  AlertCircle,
  CheckSquare,
  CheckCircle2,
  XCircle,
  X,
  Palette,
  ChevronDown,
  Smile
} from 'lucide-react';
import { TabColorRule, FirefoxContainerColor, FirefoxContainerIcon, ColorMode } from '../types/extension';
import { PRESET_PACKS } from '../utils/presetRules';
import { ImportRulesModal, DuplicateConflictStrategy, getRuleKey } from './ImportRulesModal';
import { BulkEditModal } from './BulkEditModal';
import { FIREFOX_CONTAINER_COLORS, findClosestContainerColor } from '../utils/urlMatcher';

const CONTAINER_ICONS: { id: FirefoxContainerIcon; label: string; icon: string }[] = [
  { id: 'circle', label: 'Circle', icon: '●' },
  { id: 'briefcase', label: 'Briefcase', icon: '💼' },
  { id: 'fingerprint', label: 'Security', icon: '🔒' },
  { id: 'dollar', label: 'Finance', icon: '💰' },
  { id: 'cart', label: 'Shopping', icon: '🛒' },
  { id: 'tree', label: 'Dev / Tree', icon: '🌲' },
  { id: 'chill', label: 'Chill', icon: '☕' },
  { id: 'vacation', label: 'Vacation', icon: '🏖️' },
  { id: 'food', label: 'Food', icon: '🍔' },
  { id: 'fruit', label: 'Fruit', icon: '🍎' },
  { id: 'pet', label: 'Pet', icon: '🐾' },
  { id: 'gift', label: 'Gift', icon: '🎁' },
];

const QUICK_EMOJIS = ['📦', '⚡', '🚀', '🔒', '🌐', '🧪', '🛒', '💼', '🛠️', '🎯', '⭐', '🔥'];

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
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);
  const [isColorSyncOpen, setIsColorSyncOpen] = useState(false);
  const [isIconSyncOpen, setIsIconSyncOpen] = useState(false);
  const [customHexSync, setCustomHexSync] = useState('#37adff');
  const [customEmojiSync, setCustomEmojiSync] = useState('');
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

  // Filter rules by query
  const filteredRules = rules.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.containerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pattern occurrences map to detect duplicated patterns across rules
  const patternOccurrences = useMemo(() => {
    const map = new Map<string, { count: number; firstRuleIndex: number; firstRuleName: string }>();
    rules.forEach((r, idx) => {
      const key = `${r.patternType}::${r.pattern.trim().toLowerCase()}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { count: 1, firstRuleIndex: idx, firstRuleName: r.name });
      } else {
        existing.count += 1;
      }
    });
    return map;
  }, [rules]);

  // Bulk Selection Calculations
  const selectedRulesList = rules.filter((r) => selectedRuleIds.has(r.id));
  const selectedCount = selectedRuleIds.size;
  const selectedActiveCount = selectedRulesList.filter((r) => r.enabled).length;
  const selectedInactiveCount = selectedCount - selectedActiveCount;
  const allFilteredAreSelected =
    filteredRules.length > 0 && filteredRules.every((r) => selectedRuleIds.has(r.id));
  const isIndeterminate =
    filteredRules.some((r) => selectedRuleIds.has(r.id)) && !allFilteredAreSelected;

  // Bulk Selection Handlers
  const handleToggleSelectRule = (id: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setIsConfirmingBulkDelete(false);
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setIsConfirmingBulkDelete(false);
    setIsColorSyncOpen(false);
    setIsIconSyncOpen(false);
    if (allFilteredAreSelected) {
      setSelectedRuleIds((prev) => {
        const next = new Set(prev);
        filteredRules.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRuleIds((prev) => {
        const next = new Set(prev);
        filteredRules.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedRuleIds(new Set());
    setIsConfirmingBulkDelete(false);
    setIsColorSyncOpen(false);
    setIsIconSyncOpen(false);
  };

  const handleBulkSetEnabled = (enabled: boolean) => {
    if (selectedRuleIds.size === 0) return;
    const count = selectedRuleIds.size;
    const updated = rules.map((r) => 
      selectedRuleIds.has(r.id) ? { ...r, enabled } : r
    );
    onUpdateRules(updated);
    setIsConfirmingBulkDelete(false);
    setNotification({
      type: 'success',
      text: `${count} ${count === 1 ? 'Regel wurde' : 'Regeln wurden'} ${enabled ? 'aktiviert' : 'deaktiviert'}.`,
    });
  };

  const handleBulkToggleEnabled = () => {
    if (selectedRuleIds.size === 0) return;
    const count = selectedRuleIds.size;
    const updated = rules.map((r) => 
      selectedRuleIds.has(r.id) ? { ...r, enabled: !r.enabled } : r
    );
    onUpdateRules(updated);
    setIsConfirmingBulkDelete(false);
    setNotification({
      type: 'success',
      text: `Status für ${count} ${count === 1 ? 'Regel' : 'Regeln'} umgekehrt.`,
    });
  };

  const handleBulkSyncColor = (colorHex: string, containerColorName?: FirefoxContainerColor) => {
    if (selectedRuleIds.size === 0) return;
    const cColor = containerColorName || findClosestContainerColor(colorHex);
    const count = selectedRuleIds.size;
    const updated = rules.map((r) =>
      selectedRuleIds.has(r.id)
        ? { ...r, color: colorHex, firefoxContainerColor: cColor }
        : r
    );
    onUpdateRules(updated);
    setIsColorSyncOpen(false);
    const label = FIREFOX_CONTAINER_COLORS[cColor]?.name || colorHex;
    setNotification({
      type: 'success',
      text: `✓ Farbe "${label}" (${colorHex}) auf ${count} ${count === 1 ? 'Regel' : 'Regeln'} synchronisiert.`,
    });
  };

  const handleBulkSyncContainerIcon = (iconId: FirefoxContainerIcon) => {
    if (selectedRuleIds.size === 0) return;
    const count = selectedRuleIds.size;
    const updated = rules.map((r) =>
      selectedRuleIds.has(r.id) ? { ...r, firefoxContainerIcon: iconId } : r
    );
    onUpdateRules(updated);
    setIsIconSyncOpen(false);
    setNotification({
      type: 'success',
      text: `✓ Container-Icon "${iconId}" auf ${count} ${count === 1 ? 'Regel' : 'Regeln'} synchronisiert.`,
    });
  };

  const handleBulkSyncEmoji = (emoji: string) => {
    if (selectedRuleIds.size === 0) return;
    const count = selectedRuleIds.size;
    const clean = emoji.trim();
    const updated = rules.map((r) => {
      if (!selectedRuleIds.has(r.id)) return r;
      let cleanContainer = r.containerName || '';
      if (r.customEmoji && cleanContainer.startsWith(r.customEmoji)) {
        cleanContainer = cleanContainer.slice(r.customEmoji.length).trim();
      }
      return {
        ...r,
        customEmoji: clean,
        containerName: clean ? `${clean} ${cleanContainer}` : cleanContainer,
      };
    });
    onUpdateRules(updated);
    setIsIconSyncOpen(false);
    setCustomEmojiSync('');
    setNotification({
      type: 'success',
      text: clean
        ? `✓ Tab-Symbol "${clean}" auf ${count} ${count === 1 ? 'Regel' : 'Regeln'} synchronisiert.`
        : `Tab-Symbole für ${count} ${count === 1 ? 'Regel' : 'Regeln'} entfernt.`,
    });
  };

  const handleBulkEditApply = (changes: {
    status?: 'enable' | 'disable' | 'toggle';
    color?: string;
    containerColor?: FirefoxContainerColor;
    containerName?: string;
    containerIcon?: FirefoxContainerIcon;
    customEmoji?: string;
    clearEmoji?: boolean;
    colorMode?: 'container' | 'hybrid';
    enableTopBar?: boolean;
  }) => {
    if (selectedRuleIds.size === 0) return;
    const count = selectedRuleIds.size;
    const updated = rules.map((r) => {
      if (!selectedRuleIds.has(r.id)) return r;
      const ruleCopy = { ...r };

      if (changes.status === 'enable') ruleCopy.enabled = true;
      if (changes.status === 'disable') ruleCopy.enabled = false;
      if (changes.status === 'toggle') ruleCopy.enabled = !ruleCopy.enabled;

      if (changes.color) {
        ruleCopy.color = changes.color;
        if (changes.containerColor) ruleCopy.firefoxContainerColor = changes.containerColor;
      }

      if (changes.containerName) {
        ruleCopy.containerName = changes.containerName;
      }

      if (changes.containerIcon) {
        ruleCopy.firefoxContainerIcon = changes.containerIcon;
      }

      if (changes.clearEmoji) {
        let cleanContainer = ruleCopy.containerName || '';
        if (ruleCopy.customEmoji && cleanContainer.startsWith(ruleCopy.customEmoji)) {
          cleanContainer = cleanContainer.slice(ruleCopy.customEmoji.length).trim();
        }
        ruleCopy.customEmoji = '';
        ruleCopy.containerName = cleanContainer;
      } else if (changes.customEmoji) {
        let cleanContainer = ruleCopy.containerName || '';
        if (ruleCopy.customEmoji && cleanContainer.startsWith(ruleCopy.customEmoji)) {
          cleanContainer = cleanContainer.slice(ruleCopy.customEmoji.length).trim();
        }
        ruleCopy.customEmoji = changes.customEmoji;
        ruleCopy.containerName = `${changes.customEmoji} ${cleanContainer}`;
      }

      if (changes.colorMode) {
        ruleCopy.colorMode = changes.colorMode;
      }

      if (changes.enableTopBar !== undefined) {
        ruleCopy.accentBorder = changes.enableTopBar;
      }

      return ruleCopy;
    });

    onUpdateRules(updated);
    setNotification({
      type: 'success',
      text: `✓ Massenbearbeitung erfolgreich auf ${count} ${count === 1 ? 'Regel' : 'Regeln'} angewendet!`,
    });
  };

  const handleExecuteBulkDelete = () => {
    if (selectedRuleIds.size === 0) return;
    const count = selectedRuleIds.size;
    const remaining = rules.filter((r) => !selectedRuleIds.has(r.id));
    remaining.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    onUpdateRules(remaining);
    setSelectedRuleIds(new Set());
    setIsConfirmingBulkDelete(false);
    setNotification({
      type: 'info',
      text: `${count} ${count === 1 ? 'Regel' : 'Regeln'} gelöscht.`,
    });
  };

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
    const label = target?.name || target?.pattern || 'Regel';
    const newRules = rules.filter((r) => r.id !== id);
    newRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    onUpdateRules(newRules);
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setNotification({
      type: 'info',
      text: `Regel "${label}" wurde entfernt.`,
    });
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
    setNotification({
      type: 'info',
      text: 'Tab-Symbol wurde aus der Regel entfernt.',
    });
  };

  const handleDuplicateRule = (rule: TabColorRule) => {
    const duplicated: TabColorRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      name: `${rule.name} (Kopie)`,
      priority: rules.length + 1,
    };
    onUpdateRules([...rules, duplicated]);
    // Sofort das Regel-Bearbeitungsfenster öffnen, damit das Pattern angepasst werden kann
    onEditRule(duplicated);
    setNotification({
      type: 'info',
      text: `Regel "${rule.name}" als Kopie angelegt und geöffnet. Bitte passe das URL-Pattern an, da die weiter oben stehende Originalregel Vorrang hat.`,
    });
  };

  const handleLoadPreset = (packId: string) => {
    const pack = PRESET_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    onUpdateRules(pack.rules);
    setSelectedRuleIds(new Set());
    setIsConfirmingBulkDelete(false);
    setNotification({
      type: 'success',
      text: `Preset-Pack "${pack.name}" mit ${pack.rules.length} Beispiel-Regeln geladen!`,
    });
  };

  const handleExportJson = (onlySelected = false) => {
    const rulesToExport = onlySelected && selectedCount > 0
      ? rules.filter((r) => selectedRuleIds.has(r.id))
      : rules;

    const count = rulesToExport.length;
    const isSelectedSubset = onlySelected && selectedCount > 0;
    const filename = isSelectedSubset
      ? `tabchroma-rules-selected-${count}.json`
      : 'tabchroma-rules.json';

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rulesToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setNotification({
      type: 'success',
      text: isSelectedSubset
        ? `✓ ${count} ausgewählte ${count === 1 ? 'Regel wurde' : 'Regeln wurden'} als "${filename}" exportiert.`
        : `${count} Regeln als "${filename}" exportiert.`,
    });
  };

  const handleImportRules = (
    importedRules: TabColorRule[],
    strategy: DuplicateConflictStrategy,
    stats: { newCount: number; updatedCount: number; skippedCount: number; totalImported: number }
  ) => {
    let finalRules: TabColorRule[] = [];

    if (strategy === 'replace_all') {
      finalRules = importedRules.map((r, idx) => ({ ...r, priority: idx + 1 }));
      setNotification({
        type: 'success',
        text: `✓ ${finalRules.length} Regeln erfolgreich importiert (vorherige Regeln ersetzt).`,
      });
    } else {
      // Distinct merge based on (patternType, pattern)
      const resultList: TabColorRule[] = [...rules];

      importedRules.forEach((imp) => {
        const key = getRuleKey(imp.patternType, imp.pattern);
        const existingIdx = resultList.findIndex(
          (r) => getRuleKey(r.patternType, r.pattern) === key
        );

        if (existingIdx >= 0) {
          if (strategy === 'update_conflicts') {
            // Update existing rule: preserve original rule ID and priority, update configuration
            resultList[existingIdx] = {
              ...imp,
              id: resultList[existingIdx].id,
              priority: resultList[existingIdx].priority,
            };
          }
          // If 'keep_existing', keep existing rule without changes
        } else {
          // New rule: append to list
          resultList.push(imp);
        }
      });

      finalRules = resultList.map((r, idx) => ({ ...r, priority: idx + 1 }));

      if (strategy === 'update_conflicts') {
        setNotification({
          type: 'success',
          text: `✓ Import abgeschlossen: ${stats.newCount} neue Regeln hinzugefügt, ${stats.updatedCount} bestehende Regeln aktualisiert (gesamt: ${finalRules.length} Regeln).`,
        });
      } else {
        setNotification({
          type: 'success',
          text: `✓ Import abgeschlossen: ${stats.newCount} neue Regeln hinzugefügt, ${stats.skippedCount} bestehende Regeln beibehalten (gesamt: ${finalRules.length} Regeln).`,
        });
      }
    }

    onUpdateRules(finalRules);
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
          {onResetToDummyDefaults && (
            <button
              onClick={onResetToDummyDefaults}
              title="Setzt alle Regeln auf die sauberen Standard-Dummy-Regeln zurück"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
              <span>Dummy-Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
            title="Öffnet das Import-Fenster für JSON-Dateien oder direkte Texteingabe"
          >
            <Upload className="w-3.5 h-3.5 text-sky-600" />
            <span>Import JSON</span>
          </button>

          {selectedCount > 0 ? (
            <div className="flex items-center rounded-lg border border-sky-300 bg-sky-50 shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => handleExportJson(true)}
                title={`Nur die ${selectedCount} ausgewählten Regeln als JSON exportieren`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>Export ({selectedCount} ausgewählt)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportJson(false)}
                title={`Alle ${rules.length} Regeln als JSON exportieren`}
                className="px-2 py-1.5 text-[11px] font-medium text-sky-700 hover:text-sky-950 hover:bg-sky-100 border-l border-sky-200 transition-colors cursor-pointer"
              >
                Alle ({rules.length})
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleExportJson(false)}
              title="Alle Regeln als JSON exportieren"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          )}

          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add URL Rule</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
            )}
            <span className="font-medium">{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Bulk Action Toolbar */}
      {selectedCount > 0 && (
        <div className="bg-slate-900 text-white rounded-xl p-3 px-4 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center min-w-6 h-6 px-1.5 rounded-md bg-sky-500 text-white font-mono text-xs font-bold shadow-xs">
                {selectedCount}
              </span>
              <span className="text-xs font-semibold text-slate-100">
                {selectedCount === 1 ? 'Regel ausgewählt' : 'Regeln ausgewählt'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 border-l border-slate-700 pl-3">
              <span className="text-emerald-400 font-medium">{selectedActiveCount} aktiv</span>
              <span>·</span>
              <span className="text-slate-400 font-medium">{selectedInactiveCount} inaktiv</span>
            </div>

            {selectedCount < filteredRules.length && (
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2 cursor-pointer"
              >
                Alle {filteredRules.length} auswählen
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status toggle & set actions */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => handleBulkSetEnabled(true)}
                title="Alle ausgewählten Regeln aktivieren (Enabled: true)"
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:text-white hover:bg-emerald-600/30 rounded-md transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Aktivieren</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkSetEnabled(false)}
                title="Alle ausgewählten Regeln deaktivieren (Enabled: false)"
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Deaktivieren</span>
              </button>

              <button
                type="button"
                onClick={handleBulkToggleEnabled}
                title="Status umkehren (aktiv ↔ inaktiv)"
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-sky-300 hover:text-white hover:bg-sky-600/30 rounded-md transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-sky-400" />
                <span>Status umschalten</span>
              </button>
            </div>

            {/* Massenbearbeitung Modal Button */}
            <button
              type="button"
              onClick={() => {
                setIsBulkEditModalOpen(true);
                setIsColorSyncOpen(false);
                setIsIconSyncOpen(false);
                setIsConfirmingBulkDelete(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title={`Ausgewählte ${selectedCount} Regeln im Massenbearbeitungs-Dialog anpassen`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Massenbearbeitung</span>
            </button>

            {/* Bulk Color & Icon Sync Group */}
            <div className="flex items-center gap-1.5">
              {/* Farb-Sync Dropdown Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsColorSyncOpen((prev) => !prev);
                    setIsIconSyncOpen(false);
                    setIsConfirmingBulkDelete(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer shadow-2xs ${
                    isColorSyncOpen
                      ? 'bg-amber-500 text-slate-950 font-semibold border-amber-400'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:text-white hover:bg-slate-700'
                  }`}
                  title={`Farbe auf alle ${selectedCount} ausgewählten Regeln übertragen`}
                >
                  <Palette className={`w-3.5 h-3.5 ${isColorSyncOpen ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>Farb-Sync</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isColorSyncOpen ? 'rotate-180 text-slate-950' : 'text-slate-400'}`} />
                </button>

                {isColorSyncOpen && (
                  <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl p-3.5 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-100 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                        <Palette className="w-3.5 h-3.5 text-amber-400" />
                        <span>Farb-Sync ({selectedCount} {selectedCount === 1 ? 'Regel' : 'Regeln'})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsColorSyncOpen(false)}
                        className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Firefox Container Colors Grid */}
                    <div>
                      <span className="block text-[11px] font-medium text-slate-400 mb-2">
                        Firefox Container-Farbe wählen:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(Object.keys(FIREFOX_CONTAINER_COLORS) as FirefoxContainerColor[]).map((cKey) => {
                          const item = FIREFOX_CONTAINER_COLORS[cKey];
                          return (
                            <button
                              key={cKey}
                              type="button"
                              onClick={() => handleBulkSyncColor(item.hex, cKey)}
                              className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-750 hover:border-slate-600 transition-colors text-left cursor-pointer group"
                            >
                              <div
                                className="w-4 h-4 rounded-full shrink-0 shadow-xs border border-white/20 group-hover:scale-110 transition-transform"
                                style={{ backgroundColor: item.hex }}
                              />
                              <span className="text-xs text-slate-200 capitalize font-medium">
                                {item.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Hex Color Option */}
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <span className="block text-[11px] font-medium text-slate-400">
                        Oder eigener Hex-Farbcode:
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customHexSync}
                          onChange={(e) => setCustomHexSync(e.target.value)}
                          className="w-8 h-8 rounded border border-slate-700 bg-slate-800 p-0.5 cursor-pointer shrink-0"
                          title="Farbwähler öffnen"
                        />
                        <input
                          type="text"
                          value={customHexSync}
                          onChange={(e) => setCustomHexSync(e.target.value)}
                          placeholder="#37adff"
                          className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleBulkSyncColor(customHexSync)}
                          className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-lg transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                        >
                          Anwenden
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Icon-Sync Dropdown Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsIconSyncOpen((prev) => !prev);
                    setIsColorSyncOpen(false);
                    setIsConfirmingBulkDelete(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer shadow-2xs ${
                    isIconSyncOpen
                      ? 'bg-sky-500 text-white font-semibold border-sky-400'
                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:text-white hover:bg-slate-700'
                  }`}
                  title={`Container-Icon oder Tab-Symbol auf alle ${selectedCount} ausgewählten Regeln übertragen`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isIconSyncOpen ? 'text-white' : 'text-sky-400'}`} />
                  <span>Icon-Sync</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isIconSyncOpen ? 'rotate-180 text-white' : 'text-slate-400'}`} />
                </button>

                {isIconSyncOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl p-3.5 shadow-2xl z-30 animate-in fade-in zoom-in-95 duration-100 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <span>Icon-Sync ({selectedCount} {selectedCount === 1 ? 'Regel' : 'Regeln'})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsIconSyncOpen(false)}
                        className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Firefox Container Icons Grid */}
                    <div>
                      <span className="block text-[11px] font-medium text-slate-400 mb-2">
                        Firefox Container-Icon zuweisen:
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {CONTAINER_ICONS.map((iconItem) => (
                          <button
                            key={iconItem.id}
                            type="button"
                            onClick={() => handleBulkSyncContainerIcon(iconItem.id)}
                            className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-750 hover:border-sky-500/50 transition-colors cursor-pointer group text-center"
                            title={`${iconItem.label} als Container-Icon synchronisieren`}
                          >
                            <span className="text-base mb-0.5 group-hover:scale-110 transition-transform">
                              {iconItem.icon}
                            </span>
                            <span className="text-[10px] text-slate-300 font-medium truncate w-full">
                              {iconItem.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tab Symbol / Emoji Sync */}
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-400">
                          Tab-Symbol / Emoji synchronisieren:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleBulkSyncEmoji('')}
                          className="text-[10px] text-rose-400 hover:text-rose-300 underline underline-offset-2 cursor-pointer"
                          title="Tab-Symbole von allen ausgewählten Regeln entfernen"
                        >
                          Symbole entfernen
                        </button>
                      </div>

                      {/* Quick Emojis Grid */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleBulkSyncEmoji(emoji)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 hover:border-amber-400/60 border border-slate-750 text-sm transition-transform hover:scale-110 cursor-pointer"
                            title={`Symbol "${emoji}" auf alle ausgewählten Regeln anwenden`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Custom Emoji Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={customEmojiSync}
                          onChange={(e) => setCustomEmojiSync(e.target.value)}
                          placeholder="z. B. 🛡️ oder [API]"
                          maxLength={10}
                          className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="button"
                          disabled={!customEmojiSync.trim()}
                          onClick={() => handleBulkSyncEmoji(customEmojiSync)}
                          className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-medium text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
                        >
                          Zuweisen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bulk Export Selected Rules */}
            <button
              type="button"
              onClick={() => handleExportJson(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-200 bg-sky-950/60 hover:bg-sky-900/80 border border-sky-800/80 hover:border-sky-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title={`Nur die ${selectedCount} ausgewählten Regeln als JSON exportieren`}
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export ({selectedCount})</span>
            </button>

            {/* Bulk Delete with inline confirmation */}
            {isConfirmingBulkDelete ? (
              <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-600 rounded-lg p-1 animate-in fade-in duration-100">
                <span className="text-[11px] text-rose-200 px-1 font-medium">
                  {selectedCount} wirklich löschen?
                </span>
                <button
                  type="button"
                  onClick={handleExecuteBulkDelete}
                  className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded transition-colors shadow-xs cursor-pointer"
                >
                  Ja, löschen
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingBulkDelete(false)}
                  className="px-2 py-1 text-xs text-slate-300 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingBulkDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 hover:border-rose-700 rounded-lg transition-colors cursor-pointer"
                title={`${selectedCount} ausgewählte ${selectedCount === 1 ? 'Regel' : 'Regeln'} löschen`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Löschen ({selectedCount})</span>
              </button>
            )}

            {/* Clear Selection */}
            <button
              type="button"
              onClick={() => {
                handleClearSelection();
                setIsConfirmingBulkDelete(false);
              }}
              title="Auswahl aufheben"
              className="flex items-center gap-1 p-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredAreSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = isIndeterminate;
                      }
                    }}
                    onChange={handleSelectAllVisible}
                    aria-label="Alle sichtbaren Regeln auswählen oder abwählen"
                    title={
                      allFilteredAreSelected
                        ? 'Alle sichtbaren Regeln abwählen'
                        : 'Alle sichtbaren Regeln auswählen'
                    }
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 focus:ring-offset-0 cursor-pointer transition-colors"
                  />
                </th>
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
                  const isSelected = selectedRuleIds.has(rule.id);
                  const pKey = `${rule.patternType}::${rule.pattern.trim().toLowerCase()}`;
                  const pCollision = patternOccurrences.get(pKey);
                  const isOverriddenByEarlierRule = !!(pCollision && pCollision.count > 1 && pCollision.firstRuleIndex < originalIndex);
                  const isFirstOfDuplicates = !!(pCollision && pCollision.count > 1 && pCollision.firstRuleIndex === originalIndex);

                  return (
                    <tr
                      key={rule.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected
                          ? 'bg-sky-50/80 hover:bg-sky-100/60'
                          : !rule.enabled
                          ? 'opacity-50 bg-slate-50/30'
                          : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectRule(rule.id, e)}
                          aria-label={`Regel ${rule.name} auswählen`}
                          className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 focus:ring-offset-0 cursor-pointer transition-colors"
                        />
                      </td>

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
                        className="py-2.5 px-3 font-mono text-[11px] text-sky-800 max-w-sm cursor-pointer hover:text-sky-900"
                        title="Click to edit pattern"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <code className="bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 hover:bg-sky-100 transition-colors">
                            {rule.pattern}
                          </code>
                          {isOverriddenByEarlierRule && pCollision && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-300 font-sans font-medium"
                              title={`Hinweis: Regel #${pCollision.firstRuleIndex + 1} ("${pCollision.firstRuleName}") hat exakt dasselbe Pattern und steht weiter oben in der Liste. Da Firefox Regeln von oben nach unten abgleicht, matcht die obere Regel immer zuerst. Klicke hier, um das Pattern anzupassen.`}
                            >
                              <span>⚠️ Doppelt (Regel #{pCollision.firstRuleIndex + 1} hat Vorrang)</span>
                            </span>
                          )}
                          {isFirstOfDuplicates && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-800 border border-sky-200 font-sans font-medium"
                              title="Dieses Pattern ist mehrfach vorhanden. Da diese Regel höher in der Liste steht, greift sie vor nachfolgenden Duplikaten."
                            >
                              <span>(Hat Vorrang)</span>
                            </span>
                          )}
                        </div>
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
                  <td colSpan={9} className="py-12 text-center text-slate-500">
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

      {/* Modal for importing rules */}
      <ImportRulesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportRules}
        defaultColor={defaultColor}
        defaultContainerColor={defaultContainerColor}
        defaultMode={defaultMode}
        currentRuleCount={rules.length}
        existingRules={rules}
      />

      {/* Modal for bulk editing rules */}
      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedCount={selectedCount}
        onApply={handleBulkEditApply}
      />
    </div>
  );
};
