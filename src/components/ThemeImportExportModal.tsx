import React, { useState, useRef } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  Copy, 
  Check, 
  Sparkles, 
  Palette, 
  FileJson, 
  Share2, 
  AlertCircle,
  Eye,
  Sliders,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  Save,
  Layers,
  CopyCheck
} from 'lucide-react';
import { ExtensionConfig, BaseThemeMode, FirefoxContainerColor, HybridWindowBehavior, HybridTabIndicatorStyle, SavedTheme } from '../types/extension';
import { FIREFOX_CONTAINER_COLORS, hexToRgba } from '../utils/urlMatcher';

export interface TabChromaThemePackage {
  format: 'tabchroma-theme';
  version: string;
  themeName?: string;
  description?: string;
  createdAt: string;
  baseThemeMode: BaseThemeMode;
  customBaseFrameColor: string;
  customBaseToolbarColor: string;
  customBaseTextColor: string;
  defaultColor?: string;
  defaultContainerColor?: FirefoxContainerColor;
  activeTabOpacity?: number;
  enableFaviconContrastHalo?: boolean;
  hybridWindowBehavior?: HybridWindowBehavior;
  hybridTabIndicatorStyle?: HybridTabIndicatorStyle;
  hybridIndicatorColor?: string;
}

export const POPULAR_THEME_PRESETS = [
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    description: 'Moderne, augenfreundliche Pastelltöne auf samtigem Schiefer',
    frame: '#181825',
    toolbar: '#1e1e2e',
    text: '#cdd6f4',
    defaultColor: '#cba6f7',
    defaultContainerColor: 'purple' as FirefoxContainerColor,
    opacity: 0.35,
    hybridWindowBehavior: 'static_window' as HybridWindowBehavior,
    hybridTabIndicatorStyle: 'accent_line_and_fill' as HybridTabIndicatorStyle,
  },
  {
    id: 'nord-aurora',
    name: 'Nord Aurora',
    description: 'Arktisches Dunkelblau mit Polar-Frost Cyan-Akzenten',
    frame: '#242933',
    toolbar: '#2e3440',
    text: '#eceff4',
    defaultColor: '#88c0d0',
    defaultContainerColor: 'turquoise' as FirefoxContainerColor,
    opacity: 0.35,
    hybridWindowBehavior: 'static_window' as HybridWindowBehavior,
    hybridTabIndicatorStyle: 'accent_line_and_fill' as HybridTabIndicatorStyle,
  },
  {
    id: 'dracula-pro',
    name: 'Dracula Dark',
    description: 'Beliebtes Entwickler-Theme mit markantem Pink & Violett',
    frame: '#21222c',
    toolbar: '#282a36',
    text: '#f8f8f2',
    defaultColor: '#ff79c6',
    defaultContainerColor: 'pink' as FirefoxContainerColor,
    opacity: 0.35,
    hybridWindowBehavior: 'static_window' as HybridWindowBehavior,
    hybridTabIndicatorStyle: 'accent_line_and_fill' as HybridTabIndicatorStyle,
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'Tiefes Nachtblau mit leuchtenden Neon-Akzenten',
    frame: '#16161e',
    toolbar: '#1a1b26',
    text: '#c0caf5',
    defaultColor: '#7aa2f7',
    defaultContainerColor: 'blue' as FirefoxContainerColor,
    opacity: 0.35,
    hybridWindowBehavior: 'static_window' as HybridWindowBehavior,
    hybridTabIndicatorStyle: 'accent_line_and_fill' as HybridTabIndicatorStyle,
  },
  {
    id: 'firefox-proton-dark',
    name: 'Firefox Dark Pure',
    description: 'Klassisches Mozilla Dark Theme (#1c1b22, #2b2a33)',
    frame: '#1c1b22',
    toolbar: '#2b2a33',
    text: '#fbfbfe',
    defaultColor: '#37adff',
    defaultContainerColor: 'blue' as FirefoxContainerColor,
    opacity: 0.35,
    hybridWindowBehavior: 'static_window' as HybridWindowBehavior,
    hybridTabIndicatorStyle: 'accent_line_and_fill' as HybridTabIndicatorStyle,
  },
  {
    id: 'oled-midnight',
    name: 'OLED Pure Black',
    description: 'Tiefschwarz für stromsparendes OLED ohne Graustufen',
    frame: '#000000',
    toolbar: '#0c0d12',
    text: '#ffffff',
    defaultColor: '#38bdf8',
    defaultContainerColor: 'blue' as FirefoxContainerColor,
    opacity: 0.40,
    hybridWindowBehavior: 'static_window' as HybridWindowBehavior,
    hybridTabIndicatorStyle: 'accent_line_and_fill' as HybridTabIndicatorStyle,
  },
  {
    id: 'clean-light',
    name: 'Firefox Light Pure',
    description: 'Helles Tageslicht-Design mit hohem Lesekontrast',
    frame: '#ffffff',
    toolbar: '#f0f0f4',
    text: '#15141a',
    defaultColor: '#0060df',
    defaultContainerColor: 'blue' as FirefoxContainerColor,
    opacity: 0.30,
    hybridWindowBehavior: 'static_window' as HybridWindowBehavior,
    hybridTabIndicatorStyle: 'accent_line_and_fill' as HybridTabIndicatorStyle,
  },
];

