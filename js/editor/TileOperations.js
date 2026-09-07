/**
 * Operações de edição da arena: colocar, limpar, mover, rotacionar e espelhar.
 * Funções recebem `sim` e um objeto de dependências (draw, logUI, etc.)
 * para reduzir acoplamento com closures de main.js.
 */

import { Tile, TileType } from '../engine/Models.js';
import { pushArenaUndo } from './ArenaHistory.js';

/**
 * Classifica nome de arquivo do catálogo oficial (fallback simples).
 * @param {string} file
 * @returns {string} TileType string
 */
export function classifyOfficialFilename(file) {
  const f = String(file).toLowerCase();
  if (f === 'seesaw.png') return TileType.GANGORRA;
  if (f === 'exit.png') return TileType.RESCUE_EXIT;
  if (f.startsWith('ev')) return TileType.RESCUE;
  return TileType.STRAIGHT;
}

/**
 * Localiza tile em (gx, gy, gz).
 * @param {object} sim
 * @param {number} gx
 * @param {number} gy
 * @param {number} [gz]
 */
export function findTileAt(sim, gx, gy, gz) {
  const z = gz != null ? gz : (sim.currentFloor || 0);
  return sim.tiles.find(t => t.gx === gx && t.gy === gy && (t.gz || 0) === z)
    || sim.tiles.find(t => t.gx === gx && t.gy === gy)
    || null;
}

/**
 * Coloca um ladrilho na grade a partir de um payload de ferramenta/drag.
 * @param {object} sim
 * @param {number} gx
 * @param {number} gy
 * @param {object} payload - { kind: 'official'|'custom'|'builtin', ... }
 * @param {object} deps - { draw, schedulePathfinding, fillTilePropsPanel, clearTileSelection, logUI, classifyOfficialFilename? }
 * @returns {boolean}
 */
export function placeTileAt(sim, gx, gy, payload, deps = {}) {
  if (gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH) return false;
  const z = sim.currentFloor || 0;
  let tile = findTileAt(sim, gx, gy, z);
  if (!tile) {
    tile = new Tile(gx, gy);
    tile.gz = z;
    sim.tiles.push(tile);
  }
  pushArenaUndo(sim);
  tile.gz = z;

  const classify = deps.classifyOfficialFilename || classifyOfficialFilename;

  if (payload.kind === 'official') {
    const file = payload.file;
    const entry = (sim.officialTileFiles || []).find(x => x.file === file);
    const type = (entry && entry.type) || classify(file);
    tile.type = type;
    tile.custom = null;
    tile._img = null;
    tile._imgSrc = null;
    tile._imgToken = null;
    tile.rotation = tile.rotation || 0;
    tile.mirrorH = false;
    tile.mirrorV = false;
    tile.opts = {
      ...(tile.opts || {}),
      officialImage: file,
      officialId: file.replace(/\.png$/i, ''),
      fromOfficialPalette: true
    };
    if (type === TileType.RESCUE_EXIT || type === 'rescue_exit') tile.markFinish = true;
    sim.selectedTool = 'official';
    sim.placingOfficialFile = file;
  } else if (payload.kind === 'custom') {
    if (!sim.customMode) {
      if (deps.logUI) {
        deps.logUI({ t: 0, msg: 'Modo oficial: personalizados bloqueados.', category: 'warning' });
      }
      return false;
    }
    const cid = payload.idx;
    if (cid == null || !sim.customLibrary[cid]) return false;
    tile.type = TileType.CUSTOM;
    tile.custom = JSON.parse(JSON.stringify(sim.customLibrary[cid]));
    tile.custom._instanceId = 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    tile._img = null;
    tile._imgSrc = null;
    tile._imgToken = null;
    tile.opts = tile.opts || {};
  } else if (payload.kind === 'builtin') {
    tile.type = payload.type;
    tile.custom = null;
    tile._img = null;
    tile._imgSrc = null;
    tile._imgToken = null;
    tile.opts = payload.type === TileType.INTERSECTION || payload.type === 'intersection'
      ? { hasGreen: true }
      : {};
  } else if (payload.kind === 'move') {
    return false;
  }

  sim.selectedTile = tile;
  const infoEl = document.getElementById('selectedInfo');
  if (infoEl) infoEl.textContent = `${tile.type} @${gx},${gy},z${z}`;

  if (deps.draw) deps.draw();
  if (deps.schedulePathfinding) deps.schedulePathfinding();
  if (deps.fillTilePropsPanel) deps.fillTilePropsPanel(tile);
  if (!sim.shiftDown && deps.clearTileSelection) deps.clearTileSelection();
  return true;
}

/**
 * Limpa o ladrilho em (gx, gy, gz) e remove objetos na mesma célula.
 * @param {object} sim
 * @param {number} gx
 * @param {number} gy
 * @param {number} [gz]
 * @param {object} deps - { draw, schedulePathfinding }
 */
export function clearTileAt(sim, gx, gy, gz, deps = {}) {
  const z = gz != null ? gz : (sim.currentFloor || 0);
  const tile = findTileAt(sim, gx, gy, z);
  if (!tile || tile.type === TileType.EMPTY) return;
  pushArenaUndo(sim);
  tile.type = TileType.EMPTY;
  tile.custom = null;
  tile._img = null;
  tile._imgSrc = null;
  tile._imgToken = null;
  tile.opts = {};
  tile.markStart = false;
  tile.markStart2 = false;
  tile.markFinish = false;
  tile.markCheckpoint = false;
  tile.rotation = 0;
  tile.mirrorH = false;
  tile.mirrorV = false;
  sim.objects = (sim.objects || []).filter(o => !(o.gx === gx && o.gy === gy && (o.gz || 0) === z));
  if (sim.selectedTile === tile) sim.selectedTile = null;
  if (deps.draw) deps.draw();
  if (deps.schedulePathfinding) deps.schedulePathfinding();
}

