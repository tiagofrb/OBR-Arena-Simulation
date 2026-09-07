/**
 * Motor de pintura compartilhado dos construtores (tile 3×3 e objeto 300×300).
 * Buffer offscreen, undo/redo, stamp, stroke e pick — sem DOM de UI.
 */

import { CTOR_HISTORY_MAX } from '../../core/constants.js';

/** Fundo branco opaco (padrão dos construtores). */
export function whiteBg() {
  return [255, 255, 255, 255];
}

/**
 * Cria canvas offscreen e estado de histórico no objeto `state`.
 * @param {object} state — ctor / objCtor
 * @param {number} sizeMm — largura=altura do buffer
 * @param {string} [fill='#ffffff']
 */
export function initPaintBuffer(state, sizeMm, fill = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = sizeMm;
  c.height = sizeMm;
  state.buf = c;
  state.bufCtx = c.getContext('2d');
  clearPaintBuffer(state, sizeMm, fill);
}

/**
 * @param {object} state
 * @param {number} sizeMm
 * @param {string} [fill='#ffffff']
 */
export function clearPaintBuffer(state, sizeMm, fill = '#ffffff') {
  if (!state.bufCtx) return;
  state.bufCtx.fillStyle = fill;
  state.bufCtx.fillRect(0, 0, sizeMm, sizeMm);
  state.undoStack = [];
  state.redoStack = [];
}

/**
 * @param {object} state
 * @param {number} sizeMm
 * @param {number} [maxHistory=CTOR_HISTORY_MAX]
 */
export function pushPaintUndo(state, sizeMm, maxHistory = CTOR_HISTORY_MAX) {
  if (!state.bufCtx) return;
  try {
    const snap = state.bufCtx.getImageData(0, 0, sizeMm, sizeMm);
    state.undoStack.push(snap);
    const max = state.maxHistory || maxHistory;
    if (state.undoStack.length > max) state.undoStack.shift();
    state.redoStack = [];
  } catch (e) { /* ignore */ }
}

/**
 * @param {object} state
 * @param {number} sizeMm
 * @param {() => void} [onChange] — redraw
 */
export function undoPaint(state, sizeMm, onChange) {
  if (!state.undoStack.length || !state.bufCtx) return;
  try {
    const cur = state.bufCtx.getImageData(0, 0, sizeMm, sizeMm);
    state.redoStack.push(cur);
    state.bufCtx.putImageData(state.undoStack.pop(), 0, 0);
    if (onChange) onChange();
  } catch (e) { /* ignore */ }
}

/**
 * @param {object} state
 * @param {number} sizeMm
 * @param {() => void} [onChange]
 */
export function redoPaint(state, sizeMm, onChange) {
  if (!state.redoStack.length || !state.bufCtx) return;
  try {
    const cur = state.bufCtx.getImageData(0, 0, sizeMm, sizeMm);
    state.undoStack.push(cur);
    state.bufCtx.putImageData(state.redoStack.pop(), 0, 0);
    if (onChange) onChange();
  } catch (e) { /* ignore */ }
}

/**
 * Carimbo circular ou quadrado; em erase restaura via bgFn.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {'round'|'square'} shape
 * @param {string} color
 * @param {boolean} erase
 * @param {number} maxW
 * @param {number} maxH
 * @param {(px:number,py:number)=>number[]} [bgFn]
 */
export function stampAt(ctx, x, y, width, shape, color, erase, maxW, maxH, bgFn) {
  const s = Math.max(1, width | 0);
  const r = Math.max(0.5, s / 2);
  if (erase && bgFn) {
    const pad = r + 1;
    const xA = Math.max(0, Math.floor(x - pad));
    const yA = Math.max(0, Math.floor(y - pad));
    const xB = Math.min(maxW - 1, Math.ceil(x + pad));
    const yB = Math.min(maxH - 1, Math.ceil(y + pad));
    const w = xB - xA + 1,
      h = yB - yA + 1;
    if (w <= 0 || h <= 0) return;
    const img = ctx.getImageData(xA, yA, w, h);
    const d = img.data;
    for (let py = yA; py <= yB; py++) {
      for (let px = xA; px <= xB; px++) {
        let inside = false;
        if (shape === 'square') {
          inside =
            px >= x - s / 2 && px < x + s / 2 && py >= y - s / 2 && py < y + s / 2;
        } else {
          const ddx = px + 0.5 - x,
            ddy = py + 0.5 - y;
          inside = ddx * ddx + ddy * ddy <= r * r;
        }
        if (!inside) continue;
        const bg = bgFn(px, py);
        const ii = ((py - yA) * w + (px - xA)) * 4;
        d[ii] = bg[0];
        d[ii + 1] = bg[1];
        d[ii + 2] = bg[2];
        d[ii + 3] = bg[3];
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

/**
 * Linha contínua por carimbos.
 */
export function strokeLineOnBuf(
  ctx,
  x0,
  y0,
  x1,
  y1,
  color,
  width,
  shape,
  erase,
  maxW,
  maxH,
  bgFn
) {
  const dx = x1 - x0,
    dy = y1 - y0;
  const dist = Math.hypot(dx, dy) || 1;
  const step = Math.max(0.5, width * 0.35);
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stampAt(ctx, x0 + dx * t, y0 + dy * t, width, shape, color, erase, maxW, maxH, bgFn);
  }
}

/**
 * Pinta/apaga no buffer conforme estado do construtor (tool, brush, shape, color).
 * @param {object} state
 * @param {number} x
 * @param {number} y
 * @param {number} sizeMm
 * @param {(px:number,py:number)=>number[]} [bgFn]
 */
export function paintAt(state, x, y, sizeMm, bgFn = whiteBg) {
  if (!state.bufCtx) return;
  const ctx = state.bufCtx;
  const s = Math.max(1, state.brush | 0);
  const r = Math.max(0.5, s / 2);
  const erase = state.tool === 'erase';
  if (erase) {
    stampAt(ctx, x, y, s, state.shape, state.color, true, sizeMm, sizeMm, bgFn);
    return;
  }
  stampAt(ctx, x, y, s, state.shape, state.color, false, sizeMm, sizeMm, bgFn);
}

/**
 * Lê cor no buffer; retorna { hex, nearWhite }.
 * @param {CanvasRenderingContext2D} bufCtx
 * @param {number} x
 * @param {number} y
 */
export function pickColorAt(bufCtx, x, y) {
  const d = bufCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  const hex =
    '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  const nearWhite = d[0] > 240 && d[1] > 240 && d[2] > 240;
  return { hex, nearWhite, r: d[0], g: d[1], b: d[2] };
}
