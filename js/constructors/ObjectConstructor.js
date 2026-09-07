/**
 * Construtor de objeto custom 300×300 mm.
 */
import { CTOR_SIZE_MM, CTOR_HISTORY_MAX } from '../core/constants.js';
import {
  initPaintBuffer,
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

export const OBJ_MM = CTOR_SIZE_MM;

export function createObjCtorState() {
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
    cursorX: null,
    cursorY: null,
    lineStart: null
  };
}

export function initObjBuf(objCtor) {
  initPaintBuffer(objCtor, OBJ_MM);
}

export function fitObjCtorCanvas(canvas, ctx, objCtor) {
  fitCtorCamera(canvas, ctx, objCtor, OBJ_MM, { pad: 24, maxFit: 3 });
}

export function setObjCtorZoom(canvas, objCtor, factor, redraw) {
  setCtorZoomCam(canvas, objCtor, factor, { min: 0.08, max: 5 });
  if (redraw) redraw();
}

export function objCtorPos(canvas, objCtor, e) {
  return screenToCtorWorld(canvas, objCtor, e, OBJ_MM);
}

export function pushObjUndo(objCtor) {
  pushPaintUndo(objCtor, OBJ_MM);
}

export function undoObjCtor(objCtor, redraw) {
  undoPaint(objCtor, OBJ_MM, redraw);
}

export function redoObjCtor(objCtor, redraw) {
  redoPaint(objCtor, OBJ_MM, redraw);
}

export function paintObjAt(objCtor, x, y) {
  paintAtShared(objCtor, x, y, OBJ_MM, whiteBg);
}

