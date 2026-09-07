# OBR 2026 — Simulador de Treinamento de Juízes (Resgate) v0.01

Ferramenta web para treinar juízes da OBR (Olimpíada Brasileira de Robótica) na modalidade Resgate: montagem de arena, simulação de robô, controle manual e pontuação automática segundo as regras oficiais.

## Como executar

```bash
python3 -m http.server 8080
```

Abra: http://localhost:8080

Não requer instalação, build ou dependências externas — roda direto no navegador com HTML5/CSS3/JavaScript puro (ES modules).

## Funcionalidades

- **Editor de arena**: grade configurável, paleta unificada de ladrilhos (padrão + personalizados + oficiais OBR), posicionamento de objetos, undo/redo
- **Simulação**: play/pause/step, pontuação automática em tempo real conforme regras OBR, log de eventos
- **Controle manual**: pilotagem do robô via teclado (WASD/setas) para testes de percurso
- **Construtor de ladrilho**: criação de ladrilhos customizados em grade 3×3
- **Construtor de objeto**: criação de objetos (vítimas, obstáculos etc.) em canvas 300×300
- **Construtor de robô**: definição de corpo e sensores (detectores under/forward)
- **Catálogo oficial OBR**: importação de ladrilhos e arenas no formato oficial, com conversão automática
- **Modo Custom**: alterna entre compatibilidade com o formato oficial e edição livre (com espelhamento de ladrilhos)
- **Backup de dados**: exportação/importação de todos os dados salvos, com opção de limpar tudo

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `1`–`6` | Alterna entre abas (Editor, Simulação, Manual, Construtor de Tile, Construtor de Objeto, Construtor de Robô) |
| `Ctrl+Z` / `Ctrl+Y` | Desfazer / Refazer (arena e construtores) |
| `R` | Rotacionar |
| `T` | Espelhar |
| `Esc` | Cancelar ferramenta ativa |
| `Espaço` (segurar) | Pan pela arena |
| `Shift` + botão do meio | Pan (alternativa) |
| Botão do meio | Conta-gotas (picker) |

## Estrutura do projeto

```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js                    # orquestração UI, eventos, estado sim
│   ├── core/
│   │   └── constants.js           # constantes nomeadas (grid, câmera, storage…)
│   ├── editor/
│   │   ├── ArenaHistory.js        # undo/redo da arena
│   │   ├── GridManager.js         # redimensionamento e matriz da grade
│   │   ├── TileOperations.js      # place / clear / move / rotate / mirror
│   │   ├── EditorTools.js         # seleção de ferramenta e marcadores
│   │   ├── MapMeta.js             # metadados do mapa e andares
│   │   ├── TileProps.js           # propriedades e menu de contexto
│   │   └── EditorDragDrop.js      # preview e estado de drag-and-drop
│   ├── render/
│   │   ├── Camera.js              # fit / zoom / pan / conversões
│   │   └── ArenaRenderer.js       # pipeline de desenho (incl. sprite do robô)
│   ├── engine/
│   │   ├── Models.js              # Tile, Robot, Vec, TileType
│   │   └── ScoreEngine.js         # regras de pontuação OBR
│   ├── io/
│   │   ├── officialTileClassifier.js
│   │   ├── officialArenaAdapter.js
│   │   └── pathFinder.js
│   └── storage/
│       └── DataManager.js
├── docs/
│   └── architecture.md            # decisões técnicas e roadmap de módulos
├── AGENTS.md                      # diretrizes de código para contribuidores/LLMs
├── CHANGELOG.md
└── assets/
    └── official-tiles/
```

## Persistência de dados

Todos os dados (ladrilhos, arenas, objetos e robôs personalizados) são salvos localmente no navegador via `localStorage` e `IndexedDB` — nada é enviado para servidor. Use o painel **Backup & dados** para exportar/importar um backup completo entre máquinas ou navegadores.

## Histórico de versões

Veja o [CHANGELOG.md](CHANGELOG.md) completo.

- **v0.01+ (unreleased)** — Extração modular do editor de arena (histórico, grade, câmera), constantes nomeadas, correção de atalhos de teclado em inputs
- **v0.01** — Catálogo de ladrilhos oficiais OBR, modo custom, backup/restauração completa de dados, migração de persistência para IndexedDB
- **v0.00** — Reestruturação completa da interface ("console de arbitragem"): navegação por abas, paleta unificada de ladrilhos, preview em hover, painel de ajuda integrado

## Escopo

O motor de simulação e pontuação (regras OBR, física do robô, sistema de undo/redo, formato de import/export) é mantido estável entre versões — as mudanças de cada release se concentram na camada de interface, dados e integração com o formato oficial.

## Requisitos

Navegador moderno com suporte a ES Modules, Canvas 2D e IndexedDB. Sem dependências de build (não usa npm/webpack) — basta servir os arquivos estáticos.
