/**
 * OBR 2026 Judge Trainer v0.5
 * - Camera: fit / zoom / pan (arena nunca cortada)
 * - Grid resize preserva ladrilhos
 * - Spec: R/T/Esc, picker, import/export
 * - IndexedDB + compatibilidade formato oficial + modo custom
 *
 * Módulos do editor de arena extraídos para js/editor/ e js/render/
 * visando modularidade e evolução de features.
 */
import { TILE_PX, LINE_W, Vec, Tile, Robot, TileType, TILE_LABELS, transformPoint, inverseTransform } from './engine/Models.js';
import { ScoreEngine } from './engine/ScoreEngine.js';
import { DataManager } from './storage/DataManager.js';
import {
  isOfficialArenaFormat,
  convertOfficialArena,
  convertToOfficialArena,
  getCachedOfficialImage,
  preloadOfficialImage,
  validateOfficialMap
} from './io/officialArenaAdapter.js';
import { updateTileIndex } from './io/pathFinder.js';
import {
  ARENA_HISTORY_MAX,
  DEFAULT_GRID_W,
  DEFAULT_GRID_H,
  CAMERA_FIT_PAD,
  CAMERA_MAX_FIT_SCALE,
  CAMERA_MIN_SCALE,
  STORAGE_KEYS,
  APP_MODES
} from './core/constants.js';
import {
  snapshotArena as _snapshotArena,
  applyArenaSnapshot as _applyArenaSnapshot,
  pushArenaUndo as _pushArenaUndo,
  undoArena as _undoArena,
  redoArena as _redoArena
} from './editor/ArenaHistory.js';
import {
  ensureGridMatrix as _ensureGridMatrix,
  resizeGrid as _resizeGrid,
  updateGridStatus as _updateGridStatus,
  findTile
} from './editor/GridManager.js';
import {
  worldSize as camWorldSize,
  fitCamera as camFitCamera,
  setZoom as camSetZoom,
  screenToWorld as camScreenToWorld,
  worldToGrid as camWorldToGrid,
  updateZoomUI as camUpdateZoomUI
} from './render/Camera.js';
import {
  placeTileAt as _placeTileAt,
  clearTileAt as _clearTileAt,
  moveTile as _moveTile,
  rotateSelected as _rotateSelected,
  mirrorSelected as _mirrorSelected,
  clearArena as _clearArena,
  classifyOfficialFilename as _classifyOfficialFilename,
  findTileAt
} from './editor/TileOperations.js';
import {
  clearTileSelection as _clearTileSelection,
  shouldKeepToolArmed as _shouldKeepToolArmed,
  selectTileTool as _selectTileTool,
  selectOfficialTile as _selectOfficialTile,
  setEditorLayer as _setEditorLayer,
  cancelEditorTools as _cancelEditorTools,
  tileIsStart as _tileIsStart,
  tileIsFinish as _tileIsFinish,
  tileIsCheckpoint as _tileIsCheckpoint
} from './editor/EditorTools.js';
import {
  drawArena as _drawArena,
  roundRect as _roundRect
} from './render/ArenaRenderer.js';
import {
  ensureMapMetaDefaults as _ensureMapMetaDefaults,
  applyMapMetaToUI as _applyMapMetaToUI,
  syncMapMetaFromUI as _syncMapMetaFromUI,
  updateMapValidateHint as _updateMapValidateHint,
  rebuildFloorButtons as _rebuildFloorButtons,
  setCurrentFloor as _setCurrentFloor
} from './editor/MapMeta.js';
import {
  hideTileContextMenu as _hideTileContextMenu,
  showTileContextMenu as _showTileContextMenu,
  fillTilePropsPanel as _fillTilePropsPanel,
  updateCheckpointAvailability as _updateCheckpointAvailability,
  applyTilePropsFromPanel as _applyTilePropsFromPanel,
  getContextTile
} from './editor/TileProps.js';
import {
  showTileDragPreview as _showTileDragPreview,
  hideTileDragPreview as _hideTileDragPreview,
  paintDragPreview as _paintDragPreview,
  getDragMoveFrom,
  setDragMoveFrom,
  getDragPayload,
  setDragPayload
} from './editor/EditorDragDrop.js';

const dataManager = new DataManager();

/** Persiste chave (localStorage imediato + IndexedDB assíncrono) */
function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* quota */ }
  dataManager.saveKey(key, value).catch(() => {});
}

const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvasWrap');

let tilePreviewPop = document.getElementById('tilePreviewPop');
let tilePreviewCanvas = document.getElementById('tilePreviewCanvas');
let tilePreviewCap = document.getElementById('tilePreviewCap');

// ─── Guia rápido (drawer) ────────────────────────────────────
(function initHelpDrawer() {
  const btn = document.getElementById('btnHelp2');
  const scrim = document.getElementById('scrim');
  const drawer = document.getElementById('drawer');
  const closeBtn = document.getElementById('btnCloseDrawer');
  const open = () => { scrim.classList.add('open'); drawer.classList.add('open'); };
  const close = () => { scrim.classList.remove('open'); drawer.classList.remove('open'); };
  if (btn) btn.onclick = open;
  if (closeBtn) closeBtn.onclick = close;
  if (scrim) scrim.onclick = close;
})();

// ─── Camera (solve clipping) ─────────────────────────────────
const cam = {
  scale: 1,
  ox: 0, // pan offset in screen px
  oy: 0,
  userZoom: null, // null = auto-fit
  panning: false,
  lastX: 0, lastY: 0
};

function worldSize() {
  return camWorldSize(sim);
}

function resizeCanvas() {
  const r = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(200, r.width - 16);
  const cssH = Math.max(200, r.height - 16);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fitCamera();
  if (sim.mode === 'constructor') { fitCtorCanvas(); drawCtor(); }
  else if (sim.mode === 'objconstructor') { fitObjCtorCanvas(); drawObjCtor(); }
  else if (sim.mode === 'robot') { fitRobotCtorCanvas(); drawRobotCtor(); }
  else draw();
}

function fitCamera() {
  camFitCamera(cam, canvas, sim, updateZoomUI);
}

function setZoom(factor) {
  camSetZoom(cam, canvas, factor, updateZoomUI);
  draw();
}

function updateZoomUI() {
  camUpdateZoomUI(cam);
  const pct = Math.round(cam.scale * 100);
  const status = document.getElementById('zoomStatus');
  if (status) status.textContent = cam.userZoom == null ? 'Ajustar' : pct + '%';
}

function screenToWorld(clientX, clientY) {
  const w = camScreenToWorld(cam, canvas, clientX, clientY);
  const rect = canvas.getBoundingClientRect();
  return {
    x: w.x,
    y: w.y,
    sx: clientX - rect.left,
    sy: clientY - rect.top
  };
}

function worldToGrid(wx, wy) {
  return camWorldToGrid(wx, wy);
}

// ─── State ───────────────────────────────────────────────────
const sim = {
  mode: 'sim',
  running: false,
  time: 0,
  dt: 1 / 60,
  speed: 1,
  robot: null,
  tiles: [],
  path: [],
  score: new ScoreEngine(),
  currentScenario: 'basic',
  lastTile: null,
  tilesSinceCP: 0,
  attempt: 1,
  finished: false,
  gridW: DEFAULT_GRID_W,
  gridH: DEFAULT_GRID_H,
  selectedTool: 'straight',
  selectedTile: null,
  placingRobot: false,
  keys: {},
  spaceDown: false,
  customArena: null,
  customLibrary: [],
  placingCustomId: null,
  startPos: null,
  // camada de objetos (sobre ladrilhos, centralizados)
  objects: [],           // { gx, gy, type, rotation, mirrorH, mirrorV, custom, points }
  selectedObject: null,
  objectTool: null,
  markerTool: null,
  customObjLibrary: [],
  placingCustomObjId: null,
  measureMode: false,
  measureStart: null,
  measureCursor: null,
  arenaUndo: [],
  arenaRedo: [],
  arenaHistoryMax: ARENA_HISTORY_MAX,
  // robô custom + script
  robotLibrary: [],
  activeRobotDef: null,
  controlMode: 'path', // 'path' | 'script'
  scriptFn: null,
  scriptError: null,
  customMode: false, // true = desliga compatibilidade com formato oficial
  currentFloor: 0, // andar z sendo editado (RCJ multi-level)
  officialMeta: null // metadados do último import oficial (name, duration, victims, tileSet…)
};

// ─── Scenarios ───────────────────────────────────────────────
const scenarios = {
  basic: {
    name: 'Trajeto Básico + Obstáculo',
    help: 'Obstáculo 20 pts, checkpoint, chegada.',
    build() {
      const t = [];
      for (let i = 0; i < 8; i++) {
        let type = TileType.STRAIGHT;
        if (i === 0) type = TileType.START;
        if (i === 7) type = TileType.FINISH;
        if (i === 5) type = TileType.CHECKPOINT;
        t.push(new Tile(i, 2, type));
      }
      return t;
    },
    objects() {
      return [{ gx: 3, gy: 2, type: 'obstacle', rotation: 0, points: 20 }];
    },
    path(tiles) {
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const t = tiles[i];
        const cx = t.worldX + TILE_PX / 2, cy = t.worldY + TILE_PX / 2;
        if (i === 3) {
          pts.push(new Vec(cx - 18, cy), new Vec(cx - 8, cy + 32), new Vec(cx + 8, cy + 32), new Vec(cx + 18, cy));
        } else pts.push(new Vec(cx, cy));
      }
      return pts;
    }
  },
  gap: {
    name: 'Gap + Lombada',
    help: 'Gap e lombada (10 pts cada).',
    build() {
      const t = [];
      for (let i = 0; i < 7; i++) {
        let type = TileType.STRAIGHT;
        if (i === 0) type = TileType.START;
        if (i === 6) type = TileType.FINISH;
        if (i === 2) type = TileType.GAP;
        if (i === 4) type = TileType.LOMBADA;
        t.push(new Tile(i, 2, type));
      }
      return t;
    },
    path(tiles) { return tiles.map(t => new Vec(t.worldX + TILE_PX / 2, t.worldY + TILE_PX / 2)); }
  },
  intersection: {
    name: 'Interseção com Verde',
    help: 'Virar à esquerda na marcação verde.',
    build() {
      return [
        new Tile(1, 2, TileType.START), new Tile(2, 2, TileType.STRAIGHT),
        new Tile(3, 2, TileType.INTERSECTION, { hasGreen: true }),
        new Tile(3, 1, TileType.STRAIGHT), new Tile(3, 0, TileType.FINISH),
        new Tile(3, 3, TileType.STRAIGHT), new Tile(4, 2, TileType.STRAIGHT)
      ];
    },
    path() {
      return [
        new Vec(1.5 * TILE_PX, 2.5 * TILE_PX), new Vec(2.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(3.5 * TILE_PX, 2.5 * TILE_PX), new Vec(3.5 * TILE_PX, 1.5 * TILE_PX),
        new Vec(3.5 * TILE_PX, 0.5 * TILE_PX)
      ];
    }
  },
  rescue: {
    name: 'Sala de Resgate',
    help: 'Entregar vítima viva na área verde (×1.3).',
    build() {
      return [
        new Tile(0, 2, TileType.START), new Tile(1, 2, TileType.STRAIGHT),
        new Tile(2, 2, TileType.RESCUE_ENTRY),
        new Tile(3, 1, TileType.RESCUE_GREEN), new Tile(4, 1, TileType.RESCUE),
        new Tile(3, 2, TileType.RESCUE), new Tile(4, 2, TileType.RESCUE_RED),
        new Tile(5, 2, TileType.RESCUE_EXIT), new Tile(6, 2, TileType.STRAIGHT),
        new Tile(7, 2, TileType.FINISH)
      ];
    },
    path() {
      return [
        new Vec(0.5 * TILE_PX, 2.5 * TILE_PX), new Vec(1.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(2.5 * TILE_PX, 2.5 * TILE_PX), new Vec(3.3 * TILE_PX, 1.7 * TILE_PX),
        new Vec(3.5 * TILE_PX, 1.5 * TILE_PX), new Vec(3.7 * TILE_PX, 1.9 * TILE_PX),
        new Vec(4.5 * TILE_PX, 2.5 * TILE_PX), new Vec(5.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(6.5 * TILE_PX, 2.5 * TILE_PX), new Vec(7.5 * TILE_PX, 2.5 * TILE_PX)
      ];
    }
  }
};

// ─── Grid helpers (preserve tiles on resize) ─────────────────
function ensureGridMatrix() {
  _ensureGridMatrix(sim);
}

function resizeGrid(nw, nh) {
  _resizeGrid(sim, nw, nh, () => {
    const gwv = document.getElementById('gridWVal');
    const ghv = document.getElementById('gridHVal');
    if (gwv) gwv.textContent = sim.gridW;
    if (ghv) ghv.textContent = sim.gridH;
    fitCamera();
    draw();
    updateGridStatus();
  });
}
function updateGridStatus() {
  _updateGridStatus(sim);
}

// ─── Load / robot ────────────────────────────────────────────
function tileIsStart(t) {
  return _tileIsStart(t);
}
function tileIsFinish(t) {
  return _tileIsFinish(t);
}
function tileIsCheckpoint(t) {
  return _tileIsCheckpoint(t);
}

function placeRobotAtStart() {
  if (sim.path.length) {
    const s = sim.path[0];
    sim.robot = new Robot(s.x, s.y, 0);
    if (sim.path.length > 1) {
      const d = sim.path[1].sub(s).norm();
      sim.robot.angle = Math.atan2(d.y, d.x) + Math.PI / 2;
    }
    sim.robot.pathIndex = 0;
    sim.startPos = { x: s.x, y: s.y, angle: sim.robot.angle };
  } else {
    const st = sim.tiles.find(t => tileIsStart(t));
    const x = st ? st.worldX + TILE_PX / 2 : TILE_PX * 1.5;
    const y = st ? st.worldY + TILE_PX / 2 : TILE_PX * 1.5;
    sim.robot = new Robot(x, y, 0);
    sim.startPos = { x, y, angle: 0 };
  }
}

function restartRobot() {
  // Sempre volta ao ladrilho START (tipo ou marcador) da arena
  const st = sim.tiles.find(t => tileIsStart(t));
  if (st) {
    const x = st.worldX + TILE_PX / 2;
    const y = st.worldY + TILE_PX / 2;
    // orientação: se houver path, usa ângulo inicial; senão 0
    let angle = 0;
    if (sim.path.length > 1) {
      const d = sim.path[1].sub(sim.path[0]).norm();
      angle = Math.atan2(d.y, d.x) + Math.PI / 2;
    } else if (sim.startPos) {
      angle = sim.startPos.angle || 0;
    }
    sim.robot = new Robot(x, y, angle);
    sim.startPos = { x, y, angle };
  } else if (sim.startPos) {
    sim.robot = new Robot(sim.startPos.x, sim.startPos.y, sim.startPos.angle || 0);
  } else {
    placeRobotAtStart();
  }
  sim.finished = false;
  sim.running = false;
  sim.lastTile = null;
  sim.tilesSinceCP = 0;
  if (sim.robot) {
    sim.robot.pathIndex = 0;
    sim.robot.vLinear = 0;
    sim.robot.vAngular = 0;
    if (sim.activeRobotDef) {
      sim.robot.definition = sim.activeRobotDef;
      sim.robot.width = (sim.activeRobotDef.body.w || 120) * (TILE_PX / 300);
      sim.robot.height = (sim.activeRobotDef.body.h || 150) * (TILE_PX / 300);
    }
  }
  sim.score.scoredHazards.clear();
  sim.score.trajeto = 0;
  sim.score.checkpoints = 0;
  sim.score.finish = 0;
  sim.score.multiplier = 1;
  updateScoreUI();
  document.getElementById('simState').textContent = 'Parado';
  logUI({ t: sim.time, msg: st ? 'Robô voltou ao ladrilho START da arena.' : 'Robô voltou ao início.', category: 'info' });
  draw();
}

function loadScenario(key) {
  sim.objects = [];
  sim.selectedObject = null;
  if (key === 'custom') {
    if (sim.customArena && sim.customArena.length) {
      // infer grid size
      let maxX = 0, maxY = 0;
      sim.customArena.forEach(t => { maxX = Math.max(maxX, t.gx); maxY = Math.max(maxY, t.gy); });
      sim.gridW = Math.max(sim.gridW, maxX + 1);
      sim.gridH = Math.max(sim.gridH, maxY + 1);
      document.getElementById('gridW').value = sim.gridW;
      document.getElementById('gridH').value = sim.gridH;
      document.getElementById('gridWVal').textContent = sim.gridW;
      document.getElementById('gridHVal').textContent = sim.gridH;
      sim.tiles = [];
      ensureGridMatrix();
      sim.customArena.forEach(o => {
        const t = Tile.fromJSON(o);
        const idx = sim.tiles.findIndex(x => x.gx === t.gx && x.gy === t.gy);
        if (idx >= 0) sim.tiles[idx] = t;
        else sim.tiles.push(t);
      });
      sim.path = [];
      sim.currentScenario = 'custom';
      if (sim.customArenaObjects) sim.objects = JSON.parse(JSON.stringify(sim.customArenaObjects));
    } else {
      logUI({ t: 0, msg: 'Nenhuma arena personalizada salva.', category: 'warning' });
      return;
    }
  } else {
    const sc = scenarios[key];
    if (!sc) return;
    sim.currentScenario = key;
    const built = sc.build();
    let maxX = 0, maxY = 0;
    built.forEach(t => { maxX = Math.max(maxX, t.gx); maxY = Math.max(maxY, t.gy); });
    sim.gridW = Math.max(8, maxX + 2);
    sim.gridH = Math.max(5, maxY + 2);
    document.getElementById('gridW').value = sim.gridW;
    document.getElementById('gridH').value = sim.gridH;
    document.getElementById('gridWVal').textContent = sim.gridW;
    document.getElementById('gridHVal').textContent = sim.gridH;
    sim.tiles = [];
    ensureGridMatrix();
    built.forEach(t => {
      const idx = sim.tiles.findIndex(x => x.gx === t.gx && x.gy === t.gy);
      if (idx >= 0) sim.tiles[idx] = t;
    });
    sim.path = sc.path(built);
    if (typeof sc.objects === 'function') sim.objects = sc.objects();
    else sim.objects = [];
    document.getElementById('helpBox').textContent = sc.help;
  }
  sim.score.reset();
  sim.time = 0;
  sim.running = false;
  sim.finished = false;
  sim.tilesSinceCP = 0;
  sim.attempt = 1;
  sim.lastTile = null;
  sim.selectedTile = null;
  placeRobotAtStart();
  document.getElementById('simState').textContent = 'Parado';
  document.getElementById('failCount').textContent = '0';
  document.getElementById('selectedInfo').textContent = '—';
  clearLog();
  updateScoreUI();
  logUI({ t: 0, msg: 'Cenário: ' + (key === 'custom' ? 'Personalizada' : (scenarios[key] && scenarios[key].name) || key), category: 'info' });
  const arenaLabelEl = document.getElementById('arenaLabel');
  if (arenaLabelEl) arenaLabelEl.textContent = 'arena: ' + (key === 'custom' ? 'personalizada' : (scenarios[key] && scenarios[key].name) || key);
  updateGridStatus();
  fitCamera();
  draw();
}

// ─── Update / score triggers ─────────────────────────────────
function update(dt) {
  if (!sim.robot || sim.finished) return;
  const robot = sim.robot;
  if (sim.mode === 'manual') {
    const speed = 110 * sim.speed, rot = 2.8 * sim.speed;
    let dx = 0, dy = 0;
    if (sim.keys['ArrowUp'] || sim.keys['w'] || sim.keys['W']) { dx += Math.sin(robot.angle) * speed * dt; dy -= Math.cos(robot.angle) * speed * dt; }
    if (sim.keys['ArrowDown'] || sim.keys['s'] || sim.keys['S']) { dx -= Math.sin(robot.angle) * speed * dt; dy += Math.cos(robot.angle) * speed * dt; }
    if (sim.keys['ArrowLeft'] || sim.keys['a'] || sim.keys['A']) robot.angle -= rot * dt;
    if (sim.keys['ArrowRight'] || sim.keys['d'] || sim.keys['D']) robot.angle += rot * dt;
    if (sim.keys['q'] || sim.keys['Q']) robot.angle -= rot * dt;
    if (sim.keys['e'] || sim.keys['E']) robot.angle += rot * dt;
    robot.pos.x += dx; robot.pos.y += dy;
    checkTileEvents(robot);
    updateSensors(robot);
    updateSensorReadout();
  } else if (sim.mode === 'sim' && sim.running) {
    // Modo script: move só o sprite com base no script + sensores
    if (sim.controlMode === 'script') {
      updateSensors(robot);
      runRobotScript(robot, dt);
      const mmToWorld = TILE_PX / 300;
      const v = (robot.vLinear || 0) * mmToWorld * sim.speed;
      const w = (robot.vAngular || 0) * sim.speed;
      robot.angle += w * dt;
      robot.pos.x += Math.sin(robot.angle) * v * dt;
      robot.pos.y -= Math.cos(robot.angle) * v * dt;
      checkTileEvents(robot);
      updateSensorReadout();
    } else {
      // Path automático (comportamento original)
      if (robot.pathIndex >= sim.path.length - 1) {
        if (!sim.finished) {
          sim.finished = true;
          const ev = sim.score.scoreFinish(sim.time);
          if (ev) logUI(ev);
          sim.running = false;
          document.getElementById('simState').textContent = 'Finalizado — Voltar ao Início';
          logUI({ t: sim.time, msg: 'Chegada! Use "Voltar Robô ao Início".', category: 'success' });
          updateScoreUI();
        }
        return;
      }
      const target = sim.path[robot.pathIndex + 1];
      const to = target.sub(robot.pos);
      if (to.len() < 6) { robot.pathIndex++; checkTileEvents(robot); }
      else {
        const dir = to.norm();
        robot.pos = robot.pos.add(dir.mul(90 * sim.speed * dt));
        robot.angle = Math.atan2(dir.y, dir.x) + Math.PI / 2;
      }
    }
  }
  if (sim.mode !== 'editor') {
    sim.time += dt;
    document.getElementById('simTime').textContent = sim.time.toFixed(1) + 's';
  }
  if (sim.robot) document.getElementById('robotPos').textContent = Math.round(sim.robot.pos.x) + ', ' + Math.round(sim.robot.pos.y);
}

function checkTileEvents(robot) {
  const gx = Math.floor(robot.pos.x / TILE_PX);
  const gy = Math.floor(robot.pos.y / TILE_PX);
  const tile = sim.tiles.find(t => t.gx === gx && t.gy === gy);
  if (!tile || tile === sim.lastTile || tile.type === TileType.EMPTY) return;
  if (sim.lastTile) sim.tilesSinceCP++;
  const id = tile.id;
  let ev = null;

  // objetos sobre este ladrilho
  const objsHere = sim.objects.filter(o => o.gx === gx && o.gy === gy);
  for (const o of objsHere) {
    const oid = 'obj-' + o.gx + ',' + o.gy + '-' + o.type;
    let pts = 0;
    if (o.type === 'obstacle') pts = o.points != null ? o.points : 20;
    else if (o.type === 'gangorra') pts = o.points != null ? o.points : 20;
    else if (o.type === 'rampa') pts = o.points != null ? o.points : 10;
    else if (o.type === 'custom') pts = (o.custom && o.custom.points != null) ? o.custom.points : (o.points != null ? o.points : 0);
    if (pts !== 0 || o.type === 'custom') {
      const pev = sim.score.scoreHazard(oid, pts, `Objeto ${o.type}${o.custom && o.custom.name ? ' "' + o.custom.name + '"' : ''} (${pts})`, sim.time);
      if (pev) { logUI(pev); updateScoreUI(); }
    }
  }

  if (tile.type === TileType.CUSTOM && tile.custom) {
    const def = tile.custom;
    const lx = (robot.pos.x - tile.worldX) / TILE_PX;
    const ly = (robot.pos.y - tile.worldY) / TILE_PX;
    const p = inverseTransform(lx, ly, tile.rotation, tile.mirrorH, tile.mirrorV);
    let inZone = !def.zones || !def.zones.length;
    if (def.zones) {
      for (const z of def.zones) {
        if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) { inZone = true; break; }
      }
    }
    if (inZone) {
      const pts = (def.points != null && Number.isFinite(Number(def.points))) ? Number(def.points) : 10;
      ev = sim.score.scoreHazard(id, pts, `Custom "${def.name}" (${pts})`, sim.time);
    }
  } else {
    switch (tile.type) {
      case TileType.OBSTACLE: ev = sim.score.scoreHazard(id, 20, 'Obstáculo (20)', sim.time); break;
      case TileType.GAP: ev = sim.score.scoreHazard(id, 10, 'Gap (10)', sim.time); break;
      case TileType.LOMBADA: ev = sim.score.scoreHazard(id, 10, 'Lombada (10)', sim.time); break;
      case TileType.GANGORRA: ev = sim.score.scoreHazard(id, 20, 'Gangorra (20)', sim.time); break;
      case TileType.RAMPA: ev = sim.score.scoreHazard(id, 10, 'Rampa (10)', sim.time); break;
      case TileType.INTERSECTION:
      case TileType.INTERSECTION_T: ev = sim.score.scoreHazard(id, 10, 'Interseção (10)', sim.time); break;
      case TileType.CHECKPOINT:
        ev = sim.score.scoreCheckpoint(Math.max(1, sim.tilesSinceCP), sim.attempt, sim.time);
        sim.tilesSinceCP = 0;
        break;
      case TileType.FINISH:
        if (!sim.finished && sim.mode === 'manual') {
          sim.finished = true;
          ev = sim.score.scoreFinish(sim.time);
          document.getElementById('simState').textContent = 'Finalizado — Voltar ao Início';
        }
        break;
      case TileType.RESCUE_GREEN:
        if (robot.carrying === 'alive') {
          const mid = 'rg-' + id;
          if (!sim.score.scoredHazards.has(mid)) {
            sim.score.scoredHazards.add(mid);
            ev = sim.score.addMultiplier(1.3, 'Vítima viva na Área Verde', sim.time);
            robot.carrying = null;
          }
        }
        break;
      case TileType.RESCUE_RED:
        if (robot.carrying === 'dead') {
          const mid = 'rr-' + id;
          if (!sim.score.scoredHazards.has(mid)) {
            sim.score.scoredHazards.add(mid);
            ev = sim.score.addMultiplier(1.1, 'Vítima morta na Área Vermelha', sim.time);
            robot.carrying = null;
          }
        }
        break;
    }
  }

  // Marcadores no piso (sem depender do tipo start/finish/cp)
  if (tileIsCheckpoint(tile) && tile.type !== TileType.CHECKPOINT) {
    const cev = sim.score.scoreCheckpoint(Math.max(1, sim.tilesSinceCP), sim.attempt, sim.time);
    if (cev) { logUI(cev); updateScoreUI(); sim.tilesSinceCP = 0; }
  }
  if (tileIsFinish(tile) && tile.type !== TileType.FINISH) {
    if (!sim.finished && (sim.mode === 'manual' || sim.mode === 'sim')) {
      sim.finished = true;
      const fev = sim.score.scoreFinish(sim.time);
      if (fev) { logUI(fev); updateScoreUI(); }
      document.getElementById('simState').textContent = 'Finalizado — Voltar ao Início';
    }
  }

  if (ev) { logUI(ev); updateScoreUI(); }
  sim.lastTile = tile;
}

// ─── Render (delegado a js/render/ArenaRenderer.js) ──────────
function getRenderDeps() {
  return {
    requestRedraw: () => draw(),
    getCachedOfficialImage,
    preloadOfficialImage
  };
}

function draw() {
  _drawArena(ctx, canvas, cam, sim, getRenderDeps());
}

function roundRect(x, y, w, h, r) {
  _roundRect(ctx, x, y, w, h, r);
}


// ─── UI helpers ──────────────────────────────────────────────
function updateScoreUI() {
  document.getElementById('totalScore').textContent = sim.score.total;
  document.getElementById('scoreTrajeto').textContent = sim.score.trajeto;
  document.getElementById('scoreCP').textContent = sim.score.checkpoints;
  document.getElementById('scoreFinish').textContent = sim.score.finish;
  document.getElementById('scoreMult').textContent = '×' + sim.score.multiplier.toFixed(2);
  document.getElementById('failCount').textContent = sim.score.fails;
}

function logUI(ev) {
  const log = document.getElementById('eventLog');
  const div = document.createElement('div');
  div.className = 'event ' + (ev.category || 'info');
  div.innerHTML = `<span class="time">${(ev.t || 0).toFixed(1)}s</span> ${ev.msg}${ev.points ? ` <strong>+${ev.points}</strong>` : ''}`;
  log.prepend(div);
}
function clearLog() { document.getElementById('eventLog').innerHTML = ''; }

function loadCustomTileIntoCtor(idx) {
  const def = sim.customLibrary[idx];
  if (!def) return;
  if (!ctor.buf) initCtorBuffer();
  clearCtorBuffer();
  const img = new Image();
  img.onload = () => {
    // se tiver fullBitmap (3×3), usa; senão coloca só o tile no centro
    if (def.fullBitmap) {
      const full = new Image();
      full.onload = () => {
        ctor.bufCtx.drawImage(full, 0, 0, CANVAS_MM, CANVAS_MM);
        drawCtor();
      };
      full.src = def.fullBitmap;
    } else if (def.bitmap) {
      ctor.bufCtx.drawImage(img, CELL_MM, CELL_MM, CELL_MM, CELL_MM);
      drawCtor();
    }
  };
  img.src = def.bitmap || def.fullBitmap || '';
  document.getElementById('ctorName').value = def.name || 'Meu Ladrilho';
  document.getElementById('ctorPoints').value = (def.points != null && Number.isFinite(Number(def.points))) ? Number(def.points) : 10;
  ctor.editingIndex = idx;
  logUI({ t: 0, msg: `Ladrilho "${def.name}" carregado para edição.`, category: 'info' });
  setMode('constructor');
}

function refreshCustomSelect() {
  const lib = document.getElementById('customLibrary');
  if (!sim.customLibrary.length) lib.textContent = 'Nenhum ainda.';
  else {
    lib.innerHTML = sim.customLibrary.map((c, i) =>
      `<div class="lib-item"><span><strong>${c.name}</strong> — ${(c.points != null && Number.isFinite(Number(c.points))) ? Number(c.points) : 10}pts</span>
       <span style="display:flex;gap:0.25rem">
         <button data-edit="${i}" class="primary">Editar</button>
         <button data-del="${i}" class="danger">Excluir</button>
       </span></div>`
    ).join('');
    lib.querySelectorAll('button[data-del]').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.del);
        if (confirm(`Excluir "${sim.customLibrary[i].name}"?`)) {
          sim.customLibrary.splice(i, 1);
          persist('obr_custom_tiles', sim.customLibrary);
          refreshCustomSelect();
        }
      };
    });
    lib.querySelectorAll('button[data-edit]').forEach(btn => {
      btn.onclick = () => loadCustomTileIntoCtor(parseInt(btn.dataset.edit));
    });
  }
  renderTilePalette();
}

