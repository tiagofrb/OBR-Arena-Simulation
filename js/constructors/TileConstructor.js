/**
 * Construtor de ladrilho pixel (canvas 3×3, centro 300×300 mm).
 * Usa PaintBuffer + CtorCamera; UI de desenho e biblioteca custom.
 */
import {
  CTOR_SIZE_MM,
  CTOR_GRID_CELLS,
  CTOR_TILE_CANVAS_MM,
  CTOR_HISTORY_MAX
} from '../core/constants.js';
import {
  initPaintBuffer,
  clearPaintBuffer,
  pushPaintUndo,
  undoPaint,
  redoPaint,
  strokeLineOnBuf,
  paintAt as paintAtShared,
  pickColorAt,
  whiteBg
} from './paint/PaintBuffer.js';
import {
  fitCtorCamera,
  setCtorZoom as setCtorZoomCam,
  screenToCtorWorld
} from './paint/CtorCamera.js';

export const CELL_MM = CTOR_SIZE_MM;
export const GRID_CELLS = CTOR_GRID_CELLS;
export const CANVAS_MM = CTOR_TILE_CANVAS_MM;

/** Estado inicial do construtor de ladrilho. */
export function createCtorState() {
  return {
    tool: 'paint',
    color: '#000000',
    brush: 20,
    shape: 'round',
    gridLock: 10,
    painting: false,
    buf: null,
    bufCtx: null,
    scale: 1,
    ox: 0,
    oy: 0,
    panning: false,
    lastX: 0,
    lastY: 0,
    undoStack: [],
    redoStack: [],
    maxHistory: CTOR_HISTORY_MAX,
    strokeSaved: false,
    cursorX: null,
    cursorY: null,
    lineStart: null,
    editingIndex: null
  };
}

export function initCtorBuffer(ctor) {
  initPaintBuffer(ctor, CANVAS_MM);
}

export function clearCtorBuffer(ctor) {
  clearPaintBuffer(ctor, CANVAS_MM);
}

export function fitCtorCanvas(ctorCanvas, ctorCtx, ctor) {
  fitCtorCamera(ctorCanvas, ctorCtx, ctor, CANVAS_MM, { pad: 20, maxFit: 2 });
}

export function setCtorZoom(ctorCanvas, ctor, factor, redraw) {
  setCtorZoomCam(ctorCanvas, ctor, factor, { min: 0.08, max: 4 });
  if (redraw) redraw();
}

export function ctorPos(ctorCanvas, ctor, e) {
  return screenToCtorWorld(ctorCanvas, ctor, e, CANVAS_MM);
}

export function pushUndo(ctor) {
  pushPaintUndo(ctor, CANVAS_MM);
}

export function undoCtor(ctor, redraw) {
  undoPaint(ctor, CANVAS_MM, redraw);
}

export function redoCtor(ctor, redraw) {
  redoPaint(ctor, CANVAS_MM, redraw);
}

export function paintAt(ctor, x, y) {
  paintAtShared(ctor, x, y, CANVAS_MM, whiteBg);
}

/**
 * Desenha o buffer + grade 3×3 + preview do pincel.
 * @param {HTMLCanvasElement} ctorCanvas
 * @param {CanvasRenderingContext2D} ctorCtx
 * @param {object} ctor
 */
