/**
 * Construtor de robô: corpo + detectores (não usa paint buffer).
 */
import { MM_TO_WORLD } from '../core/constants.js';

/** Estado inicial do construtor de robô. */
export function createRobotCtorState() {
  return {
    bodyW: 120,
    bodyH: 150,
    detectors: [],
    selectedId: null,
    scale: 1,
    ox: 0,
    oy: 0,
    dragging: null,
    editingIndex: null
  };
}

export function defaultRobotDef() {
  return {
    name: 'Robô padrão',
    body: { w: 120, h: 150 },
    detectors: [
      { id: 'line_left', name: 'line_left', kind: 'under', x: -25, y: 50, w: 12, h: 12 },
      { id: 'line_right', name: 'line_right', kind: 'under', x: 25, y: 50, w: 12, h: 12 },
      {
        id: 'front',
        name: 'front',
        kind: 'forward',
        shape: 'rect',
        offsetX: 0,
        offsetY: 75,
        length: 60,
        width: 50
      }
    ]
  };
}

function uidDet(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 7);
}

export function openRobotConstructorTab(robotCtor, deps) {
  document.getElementById('arena')?.classList.add('hidden');
  document.getElementById('arenaZoomBar')?.classList.add('hidden');
  document.getElementById('ctorCanvas')?.classList.add('hidden');
  document.getElementById('ctorZoomBar')?.classList.add('hidden');
  document.getElementById('objCtorCanvas')?.classList.add('hidden');
  document.getElementById('objCtorZoomBar')?.classList.add('hidden');
  const c = document.getElementById('robotCtorCanvas');
  const zb = document.getElementById('robotCtorZoomBar');
  if (c) c.classList.remove('hidden');
  if (zb) zb.classList.remove('hidden');
  const bw = document.getElementById('robotBodyW');
  const bh = document.getElementById('robotBodyH');
  if (bw) bw.value = robotCtor.bodyW;
  if (bh) bh.value = robotCtor.bodyH;
  if (!robotCtor.detectors.length) {
    const d = defaultRobotDef();
    robotCtor.bodyW = d.body.w;
    robotCtor.bodyH = d.body.h;
    robotCtor.detectors = JSON.parse(JSON.stringify(d.detectors));
    if (bw) bw.value = robotCtor.bodyW;
    if (bh) bh.value = robotCtor.bodyH;
    const nameEl = document.getElementById('robotDefName');
    if (nameEl) nameEl.value = d.name;
  }
  deps.fitRobotCtorCanvas();
  deps.refreshDetectorList();
  deps.drawRobotCtor();
}

export function closeRobotConstructorTab() {
  document.getElementById('robotCtorCanvas')?.classList.add('hidden');
  document.getElementById('robotCtorZoomBar')?.classList.add('hidden');
}

export function fitRobotCtorCanvas(robotCtor) {
  const canvas = document.getElementById('robotCtorCanvas');
  if (!canvas) return;
  const wrap = document.getElementById('canvasWrap');
  if (!wrap) return;
  const r = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(200, r.width - 16);
  const cssH = Math.max(200, r.height - 16);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  robotCtor.scale = Math.min(cssW, cssH) / 280;
  robotCtor.ox = cssW / 2;
  robotCtor.oy = cssH / 2;
}

