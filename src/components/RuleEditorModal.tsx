import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { 
  FirefoxContainerColor, 
  FirefoxContainerIcon, 
  TabColorRule, 
  UrlPatternType,
  ColorMode
} from '../types/extension';
import { 
  FIREFOX_CONTAINER_COLORS, 
  findClosestContainerColor, 
  validatePattern 
} from '../utils/urlMatcher';

interface RuleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: TabColorRule) => void;
  initialRule?: TabColorRule | null;
}

const CONTAINER_ICONS: { id: FirefoxContainerIcon; label: string; icon: string; category: string }[] = [
  { id: 'circle', label: 'Circle', icon: '●', category: 'General' },
  { id: 'briefcase', label: 'Briefcase', icon: '💼', category: 'Work' },
  { id: 'fingerprint', label: 'Security', icon: '🔒', category: 'Auth' },
  { id: 'dollar', label: 'Finance', icon: '💰', category: 'Banking' },
  { id: 'cart', label: 'Shopping', icon: '🛒', category: 'Orders' },
  { id: 'tree', label: 'Dev / Tree', icon: '🌲', category: 'Code' },
  { id: 'chill', label: 'Chill', icon: '☕', category: 'Media' },
  { id: 'vacation', label: 'Vacation', icon: '🏖️', category: 'Travel' },
  { id: 'food', label: 'Food', icon: '🍔', category: 'Dining' },
  { id: 'fruit', label: 'Fruit', icon: '🍎', category: 'Health' },
  { id: 'pet', label: 'Pet', icon: '🐾', category: 'Animals' },
  { id: 'gift', label: 'Gift', icon: '🎁', category: 'Special' },
];

