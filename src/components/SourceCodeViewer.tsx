import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  FolderOpen, 
  FileText, 
  Layers, 
  Globe 
} from 'lucide-react';
import { ExtensionConfig, GeneratedFile } from '../types/extension';
import { generateExtensionFiles, downloadExtensionZip } from '../utils/extensionGenerator';

interface SourceCodeViewerProps {
  config: ExtensionConfig;
  onExportZip: () => void;
  onExportXpi: () => void;
}

export const SourceCodeViewer: React.FC<SourceCodeViewerProps> = ({ config, onExportZip, onExportXpi }) => {
  const files: GeneratedFile[] = generateExtensionFiles(config);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile>(files[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.json')) return <span className="text-amber-500 font-mono text-xs font-bold">{ }</span>;
    if (fileName.endsWith('.js')) return <span className="text-yellow-400 font-mono text-xs font-bold">JS</span>;
    if (fileName.endsWith('.html')) return <Globe className="w-3.5 h-3.5 text-orange-500" />;
    if (fileName.endsWith('.md')) return <FileText className="w-3.5 h-3.5 text-sky-400" />;
    if (fileName.endsWith('.svg')) return <span className="text-pink-400 text-xs font-bold">SVG</span>;
    return <FileCode className="w-3.5 h-3.5 text-slate-400" />;
  };

  const lines = selectedFile.content.split('\n');

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-sky-600" />
            Firefox Add-on Source Code Inspector
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect the exact WebExtension files generated for your rules. Ready to load into Firefox via <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">about:debugging</code> or direct <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">.xpi</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportXpi}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 active:bg-orange-700 rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .xpi</span>
          </button>
          <button
            onClick={onExportZip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <span>Download .zip</span>
          </button>
        </div>
      </div>

      {/* Code Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-4 rounded-xl border border-slate-800 bg-[#0f141c] overflow-hidden shadow-lg min-h-[560px]">
        {/* File Tree Sidebar */}
        <div className="lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#0b0e14] p-3 text-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 mb-2">
            Package Structure
          </div>

          <div className="space-y-0.5">
            {files.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors font-mono text-xs ${
                    isSelected
                      ? 'bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <span className="shrink-0">{getFileIcon(file.name)}</span>
                  <span className="truncate">{file.path}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 px-2 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Target Platform:</div>
            <div>Mozilla Firefox 109+</div>
            <div>Manifest V3 (Gecko)</div>
            <div className="pt-2 text-slate-400">
              {files.length} files generated · Ready to load
            </div>
          </div>
        </div>

        {/* Code Content View */}
        <div className="lg:col-span-3 flex flex-col bg-[#0f141c]">
          {/* File toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#141a24] border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2 font-mono text-slate-200">
              <span>{getFileIcon(selectedFile.name)}</span>
              <span className="font-semibold">{selectedFile.path}</span>
              <span className="text-slate-500 text-[11px]">
                ({lines.length} lines · {new Blob([selectedFile.content]).size} bytes)
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors text-xs font-medium"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="flex-1 overflow-auto max-h-[620px] font-mono text-xs text-slate-300 p-4 select-text">
            <pre className="flex">
              {/* Line numbers */}
              <div className="select-none pr-4 text-right text-slate-600 border-r border-slate-800 mr-4 font-mono text-xs tabular-nums">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Code lines */}
              <code className="flex-1 font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre">
                {selectedFile.content}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