export function drawRobotCtor(robotCtor) {
  const canvas = document.getElementById('robotCtorCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth,
    cssH = canvas.clientHeight;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.translate(robotCtor.ox, robotCtor.oy);
  ctx.scale(robotCtor.scale, -robotCtor.scale);

  ctx.strokeStyle = 'rgba(148,163,184,0.15)';
  ctx.lineWidth = 1 / robotCtor.scale;
  for (let i = -150; i <= 150; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, -150);
    ctx.lineTo(i, 150);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-150, i);
    ctx.lineTo(150, i);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(239,68,68,0.5)';
  ctx.beginPath();
  ctx.moveTo(0, -150);
  ctx.lineTo(0, 150);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(59,130,246,0.5)';
  ctx.beginPath();
  ctx.moveTo(-150, 0);
  ctx.lineTo(150, 0);
  ctx.stroke();

  const bw = robotCtor.bodyW,
    bh = robotCtor.bodyH;
  ctx.fillStyle = 'rgba(59,130,246,0.35)';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2 / robotCtor.scale;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#93c5fd';
  ctx.fillRect(-10, bh / 2 - 4, 20, 6);

  for (const d of robotCtor.detectors) {
    const sel = d.id === robotCtor.selectedId;
    if (d.kind === 'under') {
      ctx.fillStyle = sel ? 'rgba(34,197,94,0.55)' : 'rgba(34,197,94,0.3)';
      ctx.strokeStyle = sel ? '#fff' : '#22c55e';
      ctx.lineWidth = (sel ? 2.5 : 1.5) / robotCtor.scale;
      ctx.fillRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
      ctx.strokeRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
    } else {
      ctx.fillStyle = sel ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.28)';
      ctx.strokeStyle = sel ? '#fff' : '#f97316';
      ctx.lineWidth = (sel ? 2.5 : 1.5) / robotCtor.scale;
      const ox = d.offsetX || 0;
      const oy = d.offsetY != null ? d.offsetY : bh / 2;
      const len = d.length || 60,
        wid = d.width || 40;
      ctx.beginPath();
      if (d.shape === 'triangle') {
        ctx.moveTo(ox - wid / 2, oy);
        ctx.lineTo(ox + wid / 2, oy);
        ctx.lineTo(ox, oy + len);
        ctx.closePath();
      } else {
        ctx.rect(ox - wid / 2, oy, wid, len);
      }
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('+Y = frente · grade 10 mm', cssW / 2, 16);
  ctx.restore();
}

export function robotCtorPos(robotCtor, e) {
  const canvas = document.getElementById('robotCtorCanvas');
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const x = (sx - robotCtor.ox) / robotCtor.scale;
  const y = (sy - robotCtor.oy) / -robotCtor.scale;
  return { x, y };
}

export function hitDetector(robotCtor, p) {
  for (let i = robotCtor.detectors.length - 1; i >= 0; i--) {
    const d = robotCtor.detectors[i];
    if (d.kind === 'under') {
      if (Math.abs(p.x - d.x) <= d.w / 2 && Math.abs(p.y - d.y) <= d.h / 2) return d;
    } else {
      const ox = d.offsetX || 0;
      const oy = d.offsetY != null ? d.offsetY : robotCtor.bodyH / 2;
      const len = d.length || 60,
        wid = d.width || 40;
      if (p.x >= ox - wid / 2 && p.x <= ox + wid / 2 && p.y >= oy && p.y <= oy + len)
        return d;
    }
  }
  return null;
}

export function refreshDetectorList(robotCtor, deps) {
  const el = document.getElementById('detectorList');
  if (!el) return;
  if (!robotCtor.detectors.length) {
    el.innerHTML = '<span style="color:var(--muted)">Nenhum detector.</span>';
    const de = document.getElementById('detectorEdit');
    if (de) de.innerHTML = 'Nenhum selecionado.';
    return;
  }
  el.innerHTML = robotCtor.detectors
    .map(d => {
      const sel = d.id === robotCtor.selectedId ? ' active-tool' : '';
      const kind = d.kind === 'under' ? 'solo' : `frente/${d.shape || 'rect'}`;
      return `<button class="${sel}" data-det="${d.id}" style="width:100%;text-align:left;margin-bottom:0.2rem">${d.name} <span style="color:var(--muted)">(${kind})</span></button>`;
    })
    .join('');
  el.querySelectorAll('button[data-det]').forEach(btn => {
    btn.onclick = () => {
      robotCtor.selectedId = btn.dataset.det;
      refreshDetectorList(robotCtor, deps);
      refreshDetectorEdit(robotCtor, deps);
      deps.drawRobotCtor();
    };
  });
  refreshDetectorEdit(robotCtor, deps);
}

export function refreshDetectorEdit(robotCtor, deps) {
  const box = document.getElementById('detectorEdit');
  const d = robotCtor.detectors.find(x => x.id === robotCtor.selectedId);
  if (!box) return;
  if (!d) {
    box.innerHTML = 'Nenhum selecionado.';
    return;
  }
  if (d.kind === 'under') {
    box.innerHTML = `
      <label>Nome</label><input type="text" id="detName" value="${d.name}">
      <label>X (mm)</label><input type="number" id="detX" value="${d.x}">
      <label>Y (mm)</label><input type="number" id="detY" value="${d.y}">
      <label>Largura</label><input type="number" id="detW" value="${d.w}">
      <label>Altura</label><input type="number" id="detH" value="${d.h}">
      <button id="btnDelDet" class="danger" style="width:100%;margin-top:0.35rem">Excluir</button>`;
  } else {
    box.innerHTML = `
      <label>Nome</label><input type="text" id="detName" value="${d.name}">
      <label>Forma</label>
      <select id="detShape"><option value="rect" ${d.shape !== 'triangle' ? 'selected' : ''}>Retângulo</option><option value="triangle" ${d.shape === 'triangle' ? 'selected' : ''}>Triângulo</option></select>
      <label>Offset X (mm)</label><input type="number" id="detOX" value="${d.offsetX || 0}">
      <label>Offset Y (mm)</label><input type="number" id="detOY" value="${d.offsetY != null ? d.offsetY : robotCtor.bodyH / 2}">
      <label>Alcance</label><input type="number" id="detLen" value="${d.length || 60}">
      <label>Largura</label><input type="number" id="detWid" value="${d.width || 40}">
      <button id="btnDelDet" class="danger" style="width:100%;margin-top:0.35rem">Excluir</button>`;
  }
  const bind = (id, fn) => {
    const n = document.getElementById(id);
    if (n)
      n.onchange = n.oninput = () => {
        fn(n);
        deps.drawRobotCtor();
        refreshDetectorList(robotCtor, deps);
      };
  };
  bind('detName', n => {
    d.name = n.value || d.id;
  });
  if (d.kind === 'under') {
    bind('detX', n => {
      d.x = parseFloat(n.value) || 0;
    });
    bind('detY', n => {
      d.y = parseFloat(n.value) || 0;
    });
    bind('detW', n => {
      d.w = Math.max(2, parseFloat(n.value) || 10);
    });
    bind('detH', n => {
      d.h = Math.max(2, parseFloat(n.value) || 10);
    });
  } else {
    bind('detShape', n => {
      d.shape = n.value;
    });
    bind('detOX', n => {
      d.offsetX = parseFloat(n.value) || 0;
    });
    bind('detOY', n => {
      d.offsetY = parseFloat(n.value) || 0;
    });
    bind('detLen', n => {
      d.length = Math.max(4, parseFloat(n.value) || 60);
    });
    bind('detWid', n => {
      d.width = Math.max(4, parseFloat(n.value) || 40);
    });
  }
  const del = document.getElementById('btnDelDet');
  if (del)
    del.onclick = () => {
      robotCtor.detectors = robotCtor.detectors.filter(x => x.id !== d.id);
      robotCtor.selectedId = null;
      refreshDetectorList(robotCtor, deps);
      deps.drawRobotCtor();
    };
}

export function currentRobotDefFromCtor(robotCtor) {
  return {
    name: document.getElementById('robotDefName')?.value || 'Meu Robô',
    body: { w: robotCtor.bodyW, h: robotCtor.bodyH },
    detectors: JSON.parse(JSON.stringify(robotCtor.detectors))
  };
}

/**
 * @param {object} sim
 * @param {object} def
 * @param {{ logUI: Function, draw: Function }} deps
 */
export function applyRobotDefToSim(sim, def, deps) {
  sim.activeRobotDef = JSON.parse(JSON.stringify(def));
  if (sim.robot) {
    sim.robot.definition = sim.activeRobotDef;
    sim.robot.width = (def.body.w || 120) * MM_TO_WORLD;
    sim.robot.height = (def.body.h || 150) * MM_TO_WORLD;
  }
  deps.logUI({
    t: 0,
    msg: `Robô "${def.name}" ativo (${def.detectors.length} detectores).`,
    category: 'success'
  });
  deps.draw();
}

export function refreshRobotLibrary(sim, robotCtor, deps) {
  const el = document.getElementById('robotLibrary');
  if (!el) return;
  if (!sim.robotLibrary.length) {
    el.textContent = 'Nenhum ainda.';
    return;
  }
  el.innerHTML = sim.robotLibrary
    .map(
      (r, i) =>
        `<div class="lib-item"><span><strong>${r.name}</strong> — ${r.detectors?.length || 0} det.</span>
      <span style="display:flex;gap:0.25rem">
        <button data-rload="${i}" class="primary">Carregar</button>
        <button data-ruse="${i}">Usar</button>
        <button data-rdel="${i}" class="danger">Excluir</button>
      </span></div>`
    )
    .join('');
  el.querySelectorAll('[data-rload]').forEach(btn => {
    btn.onclick = () => {
      const r = sim.robotLibrary[parseInt(btn.dataset.rload)];
      if (!r) return;
      robotCtor.bodyW = r.body.w;
      robotCtor.bodyH = r.body.h;
      robotCtor.detectors = JSON.parse(JSON.stringify(r.detectors || []));
      robotCtor.selectedId = null;
      robotCtor.editingIndex = parseInt(btn.dataset.rload);
      const nameEl = document.getElementById('robotDefName');
      if (nameEl) nameEl.value = r.name;
      const bw = document.getElementById('robotBodyW');
      const bh = document.getElementById('robotBodyH');
      if (bw) bw.value = r.body.w;
      if (bh) bh.value = r.body.h;
      deps.refreshDetectorList();
      deps.drawRobotCtor();
    };
  });
  el.querySelectorAll('[data-ruse]').forEach(btn => {
    btn.onclick = () =>
      deps.applyRobotDefToSim(sim.robotLibrary[parseInt(btn.dataset.ruse)]);
  });
  el.querySelectorAll('[data-rdel]').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.rdel);
      if (!confirm('Excluir robô?')) return;
      sim.robotLibrary.splice(i, 1);
      deps.persist('obr_robot_library', sim.robotLibrary);
      refreshRobotLibrary(sim, robotCtor, deps);
    };
  });
}

