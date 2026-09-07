# Features — OBR Arena Simulation

Inventário de funcionalidades do programa.

**Legenda das caixas:** o checkbox indica **cobertura por testes unitários**, não se a feature existe no app.

- `[ ]` planejado (sem testes unitários ainda)
- `[x]` coberto por testes unitários

Não iniciar implementação de testes até nova instrução.

---

## 1. Shell da aplicação

- [ ] Interface web estática (HTML + CSS + ES modules, sem bundler)
- [ ] Navegação por abas (1–6): Editor, Simulação, Manual, Construtor de ladrilho, Construtor de objeto, Construtor de robô
- [ ] Atalhos de teclado globais (abas, undo/redo, R/T, Esc, pan, picker)
- [ ] Bloqueio de atalhos de aba enquanto se digita em inputs (`isTypingTarget`)
- [ ] Guia rápido (drawer de ajuda)
- [ ] Canvas da arena com zoom / fit / pan
- [ ] Barra de status (tempo, falhas, estado da simulação, zoom)

---

## 2. Editor de arena

### 2.1 Grade e câmera
- [ ] Grade configurável (largura × altura)
- [ ] Redimensionamento preservando ladrilhos existentes
- [ ] Câmera: auto-fit, zoom in/out, pan (Espaço / botão do meio + Shift)
- [ ] Conversão tela ↔ mundo ↔ grade
- [ ] Multi-andar (floors / `currentFloor` + metadados `height`)

### 2.2 Ladrilhos
- [ ] Paleta de ladrilhos oficiais OBR (`assets/official-tiles/`)
- [ ] Paleta de ladrilhos custom (biblioteca do app)
- [ ] Tipos built-in (reta, curva, gap, interseção, resgate, etc.)
- [ ] Colocar ladrilho (clique / drag-and-drop da paleta)
- [ ] Shift = manter ferramenta armada (colocar vários)
- [ ] Apagar / limpar célula
- [ ] Mover ladrilho (arraste na grade)
- [ ] Rotação (±90°, tecla R / botões / menu de contexto)
- [ ] Espelhamento H/V (tecla T / botões) — bloqueado fora do Modo Custom
- [ ] Seleção de ladrilho ao clicar (sem ferramenta armada)
- [ ] Desseleção ao clicar em célula vazia ou fora da grade
- [ ] Atualização do painel de propriedades ao selecionar
- [ ] Preview em hover na paleta
- [ ] Preview visual durante drag

### 2.3 Marcadores e propriedades
- [ ] Marcadores start / chegada / checkpoint (ferramentas dedicadas)
- [ ] Menu de contexto no ladrilho (props, rotacionar, marcar start…)
- [ ] Painel de propriedades (speedbumps, obstáculos, rampa, level up/down, start/CP)
- [ ] Metadados do mapa (nome, duração, vítimas, finished, andares)

### 2.4 Objetos na arena
- [ ] Camada de objetos (obstáculo, gangorra, rampa, custom…)
- [ ] Colocar / apagar objetos
- [ ] Seleção de objeto
- [ ] Rotação / espelhamento de objeto selecionado

### 2.5 Histórico e I/O da arena
- [ ] Undo / redo da arena (Ctrl+Z / Ctrl+Y)
- [ ] Limpar arena
- [ ] Salvar arena local (persistência)
- [ ] Exportar JSON (formato app e/ou oficial RCJ/OBR)
- [ ] Importar JSON de arena
- [ ] Pathfinding automático (índices de linha estilo RCJ)

### 2.6 Módulos do editor (código)
- [ ] `js/editor/ArenaHistory.js`
- [ ] `js/editor/GridManager.js`
- [ ] `js/editor/TileOperations.js`
- [ ] `js/editor/EditorTools.js`
- [ ] `js/editor/MapMeta.js`
- [ ] `js/editor/TileProps.js`
- [ ] `js/editor/EditorDragDrop.js`
- [ ] `js/render/Camera.js`
- [ ] `js/render/ArenaRenderer.js`
- [ ] `js/core/constants.js`

---

## 3. Simulação

- [ ] Cenários prontos (básico, gap, interseção, resgate…)
- [ ] Carregar cenário / reiniciar
- [ ] Play / Pausar / Passo
- [ ] Velocidade de simulação
- [ ] Robô segue path automático (modo path)
- [ ] Log de eventos na UI
- [ ] Pontuação automática (`ScoreEngine`)
- [ ] Eventos de ladrilho (checkpoint, chegada, hazards…)
- [ ] Forçar falha / avaliar posição (controles de juiz)
- [ ] Coletar / largar vítima (controles manuais de pontuação)
- [ ] Sprite do robô na arena (corpo, rodas, frente, detectores, carga)