// ─── Paleta de ladrilhos unificada (padrão + personalizados) com preview ──
const BUILTIN_TILE_DEFS = [
  { type: 'start', label: 'Start' },
  { type: 'finish', label: 'Chegada' },
  { type: 'straight', label: 'Reta' },
  { type: 'curve90', label: 'Curva 90°' },
  { type: 'gap', label: 'Gap' },
  { type: 'checkpoint', label: 'Checkpoint' },
  { type: 'intersection', label: 'Interseção' },
  { type: 'intersection_t', label: 'Interseção T' },
  { type: 'lombada', label: 'Lombada' },
  { type: 'deadend', label: 'Beco' },
  { type: 'rescue_entry', label: 'Entrada' },
  { type: 'rescue_green', label: 'Área verde' },
  { type: 'rescue_red', label: 'Área vermelha' },
  { type: 'rescue_exit', label: 'Saída' },
  { type: 'erase', label: 'Apagar piso' }
];

function renderTilePreviewToCanvas(cnv, type, customDef) {
  const S = cnv.width;
  const pctx = cnv.getContext('2d');
  pctx.clearRect(0, 0, S, S);
  if (type === 'erase') {
    pctx.fillStyle = '#1a232e';
    pctx.fillRect(0, 0, S, S);
    pctx.strokeStyle = '#576573';
    pctx.lineWidth = Math.max(1, S * 0.03);
    pctx.beginPath();
    pctx.moveTo(S * 0.28, S * 0.28); pctx.lineTo(S * 0.72, S * 0.72);
    pctx.moveTo(S * 0.72, S * 0.28); pctx.lineTo(S * 0.28, S * 0.72);
    pctx.stroke();
    return;
  }
  if (type === 'custom' && customDef) {
    pctx.fillStyle = '#e2e8f0';
    pctx.fillRect(0, 0, S, S);
    if (customDef.bitmap) {
      const img = new Image();
      img.onload = () => { pctx.imageSmoothingEnabled = false; pctx.drawImage(img, 0, 0, S, S); };
      img.src = customDef.bitmap;
    } else {
      pctx.fillStyle = '#64748b';
      pctx.font = `${Math.round(S * 0.1)}px sans-serif`;
      pctx.textAlign = 'center';
      pctx.fillText(customDef.name || 'custom', S / 2, S / 2);
    }
    return;
  }
  // ladrilhos padrão: reaproveita a mesma lógica visual de drawTile, em escala S
  pctx.fillStyle = '#f1f5f9';
  pctx.strokeStyle = '#cbd5e1';
  pctx.lineWidth = 1;
  pctx.fillRect(0, 0, S, S);
  pctx.strokeRect(0, 0, S, S);
  const hLineP = () => {
    pctx.strokeStyle = '#1e293b'; pctx.lineWidth = S * 0.055; pctx.lineCap = 'round';
    pctx.beginPath(); pctx.moveTo(S * 0.07, S / 2); pctx.lineTo(S * 0.93, S / 2); pctx.stroke();
  };
  switch (type) {
    case 'start':
      hLineP(); pctx.fillStyle = '#22c55e';
      pctx.beginPath(); pctx.arc(S / 2, S * 0.7, S * 0.09, 0, Math.PI * 2); pctx.fill();
      break;
    case 'finish':
      hLineP(); pctx.fillStyle = '#ef4444'; pctx.fillRect(S * 0.11, S / 2 - S * 0.06, S * 0.78, S * 0.12);
      break;
    case 'straight': hLineP(); break;
    case 'curve90':
      pctx.strokeStyle = '#1e293b'; pctx.lineWidth = S * 0.055; pctx.lineCap = 'round';
      pctx.beginPath(); pctx.moveTo(S * 0.07, S / 2); pctx.lineTo(S / 2, S / 2); pctx.lineTo(S / 2, S * 0.07); pctx.stroke();
      break;
    case 'gap':
      pctx.strokeStyle = '#1e293b'; pctx.lineWidth = S * 0.055;
      pctx.beginPath(); pctx.moveTo(S * 0.08, S / 2); pctx.lineTo(S * 0.38, S / 2);
      pctx.moveTo(S * 0.62, S / 2); pctx.lineTo(S * 0.92, S / 2); pctx.stroke();
      pctx.fillStyle = 'rgba(168,85,247,0.3)'; pctx.fillRect(S * 0.38, S * 0.4, S * 0.24, S * 0.2);
      break;
    case 'checkpoint':
      hLineP(); pctx.fillStyle = '#f97316';
      pctx.beginPath(); pctx.arc(S / 2, S * 0.7, S * 0.1, 0, Math.PI * 2); pctx.fill();
      break;
    case 'intersection':
      pctx.strokeStyle = '#1e293b'; pctx.lineWidth = S * 0.055;
      pctx.beginPath(); pctx.moveTo(S * 0.08, S / 2); pctx.lineTo(S * 0.92, S / 2); pctx.moveTo(S / 2, S * 0.08); pctx.lineTo(S / 2, S * 0.92); pctx.stroke();
      pctx.fillStyle = '#22c55e'; pctx.fillRect(S / 2 - S * 0.2, S / 2 - S * 0.2, S * 0.15, S * 0.15);
      break;
    case 'intersection_t':
      pctx.strokeStyle = '#1e293b'; pctx.lineWidth = S * 0.055;
      pctx.beginPath(); pctx.moveTo(S * 0.08, S / 2); pctx.lineTo(S * 0.92, S / 2); pctx.moveTo(S / 2, S / 2); pctx.lineTo(S / 2, S * 0.92); pctx.stroke();
      break;
    case 'lombada':
      hLineP(); pctx.fillStyle = '#94a3b8';
      for (let i = 0; i < 3; i++) { pctx.beginPath(); pctx.ellipse(S * 0.28 + i * S * 0.2, S / 2, S * 0.08, S * 0.045, 0, 0, Math.PI * 2); pctx.fill(); }
      break;
    case 'deadend':
      hLineP(); pctx.fillStyle = '#1e293b'; pctx.fillRect(S / 2 - S * 0.05, S * 0.12, S * 0.1, S * 0.4);
      break;
    case 'rescue_entry':
      pctx.fillStyle = '#e2e8f0'; pctx.fillRect(0, 0, S, S);
      pctx.fillStyle = '#94a3b8'; pctx.fillRect(S - S * 0.13, S * 0.1, S * 0.09, S * 0.8);
      break;
    case 'rescue_green':
      pctx.fillStyle = '#e2e8f0'; pctx.fillRect(0, 0, S, S);
      pctx.fillStyle = '#22c55e'; pctx.beginPath(); pctx.moveTo(0, 0); pctx.lineTo(S * 0.55, 0); pctx.lineTo(0, S * 0.55); pctx.closePath(); pctx.fill();
      break;
    case 'rescue_red':
      pctx.fillStyle = '#e2e8f0'; pctx.fillRect(0, 0, S, S);
      pctx.fillStyle = '#ef4444'; pctx.beginPath(); pctx.moveTo(S, 0); pctx.lineTo(S * 0.45, 0); pctx.lineTo(S, S * 0.55); pctx.closePath(); pctx.fill();
      break;
    case 'rescue_exit':
      pctx.fillStyle = '#e2e8f0'; pctx.fillRect(0, 0, S, S);
      pctx.fillStyle = '#1e293b'; pctx.fillRect(S * 0.04, S * 0.1, S * 0.09, S * 0.8);
      break;
    default:
      pctx.fillStyle = '#64748b'; pctx.fillRect(S * 0.3, S * 0.3, S * 0.4, S * 0.4);
  }
}

function attachTilePreviewHover(btn, type, customDef, label) {
  btn.addEventListener('mouseenter', () => {
    if (!tilePreviewPop) return;
    renderTilePreviewToCanvas(tilePreviewCanvas, type, customDef);
    tilePreviewCap.textContent = label;
    tilePreviewPop.classList.add('show');
    positionTilePreview(btn);
  });
  btn.addEventListener('mouseleave', () => { if (tilePreviewPop) tilePreviewPop.classList.remove('show'); });
}
function positionTilePreview(btn) {
  const r = btn.getBoundingClientRect();
  const popW = 140, popH = 170;
  let left = r.left - popW - 10;
  if (left < 8) left = r.right + 10;
  let top = r.top;
  if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
  tilePreviewPop.style.left = left + 'px';
  tilePreviewPop.style.top = Math.max(8, top) + 'px';
}


function clearTileSelection() {
  _clearTileSelection(sim);
}

function shouldKeepToolArmed(ev) {
  return _shouldKeepToolArmed(ev);
}

function selectTileTool(type, customIdx) {
  _selectTileTool(sim, type, customIdx, { logUI });
}

function renderTilePalette() {
  const wrap = document.getElementById('tileTools');
  if (!wrap) return;
  const prevSelected = sim.selectedTool;
  const prevCustomIdx = sim.placingCustomId;
  wrap.innerHTML = '';

  const makeSwatchCanvas = () => {
    const c = document.createElement('canvas');
    c.width = 44; c.height = 44;
    return c;
  };

  if (!sim.customLibrary.length) {
    const empty = document.createElement('p');
    empty.className = 'key-hint';
    empty.textContent = sim.customMode
      ? 'Nenhum ladrilho custom. Crie no Construtor de ladrilho.'
      : 'Ative Modo Custom e crie ladrilhos no Construtor.';
    wrap.appendChild(empty);
    return;
  }

  const label = document.createElement('div');
  label.className = 'tile-section-label';
  label.textContent = sim.customMode ? 'Criados no app' : 'Bloqueados (ative Modo Custom)';
  wrap.appendChild(label);

  sim.customLibrary.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'tile-btn';
    btn.dataset.type = 'custom';
    btn.dataset.customidx = i;
    btn.dataset.dragKind = 'custom';
    btn.title = c.name || ('custom ' + i);
    if (!sim.customMode) {
      btn.disabled = true;
      btn.style.opacity = '0.45';
      btn.title = 'Disponível apenas no Modo Custom';
      btn.draggable = false;
    } else {
      btn.draggable = true;
    }
    const sw = document.createElement('span');
    sw.className = 'swatch';
    const cnv = makeSwatchCanvas();
    renderTilePreviewToCanvas(cnv, 'custom', c);
    sw.appendChild(cnv);
    const del = document.createElement('button');
    del.className = 'del-x';
    del.textContent = '✕';
    del.title = 'Excluir ladrilho personalizado';
    del.onclick = (ev) => {
      ev.stopPropagation();
      if (confirm(`Excluir "${c.name}"?`)) {
        sim.customLibrary.splice(i, 1);
        persist('obr_custom_tiles', sim.customLibrary);
        if (sim.selectedTool === 'custom' && sim.placingCustomId === i) {
          clearTileSelection();
        }
        refreshCustomSelect();
      }
    };
    btn.appendChild(sw);
    btn.appendChild(del);
    btn.onclick = () => selectTileTool('custom', i);
    attachTilePreviewHover(btn, 'custom', c, `${c.name} — custom`);
    if (sim.customMode) {
      btn.addEventListener('dragstart', (ev) => {
        const payload = { kind: 'custom', idx: i };
        setDragPayload(payload);
        ev.dataTransfer.setData('application/x-obr-tile', JSON.stringify(payload));
        ev.dataTransfer.effectAllowed = 'copy';
        try {
          const empty = document.createElement('canvas');
          empty.width = 1; empty.height = 1;
          ev.dataTransfer.setDragImage(empty, 0, 0);
        } catch (_) {}
        btn.classList.add('drag-ghost');
        showTileDragPreview(ev.clientX, ev.clientY, payload, false);
      });
      btn.addEventListener('dragend', () => {
        btn.classList.remove('drag-ghost');
        hideTileDragPreview();
      });
    }
    wrap.appendChild(btn);
  });

  if (prevSelected === 'custom' && prevCustomIdx != null && sim.customLibrary[prevCustomIdx] && sim.customMode) {
    selectTileTool('custom', prevCustomIdx);
  }
}

function setMode(mode) {
  sim.mode = mode;
  sim.running = false;

  // Abas
  document.getElementById('tabSim')?.classList.toggle('active', mode === 'sim');
  document.getElementById('tabEditor')?.classList.toggle('active', mode === 'editor');
  document.getElementById('tabManual')?.classList.toggle('active', mode === 'manual');
  document.getElementById('tabConstructor')?.classList.toggle('active', mode === 'constructor');
  document.getElementById('tabObjConstructor')?.classList.toggle('active', mode === 'objconstructor');
  document.getElementById('tabRobot')?.classList.toggle('active', mode === 'robot');

  // Painéis laterais
  document.getElementById('panelSim')?.classList.toggle('hidden', mode !== 'sim');
  document.getElementById('panelEditor')?.classList.toggle('hidden', mode !== 'editor');
  document.getElementById('panelManual')?.classList.toggle('hidden', mode !== 'manual');
  document.getElementById('panelConstructor')?.classList.toggle('hidden', mode !== 'constructor');
  document.getElementById('panelObjConstructor')?.classList.toggle('hidden', mode !== 'objconstructor');
  document.getElementById('panelRobot')?.classList.toggle('hidden', mode !== 'robot');

  const modeLabels = {
    sim: 'Simulação',
    editor: 'Editor',
    manual: 'Manual',
    constructor: 'Construtor Tile',
    objconstructor: 'Construtor Obj',
    robot: 'Construtor Robô'
  };
  const simModeEl = document.getElementById('simMode');
  if (simModeEl) simModeEl.textContent = modeLabels[mode] || mode;
  const simStateEl = document.getElementById('simState');
  if (simStateEl) simStateEl.textContent = 'Parado';

  // Fecha todos os construtores (só esconde canvases extras)
  closeConstructorTab();
  closeObjConstructorTab();
  closeRobotConstructorTab();

  const isCtorMode = mode === 'constructor' || mode === 'objconstructor' || mode === 'robot';
  if (!isCtorMode) {
    // Volta a arena principal
    document.getElementById('arena')?.classList.remove('hidden');
    document.getElementById('arenaZoomBar')?.classList.remove('hidden');
  }

  try {
    if (mode === 'constructor') {
      openConstructorTab();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Construtor de ladrilho 3×3. Shift+meio=pan · Scroll=zoom';
    } else if (mode === 'objconstructor') {
      openObjConstructorTab();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Construtor de objeto 300×300. Só pincel/cores. Ctrl+Z/Y';
    } else if (mode === 'robot') {
      openRobotConstructorTab();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Construtor de robô: corpo + detectores under/forward. +Y = frente.';
    } else if (mode === 'editor') {
      if (!sim.tiles.length) ensureGridMatrix();
      // Oficial por padrão; App/Custom só quando modo custom
      setEditorLayer(sim.customMode ? 'tiles' : 'official');
      updateCustomObjectUI();
      updateExportHint();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Arraste da paleta · arraste tile para mover/remover · Shift+R anti-horário · Meio=picker · Clique direito=props';
      fitCamera(); draw();
      schedulePathfinding();
    } else if (mode === 'manual') {
      if (!sim.robot) placeRobotAtStart();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'WASD/setas. Após chegada use Voltar ao Início.';
      fitCamera(); draw();
    } else {
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Play/Pause/Step. Zoom Fit para ver tudo.';
      fitCamera(); draw();
    }
  } catch (err) {
    console.error('setMode error:', mode, err);
  }
}

