# Arquitetura — OBR Arena Simulation

Documento técnico voltado a quem for evoluir o código. O README permanece focado no uso.

## Visão geral

Aplicação web estática (HTML + CSS + ES modules, sem bundler) para treinamento de juízes OBR Resgate.

Principais camadas:

| Camada | Local | Responsabilidade |
|--------|-------|------------------|
| UI / orquestração | `js/main.js` | Bootstrap, estado `sim`, wiring restante (construtores) |
| Simulação | `js/sim/*` | Cenários, update, path/manual/script, sensores |
| Paint (ctors) | `js/constructors/paint/*` | Buffer/undo e câmera compartilhados |
| Shell | `js/app/*` | Abas/`setMode`, teclado, game loop |
| UI placar | `js/ui/ScorePanel.js` | Log de eventos e placar |
| Core | `js/core/*` | Constantes, persist, typing |
| Modelos | `js/engine/Models.js` | `Tile`, `Robot`, `Vec`, `TileType` |
| Pontuação | `js/engine/ScoreEngine.js` | Regras OBR de pontuação |
| Persistência | `js/storage/DataManager.js` | IndexedDB + espelho localStorage |
| I/O oficial | `js/io/*` | Classificação de tiles, conversão de arenas, pathfinding |
| Editor | `js/editor/*` | Histórico, grade, operações de tile, ferramentas |
| Render | `js/render/*` | Câmera 2D e pipeline de desenho da arena |

## Estado global (`sim`)

O objeto `sim` concentra o estado da sessão (grade, tiles, objetos, robô, histórico, modo, bibliotecas). A longo prazo o ideal é reduzir o acoplamento: módulos de editor/render recebem `sim` (ou fatias) por parâmetro em vez de depender de closure global.

## Editor de arena — modularidade

Módulos extraídos:

1. **ArenaHistory** — snapshots e undo/redo isolados.
2. **GridManager** — redimensionamento e matriz completa.
3. **Camera** — fit/zoom/pan e conversões de coordenadas.
4. **TileOperations** — `placeTileAt`, `clearTileAt`, `moveTile`, rotação/espelho, `clearArena`.
5. **EditorTools** — seleção de ferramenta, camada do painel, cancelamento, helpers de marcadores.
6. **ArenaRenderer** — pipeline `drawArena`, tiles (oficial/custom/builtin), objetos, robô, medição.
7. **MapMeta** — metadados do mapa e andares.
8. **TileProps** — painel de propriedades e menu de contexto.
9. **EditorDragDrop** — preview e estado de drag-and-drop.
10. **TilePalette** — preview e paleta custom.
11. **OfficialCatalog** — catálogo oficial de imagens.
12. **EditorInput** — mouse/wheel do canvas no editor.
13. **ArenaIO** — export/import JSON e pathfinding agendado.
14. **CustomMode** — gates de UI do modo custom.

A lógica do editor, shell, simulação e **paint compartilhado** estão extraídos.
Ainda em `main.js`: UI/wiring dos construtores de ladrilho/objeto/robô (fases 5–6).
O roteiro completo está em [`docs/modularization-plan.md`](modularization-plan.md).

## Convenções

- Seguir `AGENTS.md` (sem código morto, sem valores mágicos, testes e docs na mesma mudança).
- Preferir funções puras ou com dependências injetadas (`deps`) nos módulos extraídos.
- Manter o motor de simulação/pontuação estável; mudanças de UI e editor não devem quebrar regras OBR.

## Limitações conhecidas

- `main.js` ainda é grande (~2,9k linhas); fases 0–4 concluídas; extração segue `docs/modularization-plan.md`.
- Multi-floor (gz) está parcialmente implementado; pathfinding e alguns fluxos assumem floor 0.
- Não há suite de testes automatizados ainda — módulos novos devem ser escritos de forma testável.
