/**
 * Drag-and-drop de ladrilhos (paleta ↔ grade): estado, preview e wiring de eventos.
 */

import { TileType } from '../engine/Models.js';

/** @type {{ gx: number, gy: number, gz?: number }|null} */
let dragMoveFrom = null;
/** @type {object|null} */
let dragPayload = null;

export function getDragMoveFrom() {
  return dragMoveFrom;
}
export function setDragMoveFrom(v) {
  dragMoveFrom = v;
}
export function getDragPayload() {
  return dragPayload;
}
export function setDragPayload(v) {
  dragPayload = v;
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {object} payload
 * @param {boolean} invalid
 * @param {object} deps - { paintDragPreview }
 */
export function showTileDragPreview(clientX, clientY, payload, invalid, deps = {}) {
  const el = document.getElementById('tileDragPreview');
  const cnv = document.getElementById('tileDragPreviewCanvas');
  if (!el || !cnv) return;
  el.classList.remove('hidden');
  el.classList.toggle('is-invalid', !!invalid);
  el.style.left = clientX + 'px';
  el.style.top = clientY + 'px';
  if (deps.paintDragPreview) deps.paintDragPreview(cnv, payload);
  else paintDragPreview(cnv, payload, deps);
}

export function hideTileDragPreview() {
  const el = document.getElementById('tileDragPreview');
  if (el) el.classList.add('hidden');
  dragPayload = null;
}

/**
 * @param {HTMLCanvasElement} cnv
 * @param {object} payload
 * @param {object} deps - { getCachedOfficialImage, renderTilePreviewToCanvas, customLibrary }
 */
export function paintDragPreview(cnv, payload, deps = {}) {
  if (!payload || !cnv) return;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, cnv.width, cnv.height);
  ctx.fillStyle = '#1a2332';
  ctx.fillRect(0, 0, cnv.width, cnv.height);

  const getImg = deps.getCachedOfficialImage;
  const renderPrev = deps.renderTilePreviewToCanvas;
  const library = deps.customLibrary || [];

  if (payload.kind === 'official' && payload.file && getImg) {
    const img = getImg(payload.file);
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, 2, 2, cnv.width - 4, cnv.height - 4);
    } else if (img) {
      img.onload = () => {
        ctx.clearRect(0, 0, cnv.width, cnv.height);
        ctx.fillStyle = '#1a2332';
        ctx.fillRect(0, 0, cnv.width, cnv.height);
        ctx.drawImage(img, 2, 2, cnv.width - 4, cnv.height - 4);
      };
    }
    return;
  }
  if (payload.kind === 'custom' && payload.idx != null && library[payload.idx] && renderPrev) {
    renderPrev(cnv, 'custom', library[payload.idx]);
    return;
  }
  if (payload.kind === 'builtin' && payload.type && renderPrev) {
    renderPrev(cnv, payload.type, null);
    return;
  }
  if (payload.kind === 'move' && payload.tile) {
    const t = payload.tile;
    if (t.opts && t.opts.officialImage && getImg) {
      const img = getImg(t.opts.officialImage);
      if (img && img.complete) ctx.drawImage(img, 2, 2, cnv.width - 4, cnv.height - 4);
      else if (img) img.onload = () => ctx.drawImage(img, 2, 2, cnv.width - 4, cnv.height - 4);
    } else if (t.type === TileType.CUSTOM && t.custom && renderPrev) {
      renderPrev(cnv, 'custom', t.custom);
    } else if (renderPrev) {
      renderPrev(cnv, t.type, null);
    }
  }
}


/**
 * Liga drag-and-drop paleta ↔ grade e move por pointer no canvas da arena.
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {object} opts.sim
 * @param {object} opts.deps — screenToWorld, worldToGrid, placeTileAt, clearTileAt, moveTile, logUI, show/hide preview
 */