// ─── Editor mouse ────────────────────────────────────────────
canvas.addEventListener('click', e => {
  if (e.button !== 0 || cam.panning) return;
  const w = screenToWorld(e.clientX, e.clientY);
  const { gx, gy } = worldToGrid(w.x, w.y);

  if (sim.mode === 'editor') {
    if (sim.measureMode) {
      if (!sim.measureStart) {
        sim.measureStart = { x: w.x, y: w.y };
      } else {
        const scaleMm = 300 / TILE_PX;
        const distMm = Math.hypot(w.x - sim.measureStart.x, w.y - sim.measureStart.y) * scaleMm;
        logUI({ t: 0, msg: `Medição (arena): ${distMm.toFixed(1)} mm`, category: 'info' });
        sim.measureStart = null;
        sim.measureCursor = null;
        // keep measure mode active for multiple measures
      }
      draw();
      return;
    }
    // Clique fora da grade: desseleciona e limpa propriedades
    if (gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH) {
      if (sim.selectedTile || sim.selectedObject) {
        sim.selectedTile = null;
        sim.selectedObject = null;
        const info = document.getElementById('selectedInfo');
        if (info) info.textContent = '— (seleção)';
        if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(null);
        draw();
      }
      return;
    }
    let tile = sim.tiles.find(t => t.gx === gx && t.gy === gy);
    if (!tile) { tile = new Tile(gx, gy); sim.tiles.push(tile); }

    // --- MARCADORES (start/chegada/checkpoint) em qualquer ladrilho ---
    if (sim.markerTool) {
      if (tile.type === TileType.EMPTY) {
        logUI({ t: 0, msg: 'Coloque um ladrilho de piso antes de marcar.', category: 'warning' });
        return;
      }
      pushArenaUndo();
      if (sim.markerTool === 'clear') {
        tile.markStart = false;
        tile.markFinish = false;
        tile.markCheckpoint = false;
      } else if (sim.markerTool === 'start') {
        // apenas um start na arena
        sim.tiles.forEach(tt => { if (tt !== tile) tt.markStart = false; });
        tile.markStart = !tile.markStart;
      } else if (sim.markerTool === 'finish') {
        tile.markFinish = !tile.markFinish;
      } else if (sim.markerTool === 'checkpoint') {
        tile.markCheckpoint = !tile.markCheckpoint;
      }
      sim.selectedTile = tile;
      sim.selectedObject = null;
      const flags = [
        tile.markStart ? 'START' : null,
        tile.markFinish ? 'CHEGADA' : null,
        tile.markCheckpoint ? 'CP' : null
      ].filter(Boolean).join('+') || 'nenhum';
      document.getElementById('selectedInfo').textContent = `${tile.type} @${gx},${gy} [${flags}]`;
      if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(tile);
      draw();
      return;
    }

    // --- camada de OBJETOS ---
    if (sim.objectTool) {
      pushArenaUndo();
      if (sim.objectTool === 'erase') {
        sim.objects = sim.objects.filter(o => !(o.gx === gx && o.gy === gy));
        sim.selectedObject = null;
      } else if (sim.objectTool === 'custom') {
        if (!sim.customMode) {
          logUI({ t: 0, msg: 'Modo oficial: objetos personalizados bloqueados.', category: 'warning' });
          return;
        }
        const osel = document.getElementById('customObjSelect');
        if (osel && osel.value !== '') sim.placingCustomObjId = parseInt(osel.value, 10);
        const oid = sim.placingCustomObjId;
        if (oid != null && Number.isFinite(oid) && sim.customObjLibrary[oid]) {
          const def = JSON.parse(JSON.stringify(sim.customObjLibrary[oid]));
          def._instanceId = 'o' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          sim.objects = sim.objects.filter(o => !(o.gx === gx && o.gy === gy));
          const obj = { gx, gy, type: 'custom', rotation: 0, mirrorH: false, mirrorV: false, custom: def, points: def.points, _img: null, _imgSrc: null, _imgToken: null };
          sim.objects.push(obj);
          sim.selectedObject = obj;
        }
      } else {
        sim.objects = sim.objects.filter(o => !(o.gx === gx && o.gy === gy));
        const pts = sim.objectTool === 'rampa' ? 10 : 20;
        const obj = { gx, gy, type: sim.objectTool, rotation: 0, mirrorH: false, mirrorV: false, points: pts };
        sim.objects.push(obj);
        sim.selectedObject = obj;
      }
      document.getElementById('selectedInfo').textContent = sim.selectedObject
        ? `obj ${sim.selectedObject.type} @${gx},${gy}` : '—';
      draw();
      return;
    }

    // --- camada de LADRILHOS ---
    if (sim.selectedTool === 'erase' || sim.selectedTool === 'custom' || sim.selectedTool === 'official' || sim.selectedTool) {
      pushArenaUndo();
    }
    if (sim.selectedTool === 'erase') {
      tile.type = TileType.EMPTY; tile.custom = null; tile.rotation = 0; tile.mirrorH = false; tile.mirrorV = false;
      tile._img = null; tile._imgSrc = null; tile._imgToken = null;
      tile.opts = {};
      tile.markStart = false; tile.markFinish = false; tile.markCheckpoint = false;
      sim.selectedTile = null;
    } else if (sim.selectedTool === 'official' && sim.placingOfficialFile) {
      const file = sim.placingOfficialFile;
      const entry = (sim.officialTileFiles || []).find(x => x.file === file);
      const type = (entry && entry.type) || classifyOfficialFilename(file);
      tile.type = type;
      tile.custom = null;
      tile._img = null; tile._imgSrc = null; tile._imgToken = null;
      // espelhamento sempre desligado para peças oficiais (compatibilidade)
      tile.rotation = 0;
      tile.mirrorH = false;
      tile.mirrorV = false;
      tile.opts = {
        officialImage: file,
        officialId: file.replace(/\.png$/i, ''),
        fromOfficialPalette: true
      };
      if (type === 'rescue_exit') tile.markFinish = true;
      tile.gz = sim.currentFloor || 0;
      sim.selectedTile = tile;
      document.getElementById('selectedInfo').textContent = `oficial ${file} @${gx},${gy},z${tile.gz}`;
      if (!sim.shiftDown) clearTileSelection();
      fillTilePropsPanel(tile);
    } else if (sim.selectedTool === 'custom') {
      // Modo oficial: proíbe colocar ladrilhos personalizados
      if (!sim.customMode) {
        logUI({
          t: 0,
          msg: 'Modo oficial ativo: apenas ladrilhos do catálogo OBR. Ative Modo Custom em Backup & dados para usar personalizados.',
          category: 'warning'
        });
        return;
      }
      const cid = sim.placingCustomId;
      if (cid != null && Number.isFinite(cid) && sim.customLibrary[cid]) {
        tile.type = TileType.CUSTOM;
        tile.custom = JSON.parse(JSON.stringify(sim.customLibrary[cid]));
        // token único força recarregar bitmap (evita “custom antigo” na tela)
        tile.custom._instanceId = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        tile.rotation = 0; tile.mirrorH = false; tile.mirrorV = false;
        tile.gz = sim.currentFloor || 0;
        tile._img = null; tile._imgSrc = null; tile._imgToken = null;
        sim.selectedTile = tile;
        document.getElementById('selectedInfo').textContent = `custom "${tile.custom.name}" @${gx},${gy},z${tile.gz}`;
        if (!sim.shiftDown) clearTileSelection();
        fillTilePropsPanel(tile);
      }
    } else if (sim.selectedTool && sim.selectedTool !== 'official') {
      tile.type = sim.selectedTool;
      tile.custom = null;
      tile._img = null; tile._imgSrc = null; tile._imgToken = null;
      tile.opts = sim.selectedTool === 'intersection' ? { hasGreen: true } : {};
      tile.rotation = 0; tile.mirrorH = false; tile.mirrorV = false;
      tile.gz = sim.currentFloor || 0;
      // tipos clássicos também ligam o marcador correspondente
      if (sim.selectedTool === 'start') {
        sim.tiles.forEach(tt => { if (tt !== tile) { tt.markStart = false; } });
        tile.markStart = true; tile.markFinish = false; tile.markCheckpoint = false;
      } else if (sim.selectedTool === 'finish') {
        tile.markFinish = true;
      } else if (sim.selectedTool === 'checkpoint') {
        tile.markCheckpoint = true;
      }
      sim.selectedTile = tile;
      document.getElementById('selectedInfo').textContent = `${tile.type} @${gx},${gy}`;
      if (!sim.shiftDown && sim.selectedTool) clearTileSelection();
      fillTilePropsPanel(tile);
    } else {
      // Sem ferramenta armada: selecionar / desselecionar
      const obj = (sim.objects || []).find(o => o.gx === gx && o.gy === gy && (o.gz || 0) === (sim.currentFloor || 0));
      if (obj) {
        sim.selectedObject = obj;
        sim.selectedTile = null;
        document.getElementById('selectedInfo').textContent = `obj ${obj.type} @${gx},${gy}`;
        if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(null);
      } else if (tile.type !== TileType.EMPTY) {
        sim.selectedTile = tile;
        sim.selectedObject = null;
        document.getElementById('selectedInfo').textContent =
          `${tile.type} @${gx},${gy} rot=${tile.rotation || 0}°`;
        if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(tile);
      } else {
        // Célula vazia: desseleciona
        sim.selectedTile = null;
        sim.selectedObject = null;
        const info = document.getElementById('selectedInfo');
        if (info) info.textContent = '— (seleção)';
        if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(null);
      }
    }
    draw();
    schedulePathfinding();
  } else if (sim.mode === 'manual' && sim.placingRobot) {
    if (!sim.robot) sim.robot = new Robot(w.x, w.y, 0);
    else { sim.robot.pos.x = w.x; sim.robot.pos.y = w.y; }
    sim.placingRobot = false;
    document.getElementById('btnPlaceRobot').textContent = 'Posicionar Robô';
    draw();
  }
});

// Middle-click picker + pan
canvas.addEventListener('mousedown', e => {
  // Shift + botão do meio = pan da câmera
  if (e.button === 1 && e.shiftKey) {
    e.preventDefault();
    cam.panning = true;
    cam.lastX = e.clientX;
    cam.lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
  }
});
canvas.addEventListener('mousemove', e => {
  if (cam.panning) {
    cam.ox += e.clientX - cam.lastX;
    cam.oy += e.clientY - cam.lastY;
    cam.lastX = e.clientX;
    cam.lastY = e.clientY;
    cam.userZoom = cam.scale;
    updateZoomUI();
    draw();
    return;
  }
  if (sim.mode === 'editor' && sim.measureMode) {
    const wpos = screenToWorld(e.clientX, e.clientY);
    sim.measureCursor = { x: wpos.x, y: wpos.y };
    draw();
  }
});
window.addEventListener('mouseup', () => {
  if (cam.panning) {
    cam.panning = false;
    canvas.style.cursor = '';
  }
});

canvas.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
canvas.addEventListener('auxclick', e => {
  if (e.button !== 1 || sim.mode !== 'editor') return;
  e.preventDefault();
  // if minimal movement, treat as picker not pan
  const w = screenToWorld(e.clientX, e.clientY);
  const { gx, gy } = worldToGrid(w.x, w.y);
  const tile = sim.tiles.find(t => t.gx === gx && t.gy === gy);
  if (!tile || tile.type === TileType.EMPTY) return;

  sim.selectedTile = tile;
  sim.objectTool = null;
  sim.markerTool = null;
  document.querySelectorAll('#objectTools button, #markerTools button').forEach(b => b.classList.remove('active-tool'));

  // Ladrilho oficial (skin do catálogo OBR)
  if (tile.opts && tile.opts.officialImage) {
    const file = tile.opts.officialImage;
    setEditorLayer('official');
    // garante paleta carregada antes de destacar o botão
    ensureOfficialPalette().then(() => {
      selectOfficialTile(file);
      document.getElementById('selectedInfo').textContent =
        `oficial ${file} @${gx},${gy} rot=${tile.rotation || 0}`;
      logUI({ t: 0, msg: `Picker: oficial ${file}`, category: 'info' });
      draw();
    });
    return;
  }

  // Ladrilho personalizado
  if (tile.type === TileType.CUSTOM && tile.custom) {
    setEditorLayer('tiles');
    let idx = sim.customLibrary.findIndex(c => c.name === tile.custom.name);
    if (idx < 0) {
      sim.customLibrary.push(JSON.parse(JSON.stringify(tile.custom)));
      idx = sim.customLibrary.length - 1;
      refreshCustomSelect();
    }
    selectTileTool('custom', idx);
    document.getElementById('selectedInfo').textContent =
      `custom "${tile.custom.name}" @${gx},${gy}`;
    logUI({ t: 0, msg: `Picker: custom "${tile.custom.name}"`, category: 'info' });
    draw();
    return;
  }

  // Ladrilho padrão do app
  setEditorLayer('tiles');
  selectTileTool(tile.type, null);
  document.getElementById('selectedInfo').textContent =
    `${tile.type} @${gx},${gy} rot=${tile.rotation || 0}`;
  logUI({ t: 0, msg: `Picker: ${tile.type}`, category: 'info' });
  draw();
});

canvas.addEventListener('contextmenu', e => {
  if (sim.mode !== 'editor') return;
  e.preventDefault();
  const w = screenToWorld(e.clientX, e.clientY);
  const { gx, gy } = worldToGrid(w.x, w.y);
  const z = sim.currentFloor || 0;
  const tile = sim.tiles.find(t => t.gx === gx && t.gy === gy && (t.gz || 0) === z)
    || sim.tiles.find(t => t.gx === gx && t.gy === gy);
  if (!tile || tile.type === TileType.EMPTY) {
    hideTileContextMenu();
    logUI({ t: 0, msg: 'Nenhum ladrilho nesta célula.', category: 'warning' });
    return;
  }
  sim.selectedTile = tile;
  showTileContextMenu(e.clientX, e.clientY, tile);
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  setZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });

// ─── Constructor pixel 3×3 (centro 300×300 mm, 1px=1mm) + grid lock ─
const CELL_MM = 300;          // um ladrilho
const GRID_CELLS = 3;         // 3×3
const CANVAS_MM = CELL_MM * GRID_CELLS; // 900
const ctor = {
  tool: 'paint',
  color: '#000000',
  brush: 20,
  shape: 'round',
  gridLock: 10,
  painting: false,
  buf: null,
  bufCtx: null,
  scale: 1,
  ox: 0,
  oy: 0,
  panning: false,
  lastX: 0,
  lastY: 0,
  // undo / redo
  undoStack: [],
  redoStack: [],
  maxHistory: 40,
  strokeSaved: false,
  cursorX: null,
  cursorY: null,
  // linha entre 2 pontos
  lineStart: null,  // {x,y} ou null
  editingIndex: null  // índice na biblioteca quando editando ladrilho existente
};

const ctorCanvas = document.getElementById('ctorCanvas');
const ctorCtx = ctorCanvas.getContext('2d');

function initCtorBuffer() {
  const c = document.createElement('canvas');
  c.width = CANVAS_MM;
  c.height = CANVAS_MM;
  ctor.buf = c;
  ctor.bufCtx = c.getContext('2d');
  clearCtorBuffer();
}

function clearCtorBuffer() {
  const ctx = ctor.bufCtx;
  // Fundo padrão branco em todo o canvas 3×3 (centro = ladrilho)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_MM, CANVAS_MM);
  ctor.undoStack = [];
  ctor.redoStack = [];
}

function openConstructorTab() {
  try {
    if (!ctor.buf) initCtorBuffer();
    // Esconde todos os outros canvases
    document.getElementById('arena')?.classList.add('hidden');
    document.getElementById('arenaZoomBar')?.classList.add('hidden');
    document.getElementById('objCtorCanvas')?.classList.add('hidden');
    document.getElementById('objCtorZoomBar')?.classList.add('hidden');
    document.getElementById('robotCtorCanvas')?.classList.add('hidden');
    document.getElementById('robotCtorZoomBar')?.classList.add('hidden');
    if (ctorCanvas) ctorCanvas.classList.remove('hidden');
    document.getElementById('ctorZoomBar')?.classList.remove('hidden');
    // sync UI
    setGridLock(ctor.gridLock || 10);
    const brushEl = document.getElementById('brushSize');
    if (brushEl) brushEl.value = ctor.brush;
    const brushLbl = document.getElementById('brushSizeLabel');
    if (brushLbl) brushLbl.textContent = ctor.brush + ' mm';
    const brushNum = document.getElementById('brushSizeNum');
    if (brushNum) brushNum.value = ctor.brush;
    const sw = document.getElementById('activeColorSwatch');
    if (sw) sw.style.background = ctor.color;
    fitCtorCanvas();
    drawCtor();
  } catch (err) {
    console.error('openConstructorTab:', err);
    logUI({ t: 0, msg: 'Erro ao abrir construtor: ' + err.message, category: 'error' });
  }
}

function closeConstructorTab() {
  if (ctorCanvas) ctorCanvas.classList.add('hidden');
  document.getElementById('ctorZoomBar')?.classList.add('hidden');
}

function fitCtorCanvas() {
  const wrap = document.getElementById('canvasWrap');
  const r = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(200, r.width - 16);
  const cssH = Math.max(200, r.height - 16);
  ctorCanvas.style.width = cssW + 'px';
  ctorCanvas.style.height = cssH + 'px';
  ctorCanvas.width = Math.floor(cssW * dpr);
  ctorCanvas.height = Math.floor(cssH * dpr);
  ctorCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // fit 900mm world into view
  const pad = 20;
  const sx = (cssW - pad * 2) / CANVAS_MM;
  const sy = (cssH - pad * 2) / CANVAS_MM;
  ctor.scale = Math.min(sx, sy, 2);
  if (ctor.scale < 0.1) ctor.scale = 0.1;
  ctor.ox = (cssW - CANVAS_MM * ctor.scale) / 2;
  ctor.oy = (cssH - CANVAS_MM * ctor.scale) / 2;
}

function setCtorZoom(factor) {
  const cssW = ctorCanvas.clientWidth;
  const cssH = ctorCanvas.clientHeight;
  const cx = cssW / 2, cy = cssH / 2;
  const wx = (cx - ctor.ox) / ctor.scale;
  const wy = (cy - ctor.oy) / ctor.scale;
  ctor.scale = Math.max(0.08, Math.min(4, ctor.scale * factor));
  ctor.ox = cx - wx * ctor.scale;
  ctor.oy = cy - wy * ctor.scale;
  drawCtor();
}

function drawCtor() {
  if (!ctor.buf) return;
  const cssW = ctorCanvas.clientWidth;
  const cssH = ctorCanvas.clientHeight;
  ctorCtx.save();
  ctorCtx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctorCtx.fillStyle = '#0b1220';
  ctorCtx.fillRect(0, 0, cssW, cssH);

  ctorCtx.translate(ctor.ox, ctor.oy);
  ctorCtx.scale(ctor.scale, ctor.scale);
  ctorCtx.imageSmoothingEnabled = false;
  ctorCtx.drawImage(ctor.buf, 0, 0);

  // cell borders 3×3
  const cell = CELL_MM;
  ctorCtx.strokeStyle = '#3b82f6';
  ctorCtx.lineWidth = 2 / ctor.scale;
  ctorCtx.strokeRect(cell, cell, cell, cell);
  ctorCtx.strokeStyle = 'rgba(148,163,184,0.55)';
  ctorCtx.lineWidth = 1 / ctor.scale;
  for (let i = 0; i <= 3; i++) {
    ctorCtx.beginPath(); ctorCtx.moveTo(i * cell, 0); ctorCtx.lineTo(i * cell, CANVAS_MM); ctorCtx.stroke();
    ctorCtx.beginPath(); ctorCtx.moveTo(0, i * cell); ctorCtx.lineTo(CANVAS_MM, i * cell); ctorCtx.stroke();
  }

  // Cruz vermelha clara no centro de CADA célula 3×3 (eixo H/V)
  ctorCtx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
  ctorCtx.lineWidth = 1 / ctor.scale;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = col * cell + cell / 2;
      const cy = row * cell + cell / 2;
      // horizontal
      ctorCtx.beginPath();
      ctorCtx.moveTo(col * cell, cy);
      ctorCtx.lineTo((col + 1) * cell, cy);
      ctorCtx.stroke();
      // vertical
      ctorCtx.beginPath();
      ctorCtx.moveTo(cx, row * cell);
      ctorCtx.lineTo(cx, (row + 1) * cell);
      ctorCtx.stroke();
    }
  }

  // label
  ctorCtx.fillStyle = '#94a3b8';
  ctorCtx.font = `${12 / ctor.scale}px sans-serif`;
  ctorCtx.textAlign = 'center';
  ctorCtx.fillText('LADRILHO 300×300 mm', CANVAS_MM / 2, cell + 14 / ctor.scale);

  // grid lock no centro
  if (ctor.gridLock > 1) {
    const step = ctor.gridLock;
    ctorCtx.strokeStyle = 'rgba(59,130,246,0.12)';
    ctorCtx.lineWidth = 1 / ctor.scale;
    for (let x = cell; x <= cell * 2; x += step) {
      ctorCtx.beginPath(); ctorCtx.moveTo(x, cell); ctorCtx.lineTo(x, cell * 2); ctorCtx.stroke();
    }
    for (let y = cell; y <= cell * 2; y += step) {
      ctorCtx.beginPath(); ctorCtx.moveTo(cell, y); ctorCtx.lineTo(cell * 2, y); ctorCtx.stroke();
    }
  }

  // Preview do pincel ou da linha (2 pontos)
  if (ctor.cursorX != null && ctor.cursorY != null && !ctor.panning) {
    ctorCtx.save();
    if (ctor.tool === 'line' || ctor.tool === 'measure') {
      const lw = Math.max(1, ctor.brush | 0);
      if (ctor.tool === 'measure') {
        ctorCtx.lineWidth = 1.5 / ctor.scale;
        ctorCtx.strokeStyle = 'rgba(234,179,8,0.95)';
        ctorCtx.setLineDash([6 / ctor.scale, 4 / ctor.scale]);
        if (ctor.lineStart) {
          ctorCtx.beginPath();
          ctorCtx.moveTo(ctor.lineStart.x, ctor.lineStart.y);
          ctorCtx.lineTo(ctor.cursorX, ctor.cursorY);
          ctorCtx.stroke();
          const dist = Math.hypot(ctor.cursorX - ctor.lineStart.x, ctor.cursorY - ctor.lineStart.y);
          ctorCtx.setLineDash([]);
          ctorCtx.fillStyle = '#fbbf24';
          ctorCtx.font = `${13 / ctor.scale}px sans-serif`;
          ctorCtx.textAlign = 'center';
          ctorCtx.fillText(dist.toFixed(1) + ' mm', (ctor.lineStart.x + ctor.cursorX) / 2, (ctor.lineStart.y + ctor.cursorY) / 2 - 8 / ctor.scale);
        }
      } else {
        // preview linha com espessura e forma
        ctorCtx.strokeStyle = 'rgba(59,130,246,0.7)';
        ctorCtx.fillStyle = 'rgba(59,130,246,0.35)';
        ctorCtx.lineCap = ctor.shape === 'square' ? 'square' : 'round';
        ctorCtx.lineJoin = ctor.shape === 'square' ? 'miter' : 'round';
        ctorCtx.lineWidth = lw;
        ctorCtx.setLineDash([6 / ctor.scale, 4 / ctor.scale]);
        if (ctor.lineStart) {
          ctorCtx.beginPath();
          ctorCtx.moveTo(ctor.lineStart.x + 0.5, ctor.lineStart.y + 0.5);
          ctorCtx.lineTo(ctor.cursorX + 0.5, ctor.cursorY + 0.5);
          ctorCtx.stroke();
          ctorCtx.setLineDash([]);
          if (ctor.shape === 'square') {
            ctorCtx.fillRect(ctor.lineStart.x - lw / 2, ctor.lineStart.y - lw / 2, lw, lw);
          } else {
            ctorCtx.beginPath();
            ctorCtx.arc(ctor.lineStart.x + 0.5, ctor.lineStart.y + 0.5, Math.max(1, lw / 2), 0, Math.PI * 2);
            ctorCtx.fill();
          }
        } else {
          ctorCtx.setLineDash([]);
          ctorCtx.lineWidth = 1.5 / ctor.scale;
          if (ctor.shape === 'square') {
            ctorCtx.strokeRect(ctor.cursorX - lw / 2, ctor.cursorY - lw / 2, lw, lw);
          } else {
            ctorCtx.beginPath();
            ctorCtx.arc(ctor.cursorX + 0.5, ctor.cursorY + 0.5, Math.max(2, lw / 2), 0, Math.PI * 2);
            ctorCtx.stroke();
          }
        }
      }
    } else {
      const s = Math.max(1, ctor.brush | 0);
      const r = Math.max(0.5, s / 2);
      ctorCtx.lineWidth = 1.5 / ctor.scale;
      ctorCtx.setLineDash([4 / ctor.scale, 3 / ctor.scale]);
      if (ctor.tool === 'erase') {
        ctorCtx.strokeStyle = 'rgba(239,68,68,0.85)';
        ctorCtx.fillStyle = 'rgba(239,68,68,0.12)';
      } else {
        ctorCtx.strokeStyle = 'rgba(59,130,246,0.9)';
        ctorCtx.fillStyle = 'rgba(59,130,246,0.12)';
      }
      if (ctor.shape === 'square') {
        ctorCtx.fillRect(ctor.cursorX - s / 2, ctor.cursorY - s / 2, s, s);
        ctorCtx.strokeRect(ctor.cursorX - s / 2, ctor.cursorY - s / 2, s, s);
      } else {
        ctorCtx.beginPath();
        ctorCtx.arc(ctor.cursorX + 0.5, ctor.cursorY + 0.5, r, 0, Math.PI * 2);
        ctorCtx.fill();
        ctorCtx.stroke();
      }
    }
    ctorCtx.setLineDash([]);
    ctorCtx.restore();
  }
  ctorCtx.restore();
}

