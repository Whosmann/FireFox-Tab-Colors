import React, { useState } from 'react';
import { X, Check, Sparkles, Palette, CheckCircle2, Shield } from 'lucide-react';
import { FirefoxContainerColor, FirefoxContainerIcon } from '../types/extension';
import { FIREFOX_CONTAINER_COLORS, findClosestContainerColor } from '../utils/urlMatcher';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (changes: {
    status?: 'enable' | 'disable' | 'toggle';
    color?: string;
    containerColor?: FirefoxContainerColor;
    containerName?: string;
    containerIcon?: FirefoxContainerIcon;
    customEmoji?: string;
    clearEmoji?: boolean;
    colorMode?: 'container' | 'hybrid';
    enableTopBar?: boolean;
  }) => void;
}

const CONTAINER_ICONS: { id: FirefoxContainerIcon; icon: string; label: string }[] = [
  { id: 'circle', icon: '●', label: 'Circle' },
  { id: 'briefcase', icon: '💼', label: 'Briefcase' },
  { id: 'fingerprint', icon: '🔒', label: 'Security' },
  { id: 'dollar', icon: '💰', label: 'Finance' },
  { id: 'cart', icon: '🛒', label: 'Shopping' },
  { id: 'tree', icon: '🌲', label: 'Dev' },
  { id: 'chill', icon: '☕', label: 'Chill' },
  { id: 'vacation', icon: '🏖️', label: 'Vacation' },
  { id: 'food', icon: '🍔', label: 'Food' },
  { id: 'fruit', icon: '🍎', label: 'Fruit' },
  { id: 'pet', icon: '🐾', label: 'Pet' },
  { id: 'gift', icon: '🎁', label: 'Gift' },
];

