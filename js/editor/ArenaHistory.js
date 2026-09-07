/**
 * Histórico de undo/redo do editor de arena.
 * Mantém snapshots serializáveis de tiles + objects + dimensões da grade.
 */

import { Tile, TileType } from '../engine/Models.js';
import { ARENA_HISTORY_MAX } from '../core/constants.js';

/**
 * @typedef {Object} ArenaSnapshot
 * @property {object[]} tiles - array de Tile.toJSON()
 * @property {object[]} objects
 * @property {number} gridW
 * @property {number} gridH
 */

/**
 * Cria um snapshot do estado atual da arena.
 * @param {object} sim - estado global da simulação/editor
 * @returns {ArenaSnapshot}
 */
export function snapshotArena(sim) {
  return {
    tiles: sim.tiles.map(t => t.toJSON()),
    objects: JSON.parse(JSON.stringify(sim.objects.map(o => {
      const c = { ...o };
      delete c._img;
      delete c._imgSrc;
      return c;
    }))),
    gridW: sim.gridW,
    gridH: sim.gridH
  };
}

/**
 * Aplica um snapshot ao estado da arena.
 * Preenche células vazias para manter a matriz completa.
 * @param {object} sim
 * @param {ArenaSnapshot} snap
 * @param {function} [onGridUI] - callback opcional para atualizar inputs de grade na UI
 */
export function applyArenaSnapshot(sim, snap, onGridUI) {
  if (!snap) return;
  sim.gridW = snap.gridW;
  sim.gridH = snap.gridH;
  if (typeof onGridUI === 'function') onGridUI(sim.gridW, sim.gridH);

  sim.tiles = (snap.tiles || []).map(o => Tile.fromJSON(o));
  // Garante matriz completa no floor 0 (células EMPTY onde faltar)
  const have = new Set(sim.tiles.map(t => `${t.gx},${t.gy},${t.gz || 0}`));
  for (let gy = 0; gy < sim.gridH; gy++) {
    for (let gx = 0; gx < sim.gridW; gx++) {
      const key = `${gx},${gy},0`;
      if (!have.has(key)) {
        sim.tiles.push(new Tile(gx, gy, TileType.EMPTY));
      }
    }
  }
  sim.objects = JSON.parse(JSON.stringify(snap.objects || []));
  sim.selectedTile = null;
  sim.selectedObject = null;
}

/**
 * Empilha o estado atual no histórico de undo e limpa o redo.
 * @param {object} sim
 */
export function pushArenaUndo(sim) {
  try {
    if (!sim.arenaUndo) sim.arenaUndo = [];
    if (!sim.arenaRedo) sim.arenaRedo = [];
    sim.arenaUndo.push(snapshotArena(sim));
    const max = sim.arenaHistoryMax ?? ARENA_HISTORY_MAX;
    if (sim.arenaUndo.length > max) sim.arenaUndo.shift();
    sim.arenaRedo = [];
  } catch (e) {
    console.warn('pushArenaUndo failed', e);
  }
}

/**
 * Desfaz a última alteração da arena.
 * @param {object} sim
 * @param {object} deps - { fitCamera, draw, logUI, onGridUI }
 * @returns {boolean} true se houve undo
 */
export function undoArena(sim, deps = {}) {
  if (!sim.arenaUndo || !sim.arenaUndo.length) return false;
  try {
    if (!sim.arenaRedo) sim.arenaRedo = [];
    sim.arenaRedo.push(snapshotArena(sim));
    applyArenaSnapshot(sim, sim.arenaUndo.pop(), deps.onGridUI);
    if (deps.fitCamera) deps.fitCamera();
    if (deps.draw) deps.draw();
    if (deps.logUI) deps.logUI({ t: 0, msg: 'Desfazer (editor)', category: 'info' });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/**
 * Refaz a última alteração desfeita.
 * @param {object} sim
 * @param {object} deps - { fitCamera, draw, logUI, onGridUI }
 * @returns {boolean}
 */
export function redoArena(sim, deps = {}) {
  if (!sim.arenaRedo || !sim.arenaRedo.length) return false;
  try {
    if (!sim.arenaUndo) sim.arenaUndo = [];
    sim.arenaUndo.push(snapshotArena(sim));
    applyArenaSnapshot(sim, sim.arenaRedo.pop(), deps.onGridUI);
    if (deps.fitCamera) deps.fitCamera();
    if (deps.draw) deps.draw();
    if (deps.logUI) deps.logUI({ t: 0, msg: 'Refazer (editor)', category: 'info' });
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}
