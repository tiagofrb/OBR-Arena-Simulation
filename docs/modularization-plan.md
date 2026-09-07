# Plano de modularização — o que ainda falta

Documento de trabalho para extrair o restante de `js/main.js` em módulos ES, no mesmo estilo do editor de arena. Não é um guia de uso (isso fica no README).

**Fora deste plano:** suite de testes automatizados e CI — `FEATURES.md` pede para não iniciar testes até nova instrução. Os módulos novos devem nascer **testáveis** (estado e `deps` injetados), mas sem escrever a suíte agora.

**Fora deste plano:** bundler, TypeScript, split de CSS, backend.

---

## Diagnóstico (estado atual)

A crença de que “só o editor está modularizado” está **parcialmente certa**.

Já existem módulos de domínio fora do editor:

| Área | Arquivos | Situação |
|------|----------|----------|
| Editor de arena (lógica) | `js/editor/*` | Extraído (histórico, grade, tiles, ferramentas, meta, props, drag) |
| Render da arena | `js/render/Camera.js`, `ArenaRenderer.js` | Extraído |
| Modelos / pontuação | `js/engine/Models.js`, `ScoreEngine.js` | Já eram arquivos separados |
| Formato oficial | `js/io/*` | Já separados (classificador, adapter, pathFinder) |
| Persistência | `js/storage/DataManager.js` | Já separado |
| Constantes | `js/core/constants.js` | Extraído |

O que **não** está modularizado é a orquestração e as outras abas: quase tudo ainda vive em `js/main.js` (~4,4k linhas). Esse arquivo:

- define o estado global `sim` e os cenários de simulação;
- contém o loop `update` / `checkTileEvents` / sensores / script do robô;
- contém os três construtores (ladrilho, objeto, robô) com pintura duplicada;
- ainda tem paletas, mouse do canvas, import/export, backup, abas e teclado;
- envolve os módulos do editor com **wrappers finos** (`function draw() { _drawArena(...) }`) — ruído, não lógica nova.

Há trecho morto no final (`_origPushArena` que sempre vale `null`). Remover na primeira extração que tocar esse bloco.

### Meta

`main.js` vira um **bootstrap** (~400–800 linhas): cria `sim`, chama `init*` de cada módulo, liga o `requestAnimationFrame`. Sem regras de pontuação, sem pintura de construtor, sem parse de JSON de arena.

---

## Princípios (iguais ao editor)

1. Extração **incremental** — uma fatia por vez; o app deve continuar rodando após cada passo.
2. Funções recebem `sim` (ou fatia) + `deps` (`draw`, `logUI`, `persist`). Sem closures escondidas no módulo.
3. **Não duplicar:** construtor de ladrilho e de objeto compartilham o mesmo motor de pintura.
4. Valores com significado vão para `js/core/constants.js` (já há `CTOR_SIZE_MM`; faltam velocidades do robô, tamanho de histórico dos construtores, etc.).
5. Não mover regra OBR de `ScoreEngine` para a UI. `checkTileEvents` só **dispara** o motor.
6. `index.html` e `css/style.css` permanecem únicos nesta fase (IDs de DOM estáveis).

---

## Árvore-alvo (`js/`)

Pastas novas só quando a extração correspondente começar — não criar diretórios vazios antes.

```
js/
  main.js                 # bootstrap
  core/
    constants.js
    persist.js            # persist() + chaves (hoje em main)
    typing.js             # isTypingTarget
  app/
    AppShell.js           # setMode, abas, help drawer, barra de status
    Keyboard.js           # atalhos globais 1–6, Esc, R/T, undo
    GameLoop.js           # loop() + resizeCanvas wiring
  editor/                 # já existe; completar paleta + input + I/O
    TilePalette.js
    OfficialCatalog.js
    EditorInput.js        # mouse/wheel do canvas no modo editor
    ArenaIO.js            # export/import JSON + download de arquivo
    CustomMode.js         # toggle + gates de UI (espelho, custom)
  constructors/
    paint/                # compartilhado
      PaintBuffer.js      # undo/redo, stamp, linha, grid lock
      CtorCamera.js       # fit/zoom/pan do canvas 300×300
    TileConstructor.js
    ObjectConstructor.js
    RobotConstructor.js
  sim/
    Scenarios.js
    Simulation.js         # update, checkTileEvents, place/restart robot
    Sensors.js            # sample + readout
    RobotScript.js        # compile + run + setVelocity
    ManualControl.js      # WASD / setas (hoje dentro de update)
  ui/
    ScorePanel.js         # updateScoreUI, logUI, clearLog
  engine / io / render / storage   # sem mudança de pasta
```