function ctorPos(e) {
  const rect = ctorCanvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  // screen → world mm via camera
  let x = (sx - ctor.ox) / ctor.scale;
  let y = (sy - ctor.oy) / ctor.scale;
  const step = Math.max(1, ctor.gridLock | 0);
  x = Math.round(x / step) * step;
  y = Math.round(y / step) * step;
  x = Math.max(0, Math.min(CANVAS_MM - 1, x));
  y = Math.max(0, Math.min(CANVAS_MM - 1, y));
  return { x, y };
}

function bgColorAt(px, py) {
  // Fundo padrão branco em todo o canvas 3×3
  return [255, 255, 255, 255];
}

function pushUndo() {
  if (!ctor.bufCtx) return;
  try {
    const snap = ctor.bufCtx.getImageData(0, 0, CANVAS_MM, CANVAS_MM);
    ctor.undoStack.push(snap);
    if (ctor.undoStack.length > ctor.maxHistory) ctor.undoStack.shift();
    ctor.redoStack = [];
  } catch (e) { /* ignore */ }
}

function undoCtor() {
  if (!ctor.undoStack.length || !ctor.bufCtx) return;
  try {
    const cur = ctor.bufCtx.getImageData(0, 0, CANVAS_MM, CANVAS_MM);
    ctor.redoStack.push(cur);
    const prev = ctor.undoStack.pop();
    ctor.bufCtx.putImageData(prev, 0, 0);
    drawCtor();
  } catch (e) {}
}

function redoCtor() {
  if (!ctor.redoStack.length || !ctor.bufCtx) return;
  try {
    const cur = ctor.bufCtx.getImageData(0, 0, CANVAS_MM, CANVAS_MM);
    ctor.undoStack.push(cur);
    const next = ctor.redoStack.pop();
    ctor.bufCtx.putImageData(next, 0, 0);
    drawCtor();
  } catch (e) {}
}

function stampAt(ctx, x, y, width, shape, color, erase, maxW, maxH, bgFn) {
  const s = Math.max(1, width | 0);
  const r = Math.max(0.5, s / 2);
  if (erase && bgFn) {
    const pad = r + 1;
    const xA = Math.max(0, Math.floor(x - pad));
    const yA = Math.max(0, Math.floor(y - pad));
    const xB = Math.min(maxW - 1, Math.ceil(x + pad));
    const yB = Math.min(maxH - 1, Math.ceil(y + pad));
    const w = xB - xA + 1, h = yB - yA + 1;
    if (w <= 0 || h <= 0) return;
    const img = ctx.getImageData(xA, yA, w, h);
    const d = img.data;
    for (let py = yA; py <= yB; py++) {
      for (let px = xA; px <= xB; px++) {
        let inside = false;
        if (shape === 'square')
          inside = px >= x - s / 2 && px < x + s / 2 && py >= y - s / 2 && py < y + s / 2;
        else {
          const ddx = px + 0.5 - x, ddy = py + 0.5 - y;
          inside = ddx * ddx + ddy * ddy <= r * r;
        }
        if (!inside) continue;
        const bg = bgFn(px, py);
        const ii = ((py - yA) * w + (px - xA)) * 4;
        d[ii] = bg[0]; d[ii + 1] = bg[1]; d[ii + 2] = bg[2]; d[ii + 3] = bg[3];
      }
    }
    ctx.putImageData(img, xA, yA);
    return;
  }
  ctx.fillStyle = color;
  if (shape === 'square') {
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  } else {
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function strokeLineOnBuf(ctx, x0, y0, x1, y1, color, width, shape, erase, maxW, maxH, bgFn) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy) || 1;
  // passo menor que a espessura para não ficar pontilhado
  const step = Math.max(0.5, width * 0.35);
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stampAt(ctx, x0 + dx * t, y0 + dy * t, width, shape, color, erase, maxW, maxH, bgFn);
  }
}

function paintAt(x, y) {
  const ctx = ctor.bufCtx;
  const s = Math.max(1, ctor.brush | 0);
  const r = Math.max(0.5, s / 2);

  if (ctor.tool === 'erase') {
    // Apaga só a pintura: restaura pixel a pixel o fundo original (não “vaza” cinza/branco)
    const x0 = Math.max(0, Math.floor(x - r - 1));
    const y0 = Math.max(0, Math.floor(y - r - 1));
    const x1 = Math.min(CANVAS_MM - 1, Math.ceil(x + r + 1));
    const y1 = Math.min(CANVAS_MM - 1, Math.ceil(y + r + 1));
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;
    const img = ctx.getImageData(x0, y0, w, h);
    const d = img.data;
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        let inside = false;
        if (ctor.shape === 'square') {
          inside = px >= x - s / 2 && px < x + s / 2 && py >= y - s / 2 && py < y + s / 2;
        } else {
          const dx = px + 0.5 - x, dy = py + 0.5 - y;
          inside = dx * dx + dy * dy <= r * r;
        }
        if (!inside) continue;
        const bg = bgColorAt(px, py);
        const i = ((py - y0) * w + (px - x0)) * 4;
        d[i] = bg[0]; d[i + 1] = bg[1]; d[i + 2] = bg[2]; d[i + 3] = bg[3];
      }
    }
    ctx.putImageData(img, x0, y0);
    return;
  }

  // pintura normal
  ctx.fillStyle = ctor.color;
  if (ctor.shape === 'square') {
    ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  } else {
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pickColor(x, y) {
  const d = ctor.bufCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  if (d[0] > 240 && d[1] > 240 && d[2] > 240) {
    ctor.tool = 'erase';
  } else {
    ctor.tool = 'paint';
    ctor.color = hex;
    document.getElementById('activeColorSwatch').style.background = hex;
  }
  document.querySelectorAll('#ctorToolsSide button').forEach(b => {
    if (b.dataset.ctor === 'picker' || b.dataset.ctor === 'clear') return;
    const match = b.dataset.ctor === 'paint' && b.dataset.color && b.dataset.color.toLowerCase() === hex.toLowerCase();
    const isErase = b.dataset.ctor === 'erase' && ctor.tool === 'erase';
    b.classList.toggle('active-tool', match || isErase);
  });
}

ctorCanvas.addEventListener('mousedown', e => {
  if (e.button === 1 && e.shiftKey) {
    e.preventDefault();
    ctor.panning = true;
    ctor.lastX = e.clientX;
    ctor.lastY = e.clientY;
    ctorCanvas.style.cursor = 'grabbing';
    return;
  }
  if (e.button === 1) {
    e.preventDefault();
    const p = ctorPos(e);
    pickColor(p.x, p.y);
    return;
  }
  if (e.button !== 0) return;
  const p = ctorPos(e);
  ctor.cursorX = p.x; ctor.cursorY = p.y;
  if (ctor.tool === 'picker') { pickColor(p.x, p.y); return; }
  if (ctor.tool === 'line' || ctor.tool === 'measure') {
    if (!ctor.lineStart) {
      ctor.lineStart = { x: p.x, y: p.y };
      drawCtor();
      return;
    }
    if (ctor.tool === 'measure') {
      const dist = Math.hypot(p.x - ctor.lineStart.x, p.y - ctor.lineStart.y);
      logUI({ t: 0, msg: `Medição (ladrilho): ${dist.toFixed(1)} mm`, category: 'info' });
      ctor.lineStart = null;
      drawCtor();
      return;
    }
    pushUndo();
    strokeLineOnBuf(ctor.bufCtx, ctor.lineStart.x, ctor.lineStart.y, p.x, p.y, ctor.color, ctor.brush, ctor.shape, false, CANVAS_MM, CANVAS_MM, bgColorAt);
    ctor.lineStart = null;
    drawCtor();
    return;
  }
  pushUndo();
  ctor.strokeSaved = true;
  ctor.painting = true;
  paintAt(p.x, p.y);
  drawCtor();
});
ctorCanvas.addEventListener('mousemove', e => {
  if (ctor.panning) {
    ctor.ox += e.clientX - ctor.lastX;
    ctor.oy += e.clientY - ctor.lastY;
    ctor.lastX = e.clientX;
    ctor.lastY = e.clientY;
    drawCtor();
    return;
  }
  const p = ctorPos(e);
  ctor.cursorX = p.x;
  ctor.cursorY = p.y;
  if (ctor.painting) {
    paintAt(p.x, p.y);
  }
  drawCtor();
});
ctorCanvas.addEventListener('mouseleave', () => {
  ctor.cursorX = null;
  ctor.cursorY = null;
  drawCtor();
});
window.addEventListener('mouseup', () => {
  ctor.painting = false;
  ctor.strokeSaved = false;
  if (ctor.panning) {
    ctor.panning = false;
    ctorCanvas.style.cursor = 'crosshair';
  }
});
ctorCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  setCtorZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });
ctorCanvas.addEventListener('contextmenu', e => e.preventDefault());

/** Export only center 300×300 as tile bitmap; zones/objects may extend from full 900 */
function bufferToCustomDef(name, points) {
  // crop center tile for display bitmap
  const tileC = document.createElement('canvas');
  tileC.width = CELL_MM;
  tileC.height = CELL_MM;
  const tctx = tileC.getContext('2d');
  tctx.drawImage(ctor.buf, CELL_MM, CELL_MM, CELL_MM, CELL_MM, 0, 0, CELL_MM, CELL_MM);
  const dataURL = tileC.toDataURL('image/png');

  // full 900 canvas for zone detection in neighbor cells (coords relative to center tile: -1..2)
  const img = ctor.bufCtx.getImageData(0, 0, CANVAS_MM, CANVAS_MM);
  const data = img.data;
  const objects = [];
  const zones = [];
  const step = Math.max(5, ctor.gridLock || 10);

  for (let y = 0; y < CANVAS_MM; y += step) {
    for (let x = 0; x < CANVAS_MM; x += step) {
      const i = (y * CANVAS_MM + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // normalize relative to center tile origin
      const nx = (x - CELL_MM) / CELL_MM;
      const ny = (y - CELL_MM) / CELL_MM;
      const w = step / CELL_MM, h = step / CELL_MM;
      if (r > 200 && g > 80 && g < 160 && b < 80) {
        objects.push({ type: 'obstacle', x: nx, y: ny, w, h });
      } else if (r > 140 && r < 200 && g < 120 && b > 180) {
        objects.push({ type: 'gap', x: nx, y: ny, w, h });
      } else if (g > 150 && r < 100 && b < 120) {
        objects.push({ type: 'green', x: nx, y: ny, w, h });
      } else if (b > 180 && r < 100 && g < 160) {
        zones.push({ x: nx, y: ny, w, h });
      }
    }
  }

  return {
    name, points, pixel: true, sizeMm: CELL_MM,
    bitmap: dataURL,
    // also store full context for advanced use
    fullBitmap: ctor.buf.toDataURL('image/png'),
    objects, zones, lines: []
  };
}

// ─── Bindings ────────────────────────────────────────────────
document.querySelectorAll('.mode-tabs button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const mode = btn.dataset.mode;
    if (mode) setMode(mode);
  });
});

document.getElementById('btnPlay').onclick = () => {
  if (sim.finished || sim.mode !== 'sim') return;
  sim.running = true;
  document.getElementById('simState').textContent = 'Executando';
};
document.getElementById('btnPause').onclick = () => { sim.running = false; document.getElementById('simState').textContent = 'Pausado'; };
document.getElementById('btnStep').onclick = () => {
  if (sim.finished || sim.mode !== 'sim') return;
  sim.running = false; update(sim.dt * 3); draw();
  document.getElementById('simState').textContent = 'Step';
};
document.getElementById('btnReset').onclick = () => loadScenario(sim.currentScenario);
document.getElementById('btnLoad').onclick = () => loadScenario(document.getElementById('scenarioSelect').value);
document.getElementById('speed').oninput = e => { sim.speed = parseFloat(e.target.value); };
document.getElementById('btnRestartRobot').onclick = restartRobot;
document.getElementById('btnRestartRobot2').onclick = restartRobot;

document.getElementById('btnZoomIn').onclick = () => setZoom(1.2);
document.getElementById('btnZoomOut').onclick = () => setZoom(1 / 1.2);
document.getElementById('btnZoomFit').onclick = () => { fitCamera(); draw(); };
document.getElementById('btnZoomReset').onclick = () => {
  cam.scale = 1;
  const { w, h } = worldSize();
  cam.ox = (canvas.clientWidth - w) / 2;
  cam.oy = (canvas.clientHeight - h) / 2;
  cam.userZoom = 1;
  updateZoomUI();
  draw();
};

function setEditorLayer(layer) {
  // layer: 'tiles' | 'official' | 'objects'
  const tilesSec = document.getElementById('editorTilesSection');
  const offSec = document.getElementById('editorOfficialSection');
  const objsSec = document.getElementById('editorObjectsSection');
  const btnT = document.getElementById('btnShowTiles');
  const btnOff = document.getElementById('btnShowOfficial');
  const btnO = document.getElementById('btnShowObjects');
  [tilesSec, offSec, objsSec].forEach(el => el && el.classList.add('hidden'));
  [btnT, btnOff, btnO].forEach(b => {
    if (!b) return;
    b.classList.remove('active-tool', 'primary');
  });
  if (layer === 'objects') {
    if (objsSec) objsSec.classList.remove('hidden');
    if (btnO) { btnO.classList.add('active-tool', 'primary'); }
    sim.selectedTool = null;
    sim.markerTool = null;
    sim.placingOfficialFile = null;
  } else if (layer === 'official') {
    if (offSec) offSec.classList.remove('hidden');
    if (btnOff) { btnOff.classList.add('active-tool', 'primary'); }
    sim.objectTool = null;
    sim.markerTool = null;
    ensureOfficialPalette();
  } else {
    if (tilesSec) tilesSec.classList.remove('hidden');
    if (btnT) { btnT.classList.add('active-tool', 'primary'); }
    sim.objectTool = null;
    sim.placingOfficialFile = null;
  }
  updateMirrorUI();
}
const btnShowTiles = document.getElementById('btnShowTiles');
if (btnShowTiles) btnShowTiles.onclick = () => setEditorLayer('tiles');
const btnShowOfficial = document.getElementById('btnShowOfficial');
if (btnShowOfficial) btnShowOfficial.onclick = () => setEditorLayer('official');
const btnShowObjects = document.getElementById('btnShowObjects');
if (btnShowObjects) btnShowObjects.onclick = () => setEditorLayer('objects');

// ─── Catálogo de ladrilhos oficiais ─────────────────────────
sim.placingOfficialFile = null;
sim.officialTileFiles = []; // [{ file, url, type }]

function classifyOfficialFilename(file) {
  return _classifyOfficialFilename(file);
}

function probeOfficialImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = `assets/official-tiles/${file}`;
    img.onload = () => resolve({ file, url, ok: true, type: classifyOfficialFilename(file) });
    img.onerror = () => resolve({ file, url, ok: false });
    img.src = url;
  });
}

async function loadOfficialTileCatalog() {
  const candidates = [];
  for (let i = 0; i <= 83; i++) candidates.push(`tile-${i}.png`);
  candidates.push('seesaw.png', 'exit.png', 'ev1.png', 'ev2.png', 'ev3.png');
  const results = await Promise.all(candidates.map(probeOfficialImage));
  sim.officialTileFiles = results.filter(r => r.ok);
  return sim.officialTileFiles;
}

function selectOfficialTile(file) {
  _selectOfficialTile(sim, file);
}

function renderOfficialPalette() {
  const wrap = document.getElementById('officialTileTools');
  const status = document.getElementById('officialTileStatus');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!sim.officialTileFiles.length) {
    if (status) status.textContent = 'Nenhuma imagem em assets/official-tiles/. Coloque os PNGs oficiais nessa pasta.';
    return;
  }
  if (status) status.textContent = `${sim.officialTileFiles.length} ladrilhos · arraste para a grade`;
  sim.officialTileFiles.forEach(({ file, url, type }) => {
    const btn = document.createElement('button');
    btn.className = 'tile-btn';
    btn.dataset.official = file;
    btn.dataset.dragKind = 'official';
    btn.draggable = true;
    btn.title = `${file} (${type})`;
    if (sim.placingOfficialFile === file && sim.selectedTool === 'official') btn.classList.add('active-tool');
    const sw = document.createElement('span');
    sw.className = 'swatch';
    const img = document.createElement('img');
    img.src = url;
    img.alt = file;
    img.draggable = false;
    sw.appendChild(img);
    btn.appendChild(sw);
    btn.onclick = () => selectOfficialTile(file);
    btn.addEventListener('dragstart', (ev) => {
      const payload = { kind: 'official', file };
      setDragPayload(payload);
      ev.dataTransfer.setData('application/x-obr-tile', JSON.stringify(payload));
      ev.dataTransfer.effectAllowed = 'copy';
      // imagem fantasma transparente — usamos nosso preview
      try {
        const empty = document.createElement('canvas');
        empty.width = 1; empty.height = 1;
        ev.dataTransfer.setDragImage(empty, 0, 0);
      } catch (_) {}
      btn.classList.add('drag-ghost');
      showTileDragPreview(ev.clientX, ev.clientY, payload, false);
    });
    btn.addEventListener('dragend', () => {
      btn.classList.remove('drag-ghost');
      hideTileDragPreview();
    });
    wrap.appendChild(btn);
  });
}

let _officialPaletteLoaded = false;
async function ensureOfficialPalette() {
  if (!_officialPaletteLoaded) {
    const status = document.getElementById('officialTileStatus');
    if (status) status.textContent = 'Carregando catálogo…';
    await loadOfficialTileCatalog();
    _officialPaletteLoaded = true;
  }
  renderOfficialPalette();
}

function updateMirrorUI() {
  const h = document.getElementById('btnMirrorH');
  const v = document.getElementById('btnMirrorV');
  const hint = document.getElementById('mirrorHint');
  const allow = !!sim.customMode;
  if (h) {
    h.disabled = !allow;
    h.style.opacity = allow ? '1' : '0.45';
    h.title = allow ? 'Espelhar horizontal' : 'Disponível apenas no Modo Custom';
  }
  if (v) {
    v.disabled = !allow;
    v.style.opacity = allow ? '1' : '0.45';
    v.title = allow ? 'Espelhar vertical' : 'Disponível apenas no Modo Custom';
  }
  if (hint) {
    hint.textContent = allow
      ? 'Espelhamento: ativo (Modo Custom).'
      : 'Espelhamento: desativado (ative Modo Custom para usar — evita incompatibilidade com o oficial).';
  }
}

document.querySelectorAll('#objectTools button').forEach(btn => {
  btn.onclick = () => {
    if (btn.dataset.obj === 'custom' && !sim.customMode) {
      logUI({ t: 0, msg: 'Modo oficial: objetos personalizados bloqueados. Ative Modo Custom.', category: 'warning' });
      return;
    }
    document.querySelectorAll('#objectTools button').forEach(b => b.classList.remove('active-tool'));
    document.querySelectorAll('#tileTools button').forEach(b => b.classList.remove('active-tool'));
    document.querySelectorAll('#markerTools button').forEach(b => b.classList.remove('active-tool'));
    btn.classList.add('active-tool');
    sim.objectTool = btn.dataset.obj;
    sim.selectedTool = null;
    sim.markerTool = null;
    if (sim.objectTool === 'custom') {
      const s = document.getElementById('customObjSelect');
      if (s.value !== '') sim.placingCustomObjId = parseInt(s.value);
    }
  };
});
document.querySelectorAll('#markerTools button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#markerTools button').forEach(b => b.classList.remove('active-tool'));
    document.querySelectorAll('#tileTools button').forEach(b => b.classList.remove('active-tool'));
    document.querySelectorAll('#objectTools button').forEach(b => b.classList.remove('active-tool'));
    btn.classList.add('active-tool');
    sim.markerTool = btn.dataset.mark;
    sim.selectedTool = null;
    sim.objectTool = null;
  };
});
function onGridUI(w, h) {
  const gw = document.getElementById('gridW');
  const gh = document.getElementById('gridH');
  const gwv = document.getElementById('gridWVal');
  const ghv = document.getElementById('gridHVal');
  if (gw) gw.value = w;
  if (gh) gh.value = h;
  if (gwv) gwv.textContent = w;
  if (ghv) ghv.textContent = h;
}

function snapshotArena() {
  return _snapshotArena(sim);
}

function applyArenaSnapshot(snap) {
  _applyArenaSnapshot(sim, snap, onGridUI);
}

function pushArenaUndo() {
  _pushArenaUndo(sim);
}

function undoArena() {
  _undoArena(sim, { fitCamera, draw, logUI, onGridUI });
}

function redoArena() {
  _redoArena(sim, { fitCamera, draw, logUI, onGridUI });
}

function rotateSelected(dir = 1) {
  _rotateSelected(sim, dir, { draw, schedulePathfinding });
}
function mirrorSelected(axis) {
  _mirrorSelected(sim, axis, { draw, logUI, updateMirrorUI });
}
document.getElementById('btnRotate').onclick = rotateSelected;
document.getElementById('btnMirrorH').onclick = () => mirrorSelected('h');
document.getElementById('btnMirrorV').onclick = () => mirrorSelected('v');