export function drawCtor(ctorCanvas, ctorCtx, ctor) {
  if (!ctor.buf || !ctorCanvas || !ctorCtx) return;
  const cssW = ctorCanvas.clientWidth;
  const cssH = ctorCanvas.clientHeight;
  ctorCtx.save();
  ctorCtx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctorCtx.fillStyle = '#0b1220';
  ctorCtx.fillRect(0, 0, cssW, cssH);

  ctorCtx.translate(ctor.ox, ctor.oy);
  ctorCtx.scale(ctor.scale, ctor.scale);
  ctorCtx.imageSmoothingEnabled = false;
  ctorCtx.drawImage(ctor.buf, 0, 0);

  const cell = CELL_MM;
  ctorCtx.strokeStyle = '#3b82f6';
  ctorCtx.lineWidth = 2 / ctor.scale;
  ctorCtx.strokeRect(cell, cell, cell, cell);
  ctorCtx.strokeStyle = 'rgba(148,163,184,0.55)';
  ctorCtx.lineWidth = 1 / ctor.scale;
  for (let i = 0; i <= 3; i++) {
    ctorCtx.beginPath();
    ctorCtx.moveTo(i * cell, 0);
    ctorCtx.lineTo(i * cell, CANVAS_MM);
    ctorCtx.stroke();
    ctorCtx.beginPath();
    ctorCtx.moveTo(0, i * cell);
    ctorCtx.lineTo(CANVAS_MM, i * cell);
    ctorCtx.stroke();
  }

  ctorCtx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
  ctorCtx.lineWidth = 1 / ctor.scale;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = col * cell + cell / 2;
      const cy = row * cell + cell / 2;
      ctorCtx.beginPath();
      ctorCtx.moveTo(col * cell, cy);
      ctorCtx.lineTo((col + 1) * cell, cy);
      ctorCtx.stroke();
      ctorCtx.beginPath();
      ctorCtx.moveTo(cx, row * cell);
      ctorCtx.lineTo(cx, (row + 1) * cell);
      ctorCtx.stroke();
    }
  }

  ctorCtx.fillStyle = '#94a3b8';
  ctorCtx.font = `${12 / ctor.scale}px sans-serif`;
  ctorCtx.textAlign = 'center';
  ctorCtx.fillText('LADRILHO 300×300 mm', CANVAS_MM / 2, cell + 14 / ctor.scale);

  if (ctor.gridLock > 1) {
    const step = ctor.gridLock;
    ctorCtx.strokeStyle = 'rgba(59,130,246,0.12)';
    ctorCtx.lineWidth = 1 / ctor.scale;
    for (let x = cell; x <= cell * 2; x += step) {
      ctorCtx.beginPath();
      ctorCtx.moveTo(x, cell);
      ctorCtx.lineTo(x, cell * 2);
      ctorCtx.stroke();
    }
    for (let y = cell; y <= cell * 2; y += step) {
      ctorCtx.beginPath();
      ctorCtx.moveTo(cell, y);
      ctorCtx.lineTo(cell * 2, y);
      ctorCtx.stroke();
    }
  }

  if (ctor.cursorX != null && ctor.cursorY != null && !ctor.panning) {
    ctorCtx.save();
    if (ctor.tool === 'line' || ctor.tool === 'measure') {
      const lw = Math.max(1, ctor.brush | 0);
      if (ctor.tool === 'measure') {
        ctorCtx.lineWidth = 1.5 / ctor.scale;
        ctorCtx.strokeStyle = 'rgba(234,179,8,0.95)';
        ctorCtx.setLineDash([6 / ctor.scale, 4 / ctor.scale]);
        if (ctor.lineStart) {
          ctorCtx.beginPath();
          ctorCtx.moveTo(ctor.lineStart.x, ctor.lineStart.y);
          ctorCtx.lineTo(ctor.cursorX, ctor.cursorY);
          ctorCtx.stroke();
          const dist = Math.hypot(
            ctor.cursorX - ctor.lineStart.x,
            ctor.cursorY - ctor.lineStart.y
          );
          ctorCtx.setLineDash([]);
          ctorCtx.fillStyle = '#fbbf24';
          ctorCtx.font = `${13 / ctor.scale}px sans-serif`;
          ctorCtx.textAlign = 'center';
          ctorCtx.fillText(
            dist.toFixed(1) + ' mm',
            (ctor.lineStart.x + ctor.cursorX) / 2,
            (ctor.lineStart.y + ctor.cursorY) / 2 - 8 / ctor.scale
          );
        }
      } else {
        ctorCtx.strokeStyle = 'rgba(59,130,246,0.7)';
        ctorCtx.fillStyle = 'rgba(59,130,246,0.35)';
        ctorCtx.lineCap = ctor.shape === 'square' ? 'square' : 'round';
        ctorCtx.lineJoin = ctor.shape === 'square' ? 'miter' : 'round';
        ctorCtx.lineWidth = lw;
        ctorCtx.setLineDash([6 / ctor.scale, 4 / ctor.scale]);
        if (ctor.lineStart) {
          ctorCtx.beginPath();
          ctorCtx.moveTo(ctor.lineStart.x + 0.5, ctor.lineStart.y + 0.5);
          ctorCtx.lineTo(ctor.cursorX + 0.5, ctor.cursorY + 0.5);
          ctorCtx.stroke();
          ctorCtx.setLineDash([]);
          if (ctor.shape === 'square') {
            ctorCtx.fillRect(
              ctor.lineStart.x - lw / 2,
              ctor.lineStart.y - lw / 2,
              lw,
              lw
            );
          } else {
            ctorCtx.beginPath();
            ctorCtx.arc(
              ctor.lineStart.x + 0.5,
              ctor.lineStart.y + 0.5,
              Math.max(1, lw / 2),
              0,
              Math.PI * 2
            );
            ctorCtx.fill();
          }
        } else {
          ctorCtx.setLineDash([]);
          ctorCtx.lineWidth = 1.5 / ctor.scale;
          if (ctor.shape === 'square') {
            ctorCtx.strokeRect(ctor.cursorX - lw / 2, ctor.cursorY - lw / 2, lw, lw);
          } else {
            ctorCtx.beginPath();
            ctorCtx.arc(
              ctor.cursorX + 0.5,
              ctor.cursorY + 0.5,
              Math.max(2, lw / 2),
              0,
              Math.PI * 2
            );
            ctorCtx.stroke();
          }
        }
      }
    } else {
      const s = Math.max(1, ctor.brush | 0);
      const r = Math.max(0.5, s / 2);
      ctorCtx.lineWidth = 1.5 / ctor.scale;
      ctorCtx.setLineDash([4 / ctor.scale, 3 / ctor.scale]);
      if (ctor.tool === 'erase') {
        ctorCtx.strokeStyle = 'rgba(239,68,68,0.85)';
        ctorCtx.fillStyle = 'rgba(239,68,68,0.12)';
      } else {
        ctorCtx.strokeStyle = 'rgba(59,130,246,0.9)';
        ctorCtx.fillStyle = 'rgba(59,130,246,0.12)';
      }
      if (ctor.shape === 'square') {
        ctorCtx.fillRect(ctor.cursorX - s / 2, ctor.cursorY - s / 2, s, s);
        ctorCtx.strokeRect(ctor.cursorX - s / 2, ctor.cursorY - s / 2, s, s);
      } else {
        ctorCtx.beginPath();
        ctorCtx.arc(ctor.cursorX + 0.5, ctor.cursorY + 0.5, r, 0, Math.PI * 2);
        ctorCtx.fill();
        ctorCtx.stroke();
      }
    }
    ctorCtx.setLineDash([]);
    ctorCtx.restore();
  }
  ctorCtx.restore();
}