Nomes podem ajustar na implementação, desde que a **fronteira de responsabilidade** se mantenha.

---

## Fases

Cada fase termina com: código morto removido, `docs/architecture.md` / este plano atualizados se a árvore mudou, `CHANGELOG.md` se o comportamento visível ou a estrutura relevante para quem usa o repo mudou.

### Fase 0 — Higiene ✅

- Removido `_origPushArena` e bloco vazio no rodapé do `try` de init.
- Constantes de movimento em `js/core/constants.js`: `MANUAL_LINEAR_SPEED`, `MANUAL_ANGULAR_SPEED`, `PATH_FOLLOW_SPEED`, `PATH_WAYPOINT_EPSILON`.
- `update()` e sizing do robô usam `MM_TO_WORLD` importado (sem `TILE_PX / 300` / `MM_PER_TILE` locais).

Não muda comportamento. Reduz ruído para as fases seguintes.

### Fase 1 — Shell da aplicação ✅

**Origem em `main.js`:** drawer de ajuda, `setMode`, `isTypingTarget` + `keydown`, `loop`, `persist`, placar/log.

| Módulo | Conteúdo |
|--------|----------|
| `core/persist.js` | `persist` + `createPersist(dataManager)` |
| `core/typing.js` | `isTypingTarget` |
| `app/AppShell.js` | drawer, `setMode` (deps injetadas) |
| `app/Keyboard.js` | atalhos globais 1–6, undo, editor, WASD |
| `app/GameLoop.js` | `startGameLoop` + `wireResize` |
| `ui/ScorePanel.js` | `updateScoreUI`, `logUI`, `clearLog` |

**Critério de pronto:** trocar de aba 1–6 e atalhos funcionam; `main.js` não registra esses listeners direto — só chama `wireAppShell()` / `startGameLoop`.

### Fase 2 — Completar o editor ✅

| Módulo | Conteúdo |
|--------|----------|
| `editor/TilePalette.js` | preview + paleta custom (drag, delete, hover) |
| `editor/OfficialCatalog.js` | probe, load, render, ensure da paleta oficial |
| `editor/EditorInput.js` | clique, pan, picker, context menu, wheel, medida |
| `editor/ArenaIO.js` | download/export/import, save, pathfinding scheduler, medida UI |
| `editor/CustomMode.js` | mirror UI, objetos custom, export hint, `applyCustomMode` |

Wrappers finos permanecem no `main` para deps; `BUILTIN_TILE_DEFS` (morto) removido.
`wireTileContextMenu` permanece no `main` (já delega a `TileProps.js`).

**Critério de pronto:** editar arena (paleta, mouse, import/export, modo custom) sem a lógica inline no `main`.

### Fase 3 — Simulação e controle manual ✅

| Módulo | Conteúdo |
|--------|----------|
| `sim/Scenarios.js` | `scenarios` (basic, gap, intersection, rescue) |
| `sim/Simulation.js` | `loadScenario`, `placeRobotAtStart`, `restartRobot`, `checkTileEvents`, `update` |
| `sim/ManualControl.js` | `applyManualControl` (WASD/setas → pose) |
| `sim/Sensors.js` | `localToWorld`, sample, `updateSensors`, readout |
| `sim/RobotScript.js` | compile / run / `setControlMode` + wiring UI |

`main.js` só mantém wrappers + `getSimDeps()`.

**Limitação conhecida (manter honesta):** `checkTileEvents` e o path automático ainda assumem floor 0 em vários fluxos; não “consertar” multi-andar nesta extração.

**Critério de pronto:** Play/Pause/Step, cenários, WASD, script e sensores com o mesmo comportamento, lógica fora do `main`.

### Fase 4 — Motor de pintura compartilhado

Hoje o construtor de ladrilho (~1423–1985) e o de objeto (~2693–3162) repetem: buffer offscreen, undo/redo, zoom/fit, `stampAt` / linha, grid lock, conta-gotas.