document.getElementById('btnClearArena').onclick = () => {
  if (confirm('Limpar arena?')) {
    _clearArena(sim, { draw });
  }
};
document.getElementById('btnSaveArena').onclick = () => {
  sim.customArena = sim.tiles.filter(t => t.type !== TileType.EMPTY).map(t => t.toJSON());
  sim.customArenaObjects = JSON.parse(JSON.stringify(sim.objects));
  logUI({ t: 0, msg: `Arena salva (${sim.customArena.length} ladrilhos, ${sim.objects.length} objetos).`, category: 'success' });
  try {
    persist('obr_custom_arena', sim.customArena);
    persist('obr_custom_arena_objects', sim.customArenaObjects);
  } catch (e) {}
};
function downloadJSONFile(filename, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportArenaJSON(forceFormat) {
  // forceFormat: 'official' | 'app' | null (auto by customMode)
  const format = forceFormat || (sim.customMode ? 'app' : 'official');
  try {
    if (format === 'official') {
      syncMapMetaFromUI();
      let official = convertToOfficialArena({
        gridW: sim.gridW,
        gridH: sim.gridH,
        tiles: sim.tiles.filter(t => t.type !== TileType.EMPTY).map(t => t.toJSON()),
        objects: sim.objects,
        meta: sim.officialMeta || {}
      });
      const pf = updateTileIndex(official);
      official = pf.map;
      const v = validateOfficialMap(official);
      if (!v.ok) {
        const msg = v.errors.join('; ');
        logUI({ t: 0, msg: 'Validação oficial: ' + msg, category: 'warning' });
        if (!confirm('Aviso de validação:\\n' + msg + '\\n\\nExportar mesmo assim?')) return;
      }
      const name = (official.name || 'arena').replace(/[^\\w\\-]+/g, '_');
      downloadJSONFile(name + '-oficial.json', official);
      logUI({
        t: 0,
        msg: `Exportado RCJ/OBR (${Object.keys(official.tiles || {}).length} tiles, path index=${official.indexCount || 0})`,
        category: 'success'
      });
    } else {
      const data = {
        gridW: sim.gridW, gridH: sim.gridH,
        tiles: sim.tiles.filter(t => t.type !== TileType.EMPTY).map(t => t.toJSON()),
        objects: sim.objects,
        meta: sim.officialMeta || null
      };
      downloadJSONFile('obr-arena.json', data);
      logUI({ t: 0, msg: 'Exportado no formato do trainer (obr-arena.json).', category: 'success' });
    }
  } catch (err) {
    alert('Falha ao exportar: ' + err.message);
  }
}

document.getElementById('btnExport')?.addEventListener('click', () => exportArenaJSON(null));
document.getElementById('btnExportAlt')?.addEventListener('click', () => {
  // formato alternativo ao modo atual
  exportArenaJSON(sim.customMode ? 'official' : 'app');
});


document.getElementById('btnImportJSON').onclick = () => document.getElementById('importFile').click();
document.getElementById('btnMeasure').onclick = () => {
  sim.measureMode = !sim.measureMode;
  sim.measureStart = null;
  sim.measureCursor = null;
  sim.objectTool = null;
  sim.selectedTool = null;
  document.querySelectorAll('#tileTools button, #objectTools button').forEach(b => b.classList.remove('active-tool'));
  document.getElementById('btnMeasure').classList.toggle('active-tool', sim.measureMode);
  document.getElementById('measureHint').textContent = sim.measureMode
    ? 'Medição ATIVA: clique 2 pontos. Esc cancela.'
    : 'Medir: 2 cliques na arena. Esc cancela.';
  draw();
};
document.getElementById('importFile').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    let data = JSON.parse(await file.text());

    // Formato oficial (tileSet + tiles objeto)
    if (isOfficialArenaFormat(data)) {
      if (sim.customMode) {
        alert('Modo custom está ativo. Desative-o para importar arenas do formato oficial.');
        e.target.value = '';
        return;
      }
      data = convertOfficialArena(data);
      sim.officialMeta = data.meta || null;
      logUI({
        t: 0,
        msg: `Arena oficial convertida${data.meta?.name ? ': ' + data.meta.name : ''} (${data.tiles.length} ladrilhos).`,
        category: 'info'
      });
    } else if (data.gridW || Array.isArray(data.tiles)) {
      // import interno: não sobrescreve meta oficial se já existir, a menos que venha embutida
      if (data.meta) sim.officialMeta = data.meta;
    }

    // Limpa a arena antes de importar
    pushArenaUndo();
    sim.tiles.forEach(t => { t.type = TileType.EMPTY; t.custom = null; t._img = null; t._imgSrc = null; });
    sim.objects = [];
    sim.selectedTile = null;
    sim.selectedObject = null;

    if (data.gridW) sim.gridW = data.gridW;
    if (data.gridH) sim.gridH = data.gridH;
    document.getElementById('gridW').value = sim.gridW;
    document.getElementById('gridH').value = sim.gridH;
    document.getElementById('gridWVal').textContent = sim.gridW;
    document.getElementById('gridHVal').textContent = sim.gridH;
    ensureGridMatrix();
    (data.tiles || data).forEach(o => {
      const t = Tile.fromJSON(o);
      // match by x,y,z when available
      const idx = sim.tiles.findIndex(x =>
        x.gx === t.gx && x.gy === t.gy && (x.gz || 0) === (t.gz || 0));
      if (idx >= 0) sim.tiles[idx] = t;
      else sim.tiles.push(t);
    });
    sim.objects = data.objects || [];
    sim.customArena = sim.tiles.filter(t => t.type !== TileType.EMPTY).map(t => t.toJSON());
    sim.customArenaObjects = JSON.parse(JSON.stringify(sim.objects));
    persist('obr_custom_arena', sim.customArena);
    persist('obr_custom_arena_objects', sim.customArenaObjects);
    if (sim.officialMeta) applyMapMetaToUI();
    else ensureMapMetaDefaults();
    logUI({ t: 0, msg: 'Arena limpa e importada.', category: 'success' });
    fitCamera();
    draw();
  } catch (err) {
    alert('JSON inválido: ' + err.message);
  }
  e.target.value = '';
};

document.getElementById('gridW').oninput = e => resizeGrid(parseInt(e.target.value), sim.gridH);
document.getElementById('gridH').oninput = e => resizeGrid(sim.gridW, parseInt(e.target.value));

['btnUp', 'btnDown', 'btnLeft', 'btnRight'].forEach((id, i) => {
  const key = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'][i];
  const el = document.getElementById(id);
  el.onmousedown = () => { sim.keys[key] = true; };
  el.onmouseup = () => { sim.keys[key] = false; };
  el.onmouseleave = () => { sim.keys[key] = false; };
});
document.getElementById('btnPlaceRobot').onclick = () => {
  sim.placingRobot = !sim.placingRobot;
  document.getElementById('btnPlaceRobot').textContent = sim.placingRobot ? 'Clique no canvas…' : 'Posicionar Robô';
};
document.getElementById('btnStopRobot').onclick = () => { Object.keys(sim.keys).forEach(k => sim.keys[k] = false); };
document.getElementById('btnResetManualRobot').onclick = () => {
  // Destrava controles manuais: zera teclas, estado de movimento e reposiciona no start
  Object.keys(sim.keys).forEach(k => sim.keys[k] = false);
  sim.placingRobot = false;
  const placeBtn = document.getElementById('btnPlaceRobot');
  if (placeBtn) placeBtn.textContent = 'Posicionar robô';
  sim.running = false;
  sim.finished = false;
  if (sim.robot) {
    if ('vx' in sim.robot) sim.robot.vx = 0;
    if ('vy' in sim.robot) sim.robot.vy = 0;
    if ('omega' in sim.robot) sim.robot.omega = 0;
  }
  restartRobot();
  logUI({ t: sim.time, msg: 'Robô e controles manuais resetados (destravados).', category: 'info' });
};
document.getElementById('btnForceFail').onclick = () => {
  const ev = sim.score.addFail('Forçada pelo juiz', sim.time);
  if (ev) logUI(ev);
  sim.attempt++;
  sim.tilesSinceCP = 0;
  const cp = [...sim.tiles].reverse().find(t => tileIsCheckpoint(t) || tileIsStart(t));
  if (cp && sim.robot) {
    sim.robot.pos.x = cp.worldX + TILE_PX / 2;
    sim.robot.pos.y = cp.worldY + TILE_PX / 2;
    sim.lastTile = null;
  }
  updateScoreUI();
  draw();
};
document.getElementById('btnScoreNow').onclick = () => {
  if (!sim.robot) return;
  sim.lastTile = null;
  checkTileEvents(sim.robot);
};
document.getElementById('btnPickup').onclick = () => {
  if (!sim.robot) return;
  sim.robot.carrying = sim.robot.carrying ? null : 'alive';
  logUI({ t: sim.time, msg: sim.robot.carrying ? 'Vítima viva coletada' : 'Vítima largada', category: 'info' });
  draw();
};
document.getElementById('btnDrop').onclick = () => {
  if (!sim.robot) return;
  sim.robot.carrying = null;
  logUI({ t: sim.time, msg: 'Vítima largada', category: 'info' });
  draw();
};

function setCtorColor(hex) {
  if (!hex) return;
  if (hex[0] !== '#') hex = '#' + hex;
  ctor.color = hex;
  const sw = document.getElementById('activeColorSwatch');
  if (sw) sw.style.background = hex;
  const pick = document.getElementById('ctorColorPicker');
  if (pick) pick.value = hex;
  const hx = document.getElementById('ctorColorHex');
  if (hx) hx.value = hex;
  document.querySelectorAll('#ctorColorPalette .color-swatch').forEach(b => {
    b.classList.toggle('active-tool', b.dataset.color.toLowerCase() === hex.toLowerCase());
    b.style.borderColor = b.dataset.color.toLowerCase() === hex.toLowerCase() ? '#fff' : 'transparent';
  });
}

document.querySelectorAll('#ctorToolsSide button').forEach(btn => {
  btn.onclick = () => {
    const t = btn.dataset.ctor;
    if (t === 'clear') {
      if (!confirm('Limpar todo o canvas 3×3?')) return;
      pushUndo();
      clearCtorBuffer();
      drawCtor();
      return;
    }
    document.querySelectorAll('#ctorToolsSide button').forEach(b => b.classList.remove('active-tool'));
    btn.classList.add('active-tool');
    // Se “pintar usando linha” estiver marcado e a ferramenta for pincel, usa tool=line
    if (t === 'paint' && document.getElementById('ctorPaintAsLine')?.checked) {
      ctor.tool = 'line';
    } else {
      ctor.tool = t;
    }
    ctor.lineStart = null;
    if (t === 'erase') {
      document.getElementById('activeColorSwatch').style.background = '#ffffff';
    } else if (t === 'paint') {
      document.getElementById('activeColorSwatch').style.background = ctor.color || '#000000';
    }
    drawCtor();
  };
});

// Paleta de cores padrão OBR + RGB livre
document.querySelectorAll('#ctorColorPalette .color-swatch').forEach(btn => {
  btn.onclick = () => {
    setCtorColor(btn.dataset.color);
    // volta para pincel se estava em outra ferramenta
    if (ctor.tool === 'erase' || ctor.tool === 'picker' || ctor.tool === 'measure') {
      ctor.tool = document.getElementById('ctorPaintAsLine')?.checked ? 'line' : 'paint';
      document.querySelectorAll('#ctorToolsSide button').forEach(b => {
        b.classList.toggle('active-tool', b.dataset.ctor === 'paint');
      });
    }
    drawCtor();
  };
});
const ctorColorPicker = document.getElementById('ctorColorPicker');
if (ctorColorPicker) {
  ctorColorPicker.oninput = e => setCtorColor(e.target.value);
}
const ctorColorHex = document.getElementById('ctorColorHex');
if (ctorColorHex) {
  ctorColorHex.onchange = e => {
    let v = e.target.value.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(v)) setCtorColor(v.startsWith('#') ? v : '#' + v);
  };
}
const ctorPaintAsLine = document.getElementById('ctorPaintAsLine');
if (ctorPaintAsLine) {
  ctorPaintAsLine.onchange = () => {
    if (ctor.tool === 'paint' || ctor.tool === 'line') {
      ctor.tool = ctorPaintAsLine.checked ? 'line' : 'paint';
      ctor.lineStart = null;
      drawCtor();
    }
  };
}
function setBrushSize(v) {
  v = Math.max(1, Math.min(300, parseInt(v) || 1));
  ctor.brush = v;
  document.getElementById('brushSize').value = v;
  document.getElementById('brushSizeNum').value = v;
  document.getElementById('brushSizeLabel').textContent = v + ' mm';
}
document.getElementById('brushSize').oninput = e => setBrushSize(e.target.value);
document.getElementById('brushSizeNum').onchange = e => setBrushSize(e.target.value);
document.getElementById('brushSizeNum').oninput = e => {
  const v = parseInt(e.target.value);
  if (!isNaN(v) && v >= 1 && v <= 300) setBrushSize(v);
};
function setGridLock(v) {
  v = Math.max(1, Math.min(50, parseInt(v) || 1));
  ctor.gridLock = v;
  const sl = document.getElementById('gridLock');
  const num = document.getElementById('gridLockNum');
  const lab = document.getElementById('gridLockLabel');
  if (sl) sl.value = v;
  if (num) num.value = v;
  if (lab) lab.textContent = v + ' mm';
  drawCtor();
}
document.getElementById('gridLock').oninput = e => setGridLock(e.target.value);
document.getElementById('gridLockNum').oninput = e => {
  const v = parseInt(e.target.value);
  if (!isNaN(v) && v >= 1 && v <= 50) setGridLock(v);
};
document.getElementById('gridLockNum').onchange = e => setGridLock(e.target.value);
document.getElementById('brushRound').onclick = () => {
  ctor.shape = 'round';
  document.getElementById('brushRound').classList.add('active-tool');
  document.getElementById('brushSquare').classList.remove('active-tool');
};
document.getElementById('brushSquare').onclick = () => {
  ctor.shape = 'square';
  document.getElementById('brushSquare').classList.add('active-tool');
  document.getElementById('brushRound').classList.remove('active-tool');
};
document.getElementById('btnCtorSave').onclick = () => {
  const name = document.getElementById('ctorName').value || 'Meu Ladrilho';
  const rawPts = parseInt(document.getElementById('ctorPoints').value, 10);
  const points = Number.isFinite(rawPts) ? rawPts : 10;
  if (!ctor.buf) { alert('Editor não inicializado.'); return; }
  const def = bufferToCustomDef(name, points);
  if (ctor.editingIndex != null && ctor.editingIndex >= 0 && ctor.editingIndex < sim.customLibrary.length) {
    // Atualiza ladrilho existente
    sim.customLibrary[ctor.editingIndex] = def;
    logUI({ t: 0, msg: `Ladrilho "${name}" atualizado na biblioteca.`, category: 'success' });
    ctor.editingIndex = null;
  } else {
    sim.customLibrary.push(def);
    logUI({ t: 0, msg: `Ladrilho "${name}" salvo (300×300 mm pixel + contexto 3×3).`, category: 'success' });
  }
  persist('obr_custom_tiles', sim.customLibrary);
  refreshCustomSelect();
};

/** True quando o foco está em campo editável — atalhos globais não devem roubar a tecla. */
function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  // Qualquer controle de formulário impede atalhos de aba/ferramenta
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return true;
  if (el.isContentEditable) return true;
  if (el.closest && el.closest('[contenteditable="true"]')) return true;
  // Garante cobertura mesmo se o foco estiver em label associado
  if (el.closest && el.closest('input, textarea, select, [contenteditable="true"]')) return true;
  return false;
}

window.addEventListener('keydown', e => {
  const typing = isTypingTarget(e.target);
  if (e.code === 'Space' && !typing) { sim.spaceDown = true; e.preventDefault(); }
  if (e.key === 'Shift') sim.shiftDown = true;
  // 1..6 — switch tabs (não intercepta quando está digitando; aceita teclado numérico)
  const tabKey = (e.key >= '1' && e.key <= '6') ? e.key
    : (e.code && /^Numpad[1-6]$/.test(e.code) ? e.code.slice(-1) : null);
  if (!typing && tabKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const modes = ['editor', 'sim', 'manual', 'constructor', 'objconstructor', 'robot'];
    const idx = parseInt(tabKey, 10) - 1;
    setMode(modes[idx]);
    e.preventDefault();
    return;
  }
  // Ctrl+Z / Ctrl+Y
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      if (sim.mode === 'constructor') undoCtor();
      else if (sim.mode === 'objconstructor') undoObjCtor();
      else if (sim.mode === 'editor') undoArena();
      return;
    }
    if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault();
      if (sim.mode === 'constructor') redoCtor();
      else if (sim.mode === 'objconstructor') redoObjCtor();
      else if (sim.mode === 'editor') redoArena();
      return;
    }
  }
  if (e.key === 'Escape') {
    if (sim.mode === 'constructor' && ctor.lineStart) { ctor.lineStart = null; drawCtor(); e.preventDefault(); return; }
    if (sim.mode === 'objconstructor' && objCtor.lineStart) { objCtor.lineStart = null; drawObjCtor(); e.preventDefault(); return; }
    if (sim.mode === 'editor' && sim.measureMode) {
      sim.measureMode = false; sim.measureStart = null; sim.measureCursor = null;
      document.getElementById('btnMeasure').classList.remove('active-tool');
      document.getElementById('measureHint').textContent = 'Medir: 2 cliques na arena. Esc cancela.';
      draw(); e.preventDefault(); return;
    }
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'q', 'e', 'Q', 'E'].includes(e.key)) {
    sim.keys[e.key] = true;
    if (sim.mode === 'manual') e.preventDefault();
  }
  if (sim.mode === 'editor') {
    if (e.key === 'r' || e.key === 'R') { rotateSelected(e.shiftKey ? -1 : 1); e.preventDefault(); }
    if (e.key === 't' || e.key === 'T') { mirrorSelected('h'); e.preventDefault(); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (sim.selectedTile && sim.selectedTile.type !== TileType.EMPTY) {
        e.preventDefault();
        const t = sim.selectedTile;
        clearTileAt(t.gx, t.gy, t.gz || 0);
        sim.selectedTile = null;
        if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(null);
        document.getElementById('selectedInfo').textContent = '—';
        logUI({ t: 0, msg: 'Ladrilho apagado (Del)', category: 'info' });
      }
    }
    if (e.key === 'Escape') {
      _cancelEditorTools(sim);
      e.preventDefault();
    }
  }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') sim.spaceDown = false;
  if (e.key === 'Shift') sim.shiftDown = false;
  sim.keys[e.key] = false;
});

window.addEventListener('resize', () => resizeCanvas());

function loop() {
  if (sim.mode === 'sim' && sim.running) { update(sim.dt * sim.speed); draw(); }
  else if (sim.mode === 'manual') { update(sim.dt * sim.speed); draw(); }
  requestAnimationFrame(loop);
}


// ─── Object Constructor (300×300, só pincel/cores) ────────────
const OBJ_MM = 300;
const objCtor = {
  tool: 'paint', color: '#000000', brush: 20, shape: 'round', gridLock: 10,
  painting: false, buf: null, bufCtx: null,
  scale: 1, ox: 0, oy: 0, panning: false, lastX: 0, lastY: 0,
  undoStack: [], redoStack: [], maxHistory: 40,
  cursorX: null, cursorY: null,
  lineStart: null
};
const objCtorCanvas = document.getElementById('objCtorCanvas');
const objCtorCtx = objCtorCanvas ? objCtorCanvas.getContext('2d') : null;

function initObjBuf() {
  const c = document.createElement('canvas');
  c.width = OBJ_MM; c.height = OBJ_MM;
  objCtor.buf = c;
  objCtor.bufCtx = c.getContext('2d');
  // Fundo padrão branco no construtor (na renderização da arena o branco é tratado como transparente)
  objCtor.bufCtx.fillStyle = '#ffffff';
  objCtor.bufCtx.fillRect(0, 0, OBJ_MM, OBJ_MM);
}

function openObjConstructorTab() {
  try {
    if (!objCtorCanvas) return;
    if (!objCtor.buf) initObjBuf();
    document.getElementById('arena')?.classList.add('hidden');
    document.getElementById('arenaZoomBar')?.classList.add('hidden');
    document.getElementById('ctorCanvas')?.classList.add('hidden');
    document.getElementById('ctorZoomBar')?.classList.add('hidden');
    document.getElementById('robotCtorCanvas')?.classList.add('hidden');
    document.getElementById('robotCtorZoomBar')?.classList.add('hidden');
    objCtorCanvas.classList.remove('hidden');
    document.getElementById('objCtorZoomBar')?.classList.remove('hidden');
    const gl = document.getElementById('objGridLock');
    if (gl) objCtor.gridLock = parseInt(gl.value) || 1;
    fitObjCtorCanvas();
    drawObjCtor();
  } catch (err) {
    console.error('openObjConstructorTab:', err);
  }
}

function closeObjConstructorTab() {
  if (objCtorCanvas) objCtorCanvas.classList.add('hidden');
  document.getElementById('objCtorZoomBar')?.classList.add('hidden');
}

function fitObjCtorCanvas() {
  const wrap = document.getElementById('canvasWrap');
  const r = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(200, r.width - 16);
  const cssH = Math.max(200, r.height - 16);
  objCtorCanvas.style.width = cssW + 'px';
  objCtorCanvas.style.height = cssH + 'px';
  objCtorCanvas.width = Math.floor(cssW * dpr);
  objCtorCanvas.height = Math.floor(cssH * dpr);
  objCtorCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pad = 24;
  const s = Math.min((cssW - pad * 2) / OBJ_MM, (cssH - pad * 2) / OBJ_MM, 3);
  objCtor.scale = Math.max(0.1, s);
  objCtor.ox = (cssW - OBJ_MM * objCtor.scale) / 2;
  objCtor.oy = (cssH - OBJ_MM * objCtor.scale) / 2;
}

function setObjCtorZoom(factor) {
  const cssW = objCtorCanvas.clientWidth, cssH = objCtorCanvas.clientHeight;
  const cx = cssW / 2, cy = cssH / 2;
  const wx = (cx - objCtor.ox) / objCtor.scale;
  const wy = (cy - objCtor.oy) / objCtor.scale;
  objCtor.scale = Math.max(0.08, Math.min(5, objCtor.scale * factor));
  objCtor.ox = cx - wx * objCtor.scale;
  objCtor.oy = cy - wy * objCtor.scale;
  drawObjCtor();
}

