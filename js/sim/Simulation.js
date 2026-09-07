/**
 * Orquestração da simulação: cenários, pose do robô, path follow, eventos de tile.
 * Limitação conhecida: vários fluxos assumem floor 0 (não “corrigir” multi-andar aqui).
 */
import {
  TILE_PX,
  MM_TO_WORLD,
  PATH_FOLLOW_SPEED,
  PATH_WAYPOINT_EPSILON
} from '../core/constants.js';
import { Robot, Tile, TileType } from '../engine/Models.js';
import { scenarios } from './Scenarios.js';
import { applyManualControl } from './ManualControl.js';
import { updateSensors, updateSensorReadout } from './Sensors.js';
import { runRobotScript } from './RobotScript.js';

/**
 * @param {object} sim
 * @param {{ tileIsStart: Function, Robot?: typeof Robot }} deps
 */
export function placeRobotAtStart(sim, deps) {
  if (sim.path.length) {
    const s = sim.path[0];
    sim.robot = new Robot(s.x, s.y, 0);
    if (sim.path.length > 1) {
      const d = sim.path[1].sub(s).norm();
      sim.robot.angle = Math.atan2(d.y, d.x) + Math.PI / 2;
    }
    sim.robot.pathIndex = 0;
    sim.startPos = { x: s.x, y: s.y, angle: sim.robot.angle };
  } else {
    const st = sim.tiles.find(t => deps.tileIsStart(t));
    const x = st ? st.worldX + TILE_PX / 2 : TILE_PX * 1.5;
    const y = st ? st.worldY + TILE_PX / 2 : TILE_PX * 1.5;
    sim.robot = new Robot(x, y, 0);
    sim.startPos = { x, y, angle: 0 };
  }
}

/**
 * @param {object} sim
 * @param {object} deps
 */
export function restartRobot(sim, deps) {
  const st = sim.tiles.find(t => deps.tileIsStart(t));
  if (st) {
    const x = st.worldX + TILE_PX / 2;
    const y = st.worldY + TILE_PX / 2;
    let angle = 0;
    if (sim.path.length > 1) {
      const d = sim.path[1].sub(sim.path[0]).norm();
      angle = Math.atan2(d.y, d.x) + Math.PI / 2;
    } else if (sim.startPos) {
      angle = sim.startPos.angle || 0;
    }
    sim.robot = new Robot(x, y, angle);
    sim.startPos = { x, y, angle };
  } else if (sim.startPos) {
    sim.robot = new Robot(sim.startPos.x, sim.startPos.y, sim.startPos.angle || 0);
  } else {
    placeRobotAtStart(sim, deps);
  }
  sim.finished = false;
  sim.running = false;
  sim.lastTile = null;
  sim.tilesSinceCP = 0;
  if (sim.robot) {
    sim.robot.pathIndex = 0;
    sim.robot.vLinear = 0;
    sim.robot.vAngular = 0;
    if (sim.activeRobotDef) {
      sim.robot.definition = sim.activeRobotDef;
      sim.robot.width = (sim.activeRobotDef.body.w || 120) * MM_TO_WORLD;
      sim.robot.height = (sim.activeRobotDef.body.h || 150) * MM_TO_WORLD;
    }
  }
  sim.score.scoredHazards.clear();
  sim.score.trajeto = 0;
  sim.score.checkpoints = 0;
  sim.score.finish = 0;
  sim.score.multiplier = 1;
  deps.updateScoreUI();
  const stateEl = document.getElementById('simState');
  if (stateEl) stateEl.textContent = 'Parado';
  deps.logUI({
    t: sim.time,
    msg: st ? 'Robô voltou ao ladrilho START da arena.' : 'Robô voltou ao início.',
    category: 'info'
  });
  deps.draw();
}

/**
 * @param {object} sim
 * @param {string} key
 * @param {object} deps
 */
