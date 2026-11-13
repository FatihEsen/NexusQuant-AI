import { Activity, Cpu, Download, LayoutDashboard, Settings, ShieldCheck } from 'lucide-react';
import { getT } from '../i18n/translations';
import { ApiSettings, Language, NavTab, StrategyConfig } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  language: Language;
  settings: ApiSettings;
  strategy: StrategyConfig;
  activeSkillsCount: number;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  language,
  settings,
  strategy,
  activeSkillsCount,
}: SidebarProps) {
  const t = getT(language);

  const navItems: Array<{ id: NavTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'simulator', label: t.nav.simulator, icon: Cpu },
    { id: 'export', label: t.nav.export, icon: Download },
    { id: 'settings', label: t.nav.settings, icon: Settings },
  ];

  const isDryRun = settings.tradingMode === 'dry_run';

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-[#0C111C] border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between">
      <div className="p-5">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight text-slate-100 truncate">
              {t.brandName}
            </div>
            <div className="text-xs text-slate-400 truncate">{t.brandSubtitle}</div>
          </div>
        </div>

        <nav
          aria-label="Primary navigation"
          className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-1.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                  isActive
                    ? 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/25'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="hidden lg:block p-5 border-t border-slate-800/80 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">{language === 'tr' ? 'Mod' : 'Mode'}</span>
          <span
            className={`font-mono font-medium ${
              isDryRun ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {isDryRun ? t.topBar.dryRunLabel : t.topBar.liveLabel}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">{language === 'tr' ? 'Borsa / Parite' : 'Exchange / Pairs'}</span>
          <span className="font-mono tabular-nums text-slate-200">
            OKX · {strategy.pairs.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">{language === 'tr' ? 'Aktif Yetenekler' : 'Active Skills'}</span>
          <span className="font-mono tabular-nums text-emerald-400">{activeSkillsCount} / 4</span>
        </div>
        <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2 text-slate-400 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{t.topBar.noDirectExecution}</span>
        </div>
      </div>
    </aside>
  );
}
