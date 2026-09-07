# Progresso — OBR Judge Trainer

## Implementado (reestruturação)

### Parte 1 — IndexedDB (DataManager)
- `js/storage/DataManager.js` — store chave-valor `kv`
- Chaves: obr_custom_tiles, obr_custom_arena, obr_custom_arena_objects, obr_custom_objects, obr_robot_library, obr_custom_mode
- Migração automática localStorage → IndexedDB
- Espelho localStorage em todo `persist()`
- Export / import backup completo + limpar dados

### Parte 2 — Formato oficial
- `js/io/officialTileClassifier.js` — classifica por paths/gaps/seesaw/image
- `js/io/officialArenaAdapter.js` — detecção + conversão + cache de imagens
- Import da arena intercepta formato oficial (tileSet)
- Skin oficial em `assets/official-tiles/` com fallback para desenho nativo

### Parte 3 — Modo Custom
- `sim.customMode` persistido
- Toggle no painel Backup & dados
- Com modo ativo, import oficial é recusado
- Render não usa imagens oficiais

### UI
- Painel Backup & dados (export / import / limpar + toggle)

## Parte 4 — Modularização do editor de arena (em andamento)

- `js/core/constants.js` — TILE_PX, limites de câmera, DEFAULT_GRID_*, STORAGE_KEYS, APP_MODES
- `js/editor/ArenaHistory.js` — snapshot / apply / push / undo / redo
- `js/editor/GridManager.js` — ensureGridMatrix, resizeGrid, updateGridStatus, findTile
- `js/render/Camera.js` — worldSize, fitCamera, setZoom, screenToWorld, worldToGrid
- `main.js` delega a esses módulos; handlers mortos removidos; isTypingTarget reforçado (issue #1)
- Documentação: AGENTS.md, CHANGELOG.md, docs/architecture.md

Próximos passos sugeridos (editor):
1. Extrair TileOperations (place/clear/move/rotate/mirror)
2. Extrair wiring de paleta e ferramentas do editor
3. Extrair ArenaRenderer (draw*)
4. Reduzir dependência de closures em `sim` (passar estado explicitamente)

### Parte 4 (concluída) — módulos do editor
- `TileOperations.js` — place / clear / move / rotate / mirror / clearArena
- `EditorTools.js` — clearTileSelection, selectTileTool, selectOfficialTile, cancelEditorTools, tileIs*
- `ArenaRenderer.js` — drawArena + drawTile / objects / robot / markers
- `main.js` reduzido (~4.6k linhas); draw monolítico removido

### Parte 5 — extrações finais do editor + fix sprite
- `MapMeta.js`, `TileProps.js`, `EditorDragDrop.js`
- Sprite do robô restaurado em `ArenaRenderer` (corpo/rodas/frente/detectores)
- `main.js` ~4.4k linhas