export function loadScenario(sim, key, deps) {
  sim.objects = [];
  sim.selectedObject = null;
  if (key === 'custom') {
    if (sim.customArena && sim.customArena.length) {
      let maxX = 0,
        maxY = 0;
      sim.customArena.forEach(t => {
        maxX = Math.max(maxX, t.gx);
        maxY = Math.max(maxY, t.gy);
      });
      sim.gridW = Math.max(sim.gridW, maxX + 1);
      sim.gridH = Math.max(sim.gridH, maxY + 1);
      const gw = document.getElementById('gridW');
      const gh = document.getElementById('gridH');
      const gwv = document.getElementById('gridWVal');
      const ghv = document.getElementById('gridHVal');
      if (gw) gw.value = sim.gridW;
      if (gh) gh.value = sim.gridH;
      if (gwv) gwv.textContent = sim.gridW;
      if (ghv) ghv.textContent = sim.gridH;
      sim.tiles = [];
      deps.ensureGridMatrix();
      sim.customArena.forEach(o => {
        const t = Tile.fromJSON(o);
        const idx = sim.tiles.findIndex(x => x.gx === t.gx && x.gy === t.gy);
        if (idx >= 0) sim.tiles[idx] = t;
        else sim.tiles.push(t);
      });
      sim.path = [];
      sim.currentScenario = 'custom';
      if (sim.customArenaObjects) {
        sim.objects = JSON.parse(JSON.stringify(sim.customArenaObjects));
      }
    } else {
      deps.logUI({ t: 0, msg: 'Nenhuma arena personalizada salva.', category: 'warning' });
      return;
    }
  } else {
    const sc = scenarios[key];
    if (!sc) return;
    sim.currentScenario = key;
    const built = sc.build();
    let maxX = 0,
      maxY = 0;
    built.forEach(t => {
      maxX = Math.max(maxX, t.gx);
      maxY = Math.max(maxY, t.gy);
    });
    sim.gridW = Math.max(8, maxX + 2);
    sim.gridH = Math.max(5, maxY + 2);
    const gw = document.getElementById('gridW');
    const gh = document.getElementById('gridH');
    const gwv = document.getElementById('gridWVal');
    const ghv = document.getElementById('gridHVal');
    if (gw) gw.value = sim.gridW;
    if (gh) gh.value = sim.gridH;
    if (gwv) gwv.textContent = sim.gridW;
    if (ghv) ghv.textContent = sim.gridH;
    sim.tiles = [];
    deps.ensureGridMatrix();
    built.forEach(t => {
      const idx = sim.tiles.findIndex(x => x.gx === t.gx && x.gy === t.gy);
      if (idx >= 0) sim.tiles[idx] = t;
    });
    sim.path = sc.path(built);
    if (typeof sc.objects === 'function') sim.objects = sc.objects();
    else sim.objects = [];
    const hb = document.getElementById('helpBox');
    if (hb) hb.textContent = sc.help;
  }
  sim.score.reset();
  sim.time = 0;
  sim.running = false;
  sim.finished = false;
  sim.tilesSinceCP = 0;
  sim.attempt = 1;
  sim.lastTile = null;
  sim.selectedTile = null;
  placeRobotAtStart(sim, deps);
  const stateEl = document.getElementById('simState');
  if (stateEl) stateEl.textContent = 'Parado';
  const failEl = document.getElementById('failCount');
  if (failEl) failEl.textContent = '0';
  const infoEl = document.getElementById('selectedInfo');
  if (infoEl) infoEl.textContent = '—';
  deps.clearLog();
  deps.updateScoreUI();
  deps.logUI({
    t: 0,
    msg:
      'Cenário: ' +
      (key === 'custom'
        ? 'Personalizada'
        : (scenarios[key] && scenarios[key].name) || key),
    category: 'info'
  });
  const arenaLabelEl = document.getElementById('arenaLabel');
  if (arenaLabelEl) {
    arenaLabelEl.textContent =
      'arena: ' +
      (key === 'custom'
        ? 'personalizada'
        : (scenarios[key] && scenarios[key].name) || key);
  }
  deps.updateGridStatus();
  deps.fitCamera();
  deps.draw();
}

/**
 * Dispara ScoreEngine a partir da célula atual do robô.
 * @param {object} sim
 * @param {object} robot
 * @param {object} deps
 */
