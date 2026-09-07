# Changelog

Todas as mudanças relevantes do projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e o projeto adere a [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Fase 0–3 da modularização (`docs/modularization-plan.md`):
  - `js/core/persist.js`, `js/core/typing.js`
  - `js/app/AppShell.js`, `js/app/Keyboard.js`, `js/app/GameLoop.js`
  - `js/ui/ScorePanel.js`
  - `js/editor/TilePalette.js`, `OfficialCatalog.js`, `EditorInput.js`, `ArenaIO.js`, `CustomMode.js`
  - `js/sim/Scenarios.js`, `Simulation.js`, `ManualControl.js`, `Sensors.js`, `RobotScript.js`
  - `js/constructors/paint/PaintBuffer.js`, `CtorCamera.js`
  - `js/constructors/TileConstructor.js`, `ObjectConstructor.js`
  - Constantes: movimento + `CTOR_GRID_CELLS`, `CTOR_TILE_CANVAS_MM`, `CTOR_HISTORY_MAX`
- `docs/modularization-plan.md` — plano para extrair o restante de `main.js` (shell, editor UI, simulação, construtores)
- Módulos do editor de arena:
  - `js/editor/ArenaHistory.js` — undo/redo
  - `js/editor/GridManager.js` — grade
  - `js/editor/TileOperations.js` — place / clear / move / rotate / mirror / clearArena
  - `js/editor/EditorTools.js` — seleção de ferramenta, camada, marcadores
- Módulos de render:
  - `js/render/Camera.js` — fit / zoom / pan
  - `js/render/ArenaRenderer.js` — pipeline de desenho da arena
  - `js/editor/MapMeta.js` — metadados do mapa e andares
  - `js/editor/TileProps.js` — painel de propriedades e menu de contexto
  - `js/editor/EditorDragDrop.js` — preview e estado de drag-and-drop
- Constantes nomeadas em `js/core/constants.js`
- `AGENTS.md`, `docs/architecture.md`

### Changed
- `main.js` delega shell, editor, simulação, paint e construtores tile/obj aos módulos extraídos
- `docs/architecture.md` atualizado com camadas shell e core
- `docs/architecture.md` aponta o plano de modularização; lista MapMeta / TileProps / EditorDragDrop como já extraídos
- `main.js` delega histórico, grade, câmera, operações de tile, ferramentas e render aos módulos
- `Models.js` reexporta `TILE_PX` / `LINE_W` a partir de `constants.js`
- `isTypingTarget` endurecido (corrige issue #1 — teclas 1–6 em inputs)

### Removed
- Código morto `_origPushArena`, init vazio no rodapé e `BUILTIN_TILE_DEFS` não usado
- Duplicata local de `MM_PER_TILE` / `MM_TO_WORLD` em `main.js`
- Handler de keydown redundante para Ctrl+Z/Y no construtor de objetos
- Bloco monolítico de desenho da arena em `main.js` (movido para `ArenaRenderer`)
- Sprite do robô restaurado (corpo, rodas, frente, detectores) conforme implementação original

## [0.01] - 2026-09

### Added
- Catálogo de ladrilhos oficiais OBR
- Modo Custom
- Backup/restauração completa de dados
- Migração de persistência para IndexedDB

## [0.00] - 2026-09

### Added
- Reestruturação da interface ("console de arbitragem")
- Navegação por abas, paleta unificada, preview em hover, painel de ajuda
