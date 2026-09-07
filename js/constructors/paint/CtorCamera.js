/**
 * Câmera 2D dos canvases de construtor (fit / zoom / pan / screen→world).
 * Estado em `state`: scale, ox, oy, panning, lastX, lastY.
 */

/**
 * Redimensiona o canvas CSS/DPR e encaixa o mundo sizeMm na área.
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state
 * @param {number} sizeMm
 * @param {object} [opts]
 * @param {number} [opts.pad=20]
 * @param {number} [opts.maxFit=2]
 */
export function fitCtorCamera(canvas, ctx, state, sizeMm, opts = {}) {
  const wrap = document.getElementById('canvasWrap');
  if (!wrap || !canvas || !ctx) return;
  const r = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(200, r.width - 16);
  const cssH = Math.max(200, r.height - 16);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pad = opts.pad != null ? opts.pad : 20;
  const maxFit = opts.maxFit != null ? opts.maxFit : 2;
  const sx = (cssW - pad * 2) / sizeMm;
  const sy = (cssH - pad * 2) / sizeMm;
  state.scale = Math.min(sx, sy, maxFit);
  if (state.scale < 0.1) state.scale = 0.1;
  state.ox = (cssW - sizeMm * state.scale) / 2;
  state.oy = (cssH - sizeMm * state.scale) / 2;
}

/**
 * Zoom centrado na viewport.
 * @param {HTMLCanvasElement} canvas
 * @param {object} state
 * @param {number} factor
 * @param {object} [opts]
 * @param {number} [opts.min=0.08]
 * @param {number} [opts.max=4]
 */
export function setCtorZoom(canvas, state, factor, opts = {}) {
  if (!canvas) return;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const cx = cssW / 2,
    cy = cssH / 2;
  const wx = (cx - state.ox) / state.scale;
  const wy = (cy - state.oy) / state.scale;
  const min = opts.min != null ? opts.min : 0.08;
  const max = opts.max != null ? opts.max : 4;
  state.scale = Math.max(min, Math.min(max, state.scale * factor));
  state.ox = cx - wx * state.scale;
  state.oy = cy - wy * state.scale;
}

/**
 * Screen (client) → coordenadas do buffer (mm), com grid lock.
 * @param {HTMLCanvasElement} canvas
 * @param {object} state
 * @param {MouseEvent|{clientX:number,clientY:number}} e
 * @param {number} sizeMm
 */
export function screenToCtorWorld(canvas, state, e, sizeMm) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  let x = (sx - state.ox) / state.scale;
  let y = (sy - state.oy) / state.scale;
  const step = Math.max(1, state.gridLock | 0);
  x = Math.round(x / step) * step;
  y = Math.round(y / step) * step;
  x = Math.max(0, Math.min(sizeMm - 1, x));
  y = Math.max(0, Math.min(sizeMm - 1, y));
  return { x, y };
}

/**
 * Aplica delta de pan a partir de movimento do mouse.
 * @param {object} state
 * @param {number} clientX
 * @param {number} clientY
 */
export function panCtorCamera(state, clientX, clientY) {
  state.ox += clientX - state.lastX;
  state.oy += clientY - state.lastY;
  state.lastX = clientX;
  state.lastY = clientY;
}

/**
 * Inicia pan (botão do meio + shift).
 * @param {object} state
 * @param {MouseEvent} e
 * @param {HTMLCanvasElement} canvas
 */
export function beginCtorPan(state, e, canvas) {
  state.panning = true;
  state.lastX = e.clientX;
  state.lastY = e.clientY;
  if (canvas) canvas.style.cursor = 'grabbing';
}

/**
 * Encerra pan.
 * @param {object} state
 * @param {HTMLCanvasElement} [canvas]
 */
export function endCtorPan(state, canvas) {
  if (!state.panning) return;
  state.panning = false;
  if (canvas) canvas.style.cursor = '';
}
