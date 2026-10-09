import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  ChevronsUp,
  ChevronsDown,
  GripVertical,
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
import { PRESET_PACKS, PresetPack } from '../utils/presetRules';
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
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [isPresetPacksModalOpen, setIsPresetPacksModalOpen] = useState(false);
  const [selectedPresetPackId, setSelectedPresetPackId] = useState<string>(PRESET_PACKS[0]?.id || 'workflow-development');
  const [selectedPresetRuleIds, setSelectedPresetRuleIds] = useState<Set<string>>(() => {
    const firstPack = PRESET_PACKS[0];
    return new Set(firstPack ? firstPack.rules.map((r) => r.id) : []);
  });
  const [presetRuleSearchQuery, setPresetRuleSearchQuery] = useState('');

  // Filter rules by query and selection filter
  const filteredRules = rules.filter((r) => {
    if (showOnlySelected && !selectedRuleIds.has(r.id)) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.pattern.toLowerCase().includes(q) ||
      r.containerName.toLowerCase().includes(q) ||
      r.firefoxContainerColor.toLowerCase().includes(q)
    );
  });

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
  const visibleSelectedCount = filteredRules.filter((r) => selectedRuleIds.has(r.id)).length;
  const hiddenSelectedCount = selectedCount - visibleSelectedCount;
  const unselectedFilteredCount = filteredRules.length - visibleSelectedCount;
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
      // Deselect only the currently visible rules
      setSelectedRuleIds((prev) => {
        const next = new Set(prev);
        filteredRules.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      // Add all visible rules to selection without wiping previous selections from other searches!
      setSelectedRuleIds((prev) => {
        const next = new Set(prev);
        filteredRules.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const handleAddFilteredToSelection = () => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      filteredRules.forEach((r) => next.add(r.id));
      return next;
    });
    setNotification({
      type: 'success',
      text: `✓ ${unselectedFilteredCount} Treffer zur bestehenden Auswahl hinzugefügt (gesamt: ${selectedCount + unselectedFilteredCount} ausgewählt).`,
    });
  };

  const handleSelectOnlyFiltered = () => {
    setSelectedRuleIds(new Set(filteredRules.map((r) => r.id)));
  };

  const handleRestrictToFiltered = () => {
    setSelectedRuleIds(new Set(filteredRules.map((r) => r.id)));
  };

  const handleToggleShowOnlySelected = () => {
    if (!showOnlySelected && selectedCount === 0) {
      setNotification({
        type: 'info',
        text: 'Es sind aktuell keine Regeln ausgewählt. Markieren Sie zuerst einige Regeln über die Suche oder Checkboxen.',
      });
      return;
    }
    setShowOnlySelected((prev) => !prev);
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

  const handleMoveToTop = (index: number) => {
    if (index === 0) return;
    const newRules = [...rules];
    const [moved] = newRules.splice(index, 1);
    newRules.unshift(moved);
    newRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    onUpdateRules(newRules);
  };

  const handleMoveToBottom = (index: number) => {
    if (index === rules.length - 1) return;
    const newRules = [...rules];
    const [moved] = newRules.splice(index, 1);
    newRules.push(moved);
    newRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    onUpdateRules(newRules);
  };

  const handleMoveToPosition = (fromIndex: number, targetPriority: number) => {
    if (isNaN(targetPriority) || fromIndex < 0 || fromIndex >= rules.length) return;
    const clamped = Math.max(1, Math.min(targetPriority, rules.length));
    const targetIndex = clamped - 1;
    if (fromIndex === targetIndex) return;

    const newRules = [...rules];
    const [moved] = newRules.splice(fromIndex, 1);
    newRules.splice(targetIndex, 0, moved);
    newRules.forEach((r, idx) => {
      r.priority = idx + 1;
    });
    onUpdateRules(newRules);
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [priorityInputMap, setPriorityInputMap] = useState<{ [ruleId: string]: string }>({});

  const handlePriorityInputChange = (ruleId: string, val: string) => {
    setPriorityInputMap((prev) => ({ ...prev, [ruleId]: val }));
  };

  const handlePriorityInputCommit = (ruleId: string, fromIndex: number) => {
    const rawVal = priorityInputMap[ruleId];
    if (rawVal !== undefined && rawVal.trim() !== '') {
      const parsed = parseInt(rawVal.trim(), 10);
      if (!isNaN(parsed)) {
        handleMoveToPosition(fromIndex, parsed);
      }
    }
    setPriorityInputMap((prev) => {
      const next = { ...prev };
      delete next[ruleId];
      return next;
    });
  };

  const handleDragStart = (index: number, e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      handleMoveToPosition(draggedIndex, targetIndex + 1);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
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

  const handleApplyPresetPack = (pack: PresetPack, mode: 'append' | 'replace', onlySelected = true) => {
    const rulesToApply = onlySelected
      ? pack.rules.filter((r) => selectedPresetRuleIds.has(r.id))
      : pack.rules;

    if (rulesToApply.length === 0) {
      setNotification({
        type: 'error',
        text: 'Bitte wähle mindestens eine Regel aus dem Pack aus.',
      });
      return;
    }

    if (mode === 'replace') {
      const updated = rulesToApply.map((r, idx) => ({
        ...r,
        id: `rule-${Date.now()}-${idx}`,
        priority: idx + 1,
      }));
      onUpdateRules(updated);
      setSelectedRuleIds(new Set());
      setIsConfirmingBulkDelete(false);
      setIsPresetPacksModalOpen(false);
      setNotification({
        type: 'success',
        text: `✓ ${updated.length} ausgewählte Regeln aus "${pack.name}" geladen (vorherige Regeln ersetzt).`,
      });
    } else {
      // Append / Merge: Avoid duplicate patterns
      const existingKeys = new Set(rules.map((r) => `${r.patternType}::${r.pattern.trim().toLowerCase()}`));
      let addedCount = 0;
      const toAdd: TabColorRule[] = [];

      rulesToApply.forEach((r, idx) => {
        const key = `${r.patternType}::${r.pattern.trim().toLowerCase()}`;
        if (!existingKeys.has(key)) {
          toAdd.push({
            ...r,
            id: `rule-${Date.now()}-${idx}`,
            priority: rules.length + toAdd.length + 1,
          });
          existingKeys.add(key);
          addedCount++;
        }
      });

      if (addedCount === 0) {
        setNotification({
          type: 'info',
          text: `Alle ${rulesToApply.length} ausgewählten Regeln aus "${pack.name}" sind bereits in deiner Liste vorhanden.`,
        });
      } else {
        const merged = [...rules, ...toAdd];
        onUpdateRules(merged);
        setIsPresetPacksModalOpen(false);
        setNotification({
          type: 'success',
          text: `✓ ${addedCount} Regeln aus "${pack.name}" hinzugefügt (${rulesToApply.length - addedCount} bereits vorhandene übersprungen).`,
        });
      }
    }
  };

  const handleLoadPreset = (packId: string) => {
    const pack = PRESET_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    setSelectedPresetPackId(pack.id);
    setSelectedPresetRuleIds(new Set(pack.rules.map((r) => r.id)));
    setPresetRuleSearchQuery('');
    setIsPresetPacksModalOpen(true);
  };

  const handleSelectPresetPackInModal = (packId: string) => {
    const pack = PRESET_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    setSelectedPresetPackId(pack.id);
    setSelectedPresetRuleIds(new Set(pack.rules.map((r) => r.id)));
    setPresetRuleSearchQuery('');
  };

  const handleTogglePresetRule = (ruleId: string) => {
    setSelectedPresetRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const handleSelectAllPresetRules = (packRules: TabColorRule[]) => {
    setSelectedPresetRuleIds(new Set(packRules.map((r) => r.id)));
  };

  const handleDeselectAllPresetRules = () => {
    setSelectedPresetRuleIds(new Set());
  };

  const handleAddSinglePresetRule = (presetRule: TabColorRule) => {
    const newRule: TabColorRule = {
      ...presetRule,
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      priority: rules.length + 1,
    };
    onUpdateRules([...rules, newRule]);
    setNotification({
      type: 'success',
      text: `✓ Einzelne Regel "${presetRule.name}" (${presetRule.pattern}) hinzugefügt.`,
    });
  };

  const handleUpdateExistingWithPreset = (presetRule: TabColorRule) => {
    const key = `${presetRule.patternType}::${presetRule.pattern.trim().toLowerCase()}`;
    const updated = rules.map((r) => {
      if (`${r.patternType}::${r.pattern.trim().toLowerCase()}` === key) {
        return {
          ...r,
          name: presetRule.name,
          color: presetRule.color,
          firefoxContainerColor: presetRule.firefoxContainerColor,
          containerName: presetRule.containerName,
          customEmoji: presetRule.customEmoji,
          firefoxContainerIcon: presetRule.firefoxContainerIcon,
          colorMode: presetRule.colorMode,
        };
      }
      return r;
    });
    onUpdateRules(updated);
    setNotification({
      type: 'success',
      text: `✓ Vorhandene Regel "${presetRule.name}" mit Preset-Einstellungen aktualisiert.`,
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

          <button
            type="button"
            onClick={() => setIsPresetPacksModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
            title="Vorkonfigurierte Workflow-Regelpakete (Development, Social, Shopping, Work, Privacy) öffnen"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Preset Packs</span>
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
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rules by name, pattern, or container..."
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs p-0.5 cursor-pointer"
                title="Suche zurücksetzen"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter result badge */}
            <span className="text-[11px] font-mono px-2 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
              {showOnlySelected && searchQuery
                ? `${filteredRules.length} Treffer in ${selectedCount} Ausgewählten`
                : showOnlySelected
                ? `⭐ ${filteredRules.length} Ausgewählte aktiv`
                : searchQuery
                ? `${filteredRules.length} von ${rules.length} Regeln`
                : `Alle ${rules.length} Regeln`}
            </span>

            {/* Filter auf alle Ausgewählten umschalten */}
            <button
              type="button"
              onClick={handleToggleShowOnlySelected}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                showOnlySelected
                  ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-300'
                  : selectedCount > 0
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="Filtert die Tabelle so, dass nur die aktuell ausgewählten Regeln angezeigt werden"
            >
              <span>⭐</span>
              <span>
                {showOnlySelected
                  ? `Nur Ausgewählte (${selectedCount}) [Alle zeigen]`
                  : `Nur Ausgewählte anzeigen (${selectedCount})`}
              </span>
            </button>

            {/* Selektiv vergrößern: Treffer zur Auswahl hinzufügen */}
            {searchQuery && filteredRules.length > 0 && (
              <button
                type="button"
                onClick={handleAddFilteredToSelection}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  allFilteredAreSelected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 opacity-80'
                    : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-500 shadow-xs'
                }`}
                title="Fügt die aktuellen Suchtreffer zur bestehenden Auswahl hinzu (Auswahl schrittweise erweitern)"
              >
                <span>➕</span>
                <span>
                  {allFilteredAreSelected
                    ? `✓ ${filteredRules.length} Treffer in Auswahl`
                    : `+${unselectedFilteredCount} Treffer zur Auswahl hinzufügen`}
                </span>
              </button>
            )}

            {/* Nur diese Treffer auswählen */}
            {searchQuery && filteredRules.length > 0 && (
              <button
                type="button"
                onClick={handleSelectOnlyFiltered}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 transition-colors cursor-pointer whitespace-nowrap"
                title="Wählt ausschließlich die aktuellen Treffer aus und deselektiert alle anderen"
              >
                <span>☑️</span>
                <span>Nur diese Treffer ({filteredRules.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Workflow Preset Packs Quick Selector */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-purple-50/90 via-purple-50/50 to-sky-50/80 border border-purple-200 text-xs shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                Workflow Preset-Packs
              </span>
              <span className="text-[11px] text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full font-medium hidden md:inline">
                Regeln einzeln oder im Pack laden
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPresetPacksModalOpen(true)}
              className="text-xs text-purple-700 hover:text-purple-900 font-bold hover:underline cursor-pointer flex items-center gap-1 ml-auto sm:ml-0"
            >
              <span>Alle Packs &amp; einzelne Regeln durchsuchen</span>
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 w-full">
            {PRESET_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => handleLoadPreset(pack.id)}
                className="flex items-center justify-between p-2 px-3 rounded-lg bg-white hover:bg-purple-100/60 text-slate-800 border border-purple-200/80 hover:border-purple-300 font-semibold text-xs shadow-2xs transition-all cursor-pointer group text-left"
                title={`${pack.name} (${pack.rules.length} Regeln) – Klick für Einzel-Auswahl & Import`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{pack.icon}</span>
                  <span className="truncate group-hover:text-purple-700 font-medium">{pack.name.split(' ')[0]}</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold shrink-0 ml-1">
                  {pack.rules.length}
                </span>
              </button>
            ))}
          </div>
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

            {searchQuery && hiddenSelectedCount > 0 && (
              <button
                type="button"
                onClick={handleSelectOnlyFiltered}
                className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer font-medium"
                title="Wählt alle nicht durch die Suche angezeigten Regeln ab"
              >
                🎯 Nur Treffer auswählen ({visibleSelectedCount})
              </button>
            )}

            {!showOnlySelected && (
              <button
                type="button"
                onClick={() => setShowOnlySelected(true)}
                className="text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2 cursor-pointer font-medium"
                title="Tabelle filtern, sodass nur die ausgewählten Regeln angezeigt werden"
              >
                ⭐ Auf {selectedCount} Ausgewählte filtern
              </button>
            )}

            {showOnlySelected && (
              <button
                type="button"
                onClick={() => setShowOnlySelected(false)}
                className="text-xs text-sky-300 hover:text-sky-200 underline underline-offset-2 cursor-pointer font-medium"
                title="Alle Regeln wieder in der Tabelle anzeigen"
              >
                🌐 Alle Regeln anzeigen
              </button>
            )}

            {unselectedFilteredCount > 0 && (
              <button
                type="button"
                onClick={handleAddFilteredToSelection}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 cursor-pointer font-medium"
              >
                ➕ +{unselectedFilteredCount} Treffer dazunehmen
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
                  <label
                    className="inline-flex items-center justify-center p-2 -m-2 cursor-pointer select-none"
                    title={
                      allFilteredAreSelected
                        ? 'Alle sichtbaren Regeln abwählen'
                        : 'Alle sichtbaren Regeln auswählen'
                    }
                  >
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
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 focus:ring-offset-0 cursor-pointer transition-colors"
                    />
                  </label>
                </th>
                <th className="py-3 px-3 w-36 text-center" title="Priorität: Zahl direkt eingeben, mit Pfeilen bewegen (⏫/▲/▼/⏬) oder per Drag & Drop sortieren">
                  Priorität
                </th>
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
                      onDragOver={(e) => handleDragOver(originalIndex, e)}
                      onDrop={(e) => handleDrop(originalIndex, e)}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected
                          ? 'bg-sky-50/80 hover:bg-sky-100/60'
                          : !rule.enabled
                          ? 'opacity-50 bg-slate-50/30'
                          : ''
                      } ${
                        dragOverIndex === originalIndex ? 'border-t-2 border-sky-500 bg-sky-50/60' : ''
                      } ${
                        draggedIndex === originalIndex ? 'opacity-30' : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-2.5 px-3 text-center">
                        <label
                          className="inline-flex items-center justify-center p-2.5 -m-2.5 cursor-pointer select-none"
                          title={isSelected ? `Regel "${rule.name}" abwählen` : `Regel "${rule.name}" auswählen`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelectRule(rule.id, e)}
                            aria-label={`Regel ${rule.name} auswählen`}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 focus:ring-offset-0 cursor-pointer transition-colors"
                          />
                        </label>
                      </td>

                      {/* Priority Ordering */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Drag & Drop Handle */}
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(originalIndex, e)}
                            onDragEnd={handleDragEnd}
                            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 p-0.5 rounded transition-colors touch-none select-none"
                            title="Regel per Drag & Drop an eine beliebige Position ziehen"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>

                          {/* Direct Priority Number Input */}
                          <input
                            type="number"
                            min={1}
                            max={rules.length}
                            value={priorityInputMap[rule.id] ?? (originalIndex + 1)}
                            onChange={(e) => handlePriorityInputChange(rule.id, e.target.value)}
                            onBlur={() => handlePriorityInputCommit(rule.id, originalIndex)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handlePriorityInputCommit(rule.id, originalIndex);
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-10 h-7 text-center font-mono text-xs tabular-nums bg-white border border-slate-200 hover:border-sky-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded px-0.5 py-0.5 text-slate-700 font-semibold shadow-2xs"
                            title={`Priorität direkt als Zahl eingeben (1 bis ${rules.length}) & Enter drücken`}
                            aria-label={`Priorität für ${rule.name}`}
                          />

                          {/* Quick Navigation Buttons */}
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveToTop(originalIndex)}
                              disabled={originalIndex === 0}
                              className="text-slate-400 hover:text-sky-600 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100"
                              title="Ganz nach oben (Platz #1)"
                              aria-label="Ganz nach oben verschieben"
                            >
                              <ChevronsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveUp(originalIndex)}
                              disabled={originalIndex === 0}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100"
                              title="1 Schritt nach oben"
                              aria-label="Einen Schritt nach oben verschieben"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveDown(originalIndex)}
                              disabled={originalIndex === rules.length - 1}
                              className="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100"
                              title="1 Schritt nach unten"
                              aria-label="Einen Schritt nach unten verschieben"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveToBottom(originalIndex)}
                              disabled={originalIndex === rules.length - 1}
                              className="text-slate-400 hover:text-sky-600 disabled:opacity-20 transition-colors p-1 rounded hover:bg-slate-100"
                              title="Ganz nach unten (Letzter Platz)"
                              aria-label="Ganz nach unten verschieben"
                            >
                              <ChevronsDown className="w-3.5 h-3.5" />
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
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="text-2xl">{showOnlySelected ? '⭐' : '📋'}</div>
                      <div className="font-semibold text-slate-800">
                        {showOnlySelected
                          ? 'Keine ausgewählten Regeln passend zum Filter'
                          : 'No matching rules found'}
                      </div>
                      <p className="text-xs text-slate-500">
                        {showOnlySelected
                          ? selectedCount === 0
                            ? 'Aktuell sind keine Regeln ausgewählt. Wählen Sie Regeln über die Tabelle aus.'
                            : 'Keine der ausgewählten Regeln passt zu Ihrer Suche. Filter zurücksetzen oder alle Regeln anzeigen.'
                          : searchQuery
                          ? 'Versuchen Sie, die Suche zurückzusetzen oder eine neue Regel anzulegen.'
                          : 'Get started by creating your first URL color rule or loading a preset pack.'}
                      </p>
                      {showOnlySelected ? (
                        <button
                          type="button"
                          onClick={() => setShowOnlySelected(false)}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs cursor-pointer"
                        >
                          Alle {rules.length} Regeln anzeigen
                        </button>
                      ) : (
                        <button
                          onClick={onOpenCreateModal}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Rule</span>
                        </button>
                      )}
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

      {/* Modal for selecting Workflow Preset Packs */}
      {isPresetPacksModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl xl:max-w-7xl h-[90vh] max-h-[94vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 bg-gradient-to-r from-purple-50 via-white to-sky-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Workflow Preset-Packs</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                      {PRESET_PACKS.length} Packs verfügbar
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Wähle vorkonfigurierte Regeln für Development, Social Media, Shopping oder Work – lade einzelne Regeln gezielt oder ganze Packs auf einmal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPresetPacksModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Left column Packs navigation & Right column Pack Detail / Rules preview */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-5 overflow-hidden">
              {/* Left Column: Preset Pack Cards List (4 cols) */}
              <div className="lg:col-span-4 xl:col-span-4 flex flex-col h-full min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    1. Preset-Pack wählen:
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {PRESET_PACKS.length} Packs
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 space-y-2.5">
                  {PRESET_PACKS.map((pack) => {
                    const isSelected = selectedPresetPackId === pack.id;
                    return (
                      <div
                        key={pack.id}
                        onClick={() => handleSelectPresetPackInModal(pack.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50/70 ring-2 ring-purple-400/30 shadow-xs'
                            : 'border-slate-200 hover:border-purple-300 bg-white hover:bg-slate-50/80 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{pack.icon}</span>
                            <div>
                              <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>{pack.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {pack.rules.length} vorkonfigurierte Regeln
                              </span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                            isSelected 
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {pack.badge}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {pack.description}
                        </p>

                        {/* Swatches preview of colors in this pack */}
                        <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100">
                          <div className="flex items-center -space-x-1 overflow-hidden">
                            {pack.rules.slice(0, 6).map((r, i) => (
                              <span
                                key={i}
                                className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs"
                                style={{ backgroundColor: r.color }}
                                title={`${r.name} (${r.firefoxContainerColor})`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400 ml-1.5 truncate">
                            {pack.tags.slice(0, 3).join(', ')}...
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Pack Detail & Rule Selection List (8 cols) */}
              <div className="lg:col-span-8 xl:col-span-8 flex flex-col h-full min-h-0 bg-slate-50/80 rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
                {(() => {
                  const activePack = PRESET_PACKS.find((p) => p.id === selectedPresetPackId) || PRESET_PACKS[0];
                  if (!activePack) return null;

                  const filteredPackRules = activePack.rules.filter((rule) => {
                    if (!presetRuleSearchQuery.trim()) return true;
                    const q = presetRuleSearchQuery.toLowerCase().trim();
                    return (
                      rule.name.toLowerCase().includes(q) ||
                      rule.pattern.toLowerCase().includes(q) ||
                      rule.containerName.toLowerCase().includes(q) ||
                      rule.firefoxContainerColor.toLowerCase().includes(q)
                    );
                  });

                  const selectedInActivePackCount = activePack.rules.filter((r) => selectedPresetRuleIds.has(r.id)).length;
                  const isFiltered = presetRuleSearchQuery.trim().length > 0;
                  const rulesInScope = isFiltered ? filteredPackRules : activePack.rules;
                  const selectedInScopeCount = rulesInScope.filter((r) => selectedPresetRuleIds.has(r.id)).length;
                  const allInScopeSelected = rulesInScope.length > 0 && selectedInScopeCount === rulesInScope.length;
                  const isPackIndeterminate = selectedInScopeCount > 0 && !allInScopeSelected;

                  const handleToggleAllInScope = () => {
                    if (allInScopeSelected) {
                      setSelectedPresetRuleIds((prev) => {
                        const next = new Set(prev);
                        rulesInScope.forEach((r) => next.delete(r.id));
                        return next;
                      });
                    } else {
                      setSelectedPresetRuleIds((prev) => {
                        const next = new Set(prev);
                        rulesInScope.forEach((r) => next.add(r.id));
                        return next;
                      });
                    }
                  };

                  return (
                    <>
                      {/* Pack Header info (shrink-0) */}
                      <div className="shrink-0 space-y-2 pb-3 border-b border-slate-200">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-3xl">{activePack.icon}</span>
                            <div>
                              <h4 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                                <span>{activePack.name}</span>
                                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                                  {activePack.rules.length} Regeln
                                </span>
                              </h4>
                              <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                                {activePack.description}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Contained Domains Tags */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[11px] font-bold text-slate-400">Domains:</span>
                          {activePack.tags.map((tag) => (
                            <span key={tag} className="text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-medium shadow-2xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Rule Selection Toolbar (shrink-0) */}
                      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleToggleAllInScope}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              readOnly
                              tabIndex={-1}
                              checked={allInScopeSelected}
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate = isPackIndeterminate;
                                }
                              }}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer pointer-events-none"
                            />
                            <span>
                              {allInScopeSelected
                                ? (isFiltered ? 'Gefilterte abwählen' : 'Alle abwählen')
                                : (isFiltered ? 'Gefilterte auswählen' : 'Alle auswählen')}
                            </span>
                          </button>

                          <span className="text-xs font-semibold text-purple-900 bg-purple-100/70 px-2.5 py-1.5 rounded-lg">
                            {selectedInActivePackCount} von {activePack.rules.length} Regeln ausgewählt
                            {isFiltered && ` (${selectedInScopeCount} von ${filteredPackRules.length} gefilterten)`}
                          </span>
                        </div>

                        {/* Search filter in pack */}
                        <div className="relative min-w-[180px] max-w-[260px]">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={presetRuleSearchQuery}
                            onChange={(e) => setPresetRuleSearchQuery(e.target.value)}
                            placeholder="Regeln filtern..."
                            className="w-full pl-8 pr-3 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          {presetRuleSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setPresetRuleSearchQuery('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rules preview and selective picking list (flex-1 min-h-0: FILLS ALL AVAILABLE VERTICAL SPACE!) */}
                      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1.5 my-1">
                        {filteredPackRules.length === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                            Keine Regeln entsprechen dem Filter "{presetRuleSearchQuery}".
                          </div>
                        ) : (
                          filteredPackRules.map((rule) => {
                            const isChecked = selectedPresetRuleIds.has(rule.id);
                            const existingRule = rules.find(
                              (r) =>
                                r.patternType === rule.patternType &&
                                r.pattern.trim().toLowerCase() === rule.pattern.trim().toLowerCase()
                            );
                            const isAlreadyPresent = !!existingRule;

                            return (
                              <div
                                key={rule.id}
                                onClick={() => handleTogglePresetRule(rule.id)}
                                role="checkbox"
                                aria-checked={isChecked}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === ' ' || e.key === 'Enter') {
                                    e.preventDefault();
                                    handleTogglePresetRule(rule.id);
                                  }
                                }}
                                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-2xs transition-all cursor-pointer select-none ${
                                  isChecked
                                    ? 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-400/30 shadow-xs'
                                    : 'bg-white/80 border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                                  {/* Checkbox for batch select */}
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                    tabIndex={-1}
                                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 shrink-0 pointer-events-none"
                                  />

                                  {/* Color indicator and emoji */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span
                                      className="w-4 h-4 rounded-full border border-black/15 shadow-2xs shrink-0"
                                      style={{ backgroundColor: rule.color }}
                                      title={rule.color}
                                    />
                                    <span className="text-base shrink-0">{rule.customEmoji || '🦊'}</span>
                                  </div>

                                  {/* Rule Name & Pattern */}
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                      <span>{rule.name}</span>
                                      {isAlreadyPresent && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          ✓ Bereits vorhanden
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                      <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
                                        {rule.patternType}
                                      </span>
                                      <span className="text-purple-700 font-semibold">{rule.pattern}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Container badge */}
                                  <div className="hidden sm:flex flex-col items-end pointer-events-none">
                                    <span
                                      className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                                      style={{
                                        backgroundColor: `${rule.color}15`,
                                        borderColor: `${rule.color}40`,
                                        color: rule.color,
                                      }}
                                    >
                                      {rule.containerName}
                                    </span>
                                    <span className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                                      {rule.firefoxContainerColor}
                                    </span>
                                  </div>

                                  {/* INDIVIDUAL ADD BUTTON ("nur einzelne laden") */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isAlreadyPresent) {
                                        handleUpdateExistingWithPreset(rule);
                                      } else {
                                        handleAddSinglePresetRule(rule);
                                      }
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                      isAlreadyPresent
                                        ? 'bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 border border-slate-300 hover:border-purple-300'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                                    }`}
                                    title={
                                      isAlreadyPresent
                                        ? 'Bestehende Regel mit den Preset-Farben & Container-Einstellungen aktualisieren'
                                        : 'Nur diese eine Regel direkt zu deinen Regeln hinzufügen'
                                    }
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>{isAlreadyPresent ? 'Aktualisieren' : 'Einzeln laden'}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Action options (shrink-0 at bottom) */}
                      <div className="pt-3 border-t border-slate-200 shrink-0 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                          <span>
                            Ausgewählte Regeln ({selectedInActivePackCount}) auf deine Regelliste anwenden:
                          </span>
                          <span className="text-slate-400 text-[11px] hidden sm:inline">
                            Tipp: Über <strong>"+ Einzeln laden"</strong> an jeder Regel kannst du auch gezielt nur 1 Regel übernehmen.
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={selectedInActivePackCount === 0}
                            onClick={() => handleApplyPresetPack(activePack, 'append', true)}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            title="Fügt nur die mit Häkchen ausgewählten Regeln zu deiner Liste hinzu"
                          >
                            <Plus className="w-4 h-4" />
                            <span>
                              + Ausgewählte Regeln hinzufügen ({selectedInActivePackCount})
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={selectedInActivePackCount === 0}
                            onClick={() => {
                              if (
                                rules.length === 0 ||
                                window.confirm(
                                  `Möchtest du alle bisherigen ${rules.length} Regeln wirklich durch die ${selectedInActivePackCount} ausgewählten Regeln aus "${activePack.name}" ersetzen?`
                                )
                              ) {
                                handleApplyPresetPack(activePack, 'replace', true);
                              }
                            }}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-800 border border-slate-300 font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                            title="Ersetzt alle bestehenden Regeln durch die ausgewählten Regeln"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              Ausgewählte Regeln ersetzen ({selectedInActivePackCount})
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="hidden sm:inline">
                Tipp: Mit <strong>"+ Einzeln laden"</strong> oder <strong>"+ Ausgewählte Regeln hinzufügen"</strong> bleiben all deine selbst erstellten Regeln erhalten.
              </span>
              <button
                type="button"
                onClick={() => setIsPresetPacksModalOpen(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs ml-auto cursor-pointer"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
