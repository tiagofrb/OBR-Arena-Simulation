/**
 * Ferramentas e seleção do editor de arena (estado de ferramenta armada).
 * Paleta DOM e wiring pesado permanecem em main.js; aqui ficam as operações
 * de estado reutilizáveis e testáveis.
 */

import { TileType } from '../engine/Models.js';

/**
 * Desarma qualquer ferramenta de ladrilho (oficial/custom/builtin).
 * @param {object} sim
 */
export function clearTileSelection(sim) {
  sim.selectedTool = null;
  sim.placingOfficialFile = null;
  sim.placingCustomId = null;
  document.querySelectorAll('#tileTools button, #officialTileTools button').forEach(b => {
    b.classList.remove('active-tool');
  });
}

/**
 * Indica se a ferramenta deve permanecer armada após um clique (Shift = multi-place).
 * @param {Event|null} ev
 * @returns {boolean}
 */
export function shouldKeepToolArmed(ev) {
  if (ev && ev.shiftKey) return true;
  return false;
}

/**
 * Arma uma ferramenta de ladrilho (builtin ou custom).
 * @param {object} sim
 * @param {string} type - TileType ou 'custom'
 * @param {number|null} [customIdx]
 * @param {object} deps - { logUI }
 */
export function selectTileTool(sim, type, customIdx, deps = {}) {
  if (type === 'custom' && !sim.customMode) {
    if (deps.logUI) {
      deps.logUI({
        t: 0,
        msg: 'Modo oficial ativo: ladrilhos personalizados bloqueados. Ative Modo Custom em Backup & dados.',
        category: 'warning'
      });
    }
    return;
  }
  sim.selectedTool = type;
  sim.objectTool = null;
  sim.markerTool = null;
  sim.placingOfficialFile = null;
  sim.placingCustomId = type === 'custom' ? customIdx : null;

  document.querySelectorAll('#tileTools button').forEach(b => {
    const match = b.dataset.type === type
      && (type !== 'custom' || parseInt(b.dataset.customidx, 10) === customIdx);
    b.classList.toggle('active-tool', match);
  });
  document.querySelectorAll('#officialTileTools button').forEach(b => b.classList.remove('active-tool'));
  document.querySelectorAll('#objectTools button, #markerTools button').forEach(b => {
    b.classList.remove('active-tool');
  });
}

/**
 * Seleciona um ladrilho oficial da paleta.
 * @param {object} sim
 * @param {string} file - nome do arquivo (ex. tile-12.png)
 */
export function selectOfficialTile(sim, file) {
  sim.selectedTool = 'official';
  sim.placingOfficialFile = file;
  sim.placingCustomId = null;
  sim.objectTool = null;
  sim.markerTool = null;
  document.querySelectorAll('#tileTools button').forEach(b => b.classList.remove('active-tool'));
  document.querySelectorAll('#officialTileTools button').forEach(b => {
    b.classList.toggle('active-tool', b.dataset.file === file);
  });
  document.querySelectorAll('#objectTools button, #markerTools button').forEach(b => {
    b.classList.remove('active-tool');
  });
}

/**
 * Alterna a camada visível no painel do editor (oficiais / custom / objetos).
 * @param {string} layer - 'official' | 'tiles' | 'objects'
 */
export function setEditorLayer(layer) {
  const officialSec = document.getElementById('editorOfficialSection');
  const tilesSec = document.getElementById('editorTilesSection');
  const objectsSec = document.getElementById('editorObjectsSection');
  const btnOfficial = document.getElementById('btnShowOfficial');
  const btnTiles = document.getElementById('btnShowTiles');
  const btnObjects = document.getElementById('btnShowObjects');

  if (officialSec) officialSec.classList.toggle('hidden', layer !== 'official');
  if (tilesSec) tilesSec.classList.toggle('hidden', layer !== 'tiles');
  if (objectsSec) objectsSec.classList.toggle('hidden', layer !== 'objects');

  if (btnOfficial) btnOfficial.classList.toggle('active-tool', layer === 'official');
  if (btnTiles) btnTiles.classList.toggle('active-tool', layer === 'tiles');
  if (btnObjects) btnObjects.classList.toggle('active-tool', layer === 'objects');
}

/**
 * Cancela ferramentas ativas do editor (Esc).
 * @param {object} sim
 */
export function cancelEditorTools(sim) {
  sim.selectedTool = null;
  sim.objectTool = null;
  sim.markerTool = null;
  sim.placingOfficialFile = null;
  sim.placingCustomId = null;
  document.querySelectorAll('#tileTools button').forEach(b => b.classList.remove('active-tool'));
  document.querySelectorAll('#officialTileTools button').forEach(b => b.classList.remove('active-tool'));
  document.querySelectorAll('#objectTools button').forEach(b => b.classList.remove('active-tool'));
  document.querySelectorAll('#markerTools button').forEach(b => b.classList.remove('active-tool'));
  const info = document.getElementById('selectedInfo');
  if (info) info.textContent = '— (seleção)';
}

/**
 * Helpers de marcadores (start / finish / checkpoint).
 * @param {import('../engine/Models.js').Tile|null} t
 */
export function tileIsStart(t) {
  if (!t) return false;
  if (typeof t.isStart === 'function') return t.isStart();
  return t.type === TileType.START || !!t.markStart;
}

export function tileIsFinish(t) {
  if (!t) return false;
  if (typeof t.isFinish === 'function') return t.isFinish();
  return t.type === TileType.FINISH || !!t.markFinish;
}

export function tileIsCheckpoint(t) {
  if (!t) return false;
  if (typeof t.isCheckpoint === 'function') return t.isCheckpoint();
  return t.type === TileType.CHECKPOINT || !!t.markCheckpoint;
}
