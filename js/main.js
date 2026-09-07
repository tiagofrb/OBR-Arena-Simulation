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
  APP_MODES,
  MM_TO_WORLD,
  MANUAL_LINEAR_SPEED,
  MANUAL_ANGULAR_SPEED,
  PATH_FOLLOW_SPEED,
  PATH_WAYPOINT_EPSILON
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
import { createPersist } from './core/persist.js';
import { isTypingTarget } from './core/typing.js';
import {
  initHelpDrawer,
  setMode as _setMode
} from './app/AppShell.js';
import { wireKeyboard } from './app/Keyboard.js';
import { startGameLoop, wireResize } from './app/GameLoop.js';
import {
  updateScoreUI as _updateScoreUI,
  logUI as _logUI,
  clearLog as _clearLog
} from './ui/ScorePanel.js';
import {
  ensureOfficialPalette as _ensureOfficialPalette,
  renderOfficialPalette as _renderOfficialPalette,
  loadOfficialTileCatalog as _loadOfficialTileCatalog,
  probeOfficialImage as _probeOfficialImage
} from './editor/OfficialCatalog.js';
import {
  updateMirrorUI as _updateMirrorUI,
  updateCustomObjectUI as _updateCustomObjectUI,
  updateExportHint as _updateExportHint,
  applyCustomMode as _applyCustomMode
} from './editor/CustomMode.js';
import {
  downloadJSONFile as _downloadJSONFile,
  exportArenaJSON as _exportArenaJSON,
  createPathfindingScheduler,
  runPathfinding as _runPathfinding,
  importArenaFromFile as _importArenaFromFile,
  saveArenaToStorage as _saveArenaToStorage,
  wireArenaIO as _wireArenaIO
} from './editor/ArenaIO.js';
import {
  renderTilePreviewToCanvas as _renderTilePreviewToCanvas,
  attachTilePreviewHover as _attachTilePreviewHover,
  positionTilePreview as _positionTilePreview,
  renderTilePalette as _renderTilePalette
} from './editor/TilePalette.js';
import { wireEditorInput } from './editor/EditorInput.js';
import { scenarios as _scenarios } from './sim/Scenarios.js';
import {
  placeRobotAtStart as _placeRobotAtStart,
  restartRobot as _restartRobot,
  loadScenario as _loadScenario,
  checkTileEvents as _checkTileEvents,
  update as _updateSim
} from './sim/Simulation.js';
import {
  localToWorld as _localToWorld,
  sampleArenaColor as _sampleArenaColor,
  sampleRegion as _sampleRegion,
  detectorSamplePoints as _detectorSamplePoints,
  updateSensors as _updateSensors,
  updateSensorReadout as _updateSensorReadout
} from './sim/Sensors.js';
import {
  setControlMode as _setControlMode,
  compileRobotScript as _compileRobotScript,
  runRobotScript as _runRobotScript,
  wireRobotScriptUI
} from './sim/RobotScript.js';


const dataManager = new DataManager();

/** Persiste chave (localStorage imediato + IndexedDB assíncrono) */
const persist = createPersist(dataManager);

const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvasWrap');

let tilePreviewPop = document.getElementById('tilePreviewPop');
let tilePreviewCanvas = document.getElementById('tilePreviewCanvas');
let tilePreviewCap = document.getElementById('tilePreviewCap');

// ─── Guia rápido (drawer) ────────────────────────────────────
initHelpDrawer();

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

// ─── Scenarios (js/sim/Scenarios.js) ─────────────────────────
const scenarios = _scenarios;


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

function getSimDeps() {
  return {
    tileIsStart,
    tileIsFinish,
    tileIsCheckpoint,
    ensureGridMatrix,
    clearLog,
    updateScoreUI,
    logUI,
    updateGridStatus,
    fitCamera,
    draw,
    inverseTransform
  };
}

function placeRobotAtStart() {
  _placeRobotAtStart(sim, getSimDeps());
}

function restartRobot() {
  _restartRobot(sim, getSimDeps());
}

function loadScenario(key) {
  _loadScenario(sim, key, getSimDeps());
}

