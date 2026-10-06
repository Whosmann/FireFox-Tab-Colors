import React, { useState } from 'react';
import { Search, CheckCircle2, AlertCircle, Plus, ArrowRight } from 'lucide-react';
import { TabColorRule } from '../types/extension';
import { matchUrlAgainstRules } from '../utils/urlMatcher';

interface UrlTesterBarProps {
  rules: TabColorRule[];
  onAddRuleForUrl?: (url: string) => void;
}

export const UrlTesterBar: React.FC<UrlTesterBarProps> = ({ rules, onAddRuleForUrl }) => {
  const [testUrl, setTestUrl] = useState('https://app.staging.example.com/api/v1/health');

  const matchResult = matchUrlAgainstRules(testUrl, rules);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-sky-600" />
            Live URL Match Evaluator
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Test any URL to verify which rule takes precedence and which Firefox color container is assigned.
          </p>
        </div>

        {/* Quick sample chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
          <span className="text-slate-400 text-xs shrink-0">Sample URLs:</span>
          <button
            onClick={() => setTestUrl('https://248924.4.internal-cloud.net/app')}
            className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 transition-colors whitespace-nowrap text-xs font-mono"
          >
            248924.4.internal-cloud.net
          </button>
          <button
            onClick={() => setTestUrl('https://248923.32.internal-cloud.net/app')}
            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap text-xs font-mono"
          >
            248923.32.internal-cloud.net
          </button>
          <button
            onClick={() => setTestUrl('https://import.example.com/data')}
            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap text-xs"
          >
            Import Service
          </button>
          <button
            onClick={() => setTestUrl('https://api.prod.company.net/v2/orders')}
            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap text-xs"
          >
            Prod API
          </button>
          <button
            onClick={() => setTestUrl('http://localhost:3000/dashboard')}
            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap text-xs"
          >
            Localhost:3000
          </button>
          <button
            onClick={() => setTestUrl('https://github.com/mozilla/gecko-dev')}
            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap text-xs"
          >
            GitHub
          </button>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="Type or paste any URL (e.g. https://staging.example.com or localhost:8080)"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Evaluation Result */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        {matchResult.matched && matchResult.rule ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 rounded-lg p-3 border border-slate-200">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className="w-4 h-10 sm:w-3 sm:h-8 rounded-xs shrink-0 shadow-xs"
                style={{ backgroundColor: matchResult.rule.color }}
                title={`Assigned Color: ${matchResult.rule.color}`}
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-900">
                    {matchResult.rule.name}
                  </span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs font-mono text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                    {matchResult.rule.patternType}
                  </span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-600">
                    Container: <strong className="font-semibold text-slate-900">{matchResult.rule.containerName}</strong> ({matchResult.rule.firefoxContainerColor})
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {matchResult.reason}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-xs font-mono px-2 py-1 rounded text-white font-medium"
                style={{ backgroundColor: matchResult.rule.color }}
              >
                {matchResult.rule.color}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/60 rounded-lg p-3 border border-amber-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-amber-900">
                  No matching rule found
                </div>
                <div className="text-xs text-amber-700">
                  This URL will open as a standard, uncolored Firefox tab.
                </div>
              </div>
            </div>

            {onAddRuleForUrl && (
              <button
                onClick={() => onAddRuleForUrl(testUrl)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors whitespace-nowrap self-start sm:self-center"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Rule for this URL</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
