import React, { useState } from 'react';
import { 
  Download, 
  Terminal, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  FolderArchive,
  Copy,
  Check,
  MousePointer,
  HelpCircle,
  FileCheck2,
  Settings
} from 'lucide-react';
import { ExtensionConfig } from '../types/extension';
import { downloadPoliciesJson } from '../utils/extensionGenerator';

interface InstallGuideViewProps {
  onExportZip: () => void;
  onExportXpi: () => void;
}

export const InstallGuideView: React.FC<InstallGuideViewProps> = ({ onExportZip, onExportXpi }) => {
  const [activeMethod, setActiveMethod] = useState<'xpi' | 'amo' | 'dev' | 'policies' | 'debugging'>('xpi');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Intro Hero */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-600">
              <span>Firefox Installation Guide</span>
              <span>·</span>
              <span>Direct Add-on Setup</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              How to Make TabChroma Installable by Firefox
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Firefox installs extensions using the <strong>.xpi</strong> package format (XPInstall). Choose the installation method that fits your Firefox version and requirements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={onExportXpi}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 active:bg-orange-700 rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download TabChroma (.xpi)</span>
            </button>
            <button
              onClick={onExportZip}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <span>Download (.zip)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Method Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveMethod('xpi')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
            activeMethod === 'xpi'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5 text-orange-600" />
          <span>1. Direct .xpi Install (Standard)</span>
        </button>

        <button
          onClick={() => setActiveMethod('dev')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
            activeMethod === 'dev'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-purple-600" />
          <span>2. Dev Edition / Nightly (1-Click Permanent)</span>
        </button>

        <button
          onClick={() => setActiveMethod('amo')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
            activeMethod === 'amo'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>3. Free 1-Min Mozilla Sign (Release Firefox)</span>
        </button>

        <button
          onClick={() => setActiveMethod('debugging')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
            activeMethod === 'debugging'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-sky-600" />
          <span>4. Quick Test (about:debugging)</span>
        </button>

        <button
          onClick={() => setActiveMethod('policies')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
            activeMethod === 'policies'
              ? 'bg-white text-slate-900 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>5. Enterprise (policies.json)</span>
        </button>
      </div>

      {/* Tab 1: Direct .xpi File Install */}
      {activeMethod === 'xpi' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1 rounded-md bg-orange-100 text-orange-600">📦</span>
              Direct .xpi Installation via Firefox Add-ons Manager
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              An <strong>.xpi</strong> (XPInstall) file is Firefox's official extension package format. Firefox can install it directly from file or drag-and-drop.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </div>
              <div className="font-semibold text-xs text-slate-900">Download the .xpi File</div>
              <p className="text-xs text-slate-600">
                Click <strong>"Download TabChroma (.xpi)"</strong> above to generate the package file on your computer.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold text-xs flex items-center justify-center">
                2
              </div>
              <div className="font-semibold text-xs text-slate-900">Open Add-ons Manager</div>
              <p className="text-xs text-slate-600">
                In Firefox, open a tab to <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px]">about:addons</code> or press <kbd className="px-1 py-0.5 rounded bg-slate-200 text-[10px] font-mono">Ctrl+Shift+A</kbd> (<kbd className="px-1 py-0.5 rounded bg-slate-200 text-[10px] font-mono">Cmd+Shift+A</kbd> on Mac).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold text-xs flex items-center justify-center">
                3
              </div>
              <div className="font-semibold text-xs text-slate-900">Install From File or Drag</div>
              <p className="text-xs text-slate-600">
                Click the <strong>⚙️ Gear icon</strong> at the top right of the Add-ons Manager, click <strong>"Install Add-on From File..."</strong> and select your <code className="font-mono text-[11px]">.xpi</code>. Or drag the file directly into Firefox!
              </p>
            </div>
          </div>

          {/* Drag & Drop Visual Hint */}
          <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200 flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div className="text-xs text-orange-950 space-y-1">
              <strong className="block font-semibold">Fastest Drag & Drop Method:</strong>
              <p>
                Simply drag <code className="font-mono bg-white/70 px-1 py-0.5 rounded">tabchroma-tab-color.xpi</code> from your Downloads folder and drop it into <em>any</em> open Firefox window. Firefox will show a prompt: <strong>"Add TabChroma? It requires permissions to manage tabs and containers."</strong> Click <strong>Add</strong>!
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-slate-200 text-xs space-y-2">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Did Firefox show "This add-on could not be installed because it has not been verified"?
            </div>
            <p className="text-slate-400 leading-relaxed">
              Standard release Firefox restricts direct installation of unsigned packages for security against malware. See <strong>Tab 2 (Developer Edition / Nightly)</strong> for a 10-second setting to permit unsigned extensions, or <strong>Tab 3</strong> for free, instant Mozilla automated signing!
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Dev Edition / Nightly Permanent */}
      {activeMethod === 'dev' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1 rounded-md bg-purple-100 text-purple-600">⚡</span>
              Firefox Developer Edition, Nightly, or ESR (Permanent Unsigned Install)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              If you use Firefox Developer Edition, Firefox Nightly, or Firefox ESR (Extended Support Release), you can install ANY .xpi permanently with a single config flag.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                1
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Open about:config</div>
                <p className="text-slate-600">In your URL bar, navigate to:</p>
                <div className="flex items-center gap-2 bg-slate-900 text-sky-400 px-3 py-1.5 rounded-lg font-mono text-xs w-fit">
                  <span>about:config</span>
                  <button
                    onClick={() => handleCopy('about:config', 'about-config')}
                    className="text-slate-400 hover:text-white underline text-[11px]"
                  >
                    {copiedText === 'about-config' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Search for the Signature Requirement Setting</div>
                <p className="text-slate-600">Type or paste into the search box:</p>
                <div className="flex items-center gap-2 bg-slate-900 text-amber-400 px-3 py-1.5 rounded-lg font-mono text-xs w-fit">
                  <span>xpinstall.signatures.required</span>
                  <button
                    onClick={() => handleCopy('xpinstall.signatures.required', 'pref-name')}
                    className="text-slate-400 hover:text-white underline text-[11px]"
                  >
                    {copiedText === 'pref-name' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                3
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Toggle to "false"</div>
                <p className="text-slate-600">
                  Double-click the preference so its value changes from <code className="text-rose-600 font-mono">true</code> to <code className="text-emerald-600 font-mono">false</code>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                4
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Drag & Drop tabchroma-tab-color.xpi</div>
                <p className="text-slate-600">
                  Now drag your <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">.xpi</code> into Firefox! It will install instantly and stay permanently installed across browser restarts.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Free 1-Minute Mozilla Auto-Signing */}
      {activeMethod === 'amo' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1 rounded-md bg-amber-100 text-amber-600">🌟</span>
              Free 1-Minute Mozilla Automated Self-Signing (Standard Release Firefox)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              To make your add-on installable on <strong>standard consumer release Firefox</strong> without changing any browser flags, Mozilla provides 100% free automated signing in ~60 seconds.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
            <strong>How Mozilla "Unlisted" Signing Works:</strong>
            <p>
              You don't have to publish your add-on publicly to the store. Choosing <strong>"On your own (unlisted)"</strong> triggers Mozilla's automated linter, which signs your <code className="font-mono">.xpi</code> in ~60 seconds and gives you a signed installer file that any Firefox browser in the world will install with 1 click!
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                1
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Download TabChroma (.zip)</div>
                <p className="text-slate-600">Click the button below to download the package archive:</p>
                <button
                  onClick={onExportZip}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download tabchroma-firefox-addon.zip</span>
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Visit Mozilla Add-on Developer Hub</div>
                <p className="text-slate-600">
                  Open Mozilla's submission portal (free login with your Firefox account):
                </p>
                <a
                  href="https://addons.mozilla.org/developers/addon/submit/distribution"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-semibold underline mt-1"
                >
                  <span>addons.mozilla.org/developers/addon/submit/distribution</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                3
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Select "On your own" (Unlisted)</div>
                <p className="text-slate-600">
                  Select <strong>"On your own"</strong> (distribution method). This keeps your extension private and enables instant automated verification without manual review!
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                4
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Upload & Download Signed .xpi</div>
                <p className="text-slate-600">
                  Upload your <code className="font-mono">.zip</code>. In ~60 seconds, the page displays: <strong>"Your add-on has been signed!"</strong> Download the signed <code className="font-mono text-emerald-700 font-bold">.xpi</code>.
                </p>
                <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>The signed .xpi will now install with 1-click in any standard Firefox!</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: about:debugging */}
      {activeMethod === 'debugging' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1 rounded-md bg-sky-100 text-sky-600">🔍</span>
              Instant Testing via Firefox about:debugging (No Signing Required)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Firefox has a built-in debugging workbench that allows loading any extension directly from disk in 5 seconds.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                1
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Download and Unpack TabChroma (.zip)</div>
                <p className="text-slate-600">Unzip the archive to any folder (e.g. on your Desktop).</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                2
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Navigate to Firefox Debugging</div>
                <p className="text-slate-600">Paste this address in Firefox:</p>
                <div className="flex items-center gap-2 bg-slate-900 text-sky-400 px-3 py-1.5 rounded-lg font-mono text-xs w-fit">
                  <span>about:debugging#/runtime/this-firefox</span>
                  <button
                    onClick={() => handleCopy('about:debugging#/runtime/this-firefox', 'about-debug')}
                    className="text-slate-400 hover:text-white underline text-[11px]"
                  >
                    {copiedText === 'about-debug' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                3
              </div>
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-slate-900">Click "Load Temporary Add-on..."</div>
                <p className="text-slate-600">
                  Select the <code className="font-mono font-semibold">manifest.json</code> from your unzipped folder (or select the <code className="font-mono">.zip</code> / <code className="font-mono">.xpi</code> directly).
                </p>
                <div className="mt-2 p-2 bg-sky-50 border border-sky-200 rounded text-sky-800 font-medium">
                  TabChroma activates immediately! All tabs matching your URL rules will instantly show their colors.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Enterprise policies.json */}
      {activeMethod === 'policies' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-100 text-emerald-600">🏢</span>
              Enterprise Installation via policies.json (Standard Release Firefox)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Firefox Enterprise Policy engine allows installing extensions without signing on ANY edition of Firefox by dropping a JSON configuration file into the Firefox distribution folder.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-900">1. Download policies.json</div>
              <p className="text-slate-600">
                We've pre-configured the policy file for TabChroma's extension ID (<code className="font-mono">tabchroma-tab-color@extension.local</code>):
              </p>
              <button
                onClick={() => downloadPoliciesJson()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download policies.json</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-900">2. Place inside Firefox Distribution Directory</div>
              <p className="text-slate-600">
                Create a folder named <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">distribution</code> inside your Firefox installation directory and place <code className="font-mono">policies.json</code> inside:
              </p>
              <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-slate-600">
                <li><strong>Windows:</strong> <code className="bg-white px-1 rounded">C:\Program Files\Mozilla Firefox\distribution\policies.json</code></li>
                <li><strong>macOS:</strong> <code className="bg-white px-1 rounded">/Applications/Firefox.app/Contents/Resources/distribution/policies.json</code></li>
                <li><strong>Linux:</strong> <code className="bg-white px-1 rounded">/etc/firefox/policies/policies.json</code></li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-900">3. Restart Firefox</div>
              <p className="text-slate-600">
                Firefox will automatically read the policy and permanently activate TabChroma with zero installation warnings!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
