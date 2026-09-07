/**
 * Gerenciamento da grade da arena: redimensionamento preservando conteúdo,
 * status e helpers de consulta.
 */

import { Tile, TileType } from '../engine/Models.js';
import { DEFAULT_GRID_W, DEFAULT_GRID_H } from '../core/constants.js';

/**
 * Garante que sim.tiles contenha uma matriz completa gridW × gridH
 * (células EMPTY onde não houver ladrilho).
 * @param {object} sim
 */
export function ensureGridMatrix(sim) {
  const w = sim.gridW || DEFAULT_GRID_W;
  const h = sim.gridH || DEFAULT_GRID_H;
  const existing = new Set(sim.tiles.map(t => `${t.gx},${t.gy},${t.gz || 0}`));
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const key = `${gx},${gy},0`;
      if (!existing.has(key)) {
        sim.tiles.push(new Tile(gx, gy, TileType.EMPTY));
      }
    }
  }
  // Remove tiles fora da grade atual (apenas floor 0 por enquanto)
  sim.tiles = sim.tiles.filter(t => {
    const gz = t.gz || 0;
    if (gz !== 0) return true; // multi-floor: preservar por enquanto
    return t.gx >= 0 && t.gx < w && t.gy >= 0 && t.gy < h;
  });
}

/**
 * Redimensiona a grade preservando ladrilhos existentes dentro dos novos limites.
 * @param {object} sim
 * @param {number} nw
 * @param {number} nh
 * @param {function} [onAfter] - callback após resize (ex.: fitCamera + draw)
 */
export function resizeGrid(sim, nw, nh, onAfter) {
  nw = Math.max(1, Math.min(50, Number(nw) || DEFAULT_GRID_W));
  nh = Math.max(1, Math.min(50, Number(nh) || DEFAULT_GRID_H));
  if (nw === sim.gridW && nh === sim.gridH) return;

  sim.gridW = nw;
  sim.gridH = nh;
  ensureGridMatrix(sim);

  // Remove objetos fora da grade
  sim.objects = (sim.objects || []).filter(o =>
    o.gx >= 0 && o.gx < nw && o.gy >= 0 && o.gy < nh
  );

  if (typeof onAfter === 'function') onAfter();
}

/**
 * Atualiza o texto de status da grade na UI (se os elementos existirem).
 * @param {object} sim
 */
export function updateGridStatus(sim) {
  const el = document.getElementById('gridStatus');
  if (el) {
    const filled = sim.tiles.filter(t => t.type !== TileType.EMPTY).length;
    el.textContent = `${sim.gridW}×${sim.gridH} · ${filled} ladrilhos`;
  }
}

/**
 * Localiza um tile na posição (gx, gy, gz).
 * @param {object} sim
 * @param {number} gx
 * @param {number} gy
 * @param {number} [gz=0]
 * @returns {import('../engine/Models.js').Tile|null}
 */
export function findTile(sim, gx, gy, gz = 0) {
  return sim.tiles.find(t => t.gx === gx && t.gy === gy && (t.gz || 0) === gz) || null;
}
