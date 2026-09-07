/**
 * Preview visual de drag-and-drop de ladrilhos (paleta ↔ grade).
 * O wiring de eventos permanece em main.js; aqui ficam estado e pintura.
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