export function drawObjCtor(canvas, ctx, objCtor) {
  if (!objCtor.buf || !ctx || !canvas) return;
  const cssW = canvas.clientWidth,
    cssH = canvas.clientHeight;
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.translate(objCtor.ox, objCtor.oy);
  ctx.scale(objCtor.scale, objCtor.scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(objCtor.buf, 0, 0);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2 / objCtor.scale;
  ctx.strokeRect(0, 0, OBJ_MM, OBJ_MM);
  ctx.strokeStyle = 'rgba(239,68,68,0.45)';
  ctx.lineWidth = 1 / objCtor.scale;
  ctx.beginPath();
  ctx.moveTo(0, OBJ_MM / 2);
  ctx.lineTo(OBJ_MM, OBJ_MM / 2);
  ctx.moveTo(OBJ_MM / 2, 0);
  ctx.lineTo(OBJ_MM / 2, OBJ_MM);
  ctx.stroke();
  if (objCtor.gridLock > 1) {
    ctx.strokeStyle = 'rgba(59,130,246,0.12)';
    for (let i = 0; i <= OBJ_MM; i += objCtor.gridLock) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, OBJ_MM);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(OBJ_MM, i);
      ctx.stroke();
    }
  }
  if (objCtor.cursorX != null && !objCtor.panning) {
    if (objCtor.tool === 'line' || objCtor.tool === 'measure') {
      const lw = Math.max(1, objCtor.brush | 0);
      if (objCtor.tool === 'measure') {
        ctx.lineWidth = 1.5 / objCtor.scale;
        ctx.strokeStyle = 'rgba(234,179,8,0.95)';
        ctx.setLineDash([6 / objCtor.scale, 4 / objCtor.scale]);
        if (objCtor.lineStart) {
          ctx.beginPath();
          ctx.moveTo(objCtor.lineStart.x, objCtor.lineStart.y);
          ctx.lineTo(objCtor.cursorX, objCtor.cursorY);
          ctx.stroke();
          const dist = Math.hypot(
            objCtor.cursorX - objCtor.lineStart.x,
            objCtor.cursorY - objCtor.lineStart.y
          );
          ctx.setLineDash([]);
          ctx.fillStyle = '#fbbf24';
          ctx.font = `${13 / objCtor.scale}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(
            dist.toFixed(1) + ' mm',
            (objCtor.lineStart.x + objCtor.cursorX) / 2,
            (objCtor.lineStart.y + objCtor.cursorY) / 2 - 8 / objCtor.scale
          );
        }
      } else {
        ctx.lineCap = objCtor.shape === 'square' ? 'square' : 'round';
        ctx.lineWidth = lw;
        ctx.strokeStyle = 'rgba(59,130,246,0.7)';
        ctx.setLineDash([6 / objCtor.scale, 4 / objCtor.scale]);
        if (objCtor.lineStart) {
          ctx.beginPath();
          ctx.moveTo(objCtor.lineStart.x + 0.5, objCtor.lineStart.y + 0.5);
          ctx.lineTo(objCtor.cursorX + 0.5, objCtor.cursorY + 0.5);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(59,130,246,0.35)';
          if (objCtor.shape === 'square')
            ctx.fillRect(
              objCtor.lineStart.x - lw / 2,
              objCtor.lineStart.y - lw / 2,
              lw,
              lw
            );
          else {
            ctx.beginPath();
            ctx.arc(
              objCtor.lineStart.x + 0.5,
              objCtor.lineStart.y + 0.5,
              Math.max(1, lw / 2),
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        } else {
          ctx.setLineDash([]);
          ctx.lineWidth = 1.5 / objCtor.scale;
          if (objCtor.shape === 'square')
            ctx.strokeRect(
              objCtor.cursorX - lw / 2,
              objCtor.cursorY - lw / 2,
              lw,
              lw
            );
          else {
            ctx.beginPath();
            ctx.arc(
              objCtor.cursorX + 0.5,
              objCtor.cursorY + 0.5,
              Math.max(2, lw / 2),
              0,
              Math.PI * 2
            );
            ctx.stroke();
          }
        }
      }
    } else {
      const s = Math.max(1, objCtor.brush | 0),
        r = Math.max(0.5, s / 2);
      ctx.lineWidth = 1.5 / objCtor.scale;
      ctx.setLineDash([4 / objCtor.scale, 3 / objCtor.scale]);
      ctx.strokeStyle =
        objCtor.tool === 'erase' ? 'rgba(239,68,68,0.85)' : 'rgba(59,130,246,0.9)';
      ctx.fillStyle =
        objCtor.tool === 'erase' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)';
      if (objCtor.shape === 'square') {
        ctx.fillRect(objCtor.cursorX - s / 2, objCtor.cursorY - s / 2, s, s);
        ctx.strokeRect(objCtor.cursorX - s / 2, objCtor.cursorY - s / 2, s, s);
      } else {
        ctx.beginPath();
        ctx.arc(objCtor.cursorX + 0.5, objCtor.cursorY + 0.5, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

export function openObjConstructorTab(objCtor, canvas, ctx) {
  try {
    if (!canvas) return;
    if (!objCtor.buf) initObjBuf(objCtor);
    document.getElementById('arena')?.classList.add('hidden');
    document.getElementById('arenaZoomBar')?.classList.add('hidden');
    document.getElementById('ctorCanvas')?.classList.add('hidden');
    document.getElementById('ctorZoomBar')?.classList.add('hidden');
    document.getElementById('robotCtorCanvas')?.classList.add('hidden');
    document.getElementById('robotCtorZoomBar')?.classList.add('hidden');
    canvas.classList.remove('hidden');
    document.getElementById('objCtorZoomBar')?.classList.remove('hidden');
    const gl = document.getElementById('objGridLock');
    if (gl) objCtor.gridLock = parseInt(gl.value) || 1;
    fitObjCtorCanvas(canvas, ctx, objCtor);
    drawObjCtor(canvas, ctx, objCtor);
  } catch (err) {
    console.error('openObjConstructorTab:', err);
  }
}

export function closeObjConstructorTab(canvas) {
  if (canvas) canvas.classList.add('hidden');
  document.getElementById('objCtorZoomBar')?.classList.add('hidden');
}

export function refreshObjLibrary(sim, deps) {
  const sel = document.getElementById('customObjSelect');
  if (sel) {
    sel.innerHTML = '<option value="">— obj custom —</option>';
    sim.customObjLibrary.forEach((c, i) => {
      const o = document.createElement('option');
      const pts =
        c.points != null && Number.isFinite(Number(c.points)) ? Number(c.points) : 0;
      o.value = i;
      o.textContent = `${c.name} (${pts}pts)`;
      sel.appendChild(o);
    });
  }
  const palette = document.getElementById('objectPalette');
  if (palette) {
    if (!sim.customObjLibrary.length) {
      palette.innerHTML =
        '<span style="font-size:0.7rem;color:var(--muted)">Nenhum objeto custom ainda.</span>';
    } else {
      palette.innerHTML = '';
      sim.customObjLibrary.forEach((c, i) => {
        const btn = document.createElement('button');
        const pts =
          c.points != null && Number.isFinite(Number(c.points))
            ? Number(c.points)
            : 0;
        btn.title = `${c.name} (${pts} pts)`;
        btn.style.cssText =
          'position:relative;width:48px;height:48px;padding:2px;overflow:hidden';
        if (c.bitmap) {
          const img = document.createElement('img');
          img.src = c.bitmap;
          img.style.cssText =
            'width:100%;height:100%;object-fit:contain;image-rendering:pixelated';
          btn.appendChild(img);
        } else {
          btn.textContent = c.name.slice(0, 4);
        }
        btn.onclick = () => {
          document
            .querySelectorAll('#objectTools button, #objectPalette button')
            .forEach(b => b.classList.remove('active-tool'));
          btn.classList.add('active-tool');
          sim.objectTool = 'custom';
          sim.placingCustomObjId = i;
          sim.selectedTool = null;
          sim.markerTool = null;
          if (sel) sel.value = String(i);
        };
        palette.appendChild(btn);
      });
    }
  }
  const lib = document.getElementById('customObjLibrary');
  if (lib) {
    if (!sim.customObjLibrary.length) lib.textContent = 'Nenhum ainda.';
    else {
      lib.innerHTML = sim.customObjLibrary
        .map((c, i) => {
          const pts =
            c.points != null && Number.isFinite(Number(c.points))
              ? Number(c.points)
              : 0;
          return `<div class="lib-item"><span><strong>${c.name}</strong> — ${pts}pts</span>
        <button data-odel="${i}" class="danger">Excluir</button></div>`;
        })
        .join('');
      lib.querySelectorAll('button[data-odel]').forEach(btn => {
        btn.onclick = () => {
          const i = parseInt(btn.dataset.odel);
          if (confirm(`Excluir "${sim.customObjLibrary[i].name}"?`)) {
            sim.customObjLibrary.splice(i, 1);
            deps.persist('obr_custom_objects', sim.customObjLibrary);
            refreshObjLibrary(sim, deps);
          }
        };
      });
    }
  }
}

export function saveObjFromBuffer(objCtor, sim, name, points, deps) {
  const tmp = document.createElement('canvas');
  tmp.width = OBJ_MM;
  tmp.height = OBJ_MM;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(objCtor.buf, 0, 0);
  const img = tctx.getImageData(0, 0, OBJ_MM, OBJ_MM);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) d[i + 3] = 0;
  }
  tctx.putImageData(img, 0, 0);
  const def = {
    name,
    points,
    pixel: true,
    sizeMm: OBJ_MM,
    bitmap: tmp.toDataURL('image/png')
  };
  sim.customObjLibrary.push(def);
  deps.persist('obr_custom_objects', sim.customObjLibrary);
  deps.refreshObjLibrary();
  deps.logUI({
    t: 0,
    msg: `Objeto "${name}" salvo (${points} pts).`,
    category: 'success'
  });
}

export function wireObjCtorCanvas(objCtor, canvas, deps) {
  if (!canvas) return;

  canvas.addEventListener('mousedown', e => {
    if (e.button === 1 && e.shiftKey) {
      e.preventDefault();
      objCtor.panning = true;
      objCtor.lastX = e.clientX;
      objCtor.lastY = e.clientY;
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      const p = objCtorPos(canvas, objCtor, e);
      const { hex, nearWhite } = pickColorAt(objCtor.bufCtx, p.x, p.y);
      if (nearWhite) objCtor.tool = 'erase';
      else {
        objCtor.tool = 'paint';
        objCtor.color = hex;
        const sw = document.getElementById('objActiveColor');
        if (sw) sw.style.background = hex;
      }
      return;
    }
    if (e.button !== 0) return;
    const p = objCtorPos(canvas, objCtor, e);
    objCtor.cursorX = p.x;
    objCtor.cursorY = p.y;
    if (objCtor.tool === 'picker') return;
    if (objCtor.tool === 'line' || objCtor.tool === 'measure') {
      if (!objCtor.lineStart) {
        objCtor.lineStart = { x: p.x, y: p.y };
        deps.drawObjCtor();
        return;
      }
      if (objCtor.tool === 'measure') {
        const dist = Math.hypot(
          p.x - objCtor.lineStart.x,
          p.y - objCtor.lineStart.y
        );
        deps.logUI({
          t: 0,
          msg: `Medição (objeto): ${dist.toFixed(1)} mm`,
          category: 'info'
        });
        objCtor.lineStart = null;
        deps.drawObjCtor();
        return;
      }
      pushObjUndo(objCtor);
      strokeLineOnBuf(
        objCtor.bufCtx,
        objCtor.lineStart.x,
        objCtor.lineStart.y,
        p.x,
        p.y,
        objCtor.color,
        objCtor.brush,
        objCtor.shape,
        false,
        OBJ_MM,
        OBJ_MM,
        whiteBg
      );
      objCtor.lineStart = null;
      deps.drawObjCtor();
      return;
    }
    pushObjUndo(objCtor);
    objCtor.painting = true;
    paintObjAt(objCtor, p.x, p.y);
    deps.drawObjCtor();
  });

  canvas.addEventListener('mousemove', e => {
    if (objCtor.panning) {
      objCtor.ox += e.clientX - objCtor.lastX;
      objCtor.oy += e.clientY - objCtor.lastY;
      objCtor.lastX = e.clientX;
      objCtor.lastY = e.clientY;
      deps.drawObjCtor();
      return;
    }
    const p = objCtorPos(canvas, objCtor, e);
    objCtor.cursorX = p.x;
    objCtor.cursorY = p.y;
    if (objCtor.painting) paintObjAt(objCtor, p.x, p.y);
    deps.drawObjCtor();
  });

  canvas.addEventListener('mouseleave', () => {
    objCtor.cursorX = null;
    objCtor.cursorY = null;
    deps.drawObjCtor();
  });
  canvas.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      setObjCtorZoom(
        canvas,
        objCtor,
        e.deltaY < 0 ? 1.12 : 1 / 1.12,
        deps.drawObjCtor
      );
    },
    { passive: false }
  );
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('mouseup', () => {
    objCtor.painting = false;
    objCtor.panning = false;
  });
}

export function wireObjCtorUI(objCtor, sim, deps) {
  document.querySelectorAll('#objCtorTools button').forEach(btn => {
    btn.onclick = () => {
      const t = btn.dataset.oct;
      if (t === 'clear') {
        if (!confirm('Limpar objeto?')) return;
        pushObjUndo(objCtor);
        objCtor.bufCtx.fillStyle = '#ffffff';
        objCtor.bufCtx.fillRect(0, 0, OBJ_MM, OBJ_MM);
        objCtor.redoStack = [];
        deps.drawObjCtor();
        return;
      }
      document
        .querySelectorAll('#objCtorTools button')
        .forEach(b => b.classList.remove('active-tool'));
      btn.classList.add('active-tool');
      if (t === 'paint' && document.getElementById('objPaintAsLine')?.checked) {
        objCtor.tool = 'line';
      } else {
        objCtor.tool = t;
      }
      objCtor.lineStart = null;
      if (t === 'erase') {
        const sw = document.getElementById('objActiveColor');
        if (sw) sw.style.background = '#ffffff';
      } else if (t === 'paint') {
        const sw = document.getElementById('objActiveColor');
        if (sw) sw.style.background = objCtor.color || '#000000';
      }
      deps.drawObjCtor();
    };
  });

  const setObjCtorColor = hex => {
    if (!hex) return;
    if (hex[0] !== '#') hex = '#' + hex;
    objCtor.color = hex;
    const sw = document.getElementById('objActiveColor');
    if (sw) sw.style.background = hex;
    const pick = document.getElementById('objColorPicker');
    if (pick) pick.value = hex;
    const hx = document.getElementById('objColorHex');
    if (hx) hx.value = hex;
    document.querySelectorAll('#objColorPalette .color-swatch').forEach(b => {
      const on = b.dataset.color.toLowerCase() === hex.toLowerCase();
      b.classList.toggle('active-tool', on);
      b.style.borderColor = on ? '#fff' : 'transparent';
    });
  };

  document.querySelectorAll('#objColorPalette .color-swatch').forEach(btn => {
    btn.onclick = () => {
      setObjCtorColor(btn.dataset.color);
      if (
        objCtor.tool === 'erase' ||
        objCtor.tool === 'picker' ||
        objCtor.tool === 'measure'
      ) {
        objCtor.tool = document.getElementById('objPaintAsLine')?.checked
          ? 'line'
          : 'paint';
        document.querySelectorAll('#objCtorTools button').forEach(b => {
          b.classList.toggle('active-tool', b.dataset.oct === 'paint');
        });
      }
      deps.drawObjCtor();
    };
  });

  document.getElementById('objColorPicker')?.addEventListener(
    'input',
    e => setObjCtorColor(e.target.value)
  );
  document.getElementById('objColorHex')?.addEventListener('change', e => {
    let v = e.target.value.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(v))
      setObjCtorColor(v.startsWith('#') ? v : '#' + v);
  });

  document.getElementById('objPaintAsLine')?.addEventListener('change', () => {
    const el = document.getElementById('objPaintAsLine');
    if (objCtor.tool === 'paint' || objCtor.tool === 'line') {
      objCtor.tool = el?.checked ? 'line' : 'paint';
      objCtor.lineStart = null;
      deps.drawObjCtor();
    }
  });

  const setObjBrush = v => {
    v = Math.max(1, Math.min(300, parseInt(v) || 1));
    objCtor.brush = v;
    const a = document.getElementById('objBrushSize');
    const b = document.getElementById('objBrushSizeNum');
    const c = document.getElementById('objBrushSizeLabel');
    if (a) a.value = v;
    if (b) b.value = v;
    if (c) c.textContent = v + ' mm';
  };
  document.getElementById('objBrushSize')?.addEventListener('input', e =>
    setObjBrush(e.target.value)
  );
  document.getElementById('objBrushSizeNum')?.addEventListener('input', e => {
    const v = parseInt(e.target.value);
    if (!isNaN(v) && v >= 1 && v <= 300) setObjBrush(v);
  });

  const setObjGridLock = v => {
    v = Math.max(1, Math.min(50, parseInt(v) || 1));
    objCtor.gridLock = v;
    const sl = document.getElementById('objGridLock');
    const num = document.getElementById('objGridLockNum');
    const lab = document.getElementById('objGridLockLabel');
    if (sl) sl.value = v;
    if (num) num.value = v;
    if (lab) lab.textContent = v + ' mm';
    deps.drawObjCtor();
  };
  document.getElementById('objGridLock')?.addEventListener('input', e =>
    setObjGridLock(e.target.value)
  );
  document.getElementById('objGridLockNum')?.addEventListener('input', e => {
    const v = parseInt(e.target.value);
    if (!isNaN(v) && v >= 1 && v <= 50) setObjGridLock(v);
  });
  document.getElementById('objGridLockNum')?.addEventListener('change', e =>
    setObjGridLock(e.target.value)
  );

  document.getElementById('objBrushRound')?.addEventListener('click', () => {
    objCtor.shape = 'round';
    document.getElementById('objBrushRound')?.classList.add('active-tool');
    document.getElementById('objBrushSquare')?.classList.remove('active-tool');
  });
  document.getElementById('objBrushSquare')?.addEventListener('click', () => {
    objCtor.shape = 'square';
    document.getElementById('objBrushSquare')?.classList.add('active-tool');
    document.getElementById('objBrushRound')?.classList.remove('active-tool');
  });

  document.getElementById('btnObjCtorSave')?.addEventListener('click', () => {
    const name = document.getElementById('objCtorName')?.value || 'Meu Objeto';
    const raw = parseInt(document.getElementById('objCtorPoints')?.value, 10);
    const points = Number.isFinite(raw) ? raw : 0;
    saveObjFromBuffer(objCtor, sim, name, points, deps);
  });

  document.getElementById('btnObjCtorZoomIn')?.addEventListener('click', () =>
    deps.setObjCtorZoom(1.12)
  );
  document.getElementById('btnObjCtorZoomOut')?.addEventListener('click', () =>
    deps.setObjCtorZoom(1 / 1.12)
  );
  document.getElementById('btnObjCtorZoomFit')?.addEventListener('click', () => {
    deps.fitObjCtorCanvas();
    deps.drawObjCtor();
  });
}