export function openConstructorTab(ctor, ctorCanvas, ctorCtx, deps) {
  try {
    if (!ctor.buf) initCtorBuffer(ctor);
    document.getElementById('arena')?.classList.add('hidden');
    document.getElementById('arenaZoomBar')?.classList.add('hidden');
    document.getElementById('objCtorCanvas')?.classList.add('hidden');
    document.getElementById('objCtorZoomBar')?.classList.add('hidden');
    document.getElementById('robotCtorCanvas')?.classList.add('hidden');
    document.getElementById('robotCtorZoomBar')?.classList.add('hidden');
    if (ctorCanvas) ctorCanvas.classList.remove('hidden');
    document.getElementById('ctorZoomBar')?.classList.remove('hidden');
    deps.setGridLock(ctor.gridLock || 10);
    const brushEl = document.getElementById('brushSize');
    if (brushEl) brushEl.value = ctor.brush;
    const brushLbl = document.getElementById('brushSizeLabel');
    if (brushLbl) brushLbl.textContent = ctor.brush + ' mm';
    const brushNum = document.getElementById('brushSizeNum');
    if (brushNum) brushNum.value = ctor.brush;
    const sw = document.getElementById('activeColorSwatch');
    if (sw) sw.style.background = ctor.color;
    fitCtorCanvas(ctorCanvas, ctorCtx, ctor);
    drawCtor(ctorCanvas, ctorCtx, ctor);
  } catch (err) {
    console.error('openConstructorTab:', err);
    deps.logUI({
      t: 0,
      msg: 'Erro ao abrir construtor: ' + err.message,
      category: 'error'
    });
  }
}

