import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DashboardView } from './components/DashboardView';
import { ExportView } from './components/ExportView';
import { SettingsView } from './components/SettingsView';
import { SimulatorView } from './components/SimulatorView';
import { TopBar } from './components/TopBar';
import {
  ApiSettings,
  DataFeedsConfig,
  Language,
  MarketPulseData,
  ModularSkillsConfig,
  NavTab,
  SignalLogEntry,
  StrategyConfig,
  TokenOptimizationConfig,
} from './types';
import {
  clearStoredCredentials,
  DEFAULT_STRATEGY_CONFIG,
  loadApiSettings,
  loadDataFeeds,
  loadLanguage,
  loadSignalLogs,
  loadSkills,
  loadStrategyConfig,
  loadTokenOpt,
  saveApiSettings,
  saveDataFeeds,
  saveLanguage,
  saveSignalLogs,
  saveSkills,
  saveStrategyConfig,
  saveTokenOpt,
} from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [language, setLanguage] = useState<Language>(() => loadLanguage());
  const [settings, setSettings] = useState<ApiSettings>(() => loadApiSettings());
  const [strategy, setStrategy] = useState<StrategyConfig>(() => loadStrategyConfig());
  const [tokenOpt, setTokenOpt] = useState<TokenOptimizationConfig>(() => loadTokenOpt());
  const [feeds, setFeeds] = useState<DataFeedsConfig>(() => loadDataFeeds());
  const [skills, setSkills] = useState<ModularSkillsConfig>(() => loadSkills());
  const [logs, setLogs] = useState<SignalLogEntry[]>(() => loadSignalLogs());
  const [marketPulse, setMarketPulse] = useState<MarketPulseData | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/market-pulse')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MarketPulseData | null) => {
        if (active && data) setMarketPulse(data);
      })
      .catch(() => {
        // Silent fallback when offline
      });
    return () => {
      active = false;
    };
  }, []);

  const handleChangeLanguage = (lang: Language) => {
    setLanguage(lang);
    saveLanguage(lang);
  };

  const handleSaveSettings = (next: ApiSettings) => {
    setSettings(next);
    saveApiSettings(next);
  };

  const handleClearKeys = () => {
    clearStoredCredentials();
    setSettings((prev) => ({
      ...prev,
      geminiApiKey: '',
      okxApiKey: '',
      okxSecretKey: '',
      okxPassphrase: '',
      freqtradePassword: '',
      cryptoPanicToken: '',
    }));
  };

  const handleChangeStrategy = (next: StrategyConfig) => {
    setStrategy(next);
    saveStrategyConfig(next);
  };

  const handleResetStrategy = () => {
    setStrategy(DEFAULT_STRATEGY_CONFIG);
    saveStrategyConfig(DEFAULT_STRATEGY_CONFIG);
  };

  const handleChangeTokenOpt = (next: TokenOptimizationConfig) => {
    setTokenOpt(next);
    saveTokenOpt(next);
  };

  const handleChangeFeeds = (next: DataFeedsConfig) => {
    setFeeds(next);
    saveDataFeeds(next);
  };

  const handleChangeSkills = (next: ModularSkillsConfig) => {
    setSkills(next);
    saveSkills(next);
  };

  const handleAddLog = (entry: SignalLogEntry) => {
    setLogs((prev) => {
      const next = [entry, ...prev].slice(0, 40);
      saveSignalLogs(next);
      return next;
    });
  };

  const activeSkillsCount = Object.values(skills).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        language={language}
        onChangeLanguage={handleChangeLanguage}
        settings={settings}
        marketPulse={marketPulse}
        strategy={strategy}
        activeSkillsCount={activeSkillsCount}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'dashboard' && (
                <DashboardView
                  language={language}
                  settings={settings}
                  strategy={strategy}
                  onChangeStrategy={handleChangeStrategy}
                  onResetStrategy={handleResetStrategy}
                  tokenOpt={tokenOpt}
                  onChangeTokenOpt={handleChangeTokenOpt}
                  feeds={feeds}
                  onChangeFeeds={handleChangeFeeds}
                  skills={skills}
                  onChangeSkills={handleChangeSkills}
                  marketPulse={marketPulse}
                  logs={logs}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'simulator' && (
                <SimulatorView
                  language={language}
                  settings={settings}
                  strategy={strategy}
                  tokenOpt={tokenOpt}
                  feeds={feeds}
                  skills={skills}
                  marketPulse={marketPulse}
                  logs={logs}
                  onAddLog={handleAddLog}
                />
              )}

              {activeTab === 'export' && (
                <ExportView
                  language={language}
                  settings={settings}
                  strategy={strategy}
                  tokenOpt={tokenOpt}
                  feeds={feeds}
                  skills={skills}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  language={language}
                  settings={settings}
                  onSaveSettings={handleSaveSettings}
                  onClearKeys={handleClearKeys}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
    </div>
  );
}