export const RuleEditorModal: React.FC<RuleEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRule,
}) => {
  const [name, setName] = useState(initialRule?.name || '');
  const [patternType, setPatternType] = useState<UrlPatternType>(initialRule?.patternType || 'domain');
  const [pattern, setPattern] = useState(initialRule?.pattern || '');
  const [color, setColor] = useState(initialRule?.color || '#ff4f5e');
  const [containerColor, setContainerColor] = useState<FirefoxContainerColor>(
    initialRule?.firefoxContainerColor || 'red'
  );
  const [containerIcon, setContainerIcon] = useState<FirefoxContainerIcon>(
    initialRule?.firefoxContainerIcon || 'circle'
  );
  const [containerName, setContainerName] = useState(initialRule?.containerName || '');
  const [customEmoji, setCustomEmoji] = useState(initialRule?.customEmoji || '');
  const [enableTitleEmoji, setEnableTitleEmoji] = useState(initialRule?.enableTitleEmoji ?? true);
  const [enableFaviconEmoji, setEnableFaviconEmoji] = useState(initialRule?.enableFaviconEmoji ?? true);
  const [colorMode, setColorMode] = useState<ColorMode>(initialRule?.colorMode || 'hybrid');
  const [accentBorder, setAccentBorder] = useState(initialRule?.accentBorder ?? true);
  const [enabled, setEnabled] = useState(initialRule?.enabled ?? true);

  // Sync state whenever initialRule or isOpen changes so edit info ALWAYS loads accurately
  useEffect(() => {
    if (isOpen) {
      if (initialRule) {
        setName(initialRule.name || '');
        setPatternType(initialRule.patternType || 'domain');
        setPattern(initialRule.pattern || '');
        setColor(initialRule.color || '#ff4f5e');
        setContainerColor(initialRule.firefoxContainerColor || 'red');
        setContainerIcon(initialRule.firefoxContainerIcon || 'circle');
        setContainerName(initialRule.containerName || '');
        setCustomEmoji(initialRule.customEmoji || '');
        setEnableTitleEmoji(initialRule.enableTitleEmoji ?? true);
        setEnableFaviconEmoji(initialRule.enableFaviconEmoji ?? true);
        setColorMode(initialRule.colorMode || 'hybrid');
        setAccentBorder(initialRule.accentBorder ?? true);
        setEnabled(initialRule.enabled ?? true);
      } else {
        setName('');
        setPatternType('domain');
        setPattern('');
        setColor('#37adff');
        setContainerColor('blue');
        setContainerIcon('circle');
        setContainerName('');
        setCustomEmoji('');
        setEnableTitleEmoji(true);
        setEnableFaviconEmoji(true);
        setColorMode('hybrid');
        setAccentBorder(true);
        setEnabled(true);
      }
    }
  }, [isOpen, initialRule]);

  if (!isOpen) return null;

  const validation = validatePattern(pattern, patternType);

  const handleContainerColorSelect = (cName: FirefoxContainerColor) => {
    setContainerColor(cName);
    setColor(FIREFOX_CONTAINER_COLORS[cName].hex);
  };

  const handleCustomHexChange = (newHex: string) => {
    setColor(newHex);
    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      setContainerColor(findClosestContainerColor(newHex));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid || !name.trim()) return;

    const newRule: TabColorRule = {
      id: initialRule?.id || `rule-${Date.now()}`,
      name: name.trim(),
      patternType,
      pattern: pattern.trim(),
      color,
      firefoxContainerColor: containerColor,
      firefoxContainerIcon: containerIcon,
      customEmoji: customEmoji.trim(),
      enableTitleEmoji,
      enableFaviconEmoji,
      containerName: (containerName.trim() || name.trim()),
      colorMode,
      accentBorder,
      enabled,
      priority: initialRule?.priority || 1,
    };

    onSave(newRule);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {initialRule ? 'Edit Tab Color Rule' : 'Create URL Tab Color Rule'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify the URL matching criteria and designated Firefox tab color.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Rule Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rule Name / Label <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!containerName) setContainerName(e.target.value);
              }}
              placeholder="e.g. AWS Production Console, Staging API, GitHub"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>

          {/* Pattern Type & Pattern */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              URL Matching Logic <span className="text-rose-500">*</span>
            </label>

            {/* Pattern Type Selector */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              {([
                { type: 'domain', label: 'Domain' },
                { type: 'exact_host', label: 'Exact Host' },
                { type: 'wildcard', label: 'Wildcard' },
                { type: 'prefix', label: 'Prefix' },
                { type: 'regex', label: 'Regex' },
                { type: 'exact', label: 'Exact URL' }
              ] as { type: UrlPatternType; label: string }[]).map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPatternType(type)}
                  className={`py-1.5 px-1.5 rounded-md font-medium text-center text-xs transition-colors ${
                    patternType === type
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Pattern Input */}
            <div className="relative">
              <input
                type="text"
                required
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={
                  patternType === 'domain'
                    ? 'e.g. whomsann.de or github.com'
                    : patternType === 'exact_host'
                    ? 'e.g. 248924.4.whomsann.de (isolates other subdomains!)'
                    : patternType === 'wildcard'
                    ? 'e.g. *.staging.com/* or localhost:*'
                    : patternType === 'prefix'
                    ? 'e.g. https://console.aws.amazon.com/'
                    : patternType === 'regex'
                    ? 'e.g. ^https?:\\/\\/(prod|production)\\.example\\.com\\/.*'
                    : 'e.g. https://admin.internal.net/dashboard'
                }
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  !validation.valid && pattern ? 'border-rose-300 bg-rose-50/30' : 'border-slate-300'
                }`}
              />
            </div>

            {!validation.valid && pattern && (
              <div className="text-[11px] text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validation.error}</span>
              </div>
            )}

            <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-md border border-slate-200">
              {patternType === 'domain' && (
                <span>
                  <strong>Domain:</strong> Matches exact domain AND all its subdomains (e.g. <code>whomsann.de</code> matches both <code>248924.4.whomsann.de</code> and <code>248923.32.whomsann.de</code>).
                </span>
              )}
              {patternType === 'exact_host' && (
                <span>
                  <strong>Exact Host (Empfohlen bei Subdomains):</strong> Matches <em>NUR</em> diesen exakten Host (z. B. <code>248924.4.whomsann.de</code>). Andere Subdomains wie <code>248923.32.whomsann.de</code> werden <strong>nicht</strong> zugeteilt!
                </span>
              )}
              {patternType === 'wildcard' && 'Supports * for multiple characters and ? for single character.'}
              {patternType === 'regex' && 'Case-insensitive JavaScript regular expression.'}
              {patternType === 'prefix' && 'Matches any URL beginning with this exact prefix.'}
              {patternType === 'exact' && 'Requires 100% full URL equality.'}
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Firefox Tab Color <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Hex:</span>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => handleCustomHexChange(e.target.value)}
                  className="w-20 px-2 py-0.5 text-xs font-mono border border-slate-300 rounded focus:outline-none"
                />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handleCustomHexChange(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                />
              </div>
            </div>

            {/* Native Firefox Container 8 Colors */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {(Object.keys(FIREFOX_CONTAINER_COLORS) as FirefoxContainerColor[]).map((cKey) => {
                const c = FIREFOX_CONTAINER_COLORS[cKey];
                const isSelected = containerColor === cKey;
                return (
                  <button
                    key={cKey}
                    type="button"
                    onClick={() => handleContainerColorSelect(cKey)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full shadow-xs flex items-center justify-center text-white text-[10px]"
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[10px] font-medium text-slate-700 capitalize">
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Container Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Firefox Container Identity Name
            </label>
            <input
              type="text"
              value={containerName}
              onChange={(e) => setContainerName(e.target.value)}
              placeholder="e.g. Work, Staging, AWS"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Shown in Firefox address bar container badge.
            </span>
          </div>

          {/* Custom Tab Symbol & Emoji Picker (e.g. ⬇️ for Import) */}
          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-sky-950">
                  Eigene Symbole & Emojis für Tabs (z. B. ⬇️ Pfeil runter für Import)
                </label>
                <span className="text-[11px] text-sky-700">
                  Wählen Sie ein Schnell-Symbol oder geben Sie ein beliebiges eigenes Zeichen ein:
                </span>
              </div>
              {customEmoji && (
                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-sky-300 text-sky-800 shadow-2xs">
                  Aktiv: {customEmoji}
                </span>
              )}
            </div>

            {/* Quick Symbol Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { emoji: '⬇️', label: '⬇️ Import' },
                { emoji: '⬆️', label: '⬆️ Export' },
                { emoji: '📥', label: '📥 Inbox' },
                { emoji: '📦', label: '📦 Paket' },
                { emoji: '🚀', label: '🚀 Deploy' },
                { emoji: '⚡', label: '⚡ Dev' },
                { emoji: '🔒', label: '🔒 Auth' },
                { emoji: '📁', label: '📁 Ordner' },
                { emoji: '🛒', label: '🛒 Shop' },
                { emoji: '🧪', label: '🧪 Test' },
                { emoji: '📊', label: '📊 Stats' },
                { emoji: '⚙️', label: '⚙️ Config' },
              ].map(({ emoji, label }) => {
                const isSelected = customEmoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setCustomEmoji('');
                      } else {
                        setCustomEmoji(emoji);
                        if (!containerName) {
                          setContainerName(`${emoji} ${name || 'Gruppe'}`);
                        }
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-sky-600 text-white font-bold shadow-xs ring-2 ring-sky-300'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="text-[11px]">{label.slice(2)}</span>
                  </button>
                );
              })}
              {customEmoji && (
                <button
                  type="button"
                  onClick={() => setCustomEmoji('')}
                  className="px-2 py-1 rounded-lg text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200"
                >
                  ✕ Entfernen
                </button>
              )}
            </div>

            {/* Custom Symbol Free Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-600 whitespace-nowrap">Freies Zeichen:</span>
              <input
                type="text"
                value={customEmoji}
                onChange={(e) => setCustomEmoji(e.target.value)}
                placeholder="z. B. ⬇️ oder 📥 oder [IMP]"
                className="w-28 px-2 py-1 text-xs font-mono text-center bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <span className="text-[11px] text-slate-500">
                Wird direkt im Firefox Tab-Reiter und Container-Label dargestellt.
              </span>
            </div>

            {/* Checkbox Options */}
            <div className="space-y-1.5 pt-1 text-xs border-t border-sky-200/60">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={enableTitleEmoji}
                  onChange={(e) => setEnableTitleEmoji(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span>Symbol im Tab-Titel anzeigen (z. B. <code>{customEmoji || '⬇️'} Meine Importseite</code>)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={enableFaviconEmoji}
                  onChange={(e) => setEnableFaviconEmoji(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span>Symbol als Tab-Favicon darstellen (ersetzt/überlagert das Webseiten-Icon)</span>
              </label>
            </div>
          </div>

          {/* Firefox Container Icon Picker Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Firefox Container Icon Picker
              </label>
              <span className="text-[11px] font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                Selected: {CONTAINER_ICONS.find((i) => i.id === containerIcon)?.icon} {CONTAINER_ICONS.find((i) => i.id === containerIcon)?.label}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {CONTAINER_ICONS.map((icon) => {
                const isSelected = containerIcon === icon.id;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => setContainerIcon(icon.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/20 text-sky-950 font-semibold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-xl leading-none mb-1">{icon.icon}</span>
                    <span className="text-[11px] leading-tight truncate w-full">{icon.label}</span>
                    <span className="text-[9px] text-slate-400 leading-none mt-0.5">{icon.category}</span>
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Native Firefox icon displayed in the container badge pill and tab indicator.
            </span>
          </div>

          {/* Color Mode & Top Bar Accent */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Firefox Color Mechanism
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setColorMode('hybrid')}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    colorMode === 'hybrid'
                      ? 'bg-white border-sky-500 text-slate-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="font-semibold text-xs">Hybrid (Recommended)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Container stripe + dynamic theme</div>
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode('container')}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    colorMode === 'container'
                      ? 'bg-white border-sky-500 text-slate-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="font-semibold text-xs">Container Tab Only</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Native tab stripe & cookie isolation</div>
                </button>
                <button
                  type="button"
                  onClick={() => setColorMode('theme')}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    colorMode === 'theme'
                      ? 'bg-white border-sky-500 text-slate-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="font-semibold text-xs">Active Theme Only</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Tints tab bar when tab is active</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-xs font-medium text-slate-800">
                  Page Viewport Top Accent Line
                </div>
                <div className="text-[11px] text-slate-500">
                  Injects an unobtrusive 3px colored stripe across the top of the webpage.
                </div>
              </div>
              <input
                type="checkbox"
                checked={accentBorder}
                onChange={(e) => setAccentBorder(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
              />
            </div>
          </div>

          {/* Live Tab Preview Box */}
          <div className="p-3 bg-slate-900 rounded-xl text-white">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
              Tab Appearance Preview
            </span>
            <div className="flex items-center gap-2">
              {/* Tab sample */}
              <div
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-t-lg text-xs font-medium shadow-sm"
                style={{ borderTop: `3px solid ${color}` }}
              >
                <span className="text-sm">
                  {CONTAINER_ICONS.find((i) => i.id === containerIcon)?.icon || '🦊'}
                </span>
                <span>{name || 'Tab Preview'}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded ml-1 font-semibold flex items-center gap-1"
                  style={{ backgroundColor: `${color}33`, color }}
                >
                  <span>{CONTAINER_ICONS.find((i) => i.id === containerIcon)?.icon}</span>
                  <span>{containerName || 'Container'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!validation.valid || !name.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {initialRule ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