export function checkTileEvents(sim, robot, deps) {
  const gx = Math.floor(robot.pos.x / TILE_PX);
  const gy = Math.floor(robot.pos.y / TILE_PX);
  const tile = sim.tiles.find(t => t.gx === gx && t.gy === gy);
  if (!tile || tile === sim.lastTile || tile.type === TileType.EMPTY) return;
  if (sim.lastTile) sim.tilesSinceCP++;
  const id = tile.id;
  let ev = null;

  const objsHere = sim.objects.filter(o => o.gx === gx && o.gy === gy);
  for (const o of objsHere) {
    const oid = 'obj-' + o.gx + ',' + o.gy + '-' + o.type;
    let pts = 0;
    if (o.type === 'obstacle') pts = o.points != null ? o.points : 20;
    else if (o.type === 'gangorra') pts = o.points != null ? o.points : 20;
    else if (o.type === 'rampa') pts = o.points != null ? o.points : 10;
    else if (o.type === 'custom') {
      pts =
        o.custom && o.custom.points != null
          ? o.custom.points
          : o.points != null
            ? o.points
            : 0;
    }
    if (pts !== 0 || o.type === 'custom') {
      const pev = sim.score.scoreHazard(
        oid,
        pts,
        `Objeto ${o.type}${o.custom && o.custom.name ? ' "' + o.custom.name + '"' : ''} (${pts})`,
        sim.time
      );
      if (pev) {
        deps.logUI(pev);
        deps.updateScoreUI();
      }
    }
  }

  if (tile.type === TileType.CUSTOM && tile.custom) {
    const def = tile.custom;
    const lx = (robot.pos.x - tile.worldX) / TILE_PX;
    const ly = (robot.pos.y - tile.worldY) / TILE_PX;
    const p = deps.inverseTransform(lx, ly, tile.rotation, tile.mirrorH, tile.mirrorV);
    let inZone = !def.zones || !def.zones.length;
    if (def.zones) {
      for (const z of def.zones) {
        if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) {
          inZone = true;
          break;
        }
      }
    }
    if (inZone) {
      const pts =
        def.points != null && Number.isFinite(Number(def.points))
          ? Number(def.points)
          : 10;
      ev = sim.score.scoreHazard(id, pts, `Custom "${def.name}" (${pts})`, sim.time);
    }
  } else {
    switch (tile.type) {
      case TileType.OBSTACLE:
        ev = sim.score.scoreHazard(id, 20, 'Obstáculo (20)', sim.time);
        break;
      case TileType.GAP:
        ev = sim.score.scoreHazard(id, 10, 'Gap (10)', sim.time);
        break;
      case TileType.LOMBADA:
        ev = sim.score.scoreHazard(id, 10, 'Lombada (10)', sim.time);
        break;
      case TileType.GANGORRA:
        ev = sim.score.scoreHazard(id, 20, 'Gangorra (20)', sim.time);
        break;
      case TileType.RAMPA:
        ev = sim.score.scoreHazard(id, 10, 'Rampa (10)', sim.time);
        break;
      case TileType.INTERSECTION:
      case TileType.INTERSECTION_T:
        ev = sim.score.scoreHazard(id, 10, 'Interseção (10)', sim.time);
        break;
      case TileType.CHECKPOINT:
        ev = sim.score.scoreCheckpoint(
          Math.max(1, sim.tilesSinceCP),
          sim.attempt,
          sim.time
        );
        sim.tilesSinceCP = 0;
        break;
      case TileType.FINISH:
        if (!sim.finished && sim.mode === 'manual') {
          sim.finished = true;
          ev = sim.score.scoreFinish(sim.time);
          const se = document.getElementById('simState');
          if (se) se.textContent = 'Finalizado — Voltar ao Início';
        }
        break;
      case TileType.RESCUE_GREEN:
        if (robot.carrying === 'alive') {
          const mid = 'rg-' + id;
          if (!sim.score.scoredHazards.has(mid)) {
            sim.score.scoredHazards.add(mid);
            ev = sim.score.addMultiplier(1.3, 'Vítima viva na Área Verde', sim.time);
            robot.carrying = null;
          }
        }
        break;
      case TileType.RESCUE_RED:
        if (robot.carrying === 'dead') {
          const mid = 'rr-' + id;
          if (!sim.score.scoredHazards.has(mid)) {
            sim.score.scoredHazards.add(mid);
            ev = sim.score.addMultiplier(1.1, 'Vítima morta na Área Vermelha', sim.time);
            robot.carrying = null;
          }
        }
        break;
    }
  }

  if (deps.tileIsCheckpoint(tile) && tile.type !== TileType.CHECKPOINT) {
    const cev = sim.score.scoreCheckpoint(
      Math.max(1, sim.tilesSinceCP),
      sim.attempt,
      sim.time
    );
    if (cev) {
      deps.logUI(cev);
      deps.updateScoreUI();
      sim.tilesSinceCP = 0;
    }
  }
  if (deps.tileIsFinish(tile) && tile.type !== TileType.FINISH) {
    if (!sim.finished && (sim.mode === 'manual' || sim.mode === 'sim')) {
      sim.finished = true;
      const fev = sim.score.scoreFinish(sim.time);
      if (fev) {
        deps.logUI(fev);
        deps.updateScoreUI();
      }
      const se = document.getElementById('simState');
      if (se) se.textContent = 'Finalizado — Voltar ao Início';
    }
  }

  if (ev) {
    deps.logUI(ev);
    deps.updateScoreUI();
  }
  sim.lastTile = tile;
}