function drawObjCtor() {
  if (!objCtor.buf || !objCtorCtx) return;
  const cssW = objCtorCanvas.clientWidth, cssH = objCtorCanvas.clientHeight;
  objCtorCtx.save();
  objCtorCtx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  objCtorCtx.fillStyle = '#0b1220';
  objCtorCtx.fillRect(0, 0, cssW, cssH);
  objCtorCtx.translate(objCtor.ox, objCtor.oy);
  objCtorCtx.scale(objCtor.scale, objCtor.scale);
  objCtorCtx.imageSmoothingEnabled = false;
  objCtorCtx.drawImage(objCtor.buf, 0, 0);
  objCtorCtx.strokeStyle = '#64748b';
  objCtorCtx.lineWidth = 2 / objCtor.scale;
  objCtorCtx.strokeRect(0, 0, OBJ_MM, OBJ_MM);
  // center cross red
  objCtorCtx.strokeStyle = 'rgba(239,68,68,0.45)';
  objCtorCtx.lineWidth = 1 / objCtor.scale;
  objCtorCtx.beginPath();
  objCtorCtx.moveTo(0, OBJ_MM / 2); objCtorCtx.lineTo(OBJ_MM, OBJ_MM / 2);
  objCtorCtx.moveTo(OBJ_MM / 2, 0); objCtorCtx.lineTo(OBJ_MM / 2, OBJ_MM);
  objCtorCtx.stroke();
  // grid lock
  if (objCtor.gridLock > 1) {
    objCtorCtx.strokeStyle = 'rgba(59,130,246,0.12)';
    for (let i = 0; i <= OBJ_MM; i += objCtor.gridLock) {
      objCtorCtx.beginPath(); objCtorCtx.moveTo(i, 0); objCtorCtx.lineTo(i, OBJ_MM); objCtorCtx.stroke();
      objCtorCtx.beginPath(); objCtorCtx.moveTo(0, i); objCtorCtx.lineTo(OBJ_MM, i); objCtorCtx.stroke();
    }
  }
  // brush / line preview
  if (objCtor.cursorX != null && !objCtor.panning) {
    if (objCtor.tool === 'line' || objCtor.tool === 'measure') {
      const lw = Math.max(1, objCtor.brush | 0);
      if (objCtor.tool === 'measure') {
        objCtorCtx.lineWidth = 1.5 / objCtor.scale;
        objCtorCtx.strokeStyle = 'rgba(234,179,8,0.95)';
        objCtorCtx.setLineDash([6 / objCtor.scale, 4 / objCtor.scale]);
        if (objCtor.lineStart) {
          objCtorCtx.beginPath();
          objCtorCtx.moveTo(objCtor.lineStart.x, objCtor.lineStart.y);
          objCtorCtx.lineTo(objCtor.cursorX, objCtor.cursorY);
          objCtorCtx.stroke();
          const dist = Math.hypot(objCtor.cursorX - objCtor.lineStart.x, objCtor.cursorY - objCtor.lineStart.y);
          objCtorCtx.setLineDash([]);
          objCtorCtx.fillStyle = '#fbbf24';
          objCtorCtx.font = `${13 / objCtor.scale}px sans-serif`;
          objCtorCtx.textAlign = 'center';
          objCtorCtx.fillText(dist.toFixed(1) + ' mm', (objCtor.lineStart.x + objCtor.cursorX) / 2, (objCtor.lineStart.y + objCtor.cursorY) / 2 - 8 / objCtor.scale);
        }
      } else {
        objCtorCtx.lineCap = objCtor.shape === 'square' ? 'square' : 'round';
        objCtorCtx.lineWidth = lw;
        objCtorCtx.strokeStyle = 'rgba(59,130,246,0.7)';
        objCtorCtx.setLineDash([6 / objCtor.scale, 4 / objCtor.scale]);
        if (objCtor.lineStart) {
          objCtorCtx.beginPath();
          objCtorCtx.moveTo(objCtor.lineStart.x + 0.5, objCtor.lineStart.y + 0.5);
          objCtorCtx.lineTo(objCtor.cursorX + 0.5, objCtor.cursorY + 0.5);
          objCtorCtx.stroke();
          objCtorCtx.setLineDash([]);
          objCtorCtx.fillStyle = 'rgba(59,130,246,0.35)';
          if (objCtor.shape === 'square')
            objCtorCtx.fillRect(objCtor.lineStart.x - lw / 2, objCtor.lineStart.y - lw / 2, lw, lw);
          else {
            objCtorCtx.beginPath();
            objCtorCtx.arc(objCtor.lineStart.x + 0.5, objCtor.lineStart.y + 0.5, Math.max(1, lw / 2), 0, Math.PI * 2);
            objCtorCtx.fill();
          }
        } else {
          objCtorCtx.setLineDash([]);
          objCtorCtx.lineWidth = 1.5 / objCtor.scale;
          if (objCtor.shape === 'square')
            objCtorCtx.strokeRect(objCtor.cursorX - lw / 2, objCtor.cursorY - lw / 2, lw, lw);
          else {
            objCtorCtx.beginPath();
            objCtorCtx.arc(objCtor.cursorX + 0.5, objCtor.cursorY + 0.5, Math.max(2, lw / 2), 0, Math.PI * 2);
            objCtorCtx.stroke();
          }
        }
      }
    } else {
      const s = Math.max(1, objCtor.brush | 0), r = Math.max(0.5, s / 2);
      objCtorCtx.lineWidth = 1.5 / objCtor.scale;
      objCtorCtx.setLineDash([4 / objCtor.scale, 3 / objCtor.scale]);
      objCtorCtx.strokeStyle = objCtor.tool === 'erase' ? 'rgba(239,68,68,0.85)' : 'rgba(59,130,246,0.9)';
      objCtorCtx.fillStyle = objCtor.tool === 'erase' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)';
      if (objCtor.shape === 'square') {
        objCtorCtx.fillRect(objCtor.cursorX - s / 2, objCtor.cursorY - s / 2, s, s);
        objCtorCtx.strokeRect(objCtor.cursorX - s / 2, objCtor.cursorY - s / 2, s, s);
      } else {
        objCtorCtx.beginPath();
        objCtorCtx.arc(objCtor.cursorX + 0.5, objCtor.cursorY + 0.5, r, 0, Math.PI * 2);
        objCtorCtx.fill(); objCtorCtx.stroke();
      }
      objCtorCtx.setLineDash([]);
    }
  }
  objCtorCtx.restore();
}

function objCtorPos(e) {
  const rect = objCtorCanvas.getBoundingClientRect();
  let x = (e.clientX - rect.left - objCtor.ox) / objCtor.scale;
  let y = (e.clientY - rect.top - objCtor.oy) / objCtor.scale;
  const step = Math.max(1, objCtor.gridLock | 0);
  x = Math.round(x / step) * step;
  y = Math.round(y / step) * step;
  return {
    x: Math.max(0, Math.min(OBJ_MM - 1, x)),
    y: Math.max(0, Math.min(OBJ_MM - 1, y))
  };
}

function pushObjUndo() {
  try {
    objCtor.undoStack.push(objCtor.bufCtx.getImageData(0, 0, OBJ_MM, OBJ_MM));
    if (objCtor.undoStack.length > objCtor.maxHistory) objCtor.undoStack.shift();
    objCtor.redoStack = [];
  } catch (e) {}
}
function undoObjCtor() {
  if (!objCtor.undoStack.length) return;
  try {
    objCtor.redoStack.push(objCtor.bufCtx.getImageData(0, 0, OBJ_MM, OBJ_MM));
    objCtor.bufCtx.putImageData(objCtor.undoStack.pop(), 0, 0);
    drawObjCtor();
  } catch (e) {}
}
function redoObjCtor() {
  if (!objCtor.redoStack.length) return;
  try {
    objCtor.undoStack.push(objCtor.bufCtx.getImageData(0, 0, OBJ_MM, OBJ_MM));
    objCtor.bufCtx.putImageData(objCtor.redoStack.pop(), 0, 0);
    drawObjCtor();
  } catch (e) {}
}

function paintObjAt(x, y) {
  const ctx = objCtor.bufCtx;
  const s = Math.max(1, objCtor.brush | 0);
  const r = Math.max(0.5, s / 2);
  if (objCtor.tool === 'erase') {
    const x0 = Math.max(0, Math.floor(x - r - 1));
    const y0 = Math.max(0, Math.floor(y - r - 1));
    const x1 = Math.min(OBJ_MM - 1, Math.ceil(x + r + 1));
    const y1 = Math.min(OBJ_MM - 1, Math.ceil(y + r + 1));
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;
    const img = ctx.getImageData(x0, y0, w, h);
    const d = img.data;
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        let inside = false;
        if (objCtor.shape === 'square')
          inside = px >= x - s / 2 && px < x + s / 2 && py >= y - s / 2 && py < y + s / 2;
        else {
          const dx = px + 0.5 - x, dy = py + 0.5 - y;
          inside = dx * dx + dy * dy <= r * r;
        }
        if (!inside) continue;
        const i = ((py - y0) * w + (px - x0)) * 4;
        d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
    return;
  }
  ctx.fillStyle = objCtor.color;
  if (objCtor.shape === 'square') ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
  else { ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); ctx.fill(); }
}

if (objCtorCanvas) {
  objCtorCanvas.addEventListener('mousedown', e => {
    if (e.button === 1 && e.shiftKey) {
      e.preventDefault();
      objCtor.panning = true;
      objCtor.lastX = e.clientX; objCtor.lastY = e.clientY;
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      const p = objCtorPos(e);
      const d = objCtor.bufCtx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
      const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      if (d[0] > 240 && d[1] > 240 && d[2] > 240) objCtor.tool = 'erase';
      else { objCtor.tool = 'paint'; objCtor.color = hex; document.getElementById('objActiveColor').style.background = hex; }
      return;
    }
    if (e.button !== 0) return;
    const p = objCtorPos(e);
    objCtor.cursorX = p.x; objCtor.cursorY = p.y;
    if (objCtor.tool === 'picker') return;
    if (objCtor.tool === 'line' || objCtor.tool === 'measure') {
      if (!objCtor.lineStart) {
        objCtor.lineStart = { x: p.x, y: p.y };
        drawObjCtor();
        return;
      }
      if (objCtor.tool === 'measure') {
        const dist = Math.hypot(p.x - objCtor.lineStart.x, p.y - objCtor.lineStart.y);
        logUI({ t: 0, msg: `Medição (objeto): ${dist.toFixed(1)} mm`, category: 'info' });
        objCtor.lineStart = null;
        drawObjCtor();
        return;
      }
      pushObjUndo();
      strokeLineOnBuf(objCtor.bufCtx, objCtor.lineStart.x, objCtor.lineStart.y, p.x, p.y, objCtor.color, objCtor.brush, objCtor.shape, false, OBJ_MM, OBJ_MM, () => [255, 255, 255, 255]);
      objCtor.lineStart = null;
      drawObjCtor();
      return;
    }
    pushObjUndo();
    objCtor.painting = true;
    paintObjAt(p.x, p.y);
    drawObjCtor();
  });
  objCtorCanvas.addEventListener('mousemove', e => {
    if (objCtor.panning) {
      objCtor.ox += e.clientX - objCtor.lastX;
      objCtor.oy += e.clientY - objCtor.lastY;
      objCtor.lastX = e.clientX; objCtor.lastY = e.clientY;
      drawObjCtor(); return;
    }
    const p = objCtorPos(e);
    objCtor.cursorX = p.x; objCtor.cursorY = p.y;
    if (objCtor.painting) paintObjAt(p.x, p.y);
    drawObjCtor();
  });
  objCtorCanvas.addEventListener('mouseleave', () => { objCtor.cursorX = null; objCtor.cursorY = null; drawObjCtor(); });
  objCtorCanvas.addEventListener('wheel', e => { e.preventDefault(); setObjCtorZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  objCtorCanvas.addEventListener('contextmenu', e => e.preventDefault());
}
window.addEventListener('mouseup', () => {
  objCtor.painting = false;
  objCtor.panning = false;
});

function refreshObjLibrary() {
  const sel = document.getElementById('customObjSelect');
  if (sel) {
    sel.innerHTML = '<option value="">— obj custom —</option>';
    sim.customObjLibrary.forEach((c, i) => {
      const o = document.createElement('option');
      const pts = (c.points != null && Number.isFinite(Number(c.points))) ? Number(c.points) : 0;
      o.value = i; o.textContent = `${c.name} (${pts}pts)`;
      sel.appendChild(o);
    });
  }
  // Paleta visual de objetos custom (mesmo funcionamento do seletor de ladrilhos)
  const palette = document.getElementById('objectPalette');
  if (palette) {
    if (!sim.customObjLibrary.length) {
      palette.innerHTML = '<span style="font-size:0.7rem;color:var(--muted)">Nenhum objeto custom ainda.</span>';
    } else {
      palette.innerHTML = '';
      sim.customObjLibrary.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.title = `${c.name} (${(c.points != null && Number.isFinite(Number(c.points))) ? Number(c.points) : 0} pts)`;
        btn.style.cssText = 'position:relative;width:48px;height:48px;padding:2px;overflow:hidden';
        if (c.bitmap) {
          const img = document.createElement('img');
          img.src = c.bitmap;
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated';
          btn.appendChild(img);
        } else {
          btn.textContent = c.name.slice(0, 4);
        }
        btn.onclick = () => {
          document.querySelectorAll('#objectTools button, #objectPalette button').forEach(b => b.classList.remove('active-tool'));
          btn.classList.add('active-tool');
          sim.objectTool = 'custom';
          sim.placingCustomObjId = i;
          sim.selectedTool = null;
          sim.markerTool = null;
          if (sel) sel.value = String(i);
        };
        palette.appendChild(btn);
      });
    }
  }
  const lib = document.getElementById('customObjLibrary');
  if (lib) {
    if (!sim.customObjLibrary.length) lib.textContent = 'Nenhum ainda.';
    else lib.innerHTML = sim.customObjLibrary.map((c, i) => {
      const pts = (c.points != null && Number.isFinite(Number(c.points))) ? Number(c.points) : 0;
      return `<div class="lib-item"><span><strong>${c.name}</strong> — ${pts}pts</span>
        <button data-odel="${i}" class="danger">Excluir</button></div>`;
    }).join('');
    lib.querySelectorAll('button[data-odel]').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.odel);
        if (confirm(`Excluir "${sim.customObjLibrary[i].name}"?`)) {
          sim.customObjLibrary.splice(i, 1);
          persist('obr_custom_objects', sim.customObjLibrary);
          refreshObjLibrary();
        }
      };
    });
  }
}

// bindings object constructor UI
document.querySelectorAll('#objCtorTools button').forEach(btn => {
  btn.onclick = () => {
    const t = btn.dataset.oct;
    if (t === 'clear') {
      if (!confirm('Limpar objeto?')) return;
      pushObjUndo();
      objCtor.bufCtx.fillStyle = '#ffffff';
      objCtor.bufCtx.fillRect(0, 0, OBJ_MM, OBJ_MM);
      objCtor.redoStack = [];
      drawObjCtor();
      return;
    }
    document.querySelectorAll('#objCtorTools button').forEach(b => b.classList.remove('active-tool'));
    btn.classList.add('active-tool');
    if (t === 'paint' && document.getElementById('objPaintAsLine')?.checked) {
      objCtor.tool = 'line';
    } else {
      objCtor.tool = t;
    }
    objCtor.lineStart = null;
    if (t === 'erase') {
      document.getElementById('objActiveColor').style.background = '#ffffff';
    } else if (t === 'paint') {
      document.getElementById('objActiveColor').style.background = objCtor.color || '#000000';
    }
    drawObjCtor();
  };
});

function setObjCtorColor(hex) {
  if (!hex) return;
  if (hex[0] !== '#') hex = '#' + hex;
  objCtor.color = hex;
  const sw = document.getElementById('objActiveColor');
  if (sw) sw.style.background = hex;
  const pick = document.getElementById('objColorPicker');
  if (pick) pick.value = hex;
  const hx = document.getElementById('objColorHex');
  if (hx) hx.value = hex;
  document.querySelectorAll('#objColorPalette .color-swatch').forEach(b => {
    const on = b.dataset.color.toLowerCase() === hex.toLowerCase();
    b.classList.toggle('active-tool', on);
    b.style.borderColor = on ? '#fff' : 'transparent';
  });
}
document.querySelectorAll('#objColorPalette .color-swatch').forEach(btn => {
  btn.onclick = () => {
    setObjCtorColor(btn.dataset.color);
    if (objCtor.tool === 'erase' || objCtor.tool === 'picker' || objCtor.tool === 'measure') {
      objCtor.tool = document.getElementById('objPaintAsLine')?.checked ? 'line' : 'paint';
      document.querySelectorAll('#objCtorTools button').forEach(b => {
        b.classList.toggle('active-tool', b.dataset.oct === 'paint');
      });
    }
    drawObjCtor();
  };
});
const objColorPickerEl = document.getElementById('objColorPicker');
if (objColorPickerEl) objColorPickerEl.oninput = e => setObjCtorColor(e.target.value);
const objColorHexEl = document.getElementById('objColorHex');
if (objColorHexEl) {
  objColorHexEl.onchange = e => {
    let v = e.target.value.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(v)) setObjCtorColor(v.startsWith('#') ? v : '#' + v);
  };
}
const objPaintAsLineEl = document.getElementById('objPaintAsLine');
if (objPaintAsLineEl) {
  objPaintAsLineEl.onchange = () => {
    if (objCtor.tool === 'paint' || objCtor.tool === 'line') {
      objCtor.tool = objPaintAsLineEl.checked ? 'line' : 'paint';
      objCtor.lineStart = null;
      drawObjCtor();
    }
  };
}
function setObjBrush(v) {
  v = Math.max(1, Math.min(300, parseInt(v) || 1));
  objCtor.brush = v;
  document.getElementById('objBrushSize').value = v;
  document.getElementById('objBrushSizeNum').value = v;
  document.getElementById('objBrushSizeLabel').textContent = v + ' mm';
}
document.getElementById('objBrushSize').oninput = e => setObjBrush(e.target.value);
document.getElementById('objBrushSizeNum').oninput = e => {
  const v = parseInt(e.target.value);
  if (!isNaN(v) && v >= 1 && v <= 300) setObjBrush(v);
};
function setObjGridLock(v) {
  v = Math.max(1, Math.min(50, parseInt(v) || 1));
  objCtor.gridLock = v;
  const sl = document.getElementById('objGridLock');
  const num = document.getElementById('objGridLockNum');
  const lab = document.getElementById('objGridLockLabel');
  if (sl) sl.value = v;
  if (num) num.value = v;
  if (lab) lab.textContent = v + ' mm';
  drawObjCtor();
}
document.getElementById('objGridLock').oninput = e => setObjGridLock(e.target.value);
document.getElementById('objGridLockNum').oninput = e => {
  const v = parseInt(e.target.value);
  if (!isNaN(v) && v >= 1 && v <= 50) setObjGridLock(v);
};
document.getElementById('objGridLockNum').onchange = e => setObjGridLock(e.target.value);
document.getElementById('objBrushRound').onclick = () => {
  objCtor.shape = 'round';
  document.getElementById('objBrushRound').classList.add('active-tool');
  document.getElementById('objBrushSquare').classList.remove('active-tool');
};
document.getElementById('objBrushSquare').onclick = () => {
  objCtor.shape = 'square';
  document.getElementById('objBrushSquare').classList.add('active-tool');
  document.getElementById('objBrushRound').classList.remove('active-tool');
};
document.getElementById('btnObjCtorSave').onclick = () => {
  const name = document.getElementById('objCtorName').value || 'Meu Objeto';
  const raw = parseInt(document.getElementById('objCtorPoints').value, 10);
  const points = Number.isFinite(raw) ? raw : 0;
  // Exporta com fundo branco → transparente (só o desenho aparece na arena)
  const tmp = document.createElement('canvas');
  tmp.width = OBJ_MM; tmp.height = OBJ_MM;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(objCtor.buf, 0, 0);
  const img = tctx.getImageData(0, 0, OBJ_MM, OBJ_MM);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // quase-branco vira transparente
    if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) d[i + 3] = 0;
  }
  tctx.putImageData(img, 0, 0);
  const def = { name, points, pixel: true, sizeMm: OBJ_MM, bitmap: tmp.toDataURL('image/png') };
  sim.customObjLibrary.push(def);
  persist('obr_custom_objects', sim.customObjLibrary);
  refreshObjLibrary();
  logUI({ t: 0, msg: `Objeto "${name}" salvo (${points} pts).`, category: 'success' });
};

// (Ctrl+Z/Y para objconstructor já coberto no handler global de keydown)

// load objects library + arena objects (síncrono localStorage; reforçado no bootstrap async)
try {
  const o = localStorage.getItem('obr_custom_objects');
  if (o) sim.customObjLibrary = JSON.parse(o);
} catch (e) {}
try {
  const ao = localStorage.getItem('obr_custom_arena_objects');
  if (ao) sim.customArenaObjects = JSON.parse(ao);
} catch (e) {}
refreshObjLibrary();


// ═══════════════════════════════════════════════════════════════
// Construtor de robô + sensores + script
// ═══════════════════════════════════════════════════════════════
const MM_PER_TILE = 300;
const MM_TO_WORLD = TILE_PX / MM_PER_TILE;

const robotCtor = {
  bodyW: 120,
  bodyH: 150,
  detectors: [],
  selectedId: null,
  scale: 1,
  ox: 0,
  oy: 0,
  dragging: null,
  editingIndex: null
};

function defaultRobotDef() {
  return {
    name: 'Robô padrão',
    body: { w: 120, h: 150 },
    detectors: [
      { id: 'line_left', name: 'line_left', kind: 'under', x: -25, y: 50, w: 12, h: 12 },
      { id: 'line_right', name: 'line_right', kind: 'under', x: 25, y: 50, w: 12, h: 12 },
      { id: 'front', name: 'front', kind: 'forward', shape: 'rect', offsetX: 0, offsetY: 75, length: 60, width: 50 }
    ]
  };
}

function openRobotConstructorTab() {
  document.getElementById('arena')?.classList.add('hidden');
  document.getElementById('arenaZoomBar')?.classList.add('hidden');
  document.getElementById('ctorCanvas')?.classList.add('hidden');
  document.getElementById('ctorZoomBar')?.classList.add('hidden');
  document.getElementById('objCtorCanvas')?.classList.add('hidden');
  document.getElementById('objCtorZoomBar')?.classList.add('hidden');
  const c = document.getElementById('robotCtorCanvas');
  const zb = document.getElementById('robotCtorZoomBar');
  if (c) c.classList.remove('hidden');
  if (zb) zb.classList.remove('hidden');
  document.getElementById('robotBodyW').value = robotCtor.bodyW;
  document.getElementById('robotBodyH').value = robotCtor.bodyH;
  if (!robotCtor.detectors.length) {
    const d = defaultRobotDef();
    robotCtor.bodyW = d.body.w;
    robotCtor.bodyH = d.body.h;
    robotCtor.detectors = JSON.parse(JSON.stringify(d.detectors));
    document.getElementById('robotBodyW').value = robotCtor.bodyW;
    document.getElementById('robotBodyH').value = robotCtor.bodyH;
    document.getElementById('robotDefName').value = d.name;
  }
  fitRobotCtorCanvas();
  refreshDetectorList();
  drawRobotCtor();
}

function closeRobotConstructorTab() {
  document.getElementById('robotCtorCanvas')?.classList.add('hidden');
  document.getElementById('robotCtorZoomBar')?.classList.add('hidden');
}

function fitRobotCtorCanvas() {
  const canvas = document.getElementById('robotCtorCanvas');
  if (!canvas) return;
  const wrap = document.getElementById('canvasWrap');
  const r = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(200, r.width - 16);
  const cssH = Math.max(200, r.height - 16);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  robotCtor.scale = Math.min(cssW, cssH) / 280;
  robotCtor.ox = cssW / 2;
  robotCtor.oy = cssH / 2;
}