// ─── Update / score triggers (js/sim/*) ───────────────────────
function update(dt) {
  _updateSim(sim, dt, getSimDeps());
}

function checkTileEvents(robot) {
  _checkTileEvents(sim, robot, getSimDeps());
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


// ─── UI helpers (delegados a js/ui/ScorePanel.js) ────────────
function updateScoreUI() {
  _updateScoreUI(sim);
}

function logUI(ev) {
  _logUI(ev);
}

function clearLog() {
  _clearLog();
}

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

// ─── Paleta de ladrilhos (js/editor/TilePalette.js) ──────────
function getPreviewEls() {
  return {
    pop: tilePreviewPop,
    canvas: tilePreviewCanvas,
    cap: tilePreviewCap
  };
}

function clearTileSelection() {
  _clearTileSelection(sim);
}

function selectTileTool(type, customIdx) {
  _selectTileTool(sim, type, customIdx, { logUI });
}

function renderTilePreviewToCanvas(cnv, type, customDef) {
  _renderTilePreviewToCanvas(cnv, type, customDef);
}

function attachTilePreviewHover(btn, type, customDef, label) {
  _attachTilePreviewHover(btn, type, customDef, label, getPreviewEls());
}

function positionTilePreview(btn) {
  _positionTilePreview(btn, getPreviewEls());
}

function renderTilePalette() {
  _renderTilePalette(sim, {
    previewEls: getPreviewEls(),
    selectTileTool,
    clearTileSelection,
    persist,
    refreshCustomSelect,
    setDragPayload,
    showTileDragPreview,
    hideTileDragPreview
  });
}

function setMode(mode) {
  _setMode(sim, mode, {
    closeConstructorTab,
    closeObjConstructorTab,
    closeRobotConstructorTab,
    openConstructorTab,
    openObjConstructorTab,
    openRobotConstructorTab,
    ensureGridMatrix,
    setEditorLayer,
    updateCustomObjectUI,
    updateExportHint,
    fitCamera,
    draw,
    // const schedulePathfinding pode ainda não existir se setMode for chamado cedo
    schedulePathfinding: () => {
      if (typeof schedulePathfinding === 'function') schedulePathfinding();
    },
    placeRobotAtStart
  });
}

// ─── Editor mouse (js/editor/EditorInput.js) ─────────────────
// wired in wireEditorCanvas() after helper defs exist

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

// ─── Catálogo de ladrilhos oficiais (js/editor/OfficialCatalog.js)
sim.placingOfficialFile = null;
sim.officialTileFiles = []; // [{ file, url, type }]
const _officialPaletteState = { loaded: false };

function classifyOfficialFilename(file) {
  return _classifyOfficialFilename(file);
}

function probeOfficialImage(file) {
  return _probeOfficialImage(file, classifyOfficialFilename);
}

async function loadOfficialTileCatalog() {
  return _loadOfficialTileCatalog(sim, classifyOfficialFilename);
}

function selectOfficialTile(file) {
  _selectOfficialTile(sim, file);
}

function renderOfficialPalette() {
  _renderOfficialPalette(sim, {
    selectOfficialTile,
    setDragPayload,
    showTileDragPreview,
    hideTileDragPreview
  });
}

async function ensureOfficialPalette() {
  return _ensureOfficialPalette(sim, _officialPaletteState, {
    classifyOfficialFilename,
    selectOfficialTile,
    setDragPayload,
    showTileDragPreview,
    hideTileDragPreview
  });
}

function updateMirrorUI() {
  _updateMirrorUI(sim);
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
function downloadJSONFile(filename, data) {
  _downloadJSONFile(filename, data);
}

function getArenaIODeps() {
  return {
    syncMapMetaFromUI,
    convertToOfficialArena,
    updateTileIndex,
    validateOfficialMap,
    TileType,
    logUI,
    isOfficialArenaFormat,
    convertOfficialArena,
    pushArenaUndo,
    ensureGridMatrix,
    Tile,
    persist,
    applyMapMetaToUI,
    ensureMapMetaDefaults,
    fitCamera,
    draw
  };
}

function exportArenaJSON(forceFormat) {
  _exportArenaJSON(sim, forceFormat, getArenaIODeps());
}

_wireArenaIO(sim, getArenaIODeps());

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

// Teclado e resize (js/app/Keyboard.js + GameLoop.js) — wiring após defs de undo/rotate
function wireEditorCanvas() {
  wireEditorInput({
    canvas,
    cam,
    sim,
    deps: {
      screenToWorld,
      worldToGrid,
      draw,
      logUI,
      pushArenaUndo,
      clearTileSelection,
      fillTilePropsPanel,
      schedulePathfinding,
      classifyOfficialFilename,
      setEditorLayer,
      ensureOfficialPalette,
      selectOfficialTile,
      selectTileTool,
      refreshCustomSelect,
      showTileContextMenu,
      hideTileContextMenu,
      setZoom,
      updateZoomUI,
      Tile,
      Robot,
      TileType
    }
  });
}

function wireAppShell() {
  // deps resolvidos na hora do evento (funções/estado definidos mais abaixo no arquivo)
  wireKeyboard(sim, {
    setMode,
    undoCtor: () => { if (typeof undoCtor === 'function') undoCtor(); },
    redoCtor: () => { if (typeof redoCtor === 'function') redoCtor(); },
    undoObjCtor: () => { if (typeof undoObjCtor === 'function') undoObjCtor(); },
    redoObjCtor: () => { if (typeof redoObjCtor === 'function') redoObjCtor(); },
    undoArena,
    redoArena,
    getCtor: () => (typeof ctor !== 'undefined' ? ctor : null),
    drawCtor: () => { if (typeof drawCtor === 'function') drawCtor(); },
    getObjCtor: () => (typeof objCtor !== 'undefined' ? objCtor : null),
    drawObjCtor: () => { if (typeof drawObjCtor === 'function') drawObjCtor(); },
    rotateSelected,
    mirrorSelected,
    clearTileAt,
    fillTilePropsPanel: (t) => { if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(t); },
    logUI,
    cancelEditorTools: _cancelEditorTools,
    draw,
    TileType
  });
  wireResize(resizeCanvas);
}

function loop() {
  startGameLoop(sim, { update, draw });
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

// ─── Sensores + script (js/sim/Sensors.js, RobotScript.js) ───
function localToWorld(robot, lx, ly) {
  return _localToWorld(robot, lx, ly);
}

function sampleArenaColor(wx, wy) {
  return _sampleArenaColor(sim, wx, wy);
}

function sampleRegion(robot, points) {
  return _sampleRegion(sim, points);
}

function detectorSamplePoints(robot, d) {
  return _detectorSamplePoints(robot, d, sim.activeRobotDef);
}

function updateSensors(robot) {
  _updateSensors(sim, robot);
}

function updateSensorReadout() {
  _updateSensorReadout(sim);
}

function setControlMode(mode) {
  _setControlMode(sim, mode, { logUI });
}

function compileRobotScript(src) {
  return _compileRobotScript(sim, src, { logUI });
}

function runRobotScript(robot, dt) {
  _runRobotScript(sim, robot, dt, { logUI });
}

wireRobotScriptUI(sim, { logUI });



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
  _applyCustomMode(sim, enabled, {
    persist,
    renderTilePalette,
    setEditorLayer,
    logUI,
    draw
  });
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
  wireEditorCanvas();
  wireAppShell();
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

const _pathfindState = { timer: null };

function runPathfinding() {
  _runPathfinding(sim, {
    syncMapMetaFromUI,
    convertToOfficialArena,
    updateTileIndex,
    TileType
  });
}

const schedulePathfinding = createPathfindingScheduler(_pathfindState, runPathfinding);


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
  _updateCustomObjectUI(sim, { logUI });
}

function updateExportHint() {
  _updateExportHint(sim);
}

try {
  wireArenaDragDrop();
  updateCustomObjectUI();
  updateExportHint();
} catch (err) {
  console.error('DnD init', err);
}
