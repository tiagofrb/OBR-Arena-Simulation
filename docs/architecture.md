# Arquitetura — OBR Arena Simulation

Documento técnico voltado a quem for evoluir o código. O README permanece focado no uso.

## Visão geral

Aplicação web estática (HTML + CSS + ES modules, sem bundler) para treinamento de juízes OBR Resgate.

Principais camadas:

| Camada | Local | Responsabilidade |
|--------|-------|------------------|
| UI / orquestração | `js/main.js` | Eventos DOM, modo (aba), wiring, estado global `sim` (ainda monolítico; ver plano) |
| Modelos | `js/engine/Models.js` | `Tile`, `Robot`, `Vec`, `TileType` |
| Pontuação | `js/engine/ScoreEngine.js` | Regras OBR de pontuação |
| Persistência | `js/storage/DataManager.js` | IndexedDB + espelho localStorage |
| I/O oficial | `js/io/*` | Classificação de tiles, conversão de arenas, pathfinding |
| Editor | `js/editor/*` | Histórico, grade, operações de tile, ferramentas |
| Render | `js/render/*` | Câmera 2D e pipeline de desenho da arena |
| Constantes | `js/core/constants.js` | Valores nomeados documentados |

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

A lógica do editor está extraída. Ainda em `main.js`: paletas DOM, mouse do canvas, import/export, modo custom, simulação, construtores e shell (abas/teclado). O roteiro completo está em [`docs/modularization-plan.md`](modularization-plan.md).

## Convenções

- Seguir `AGENTS.md` (sem código morto, sem valores mágicos, testes e docs na mesma mudança).
- Preferir funções puras ou com dependências injetadas (`deps`) nos módulos extraídos.
- Manter o motor de simulação/pontuação estável; mudanças de UI e editor não devem quebrar regras OBR.

## Limitações conhecidas

- `main.js` ainda é grande (~4,4k linhas); a extração segue `docs/modularization-plan.md`.
- Multi-floor (gz) está parcialmente implementado; pathfinding e alguns fluxos assumem floor 0.
- Não há suite de testes automatizados ainda — módulos novos devem ser escritos de forma testável.