function drawRobotCtor() {
  const canvas = document.getElementById('robotCtorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.translate(robotCtor.ox, robotCtor.oy);
  ctx.scale(robotCtor.scale, -robotCtor.scale);

  ctx.strokeStyle = 'rgba(148,163,184,0.15)';
  ctx.lineWidth = 1 / robotCtor.scale;
  for (let i = -150; i <= 150; i += 10) {
    ctx.beginPath(); ctx.moveTo(i, -150); ctx.lineTo(i, 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-150, i); ctx.lineTo(150, i); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(239,68,68,0.5)';
  ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(0, 150); ctx.stroke();
  ctx.strokeStyle = 'rgba(59,130,246,0.5)';
  ctx.beginPath(); ctx.moveTo(-150, 0); ctx.lineTo(150, 0); ctx.stroke();

  const bw = robotCtor.bodyW, bh = robotCtor.bodyH;
  ctx.fillStyle = 'rgba(59,130,246,0.35)';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2 / robotCtor.scale;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#93c5fd';
  ctx.fillRect(-10, bh / 2 - 4, 20, 6);

  for (const d of robotCtor.detectors) {
    const sel = d.id === robotCtor.selectedId;
    if (d.kind === 'under') {
      ctx.fillStyle = sel ? 'rgba(34,197,94,0.55)' : 'rgba(34,197,94,0.3)';
      ctx.strokeStyle = sel ? '#fff' : '#22c55e';
      ctx.lineWidth = (sel ? 2.5 : 1.5) / robotCtor.scale;
      ctx.fillRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
      ctx.strokeRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
    } else {
      ctx.fillStyle = sel ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.28)';
      ctx.strokeStyle = sel ? '#fff' : '#f97316';
      ctx.lineWidth = (sel ? 2.5 : 1.5) / robotCtor.scale;
      const ox = d.offsetX || 0;
      const oy = d.offsetY != null ? d.offsetY : bh / 2;
      const len = d.length || 60, wid = d.width || 40;
      ctx.beginPath();
      if (d.shape === 'triangle') {
        ctx.moveTo(ox - wid / 2, oy);
        ctx.lineTo(ox + wid / 2, oy);
        ctx.lineTo(ox, oy + len);
        ctx.closePath();
      } else {
        ctx.rect(ox - wid / 2, oy, wid, len);
      }
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('+Y = frente · grade 10 mm', cssW / 2, 16);
  ctx.restore();
}

function robotCtorPos(e) {
  const canvas = document.getElementById('robotCtorCanvas');
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const x = (sx - robotCtor.ox) / robotCtor.scale;
  const y = (sy - robotCtor.oy) / -robotCtor.scale;
  return { x, y };
}

function hitDetector(p) {
  for (let i = robotCtor.detectors.length - 1; i >= 0; i--) {
    const d = robotCtor.detectors[i];
    if (d.kind === 'under') {
      if (Math.abs(p.x - d.x) <= d.w / 2 && Math.abs(p.y - d.y) <= d.h / 2) return d;
    } else {
      const ox = d.offsetX || 0;
      const oy = d.offsetY != null ? d.offsetY : robotCtor.bodyH / 2;
      const len = d.length || 60, wid = d.width || 40;
      if (p.x >= ox - wid / 2 && p.x <= ox + wid / 2 && p.y >= oy && p.y <= oy + len) return d;
    }
  }
  return null;
}

function refreshDetectorList() {
  const el = document.getElementById('detectorList');
  if (!el) return;
  if (!robotCtor.detectors.length) {
    el.innerHTML = '<span style="color:var(--muted)">Nenhum detector.</span>';
    const de = document.getElementById('detectorEdit');
    if (de) de.innerHTML = 'Nenhum selecionado.';
    return;
  }
  el.innerHTML = robotCtor.detectors.map(d => {
    const sel = d.id === robotCtor.selectedId ? ' active-tool' : '';
    const kind = d.kind === 'under' ? 'solo' : `frente/${d.shape || 'rect'}`;
    return `<button class="${sel}" data-det="${d.id}" style="width:100%;text-align:left;margin-bottom:0.2rem">${d.name} <span style="color:var(--muted)">(${kind})</span></button>`;
  }).join('');
  el.querySelectorAll('button[data-det]').forEach(btn => {
    btn.onclick = () => {
      robotCtor.selectedId = btn.dataset.det;
      refreshDetectorList();
      refreshDetectorEdit();
      drawRobotCtor();
    };
  });
  refreshDetectorEdit();
}

function refreshDetectorEdit() {
  const box = document.getElementById('detectorEdit');
  const d = robotCtor.detectors.find(x => x.id === robotCtor.selectedId);
  if (!box) return;
  if (!d) { box.innerHTML = 'Nenhum selecionado.'; return; }
  if (d.kind === 'under') {
    box.innerHTML = `
      <label>Nome</label><input type="text" id="detName" value="${d.name}">
      <label>X (mm)</label><input type="number" id="detX" value="${d.x}">
      <label>Y (mm)</label><input type="number" id="detY" value="${d.y}">
      <label>Largura</label><input type="number" id="detW" value="${d.w}">
      <label>Altura</label><input type="number" id="detH" value="${d.h}">
      <button id="btnDelDet" class="danger" style="width:100%;margin-top:0.35rem">Excluir</button>`;
  } else {
    box.innerHTML = `
      <label>Nome</label><input type="text" id="detName" value="${d.name}">
      <label>Forma</label>
      <select id="detShape"><option value="rect" ${d.shape !== 'triangle' ? 'selected' : ''}>Retângulo</option><option value="triangle" ${d.shape === 'triangle' ? 'selected' : ''}>Triângulo</option></select>
      <label>Offset X (mm)</label><input type="number" id="detOX" value="${d.offsetX || 0}">
      <label>Offset Y (mm)</label><input type="number" id="detOY" value="${d.offsetY != null ? d.offsetY : robotCtor.bodyH / 2}">
      <label>Alcance</label><input type="number" id="detLen" value="${d.length || 60}">
      <label>Largura</label><input type="number" id="detWid" value="${d.width || 40}">
      <button id="btnDelDet" class="danger" style="width:100%;margin-top:0.35rem">Excluir</button>`;
  }
  const bind = (id, fn) => { const n = document.getElementById(id); if (n) n.onchange = n.oninput = () => { fn(n); drawRobotCtor(); refreshDetectorList(); }; };
  bind('detName', n => { d.name = n.value || d.id; });
  if (d.kind === 'under') {
    bind('detX', n => { d.x = parseFloat(n.value) || 0; });
    bind('detY', n => { d.y = parseFloat(n.value) || 0; });
    bind('detW', n => { d.w = Math.max(2, parseFloat(n.value) || 10); });
    bind('detH', n => { d.h = Math.max(2, parseFloat(n.value) || 10); });
  } else {
    bind('detShape', n => { d.shape = n.value; });
    bind('detOX', n => { d.offsetX = parseFloat(n.value) || 0; });
    bind('detOY', n => { d.offsetY = parseFloat(n.value) || 0; });
    bind('detLen', n => { d.length = Math.max(4, parseFloat(n.value) || 60); });
    bind('detWid', n => { d.width = Math.max(4, parseFloat(n.value) || 40); });
  }
  const del = document.getElementById('btnDelDet');
  if (del) del.onclick = () => {
    robotCtor.detectors = robotCtor.detectors.filter(x => x.id !== d.id);
    robotCtor.selectedId = null;
    refreshDetectorList();
    drawRobotCtor();
  };
}

function uidDet(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 7);
}

document.getElementById('btnAddUnderDet')?.addEventListener('click', () => {
  const id = uidDet('under');
  robotCtor.detectors.push({ id, name: id, kind: 'under', x: 0, y: 40, w: 14, h: 14 });
  robotCtor.selectedId = id;
  refreshDetectorList();
  drawRobotCtor();
});
document.getElementById('btnAddForwardRect')?.addEventListener('click', () => {
  const id = uidDet('front');
  robotCtor.detectors.push({ id, name: id, kind: 'forward', shape: 'rect', offsetX: 0, offsetY: robotCtor.bodyH / 2, length: 60, width: 50 });
  robotCtor.selectedId = id;
  refreshDetectorList();
  drawRobotCtor();
});
document.getElementById('btnAddForwardTri')?.addEventListener('click', () => {
  const id = uidDet('front');
  robotCtor.detectors.push({ id, name: id, kind: 'forward', shape: 'triangle', offsetX: 0, offsetY: robotCtor.bodyH / 2, length: 70, width: 50 });
  robotCtor.selectedId = id;
  refreshDetectorList();
  drawRobotCtor();
});
['robotBodyW', 'robotBodyH'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.onchange = el.oninput = () => {
    robotCtor.bodyW = Math.max(40, parseInt(document.getElementById('robotBodyW').value) || 120);
    robotCtor.bodyH = Math.max(40, parseInt(document.getElementById('robotBodyH').value) || 150);
    drawRobotCtor();
  };
});

(function bindRobotCtorCanvas() {
  const canvas = document.getElementById('robotCtorCanvas');
  if (!canvas) return;
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const p = robotCtorPos(e);
    const hit = hitDetector(p);
    if (hit) {
      robotCtor.selectedId = hit.id;
      robotCtor.dragging = {
        id: hit.id,
        ox: p.x - (hit.kind === 'under' ? hit.x : (hit.offsetX || 0)),
        oy: p.y - (hit.kind === 'under' ? hit.y : (hit.offsetY != null ? hit.offsetY : robotCtor.bodyH / 2))
      };
      refreshDetectorList();
      drawRobotCtor();
    }
  });
  window.addEventListener('mousemove', e => {
    if (!robotCtor.dragging || sim.mode !== 'robot') return;
    const p = robotCtorPos(e);
    const d = robotCtor.detectors.find(x => x.id === robotCtor.dragging.id);
    if (!d) return;
    if (d.kind === 'under') {
      d.x = Math.round(p.x - robotCtor.dragging.ox);
      d.y = Math.round(p.y - robotCtor.dragging.oy);
    } else {
      d.offsetX = Math.round(p.x - robotCtor.dragging.ox);
      d.offsetY = Math.round(p.y - robotCtor.dragging.oy);
    }
    refreshDetectorEdit();
    drawRobotCtor();
  });
  window.addEventListener('mouseup', () => { robotCtor.dragging = null; });
})();

function currentRobotDefFromCtor() {
  return {
    name: document.getElementById('robotDefName')?.value || 'Meu Robô',
    body: { w: robotCtor.bodyW, h: robotCtor.bodyH },
    detectors: JSON.parse(JSON.stringify(robotCtor.detectors))
  };
}

function applyRobotDefToSim(def) {
  sim.activeRobotDef = JSON.parse(JSON.stringify(def));
  if (sim.robot) {
    sim.robot.definition = sim.activeRobotDef;
    sim.robot.width = (def.body.w || 120) * MM_TO_WORLD;
    sim.robot.height = (def.body.h || 150) * MM_TO_WORLD;
  }
  logUI({ t: 0, msg: `Robô "${def.name}" ativo (${def.detectors.length} detectores).`, category: 'success' });
  draw();
}

function refreshRobotLibrary() {
  const el = document.getElementById('robotLibrary');
  if (!el) return;
  if (!sim.robotLibrary.length) { el.textContent = 'Nenhum ainda.'; return; }
  el.innerHTML = sim.robotLibrary.map((r, i) =>
    `<div class="lib-item"><span><strong>${r.name}</strong> — ${r.detectors?.length || 0} det.</span>
      <span style="display:flex;gap:0.25rem">
        <button data-rload="${i}" class="primary">Carregar</button>
        <button data-ruse="${i}">Usar</button>
        <button data-rdel="${i}" class="danger">Excluir</button>
      </span></div>`
  ).join('');
  el.querySelectorAll('[data-rload]').forEach(btn => {
    btn.onclick = () => {
      const r = sim.robotLibrary[parseInt(btn.dataset.rload)];
      if (!r) return;
      robotCtor.bodyW = r.body.w; robotCtor.bodyH = r.body.h;
      robotCtor.detectors = JSON.parse(JSON.stringify(r.detectors || []));
      robotCtor.selectedId = null;
      robotCtor.editingIndex = parseInt(btn.dataset.rload);
      document.getElementById('robotDefName').value = r.name;
      document.getElementById('robotBodyW').value = r.body.w;
      document.getElementById('robotBodyH').value = r.body.h;
      refreshDetectorList();
      drawRobotCtor();
    };
  });
  el.querySelectorAll('[data-ruse]').forEach(btn => {
    btn.onclick = () => applyRobotDefToSim(sim.robotLibrary[parseInt(btn.dataset.ruse)]);
  });
  el.querySelectorAll('[data-rdel]').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.rdel);
      if (!confirm('Excluir robô?')) return;
      sim.robotLibrary.splice(i, 1);
      persist('obr_robot_library', sim.robotLibrary);
      refreshRobotLibrary();
    };
  });
}

document.getElementById('btnRobotSave')?.addEventListener('click', () => {
  const def = currentRobotDefFromCtor();
  if (robotCtor.editingIndex != null && robotCtor.editingIndex >= 0 && robotCtor.editingIndex < sim.robotLibrary.length) {
    sim.robotLibrary[robotCtor.editingIndex] = def;
    robotCtor.editingIndex = null;
  } else sim.robotLibrary.push(def);
  persist('obr_robot_library', sim.robotLibrary);
  refreshRobotLibrary();
  logUI({ t: 0, msg: `Robô "${def.name}" salvo na biblioteca.`, category: 'success' });
});
document.getElementById('btnRobotApply')?.addEventListener('click', () => {
  applyRobotDefToSim(currentRobotDefFromCtor());
});

function localToWorld(robot, lx, ly) {
  const x = lx * MM_TO_WORLD;
  const y = -ly * MM_TO_WORLD;
  const c = Math.cos(robot.angle), s = Math.sin(robot.angle);
  return {
    x: robot.pos.x + x * c - y * s,
    y: robot.pos.y + x * s + y * c
  };
}

function sampleArenaColor(wx, wy) {
  const gx = Math.floor(wx / TILE_PX);
  const gy = Math.floor(wy / TILE_PX);
  const tile = sim.tiles.find(t => t.gx === gx && t.gy === gy);
  if (!tile || tile.type === TileType.EMPTY) return { r: 15, g: 23, b: 42, lum: 20 };
  if (tile.type === TileType.CUSTOM && tile.custom && tile._img) {
    const img = tile._img;
    const lx = (wx - tile.worldX) / TILE_PX;
    const ly = (wy - tile.worldY) / TILE_PX;
    if (img.complete && img.naturalWidth > 0) {
      try {
        const tc = document.createElement('canvas');
        tc.width = 1; tc.height = 1;
        const tctx = tc.getContext('2d');
        const px = Math.max(0, Math.min(img.naturalWidth - 1, Math.floor(lx * img.naturalWidth)));
        const py = Math.max(0, Math.min(img.naturalHeight - 1, Math.floor(ly * img.naturalHeight)));
        tctx.drawImage(img, px, py, 1, 1, 0, 0, 1, 1);
        const d = tctx.getImageData(0, 0, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2], lum: 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2] };
      } catch (e) {}
    }
  }
  const lx = (wx - tile.worldX) / TILE_PX;
  const ly = (wy - tile.worldY) / TILE_PX;
  const onLine = Math.abs(ly - 0.5) < 0.08 || Math.abs(lx - 0.5) < 0.08;
  if (tile.type === TileType.GAP && Math.abs(lx - 0.5) < 0.15 && Math.abs(ly - 0.5) < 0.12)
    return { r: 168, g: 85, b: 247, lum: 120 };
  if (tile.opts && tile.opts.hasGreen && lx < 0.25 && ly < 0.25)
    return { r: 34, g: 197, b: 94, lum: 140 };
  if (onLine) return { r: 30, g: 41, b: 59, lum: 35 };
  return { r: 226, g: 232, b: 240, lum: 230 };
}

function sampleRegion(robot, points) {
  let r = 0, g = 0, b = 0, n = 0;
  for (const p of points) {
    const c = sampleArenaColor(p.x, p.y);
    r += c.r; g += c.g; b += c.b; n++;
  }
  if (!n) return { r: 0, g: 0, b: 0, lum: 0 };
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  return { r, g, b, lum: 0.299 * r + 0.587 * g + 0.114 * b };
}

function detectorSamplePoints(robot, d) {
  const pts = [];
  if (d.kind === 'under') {
    const steps = 3;
    for (let iy = 0; iy < steps; iy++) {
      for (let ix = 0; ix < steps; ix++) {
        const lx = d.x - d.w / 2 + (ix + 0.5) * d.w / steps;
        const ly = d.y - d.h / 2 + (iy + 0.5) * d.h / steps;
        pts.push(localToWorld(robot, lx, ly));
      }
    }
  } else {
    const ox = d.offsetX || 0;
    const oy = d.offsetY != null ? d.offsetY : (robot.definition?.body?.h || sim.activeRobotDef?.body?.h || 150) / 2;
    const len = d.length || 60, wid = d.width || 40;
    const stepsX = 4, stepsY = 5;
    for (let iy = 0; iy < stepsY; iy++) {
      for (let ix = 0; ix < stepsX; ix++) {
        const u = (ix + 0.5) / stepsX;
        const v = (iy + 0.5) / stepsY;
        let lx, ly;
        if (d.shape === 'triangle') {
          const half = (wid / 2) * (1 - v);
          lx = ox - half + u * (2 * half);
          ly = oy + v * len;
        } else {
          lx = ox - wid / 2 + u * wid;
          ly = oy + v * len;
        }
        pts.push(localToWorld(robot, lx, ly));
      }
    }
  }
  return pts;
}

function updateSensors(robot) {
  if (!robot) return;
  const def = robot.definition || sim.activeRobotDef;
  robot.sensorReadings = {};
  if (!def || !def.detectors) return;
  for (const d of def.detectors) {
    const pts = detectorSamplePoints(robot, d);
    robot.sensorReadings[d.name || d.id] = sampleRegion(robot, pts);
  }
}

function updateSensorReadout() {
  const el = document.getElementById('sensorReadout');
  if (!el || !sim.robot) return;
  const s = sim.robot.sensorReadings || {};
  const keys = Object.keys(s);
  if (!keys.length) { el.textContent = 'sensores: (defina robô na aba 6)'; return; }
  el.innerHTML = keys.map(k => {
    const v = s[k];
    return `<div>${k}: rgb(${v.r},${v.g},${v.b}) L=${v.lum.toFixed(0)}</div>`;
  }).join('');
}

function setControlMode(mode) {
  sim.controlMode = mode;
  const bp = document.getElementById('btnControlPath');
  const bs = document.getElementById('btnControlScript');
  if (bp) { bp.classList.toggle('active-tool', mode === 'path'); bp.classList.toggle('primary', mode === 'path'); }
  if (bs) { bs.classList.toggle('active-tool', mode === 'script'); bs.classList.toggle('primary', mode === 'script'); }
  if (sim.robot) { sim.robot.vLinear = 0; sim.robot.vAngular = 0; }
  logUI({ t: 0, msg: mode === 'script' ? 'Controle: Script.' : 'Controle: Path.', category: 'info' });
}
document.getElementById('btnControlPath')?.addEventListener('click', () => setControlMode('path'));
document.getElementById('btnControlScript')?.addEventListener('click', () => setControlMode('script'));

function compileRobotScript(src) {
  try {
    const body = src.includes('function update')
      ? src + '\n; return update;'
      : `function update(sensors, dt) {\n${src}\n}\n; return update;`;
    const fn = new Function(body)();
    if (typeof fn !== 'function') throw new Error('Defina function update(sensors, dt)');
    sim.scriptFn = fn;
    sim.scriptError = null;
    logUI({ t: 0, msg: 'Script aplicado.', category: 'success' });
    return true;
  } catch (err) {
    sim.scriptFn = null;
    sim.scriptError = String(err.message || err);
    logUI({ t: 0, msg: 'Erro no script: ' + sim.scriptError, category: 'warning' });
    return false;
  }
}

function runRobotScript(robot, dt) {
  if (!sim.scriptFn) return;
  const sensors = robot.sensorReadings || {};
  try {
    const prevV = window.setVelocity;
    const prevS = window.stop;
    window.setVelocity = (nv, nw) => {
      robot.vLinear = Number(nv) || 0;
      robot.vAngular = Number(nw) || 0;
    };
    window.stop = () => { robot.vLinear = 0; robot.vAngular = 0; };
    sim.scriptFn(sensors, dt);
    window.setVelocity = prevV;
    window.stop = prevS;
  } catch (err) {
    robot.vLinear = 0;
    robot.vAngular = 0;
    if (!sim.scriptError) {
      sim.scriptError = String(err.message || err);
      logUI({ t: sim.time, msg: 'Runtime script: ' + sim.scriptError, category: 'warning' });
    }
  }
}

document.getElementById('btnScriptApply')?.addEventListener('click', () => {
  compileRobotScript(document.getElementById('robotScript')?.value || '');
  setControlMode('script');
});
document.getElementById('btnScriptExample')?.addEventListener('click', () => {
  const ex = `// Seguidor de linha (line_left / line_right)
function update(sensors, dt) {
  const L = sensors.line_left ? sensors.line_left.lum : 200;
  const R = sensors.line_right ? sensors.line_right.lum : 200;
  const leftOn = L < 80;
  const rightOn = R < 80;
  if (leftOn && rightOn) setVelocity(50, 0);
  else if (leftOn) setVelocity(30, -1.2);
  else if (rightOn) setVelocity(30, 1.2);
  else setVelocity(35, 0.4);
}`;
  document.getElementById('robotScript').value = ex;
  compileRobotScript(ex);
  setControlMode('script');
});

window.addEventListener('resize', () => {
  if (sim.mode === 'robot') { fitRobotCtorCanvas(); drawRobotCtor(); }
});

const _origPlaceRobotAtStart = placeRobotAtStart;
placeRobotAtStart = function() {
  _origPlaceRobotAtStart();
  if (sim.robot && sim.activeRobotDef) {
    sim.robot.definition = sim.activeRobotDef;
    sim.robot.width = (sim.activeRobotDef.body.w || 120) * MM_TO_WORLD;
    sim.robot.height = (sim.activeRobotDef.body.h || 150) * MM_TO_WORLD;
  }
};