export function closeConstructorTab(ctorCanvas) {
  if (ctorCanvas) ctorCanvas.classList.add('hidden');
  document.getElementById('ctorZoomBar')?.classList.add('hidden');
}

/**
 * Exporta centro 300×300 + fullBitmap e zonas/objetos detectados.
 */
export function bufferToCustomDef(ctor, name, points) {
  const tileC = document.createElement('canvas');
  tileC.width = CELL_MM;
  tileC.height = CELL_MM;
  const tctx = tileC.getContext('2d');
  tctx.drawImage(
    ctor.buf,
    CELL_MM,
    CELL_MM,
    CELL_MM,
    CELL_MM,
    0,
    0,
    CELL_MM,
    CELL_MM
  );
  const dataURL = tileC.toDataURL('image/png');

  const img = ctor.bufCtx.getImageData(0, 0, CANVAS_MM, CANVAS_MM);
  const data = img.data;
  const objects = [];
  const zones = [];
  const step = Math.max(5, ctor.gridLock || 10);

  for (let y = 0; y < CANVAS_MM; y += step) {
    for (let x = 0; x < CANVAS_MM; x += step) {
      const i = (y * CANVAS_MM + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const nx = (x - CELL_MM) / CELL_MM;
      const ny = (y - CELL_MM) / CELL_MM;
      const w = step / CELL_MM,
        h = step / CELL_MM;
      if (r > 200 && g > 80 && g < 160 && b < 80) {
        objects.push({ type: 'obstacle', x: nx, y: ny, w, h });
      } else if (r > 140 && r < 200 && g < 120 && b > 180) {
        objects.push({ type: 'gap', x: nx, y: ny, w, h });
      } else if (g > 150 && r < 100 && b < 120) {
        objects.push({ type: 'green', x: nx, y: ny, w, h });
      } else if (b > 180 && r < 100 && g < 160) {
        zones.push({ x: nx, y: ny, w, h });
      }
    }
  }

  return {
    name,
    points,
    pixel: true,
    sizeMm: CELL_MM,
    bitmap: dataURL,
    fullBitmap: ctor.buf.toDataURL('image/png'),
    objects,
    zones,
    lines: []
  };
}

export function loadCustomTileIntoCtor(sim, ctor, idx, deps) {
  const def = sim.customLibrary[idx];
  if (!def) return;
  if (!ctor.buf) initCtorBuffer(ctor);
  clearCtorBuffer(ctor);
  const img = new Image();
  img.onload = () => {
    if (def.fullBitmap) {
      const full = new Image();
      full.onload = () => {
        ctor.bufCtx.drawImage(full, 0, 0, CANVAS_MM, CANVAS_MM);
        deps.drawCtor();
      };
      full.src = def.fullBitmap;
    } else if (def.bitmap) {
      ctor.bufCtx.drawImage(img, CELL_MM, CELL_MM, CELL_MM, CELL_MM);
      deps.drawCtor();
    }
  };
  img.src = def.bitmap || def.fullBitmap || '';
  document.getElementById('ctorName').value = def.name || 'Meu Ladrilho';
  document.getElementById('ctorPoints').value =
    def.points != null && Number.isFinite(Number(def.points))
      ? Number(def.points)
      : 10;
  ctor.editingIndex = idx;
  deps.logUI({
    t: 0,
    msg: `Ladrilho "${def.name}" carregado para edição.`,
    category: 'info'
  });
  deps.setMode('constructor');
}

export function refreshCustomSelect(sim, deps) {
  const lib = document.getElementById('customLibrary');
  if (!lib) return;
  if (!sim.customLibrary.length) lib.textContent = 'Nenhum ainda.';
  else {
    lib.innerHTML = sim.customLibrary
      .map((c, i) => {
        const pts =
          c.points != null && Number.isFinite(Number(c.points))
            ? Number(c.points)
            : 10;
        return `<div class="lib-item"><span><strong>${c.name}</strong> — ${pts}pts</span>
       <span style="display:flex;gap:0.25rem">
         <button data-edit="${i}" class="primary">Editar</button>
         <button data-del="${i}" class="danger">Excluir</button>
       </span></div>`;
      })
      .join('');
    lib.querySelectorAll('button[data-del]').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.del);
        if (confirm(`Excluir "${sim.customLibrary[i].name}"?`)) {
          sim.customLibrary.splice(i, 1);
          deps.persist('obr_custom_tiles', sim.customLibrary);
          refreshCustomSelect(sim, deps);
        }
      };
    });
    lib.querySelectorAll('button[data-edit]').forEach(btn => {
      btn.onclick = () =>
        deps.loadCustomTileIntoCtor(parseInt(btn.dataset.edit));
    });
  }
  deps.renderTilePalette();
}