interface ThemeImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ExtensionConfig;
  onApplyTheme: (themeConfig: Partial<ExtensionConfig>) => void;
  onUpdateSavedThemes?: (savedThemes: SavedTheme[]) => void;
  initialTab?: 'export' | 'import' | 'presets';
}

export const ThemeImportExportModal: React.FC<ThemeImportExportModalProps> = ({
  isOpen,
  onClose,
  config,
  onApplyTheme,
  onUpdateSavedThemes,
  initialTab = 'export',
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'presets'>(initialTab);
  const [themeName, setThemeName] = useState('Mein Team-Theme');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Import state
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedTheme, setParsedTheme] = useState<Partial<ExtensionConfig> | null>(null);
  const [parsedMeta, setParsedMeta] = useState<{ name?: string; source?: string } | null>(null);

  // --- Team Presets State ---
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [isCreatingNewPreset, setIsCreatingNewPreset] = useState(false);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const [showPresetsJsonModal, setShowPresetsJsonModal] = useState(false);
  const [presetsBundleText, setPresetsBundleText] = useState('');

  // Editable Form for Create / Edit Preset
  const [presetForm, setPresetForm] = useState<SavedTheme>({
    id: '',
    name: 'Neues Team-Preset',
    description: 'Für interne Entwicklungs- und Produktiv-Container',
    frame: config.customBaseFrameColor || '#1c1b22',
    toolbar: config.customBaseToolbarColor || '#2b2a33',
    text: config.customBaseTextColor || '#fbfbfe',
    defaultColor: config.defaultColor || '#37adff',
    defaultContainerColor: config.defaultContainerColor || 'blue',
    activeTabOpacity: config.activeTabOpacity ?? 0.35,
    hybridWindowBehavior: config.hybridWindowBehavior || 'static_window',
    hybridTabIndicatorStyle: config.hybridTabIndicatorStyle || 'accent_line_and_fill',
    isCustom: true,
  });

  // Calculate current list of all presets (standard + user saved)
  const userSavedThemes = config.savedThemes || [];
  const allPresets: SavedTheme[] = [
    ...POPULAR_THEME_PRESETS.map((p) => {
      // Check if user has an override for this default preset
      const customOverride = userSavedThemes.find((u) => u.id === p.id);
      if (customOverride) {
        return { ...customOverride, isCustom: true };
      }
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        frame: p.frame,
        toolbar: p.toolbar,
        text: p.text,
        defaultColor: p.defaultColor,
        defaultContainerColor: p.defaultContainerColor,
        activeTabOpacity: p.opacity,
        hybridWindowBehavior: p.hybridWindowBehavior,
        hybridTabIndicatorStyle: p.hybridTabIndicatorStyle,
        isCustom: false,
      };
    }),
    ...userSavedThemes.filter((u) => !POPULAR_THEME_PRESETS.some((p) => p.id === u.id)),
  ];

  if (!isOpen) return null;

  // Prepare export theme package
  const currentThemePackage: TabChromaThemePackage = {
    format: 'tabchroma-theme',
    version: '1.0',
    themeName: themeName.trim() || 'TabChroma Theme',
    createdAt: new Date().toISOString(),
    baseThemeMode: config.baseThemeMode || 'custom',
    customBaseFrameColor: config.customBaseFrameColor || '#1c1b22',
    customBaseToolbarColor: config.customBaseToolbarColor || '#2b2a33',
    customBaseTextColor: config.customBaseTextColor || '#fbfbfe',
    defaultColor: config.defaultColor || '#37adff',
    defaultContainerColor: config.defaultContainerColor || 'blue',
    activeTabOpacity: config.activeTabOpacity ?? 0.35,
    enableFaviconContrastHalo: config.enableFaviconContrastHalo !== false,
    hybridWindowBehavior: config.hybridWindowBehavior || 'static_window',
    hybridTabIndicatorStyle: config.hybridTabIndicatorStyle || 'accent_line_and_fill',
    hybridIndicatorColor: config.hybridIndicatorColor,
  };

  const exportJsonString = JSON.stringify(currentThemePackage, null, 2);

  const handleDownloadJson = () => {
    const slug = (themeName.trim() || 'theme')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');
    const filename = `tabchroma-${slug}.json`;

    const blob = new Blob([exportJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(exportJsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = exportJsonString;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // --- Team Presets Operations ---
  const showNotice = (msg: string) => {
    setPresetNotice(msg);
    setTimeout(() => setPresetNotice(null), 3500);
  };

  const handleStartNewPreset = () => {
    setPresetForm({
      id: `custom-theme-${Date.now()}`,
      name: themeName ? `${themeName} Preset` : 'Neues Team-Preset',
      description: 'Angepasstes Farbschema für unser Team',
      frame: config.customBaseFrameColor || '#1c1b22',
      toolbar: config.customBaseToolbarColor || '#2b2a33',
      text: config.customBaseTextColor || '#fbfbfe',
      defaultColor: config.defaultColor || '#37adff',
      defaultContainerColor: config.defaultContainerColor || 'blue',
      activeTabOpacity: config.activeTabOpacity ?? 0.35,
      hybridWindowBehavior: config.hybridWindowBehavior || 'static_window',
      hybridTabIndicatorStyle: config.hybridTabIndicatorStyle || 'accent_line_and_fill',
      isCustom: true,
      date: new Date().toLocaleDateString(),
    });
    setIsCreatingNewPreset(true);
    setEditingPresetId(null);
  };

  const handleStartEditPreset = (preset: SavedTheme) => {
    setPresetForm({
      ...preset,
      isCustom: true,
    });
    setEditingPresetId(preset.id);
    setIsCreatingNewPreset(false);
  };

  const handleSavePresetForm = () => {
    if (!presetForm.name.trim()) return;
    const isNew = isCreatingNewPreset || !userSavedThemes.some((u) => u.id === presetForm.id);
    
    let updated: SavedTheme[];
    if (isNew) {
      const newEntry: SavedTheme = {
        ...presetForm,
        id: presetForm.id || `custom-theme-${Date.now()}`,
        isCustom: true,
        date: new Date().toLocaleDateString(),
      };
      updated = [...userSavedThemes, newEntry];
      showNotice(`Team-Preset "${presetForm.name}" erfolgreich erstellt!`);
    } else {
      updated = userSavedThemes.map((u) => (u.id === presetForm.id ? { ...presetForm, isCustom: true } : u));
      if (!userSavedThemes.some((u) => u.id === presetForm.id)) {
        updated.push({ ...presetForm, isCustom: true });
      }
      showNotice(`Änderungen an "${presetForm.name}" gespeichert!`);
    }

    if (onUpdateSavedThemes) {
      onUpdateSavedThemes(updated);
    }
    setEditingPresetId(null);
    setIsCreatingNewPreset(false);
  };

  const handleDuplicatePreset = (preset: SavedTheme) => {
    const dup: SavedTheme = {
      ...preset,
      id: `custom-theme-${Date.now()}`,
      name: `${preset.name} (Kopie)`,
      isCustom: true,
      date: new Date().toLocaleDateString(),
    };
    const updated = [...userSavedThemes, dup];
    if (onUpdateSavedThemes) {
      onUpdateSavedThemes(updated);
    }
    showNotice(`Preset als "${dup.name}" dupliziert!`);
  };

  const handleDeletePreset = (presetId: string) => {
    const updated = userSavedThemes.filter((u) => u.id !== presetId);
    if (onUpdateSavedThemes) {
      onUpdateSavedThemes(updated);
    }
    showNotice('Preset entfernt!');
    if (editingPresetId === presetId) {
      setEditingPresetId(null);
    }
  };

  const handleResetToDefaultPresets = () => {
    if (window.confirm('Möchten Sie alle benutzerdefinierten Team-Presets zurücksetzen?')) {
      if (onUpdateSavedThemes) {
        onUpdateSavedThemes([]);
      }
      setEditingPresetId(null);
      setIsCreatingNewPreset(false);
      showNotice('Standard-Presets wiederhergestellt!');
    }
  };

  const handleExportAllPresetsJson = () => {
    const exportBundle = {
      format: 'tabchroma-presets-bundle',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      presetsCount: allPresets.length,
      presets: allPresets,
    };
    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabchroma-team-presets-bundle.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotice(`${allPresets.length} Team-Presets als JSON exportiert!`);
  };

  const handleImportPresetsBundle = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      let incomingList: any[] = [];
      if (Array.isArray(parsed)) {
        incomingList = parsed;
      } else if (parsed.presets && Array.isArray(parsed.presets)) {
        incomingList = parsed.presets;
      } else if (parsed.savedThemes && Array.isArray(parsed.savedThemes)) {
        incomingList = parsed.savedThemes;
      } else {
        throw new Error('Ungültiges Presets-Format. Erwartet Array oder { presets: [...] }');
      }

      const validated: SavedTheme[] = incomingList.map((p, idx) => ({
        id: p.id || `imported-theme-${Date.now()}-${idx}`,
        name: p.name || `Importiertes Theme ${idx + 1}`,
        description: p.description || 'Importiertes Team-Preset',
        frame: p.frame || '#1c1b22',
        toolbar: p.toolbar || '#2b2a33',
        text: p.text || '#fbfbfe',
        defaultColor: p.defaultColor || '#37adff',
        defaultContainerColor: p.defaultContainerColor || 'blue',
        activeTabOpacity: typeof p.opacity === 'number' ? p.opacity : (typeof p.activeTabOpacity === 'number' ? p.activeTabOpacity : 0.35),
        hybridWindowBehavior: p.hybridWindowBehavior || 'static_window',
        hybridTabIndicatorStyle: p.hybridTabIndicatorStyle || 'accent_line_and_fill',
        isCustom: true,
        date: new Date().toLocaleDateString(),
      }));

      const existingIds = new Set(userSavedThemes.map((u) => u.id));
      const merged = [...userSavedThemes];
      for (const item of validated) {
        if (existingIds.has(item.id)) {
          const idx = merged.findIndex((m) => m.id === item.id);
          merged[idx] = item;
        } else {
          merged.push(item);
        }
      }

      if (onUpdateSavedThemes) {
        onUpdateSavedThemes(merged);
      }
      setShowPresetsJsonModal(false);
      setPresetsBundleText('');
      showNotice(`${validated.length} Presets erfolgreich importiert!`);
    } catch (e: any) {
      alert(`Fehler beim Importieren der Presets: ${e.message}`);
    }
  };

  // Robust Theme Parser: supports TabChromaThemePackage, Firefox theme JSON, or raw color objects
  const parseThemeInput = (raw: string) => {
    setImportError(null);
    setParsedTheme(null);
    setParsedMeta(null);

    if (!raw.trim()) return;

    try {
      const data = JSON.parse(raw);

      let frame = '#1c1b22';
      let toolbar = '#2b2a33';
      let text = '#fbfbfe';
      let defColor = config.defaultColor || '#37adff';
      let defContainer: FirefoxContainerColor = config.defaultContainerColor || 'blue';
      let opacity = config.activeTabOpacity ?? 0.35;
      let halo = config.enableFaviconContrastHalo !== false;
      let mode: BaseThemeMode = 'custom';
      let name = '';
      let source = 'TabChroma JSON';
      let hybridWin: HybridWindowBehavior = config.hybridWindowBehavior || 'static_window';
      let hybridStyle: HybridTabIndicatorStyle = config.hybridTabIndicatorStyle || 'accent_line_and_fill';
      let hybridColor = config.hybridIndicatorColor;

      // 1. TabChroma Theme format
      if (data.format === 'tabchroma-theme' || data.customBaseFrameColor || data.customBaseToolbarColor) {
        if (data.customBaseFrameColor) frame = data.customBaseFrameColor;
        if (data.customBaseToolbarColor) toolbar = data.customBaseToolbarColor;
        if (data.customBaseTextColor) text = data.customBaseTextColor;
        if (data.defaultColor) defColor = data.defaultColor;
        if (data.defaultContainerColor) defContainer = data.defaultContainerColor;
        if (typeof data.activeTabOpacity === 'number') opacity = data.activeTabOpacity;
        if (typeof data.enableFaviconContrastHalo === 'boolean') halo = data.enableFaviconContrastHalo;
        if (data.baseThemeMode) mode = data.baseThemeMode;
        if (data.hybridWindowBehavior) hybridWin = data.hybridWindowBehavior;
        if (data.hybridTabIndicatorStyle) hybridStyle = data.hybridTabIndicatorStyle;
        if (data.hybridIndicatorColor) hybridColor = data.hybridIndicatorColor;
        name = data.themeName || data.name || 'TabChroma Theme';
        source = 'TabChroma Theme Package';
      }
      // 2. Firefox WebExtension theme manifest / colors object
      else if (data.colors || (data.theme && data.theme.colors)) {
        const colors = data.colors || data.theme.colors;
        if (colors.frame) frame = colors.frame;
        if (colors.toolbar) toolbar = colors.toolbar;
        if (colors.toolbar_text || colors.tab_background_text || colors.icons) {
          text = colors.toolbar_text || colors.tab_background_text || colors.icons;
        }
        if (colors.tab_line) defColor = colors.tab_line;
        name = data.name || (data.manifest && data.manifest.name) || 'Firefox Theme';
        source = 'Firefox Theme Format';
      }
      // 3. Simple color mapping: { frame, toolbar, text, tabColor }
      else if (data.frame || data.toolbar || data.text || data.textColor) {
        if (data.frame) frame = data.frame;
        if (data.toolbar) toolbar = data.toolbar;
        if (data.text || data.textColor) text = data.text || data.textColor;
        if (data.tabColor || data.defaultColor) defColor = data.tabColor || data.defaultColor;
        if (typeof data.opacity === 'number') opacity = data.opacity;
        name = data.name || 'Benutzerdefiniertes Theme';
        source = 'Farb-Objekt';
      } else {
        throw new Error('Kein gültiges Theme-Format erkannt. Erwartet wird ein TabChroma-Theme oder Firefox-Farben (Frame, Toolbar, Text).');
      }

      // Validate hex codes
      const sanitizeHex = (val: string, fallback: string) => {
        if (!val || typeof val !== 'string') return fallback;
        let c = val.trim();
        if (!c.startsWith('#') && /^[0-9A-Fa-f]{3,8}$/.test(c)) c = '#' + c;
        return c;
      };

      frame = sanitizeHex(frame, '#1c1b22');
      toolbar = sanitizeHex(toolbar, '#2b2a33');
      text = sanitizeHex(text, '#fbfbfe');
      defColor = sanitizeHex(defColor, '#37adff');
      if (hybridColor) hybridColor = sanitizeHex(hybridColor, defColor);

      setParsedTheme({
        baseThemeMode: mode,
        customBaseFrameColor: frame,
        customBaseToolbarColor: toolbar,
        customBaseTextColor: text,
        defaultColor: defColor,
        defaultContainerColor: defContainer,
        activeTabOpacity: opacity,
        enableFaviconContrastHalo: halo,
        hybridWindowBehavior: hybridWin,
        hybridTabIndicatorStyle: hybridStyle,
        hybridIndicatorColor: hybridColor,
      });

      setParsedMeta({ name, source });
    } catch (err: any) {
      setImportError(err.message || 'Ungültiges JSON-Format. Bitte prüfen Sie den eingefügten Code.');
      setParsedTheme(null);
      setParsedMeta(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setImportJsonText(content);
      parseThemeInput(content);
    };
    reader.onerror = () => {
      setImportError('Datei konnte nicht gelesen werden.');
    };
    reader.readAsText(file);
  };

  const handleApplyParsedTheme = () => {
    if (!parsedTheme) return;
    onApplyTheme(parsedTheme);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full overflow-hidden flex flex-col max-h-[92vh] transition-all duration-200 ${
          activeTab === 'presets' ? 'max-w-5xl' : 'max-w-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Firefox Theme importieren &amp; exportieren</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  Für Kollegen &amp; Teams
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Geben Sie Ihren Kollegen nur das visuelle Farbschema mit – ohne private Regeln oder URLs!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle Navigation */}
        <div className="flex border-b border-slate-200 px-5 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'presets'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Beliebte Team-Presets</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'export'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Theme exportieren &amp; teilen</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'import'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Theme importieren / einfügen</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 0: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              {/* Notice Banner */}
              {presetNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-2xs">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{presetNotice}</span>
                  </span>
                  <button type="button" onClick={() => setPresetNotice(null)} className="text-emerald-600 hover:text-emerald-900">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Action Toolbar for Team Presets */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-purple-50/70 rounded-xl border border-purple-200">
                <div>
                  <div className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-600" />
                    <span>Team-Presets Verwaltung</span>
                    <span className="text-[10px] font-mono text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200 font-bold ml-1">
                      {allPresets.length} Vorlagen
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-700 mt-0.5">
                    Erstellen, bearbeiten, duplizieren oder teilen Sie Farbdesigns für das gesamte Team.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleStartNewPreset}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-2xs"
                    title="Aktuell im Studio eingestelltes Theme als neues Preset sichern"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Preset hinzufügen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPresetsJsonModal(!showPresetsJsonModal)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 font-semibold text-xs transition-colors shadow-2xs"
                    title="Presets als JSON-Paket importieren"
                  >
                    <Upload className="w-3 h-3 text-purple-600" />
                    <span>Importieren</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportAllPresetsJson}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 font-semibold text-xs transition-colors shadow-2xs"
                    title="Alle Team-Presets als JSON-Datei für Kollegen herunterladen"
                  >
                    <Download className="w-3 h-3 text-purple-600" />
                    <span>Exportieren</span>
                  </button>

                  {userSavedThemes.length > 0 && (
                    <button
                      type="button"
                      onClick={handleResetToDefaultPresets}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors"
                      title="Auf Standard-Presets zurücksetzen"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Presets Bundle Import Overlay / Box */}
              {showPresetsJsonModal && (
                <div className="p-3.5 rounded-xl border border-purple-300 bg-purple-50/90 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-950">
                    <span className="flex items-center gap-1.5">
                      <FileJson className="w-3.5 h-3.5 text-purple-600" />
                      <span>Team-Presets JSON-Paket einfügen:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPresetsJsonModal(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={presetsBundleText}
                    onChange={(e) => setPresetsBundleText(e.target.value)}
                    placeholder='Fügen Sie hier das exportierte JSON-Bundle von Kollegen ein (z. B. { "presets": [...] } oder Array)...'
                    rows={4}
                    className="w-full p-2 text-xs font-mono rounded-lg border border-purple-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPresetsJsonModal(false)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200/50 rounded-md"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => handleImportPresetsBundle(presetsBundleText)}
                      disabled={!presetsBundleText.trim()}
                      className="px-3 py-1 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-md flex items-center gap-1 shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Presets einpflegen</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Editor / Creator Card */}
              {(isCreatingNewPreset || editingPresetId !== null) && (
                <div className="p-4 rounded-xl border-2 border-purple-400 bg-white shadow-md space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                      <span className="font-bold text-xs text-purple-950">
                        {isCreatingNewPreset ? '➕ Neues Team-Preset erstellen' : `✏️ Preset "${presetForm.name}" bearbeiten`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewPreset(false);
                        setEditingPresetId(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Name */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Preset-Name:</label>
                      <input
                        type="text"
                        value={presetForm.name}
                        onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                        placeholder="z. B. Firma Prod Dark"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Beschreibung:</label>
                      <input
                        type="text"
                        value={presetForm.description || ''}
                        onChange={(e) => setPresetForm({ ...presetForm, description: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                        placeholder="z. B. Für DevOps & Staging Umgebungen"
                      />
                    </div>
                  </div>

                  {/* Colors Grid */}
                  <div>
                    <label className="block font-bold text-slate-700 text-xs mb-1.5">Theme-Farben anpassen:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Frame */}
                      <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 block">Rahmen (Frame)</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={presetForm.frame}
                            onChange={(e) => setPresetForm({ ...presetForm, frame: e.target.value })}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                          />
                          <input
                            type="text"
                            value={presetForm.frame}
                            onChange={(e) => setPresetForm({ ...presetForm, frame: e.target.value })}
                            className="w-full text-[10px] font-mono px-1 py-0.5 rounded border border-slate-300 bg-white"
                          />
                        </div>
                      </div>

                      {/* Toolbar */}
                      <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 block">Toolbar (Hintergrund)</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={presetForm.toolbar}
                            onChange={(e) => setPresetForm({ ...presetForm, toolbar: e.target.value })}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                          />
                          <input
                            type="text"
                            value={presetForm.toolbar}
                            onChange={(e) => setPresetForm({ ...presetForm, toolbar: e.target.value })}
                            className="w-full text-[10px] font-mono px-1 py-0.5 rounded border border-slate-300 bg-white"
                          />
                        </div>
                      </div>

                      {/* Text */}
                      <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 block">Schrift (Text)</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={presetForm.text}
                            onChange={(e) => setPresetForm({ ...presetForm, text: e.target.value })}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                          />
                          <input
                            type="text"
                            value={presetForm.text}
                            onChange={(e) => setPresetForm({ ...presetForm, text: e.target.value })}
                            className="w-full text-[10px] font-mono px-1 py-0.5 rounded border border-slate-300 bg-white"
                          />
                        </div>
                      </div>

                      {/* Default Accent Color */}
                      <div className="p-2 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 block">Akzentfarbe</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={presetForm.defaultColor || '#37adff'}
                            onChange={(e) => setPresetForm({ ...presetForm, defaultColor: e.target.value })}
                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                          />
                          <input
                            type="text"
                            value={presetForm.defaultColor || '#37adff'}
                            onChange={(e) => setPresetForm({ ...presetForm, defaultColor: e.target.value })}
                            className="w-full text-[10px] font-mono px-1 py-0.5 rounded border border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Container Color & Hybrid Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <label className="block font-bold text-slate-700 text-[11px] mb-1">Standard Container-Farbe:</label>
                      <select
                        value={presetForm.defaultContainerColor || 'blue'}
                        onChange={(e) => setPresetForm({ ...presetForm, defaultContainerColor: e.target.value as FirefoxContainerColor })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        {Object.entries(FIREFOX_CONTAINER_COLORS).map(([key, info]) => (
                          <option key={key} value={key}>
                            {info.name} ({key})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 text-[11px] mb-1">Hybrid-Fenster Verhalten:</label>
                      <select
                        value={presetForm.hybridWindowBehavior || 'static_window'}
                        onChange={(e) => setPresetForm({ ...presetForm, hybridWindowBehavior: e.target.value as HybridWindowBehavior })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        <option value="static_window">Statisches Fenster (Kein Flackern)</option>
                        <option value="dynamic_toolbar">Dynamische Toolbar-Anpassung</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 text-[11px] mb-1">Tab-Indikator Stil:</label>
                      <select
                        value={presetForm.hybridTabIndicatorStyle || 'accent_line_and_fill'}
                        onChange={(e) => setPresetForm({ ...presetForm, hybridTabIndicatorStyle: e.target.value as HybridTabIndicatorStyle })}
                        className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        <option value="accent_line_and_fill">Akzentlinie + Transparenz</option>
                        <option value="line_only">Nur Akzentlinie (Proton)</option>
                        <option value="glow_border">Sanfter Glow-Rahmen</option>
                      </select>
                    </div>
                  </div>

                  {/* Live Mini Preview of Preset being edited */}
                  <div
                    className="rounded-lg p-2 text-xs shadow-inner transition-colors"
                    style={{ backgroundColor: presetForm.frame }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div
                        className="px-2 py-0.5 rounded-t text-[10px] font-bold border-t-2"
                        style={{
                          backgroundColor: presetForm.toolbar,
                          color: presetForm.text,
                          borderTopColor: presetForm.defaultColor,
                        }}
                      >
                        🦊 Vorschau Tab
                      </div>
                      <div className="text-[10px] opacity-60" style={{ color: presetForm.text }}>
                        Inaktiv
                      </div>
                    </div>
                    <div
                      className="rounded px-2 py-0.5 text-[10px] font-mono truncate"
                      style={{
                        backgroundColor: presetForm.toolbar,
                        color: presetForm.text,
                      }}
                    >
                      https://team.portal.intern
                    </div>
                  </div>

                  {/* Form Footer Buttons */}
                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewPreset(false);
                        setEditingPresetId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePresetForm}
                      className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Preset speichern</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Grid of All Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {allPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`p-3.5 rounded-xl border transition-all space-y-2.5 group shadow-2xs hover:shadow-xs flex flex-col justify-between ${
                      preset.isCustom
                        ? 'border-purple-300 bg-purple-50/20 hover:bg-white hover:border-purple-500'
                        : 'border-slate-200 hover:border-purple-400 bg-slate-50/50 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-xs text-slate-900 group-hover:text-purple-900 truncate">
                            {preset.name}
                          </span>
                          {preset.isCustom && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                              Benutzerdefiniert
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: preset.frame }}
                            title={`Rahmen: ${preset.frame}`}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: preset.toolbar }}
                            title={`Toolbar: ${preset.toolbar}`}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: preset.defaultColor }}
                            title={`Akzent: ${preset.defaultColor}`}
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {preset.description || 'Team-Farbschema'}
                      </p>
                    </div>

                    {/* Mini simulated browser preview */}
                    <div
                      className="rounded-lg p-2 text-xs shadow-inner"
                      style={{ backgroundColor: preset.frame }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div
                          className="px-2 py-0.5 rounded-t text-[10px] font-bold border-t-2"
                          style={{
                            backgroundColor: preset.toolbar,
                            color: preset.text,
                            borderTopColor: preset.defaultColor,
                          }}
                        >
                          🦊 Tab
                        </div>
                        <div
                          className="text-[10px] opacity-60"
                          style={{ color: preset.text }}
                        >
                          Inaktiv
                        </div>
                      </div>
                      <div
                        className="rounded px-2 py-0.5 text-[10px] font-mono truncate"
                        style={{
                          backgroundColor: preset.toolbar,
                          color: preset.text,
                        }}
                      >
                        https://firma.internal
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="space-y-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onApplyTheme({
                            baseThemeMode: 'custom',
                            customBaseFrameColor: preset.frame,
                            customBaseToolbarColor: preset.toolbar,
                            customBaseTextColor: preset.text,
                            defaultColor: preset.defaultColor,
                            defaultContainerColor: preset.defaultContainerColor,
                            activeTabOpacity: preset.activeTabOpacity,
                            hybridWindowBehavior: preset.hybridWindowBehavior,
                            hybridTabIndicatorStyle: preset.hybridTabIndicatorStyle,
                          });
                          onClose();
                        }}
                        className="w-full py-1.5 px-3 rounded-lg bg-white group-hover:bg-purple-600 text-slate-700 group-hover:text-white border border-slate-300 group-hover:border-purple-600 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Dieses Theme anwenden</span>
                      </button>

                      {/* Management Tools: Edit, Duplicate, Delete */}
                      <div className="flex items-center justify-between gap-1 text-[11px] px-1 text-slate-500">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditPreset(preset)}
                            className="flex items-center gap-1 hover:text-purple-700 hover:underline font-medium"
                            title="Preset Farben und Einstellungen bearbeiten"
                          >
                            <Edit3 className="w-3 h-3 text-purple-600" />
                            <span>Bearbeiten</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicatePreset(preset)}
                            className="flex items-center gap-1 hover:text-purple-700 hover:underline font-medium"
                            title="Preset kopieren und anpassen"
                          >
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Duplizieren</span>
                          </button>
                        </div>

                        {preset.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeletePreset(preset.id)}
                            className="text-slate-400 hover:text-red-600 flex items-center gap-0.5"
                            title="Preset entfernen"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Löschen</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Theme Name input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Theme-Bezeichnung (Optional):
                </label>
                <input
                  type="text"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  placeholder="z. B. Corporate Dark Theme"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              {/* Visual preview of current theme to be exported */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-purple-600" />
                    <span>Enthaltene Theme-Farben (Vorschau):</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Modus: {config.baseThemeMode || 'custom'}
                  </span>
                </div>

                {/* Simulated Firefox Mini Browser */}
                <div 
                  className="rounded-lg p-2.5 text-xs shadow-inner transition-colors"
                  style={{ backgroundColor: config.customBaseFrameColor || '#1c1b22' }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div 
                      className="px-3 py-1 rounded-t-md text-xs font-semibold flex items-center gap-1.5 border-t-2"
                      style={{
                        backgroundColor: config.customBaseToolbarColor || '#2b2a33',
                        color: config.customBaseTextColor || '#fbfbfe',
                        borderTopColor: config.defaultColor || '#37adff',
                      }}
                    >
                      <span>🦊</span>
                      <span>Aktiver Tab</span>
                    </div>
                    <div 
                      className="px-2 py-1 text-xs opacity-60 flex items-center gap-1"
                      style={{ color: config.customBaseTextColor || '#fbfbfe' }}
                    >
                      <span>🌐</span>
                      <span>Inaktiver Tab</span>
                    </div>
                  </div>

                  <div 
                    className="rounded-md p-1.5 flex items-center gap-2 text-xs"
                    style={{
                      backgroundColor: config.customBaseToolbarColor || '#2b2a33',
                      color: config.customBaseTextColor || '#fbfbfe',
                    }}
                  >
                    <span className="opacity-75 text-xs">‹ › ↻</span>
                    <div 
                      className="flex-1 px-2 py-0.5 rounded text-[11px] font-mono border"
                      style={{
                        backgroundColor: `${config.customBaseFrameColor || '#1c1b22'}88`,
                        borderColor: `${config.customBaseTextColor || '#fbfbfe'}22`,
                        color: config.customBaseTextColor || '#fbfbfe',
                      }}
                    >
                      https://portal.firma.de
                    </div>
                  </div>
                </div>

                {/* Color swatches strip */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-md border border-slate-200">
                    <span 
                      className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                      style={{ backgroundColor: config.customBaseFrameColor || '#1c1b22' }} 
                    />
                    <div className="truncate">
                      <div className="text-[10px] text-slate-400">Rahmen</div>
                      <div className="font-mono font-bold text-slate-800">{config.customBaseFrameColor || '#1c1b22'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-md border border-slate-200">
                    <span 
                      className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                      style={{ backgroundColor: config.customBaseToolbarColor || '#2b2a33' }} 
                    />
                    <div className="truncate">
                      <div className="text-[10px] text-slate-400">Toolbar</div>
                      <div className="font-mono font-bold text-slate-800">{config.customBaseToolbarColor || '#2b2a33'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-md border border-slate-200">
                    <span 
                      className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                      style={{ backgroundColor: config.customBaseTextColor || '#fbfbfe' }} 
                    />
                    <div className="truncate">
                      <div className="text-[10px] text-slate-400">Schrift</div>
                      <div className="font-mono font-bold text-slate-800">{config.customBaseTextColor || '#fbfbfe'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Download File vs Copy Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Theme als .json herunterladen</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Code in Zwischenablage kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-purple-600" />
                      <span>Theme-Code kopieren (für Chat/Mail)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Collapsible JSON Preview */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Reiner Theme-Code (zum schnellen Versenden):</span>
                  <span className="font-mono text-[10px]">tabchroma-theme.json</span>
                </div>
                <pre className="p-2.5 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto max-h-32 border border-slate-800">
                  {exportJsonString}
                </pre>
              </div>

              {/* Info notice */}
              <div className="p-3 bg-purple-50/70 border border-purple-200/70 rounded-xl text-xs text-purple-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Vorteil des isolierten Theme-Exports:</span>
                </div>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  Ihre Kollegen erhalten exakt dieselbe Optik (Farben, Kontraste &amp; Deckkraft), ohne dass Ihre privaten Web-Adressen, Regeln oder Container-Konfigurationen übertragen oder überschrieben werden.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* File upload drag-and-drop area */}
              <div className="border-2 border-dashed border-slate-300 hover:border-purple-400 rounded-xl p-4 text-center bg-slate-50/60 transition-colors">
                <input
                  type="file"
                  id="theme-file-input"
                  accept=".json,application/json,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="theme-file-input" className="cursor-pointer block space-y-1">
                  <FileJson className="w-7 h-7 mx-auto text-purple-600" />
                  <div className="text-xs font-bold text-slate-800">
                    Theme-Datei (.json) auswählen oder hier ablegen
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Akzeptiert TabChroma-Theme-Dateien sowie Firefox Theme-Farben
                  </div>
                </label>
              </div>

              {/* Direct Paste textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <label htmlFor="theme-paste-area">Oder Theme-Code hier einfügen:</label>
                  {importJsonText && (
                    <button
                      type="button"
                      onClick={() => {
                        setImportJsonText('');
                        setParsedTheme(null);
                        setImportError(null);
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-600 font-normal"
                    >
                      Leeren
                    </button>
                  )}
                </div>
                <textarea
                  id="theme-paste-area"
                  value={importJsonText}
                  onChange={(e) => {
                    setImportJsonText(e.target.value);
                    parseThemeInput(e.target.value);
                  }}
                  placeholder='Fügen Sie hier den JSON-Code eines Kollegen ein, z. B.:
{
  "format": "tabchroma-theme",
  "customBaseFrameColor": "#003D8F",
  "customBaseToolbarColor": "#003DAF",
  "customBaseTextColor": "#F8FAFC"
}'
                  rows={4}
                  className="w-full p-2.5 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              {/* Error message */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Preview of successfully parsed theme */}
              {parsedTheme && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-emerald-900">
                        Theme erfolgreich erkannt: {parsedMeta?.name || 'Neues Theme'}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      {parsedMeta?.source}
                    </span>
                  </div>

                  {/* Visual Preview */}
                  <div 
                    className="rounded-lg p-2.5 text-xs shadow-inner transition-colors"
                    style={{ backgroundColor: parsedTheme.customBaseFrameColor || '#1c1b22' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div 
                        className="px-3 py-1 rounded-t-md text-xs font-semibold flex items-center gap-1.5 border-t-2"
                        style={{
                          backgroundColor: parsedTheme.customBaseToolbarColor || '#2b2a33',
                          color: parsedTheme.customBaseTextColor || '#fbfbfe',
                          borderTopColor: parsedTheme.defaultColor || '#37adff',
                        }}
                      >
                        <span>🦊</span>
                        <span>Aktiver Tab (Vorschau)</span>
                      </div>
                      <div 
                        className="px-2 py-1 text-xs opacity-60 flex items-center gap-1"
                        style={{ color: parsedTheme.customBaseTextColor || '#fbfbfe' }}
                      >
                        <span>🌐</span>
                        <span>Inaktiver Tab</span>
                      </div>
                    </div>

                    <div 
                      className="rounded-md p-1.5 flex items-center gap-2 text-xs"
                      style={{
                        backgroundColor: parsedTheme.customBaseToolbarColor || '#2b2a33',
                        color: parsedTheme.customBaseTextColor || '#fbfbfe',
                      }}
                    >
                      <span className="opacity-75 text-xs">‹ › ↻</span>
                      <div 
                        className="flex-1 px-2 py-0.5 rounded text-[11px] font-mono border"
                        style={{
                          backgroundColor: `${parsedTheme.customBaseFrameColor || '#1c1b22'}88`,
                          borderColor: `${parsedTheme.customBaseTextColor || '#fbfbfe'}22`,
                          color: parsedTheme.customBaseTextColor || '#fbfbfe',
                        }}
                      >
                        https://meine-domain.com
                      </div>
                    </div>
                  </div>

                  {/* Swatches strip */}
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-md border border-emerald-200">
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" 
                        style={{ backgroundColor: parsedTheme.customBaseFrameColor || '#1c1b22' }} 
                      />
                      <div className="truncate">
                        <span className="text-[10px] text-slate-400 block leading-none">Rahmen</span>
                        <span className="font-mono font-bold text-slate-800">{parsedTheme.customBaseFrameColor}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-md border border-emerald-200">
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" 
                        style={{ backgroundColor: parsedTheme.customBaseToolbarColor || '#2b2a33' }} 
                      />
                      <div className="truncate">
                        <span className="text-[10px] text-slate-400 block leading-none">Toolbar</span>
                        <span className="font-mono font-bold text-slate-800">{parsedTheme.customBaseToolbarColor}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-md border border-emerald-200">
                      <span 
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" 
                        style={{ backgroundColor: parsedTheme.customBaseTextColor || '#fbfbfe' }} 
                      />
                      <div className="truncate">
                        <span className="text-[10px] text-slate-400 block leading-none">Schrift</span>
                        <span className="font-mono font-bold text-slate-800">{parsedTheme.customBaseTextColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <button
                    type="button"
                    onClick={handleApplyParsedTheme}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Dieses Theme jetzt anwenden &amp; speichern</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            TabChroma · Theme Exchange Format v1.0
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
