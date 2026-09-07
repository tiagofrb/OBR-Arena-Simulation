/**
 * Paleta de ladrilhos custom + preview hover.
 * Preview de tipos builtin usado por hover e drag.
 */

/**
 * Desenha miniatura de um tipo de ladrilho (ou custom) no canvas dado.
 * @param {HTMLCanvasElement} cnv
 * @param {string} type
 * @param {object|null} customDef
 */
export function renderTilePreviewToCanvas(cnv, type, customDef) {
  const S = cnv.width;
  const pctx = cnv.getContext('2d');
  pctx.clearRect(0, 0, S, S);
  if (type === 'erase') {
    pctx.fillStyle = '#1a232e';
    pctx.fillRect(0, 0, S, S);
    pctx.strokeStyle = '#576573';
    pctx.lineWidth = Math.max(1, S * 0.03);
    pctx.beginPath();
    pctx.moveTo(S * 0.28, S * 0.28);
    pctx.lineTo(S * 0.72, S * 0.72);
    pctx.moveTo(S * 0.72, S * 0.28);
    pctx.lineTo(S * 0.28, S * 0.72);
    pctx.stroke();
    return;
  }
  if (type === 'custom' && customDef) {
    pctx.fillStyle = '#e2e8f0';
    pctx.fillRect(0, 0, S, S);
    if (customDef.bitmap) {
      const img = new Image();
      img.onload = () => {
        pctx.imageSmoothingEnabled = false;
        pctx.drawImage(img, 0, 0, S, S);
      };
      img.src = customDef.bitmap;
    } else {
      pctx.fillStyle = '#64748b';
      pctx.font = `${Math.round(S * 0.1)}px sans-serif`;
      pctx.textAlign = 'center';
      pctx.fillText(customDef.name || 'custom', S / 2, S / 2);
    }
    return;
  }
  pctx.fillStyle = '#f1f5f9';
  pctx.strokeStyle = '#cbd5e1';
  pctx.lineWidth = 1;
  pctx.fillRect(0, 0, S, S);
  pctx.strokeRect(0, 0, S, S);
  const hLineP = () => {
    pctx.strokeStyle = '#1e293b';
    pctx.lineWidth = S * 0.055;
    pctx.lineCap = 'round';
    pctx.beginPath();
    pctx.moveTo(S * 0.07, S / 2);
    pctx.lineTo(S * 0.93, S / 2);
    pctx.stroke();
  };
  switch (type) {
    case 'start':
      hLineP();
      pctx.fillStyle = '#22c55e';
      pctx.beginPath();
      pctx.arc(S / 2, S * 0.7, S * 0.09, 0, Math.PI * 2);
      pctx.fill();
      break;
    case 'finish':
      hLineP();
      pctx.fillStyle = '#ef4444';
      pctx.fillRect(S * 0.11, S / 2 - S * 0.06, S * 0.78, S * 0.12);
      break;
    case 'straight':
      hLineP();
      break;
    case 'curve90':
      pctx.strokeStyle = '#1e293b';
      pctx.lineWidth = S * 0.055;
      pctx.lineCap = 'round';
      pctx.beginPath();
      pctx.moveTo(S * 0.07, S / 2);
      pctx.lineTo(S / 2, S / 2);
      pctx.lineTo(S / 2, S * 0.07);
      pctx.stroke();
      break;
    case 'gap':
      pctx.strokeStyle = '#1e293b';
      pctx.lineWidth = S * 0.055;
      pctx.beginPath();
      pctx.moveTo(S * 0.08, S / 2);
      pctx.lineTo(S * 0.38, S / 2);
      pctx.moveTo(S * 0.62, S / 2);
      pctx.lineTo(S * 0.92, S / 2);
      pctx.stroke();
      pctx.fillStyle = 'rgba(168,85,247,0.3)';
      pctx.fillRect(S * 0.38, S * 0.4, S * 0.24, S * 0.2);
      break;
    case 'checkpoint':
      hLineP();
      pctx.fillStyle = '#f97316';
      pctx.beginPath();
      pctx.arc(S / 2, S * 0.7, S * 0.1, 0, Math.PI * 2);
      pctx.fill();
      break;
    case 'intersection':
      pctx.strokeStyle = '#1e293b';
      pctx.lineWidth = S * 0.055;
      pctx.beginPath();
      pctx.moveTo(S * 0.08, S / 2);
      pctx.lineTo(S * 0.92, S / 2);
      pctx.moveTo(S / 2, S * 0.08);
      pctx.lineTo(S / 2, S * 0.92);
      pctx.stroke();
      pctx.fillStyle = '#22c55e';
      pctx.fillRect(S / 2 - S * 0.2, S / 2 - S * 0.2, S * 0.15, S * 0.15);
      break;
    case 'intersection_t':
      pctx.strokeStyle = '#1e293b';
      pctx.lineWidth = S * 0.055;
      pctx.beginPath();
      pctx.moveTo(S * 0.08, S / 2);
      pctx.lineTo(S * 0.92, S / 2);
      pctx.moveTo(S / 2, S / 2);
      pctx.lineTo(S / 2, S * 0.92);
      pctx.stroke();
      break;
    case 'lombada':
      hLineP();
      pctx.fillStyle = '#94a3b8';
      for (let i = 0; i < 3; i++) {
        pctx.beginPath();
        pctx.ellipse(S * 0.28 + i * S * 0.2, S / 2, S * 0.08, S * 0.045, 0, 0, Math.PI * 2);
        pctx.fill();
      }
      break;
    case 'deadend':
      hLineP();
      pctx.fillStyle = '#1e293b';
      pctx.fillRect(S / 2 - S * 0.05, S * 0.12, S * 0.1, S * 0.4);
      break;
    case 'rescue_entry':
      pctx.fillStyle = '#e2e8f0';
      pctx.fillRect(0, 0, S, S);
      pctx.fillStyle = '#94a3b8';
      pctx.fillRect(S - S * 0.13, S * 0.1, S * 0.09, S * 0.8);
      break;
    case 'rescue_green':
      pctx.fillStyle = '#e2e8f0';
      pctx.fillRect(0, 0, S, S);
      pctx.fillStyle = '#22c55e';
      pctx.beginPath();
      pctx.moveTo(0, 0);
      pctx.lineTo(S * 0.55, 0);
      pctx.lineTo(0, S * 0.55);
      pctx.closePath();
      pctx.fill();
      break;
    case 'rescue_red':
      pctx.fillStyle = '#e2e8f0';
      pctx.fillRect(0, 0, S, S);
      pctx.fillStyle = '#ef4444';
      pctx.beginPath();
      pctx.moveTo(S, 0);
      pctx.lineTo(S * 0.45, 0);
      pctx.lineTo(S, S * 0.55);
      pctx.closePath();
      pctx.fill();
      break;
    case 'rescue_exit':
      pctx.fillStyle = '#e2e8f0';
      pctx.fillRect(0, 0, S, S);
      pctx.fillStyle = '#1e293b';
      pctx.fillRect(S * 0.04, S * 0.1, S * 0.09, S * 0.8);
      break;
    default:
      pctx.fillStyle = '#64748b';
      pctx.fillRect(S * 0.3, S * 0.3, S * 0.4, S * 0.4);
  }
}

