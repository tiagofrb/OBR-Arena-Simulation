/**
 * Câmera 2D da arena: fit, zoom, pan, conversões de coordenadas.
 * Estado mutável passado por referência (cam object).
 */

import { TILE_PX } from '../core/constants.js';
import {
  CAMERA_FIT_PAD,
  CAMERA_MAX_FIT_SCALE,
  CAMERA_MIN_SCALE
} from '../core/constants.js';

/**
 * Calcula o tamanho do mundo em pixels (baseado na grade).
 * @param {object} sim
 * @returns {{w: number, h: number}}
 */
export function worldSize(sim) {
  return { w: sim.gridW * TILE_PX, h: sim.gridH * TILE_PX };
}

/**
 * Encaixa a câmera na viewport atual.
 * @param {object} cam
 * @param {HTMLCanvasElement} canvas
 * @param {object} sim
 * @param {function} [updateZoomUI]
 */
export function fitCamera(cam, canvas, sim, updateZoomUI) {
  const { w, h } = worldSize(sim);
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const pad = CAMERA_FIT_PAD;
  const sx = (cssW - pad * 2) / w;
  const sy = (cssH - pad * 2) / h;
  cam.scale = Math.min(sx, sy, CAMERA_MAX_FIT_SCALE);
  if (cam.scale < CAMERA_MIN_SCALE) cam.scale = CAMERA_MIN_SCALE;
  cam.ox = (cssW - w * cam.scale) / 2;
  cam.oy = (cssH - h * cam.scale) / 2;
  cam.userZoom = null;
  if (typeof updateZoomUI === 'function') updateZoomUI();
}

/**
 * Aplica zoom em torno do centro da viewport.
 * @param {object} cam
 * @param {HTMLCanvasElement} canvas
 * @param {number} factor - multiplicador (ex.: 1.1 ou 0.9)
 * @param {function} [updateZoomUI]
 */
export function setZoom(cam, canvas, factor, updateZoomUI) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const cx = cssW / 2;
  const cy = cssH / 2;
  // ponto do mundo sob o centro
  const wx = (cx - cam.ox) / cam.scale;
  const wy = (cy - cam.oy) / cam.scale;
  cam.scale = Math.max(0.12, Math.min(3.5, cam.scale * factor));
  cam.userZoom = cam.scale;
  cam.ox = cx - wx * cam.scale;
  cam.oy = cy - wy * cam.scale;
  if (typeof updateZoomUI === 'function') updateZoomUI();
}

/**
 * Converte coordenadas de tela (client) para mundo.
 * @param {object} cam
 * @param {HTMLCanvasElement} canvas
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{x: number, y: number}}
 */
export function screenToWorld(cam, canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - cam.ox) / cam.scale,
    y: (sy - cam.oy) / cam.scale
  };
}

/**
 * Converte coordenadas de mundo para índice de grade.
 * @param {number} wx
 * @param {number} wy
 * @returns {{gx: number, gy: number}}
 */
export function worldToGrid(wx, wy) {
  return {
    gx: Math.floor(wx / TILE_PX),
    gy: Math.floor(wy / TILE_PX)
  };
}

/**
 * Atualiza o texto de zoom na UI.
 * @param {object} cam
 */
export function updateZoomUI(cam) {
  const el = document.getElementById('zoomLabel');
  if (el) el.textContent = Math.round(cam.scale * 100) + '%';
}
