/**
 * Metadados do mapa (nome, duração, vítimas, andares) e validação básica.
 * Sincroniza estado sim.officialMeta com controles do painel do editor.
 */

import { TileType } from '../engine/Models.js';

/**
 * Garante estrutura mínima em sim.officialMeta.
 * @param {object} sim
 */
export function ensureMapMetaDefaults(sim) {
  if (!sim.officialMeta) {
    sim.officialMeta = {
      name: 'arena',
      duration: 480,
      victims: { live: 0, dead: 0 },
      height: 1,
      finished: false,
      tileSet: null,
      startTile: { x: -1, y: -1, z: -1 },
      startTile2: { x: -1, y: -1, z: -1 }
    };
  }
}

/**
 * Aplica sim.officialMeta nos inputs da UI.
 * @param {object} sim
 * @param {object} deps - { rebuildFloorButtons, updateMapValidateHint }
 */
export function applyMapMetaToUI(sim, deps = {}) {
  ensureMapMetaDefaults(sim);
  const m = sim.officialMeta;
  const nameEl = document.getElementById('mapName');
  const durEl = document.getElementById('mapDuration');
  const durVal = document.getElementById('mapDurationVal');
  const liveEl = document.getElementById('mapVictimsLive');
  const deadEl = document.getElementById('mapVictimsDead');
  const floorsEl = document.getElementById('mapFloors');
  const floorsVal = document.getElementById('mapFloorsVal');
  const finEl = document.getElementById('mapFinished');
  if (nameEl) nameEl.value = m.name || '';
  if (durEl) {
    durEl.value = m.duration != null ? m.duration : 480;
    if (durVal) durVal.textContent = durEl.value;
  }
  if (liveEl) liveEl.value = (m.victims && m.victims.live) || 0;
  if (deadEl) deadEl.value = (m.victims && m.victims.dead) || 0;
  if (floorsEl) {
    floorsEl.value = Math.max(1, m.height || 1);
    if (floorsVal) floorsVal.textContent = floorsEl.value;
  }
  if (finEl) finEl.checked = !!m.finished;
  if (deps.rebuildFloorButtons) deps.rebuildFloorButtons();
  if (deps.updateMapValidateHint) deps.updateMapValidateHint();
}

/**
 * Lê controles da UI e grava em sim.officialMeta (inclui startTile a partir dos marcadores).
 * @param {object} sim
 */
export function syncMapMetaFromUI(sim) {
  ensureMapMetaDefaults(sim);
  const m = sim.officialMeta;
  const nameEl = document.getElementById('mapName');
  const durEl = document.getElementById('mapDuration');
  const liveEl = document.getElementById('mapVictimsLive');
  const deadEl = document.getElementById('mapVictimsDead');
  const floorsEl = document.getElementById('mapFloors');
  const finEl = document.getElementById('mapFinished');
  if (nameEl) m.name = nameEl.value || 'arena';
  if (durEl) m.duration = parseInt(durEl.value, 10) || 480;
  m.victims = {
    live: liveEl ? (parseInt(liveEl.value, 10) || 0) : 0,
    dead: deadEl ? (parseInt(deadEl.value, 10) || 0) : 0
  };
  if (floorsEl) m.height = parseInt(floorsEl.value, 10) || 1;
  if (finEl) m.finished = !!finEl.checked;

  m.startTile = { x: -1, y: -1, z: -1 };
  m.startTile2 = { x: -1, y: -1, z: -1 };
  for (const t of sim.tiles || []) {
    if (t.type === TileType.EMPTY) continue;
    if (t.markStart || t.type === TileType.START || t.type === 'start') {
      m.startTile = { x: t.gx, y: t.gy, z: t.gz || 0 };
    }
    if (t.markStart2) {
      m.startTile2 = { x: t.gx, y: t.gy, z: t.gz || 0 };
    }
  }
}

/**
 * Atualiza dica de validação (start/chegada/path).
 * @param {object} sim
 */
export function updateMapValidateHint(sim) {
  const hint = document.getElementById('mapValidateHint');
  if (!hint) return;
  ensureMapMetaDefaults(sim);
  const m = sim.officialMeta;
  const hasStart = (m.startTile && m.startTile.x >= 0) ||
    (sim.tiles || []).some(t => t.markStart || t.type === TileType.START);
  const hasFinish = (sim.tiles || []).some(t => t.markFinish || t.type === TileType.FINISH);
  const parts = [];
  if (!hasStart) parts.push('sem start');
  if (m.finished && !hasFinish) parts.push('finished marcado sem chegada');
  if (parts.length) {
    hint.textContent = 'Aviso: ' + parts.join('; ');
    hint.style.color = 'var(--warn, #f59e0b)';
  } else {
    hint.textContent = m.height > 1
      ? `OK · ${m.height} andares · floor ${sim.currentFloor || 0}`
      : 'OK';
    hint.style.color = 'var(--muted, #94a3b8)';
  }
}

/**
 * Reconstrói botões de seleção de andar.
 * @param {object} sim
 * @param {object} deps - { setCurrentFloor }
 */
export function rebuildFloorButtons(sim, deps = {}) {
  const wrap = document.getElementById('floorButtons');
  if (!wrap) return;
  ensureMapMetaDefaults(sim);
  const n = Math.max(1, (sim.officialMeta && sim.officialMeta.height) || 1);
  wrap.innerHTML = '';
  for (let z = 0; z < n; z++) {
    const btn = document.createElement('button');
    btn.textContent = `Z${z}`;
    btn.className = (sim.currentFloor || 0) === z ? 'active-tool primary' : '';
    btn.onclick = () => {
      if (deps.setCurrentFloor) deps.setCurrentFloor(z);
    };
    wrap.appendChild(btn);
  }
}

/**
 * Define o andar atual em edição.
 * @param {object} sim
 * @param {number} z
 * @param {object} deps - { draw, rebuildFloorButtons, updateMapValidateHint }
 */
export function setCurrentFloor(sim, z, deps = {}) {
  ensureMapMetaDefaults(sim);
  const max = Math.max(1, (sim.officialMeta && sim.officialMeta.height) || 1) - 1;
  sim.currentFloor = Math.max(0, Math.min(max, z | 0));
  if (deps.rebuildFloorButtons) deps.rebuildFloorButtons();
  if (deps.updateMapValidateHint) deps.updateMapValidateHint();
  if (deps.draw) deps.draw();
}