/**
 * @param {HTMLElement} btn
 * @param {{ pop: HTMLElement, canvas: HTMLCanvasElement, cap: HTMLElement }} previewEls
 */
export function positionTilePreview(btn, previewEls) {
  const r = btn.getBoundingClientRect();
  const popW = 140,
    popH = 170;
  let left = r.left - popW - 10;
  if (left < 8) left = r.right + 10;
  let top = r.top;
  if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
  previewEls.pop.style.left = left + 'px';
  previewEls.pop.style.top = Math.max(8, top) + 'px';
}

/**
 * @param {HTMLElement} btn
 * @param {string} type
 * @param {object|null} customDef
 * @param {string} label
 * @param {{ pop: HTMLElement|null, canvas: HTMLCanvasElement|null, cap: HTMLElement|null }} previewEls
 */
export function attachTilePreviewHover(btn, type, customDef, label, previewEls) {
  btn.addEventListener('mouseenter', () => {
    if (!previewEls.pop || !previewEls.canvas || !previewEls.cap) return;
    renderTilePreviewToCanvas(previewEls.canvas, type, customDef);
    previewEls.cap.textContent = label;
    previewEls.pop.classList.add('show');
    positionTilePreview(btn, previewEls);
  });
  btn.addEventListener('mouseleave', () => {
    if (previewEls.pop) previewEls.pop.classList.remove('show');
  });
}

