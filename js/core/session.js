/**
 * Estado de sessão da aplicação (objeto `sim` + câmera).
 * Fase 7 da modularização — sem store/Redux; um factory + o mesmo objeto mutável.
 */
import {
  DEFAULT_GRID_W,
  DEFAULT_GRID_H,
  ARENA_HISTORY_MAX
} from './constants.js';
import { ScoreEngine } from '../engine/ScoreEngine.js';

/**
 * Câmera 2D da arena (pan/zoom).
 * @returns {{ scale: number, ox: number, oy: number, userZoom: number|null, panning: boolean, lastX: number, lastY: number }}
 */
export function createCameraState() {
  return {
    scale: 1,
    ox: 0,
    oy: 0,
    userZoom: null,
    panning: false,
    lastX: 0,
    lastY: 0
  };
}

/**
 * Estado global da sessão (editor + simulação + bibliotecas).
 * Módulos recebem este objeto por parâmetro; não há store reativo.
 * @returns {object}
 */
export function createSessionState() {
  return {
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
    objects: [], // { gx, gy, type, rotation, mirrorH, mirrorV, custom, points }
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
    officialMeta: null // metadados do último import oficial
  };
}
