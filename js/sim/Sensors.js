/**
 * Amostragem de sensores (under / forward) sobre a arena.
 * Não importa o renderer — usa só o estado de tiles em `sim`.
 */
import { TILE_PX, MM_TO_WORLD } from '../core/constants.js';
import { TileType } from '../engine/Models.js';

/**
 * Converte ponto local do robô (mm, +Y = frente) para mundo.
 * @param {object} robot
 * @param {number} lx
 * @param {number} ly
 */
export function localToWorld(robot, lx, ly) {
  const x = lx * MM_TO_WORLD;
  const y = -ly * MM_TO_WORLD;
  const c = Math.cos(robot.angle),
    s = Math.sin(robot.angle);
  return {
    x: robot.pos.x + x * c - y * s,
    y: robot.pos.y + x * s + y * c
  };
}

/**
 * Cor aproximada do piso em coordenadas de mundo.
 * @param {object} sim
 * @param {number} wx
 * @param {number} wy
 */
export function sampleArenaColor(sim, wx, wy) {
  const gx = Math.floor(wx / TILE_PX);
  const gy = Math.floor(wy / TILE_PX);
  const tile = sim.tiles.find(t => t.gx === gx && t.gy === gy);
  if (!tile || tile.type === TileType.EMPTY) return { r: 15, g: 23, b: 42, lum: 20 };
  if (tile.type === TileType.CUSTOM && tile.custom && tile._img) {
    const img = tile._img;
    const lx = (wx - tile.worldX) / TILE_PX;
    const ly = (wy - tile.worldY) / TILE_PX;
    if (img.complete && img.naturalWidth > 0) {
      try {
        const tc = document.createElement('canvas');
        tc.width = 1;
        tc.height = 1;
        const tctx = tc.getContext('2d');
        const px = Math.max(
          0,
          Math.min(img.naturalWidth - 1, Math.floor(lx * img.naturalWidth))
        );
        const py = Math.max(
          0,
          Math.min(img.naturalHeight - 1, Math.floor(ly * img.naturalHeight))
        );
        tctx.drawImage(img, px, py, 1, 1, 0, 0, 1, 1);
        const d = tctx.getImageData(0, 0, 1, 1).data;
        return {
          r: d[0],
          g: d[1],
          b: d[2],
          lum: 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]
        };
      } catch (e) { /* CORS / tainted */ }
    }
  }
  const lx = (wx - tile.worldX) / TILE_PX;
  const ly = (wy - tile.worldY) / TILE_PX;
  const onLine = Math.abs(ly - 0.5) < 0.08 || Math.abs(lx - 0.5) < 0.08;
  if (tile.type === TileType.GAP && Math.abs(lx - 0.5) < 0.15 && Math.abs(ly - 0.5) < 0.12) {
    return { r: 168, g: 85, b: 247, lum: 120 };
  }
  if (tile.opts && tile.opts.hasGreen && lx < 0.25 && ly < 0.25) {
    return { r: 34, g: 197, b: 94, lum: 140 };
  }
  if (onLine) return { r: 30, g: 41, b: 59, lum: 35 };
  return { r: 226, g: 232, b: 240, lum: 230 };
}

/**
 * @param {object} sim
 * @param {Array<{x:number,y:number}>} points
 */
export function sampleRegion(sim, points) {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const p of points) {
    const c = sampleArenaColor(sim, p.x, p.y);
    r += c.r;
    g += c.g;
    b += c.b;
    n++;
  }
  if (!n) return { r: 0, g: 0, b: 0, lum: 0 };
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);
  return { r, g, b, lum: 0.299 * r + 0.587 * g + 0.114 * b };
}

/**
 * Pontos de amostragem de um detector no mundo.
 * @param {object} robot
 * @param {object} d — detector
 * @param {object} [activeRobotDef] — fallback de body.h
 */
export function detectorSamplePoints(robot, d, activeRobotDef) {
  const pts = [];
  if (d.kind === 'under') {
    const steps = 3;
    for (let iy = 0; iy < steps; iy++) {
      for (let ix = 0; ix < steps; ix++) {
        const lx = d.x - d.w / 2 + ((ix + 0.5) * d.w) / steps;
        const ly = d.y - d.h / 2 + ((iy + 0.5) * d.h) / steps;
        pts.push(localToWorld(robot, lx, ly));
      }
    }
  } else {
    const ox = d.offsetX || 0;
    const oy =
      d.offsetY != null
        ? d.offsetY
        : (robot.definition?.body?.h || activeRobotDef?.body?.h || 150) / 2;
    const len = d.length || 60,
      wid = d.width || 40;
    const stepsX = 4,
      stepsY = 5;
    for (let iy = 0; iy < stepsY; iy++) {
      for (let ix = 0; ix < stepsX; ix++) {
        const u = (ix + 0.5) / stepsX;
        const v = (iy + 0.5) / stepsY;
        let lx, ly;
        if (d.shape === 'triangle') {
          const half = (wid / 2) * (1 - v);
          lx = ox - half + u * (2 * half);
          ly = oy + v * len;
        } else {
          lx = ox - wid / 2 + u * wid;
          ly = oy + v * len;
        }
        pts.push(localToWorld(robot, lx, ly));
      }
    }
  }
  return pts;
}

/**
 * Atualiza `robot.sensorReadings`.
 * @param {object} sim
 * @param {object} robot
 */
export function updateSensors(sim, robot) {
  if (!robot) return;
  const def = robot.definition || sim.activeRobotDef;
  robot.sensorReadings = {};
  if (!def || !def.detectors) return;
  for (const d of def.detectors) {
    const pts = detectorSamplePoints(robot, d, sim.activeRobotDef);
    robot.sensorReadings[d.name || d.id] = sampleRegion(sim, pts);
  }
}

/** Atualiza o DOM `#sensorReadout`. */
export function updateSensorReadout(sim) {
  const el = document.getElementById('sensorReadout');
  if (!el || !sim.robot) return;
  const s = sim.robot.sensorReadings || {};
  const keys = Object.keys(s);
  if (!keys.length) {
    el.textContent = 'sensores: (defina robô na aba 6)';
    return;
  }
  el.innerHTML = keys
    .map(k => {
      const v = s[k];
      return `<div>${k}: rgb(${v.r},${v.g},${v.b}) L=${v.lum.toFixed(0)}</div>`;
    })
    .join('');
}
