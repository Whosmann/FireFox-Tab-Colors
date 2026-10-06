import React, { useState, useEffect } from 'react';
import { X, Check, ArrowUpRight, Sparkles, AlertCircle, Download, Tag } from 'lucide-react';
import { bumpVersion, isValidVersion } from '../utils/versionHelper';

interface VersionBumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  onSaveVersion: (newVersion: string) => void;
  onExportZipWithVersion?: (version: string) => void;
  onExportXpiWithVersion?: (version: string) => void;
}

export const VersionBumpModal: React.FC<VersionBumpModalProps> = ({
  isOpen,
  onClose,
  currentVersion,
  onSaveVersion,
  onExportZipWithVersion,
  onExportXpiWithVersion,
}) => {
  const [version, setVersion] = useState(currentVersion || '1.0.1');

  useEffect(() => {
    if (isOpen) {
      setVersion(currentVersion || '1.0.1');
    }
  }, [isOpen, currentVersion]);

  if (!isOpen) return null;

  const valid = isValidVersion(version);

  const handleApplyBump = (type: 'patch' | 'minor' | 'major') => {
    const next = bumpVersion(version, type);
    setVersion(next);
  };

  const handleSave = () => {
    if (!valid) return;
    onSaveVersion(version.trim());
    onClose();
  };

  const handleExportZip = () => {
    if (!valid) return;
    onSaveVersion(version.trim());
    if (onExportZipWithVersion) {
      onExportZipWithVersion(version.trim());
    }
    onClose();
  };

  const handleExportXpi = () => {
    if (!valid) return;
    onSaveVersion(version.trim());
    if (onExportXpiWithVersion) {
      onExportXpiWithVersion(version.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Versionsnummer für Reupload
              </h3>
              <p className="text-xs text-slate-500">
                Mozilla AMO & Firefox Extension Update
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Version Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>AMO Reupload-Voraussetzung:</strong> Mozilla Add-ons akzeptiert Updates nur mit einer <strong>höheren Versionsnummer</strong> als der bereits hochgeladenen (z. B. von <code>1.0.0</code> auf <code>1.0.1</code>).
            </div>
          </div>

          {/* Version Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Aktuelle Versionsnummer (manifest.json)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-xs font-mono text-slate-400">
                  v
                </span>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="z. B. 1.0.1"
                  className={`w-full pl-7 pr-3 py-2 text-sm font-mono font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    valid ? 'border-slate-300 bg-white text-slate-900' : 'border-rose-300 bg-rose-50 text-rose-900'
                  }`}
                />
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {valid ? '✓ Gültig' : '✗ Ungültig'}
              </span>
            </div>
          </div>

          {/* Quick Bump Buttons */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-600">
              1-Klick Erhöhung (Quick Bump):
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleApplyBump('patch')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 transition-colors text-center group"
              >
                <span className="text-xs font-bold text-slate-800 group-hover:text-sky-700">
                  +0.0.1 Patch
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Bugfixes / Regeln
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyBump('minor')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 transition-colors text-center group"
              >
                <span className="text-xs font-bold text-slate-800 group-hover:text-sky-700">
                  +0.1.0 Minor
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Neue Features
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyBump('major')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 transition-colors text-center group"
              >
                <span className="text-xs font-bold text-slate-800 group-hover:text-sky-700">
                  +1.0.0 Major
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Großes Update
                </span>
              </button>
            </div>
          </div>

          {/* Filename Preview */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Download-Dateinamen:
            </span>
            <div className="font-mono text-slate-700 text-xs">
              📦 AMO: <code>tabchroma-firefox-v{version || '1.0.1'}.zip</code>
            </div>
            <div className="font-mono text-slate-700 text-xs">
              🦊 Direct: <code>tabchroma-tab-color-v{version || '1.0.1'}.xpi</code>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            Abbrechen
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={handleExportZip}
              disabled={!valid}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Speichern & .zip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