| Módulo | Conteúdo |
|--------|----------|
| `constructors/paint/PaintBuffer.js` | buffer, undo stack, stamp, stroke, pick |
| `constructors/paint/CtorCamera.js` | fit/zoom/pan do canvas do construtor |

**Critério de pronto:** uma única implementação de pincel; os dois construtores só configuram tamanho (300×300), paleta e persistência.

### Fase 5 — Construtor de ladrilho e de objeto

| Módulo | Conteúdo |
|--------|----------|
| `constructors/TileConstructor.js` | open/close tab, `drawCtor`, biblioteca custom, `bufferToCustomDef` |
| `constructors/ObjectConstructor.js` | idem para objetos, `refreshObjLibrary` |

Bindings de botões (`setCtorColor`, brush, grid lock) saem do `main`.

### Fase 6 — Construtor de robô

Não usa o paint buffer (corpo + detectores, não pixels).

| Módulo | Conteúdo |
|--------|----------|
| `constructors/RobotConstructor.js` | `defaultRobotDef`, canvas, hit-test, lista/edição de detectores, salvar/aplicar na biblioteca |

Sensores da **simulação** já devem estar na Fase 3; aqui só a UI de definição.

### Fase 7 — Estado `sim` (opcional, por último)

Hoje `sim` é um objeto único. Não é obrigatório fatiar agora. Se ainda houver acoplamento doloroso depois das fases 1–6:

- `createSessionState()` em `js/core/session.js` com os campos atuais;
- módulos continuam recebendo o mesmo objeto (sem quebrar tudo de uma vez).

Não introduzir store/Redux. ES modules + parâmetro `sim` bastam.

---

## Ordem e dependências

```
Fase 0 (higiene)
    → Fase 1 (shell)     independente do editor
    → Fase 2 (editor UI) usa persist + logUI da fase 1
    → Fase 3 (sim)       usa ScoreEngine + Models (já existem)
    → Fase 4 (paint)     independente da sim
    → Fase 5 (tile/obj)  depende da 4
    → Fase 6 (robô)      pode paralelo à 5 depois da 1
    → Fase 7 (estado)    só se ainda fizer falta
```

Não extrair construtores antes do paint compartilhado (fase 4), senão a duplicação viaja para dois arquivos.

---

## O que permanece no `main.js`

- Import dos módulos.
- Instância de `DataManager` e objeto `sim`.
- Referências ao canvas da arena (`#arena`) e `cam`.
- Uma função `init()` que: carrega IndexedDB, bibliotecas, liga shell, editor, sim, construtores, `loop()`.

Nada de regra de negócio nova nesse arquivo.

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Quebrar atalhos (abas vs construtor vs editor) | Fase 1 concentra teclado; um único `keydown` |
| `setVelocity` no `window` (script do robô) | Documentar em `RobotScript.js`; isolar o monkey-patch |
| Sample de sensores depende do canvas da arena | `Sensors.js` recebe `ctx`/função de sample via `deps`, sem importar o renderer |
| Pathfinding só no export | `ArenaIO.js` chama `updateTileIndex`; não misturar com `TileOperations` |
| Extração “grande demais” | Uma fase = um PR / uma sessão; app jogável no meio |

---

## Checklist por extração

Usar o checklist de `AGENTS.md`. Em especial:

- [ ] Wrappers vazios no `main` removidos se o import direto basta
- [ ] Pintura de construtor não copiada de novo
- [ ] Magics (velocidade, histórico do ctor, limiares de sensor) em `constants.js` com comentário
- [ ] Módulo testável (`sim` + `deps`); **sem** escrever testes nesta campanha
- [ ] `docs/architecture.md` e este plano alinhados à pasta real
- [ ] `CHANGELOG.md` se a estrutura ou o uso mudou de forma visível para quem clona o repo

---

## Como saber que “acabou”

1. `main.js` só bootstrap + `sim`.
2. Cada aba (editor, sim, manual, 3 construtores) tem um módulo dono.
3. Construtores de ladrilho e objeto compartilham `paint/`.
4. `io/`, `engine/`, `storage/` inalterados em responsabilidade (podem só ganhar um caller mais limpo).
5. Limitações conhecidas (multi-floor parcial, ScoreEngine incompleto vs regras 2026) continuam escritas em `docs/architecture.md`, não escondidas.