/**
 * Eventos de mouse/roda no canvas do construtor de ladrilho.
 */
export function wireTileCtorCanvas(ctor, ctorCanvas, deps) {
  if (!ctorCanvas) return;

  const pickColor = (x, y) => {
    const { hex, nearWhite } = pickColorAt(ctor.bufCtx, x, y);
    if (nearWhite) {
      ctor.tool = 'erase';
    } else {
      ctor.tool = 'paint';
      ctor.color = hex;
      const sw = document.getElementById('activeColorSwatch');
      if (sw) sw.style.background = hex;
    }
    document.querySelectorAll('#ctorToolsSide button').forEach(b => {
      if (b.dataset.ctor === 'picker' || b.dataset.ctor === 'clear') return;
      const match =
        b.dataset.ctor === 'paint' &&
        b.dataset.color &&
        b.dataset.color.toLowerCase() === hex.toLowerCase();
      const isErase = b.dataset.ctor === 'erase' && ctor.tool === 'erase';
      b.classList.toggle('active-tool', match || isErase);
    });
  };

  ctorCanvas.addEventListener('mousedown', e => {
    if (e.button === 1 && e.shiftKey) {
      e.preventDefault();
      ctor.panning = true;
      ctor.lastX = e.clientX;
      ctor.lastY = e.clientY;
      ctorCanvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      const p = ctorPos(ctorCanvas, ctor, e);
      pickColor(p.x, p.y);
      return;
    }
    if (e.button !== 0) return;
    const p = ctorPos(ctorCanvas, ctor, e);
    ctor.cursorX = p.x;
    ctor.cursorY = p.y;
    if (ctor.tool === 'picker') {
      pickColor(p.x, p.y);
      return;
    }
    if (ctor.tool === 'line' || ctor.tool === 'measure') {
      if (!ctor.lineStart) {
        ctor.lineStart = { x: p.x, y: p.y };
        deps.drawCtor();
        return;
      }
      if (ctor.tool === 'measure') {
        const dist = Math.hypot(p.x - ctor.lineStart.x, p.y - ctor.lineStart.y);
        deps.logUI({
          t: 0,
          msg: `Medição (ladrilho): ${dist.toFixed(1)} mm`,
          category: 'info'
        });
        ctor.lineStart = null;
        deps.drawCtor();
        return;
      }
      pushUndo(ctor);
      strokeLineOnBuf(
        ctor.bufCtx,
        ctor.lineStart.x,
        ctor.lineStart.y,
        p.x,
        p.y,
        ctor.color,
        ctor.brush,
        ctor.shape,
        false,
        CANVAS_MM,
        CANVAS_MM,
        whiteBg
      );
      ctor.lineStart = null;
      deps.drawCtor();
      return;
    }
    pushUndo(ctor);
    ctor.strokeSaved = true;
    ctor.painting = true;
    paintAt(ctor, p.x, p.y);
    deps.drawCtor();
  });

  ctorCanvas.addEventListener('mousemove', e => {
    if (ctor.panning) {
      ctor.ox += e.clientX - ctor.lastX;
      ctor.oy += e.clientY - ctor.lastY;
      ctor.lastX = e.clientX;
      ctor.lastY = e.clientY;
      deps.drawCtor();
      return;
    }
    const p = ctorPos(ctorCanvas, ctor, e);
    ctor.cursorX = p.x;
    ctor.cursorY = p.y;
    if (ctor.painting) paintAt(ctor, p.x, p.y);
    deps.drawCtor();
  });

  window.addEventListener('mouseup', () => {
    ctor.painting = false;
    ctor.strokeSaved = false;
    if (ctor.panning) {
      ctor.panning = false;
      ctorCanvas.style.cursor = 'crosshair';
    }
  });

  ctorCanvas.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      setCtorZoom(ctorCanvas, ctor, e.deltaY < 0 ? 1.12 : 1 / 1.12, deps.drawCtor);
    },
    { passive: false }
  );
  ctorCanvas.addEventListener('contextmenu', e => e.preventDefault());
}