---

## 4. Controle manual

- [ ] Pilotagem por teclado (WASD / setas)
- [ ] Posicionar robô na arena
- [ ] Voltar robô ao início / resetar estado
- [ ] Modo path vs script
- [ ] Script do robô (`function update(sensors, dt)` + `setVelocity`)
- [ ] Leitura de sensores (detectores under/forward amostrando a arena)
- [ ] Readout de sensores na UI

---

## 5. Construtor de ladrilho

- [ ] Canvas 300×300 mm (1 px ≈ 1 mm)
- [ ] Ferramentas: pincel, borracha, conta-gotas, medir, limpar
- [ ] Linha com 2 cliques
- [ ] Tamanho de pincel / grid lock
- [ ] Undo / redo do construtor
- [ ] Metadados (nome, pontos)
- [ ] Salvar na biblioteca custom
- [ ] Editar / excluir itens da biblioteca
- [ ] Zoom do canvas do construtor

---

## 6. Construtor de objeto

- [ ] Canvas 300×300 mm
- [ ] Ferramentas de pintura análogas ao construtor de ladrilho
- [ ] Undo / redo
- [ ] Biblioteca de objetos custom
- [ ] Uso na camada de objetos do editor (com Modo Custom)

---

## 7. Construtor de robô

- [ ] Definição de corpo (largura × altura em mm)
- [ ] Detectores under (solo)
- [ ] Detectores forward (retângulo / triângulo)
- [ ] Lista e edição de detectores
- [ ] Salvar definição na biblioteca
- [ ] Aplicar definição na simulação
- [ ] Preview no canvas do construtor

---

## 8. Formato oficial OBR / RCJ

- [ ] Catálogo de imagens oficiais
- [ ] Classificação de tile oficial (`officialTileClassifier`)
- [ ] Conversão arena oficial → app (`officialArenaAdapter`)
- [ ] Conversão app → oficial (export)
- [ ] Validação de mapa oficial
- [ ] Cache / preload de imagens oficiais
- [ ] Pathfinding compatível com RCJ Line Map Editor (`pathFinder`)

---

## 9. Modo Custom vs oficial

- [ ] Toggle Modo Custom (persistido)
- [ ] Com modo oficial: personalizados bloqueados; espelhamento bloqueado
- [ ] Com Modo Custom: ladrilhos/objetos personalizados e espelhamento liberados
- [ ] Render sem skin oficial quando Custom está ativo

---

## 10. Persistência e backup

- [ ] `DataManager` (IndexedDB + espelho localStorage)
- [ ] Migração automática localStorage → IndexedDB
- [ ] Chaves: tiles, arena, objetos, robôs, modo custom
- [ ] Exportar backup completo
- [ ] Importar backup
- [ ] Limpar todos os dados

---

## 11. Documentação e infraestrutura de qualidade

- [ ] README orientado a uso
- [ ] CHANGELOG
- [ ] AGENTS.md (diretrizes de código)
- [ ] docs/architecture.md
- [ ] PROGRESS.md
- [ ] FEATURES.md (este arquivo)
- [ ] Suite de testes unitários automatizados
- [ ] CI (GitHub Actions) rodando testes

---

## 12. Itens futuros (também sem testes)

- [ ] Build com npm/webpack/TypeScript
- [ ] Backend / conta de usuário / sync em nuvem
- [ ] Física realista completa do robô
- [ ] Cobertura total das regras oficiais OBR 2026 no `ScoreEngine`
- [ ] Multiplayer / arbitragem em rede
- [ ] App nativo (Electron etc.)

---

## Ordem sugerida para testes unitários

1. `js/core/constants.js`
2. `js/engine/Models.js`
3. `js/engine/ScoreEngine.js`
4. `js/editor/GridManager.js`
5. `js/editor/ArenaHistory.js`
6. `js/editor/TileOperations.js`
7. `js/editor/MapMeta.js`
8. `js/io/officialTileClassifier.js`
9. `js/io/pathFinder.js` / `officialArenaAdapter.js`
10. `js/render/Camera.js`
11. `DataManager` e trechos de UI (depois)

---

*As caixas serão marcadas `[x]` somente quando houver testes unitários correspondentes.*