export function wireArenaDragDrop({ canvas, sim, deps }) {
  const wrap = document.getElementById('canvasWrap');
  if (!wrap || !canvas) return;

  canvas.addEventListener('dragover', (e) => {
    if (sim.mode !== 'editor') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = getDragMoveFrom() ? 'move' : 'copy';
    wrap.classList.add('drag-over');
    const w = deps.screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = deps.worldToGrid(w.x, w.y);
    const invalid = gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH;
    if (getDragPayload() || getDragMoveFrom()) {
      const _dmf = getDragMoveFrom();
      const payload =
        getDragPayload() ||
        (_dmf
          ? {
              kind: 'move',
              tile: sim.tiles.find(t => t.gx === _dmf.gx && t.gy === _dmf.gy)
            }
          : null);
      if (payload) deps.showTileDragPreview(e.clientX, e.clientY, payload, invalid);
    }
  });
  canvas.addEventListener('dragleave', () => {
    wrap.classList.remove('drag-over');
  });
  document.addEventListener('dragover', (e) => {
    if (!getDragPayload() && !getDragMoveFrom()) return;
    const _dmf = getDragMoveFrom();
    const payload =
      getDragPayload() ||
      (_dmf
        ? {
            kind: 'move',
            tile: sim.tiles.find(t => t.gx === _dmf.gx && t.gy === _dmf.gy)
          }
        : null);
    if (payload) deps.showTileDragPreview(e.clientX, e.clientY, payload, false);
  });
  document.addEventListener('dragend', () => {
    deps.hideTileDragPreview();
    setDragMoveFrom(null);
  });
  canvas.addEventListener('drop', (e) => {
    if (sim.mode !== 'editor') return;
    e.preventDefault();
    wrap.classList.remove('drag-over');
    deps.hideTileDragPreview();
    const w = deps.screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = deps.worldToGrid(w.x, w.y);

    if (getDragMoveFrom()) {
      const from = getDragMoveFrom();
      setDragMoveFrom(null);
      if (gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH) {
        deps.clearTileAt(from.gx, from.gy, from.gz);
        deps.logUI({
          t: 0,
          msg: `Ladrilho removido @${from.gx},${from.gy}`,
          category: 'info'
        });
        return;
      }
      deps.moveTile(from, gx, gy);
      return;
    }

    let raw = e.dataTransfer.getData('application/x-obr-tile');
    if (!raw) raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      deps.placeTileAt(gx, gy, payload);
    } catch (err) {
      console.warn('drop parse', err);
    }
  });

  let moveDrag = null;
  canvas.addEventListener('mousedown', (e) => {
    if (sim.mode !== 'editor' || e.button !== 0) return;
    if (sim.selectedTool || sim.objectTool || sim.markerTool || sim.measureMode) return;
    const w = deps.screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = deps.worldToGrid(w.x, w.y);
    const z = sim.currentFloor || 0;
    const tile = sim.tiles.find(
      t => t.gx === gx && t.gy === gy && (t.gz || 0) === z && t.type !== TileType.EMPTY
    );
    if (!tile) return;
    moveDrag = { gx, gy, gz: z, startX: e.clientX, startY: e.clientY, active: false };
  });
  window.addEventListener('mousemove', (e) => {
    if (!moveDrag) return;
    const dist = Math.hypot(e.clientX - moveDrag.startX, e.clientY - moveDrag.startY);
    if (!moveDrag.active && dist > 8) {
      moveDrag.active = true;
      setDragMoveFrom({ gx: moveDrag.gx, gy: moveDrag.gy, gz: moveDrag.gz });
      const tile = sim.tiles.find(
        t =>
          t.gx === moveDrag.gx &&
          t.gy === moveDrag.gy &&
          (t.gz || 0) === (moveDrag.gz || 0)
      );
      setDragPayload({ kind: 'move', tile });
      canvas.style.cursor = 'grabbing';
    }
    if (moveDrag.active) {
      const tile = sim.tiles.find(
        t =>
          t.gx === moveDrag.gx &&
          t.gy === moveDrag.gy &&
          (t.gz || 0) === (moveDrag.gz || 0)
      );
      const w = deps.screenToWorld(e.clientX, e.clientY);
      const { gx, gy } = deps.worldToGrid(w.x, w.y);
      const invalid = gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH;
      deps.showTileDragPreview(e.clientX, e.clientY, { kind: 'move', tile }, invalid);
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (!moveDrag) return;
    const was = moveDrag;
    moveDrag = null;
    canvas.style.cursor = '';
    deps.hideTileDragPreview();
    if (!was.active) {
      setDragMoveFrom(null);
      return;
    }
    const w = deps.screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = deps.worldToGrid(w.x, w.y);
    const from = { gx: was.gx, gy: was.gy, gz: was.gz };
    setDragMoveFrom(null);
    const rect = canvas.getBoundingClientRect();
    const outside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (outside || gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH) {
      deps.clearTileAt(from.gx, from.gy, from.gz);
      deps.logUI({
        t: 0,
        msg: `Ladrilho removido @${from.gx},${from.gy}`,
        category: 'info'
      });
      return;
    }
    deps.moveTile(from, gx, gy);
  });

  const paletteTargets = ['officialTileTools', 'tileTools'];
  paletteTargets.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      if (getDragMoveFrom()) {
        const _df = getDragMoveFrom();
        deps.clearTileAt(_df.gx, _df.gy, _df.gz);
        setDragMoveFrom(null);
      }
    });
  });
}
