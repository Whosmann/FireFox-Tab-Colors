import React from 'react';
import { Download, BookOpen, Layers, Sliders, Code2 } from 'lucide-react';

interface HeaderProps {
  activeTab: 'simulator' | 'rules' | 'code' | 'guide';
  setActiveTab: (tab: 'simulator' | 'rules' | 'code' | 'guide') => void;
  onExportZip: () => void;
  isExporting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onExportZip,
  isExporting,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 font-bold text-base shadow-sm">
            🦊
          </div>
          <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            TabChroma
            <span className="text-xs font-normal text-slate-400 hidden sm:inline">
              · Firefox URL Color Studio
            </span>
          </span>
        </div>

        {/* Zone 2: Clean 4 nav links with active state */}
        <nav className="flex items-center gap-1 sm:gap-2">
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
            <span className="hidden md:inline">Install Guide</span>
            <span className="md:hidden">Guide</span>
          </button>
        </nav>

        {/* Zone 3: Primary action button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExportZip}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 rounded-lg shadow-sm transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Packaging...' : 'Export Add-on (.zip)'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