/**
 * Tick principal: manual | path | script.
 * @param {object} sim
 * @param {number} dt
 * @param {object} deps
 */
export function update(sim, dt, deps) {
  if (!sim.robot) return;
  if (sim.finished && sim.mode !== 'manual') return;
  const robot = sim.robot;

  if (sim.mode === 'manual') {
    applyManualControl(sim, robot, dt);
    checkTileEvents(sim, robot, deps);
    updateSensors(sim, robot);
    updateSensorReadout(sim);
  } else if (sim.mode === 'sim' && sim.running) {
    if (sim.controlMode === 'script') {
      updateSensors(sim, robot);
      runRobotScript(sim, robot, dt, deps);
      const v = (robot.vLinear || 0) * MM_TO_WORLD * sim.speed;
      const w = (robot.vAngular || 0) * sim.speed;
      robot.angle += w * dt;
      robot.pos.x += Math.sin(robot.angle) * v * dt;
      robot.pos.y -= Math.cos(robot.angle) * v * dt;
      checkTileEvents(sim, robot, deps);
      updateSensorReadout(sim);
    } else {
      if (robot.pathIndex >= sim.path.length - 1) {
        if (!sim.finished) {
          sim.finished = true;
          const ev = sim.score.scoreFinish(sim.time);
          if (ev) deps.logUI(ev);
          sim.running = false;
          const se = document.getElementById('simState');
          if (se) se.textContent = 'Finalizado — Voltar ao Início';
          deps.logUI({
            t: sim.time,
            msg: 'Chegada! Use "Voltar Robô ao Início".',
            category: 'success'
          });
          deps.updateScoreUI();
        }
        return;
      }
      const target = sim.path[robot.pathIndex + 1];
      const to = target.sub(robot.pos);
      if (to.len() < PATH_WAYPOINT_EPSILON) {
        robot.pathIndex++;
        checkTileEvents(sim, robot, deps);
      } else {
        const dir = to.norm();
        robot.pos = robot.pos.add(dir.mul(PATH_FOLLOW_SPEED * sim.speed * dt));
        robot.angle = Math.atan2(dir.y, dir.x) + Math.PI / 2;
      }
    }
  }

  if (sim.mode !== 'editor') {
    sim.time += dt;
    const te = document.getElementById('simTime');
    if (te) te.textContent = sim.time.toFixed(1) + 's';
  }
  if (sim.robot) {
    const rp = document.getElementById('robotPos');
    if (rp) {
      rp.textContent =
        Math.round(sim.robot.pos.x) + ', ' + Math.round(sim.robot.pos.y);
    }
  }
}