/**
 * Controles laterais: cor, pincel, grade, salvar.
 */
export function wireTileCtorUI(ctor, sim, deps) {
  const setCtorColor = hex => {
    if (!hex) return;
    if (hex[0] !== '#') hex = '#' + hex;
    ctor.color = hex;
    const sw = document.getElementById('activeColorSwatch');
    if (sw) sw.style.background = hex;
    const pick = document.getElementById('ctorColorPicker');
    if (pick) pick.value = hex;
    const hx = document.getElementById('ctorColorHex');
    if (hx) hx.value = hex;
    document.querySelectorAll('#ctorColorPalette .color-swatch').forEach(b => {
      const on = b.dataset.color.toLowerCase() === hex.toLowerCase();
      b.classList.toggle('active-tool', on);
      b.style.borderColor = on ? '#fff' : 'transparent';
    });
  };

  document.querySelectorAll('#ctorToolsSide button').forEach(btn => {
    btn.onclick = () => {
      const t = btn.dataset.ctor;
      if (t === 'clear') {
        if (!confirm('Limpar canvas do construtor?')) return;
        pushUndo(ctor);
        clearCtorBuffer(ctor);
        deps.drawCtor();
        return;
      }
      if (t === 'undo') {
        undoCtor(ctor, deps.drawCtor);
        return;
      }
      if (t === 'redo') {
        redoCtor(ctor, deps.drawCtor);
        return;
      }
      document.querySelectorAll('#ctorToolsSide button').forEach(b =>
        b.classList.remove('active-tool')
      );
      btn.classList.add('active-tool');
      if (t === 'paint' && document.getElementById('ctorPaintAsLine')?.checked) {
        ctor.tool = 'line';
      } else if (btn.dataset.color) {
        ctor.tool = 'paint';
        setCtorColor(btn.dataset.color);
      } else {
        ctor.tool = t;
      }
      ctor.lineStart = null;
      if (t === 'erase') {
        const sw = document.getElementById('activeColorSwatch');
        if (sw) sw.style.background = '#ffffff';
      }
      deps.drawCtor();
    };
  });

  document.querySelectorAll('#ctorColorPalette .color-swatch').forEach(btn => {
    btn.onclick = () => {
      setCtorColor(btn.dataset.color);
      if (ctor.tool === 'erase' || ctor.tool === 'picker' || ctor.tool === 'measure') {
        ctor.tool = document.getElementById('ctorPaintAsLine')?.checked
          ? 'line'
          : 'paint';
        document.querySelectorAll('#ctorToolsSide button').forEach(b => {
          b.classList.toggle('active-tool', b.dataset.ctor === 'paint');
        });
      }
      deps.drawCtor();
    };
  });

  const colorPicker = document.getElementById('ctorColorPicker');
  if (colorPicker) colorPicker.oninput = e => setCtorColor(e.target.value);
  const colorHex = document.getElementById('ctorColorHex');
  if (colorHex) {
    colorHex.onchange = e => {
      let v = e.target.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(v)) setCtorColor(v.startsWith('#') ? v : '#' + v);
    };
  }

  const paintAsLine = document.getElementById('ctorPaintAsLine');
  if (paintAsLine) {
    paintAsLine.onchange = () => {
      if (ctor.tool === 'paint' || ctor.tool === 'line') {
        ctor.tool = paintAsLine.checked ? 'line' : 'paint';
        ctor.lineStart = null;
        deps.drawCtor();
      }
    };
  }

  const setBrushSize = v => {
    v = Math.max(1, Math.min(300, parseInt(v) || 1));
    ctor.brush = v;
    const a = document.getElementById('brushSize');
    const b = document.getElementById('brushSizeNum');
    const c = document.getElementById('brushSizeLabel');
    if (a) a.value = v;
    if (b) b.value = v;
    if (c) c.textContent = v + ' mm';
  };
  document.getElementById('brushSize')?.addEventListener(
    'input',
    e => setBrushSize(e.target.value)
  );
  document.getElementById('brushSizeNum')?.addEventListener('change', e =>
    setBrushSize(e.target.value)
  );
  document.getElementById('brushSizeNum')?.addEventListener('input', e => {
    const v = parseInt(e.target.value);
    if (!isNaN(v) && v >= 1 && v <= 300) setBrushSize(v);
  });

  const setGridLock = v => {
    v = Math.max(1, Math.min(50, parseInt(v) || 1));
    ctor.gridLock = v;
    const sl = document.getElementById('gridLock');
    const num = document.getElementById('gridLockNum');
    const lab = document.getElementById('gridLockLabel');
    if (sl) sl.value = v;
    if (num) num.value = v;
    if (lab) lab.textContent = v + ' mm';
    deps.drawCtor();
  };
  // export for openConstructorTab
  deps._setGridLockImpl = setGridLock;

  document.getElementById('gridLock')?.addEventListener('input', e =>
    setGridLock(e.target.value)
  );
  document.getElementById('gridLockNum')?.addEventListener('input', e => {
    const v = parseInt(e.target.value);
    if (!isNaN(v) && v >= 1 && v <= 50) setGridLock(v);
  });
  document.getElementById('gridLockNum')?.addEventListener('change', e =>
    setGridLock(e.target.value)
  );

  document.getElementById('brushRound')?.addEventListener('click', () => {
    ctor.shape = 'round';
    document.getElementById('brushRound')?.classList.add('active-tool');
    document.getElementById('brushSquare')?.classList.remove('active-tool');
  });
  document.getElementById('brushSquare')?.addEventListener('click', () => {
    ctor.shape = 'square';
    document.getElementById('brushSquare')?.classList.add('active-tool');
    document.getElementById('brushRound')?.classList.remove('active-tool');
  });

  document.getElementById('btnCtorSave')?.addEventListener('click', () => {
    const name = document.getElementById('ctorName')?.value || 'Meu Ladrilho';
    const rawPts = parseInt(document.getElementById('ctorPoints')?.value, 10);
    const points = Number.isFinite(rawPts) ? rawPts : 10;
    if (!ctor.buf) {
      alert('Editor não inicializado.');
      return;
    }
    const def = bufferToCustomDef(ctor, name, points);
    if (
      ctor.editingIndex != null &&
      ctor.editingIndex >= 0 &&
      ctor.editingIndex < sim.customLibrary.length
    ) {
      sim.customLibrary[ctor.editingIndex] = def;
      deps.logUI({
        t: 0,
        msg: `Ladrilho "${name}" atualizado na biblioteca.`,
        category: 'success'
      });
      ctor.editingIndex = null;
    } else {
      sim.customLibrary.push(def);
      deps.logUI({
        t: 0,
        msg: `Ladrilho "${name}" salvo (300×300 mm pixel + contexto 3×3).`,
        category: 'success'
      });
    }
    deps.persist('obr_custom_tiles', sim.customLibrary);
    deps.refreshCustomSelect();
  });

  // zoom bar
  document.getElementById('btnCtorZoomIn')?.addEventListener('click', () =>
    deps.setCtorZoom(1.12)
  );
  document.getElementById('btnCtorZoomOut')?.addEventListener('click', () =>
    deps.setCtorZoom(1 / 1.12)
  );
  document.getElementById('btnCtorZoomFit')?.addEventListener('click', () => {
    deps.fitCtorCanvas();
    deps.drawCtor();
  });

  return { setCtorColor, setBrushSize, setGridLock };
}
