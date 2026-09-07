# Plano de testes unitários — OBR Arena Simulation

Documento de **planejamento da suíte de testes unitários**.

| Documento | Papel |
|-----------|--------|
| **`FEATURES.md`** (raiz) | O que o **app precisa ter funcionando** |
| **Este arquivo** | O que **vai ter testes unitários**, ordem, stack e meta de cobertura |

**Não implementar testes nesta etapa** — apenas o plano.

Objetivo: rede de segurança para iterações futuras. Meta de **100% de cobertura de linhas/ramos** nos módulos de lógica pura e de domínio. O app ainda não é a versão final; os testes protegem o que já existe.

Alinhado a `AGENTS.md`: testes junto com o código, sem código morto, sem valores mágicos, documentação atualizada na mesma mudança.

**Legenda dos checkboxes neste documento:** cobertura **por testes unitários** (não status da feature no app).

- `[ ]` ainda sem testes unitários
- `[x]` coberto por testes unitários

---

## 1. Contexto e restrições

| Aspecto | Situação |
|---------|----------|
| Runtime | ES modules nativos no browser, **sem bundler** hoje |
| Estado | Objeto global `sim` + deps injetadas nos módulos extraídos |
| DOM / Canvas | Presente em UI, render, input, construtores |
| Persistência | IndexedDB + espelho localStorage (`DataManager`) |
| Multi-floor | Parcial (muitos fluxos assumem `gz === 0`) |
| ScoreEngine | Regras OBR 2026 **parciais** |

**Implicações:**

1. Preferir funções puras e módulos com `sim` / `deps` injetados.
2. DOM, canvas, IndexedDB → mocks ou happy-dom/jsdom.
3. Não testar pixel-a-pixel do render; testar conversões, decisões e dados.
4. UI wiring / `main.js` bootstrap: cobertura parcial ou fora da meta 100%.

---

## 2. Escopo: o que terá testes unitários

Tudo abaixo é alvo da suíte. Itens só de UI/visual puro podem ficar com cobertura baixa ou e2e futuro; a lógica associada ainda entra nas fases.

### 2.1 Core e modelos

