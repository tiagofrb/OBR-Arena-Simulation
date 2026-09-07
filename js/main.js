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
import { createSessionState, createCameraState } from './core/session.js';

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
  setDragPayload,
  wireArenaDragDrop as _wireArenaDragDrop
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
import {
  CELL_MM as _CELL_MM,
  GRID_CELLS as _GRID_CELLS,
  CANVAS_MM as _CANVAS_MM,
  createCtorState,
  initCtorBuffer as _initCtorBuffer,
  clearCtorBuffer as _clearCtorBuffer,
  fitCtorCanvas as _fitCtorCanvas,
  setCtorZoom as _setCtorZoomTile,
  drawCtor as _drawCtor,
  openConstructorTab as _openConstructorTab,
  closeConstructorTab as _closeConstructorTab,
  bufferToCustomDef as _bufferToCustomDef,
  loadCustomTileIntoCtor as _loadCustomTileIntoCtor,
  refreshCustomSelect as _refreshCustomSelect,
  wireTileCtorCanvas,
  wireTileCtorUI,
  pushUndo as _pushUndo,
  undoCtor as _undoCtor,
  redoCtor as _redoCtor,
  paintAt as _paintAtTile,
  ctorPos as _ctorPos
} from './constructors/TileConstructor.js';
import {
  OBJ_MM as _OBJ_MM,
  createObjCtorState,
  initObjBuf as _initObjBuf,
  fitObjCtorCanvas as _fitObjCtorCanvas,
  setObjCtorZoom as _setObjCtorZoom,
  drawObjCtor as _drawObjCtor,
  openObjConstructorTab as _openObjConstructorTab,
  closeObjConstructorTab as _closeObjConstructorTab,
  refreshObjLibrary as _refreshObjLibrary,
  wireObjCtorCanvas,
  wireObjCtorUI,
  pushObjUndo as _pushObjUndo,
  undoObjCtor as _undoObjCtor,
  redoObjCtor as _redoObjCtor,
  paintObjAt as _paintObjAt,
  objCtorPos as _objCtorPos
} from './constructors/ObjectConstructor.js';
import {
  createRobotCtorState,
  defaultRobotDef as _defaultRobotDef,
  openRobotConstructorTab as _openRobotConstructorTab,
  closeRobotConstructorTab as _closeRobotConstructorTab,
  fitRobotCtorCanvas as _fitRobotCtorCanvas,
  drawRobotCtor as _drawRobotCtor,
  currentRobotDefFromCtor as _currentRobotDefFromCtor,
  applyRobotDefToSim as _applyRobotDefToSim,
  refreshRobotLibrary as _refreshRobotLibrary,
  refreshDetectorList as _refreshDetectorList,
  wireRobotConstructor
} from './constructors/RobotConstructor.js';



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
const cam = createCameraState();

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
const sim = createSessionState();

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
  _loadCustomTileIntoCtor(sim, ctor, idx, {
    drawCtor,
    logUI,
    setMode
  });
}

