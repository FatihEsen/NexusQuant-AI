# Graph Report - NexusQuant-AI  (2026-11-13)

## Corpus Check
- Corpus is ~13,923 words - fits in a single context window. You may not need a graph.

## Summary
- 165 nodes · 383 edges · 7 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- UI Components, Types & i18n
- App State & Storage Management
- Backend Server & Gemini AI Engine
- Build Tooling & Styling Dependencies
- TypeScript Configuration
- Freqtrade & Docker Code Generators
- NPM Scripts & Lifecycle Commands

## God Nodes (most connected - your core abstractions)
1. `App()` - 23 edges
2. `Language` - 17 edges
3. `ApiSettings` - 16 edges
4. `compilerOptions` - 16 edges
5. `getT()` - 13 edges
6. `StrategyConfig` - 12 edges
7. `TokenOptimizationConfig` - 10 edges
8. `DataFeedsConfig` - 10 edges
9. `ModularSkillsConfig` - 10 edges
10. `DashboardViewProps` - 9 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `ExportView()`  [EXTRACTED]
  src/App.tsx → src/components/ExportView.tsx
- `App()` --calls--> `SettingsView()`  [EXTRACTED]
  src/App.tsx → src/components/SettingsView.tsx
- `App()` --calls--> `Sidebar()`  [EXTRACTED]
  src/App.tsx → src/components/Sidebar.tsx
- `App()` --calls--> `TopBar()`  [EXTRACTED]
  src/App.tsx → src/components/TopBar.tsx
- `DashboardView()` --calls--> `getT()`  [EXTRACTED]
  src/components/DashboardView.tsx → src/i18n/translations.ts

## Import Cycles
- None detected.

## Communities (7 total, 0 thin omitted)

### Community 0 - "UI Components, Types & i18n"
Cohesion: 0.17
Nodes (30): lucide-react, DashboardViewProps, ExportViewProps, SecretInput(), SecretInputProps, SettingsView(), SettingsViewProps, Sidebar() (+22 more)

### Community 1 - "App State & Storage Management"
Cohesion: 0.15
Nodes (29): App(), DashboardView(), SimulatorView(), clearStoredCredentials(), DEFAULT_API_SETTINGS, DEFAULT_FEEDS, DEFAULT_SKILLS, DEFAULT_STRATEGY_CONFIG (+21 more)

### Community 2 - "Backend Server & Gemini AI Engine"
Cohesion: 0.07
Nodes (22): dependencies, dotenv@^17.2.3, express@^4.21.2, @google/genai@^3.3.0, lucide-react@^0.546.0, react-dom@^19.0.1, @tailwindcss/vite@^4.3.3, vite@^8.3.0 (+14 more)

### Community 3 - "Build Tooling & Styling Dependencies"
Cohesion: 0.10
Nodes (25): motion@^12.23.24, devDependencies, autoprefixer@^10.4.21, esbuild@^0.25.0, tailwindcss@^4.3.3, tsx@^4.21.0, @types/express@^4.17.21, @types/node@^22.14.0 (+17 more)

### Community 4 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+9 more)

### Community 5 - "Freqtrade & Docker Code Generators"
Cohesion: 0.29
Nodes (10): jszip@^3.10.2, react@^19.0.1, jszip, react, ExportView(), FileId, generateConfigJson(), generateDockerCompose() (+2 more)

### Community 6 - "NPM Scripts & Lifecycle Commands"
Cohesion: 0.29
Nodes (7): scripts, build, clean, dev, lint, preview, start

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Freqtrade & Docker Code Generators` to `UI Components, Types & i18n`, `App State & Storage Management`, `Build Tooling & Styling Dependencies`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Should `App State & Storage Management` be split into smaller, more focused modules?**
  _Cohesion score 0.14583333333333334 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `UI Components, Types & i18n` to `Backend Server & Gemini AI Engine`, `Build Tooling & Styling Dependencies`, `Freqtrade & Docker Code Generators`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Should `Backend Server & Gemini AI Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07459677419354839 - nodes in this community are weakly interconnected._
- **Why does `motion` connect `Build Tooling & Styling Dependencies` to `App State & Storage Management`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `Build Tooling & Styling Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10461538461538461 - nodes in this community are weakly interconnected._
- **Should `TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._