import React from 'react';
import { Download, BookOpen, Layers, Sliders, Code2, Globe, Tag } from 'lucide-react';

interface HeaderProps {
  activeTab: 'simulator' | 'rules' | 'code' | 'guide' | 'publish';
  setActiveTab: (tab: 'simulator' | 'rules' | 'code' | 'guide' | 'publish') => void;
  onExportZip: () => void;
  onExportXpi: () => void;
  isExporting?: boolean;
  currentVersion?: string;
  onOpenVersionModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onExportZip,
  onExportXpi,
  isExporting,
  currentVersion = '1.0.1',
  onOpenVersionModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark + Version Pill */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 font-bold text-base shadow-sm">
            🦊
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              TabChroma
              <span className="text-xs font-normal text-slate-400 hidden lg:inline">
                · Firefox URL Color Studio
              </span>
            </span>

            {/* Clickable Version badge for Reupload */}
            {onOpenVersionModal && (
              <button
                type="button"
                onClick={onOpenVersionModal}
                title="Klicken um Versionsnummer für Reupload zu ändern / erhöhen"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-sky-950/80 text-sky-300 border border-sky-700/60 hover:bg-sky-900 hover:text-sky-100 hover:border-sky-500 transition-colors shadow-2xs"
              >
                <Tag className="w-3 h-3 text-sky-400" />
                <span>v{currentVersion}</span>
              </button>
            )}
          </div>
        </div>

        {/* Zone 2: Clean nav links with active state */}
        <nav className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'bg-slate-800 text-sky-400 border border-slate-700'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tab Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'rules'
                ? 'bg-slate-800 text-sky-400 border border-slate-700'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>URL Rules</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'code'
                ? 'bg-slate-800 text-sky-400 border border-slate-700'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Source Code</span>
            <span className="md:hidden">Code</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'guide'
                ? 'bg-slate-800 text-sky-400 border border-slate-700'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Install in Firefox</span>
            <span className="md:hidden">Install</span>
          </button>

          <button
            onClick={() => setActiveTab('publish')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === 'publish'
                ? 'bg-slate-800 text-sky-400 border border-slate-700'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Publish to AMO</span>
            <span className="md:hidden">Publish</span>
          </button>
        </nav>

        {/* Zone 3: Primary action button with split options */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExportXpi}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 active:bg-orange-700 rounded-lg shadow-sm transition-colors whitespace-nowrap disabled:opacity-50"
            title="Download Firefox .xpi installable package"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install in Firefox (.xpi)</span>
          </button>

          <button
            onClick={onExportZip}
            disabled={isExporting}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors whitespace-nowrap disabled:opacity-50"
            title="Download source code archive"
          >
            <span>.zip</span>
          </button>
        </div>
      </div>
    </header>
  );
};
