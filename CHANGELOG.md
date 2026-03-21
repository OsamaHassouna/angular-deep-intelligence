# Changelog

All notable changes to Angular Deep Intelligence will be documented in this file.

## [0.4.0] - 2026-03-21

### Added
- Interactive D3.js force-directed dependency graph in a VS Code webview panel
- Extracts component -> service and service -> service dependency relationships
- Supports both constructor injection and `inject()` patterns
- Circular dependency chains detected and highlighted (red dashed edges)
- Nodes colored by artifact type, sized by connection count
- Zoom/pan/drag support, fit-to-viewport, toolbar controls
- Double-click node to navigate to source file
- Command: `ADI: Show Dependency Graph`

## [0.3.5] - 2026-03-15

### Fixed
- 8 failing tests: 5 fixture path resolutions, 2 stale severity assertions, 1 route classification
- Route classifier: filename-based route detection now runs before AST null check

### Added
- Unified "ADI: Select AI Provider" picker: chat extensions + LM API models in one list
- Multi-provider chat routing: 10 known providers (Copilot, Claude Code, Codex, Cline, Roo Code, Continue, Cody, Amazon Q, CodeGPT, Gemini)
- Auto-activation: ensures target extension is active before running chat commands
- Focus-after-open: focuses chat input after opening (Claude Code, Codex)

## [0.3.0] - 2026-03-10

### Added
- AI-powered "Explain with AI" code action on all ADI diagnostics
- AI-powered "Generate Migration Plan" code action on migration diagnostics
- Multi-provider AI: uses VS Code Chat models by default, falls back to direct Claude API key
- AI response caching (24h TTL)
- 3 new rules: circular-service-deps (warning), lazy-loading-opportunities (hint), shared-module-bloat (hint)
- Total: 10 analysis rules across 4 categories

## [0.2.1] - 2026-03-05

### Changed
- Recalibrated severities: migration/performance suggestions downgraded to hint
- Health score formula reworked: errors dominate (5x), warnings moderate (1x), hints zero impact
- Status bar: green text for healthy (>= 80), orange bg for moderate, red bg for critical
- Status bar tooltip shows per-severity counts

## [0.2.0] - 2026-02-28

### Added
- TreeView health dashboard panel with activity bar icon
- 4 new rules: direct-dom-manipulation, template-method-calls, standalone-readiness, signals-migration
- File watcher for incremental re-analysis on save
- File hash caching (skips unchanged files)
- Extension settings for all rules (enable/disable individually)

## [0.1.0] - 2026-02-20

### Added
- Initial release
- VS Code extension scaffolding (TypeScript, webpack)
- Workspace scanner with vscode.workspace.fs + ts-morph AST
- AnalyzerRegistry with rule-per-file pattern
- 3 rules: missing-unsubscribe, missing-onpush, oversized-component
- DiagnosticCollection, CodeActionProvider, StatusBar integration
- 27 unit tests + 5 integration tests
