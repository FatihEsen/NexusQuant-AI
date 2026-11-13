import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Check, Copy, Download, Terminal } from 'lucide-react';
import { getT } from '../i18n/translations';
import {
  ApiSettings,
  DataFeedsConfig,
  Language,
  ModularSkillsConfig,
  StrategyConfig,
  TokenOptimizationConfig,
} from '../types';
import {
  generateConfigJson,
  generateDockerCompose,
  generateDockerfile,
  generateStrategyPy,
} from '../utils/generators';

interface ExportViewProps {
  language: Language;
  settings: ApiSettings;
  strategy: StrategyConfig;
  tokenOpt: TokenOptimizationConfig;
  feeds: DataFeedsConfig;
  skills: ModularSkillsConfig;
}

type FileId = 'config.json' | 'GeminiHybridStrategy.py' | 'Dockerfile' | 'docker-compose.yml';

export function ExportView({
  language,
  settings,
  strategy,
  tokenOpt,
  feeds,
  skills,
}: ExportViewProps) {
  const t = getT(language);
  const [activeFile, setActiveFile] = useState<FileId>('GeminiHybridStrategy.py');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingZip, setExportingZip] = useState(false);

  const files = useMemo<Record<FileId, string>>(
    () => ({
      'config.json': generateConfigJson(settings, strategy),
      'GeminiHybridStrategy.py': generateStrategyPy(settings, strategy, tokenOpt, feeds, skills, language),
      Dockerfile: generateDockerfile(),
      'docker-compose.yml': generateDockerCompose(settings),
    }),
    [settings, strategy, tokenOpt, feeds, skills, language]
  );

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const downloadSingleFile = (filename: FileId) => {
    const blob = new Blob([files[filename]], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadBundleZip = async () => {
    setExportingZip(true);
    try {
      const zip = new JSZip();
      zip.file('Dockerfile', files.Dockerfile);
      zip.file('docker-compose.yml', files['docker-compose.yml']);
      zip.file('user_data/config.json', files['config.json']);
      zip.file('user_data/strategies/GeminiHybridStrategy.py', files['GeminiHybridStrategy.py']);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'nexusquant-freqtrade-okx-bundle.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportingZip(false);
    }
  };

  const activeSkillsList = Object.entries(skills)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
            {t.export.title}
          </h2>
          <p className="mt-1 text-sm text-slate-400 max-w-3xl">{t.export.subtitle}</p>
        </div>
        <button
          type="button"
          disabled={exportingZip}
          onClick={downloadBundleZip}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Download className="w-4 h-4" />
          <span>{t.export.bundleButton}</span>
        </button>
      </div>

      {/* Quick Deploy Guide Banner */}
      <section className="bg-[#0F1522] border border-slate-800/90 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 className="text-base font-semibold text-slate-100">
              {t.export.quickGuideTitle}
            </h3>
          </div>
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
            <code className="text-xs font-mono text-emerald-400">
              {t.export.quickGuideCmd}
            </code>
            <button
              type="button"
              onClick={() => copyText(t.export.quickGuideCmd, 'cmd')}
              className="text-slate-400 hover:text-slate-100 p-1 transition-colors"
              aria-label="Copy docker compose command"
            >
              {copiedId === 'cmd' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          {t.export.quickGuideSteps.map((step, index) => (
            <li key={index} className="space-y-1">
              <div className="font-mono text-emerald-400 font-semibold">0{index + 1}.</div>
              <p className="leading-relaxed text-slate-300">{step}</p>
            </li>
          ))}
        </ol>

        <div className="pt-3 border-t border-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-amber-300">{t.export.securityReminder}</span>
          <span className="font-mono text-slate-400">
            {t.export.activeSkillsSummary}: {activeSkillsList.length} / 4
          </span>
        </div>
      </section>

      {/* File Viewer & Export Tabs */}
      <section className="bg-[#0F1522] border border-slate-800/90 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0C111C]">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                'config.json',
                'GeminiHybridStrategy.py',
                'Dockerfile',
                'docker-compose.yml',
              ] as const
            ).map((fileId) => (
              <button
                key={fileId}
                type="button"
                onClick={() => setActiveFile(fileId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                  activeFile === fileId
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                {fileId}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => copyText(files[activeFile], activeFile)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
            >
              {copiedId === activeFile ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedId === activeFile ? t.export.copied : t.export.copyFile}</span>
            </button>
            <button
              type="button"
              onClick={() => downloadSingleFile(activeFile)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.export.downloadFile}</span>
            </button>
          </div>
        </div>

        <pre className="p-5 text-xs font-mono text-slate-200 overflow-x-auto max-h-[560px] leading-relaxed bg-[#090D16]">
          <code>{files[activeFile]}</code>
        </pre>
      </section>
    </div>
  );
}