/**
 * Renderiza a seção de ladrilhos custom na paleta do editor.
 * @param {object} sim
 * @param {object} deps
 * @param {{ pop: HTMLElement|null, canvas: HTMLCanvasElement|null, cap: HTMLElement|null }} deps.previewEls
 * @param {(type: string, idx?: number) => void} deps.selectTileTool
 * @param {() => void} deps.clearTileSelection
 * @param {(key: string, value: *) => void} deps.persist
 * @param {() => void} deps.refreshCustomSelect
 * @param {(payload: object) => void} deps.setDragPayload
 * @param {Function} deps.showTileDragPreview
 * @param {Function} deps.hideTileDragPreview
 */
export function renderTilePalette(sim, deps) {
  const wrap = document.getElementById('tileTools');
  if (!wrap) return;
  const prevSelected = sim.selectedTool;
  const prevCustomIdx = sim.placingCustomId;
  wrap.innerHTML = '';

  const makeSwatchCanvas = () => {
    const c = document.createElement('canvas');
    c.width = 44;
    c.height = 44;
    return c;
  };

  if (!sim.customLibrary.length) {
    const empty = document.createElement('p');
    empty.className = 'key-hint';
    empty.textContent = sim.customMode
      ? 'Nenhum ladrilho custom. Crie no Construtor de ladrilho.'
      : 'Ative Modo Custom e crie ladrilhos no Construtor.';
    wrap.appendChild(empty);
    return;
  }

  const label = document.createElement('div');
  label.className = 'tile-section-label';
  label.textContent = sim.customMode
    ? 'Criados no app'
    : 'Bloqueados (ative Modo Custom)';
  wrap.appendChild(label);

  sim.customLibrary.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'tile-btn';
    btn.dataset.type = 'custom';
    btn.dataset.customidx = i;
    btn.dataset.dragKind = 'custom';
    btn.title = c.name || 'custom ' + i;
    if (!sim.customMode) {
      btn.disabled = true;
      btn.style.opacity = '0.45';
      btn.title = 'Disponível apenas no Modo Custom';
      btn.draggable = false;
    } else {
      btn.draggable = true;
    }
    const sw = document.createElement('span');
    sw.className = 'swatch';
    const cnv = makeSwatchCanvas();
    renderTilePreviewToCanvas(cnv, 'custom', c);
    sw.appendChild(cnv);
    const del = document.createElement('button');
    del.className = 'del-x';
    del.textContent = '✕';
    del.title = 'Excluir ladrilho personalizado';
    del.onclick = ev => {
      ev.stopPropagation();
      if (confirm(`Excluir "${c.name}"?`)) {
        sim.customLibrary.splice(i, 1);
        deps.persist('obr_custom_tiles', sim.customLibrary);
        if (sim.selectedTool === 'custom' && sim.placingCustomId === i) {
          deps.clearTileSelection();
        }
        deps.refreshCustomSelect();
      }
    };
    btn.appendChild(sw);
    btn.appendChild(del);
    btn.onclick = () => deps.selectTileTool('custom', i);
    attachTilePreviewHover(
      btn,
      'custom',
      c,
      `${c.name} — custom`,
      deps.previewEls
    );
    if (sim.customMode) {
      btn.addEventListener('dragstart', ev => {
        const payload = { kind: 'custom', idx: i };
        deps.setDragPayload(payload);
        ev.dataTransfer.setData('application/x-obr-tile', JSON.stringify(payload));
        ev.dataTransfer.effectAllowed = 'copy';
        try {
          const empty = document.createElement('canvas');
          empty.width = 1;
          empty.height = 1;
          ev.dataTransfer.setDragImage(empty, 0, 0);
        } catch (_) { /* ignore */ }
        btn.classList.add('drag-ghost');
        deps.showTileDragPreview(ev.clientX, ev.clientY, payload, false);
      });
      btn.addEventListener('dragend', () => {
        btn.classList.remove('drag-ghost');
        deps.hideTileDragPreview();
      });
    }
    wrap.appendChild(btn);
  });

  if (
    prevSelected === 'custom' &&
    prevCustomIdx != null &&
    sim.customLibrary[prevCustomIdx] &&
    sim.customMode
  ) {
    deps.selectTileTool('custom', prevCustomIdx);
  }
}
