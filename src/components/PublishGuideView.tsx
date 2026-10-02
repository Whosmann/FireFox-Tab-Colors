import React, { useState } from 'react';
import { 
  Globe, 
  ExternalLink, 
  Check, 
  Copy, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  FileText, 
  AlertCircle, 
  ArrowRight,
  Share2,
  Lock
} from 'lucide-react';
import { ExtensionConfig } from '../types/extension';

interface PublishGuideViewProps {
  config: ExtensionConfig;
  onExportZip: () => void;
  onExportXpi: () => void;
}

export const PublishGuideView: React.FC<PublishGuideViewProps> = ({
  config,
  onExportZip,
  onExportXpi,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const storeListing = {
    name: 'TabChroma - URL Tab Color & Containers',
    summary: 'Automatically color-code your Firefox tabs based on custom URL patterns, domain rules, and Firefox Containers.',
    categories: 'Tabs, Privacy & Security, Appearance',
    tags: 'tabs, tab-color, container, color-tabs, url-colors, multi-account',
    description: `🎨 TabChroma automatically colors your Firefox tabs and assigns them to native Firefox Containers based on the URLs you visit.

🌟 KEY FEATURES:
• URL-Based Tab Coloring: Match URLs using domains (e.g. github.com), wildcards (*.staging.org/*), prefixes, or full regular expressions.
• Firefox Native Containers: Automatically routes matching tabs into Firefox Contextual Identity Containers with native tab color stripes and address bar badges.
• Dynamic Window Theme Tinting: Automatically adapts active tab and toolbar accent colors to match the current site's assigned color.
• Optional Page Top Accent Line: Adds a subtle 3px colored accent line across the top of matching pages.
• Zero Data Collection: 100% private. All rules are stored locally on your device with no external network requests.
• Built-in Quick Popup: Quick-color any website with one click directly from the toolbar.

🚀 HOW TO USE:
1. Click the TabChroma toolbar icon or open Extension Options.
2. Add your favorite URL patterns and assign each a color (Red, Orange, Yellow, Green, Turquoise, Blue, Purple, or Pink).
3. Open any matching webpage — Firefox will automatically color your tabs!`,
    privacyPolicy: `TabChroma does not collect, record, track, transmit, or sell any personal data, browsing history, tabs, or visited URLs.

All user configurations, URL rules, and container color associations are stored strictly locally on your device via Firefox's standard browser.storage.local API.

The extension contains zero external trackers, analytics SDKs, advertising beacons, or telemetry. It operates entirely offline inside your browser.`,
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600">
              <span>Mozilla Add-ons (AMO) Store Submission</span>
              <span>·</span>
              <span>100% Free Publishing</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              How to Publish TabChroma to the Official Firefox Store
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Publishing on Mozilla Add-ons (AMO) is <strong>completely free</strong> (unlike Chrome Web Store, Mozilla does not charge any registration fee). Once approved, any Firefox user worldwide can install TabChroma with a single click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={onExportZip}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download AMO Package (.zip)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Flight Quality Checklist */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            AMO Pre-Flight Compliance Checklist
          </h3>
          <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
            Ready for Submission
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block">Manifest V3 Specification</strong>
              <span className="text-slate-600 text-[11px]">
                Valid Firefox Manifest V3 with Gecko-specific settings and minimum version set to 109.0.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block">High-Resolution Store Icons Included</strong>
              <span className="text-slate-600 text-[11px]">
                Included 48px, 96px, and 128px high-contrast SVG vector icons required for the public store.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block">Zero Remote Execution / Pure Local</strong>
              <span className="text-slate-600 text-[11px]">
                Complies with Mozilla policies against remote script injection. Uses purely local browser storage.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block">data_collection_permissions Specified</strong>
              <span className="text-slate-600 text-[11px]">
                Configured <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">data_collection_permissions: &#123; required: ["none"] &#125;</code> required by Mozilla AMO validation.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block">Privacy Policy Prepared</strong>
              <span className="text-slate-600 text-[11px]">
                Ready-to-copy privacy disclosure explaining that zero user data or URLs leave the device.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Step by Step Submission Guide */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900">
          6-Step Publication Walkthrough
        </h3>

        {/* Step 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center shrink-0">
            1
          </div>
          <div className="space-y-1.5 flex-1 text-xs">
            <div className="font-semibold text-slate-900 text-sm">
              Create a Free Mozilla Developer Account
            </div>
            <p className="text-slate-600">
              Unlike Google Chrome ($5 fee) or Apple ($99/year), Mozilla developer accounts are <strong>completely free</strong>. If you have a Firefox account, you can log in immediately.
            </p>
            <a
              href="https://addons.mozilla.org/developers/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-semibold underline pt-1"
            >
              <span>Visit Mozilla Add-on Developer Hub (addons.mozilla.org/developers)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center shrink-0">
            2
          </div>
          <div className="space-y-1.5 flex-1 text-xs">
            <div className="font-semibold text-slate-900 text-sm">
              Click "Submit a New Add-on" & Choose "On this site"
            </div>
            <p className="text-slate-600">
              In the Developer Hub, click <strong>"Submit a New Add-on"</strong>. On the distribution selection step, select:
            </p>
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-sky-950 font-medium">
              👉 Choose: <strong>"On this site" (Listed)</strong>
              <div className="text-[11px] text-sky-800 font-normal mt-0.5">
                This publishes TabChroma to the public Firefox Add-ons store where anyone can search for it and install it.
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center shrink-0">
            3
          </div>
          <div className="space-y-2 flex-1 text-xs">
            <div className="font-semibold text-slate-900 text-sm">
              Upload the Package Archive
            </div>
            <p className="text-slate-600">
              Download your generated package and upload the <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">.zip</code> file to Mozilla's validator:
            </p>
            <button
              onClick={onExportZip}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download tabchroma-firefox-addon.zip</span>
            </button>
            <p className="text-slate-500 text-[11px]">
              Mozilla's automated linter will analyze your manifest and scripts for security compliance.
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center shrink-0">
            4
          </div>
          <div className="space-y-3 flex-1 text-xs">
            <div className="font-semibold text-slate-900 text-sm">
              Fill in Store Listing Metadata (Copy-Paste Ready)
            </div>
            <p className="text-slate-600">
              Use these pre-written store details to complete the submission form:
            </p>

            {/* Metadata Fields */}
            <div className="space-y-3">
              {/* Name */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Add-on Name</span>
                  <button
                    onClick={() => handleCopy(storeListing.name, 'name')}
                    className="flex items-center gap-1 text-sky-600 hover:text-sky-800 text-[11px]"
                  >
                    {copiedKey === 'name' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'name' ? 'Copied!' : 'Copy Name'}</span>
                  </button>
                </div>
                <div className="font-mono text-slate-900 bg-white p-2 rounded border border-slate-200 text-xs">
                  {storeListing.name}
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Short Summary (max 250 characters)</span>
                  <button
                    onClick={() => handleCopy(storeListing.summary, 'summary')}
                    className="flex items-center gap-1 text-sky-600 hover:text-sky-800 text-[11px]"
                  >
                    {copiedKey === 'summary' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'summary' ? 'Copied!' : 'Copy Summary'}</span>
                  </button>
                </div>
                <div className="text-slate-900 bg-white p-2 rounded border border-slate-200 text-xs leading-relaxed">
                  {storeListing.summary}
                </div>
              </div>

              {/* Description */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Full Description (Markdown)</span>
                  <button
                    onClick={() => handleCopy(storeListing.description, 'description')}
                    className="flex items-center gap-1 text-sky-600 hover:text-sky-800 text-[11px]"
                  >
                    {copiedKey === 'description' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'description' ? 'Copied!' : 'Copy Description'}</span>
                  </button>
                </div>
                <pre className="font-mono text-slate-800 bg-white p-2 rounded border border-slate-200 text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {storeListing.description}
                </pre>
              </div>

              {/* Categories & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-0.5">Categories</span>
                  <span className="text-slate-900">{storeListing.categories}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-0.5">Tags</span>
                  <span className="text-slate-900">{storeListing.tags}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center shrink-0">
            5
          </div>
          <div className="space-y-2 flex-1 text-xs">
            <div className="font-semibold text-slate-900 text-sm">
              Paste the Privacy Policy (Required for Tab Permissions)
            </div>
            <p className="text-slate-600">
              Because TabChroma uses the <code className="font-mono">tabs</code> and <code className="font-mono">contextualIdentities</code> permissions to color tabs, Mozilla requires a privacy policy explaining how user data is treated:
            </p>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Mozilla-Compliant Privacy Policy</span>
                <button
                  onClick={() => handleCopy(storeListing.privacyPolicy, 'privacy')}
                  className="flex items-center gap-1 text-sky-600 hover:text-sky-800 text-[11px]"
                >
                  {copiedKey === 'privacy' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'privacy' ? 'Copied!' : 'Copy Privacy Policy'}</span>
                </button>
              </div>
              <pre className="font-mono text-slate-800 bg-white p-2 rounded border border-slate-200 text-[11px] whitespace-pre-wrap">
                {storeListing.privacyPolicy}
              </pre>
            </div>
          </div>
        </div>

        {/* Step 6 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center shrink-0">
            6
          </div>
          <div className="space-y-1.5 flex-1 text-xs">
            <div className="font-semibold text-slate-900 text-sm">
              Submit & Approval (Usually 24–48 Hours)
            </div>
            <p className="text-slate-600 leading-relaxed">
              Click <strong>"Submit"</strong>! Mozilla will process your submission. Standard WebExtensions without obfuscation or remote dependencies are typically approved within 1 to 2 days.
            </p>
            <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Once approved, your extension will have a public page at <code className="font-mono font-semibold">addons.mozilla.org/firefox/addon/tabchroma/</code> where any user can install it with 1 click!
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alternative: GitHub Releases Self-Hosting */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-800 space-y-3 text-xs">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
          <Share2 className="w-4 h-4" />
          <span>Alternative: Self-Host via GitHub Releases</span>
        </div>
        <h3 className="text-base font-bold text-white">
          Want to host it on your own GitHub or website?
        </h3>
        <p className="text-slate-300 leading-relaxed">
          You can also choose <strong>"On your own" (Unlisted)</strong> on AMO. Mozilla will sign your <code className="text-sky-300 font-mono">.xpi</code> in ~60 seconds. You can then upload that signed <code className="text-sky-300 font-mono">.xpi</code> to your GitHub Releases page! Users simply click the download link in Firefox, and Firefox will display the native installation dialog immediately.
        </p>
      </div>
    </div>
  );
};
