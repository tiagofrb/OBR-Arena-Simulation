/**
 * Painel de propriedades do ladrilho e menu de contexto.
 */

import { TileType } from '../engine/Models.js';
import { pushArenaUndo } from './ArenaHistory.js';

/** @type {import('../engine/Models.js').Tile|null} */
let _ctxTile = null;

export function getContextTile() {
  return _ctxTile;
}

export function hideTileContextMenu() {
  const m = document.getElementById('tileContextMenu');
  if (m) m.classList.add('hidden');
  _ctxTile = null;
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {import('../engine/Models.js').Tile} tile
 */
export function showTileContextMenu(clientX, clientY, tile) {
  const menu = document.getElementById('tileContextMenu');
  if (!menu) return;
  _ctxTile = tile;
  menu.classList.remove('hidden');
  const pad = 8;
  let x = clientX;
  let y = clientY;
  menu.style.left = '0px';
  menu.style.top = '0px';
  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect();
    if (x + r.width > window.innerWidth - pad) x = window.innerWidth - r.width - pad;
    if (y + r.height > window.innerHeight - pad) y = window.innerHeight - r.height - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  });
}

/**
 * Preenche o painel lateral de propriedades.
 * @param {object} sim
 * @param {import('../engine/Models.js').Tile|null} tile
 * @param {object} deps - { updateCheckpointAvailability }
 */
export function fillTilePropsPanel(sim, tile, deps = {}) {
  const body = document.getElementById('tilePropBody');
  const pos = document.getElementById('tilePropPos');
  if (!body || !pos) return;
  if (!tile || tile.type === TileType.EMPTY) {
    pos.textContent = 'Nenhum ladrilho selecionado. Clique direito → Propriedades.';
    body.classList.remove('is-active');
    body.style.opacity = '0.5';
    body.style.pointerEvents = 'none';
    return;
  }
  sim.selectedTile = tile;
  body.classList.add('is-active');
  body.style.opacity = '1';
  body.style.pointerEvents = 'auto';
  pos.textContent = `x=${tile.gx}, y=${tile.gy}, z=${tile.gz || 0} · ${tile.type}` +
    (tile.opts && tile.opts.officialImage ? ` · ${tile.opts.officialImage}` : '') +
    ` · rot ${tile.rotation || 0}°`;

  const opts = tile.opts || {};
  const bumpEl = document.getElementById('propBumpVal');
  const obstEl = document.getElementById('propObstVal');
  if (bumpEl) bumpEl.textContent = String(opts.speedbumps || 0);
  if (obstEl) obstEl.textContent = String(opts.obstacles || 0);
  const ramp = document.getElementById('propRamp');
  if (ramp) ramp.checked = !!opts.rampPoints;
  const cp = document.getElementById('propCheckpoint');
  if (cp) cp.checked = !!tile.markCheckpoint;
  const st = document.getElementById('propStart');
  if (st) st.checked = !!tile.markStart;
  const st2 = document.getElementById('propStart2');
  if (st2) st2.checked = !!tile.markStart2;

  const setRadio = (name, val) => {
    document.querySelectorAll('input[name="' + name + '"]').forEach(n => {
      n.checked = (val && n.value === val) || (!val && n.value === '');
    });
  };
  setRadio('levelDown', opts.levelDown || '');
  setRadio('levelUp', opts.levelUp || '');
  if (deps.updateCheckpointAvailability) deps.updateCheckpointAvailability();
  else updateCheckpointAvailability(sim);
}

/**
 * Desabilita checkpoint quando há obstáculos/gaps/etc. no tile.
 * @param {object} sim
 */
export function updateCheckpointAvailability(sim) {
  const wrap = document.getElementById('propCheckpointWrap');
  const cp = document.getElementById('propCheckpoint');
  if (!wrap || !cp) return;
  const tile = sim.selectedTile;
  if (!tile) {
    cp.disabled = true;
    wrap.style.opacity = '0.45';
    return;
  }
  const opts = tile.opts || {};
  const bump = parseInt(document.getElementById('propBumpVal')?.textContent || '0', 10) || 0;
  const obst = parseInt(document.getElementById('propObstVal')?.textContent || '0', 10) || 0;
  const ramp = document.getElementById('propRamp')?.checked;
  const gaps = opts.officialGaps || 0;
  const seesaw = opts.officialSeesaw || 0;
  const inter = opts.officialIntersections || 0;
  const blocked = bump > 0 || obst > 0 || ramp || gaps > 0 || seesaw > 0 || inter > 0 ||
    tile.type === 'gap' || tile.type === 'gangorra' ||
    tile.type === 'intersection' || tile.type === 'intersection_t';
  cp.disabled = blocked;
  wrap.style.opacity = blocked ? '0.45' : '1';
  if (blocked) cp.checked = false;
}

/**
 * Aplica valores do painel ao tile selecionado.
 * @param {object} sim
 * @param {object} deps - { draw, schedulePathfinding, logUI, syncMapMetaFromUI, fillTilePropsPanel }
 */
export function applyTilePropsFromPanel(sim, deps = {}) {
  const tile = sim.selectedTile;
  if (!tile || tile.type === TileType.EMPTY) return;
  pushArenaUndo(sim);
  if (!tile.opts) tile.opts = {};
  const bump = parseInt(document.getElementById('propBumpVal')?.textContent || '0', 10) || 0;
  const obst = parseInt(document.getElementById('propObstVal')?.textContent || '0', 10) || 0;
  tile.opts.speedbumps = bump;
  tile.opts.obstacles = obst;
  tile.opts.rampPoints = !!document.getElementById('propRamp')?.checked;
  const ld = document.querySelector('input[name="levelDown"]:checked');
  const lu = document.querySelector('input[name="levelUp"]:checked');
  tile.opts.levelDown = ld && ld.value ? ld.value : undefined;
  tile.opts.levelUp = lu && lu.value ? lu.value : undefined;

  const wantStart = document.getElementById('propStart')?.checked;
  if (wantStart) {
    (sim.tiles || []).forEach(tt => { if (tt !== tile) tt.markStart = false; });
    tile.markStart = true;
  } else {
    tile.markStart = false;
  }
  tile.markStart2 = !!document.getElementById('propStart2')?.checked;
  const cpEl = document.getElementById('propCheckpoint');
  tile.markCheckpoint = !!(cpEl && !cpEl.disabled && cpEl.checked);

  const z = tile.gz || 0;
  sim.objects = (sim.objects || []).filter(o =>
    !(o.gx === tile.gx && o.gy === tile.gy && (o.gz || 0) === z &&
      (o.type === 'obstacle' || o.type === 'lombada')));
  for (let i = 0; i < obst; i++) {
    sim.objects.push({ gx: tile.gx, gy: tile.gy, gz: z, type: 'obstacle', rotation: 0, points: 20 });
  }
  for (let i = 0; i < bump; i++) {
    sim.objects.push({ gx: tile.gx, gy: tile.gy, gz: z, type: 'lombada', rotation: 0, points: 10 });
  }
  if (deps.syncMapMetaFromUI) deps.syncMapMetaFromUI();
  if (deps.fillTilePropsPanel) deps.fillTilePropsPanel(tile);
  else fillTilePropsPanel(sim, tile, { updateCheckpointAvailability: () => updateCheckpointAvailability(sim) });
  if (deps.draw) deps.draw();
  if (deps.schedulePathfinding) deps.schedulePathfinding();
  if (deps.logUI) {
    deps.logUI({ t: 0, msg: `Propriedades aplicadas @${tile.gx},${tile.gy},z${z}`, category: 'info' });
  }
}