function refreshCustomSelect() {
  _refreshCustomSelect(sim, {
    persist,
    loadCustomTileIntoCtor,
    renderTilePalette
  });
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

// ─── Constructor de ladrilho (js/constructors/TileConstructor.js) ─
const CELL_MM = _CELL_MM;
const GRID_CELLS = _GRID_CELLS;
const CANVAS_MM = _CANVAS_MM;
const ctor = createCtorState();
const ctorCanvas = document.getElementById('ctorCanvas');
const ctorCtx = ctorCanvas ? ctorCanvas.getContext('2d') : null;

function initCtorBuffer() { _initCtorBuffer(ctor); }
function clearCtorBuffer() { _clearCtorBuffer(ctor); }
function fitCtorCanvas() { _fitCtorCanvas(ctorCanvas, ctorCtx, ctor); }
function setCtorZoom(factor) { _setCtorZoomTile(ctorCanvas, ctor, factor, drawCtor); }
function drawCtor() { _drawCtor(ctorCanvas, ctorCtx, ctor); }
function openConstructorTab() {
  _openConstructorTab(ctor, ctorCanvas, ctorCtx, {
    setGridLock: (v) => setGridLock(v),
    logUI
  });
}
function closeConstructorTab() { _closeConstructorTab(ctorCanvas); }
function ctorPos(e) { return _ctorPos(ctorCanvas, ctor, e); }
function pushUndo() { _pushUndo(ctor); }
function undoCtor() { _undoCtor(ctor, drawCtor); }
function redoCtor() { _redoCtor(ctor, drawCtor); }
function paintAt(x, y) { _paintAtTile(ctor, x, y); }
function bufferToCustomDef(name, points) { return _bufferToCustomDef(ctor, name, points); }

// canvas + UI wiring deferred until setGridLock exists (below)

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

wireTileCtorCanvas(ctor, ctorCanvas, { drawCtor, logUI });
wireTileCtorUI(ctor, sim, {
  drawCtor,
  logUI,
  persist,
  refreshCustomSelect,
  setCtorZoom,
  fitCtorCanvas
});


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


// ─── Object Constructor (js/constructors/ObjectConstructor.js) ──
const OBJ_MM = _OBJ_MM;
const objCtor = createObjCtorState();
const objCtorCanvas = document.getElementById('objCtorCanvas');
const objCtorCtx = objCtorCanvas ? objCtorCanvas.getContext('2d') : null;

function initObjBuf() { _initObjBuf(objCtor); }
function fitObjCtorCanvas() { _fitObjCtorCanvas(objCtorCanvas, objCtorCtx, objCtor); }
function setObjCtorZoom(factor) { _setObjCtorZoom(objCtorCanvas, objCtor, factor, drawObjCtor); }
function drawObjCtor() { _drawObjCtor(objCtorCanvas, objCtorCtx, objCtor); }
function openObjConstructorTab() { _openObjConstructorTab(objCtor, objCtorCanvas, objCtorCtx); }
function closeObjConstructorTab() { _closeObjConstructorTab(objCtorCanvas); }
function objCtorPos(e) { return _objCtorPos(objCtorCanvas, objCtor, e); }
function pushObjUndo() { _pushObjUndo(objCtor); }
function undoObjCtor() { _undoObjCtor(objCtor, drawObjCtor); }
function redoObjCtor() { _redoObjCtor(objCtor, drawObjCtor); }
function paintObjAt(x, y) { _paintObjAt(objCtor, x, y); }
function refreshObjLibrary() {
  _refreshObjLibrary(sim, { persist });
}

try {
  const o = localStorage.getItem('obr_custom_objects');
  if (o) sim.customObjLibrary = JSON.parse(o);
} catch (e) {}
try {
  const ao = localStorage.getItem('obr_custom_arena_objects');
  if (ao) sim.customArenaObjects = JSON.parse(ao);
} catch (e) {}
refreshObjLibrary();

wireObjCtorCanvas(objCtor, objCtorCanvas, { drawObjCtor, logUI });
wireObjCtorUI(objCtor, sim, {
  drawObjCtor,
  logUI,
  persist,
  refreshObjLibrary,
  setObjCtorZoom,
  fitObjCtorCanvas
});

// ═══════════════════════════════════════════════════════════════
// Construtor de robô (js/constructors/RobotConstructor.js)
// ═══════════════════════════════════════════════════════════════
const robotCtor = createRobotCtorState();

function defaultRobotDef() {
  return _defaultRobotDef();
}

function fitRobotCtorCanvas() {
  _fitRobotCtorCanvas(robotCtor);
}

function drawRobotCtor() {
  _drawRobotCtor(robotCtor);
}

function refreshDetectorList() {
  _refreshDetectorList(robotCtor, { drawRobotCtor, refreshDetectorList });
}

function openRobotConstructorTab() {
  _openRobotConstructorTab(robotCtor, {
    fitRobotCtorCanvas,
    refreshDetectorList,
    drawRobotCtor
  });
}

function closeRobotConstructorTab() {
  _closeRobotConstructorTab();
}

function currentRobotDefFromCtor() {
  return _currentRobotDefFromCtor(robotCtor);
}

function applyRobotDefToSim(def) {
  _applyRobotDefToSim(sim, def, { logUI, draw });
}

function refreshRobotLibrary() {
  _refreshRobotLibrary(sim, robotCtor, {
    persist,
    refreshDetectorList,
    drawRobotCtor,
    applyRobotDefToSim
  });
}

wireRobotConstructor(robotCtor, sim, {
  drawRobotCtor,
  refreshDetectorList,
  refreshRobotLibrary,
  applyRobotDefToSim,
  persist,
  logUI
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
  _wireArenaDragDrop({
    canvas,
    sim,
    deps: {
      screenToWorld,
      worldToGrid,
      placeTileAt,
      clearTileAt,
      moveTile,
      logUI,
      showTileDragPreview,
      hideTileDragPreview
    }
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