const QUICK_EMOJIS = ['📦', '⚡', '🚀', '🔒', '🌐', '🧪', '🛒', '💼', '🛠️', '🎯', '⭐', '🔥'];

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onApply,
}) => {
  const [statusAction, setStatusAction] = useState<'keep' | 'enable' | 'disable' | 'toggle'>('keep');
  
  const [applyColor, setApplyColor] = useState(false);
  const [selectedColorHex, setSelectedColorHex] = useState('#37adff');
  const [selectedContainerColor, setSelectedContainerColor] = useState<FirefoxContainerColor>('blue');

  const [applyContainerName, setApplyContainerName] = useState(false);
  const [containerName, setContainerName] = useState('');

  const [applyIcon, setApplyIcon] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<FirefoxContainerIcon>('circle');

  const [applyEmoji, setApplyEmoji] = useState(false);
  const [clearEmoji, setClearEmoji] = useState(false);
  const [emojiValue, setEmojiValue] = useState('');

  const [modeAction, setModeAction] = useState<'keep' | 'container' | 'hybrid'>('keep');
  const [topBarAction, setTopBarAction] = useState<'keep' | 'enable' | 'disable'>('keep');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const changes: Parameters<typeof onApply>[0] = {};

    if (statusAction !== 'keep') {
      changes.status = statusAction;
    }

    if (applyColor) {
      changes.color = selectedColorHex;
      changes.containerColor = selectedContainerColor;
    }

    if (applyContainerName && containerName.trim()) {
      changes.containerName = containerName.trim();
    }

    if (applyIcon) {
      changes.containerIcon = selectedIcon;
    }

    if (applyEmoji) {
      if (clearEmoji) {
        changes.clearEmoji = true;
      } else if (emojiValue.trim()) {
        changes.customEmoji = emojiValue.trim();
      }
    }

    if (modeAction !== 'keep') {
      changes.colorMode = modeAction;
    }

    if (topBarAction !== 'keep') {
      changes.enableTopBar = topBarAction === 'enable';
    }

    onApply(changes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Massenbearbeitung (Bulk Edit)
              </h2>
              <p className="text-xs text-slate-400">
                Wenden Sie Einstellungen gleichzeitig auf alle <span className="text-sky-400 font-semibold">{selectedCount} ausgewählten Regeln</span> an.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* 1. Status */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 space-y-2">
            <label className="block text-xs font-bold text-sky-300">
              1. Aktivierungsstatus anpassen:
            </label>
            <select
              value={statusAction}
              onChange={(e) => setStatusAction(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="keep">-- Keine Änderung (vorhandenen Status beibehalten) --</option>
              <option value="enable">Alle auf Aktiv setzen (● Aktiviert)</option>
              <option value="disable">Alle auf Deaktiviert setzen (○ Inaktiv)</option>
              <option value="toggle">Status umkehren (Aktiv ↔ Inaktiv)</option>
            </select>
          </div>

          {/* 2. Farbe */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyColor}
                onChange={(e) => setApplyColor(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 w-4 h-4"
              />
              <span className="text-xs font-bold text-white">
                2. Container-Farbe überschreiben
              </span>
            </label>

            {applyColor && (
              <div className="space-y-2.5 pt-1 pl-6">
                <span className="text-[11px] font-medium text-slate-400 block">
                  Offizielle Firefox Container-Farbe wählen:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(FIREFOX_CONTAINER_COLORS) as FirefoxContainerColor[]).map((cKey) => {
                    const item = FIREFOX_CONTAINER_COLORS[cKey];
                    const isSelected = selectedContainerColor === cKey;
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => {
                          setSelectedContainerColor(cKey);
                          setSelectedColorHex(item.hex);
                        }}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-400 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-white/20"
                          style={{ backgroundColor: item.hex }}
                        />
                        <span className="text-[11px] font-medium capitalize truncate">
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Hex-Code:</span>
                  <input
                    type="color"
                    value={selectedColorHex}
                    onChange={(e) => {
                      setSelectedColorHex(e.target.value);
                      setSelectedContainerColor(findClosestContainerColor(e.target.value));
                    }}
                    className="w-7 h-7 rounded border border-slate-700 bg-slate-900 p-0.5 cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={selectedColorHex}
                    onChange={(e) => {
                      setSelectedColorHex(e.target.value);
                      setSelectedContainerColor(findClosestContainerColor(e.target.value));
                    }}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-sky-500 w-28"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Container-Icon */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyIcon}
                onChange={(e) => setApplyIcon(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 w-4 h-4"
              />
              <span className="text-xs font-bold text-white">
                3. Container-Icon überschreiben
              </span>
            </label>

            {applyIcon && (
              <div className="grid grid-cols-4 gap-1.5 pt-1 pl-6">
                {CONTAINER_ICONS.map((iconItem) => {
                  const isSelected = selectedIcon === iconItem.id;
                  return (
                    <button
                      key={iconItem.id}
                      type="button"
                      onClick={() => setSelectedIcon(iconItem.id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-sm mb-0.5">{iconItem.icon}</span>
                      <span className="text-[10px] font-medium truncate w-full">{iconItem.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Tab-Symbol / Emoji */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyEmoji}
                onChange={(e) => setApplyEmoji(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 w-4 h-4"
              />
              <span className="text-xs font-bold text-white">
                4. Tab-Symbol / Emoji anpassen
              </span>
            </label>

            {applyEmoji && (
              <div className="space-y-2 pt-1 pl-6">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={emojiValue}
                    disabled={clearEmoji}
                    onChange={(e) => setEmojiValue(e.target.value)}
                    placeholder="z. B. 🛡️ oder [API]"
                    maxLength={10}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 disabled:opacity-40"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-rose-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clearEmoji}
                      onChange={(e) => setClearEmoji(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500"
                    />
                    <span>Symbole entfernen</span>
                  </label>
                </div>

                {!clearEmoji && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {QUICK_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setEmojiValue(em)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-750 border border-slate-700 text-sm hover:scale-110 transition-transform cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Farbmodus */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 space-y-2">
            <label className="block text-xs font-bold text-sky-300">
              5. Farbmodus anpassen:
            </label>
            <select
              value={modeAction}
              onChange={(e) => setModeAction(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="keep">-- Keine Änderung (vorhandenen Modus beibehalten) --</option>
              <option value="container">Nur Container (Empfohlen: Firefox Theme bleibt unberührt)</option>
              <option value="hybrid">Hybrid (Container + Firefox Fenstertheme)</option>
            </select>
          </div>

          {/* 6. Akzentleiste */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 space-y-2">
            <label className="block text-xs font-bold text-sky-300">
              6. 3px Seiten-Akzentleiste:
            </label>
            <select
              value={topBarAction}
              onChange={(e) => setTopBarAction(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="keep">-- Keine Änderung (beibehalten) --</option>
              <option value="enable">Akzentleiste aktivieren (ein)</option>
              <option value="disable">Akzentleiste deaktivieren (aus)</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Auf {selectedCount} Regeln anwenden</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
