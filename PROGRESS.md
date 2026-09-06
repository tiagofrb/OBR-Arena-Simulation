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