/**
 * Liga canvas (drag de detectores) e botões da UI.
 * @param {object} robotCtor
 * @param {object} sim
 * @param {object} deps
 */
export function wireRobotConstructor(robotCtor, sim, deps) {
  document.getElementById('btnAddUnderDet')?.addEventListener('click', () => {
    const id = uidDet('under');
    robotCtor.detectors.push({ id, name: id, kind: 'under', x: 0, y: 40, w: 14, h: 14 });
    robotCtor.selectedId = id;
    deps.refreshDetectorList();
    deps.drawRobotCtor();
  });
  document.getElementById('btnAddForwardRect')?.addEventListener('click', () => {
    const id = uidDet('front');
    robotCtor.detectors.push({
      id,
      name: id,
      kind: 'forward',
      shape: 'rect',
      offsetX: 0,
      offsetY: robotCtor.bodyH / 2,
      length: 60,
      width: 50
    });
    robotCtor.selectedId = id;
    deps.refreshDetectorList();
    deps.drawRobotCtor();
  });
  document.getElementById('btnAddForwardTri')?.addEventListener('click', () => {
    const id = uidDet('front');
    robotCtor.detectors.push({
      id,
      name: id,
      kind: 'forward',
      shape: 'triangle',
      offsetX: 0,
      offsetY: robotCtor.bodyH / 2,
      length: 70,
      width: 50
    });
    robotCtor.selectedId = id;
    deps.refreshDetectorList();
    deps.drawRobotCtor();
  });

  ['robotBodyW', 'robotBodyH'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onchange = el.oninput = () => {
      robotCtor.bodyW = Math.max(
        40,
        parseInt(document.getElementById('robotBodyW')?.value) || 120
      );
      robotCtor.bodyH = Math.max(
        40,
        parseInt(document.getElementById('robotBodyH')?.value) || 150
      );
      deps.drawRobotCtor();
    };
  });

  const canvas = document.getElementById('robotCtorCanvas');
  if (canvas) {
    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const p = robotCtorPos(robotCtor, e);
      const hit = hitDetector(robotCtor, p);
      if (hit) {
        robotCtor.selectedId = hit.id;
        robotCtor.dragging = {
          id: hit.id,
          ox: p.x - (hit.kind === 'under' ? hit.x : hit.offsetX || 0),
          oy:
            p.y -
            (hit.kind === 'under'
              ? hit.y
              : hit.offsetY != null
                ? hit.offsetY
                : robotCtor.bodyH / 2)
        };
        deps.refreshDetectorList();
        deps.drawRobotCtor();
      }
    });
    window.addEventListener('mousemove', e => {
      if (!robotCtor.dragging || sim.mode !== 'robot') return;
      const p = robotCtorPos(robotCtor, e);
      const d = robotCtor.detectors.find(x => x.id === robotCtor.dragging.id);
      if (!d) return;
      if (d.kind === 'under') {
        d.x = Math.round(p.x - robotCtor.dragging.ox);
        d.y = Math.round(p.y - robotCtor.dragging.oy);
      } else {
        d.offsetX = Math.round(p.x - robotCtor.dragging.ox);
        d.offsetY = Math.round(p.y - robotCtor.dragging.oy);
      }
      refreshDetectorEdit(robotCtor, deps);
      deps.drawRobotCtor();
    });
    window.addEventListener('mouseup', () => {
      robotCtor.dragging = null;
    });
  }

  document.getElementById('btnRobotSave')?.addEventListener('click', () => {
    const def = currentRobotDefFromCtor(robotCtor);
    if (
      robotCtor.editingIndex != null &&
      robotCtor.editingIndex >= 0 &&
      robotCtor.editingIndex < sim.robotLibrary.length
    ) {
      sim.robotLibrary[robotCtor.editingIndex] = def;
      robotCtor.editingIndex = null;
    } else sim.robotLibrary.push(def);
    deps.persist('obr_robot_library', sim.robotLibrary);
    deps.refreshRobotLibrary();
    deps.logUI({
      t: 0,
      msg: `Robô "${def.name}" salvo na biblioteca.`,
      category: 'success'
    });
  });
  document.getElementById('btnRobotApply')?.addEventListener('click', () => {
    deps.applyRobotDefToSim(currentRobotDefFromCtor(robotCtor));
  });
}
