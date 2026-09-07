/**
 * Renderização da arena (grid, tiles, objetos, robô, medição, seleção).
 * Recebe ctx/cam/sim e deps injetadas para evitar acoplamento com main.js.
 */

import { TILE_PX, LINE_W } from '../core/constants.js';
import { TileType, transformPoint } from '../engine/Models.js';
import { tileIsStart, tileIsFinish, tileIsCheckpoint } from '../editor/EditorTools.js';

/**
 * @typedef {Object} RenderDeps
 * @property {function} [requestRedraw] - chamado quando imagem assíncrona carrega
 * @property {function} [getCachedOfficialImage]
 * @property {function} [preloadOfficialImage]
 */

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function hLine(ctx, S) {
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = LINE_W;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(5, S / 2);
  ctx.lineTo(S - 5, S / 2);
  ctx.stroke();
}

export function drawArenaObject(ctx, cam, o, deps = {}) {
  const cx = o.gx * TILE_PX + TILE_PX / 2;
  const cy = o.gy * TILE_PX + TILE_PX / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((o.rotation || 0) * Math.PI) / 180);
  if (o.mirrorH) ctx.scale(-1, 1);
  if (o.mirrorV) ctx.scale(1, -1);

  if (o.type === 'custom' && o.custom && o.custom.bitmap) {
    const token = o.custom._instanceId || o.custom.bitmap;
    if (!o._img || o._imgSrc !== o.custom.bitmap || o._imgToken !== token) {
      o._img = new Image();
      o._imgSrc = o.custom.bitmap;
      o._imgToken = token;
      o._img.src = o.custom.bitmap;
      o._img.onload = () => { if (deps.requestRedraw) deps.requestRedraw(); };
    }
    const s = TILE_PX * 0.85;
    ctx.imageSmoothingEnabled = false;
    if (o._img.complete && o._img.naturalWidth > 0) ctx.drawImage(o._img, -s / 2, -s / 2, s, s);
    ctx.restore();
    return;
  }

  if (o.type === 'obstacle') {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-11, -20, 22, 40);
  } else if (o.type === 'gangorra') {
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.moveTo(-22, 10); ctx.lineTo(0, -16); ctx.lineTo(22, 10);
    ctx.closePath(); ctx.fill();
  } else if (o.type === 'rampa') {
    ctx.fillStyle = 'rgba(251,146,60,0.75)';
    ctx.beginPath();
    ctx.moveTo(-24, 12); ctx.lineTo(24, -12); ctx.lineTo(24, 12);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function drawTileMarkers(ctx, cam, t) {
  if (!tileIsStart(t) && !tileIsFinish(t) && !tileIsCheckpoint(t)) return;
  const x = t.worldX, y = t.worldY, S = TILE_PX;
  ctx.save();
  let ox = 4;
  if (tileIsStart(t)) {
    ctx.fillStyle = 'rgba(34,197,94,0.92)';
    ctx.fillRect(x + ox, y + 4, 22, 12);
    ctx.fillStyle = '#fff';
    ctx.font = `${8 / cam.scale}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('START', x + ox + 2, y + 13);
    ox += 26;
  }
  if (tileIsFinish(t)) {
    ctx.fillStyle = 'rgba(239,68,68,0.92)';
    ctx.fillRect(x + ox, y + 4, 28, 12);
    ctx.fillStyle = '#fff';
    ctx.font = `${8 / cam.scale}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('CHEG', x + ox + 2, y + 13);
    ox += 32;
  }
  if (tileIsCheckpoint(t)) {
    ctx.fillStyle = 'rgba(249,115,22,0.92)';
    ctx.beginPath();
    ctx.arc(x + S - 12, y + S - 12, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `${8 / cam.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('CP', x + S - 12, y + S - 9);
  }
  ctx.restore();
}

export function drawCustom(ctx, cam, t, ox, oy, deps = {}) {
  const def = t.custom;
  if (def && def.bitmap) {
    const token = def._instanceId || def.bitmap;
    if (!t._img || t._imgSrc !== def.bitmap || t._imgToken !== token) {
      t._img = new Image();
      t._imgSrc = def.bitmap;
      t._imgToken = token;
      t._img.src = def.bitmap;
      t._img.onload = () => { if (deps.requestRedraw) deps.requestRedraw(); };
    }
    ctx.save();
    ctx.translate(ox + TILE_PX / 2, oy + TILE_PX / 2);
    ctx.rotate((t.rotation * Math.PI) / 180);
    if (t.mirrorH) ctx.scale(-1, 1);
    if (t.mirrorV) ctx.scale(1, -1);
    ctx.imageSmoothingEnabled = false;
    if (t._img.complete && t._img.naturalWidth > 0) {
      ctx.drawImage(t._img, -TILE_PX / 2, -TILE_PX / 2, TILE_PX, TILE_PX);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-TILE_PX / 2, -TILE_PX / 2, TILE_PX, TILE_PX);
      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(def.name || 'custom', 0, 4);
    }
    ctx.restore();
    return;
  }
  if (def && def.lines) {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = LINE_W;
    ctx.lineCap = 'round';
    for (const line of def.lines) {
      if (line.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < line.length; i++) {
        const p = transformPoint(line[i].x, line[i].y, t.rotation, t.mirrorH, t.mirrorV);
        const px = ox + p.x * TILE_PX, py = oy + p.y * TILE_PX;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  if (def && def.objects) {
    for (const obj of def.objects) {
      const p = transformPoint(obj.x + obj.w / 2, obj.y + obj.h / 2, t.rotation, t.mirrorH, t.mirrorV);
      const pw = obj.w * TILE_PX, ph = obj.h * TILE_PX;
      if (obj.type === 'green') ctx.fillStyle = '#22c55e';
      else if (obj.type === 'gap') ctx.fillStyle = 'rgba(168,85,247,0.4)';
      else ctx.fillStyle = '#64748b';
      ctx.fillRect(ox + p.x * TILE_PX - pw / 2, oy + p.y * TILE_PX - ph / 2, pw, ph);
    }
  }
  if (def && def.zones) {
    ctx.fillStyle = 'rgba(34,197,94,0.25)';
    ctx.strokeStyle = 'rgba(34,197,94,0.7)';
    ctx.lineWidth = 1.5;
    for (const z of def.zones) {
      const p = transformPoint(z.x + z.w / 2, z.y + z.h / 2, t.rotation, t.mirrorH, t.mirrorV);
      const pw = z.w * TILE_PX, ph = z.h * TILE_PX;
      ctx.fillRect(ox + p.x * TILE_PX - pw / 2, oy + p.y * TILE_PX - ph / 2, pw, ph);
      ctx.strokeRect(ox + p.x * TILE_PX - pw / 2, oy + p.y * TILE_PX - ph / 2, pw, ph);
    }
  }
}

function paintBuiltinTile(ctx, t) {
  const S = TILE_PX;
  switch (t.type) {
    case TileType.START:
      hLine(ctx, S); ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(S / 2, S / 2 + 14, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#166534'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('START', S / 2, 12);
      break;
    case TileType.FINISH:
      hLine(ctx, S); ctx.fillStyle = '#ef4444'; ctx.fillRect(8, S / 2 - 4, S - 16, 8);
      ctx.fillStyle = '#991b1b'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CHEGADA', S / 2, 12);
      break;
    case TileType.STRAIGHT: hLine(ctx, S); break;
    case TileType.CURVE90:
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = LINE_W; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(5, S / 2); ctx.lineTo(S / 2, S / 2); ctx.lineTo(S / 2, 5); ctx.stroke();
      break;
    case TileType.OBSTACLE:
      hLine(ctx, S); ctx.fillStyle = '#64748b'; ctx.fillRect(S / 2 - 11, S / 2 - 20, 22, 40); break;
    case TileType.GAP:
      hLine(ctx, S); ctx.fillStyle = 'rgba(168,85,247,0.45)'; ctx.fillRect(S / 2 - 14, S / 2 - 10, 28, 20); break;
    case TileType.LOMBADA:
      hLine(ctx, S); ctx.fillStyle = '#a8a29e';
      ctx.beginPath(); ctx.ellipse(S / 2, S / 2, 18, 10, 0, 0, Math.PI * 2); ctx.fill(); break;
    case TileType.GANGORRA:
      hLine(ctx, S); ctx.fillStyle = '#78716c';
      ctx.beginPath(); ctx.moveTo(10, S / 2 + 8); ctx.lineTo(S / 2, S / 2 - 14); ctx.lineTo(S - 10, S / 2 + 8); ctx.closePath(); ctx.fill();
      break;
    case TileType.RAMPA:
      hLine(ctx, S); ctx.fillStyle = 'rgba(251,146,60,0.4)';
      ctx.beginPath(); ctx.moveTo(8, S / 2 + 10); ctx.lineTo(S - 8, S / 2 - 10); ctx.lineTo(S - 8, S / 2 + 10); ctx.closePath(); ctx.fill();
      break;
    case TileType.INTERSECTION:
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = LINE_W;
      ctx.beginPath(); ctx.moveTo(6, S / 2); ctx.lineTo(S - 6, S / 2); ctx.moveTo(S / 2, 6); ctx.lineTo(S / 2, S - 6); ctx.stroke();
      ctx.fillStyle = '#22c55e'; ctx.fillRect(S / 2 - 16, S / 2 - 16, 11, 11); break;
    case TileType.INTERSECTION_T:
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = LINE_W;
      ctx.beginPath(); ctx.moveTo(6, S / 2); ctx.lineTo(S - 6, S / 2); ctx.moveTo(S / 2, S / 2); ctx.lineTo(S / 2, S - 6); ctx.stroke();
      break;
    case TileType.DEADEND:
      hLine(ctx, S); ctx.fillStyle = '#1e293b'; ctx.fillRect(S / 2 - 4, 10, 8, S / 2 - 10); break;
    case TileType.CHECKPOINT:
      hLine(ctx, S); ctx.fillStyle = '#f97316';
      ctx.beginPath(); ctx.arc(S / 2, S / 2 + 14, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9a3412'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CP', S / 2, 12); break;
    case TileType.RESCUE_ENTRY:
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(S - 9, 8, 7, S - 16);
      ctx.fillStyle = '#64748b'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ENTRADA', S / 2, S / 2); break;
    case TileType.RESCUE:
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, S, S); break;
    case TileType.RESCUE_GREEN:
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(40, 0); ctx.lineTo(0, 40); ctx.closePath(); ctx.fill();
      break;
    case TileType.RESCUE_RED:
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(S, 0); ctx.lineTo(S - 40, 0); ctx.lineTo(S, 40); ctx.closePath(); ctx.fill();
      break;
    case TileType.RESCUE_EXIT:
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(2, 8, 7, S - 16);
      ctx.fillStyle = '#64748b'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SAÍDA', S / 2, S / 2); break;
  }
}

export function drawTile(ctx, cam, sim, t, deps = {}) {
  const x = t.worldX, y = t.worldY, cx = x + TILE_PX / 2, cy = y + TILE_PX / 2;

  if (!sim.customMode && t.opts && t.opts.officialImage) {
    const getImg = deps.getCachedOfficialImage;
    const preload = deps.preloadOfficialImage;
    const img = getImg ? getImg(t.opts.officialImage) : null;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((t.rotation * Math.PI) / 180);
      if (t.mirrorH) ctx.scale(-1, 1);
      if (t.mirrorV) ctx.scale(1, -1);
      ctx.drawImage(img, -TILE_PX / 2, -TILE_PX / 2, TILE_PX, TILE_PX);
      ctx.restore();
      drawTileMarkers(ctx, cam, t);
      return;
    }
    if (img && !img.complete) {
      img.onload = () => { if (deps.requestRedraw) deps.requestRedraw(); };
    } else if (!img && preload) {
      preload(t.opts.officialImage);
    }
  }

  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1 / cam.scale;
  ctx.fillRect(x, y, TILE_PX, TILE_PX);
  ctx.strokeRect(x, y, TILE_PX, TILE_PX);

  if (t.type === TileType.CUSTOM && t.custom) {
    drawCustom(ctx, cam, t, x, y, deps);
    ctx.fillStyle = 'rgba(59,130,246,0.85)';
    ctx.font = `${9 / cam.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('CUSTOM', cx, y + 11);
    drawTileMarkers(ctx, cam, t);
    return;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.mirrorH) ctx.scale(-1, 1);
  if (t.mirrorV) ctx.scale(1, -1);
  ctx.translate(-TILE_PX / 2, -TILE_PX / 2);
  paintBuiltinTile(ctx, t);
  ctx.restore();
  drawTileMarkers(ctx, cam, t);
}

/**
 * Desenha detector no referencial do robô (ctx já traduzido/rotacionado).
 * +Y no construtor = frente; no sprite visual a frente é -Y.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} cam
 * @param {object} d - detector
 * @param {number} mm - px por mm
 * @param {object} [activeDef] - definição ativa (para comprimento default do forward)
 */
export function drawDetectorOnRobot(ctx, cam, d, mm, activeDef = null) {
  ctx.save();
  const scaleSafe = Math.max(cam.scale || 1, 0.01);
  if (d.kind === 'under') {
    const x = (d.x || 0) * mm;
    const y = -((d.y || 0) * mm);
    const w = Math.max(2, (d.w || 10) * mm);
    const h = Math.max(2, (d.h || 10) * mm);
    ctx.fillStyle = 'rgba(34,197,94,0.35)';
    ctx.strokeStyle = 'rgba(34,197,94,0.95)';
    ctx.lineWidth = 1.2 / scaleSafe;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  } else if (d.kind === 'forward') {
    ctx.fillStyle = 'rgba(249,115,22,0.28)';
    ctx.strokeStyle = 'rgba(249,115,22,0.95)';
    ctx.lineWidth = 1.2 / scaleSafe;
    const ox = (d.offsetX || 0) * mm;
    const bodyH = (activeDef && activeDef.body && activeDef.body.h) || 150;
    const oy = (d.offsetY != null ? d.offsetY : bodyH / 2) * mm;
    const len = Math.max(4, (d.length || 80) * mm);
    const wid = Math.max(4, (d.width || 40) * mm);
    ctx.beginPath();
    if (d.shape === 'triangle') {
      ctx.moveTo(ox - wid / 2, -oy);
      ctx.lineTo(ox + wid / 2, -oy);
      ctx.lineTo(ox, -(oy + len));
      ctx.closePath();
    } else {
      ctx.rect(ox - wid / 2, -(oy + len), wid, len);
    }
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Sprite do robô na arena (corpo, rodas, frente, detectores, carga).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} cam
 * @param {object} r - Robot
 * @param {object} deps - { activeRobotDef? }
 */
export function drawRobot(ctx, cam, r, deps = {}) {
  if (!r) return;
  const mm = TILE_PX / 300;
  ctx.save();
  ctx.translate(r.pos.x, r.pos.y);
  ctx.rotate(r.angle);

  const def = r.definition || deps.activeRobotDef || null;
  if (def && def.body) {
    r.width = (def.body.w || 120) * mm;
    r.height = (def.body.h || 150) * mm;
  }
  const bw = r.width || 26;
  const bh = r.height || 34;
  const scaleSafe = Math.max(cam.scale || 1, 0.01);

  ctx.fillStyle = '#3b82f6';
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 2 / scaleSafe;
  roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 4);
  ctx.fill();
  ctx.stroke();

  // barra frontal
  ctx.fillStyle = '#93c5fd';
  ctx.fillRect(-7, -bh / 2 - 2, 14, 5);
  // rodas laterais
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-bw / 2 - 3, -9, 4, 18);
  ctx.fillRect(bw / 2 - 1, -9, 4, 18);

  if (def && Array.isArray(def.detectors)) {
    for (const d of def.detectors) {
      drawDetectorOnRobot(ctx, cam, d, mm, def);
    }
  }
  if (r.carrying) {
    ctx.fillStyle = r.carrying === 'alive' ? '#e5e7eb' : '#111';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Pipeline principal de desenho da arena.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 * @param {object} cam
 * @param {object} sim
 * @param {RenderDeps} deps
 */
export function drawArena(ctx, canvas, cam, sim, deps = {}) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.translate(cam.ox, cam.oy);
  ctx.scale(cam.scale, cam.scale);

  for (let y = 0; y < sim.gridH; y++) {
    for (let x = 0; x < sim.gridW; x++) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1 / cam.scale;
      ctx.strokeRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
    }
  }

  sim.tiles.forEach(t => { if (t.type !== TileType.EMPTY) drawTile(ctx, cam, sim, t, deps); });
  sim.objects.forEach(o => drawArenaObject(ctx, cam, o, deps));

  if (sim.selectedTile && sim.mode === 'editor') {
    const t = sim.selectedTile;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3 / cam.scale;
    ctx.strokeRect(t.worldX + 2, t.worldY + 2, TILE_PX - 4, TILE_PX - 4);
  }
  if (sim.selectedObject && sim.mode === 'editor') {
    const o = sim.selectedObject;
    const cx = o.gx * TILE_PX + TILE_PX / 2;
    const cy = o.gy * TILE_PX + TILE_PX / 2;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5 / cam.scale;
    ctx.strokeRect(cx - TILE_PX * 0.35, cy - TILE_PX * 0.35, TILE_PX * 0.7, TILE_PX * 0.7);
  }

  if (sim.mode === 'sim' && sim.path && sim.path.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(59,130,246,0.35)';
    ctx.lineWidth = 2 / cam.scale;
    ctx.setLineDash([4 / cam.scale, 6 / cam.scale]);
    ctx.moveTo(sim.path[0].x, sim.path[0].y);
    for (let i = 1; i < sim.path.length; i++) ctx.lineTo(sim.path[i].x, sim.path[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (sim.robot) drawRobot(ctx, cam, sim.robot, { ...deps, activeRobotDef: sim.activeRobotDef });

  // medição
  if (sim.measureMode && (sim.measureStart || sim.measureCursor)) {
    ctx.save();
    ctx.strokeStyle = 'rgba(234,179,8,0.95)';
    ctx.fillStyle = '#fbbf24';
    ctx.lineWidth = 2 / cam.scale;
    ctx.setLineDash([6 / cam.scale, 4 / cam.scale]);
    if (sim.measureStart && sim.measureCursor) {
      ctx.beginPath();
      ctx.moveTo(sim.measureStart.x, sim.measureStart.y);
      ctx.lineTo(sim.measureCursor.x, sim.measureCursor.y);
      ctx.stroke();
      const distPx = Math.hypot(
        sim.measureCursor.x - sim.measureStart.x,
        sim.measureCursor.y - sim.measureStart.y
      );
      const distMm = distPx * (300 / TILE_PX);
      const mx = (sim.measureStart.x + sim.measureCursor.x) / 2;
      const my = (sim.measureStart.y + sim.measureCursor.y) / 2;
      ctx.setLineDash([]);
      ctx.font = `${11 / cam.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${distMm.toFixed(0)} mm`, mx, my - 8 / cam.scale);
    } else if (sim.measureStart) {
      ctx.beginPath();
      ctx.arc(sim.measureStart.x, sim.measureStart.y, 4 / cam.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}
