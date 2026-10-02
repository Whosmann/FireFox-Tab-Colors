import React from 'react';
import { 
  Download, 
  Terminal, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  FolderArchive
} from 'lucide-react';

interface InstallGuideViewProps {
  onExportZip: () => void;
}

export const InstallGuideView: React.FC<InstallGuideViewProps> = ({ onExportZip }) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Intro Hero */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600">
              <span>Firefox WebExtension Guide</span>
              <span>·</span>
              <span>30 Seconds Setup</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              How to Install TabChroma in Firefox
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Firefox has built-in support for loading developer extensions directly from your filesystem without requiring store approval.
            </p>
          </div>

          <button
            onClick={onExportZip}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 rounded-xl shadow-xs transition-colors shrink-0 self-start sm:self-center"
          >
            <Download className="w-4 h-4" />
            <span>Download Firefox Add-on (.zip)</span>
          </button>
        </div>
      </div>

      {/* Step by Step Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative">
          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center mb-3 border border-sky-100">
            1
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            Download & Unzip Package
          </h3>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Click <strong>"Export Add-on (.zip)"</strong> in the top bar. Unpack the downloaded zip file into any permanent folder on your computer (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">~/Extensions/TabChroma</code>).
          </p>
          <div className="mt-3 p-2.5 bg-slate-50 rounded-lg text-xs font-mono text-slate-600 border border-slate-200">
            📁 tabchroma-firefox-addon/
            <br />
            &nbsp;&nbsp;├── manifest.json
            <br />
            &nbsp;&nbsp;├── background.js
            <br />
            &nbsp;&nbsp;├── options.html
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative">
          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center mb-3 border border-sky-100">
            2
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            Open Firefox Debugging Console
          </h3>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Open your Firefox browser, open a new tab, and enter the following address into the URL bar:
          </p>
          <div className="mt-3 flex items-center justify-between p-2.5 bg-slate-900 rounded-lg text-xs font-mono text-sky-400">
            <span>about:debugging#/runtime/this-firefox</span>
            <button
              onClick={() => navigator.clipboard.writeText('about:debugging#/runtime/this-firefox')}
              className="text-[11px] text-slate-400 hover:text-white underline ml-2"
            >
              Copy
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Tip: Press Enter to open the Firefox Internal Add-on Debugger.
          </p>
        </div>

        {/* Step 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative">
          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center mb-3 border border-sky-100">
            3
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            Click "Load Temporary Add-on..."
          </h3>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Under the <strong>Temporary Extensions</strong> section, click the <strong>"Load Temporary Add-on..."</strong> button. A system file picker will appear.
          </p>
          <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900">
            Select the <code className="font-mono font-semibold">manifest.json</code> inside your unzipped folder (or the zip file directly).
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative">
          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center mb-3 border border-sky-100">
            4
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            Your Tabs Color Automatically!
          </h3>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Firefox immediately activates TabChroma. Any time you navigate to a matching URL (e.g. AWS console, GitHub, staging domain), Firefox opens it with your custom tab color, container line, and theme accent.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Fully functional and persistent across your browsing session!</span>
          </div>
        </div>
      </div>

      {/* Advanced & Permanent Installation Section */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
          <Terminal className="w-4 h-4" />
          <span>Permanent Installation & Signing</span>
        </div>

        <h3 className="text-base font-bold text-white">
          Keeping the Add-on Permanently Active Across Restarts
        </h3>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            By default, Firefox's <code className="text-sky-300 font-mono">about:debugging</code> temporary extensions stay active until Firefox quits. If you want TabChroma installed permanently without reloading:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1.5">
              <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Option A: Firefox Developer Edition / Nightly
              </div>
              <p className="text-slate-400 text-[11px]">
                In Developer Edition or Nightly, navigate to <code className="text-sky-300 font-mono">about:config</code>, set <code className="text-sky-300 font-mono">xpinstall.signatures.required = false</code>. You can then install the unsigned .xpi permanently!
              </p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1.5">
              <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Option B: Free Self-Signing via AMO
              </div>
              <p className="text-slate-400 text-[11px]">
                Upload your zip file to <span className="text-sky-300">addons.mozilla.org (AMO)</span> Developer Hub as an "Unlisted Add-on". Mozilla automatically signs it in ~2 minutes and gives you a signed <code className="text-sky-300 font-mono">.xpi</code> that installs permanently on standard Firefox!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