- [ ] `js/core/constants.js` — valores, `STORAGE_KEYS`, `APP_MODES`, velocidades
- [ ] `js/core/typing.js` — `isTypingTarget` (issue #1)
- [ ] `js/core/session.js` — factories de estado (se pure)
- [ ] `js/core/persist.js` — trechos testáveis sem DOM
- [ ] `js/engine/Models.js` — `Vec`, `transformPoint` / `inverseTransform`, `Tile`, `Robot`, `TileType`
- [ ] `js/engine/ScoreEngine.js` — reset, total, hazard, checkpoint, finish, fail, multiplier, limite de eventos

### 2.2 Editor (lógica)

- [ ] `js/editor/GridManager.js` — ensureGridMatrix, resizeGrid, findTile
- [ ] `js/editor/ArenaHistory.js` — snapshot, apply, push, undo, redo, cap
- [ ] `js/editor/TileOperations.js` — place, clear, move, rotate, mirror, clearArena
- [ ] `js/editor/MapMeta.js` — metadados do mapa
- [ ] `js/editor/EditorTools.js` — helpers de marcadores / ferramenta
- [ ] `js/editor/CustomMode.js` — gates custom vs oficial

**Com mocks / parcial (DOM ou canvas):**

- [ ] `js/editor/ArenaIO.js` — parse/serialize e pathfinding agendado (sem download real)
- [ ] `js/editor/TilePalette.js` / `OfficialCatalog.js` — só funções puras se houver
- [ ] `js/editor/TileProps.js`, `EditorInput.js`, `EditorDragDrop.js` — só lógica extraível

### 2.3 Render

- [ ] `js/render/Camera.js` — fit, zoom clamp, screen ↔ world ↔ grid
- [ ] `js/render/ArenaRenderer.js` — decisões de o que desenhar / dados (não pixel diff)

### 2.4 I/O oficial

- [ ] `js/io/officialTileClassifier.js` — imagens especiais, gaps, seesaw, paths 0–4, null
- [ ] `js/io/pathFinder.js` — índices estilo RCJ; start/finish/gap
- [ ] `js/io/officialArenaAdapter.js` — detecção + conversão com fixtures

### 2.5 Simulação e controle

- [ ] `js/sim/Scenarios.js` — fábricas de cenário
- [ ] `js/sim/Simulation.js` — eventos de tile, restart, integração com ScoreEngine
- [ ] `js/sim/Sensors.js` — amostragem em grade sintética
- [ ] `js/sim/RobotScript.js` — compile/run, setVelocity/stop, erro isolado
- [ ] `js/sim/ManualControl.js` — deltas com constantes `MANUAL_*`

### 2.6 Persistência

- [ ] `js/storage/DataManager.js` — get/set, migração LS→IDB, export/import, clear

### 2.7 Paint e construtores (lógica)

- [ ] `js/constructors/paint/PaintBuffer.js` — undo/redo, stamp, linha, grid lock
- [ ] `js/constructors/paint/CtorCamera.js` — fit/zoom
- [ ] Serialização / validação de bibliotecas tile, objeto e robô (detectores em mm)

### 2.8 Shell e UI fina

- [ ] `js/app/AppShell.js` — setMode / modos
- [ ] `js/app/Keyboard.js` — atalhos + bloqueio com `isTypingTarget`
- [ ] `js/ui/ScorePanel.js` — formatação a partir de ScoreEngine

### 2.9 Explicitamente fora (ou só e2e / manual)

- Bootstrap completo de `js/main.js`
- Desenho pixel-a-pixel de canvas / skins oficiais
- Drag visual, hover de paleta, drawer de ajuda como UI
- Smoke “abre no browser e clica nas abas”
- Regras OBR 2026 ainda não implementadas no `ScoreEngine`
- Multi-andar completo (até a feature estar estável em `FEATURES.md`)

---

## 3. Stack recomendada

| Item | Escolha | Motivo |
|------|---------|--------|
| Runner | **Vitest** | ESM nativo, watch, coverage V8 |
| Ambiente | `node` (lógica); happy-dom/jsdom se precisar de `document` | CI sem browser |
| Coverage | `@vitest/coverage-v8` | thresholds por pasta |
| Layout | `tests/` espelhando `js/` | |
| CI | GitHub Actions (Node 20+) | `npm test` + coverage |

```text
package.json  →  "type": "module", scripts test / test:watch / test:coverage
vitest.config.js  →  coverage.include = ['js/**/*.js']; excludes documentados
```

App continua via `python3 -m http.server` sem npm no runtime. Alternativa: `node:test` + `c8`.

---

## 4. Princípios

1. Arrange–Act–Assert; um comportamento por teste.
2. Factory `createMinimalSim(...)` em `tests/helpers/simFactory.js`.
3. Não importar `main.js` nos unitários.
4. Mocks de `deps` (`draw`, `logUI`, `persist`, …).
5. Round-trip JSON onde existir `toJSON` / `fromJSON`.
6. Bordas: grade 1×1, histórico cheio, rotação 360, paths vazios, inputs nulos.
7. Mudança de comportamento → atualizar/adicionar teste (`AGENTS.md`).

---

## 5. Fases de implementação

### T0 — Infra
- [ ] package.json + Vitest + coverage
- [ ] vitest.config.js
- [ ] helpers + (opcional) CI
- [ ] 1 teste smoke

### T1 — Core e modelos
constants, typing, session, Models, ScoreEngine

### T2 — Editor (domínio)
GridManager, ArenaHistory, TileOperations, MapMeta, EditorTools, CustomMode

### T3 — I/O oficial
officialTileClassifier, pathFinder, officialArenaAdapter + fixtures em `tests/fixtures/official/`

### T4 — Câmera e sim
Camera, Scenarios, Sensors, RobotScript, ManualControl, Simulation

### T5 — Persistência
DataManager (fake-indexeddb ou store em memória)

### T6 — Paint / construtores
PaintBuffer, CtorCamera, serialização de bibliotecas

### T7 — Shell / UI
AppShell, Keyboard, ScorePanel

**PRs sugeridos:** um por fase (ou T0+T1 juntos); marcar `[x]` neste doc e atualizar `CHANGELOG` / `PROGRESS` quando a suíte existir.

---

## 6. Meta de cobertura

| Camada | Meta |
|--------|------|
| `js/core/*`, `js/engine/*` | **100%** |
| Editor: GridManager, ArenaHistory, TileOperations, MapMeta, EditorTools, CustomMode | **100%** |
| `js/io/*` | **100%** |
| `js/render/Camera.js` | **100%** |
| `js/sim/*` (lógica) | **≥95%** |
| `js/storage/DataManager.js` | **≥90%** |
| `js/constructors/paint/*` | **≥90%** |
| `js/app/*`, `js/ui/*` | **≥80%** |
| `main.js`, draw DOM, input DOM | fora / best-effort |

CI falha se core/engine/io < 100%.

---

## 7. Estrutura de arquivos

```text
tests/
  helpers/simFactory.js
  helpers/mockDeps.js
  fixtures/official/...
  core/*.test.js
  engine/*.test.js
  editor/*.test.js
  io/*.test.js
  render/Camera.test.js
  sim/*.test.js
  storage/DataManager.test.js
  constructors/*.test.js
  app/*.test.js
  ui/ScorePanel.test.js
```

---

## 8. Riscos

1. Lógica residual só em `main.js` → extrair antes de testar ou documentar gap.
2. Multi-floor: testes com `gz = 0` até a feature estar completa em `FEATURES.md`.
3. ScoreEngine: testar comportamento **atual**, não a regra futura completa.
4. IndexedDB: fake/in-memory na CI.
5. Classificador oficial: travar heurística atual; mudança = fixture + changelog.
6. Runner: Vitest sugerido; `node:test` é alternativa.

---

## 9. Checklist por tarefa de teste

- [ ] Cobre o comportamento alterado/existente
- [ ] Factory mínima; sem DOM quando desnecessário
- [ ] Bordas e erros
- [ ] Coverage no threshold
- [ ] Checkbox **deste** plano atualizado
- [ ] `FEATURES.md` só se a *feature do app* mudou (não por ter escrito teste)
- [ ] `CHANGELOG` se a suíte passou a existir para quem usa o repo
- [ ] Só devDependencies no caminho de teste

---

## 10. Fora de escopo desta campanha

- E2E (Playwright/Cypress)
- Snapshot visual de canvas
- Cobertura total de `main.js`
- Completar regras OBR 2026 no ScoreEngine (isso é feature → `FEATURES.md`)
- Bundler/TypeScript no runtime do app

---

*Produto funcionando: `FEATURES.md`. Testes unitários planejados: este arquivo.*