/**
 * Move conteúdo do ladrilho de `from` para (toGx, toGy), trocando com o destino.
 * Também move objetos da célula.
 * @param {object} sim
 * @param {{gx:number, gy:number, gz?:number}} from
 * @param {number} toGx
 * @param {number} toGy
 * @param {object} deps - { draw, schedulePathfinding }
 */
export function moveTile(sim, from, toGx, toGy, deps = {}) {
  if (from.gx === toGx && from.gy === toGy) return;
  const z = from.gz || 0;
  const src = findTileAt(sim, from.gx, from.gy, z);
  if (!src || src.type === TileType.EMPTY) return;
  pushArenaUndo(sim);
  let dst = findTileAt(sim, toGx, toGy, z);
  if (!dst) {
    dst = new Tile(toGx, toGy);
    dst.gz = z;
    sim.tiles.push(dst);
  }
  const fields = [
    'type', 'custom', 'rotation', 'mirrorH', 'mirrorV', 'opts',
    'markStart', 'markStart2', 'markFinish', 'markCheckpoint',
    '_img', '_imgSrc', '_imgToken'
  ];
  const tmp = {};
  for (const f of fields) tmp[f] = dst[f];
  for (const f of fields) dst[f] = src[f];
  for (const f of fields) {
    if (f === 'type') src[f] = TileType.EMPTY;
    else if (f === 'opts') src[f] = {};
    else if (f.startsWith('mark')) src[f] = false;
    else if (f === 'rotation') src[f] = 0;
    else src[f] = null;
  }
  src.mirrorH = false;
  src.mirrorV = false;

  (sim.objects || []).forEach(o => {
    if (o.gx === from.gx && o.gy === from.gy && (o.gz || 0) === z) {
      o.gx = toGx;
      o.gy = toGy;
    }
  });
  sim.selectedTile = dst;
  if (deps.draw) deps.draw();
  if (deps.schedulePathfinding) deps.schedulePathfinding();
}

/**
 * Rotaciona a seleção atual (tile ou objeto) em ±90°.
 * @param {object} sim
 * @param {number} [dir=1] - >0 horário, <0 anti-horário
 * @param {object} deps - { draw, schedulePathfinding }
 */
export function rotateSelected(sim, dir = 1, deps = {}) {
  const step = dir < 0 ? -90 : 90;
  const norm = (r) => ((Number(r) || 0) + step + 360) % 360;
  const infoEl = document.getElementById('selectedInfo');

  if (sim.selectedObject) {
    pushArenaUndo(sim);
    sim.selectedObject.rotation = norm(sim.selectedObject.rotation);
    if (infoEl) {
      infoEl.textContent = `obj ${sim.selectedObject.type} rot=${sim.selectedObject.rotation}°`;
    }
    if (deps.draw) deps.draw();
    if (deps.schedulePathfinding) deps.schedulePathfinding();
    return;
  }
  if (!sim.selectedTile) return;
  pushArenaUndo(sim);
  sim.selectedTile.rotation = norm(sim.selectedTile.rotation);
  if (infoEl) {
    infoEl.textContent = `${sim.selectedTile.type} rot=${sim.selectedTile.rotation}°`;
  }
  if (deps.draw) deps.draw();
  if (deps.schedulePathfinding) deps.schedulePathfinding();
}

/**
 * Espelha a seleção (H ou V). Bloqueado fora do Modo Custom.
 * @param {object} sim
 * @param {'h'|'v'} axis
 * @param {object} deps - { draw, logUI, updateMirrorUI }
 */
export function mirrorSelected(sim, axis, deps = {}) {
  if (!sim.customMode) {
    if (deps.logUI) {
      deps.logUI({
        t: 0,
        msg: 'Espelhamento bloqueado. Ative o Modo Custom em Backup & dados para usar.',
        category: 'warning'
      });
    }
    if (deps.updateMirrorUI) deps.updateMirrorUI();
    return;
  }
  if (sim.selectedObject) {
    pushArenaUndo(sim);
    if (axis === 'h') sim.selectedObject.mirrorH = !sim.selectedObject.mirrorH;
    else sim.selectedObject.mirrorV = !sim.selectedObject.mirrorV;
    if (deps.draw) deps.draw();
    return;
  }
  if (!sim.selectedTile) return;
  pushArenaUndo(sim);
  if (axis === 'h') sim.selectedTile.mirrorH = !sim.selectedTile.mirrorH;
  else sim.selectedTile.mirrorV = !sim.selectedTile.mirrorV;
  if (deps.draw) deps.draw();
}

/**
 * Limpa todos os ladrilhos e objetos da arena (com confirmação externa).
 * @param {object} sim
 * @param {object} deps - { draw }
 */
export function clearArena(sim, deps = {}) {
  pushArenaUndo(sim);
  sim.tiles.forEach(t => {
    t.type = TileType.EMPTY;
    t.custom = null;
    t._img = null;
    t._imgSrc = null;
    t._imgToken = null;
    t.opts = {};
    t.markStart = false;
    t.markStart2 = false;
    t.markFinish = false;
    t.markCheckpoint = false;
    t.rotation = 0;
    t.mirrorH = false;
    t.mirrorV = false;
  });
  sim.objects = [];
  sim.selectedTile = null;
  sim.selectedObject = null;
  if (deps.draw) deps.draw();
}