// ─── Backup UI + modo custom ─────────────────────────────────
function showBackupStatus(msg, ok = true) {
  const el = document.getElementById('backupStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.borderLeft = `3px solid ${ok ? 'var(--ok, #22c55e)' : 'var(--danger, #ef4444)'}`;
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 5000);
}

function applyLoadedLibrariesToUI() {
  refreshCustomSelect();
  refreshObjLibrary();
  refreshRobotLibrary();
  const tog = document.getElementById('toggleCustomMode');
  if (tog) tog.checked = !!sim.customMode;
}

async function reloadLibrariesFromStorage() {
  sim.customLibrary = await dataManager.loadKey('obr_custom_tiles', sim.customLibrary || []);
  sim.customObjLibrary = await dataManager.loadKey('obr_custom_objects', sim.customObjLibrary || []);
  sim.customArena = await dataManager.loadKey('obr_custom_arena', sim.customArena);
  sim.customArenaObjects = await dataManager.loadKey('obr_custom_arena_objects', sim.customArenaObjects || []);
  sim.robotLibrary = await dataManager.loadKey('obr_robot_library', sim.robotLibrary || []);
  sim.customMode = !!(await dataManager.loadKey('obr_custom_mode', false));
  applyLoadedLibrariesToUI();
}

document.getElementById('btnExportBackup')?.addEventListener('click', async () => {
  try {
    // sincroniza estado atual antes de exportar
    persist('obr_custom_tiles', sim.customLibrary);
    persist('obr_custom_objects', sim.customObjLibrary);
    persist('obr_custom_arena', sim.customArena);
    persist('obr_custom_arena_objects', sim.customArenaObjects);
    persist('obr_robot_library', sim.robotLibrary);
    persist('obr_custom_mode', sim.customMode);
    await dataManager.init();
    const name = `obr-backup-${new Date().toISOString().slice(0, 10)}.json`;
    await dataManager.downloadJSON(name);
    showBackupStatus('✅ Backup baixado: ' + name, true);
    logUI({ t: 0, msg: 'Backup completo exportado.', category: 'success' });
  } catch (err) {
    showBackupStatus('❌ Erro ao exportar: ' + err.message, false);
  }
});

document.getElementById('btnImportBackup')?.addEventListener('click', async () => {
  try {
    await dataManager.init();
    const result = await dataManager.uploadJSON();
    await reloadLibrariesFromStorage();
    showBackupStatus(`✅ Importados ${result.imported} conjuntos de dados.`, true);
    logUI({ t: 0, msg: `Backup importado (${result.imported} chaves).`, category: 'success' });
  } catch (err) {
    showBackupStatus('❌ Erro ao importar: ' + (err.message || err), false);
  }
});

document.getElementById('btnClearAllData')?.addEventListener('click', async () => {
  if (!confirm('Tem certeza? Isso apaga bibliotecas, arena salva, robôs e modo custom (irreversível).')) return;
  try {
    await dataManager.init();
    await dataManager.clearAll();
    sim.customLibrary = [];
    sim.customObjLibrary = [];
    sim.customArena = null;
    sim.customArenaObjects = [];
    sim.robotLibrary = [];
    sim.customMode = false;
    applyLoadedLibrariesToUI();
    showBackupStatus('✅ Todos os dados foram limpos.', true);
    logUI({ t: 0, msg: 'Dados locais limpos.', category: 'warning' });
  } catch (err) {
    showBackupStatus('❌ Erro ao limpar: ' + err.message, false);
  }
});

function applyCustomMode(enabled) {
  sim.customMode = !!enabled;
  persist('obr_custom_mode', sim.customMode);
  const tog = document.getElementById('toggleCustomMode');
  if (tog) tog.checked = sim.customMode;
  // Ao sair do modo custom, zera espelhamentos e desarma ferramenta custom
  if (!sim.customMode) {
    (sim.tiles || []).forEach(t => { t.mirrorH = false; t.mirrorV = false; });
    (sim.objects || []).forEach(o => { o.mirrorH = false; o.mirrorV = false; });
    if (sim.selectedTool === 'custom') {
      sim.selectedTool = 'straight';
      sim.placingCustomId = null;
    }
  }
  updateMirrorUI();
  renderTilePalette();
  updateCustomObjectUI();
  updateExportHint();
  if (!sim.customMode) {
    // garante camada oficial visível
    setEditorLayer('official');
  }
  logUI({
    t: 0,
    msg: sim.customMode
      ? 'Modo custom ativado — espelhamento, ladrilhos e objetos personalizados liberados.'
      : 'Modo custom desativado — personalizados bloqueados; export padrão = JSON oficial RCJ/OBR.',
    category: sim.customMode ? 'warning' : 'success'
  });
  draw();
}

const toggleCustomEl = document.getElementById('toggleCustomMode');
if (toggleCustomEl) {
  toggleCustomEl.addEventListener('change', (e) => applyCustomMode(e.target.checked));
  toggleCustomEl.addEventListener('click', (e) => {
    // garante resposta imediata em alguns browsers
    setTimeout(() => applyCustomMode(toggleCustomEl.checked), 0);
  });
}

// init (async: IndexedDB + migração)
(async function bootstrap() {
  try {
    await dataManager.init();
    sim.customLibrary = await dataManager.loadKey('obr_custom_tiles', []);
    sim.customObjLibrary = await dataManager.loadKey('obr_custom_objects', []);
    sim.customArena = await dataManager.loadKey('obr_custom_arena', null);
    sim.customArenaObjects = await dataManager.loadKey('obr_custom_arena_objects', []);
    sim.robotLibrary = await dataManager.loadKey('obr_robot_library', []);
    sim.customMode = !!(await dataManager.loadKey('obr_custom_mode', false));
  } catch (e) {
    console.warn('Bootstrap storage:', e);
    try { const a = localStorage.getItem('obr_custom_arena'); if (a) sim.customArena = JSON.parse(a); } catch (e2) {}
    try { const t = localStorage.getItem('obr_custom_tiles'); if (t) sim.customLibrary = JSON.parse(t); } catch (e2) {}
    try { const rl = localStorage.getItem('obr_robot_library'); if (rl) sim.robotLibrary = JSON.parse(rl); } catch (e2) {}
  }
  applyLoadedLibrariesToUI();
  updateMirrorUI();
  // pré-carrega catálogo oficial em background
  ensureOfficialPalette().catch(() => {});
  sim.activeRobotDef = defaultRobotDef();
  resizeCanvas();
  loadScenario('basic');
  if (sim.robot) {
    sim.robot.definition = sim.activeRobotDef;
    sim.robot.width = sim.activeRobotDef.body.w * MM_TO_WORLD;
    sim.robot.height = sim.activeRobotDef.body.h * MM_TO_WORLD;
  }
  setMode('sim');
  loop();
})();


// ═══════════════════════════════════════════════════════════════
// Compatibilidade RCJ Line Map Editor — meta, andares, modal props
// ═══════════════════════════════════════════════════════════════

function ensureMapMetaDefaults() {
  _ensureMapMetaDefaults(sim);
}

function applyMapMetaToUI() {
  _applyMapMetaToUI(sim, { rebuildFloorButtons, updateMapValidateHint });
}

function syncMapMetaFromUI() {
  _syncMapMetaFromUI(sim);
}

function updateMapValidateHint() {
  _updateMapValidateHint(sim);
}

function rebuildFloorButtons() {
  _rebuildFloorButtons(sim, { setCurrentFloor });
}

function setCurrentFloor(z) {
  _setCurrentFloor(sim, z, { draw, rebuildFloorButtons, updateMapValidateHint });
}


function hideTileContextMenu() {
  _hideTileContextMenu();
}

function showTileContextMenu(clientX, clientY, tile) {
  _showTileContextMenu(clientX, clientY, tile);
}

function fillTilePropsPanel(tile) {
  _fillTilePropsPanel(sim, tile, { updateCheckpointAvailability });
}

function updateCheckpointAvailability() {
  _updateCheckpointAvailability(sim);
}

function applyTilePropsFromPanel() {
  _applyTilePropsFromPanel(sim, {
    draw, schedulePathfinding, logUI, syncMapMetaFromUI, fillTilePropsPanel
  });
}

function wireTileContextMenu() {
  const menu = document.getElementById('tileContextMenu');
  if (!menu || menu._ctxWired) return;
  menu._ctxWired = true;

  menu.querySelectorAll('button[data-ctx]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.ctx;
      const tile = getContextTile() || sim.selectedTile;
      hideTileContextMenu();
      if (!tile || tile.type === TileType.EMPTY) return;
      sim.selectedTile = tile;

      if (action === 'props') {
        fillTilePropsPanel(tile);
        document.getElementById('panelTileProps')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (action === 'rotate-cw') {
        rotateSelected(1);
        fillTilePropsPanel(tile);
        return;
      }
      if (action === 'rotate-ccw') {
        rotateSelected(-1);
        fillTilePropsPanel(tile);
        return;
      }
      if (action === 'start') {
        // Marcar como Start (único na arena) — não alterna
        pushArenaUndo();
        (sim.tiles || []).forEach(tt => { tt.markStart = false; });
        tile.markStart = true;
        if (typeof syncMapMetaFromUI === 'function') syncMapMetaFromUI();
        fillTilePropsPanel(tile);
        draw();
        schedulePathfinding();
        logUI({ t: 0, msg: `Start marcado @${tile.gx},${tile.gy},z${tile.gz || 0}`, category: 'success' });
        return;
      }
      if (action === 'start2') {
        pushArenaUndo();
        (sim.tiles || []).forEach(tt => { tt.markStart2 = false; });
        tile.markStart2 = true;
        if (typeof syncMapMetaFromUI === 'function') syncMapMetaFromUI();
        fillTilePropsPanel(tile);
        draw();
        schedulePathfinding();
        logUI({ t: 0, msg: `Start2 marcado @${tile.gx},${tile.gy},z${tile.gz || 0}`, category: 'success' });
        return;
      }
      if (action === 'checkpoint') {
        pushArenaUndo();
        tile.markCheckpoint = true;
        if (typeof syncMapMetaFromUI === 'function') syncMapMetaFromUI();
        fillTilePropsPanel(tile);
        draw();
        schedulePathfinding();
        logUI({ t: 0, msg: `Checkpoint marcado @${tile.gx},${tile.gy},z${tile.gz || 0}`, category: 'success' });
        return;
      }
      if (action === 'delete') {
        clearTileAt(tile.gx, tile.gy, tile.gz || 0);
        fillTilePropsPanel(null);
        if (typeof syncMapMetaFromUI === 'function') syncMapMetaFromUI();
      }
    });
  });

  // Fechar menu ao clicar fora (uma vez só)
  if (!window._ctxMenuDismissWired) {
    window._ctxMenuDismissWired = true;
    document.addEventListener('click', (e) => {
      const m = document.getElementById('tileContextMenu');
      if (!m || m.classList.contains('hidden')) return;
      if (m.contains(e.target)) return;
      hideTileContextMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideTileContextMenu();
    });
  }
}

function wireTilePropsPanel() {
  const bumpVal = document.getElementById('propBumpVal');
  const obstVal = document.getElementById('propObstVal');
  if (!bumpVal) return;
  if (bumpVal._propsWired) {
    wireTileContextMenu();
    return;
  }
  bumpVal._propsWired = true;
  document.getElementById('propBumpMinus')?.addEventListener('click', () => {
    bumpVal.textContent = String(Math.max(0, (parseInt(bumpVal.textContent, 10) || 0) - 1));
    updateCheckpointAvailability();
  });
  document.getElementById('propBumpPlus')?.addEventListener('click', () => {
    bumpVal.textContent = String(Math.min(9, (parseInt(bumpVal.textContent, 10) || 0) + 1));
    updateCheckpointAvailability();
  });
  document.getElementById('propObstMinus')?.addEventListener('click', () => {
    obstVal.textContent = String(Math.max(0, (parseInt(obstVal.textContent, 10) || 0) - 1));
    updateCheckpointAvailability();
  });
  document.getElementById('propObstPlus')?.addEventListener('click', () => {
    obstVal.textContent = String(Math.min(9, (parseInt(obstVal.textContent, 10) || 0) + 1));
    updateCheckpointAvailability();
  });
  document.getElementById('propRamp')?.addEventListener('change', updateCheckpointAvailability);
  document.getElementById('btnTilePropApply')?.addEventListener('click', applyTilePropsFromPanel);
  wireTileContextMenu();
}

// Compat: openTilePropModal agora só preenche o painel
function openTilePropModal(tile) {
  fillTilePropsPanel(tile);
}

function wireMapMetaUI() {
  const dur = document.getElementById('mapDuration');
  const durVal = document.getElementById('mapDurationVal');
  if (dur) {
    dur.oninput = () => { if (durVal) durVal.textContent = dur.value; syncMapMetaFromUI(); };
  }
  const floors = document.getElementById('mapFloors');
  const floorsVal = document.getElementById('mapFloorsVal');
  if (floors) {
    floors.oninput = () => {
      if (floorsVal) floorsVal.textContent = floors.value;
      const n = parseInt(floors.value, 10) || 1;
      if ((sim.currentFloor || 0) >= n) setCurrentFloor(n - 1);
      syncMapMetaFromUI();
      rebuildFloorButtons();
    };
  }
  ['mapName', 'mapVictimsLive', 'mapVictimsDead', 'mapFinished'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', syncMapMetaFromUI);
  });
  ensureMapMetaDefaults();
  applyMapMetaToUI();
  wireTilePropsPanel();
}

try { wireMapMetaUI(); wireTilePropsPanel(); } catch (err) { console.error('wireMapMetaUI', err); }



// ─── Preview visual ao arrastar ladrilho ─────────────────────

function showTileDragPreview(clientX, clientY, payload, invalid) {
  _showTileDragPreview(clientX, clientY, payload, invalid, {
    paintDragPreview: (cnv, p) => paintDragPreview(cnv, p)
  });
}

function hideTileDragPreview() {
  _hideTileDragPreview();
}

function paintDragPreview(cnv, payload) {
  _paintDragPreview(cnv, payload, {
    getCachedOfficialImage,
    renderTilePreviewToCanvas,
    customLibrary: sim.customLibrary
  });
}

// ═══════════════════════════════════════════════════════════════
// Drag & drop paleta ↔ grade + pathfinding automático
// ═══════════════════════════════════════════════════════════════

let _pathfindTimer = null;

function schedulePathfinding() {
  if (_pathfindTimer) clearTimeout(_pathfindTimer);
  _pathfindTimer = setTimeout(runPathfinding, 120);
}

function runPathfinding() {
  try {
    if (typeof syncMapMetaFromUI === 'function') syncMapMetaFromUI();
    const official = convertToOfficialArena({
      gridW: sim.gridW,
      gridH: sim.gridH,
      tiles: (sim.tiles || []).filter(t => t.type !== TileType.EMPTY).map(t => t.toJSON()),
      objects: sim.objects || [],
      meta: sim.officialMeta || {}
    });
    const { map, indexCount } = updateTileIndex(official);
    // Espelha index/next de volta nos tiles internos (opts)
    for (const key of Object.keys(map.tiles || {})) {
      const ot = map.tiles[key];
      const parts = key.split(',').map(Number);
      const [x, y, z] = parts;
      const tile = (sim.tiles || []).find(t => t.gx === x && t.gy === y && (t.gz || 0) === (z || 0));
      if (tile) {
        if (!tile.opts) tile.opts = {};
        tile.opts.pathIndex = ot.index || [];
        tile.opts.pathNext = ot.next || [];
      }
    }
    if (sim.officialMeta) {
      sim.officialMeta.indexCount = indexCount;
      sim.officialMeta.EvacuationAreaLoPIndex = map.EvacuationAreaLoPIndex;
    }
    const hint = document.getElementById('mapValidateHint');
    if (hint && indexCount > 0) {
      // não sobrescreve aviso de finished sem start
      if (!(sim.officialMeta && sim.officialMeta.finished && indexCount === 0)) {
        const base = hint.textContent || '';
        if (!base.includes('path')) {
          /* keep existing validate text */
        }
      }
    }
  } catch (err) {
    console.warn('pathfinding:', err);
  }
}

function placeTileAt(gx, gy, payload) {
  return _placeTileAt(sim, gx, gy, payload, {
    draw, schedulePathfinding, fillTilePropsPanel, clearTileSelection, logUI,
    classifyOfficialFilename
  });
}

function clearTileAt(gx, gy, gz) {
  _clearTileAt(sim, gx, gy, gz, { draw, schedulePathfinding });
}

function moveTile(from, toGx, toGy) {
  _moveTile(sim, from, toGx, toGy, { draw, schedulePathfinding });
}

function wireArenaDragDrop() {
  const wrap = document.getElementById('canvasWrap');
  if (!wrap || !canvas) return;

  canvas.addEventListener('dragover', (e) => {
    if (sim.mode !== 'editor') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = getDragMoveFrom() ? 'move' : 'copy';
    wrap.classList.add('drag-over');
    const w = screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = worldToGrid(w.x, w.y);
    const invalid = gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH;
    if (getDragPayload() || getDragMoveFrom()) {
      const _dmf = getDragMoveFrom();
      const payload = getDragPayload() || (_dmf ? { kind: 'move', tile: sim.tiles.find(t => t.gx === _dmf.gx && t.gy === _dmf.gy) } : null);
      if (payload) showTileDragPreview(e.clientX, e.clientY, payload, invalid);
    }
  });
  canvas.addEventListener('dragleave', () => {
    wrap.classList.remove('drag-over');
  });
  // preview follows globally during HTML5 drag
  document.addEventListener('dragover', (e) => {
    if (!getDragPayload() && !getDragMoveFrom()) return;
    const _dmf = getDragMoveFrom();
      const payload = getDragPayload() || (_dmf ? { kind: 'move', tile: sim.tiles.find(t => t.gx === _dmf.gx && t.gy === _dmf.gy) } : null);
    if (payload) showTileDragPreview(e.clientX, e.clientY, payload, false);
  });
  document.addEventListener('dragend', () => {
    hideTileDragPreview();
    setDragMoveFrom(null);
  });
  canvas.addEventListener('drop', (e) => {
    if (sim.mode !== 'editor') return;
    e.preventDefault();
    wrap.classList.remove('drag-over');
    hideTileDragPreview();
    const w = screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = worldToGrid(w.x, w.y);

    // Move from grid?
    if (getDragMoveFrom()) {
      const from = getDragMoveFrom();
      setDragMoveFrom(null);
      if (gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH) {
        // soltar fora = remover
        clearTileAt(from.gx, from.gy, from.gz);
        logUI({ t: 0, msg: `Ladrilho removido @${from.gx},${from.gy}`, category: 'info' });
        return;
      }
      moveTile(from, gx, gy);
      return;
    }

    let raw = e.dataTransfer.getData('application/x-obr-tile');
    if (!raw) raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      placeTileAt(gx, gy, payload);
    } catch (err) {
      console.warn('drop parse', err);
    }
  });

  // Drag existing tile from canvas (HTML5 drag doesn't work on canvas pixels easily —
  // use pointer-based move: mousedown+drag with Alt, or start on empty tool selection)
  // Implementação: ao arrastar com botão esquerdo SEM ferramenta ativa, move o tile
  let moveDrag = null;
  canvas.addEventListener('mousedown', (e) => {
    if (sim.mode !== 'editor' || e.button !== 0) return;
    if (sim.selectedTool || sim.objectTool || sim.markerTool || sim.measureMode) return;
    const w = screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = worldToGrid(w.x, w.y);
    const z = sim.currentFloor || 0;
    const tile = sim.tiles.find(t => t.gx === gx && t.gy === gy && (t.gz || 0) === z && t.type !== TileType.EMPTY);
    if (!tile) return;
    moveDrag = { gx, gy, gz: z, startX: e.clientX, startY: e.clientY, active: false };
  });
  window.addEventListener('mousemove', (e) => {
    if (!moveDrag) return;
    const dist = Math.hypot(e.clientX - moveDrag.startX, e.clientY - moveDrag.startY);
    if (!moveDrag.active && dist > 8) {
      moveDrag.active = true;
      setDragMoveFrom({ gx: moveDrag.gx, gy: moveDrag.gy, gz: moveDrag.gz });
      const tile = sim.tiles.find(t => t.gx === moveDrag.gx && t.gy === moveDrag.gy && (t.gz || 0) === (moveDrag.gz || 0));
      setDragPayload({ kind: 'move', tile });
      canvas.style.cursor = 'grabbing';
    }
    if (moveDrag.active) {
      const tile = sim.tiles.find(t => t.gx === moveDrag.gx && t.gy === moveDrag.gy && (t.gz || 0) === (moveDrag.gz || 0));
      const w = screenToWorld(e.clientX, e.clientY);
      const { gx, gy } = worldToGrid(w.x, w.y);
      const invalid = gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH;
      showTileDragPreview(e.clientX, e.clientY, { kind: 'move', tile }, invalid);
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (!moveDrag) return;
    const was = moveDrag;
    moveDrag = null;
    canvas.style.cursor = '';
    hideTileDragPreview();
    if (!was.active) {
      setDragMoveFrom(null);
      return;
    }
    const w = screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = worldToGrid(w.x, w.y);
    const from = { gx: was.gx, gy: was.gy, gz: was.gz };
    setDragMoveFrom(null);
    // drop outside canvas or invalid = remove (drag-out)
    const rect = canvas.getBoundingClientRect();
    const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
    if (outside || gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH) {
      clearTileAt(from.gx, from.gy, from.gz);
      logUI({ t: 0, msg: `Ladrilho removido @${from.gx},${from.gy}`, category: 'info' });
      return;
    }
    moveTile(from, gx, gy);
  });

  // Drop on palette area = remove (drag-out target)
  const paletteTargets = ['officialTileTools', 'tileTools'];
  paletteTargets.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      if (getDragMoveFrom()) {
        const _df = getDragMoveFrom();
        clearTileAt(_df.gx, _df.gy, _df.gz);
        setDragMoveFrom(null);
      }
    });
  });
}

function updateCustomObjectUI() {
  const block = document.getElementById('customObjectsBlock');
  const btn = document.querySelector('#objectToolsCustom button[data-obj="custom"]')
    || document.querySelector('#objectTools button[data-obj="custom"]');
  const sel = document.getElementById('customObjSelect');
  const allow = !!sim.customMode;
  if (block) block.classList.toggle('hidden', !allow);
  if (btn) {
    btn.disabled = !allow;
    btn.style.opacity = allow ? '1' : '0.45';
    btn.title = allow ? 'Objeto custom' : 'Disponível apenas no Modo Custom';
    // re-bind click if in custom block
    if (!btn._wiredCustom) {
      btn._wiredCustom = true;
      btn.onclick = () => {
        if (!sim.customMode) {
          logUI({ t: 0, msg: 'Modo oficial: objetos personalizados bloqueados.', category: 'warning' });
          return;
        }
        document.querySelectorAll('#objectTools button, #objectToolsCustom button').forEach(b => b.classList.remove('active-tool'));
        btn.classList.add('active-tool');
        sim.objectTool = 'custom';
        sim.selectedTool = null;
        sim.markerTool = null;
        const s = document.getElementById('customObjSelect');
        if (s && s.value !== '') sim.placingCustomObjId = parseInt(s.value, 10);
      };
    }
  }
  if (sel) {
    sel.disabled = !allow;
    sel.style.opacity = allow ? '1' : '0.45';
  }
  if (!allow && sim.objectTool === 'custom') {
    sim.objectTool = null;
  }
}

function updateExportHint() {
  const el = document.getElementById('exportHint');
  if (!el) return;
  el.textContent = sim.customMode
    ? 'Modo Custom: Exportar = formato do app. «Exportar (outro)» = JSON oficial RCJ. Arraste tiles · Shift+R = anti-horário.'
    : 'Modo oficial: Exportar = JSON RCJ/OBR (com pathfinding). «Exportar (outro)» = formato do app. Arraste tiles · Shift+R = anti-horário.';
}

// Pathfinding após colocação por clique (já existente)
const _origPushArena = typeof pushArenaUndo === 'function' ? null : null;

try {
  wireArenaDragDrop();
  updateCustomObjectUI();
  updateExportHint();
  // camada oficial por padrão no editor
  if (typeof setEditorLayer === 'function') {
    // só se ainda não escolheu
  }
} catch (err) {
  console.error('DnD init', err);
}
