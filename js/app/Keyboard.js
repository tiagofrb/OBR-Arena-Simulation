/**
 * Atalhos globais de teclado (abas 1–6, undo/redo, editor, WASD).
 * Um único keydown/keyup; despacha para editor/construtores via deps.
 */

import { isTypingTarget } from '../core/typing.js';

/**
 * @param {object} sim
 * @param {object} deps
 * @param {(mode: string) => void} deps.setMode
 * @param {() => void} [deps.undoCtor]
 * @param {() => void} [deps.redoCtor]
 * @param {() => void} [deps.undoObjCtor]
 * @param {() => void} [deps.redoObjCtor]
 * @param {() => void} [deps.undoArena]
 * @param {() => void} [deps.redoArena]
 * @param {object} [deps.ctor] — estado do construtor de tile (lineStart)
 * @param {() => void} [deps.drawCtor]
 * @param {object} [deps.objCtor]
 * @param {() => void} [deps.drawObjCtor]
 * @param {(dir?: number) => void} [deps.rotateSelected]
 * @param {(axis: string) => void} [deps.mirrorSelected]
 * @param {(gx: number, gy: number, gz?: number) => void} [deps.clearTileAt]
 * @param {(tile: object|null) => void} [deps.fillTilePropsPanel]
 * @param {(ev: object) => void} [deps.logUI]
 * @param {(sim: object) => void} [deps.cancelEditorTools]
 * @param {() => void} [deps.draw]
 * @param {*} [deps.TileType]
 */
export function wireKeyboard(sim, deps) {
  window.addEventListener('keydown', e => {
    const typing = isTypingTarget(e.target);
    if (e.code === 'Space' && !typing) { sim.spaceDown = true; e.preventDefault(); }
    if (e.key === 'Shift') sim.shiftDown = true;

    // 1..6 — switch tabs (não intercepta quando está digitando; aceita teclado numérico)
    const tabKey = (e.key >= '1' && e.key <= '6') ? e.key
      : (e.code && /^Numpad[1-6]$/.test(e.code) ? e.code.slice(-1) : null);
    if (!typing && tabKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const modes = ['editor', 'sim', 'manual', 'constructor', 'objconstructor', 'robot'];
      const idx = parseInt(tabKey, 10) - 1;
      deps.setMode(modes[idx]);
      e.preventDefault();
      return;
    }

    // Ctrl+Z / Ctrl+Y
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (sim.mode === 'constructor' && deps.undoCtor) deps.undoCtor();
        else if (sim.mode === 'objconstructor' && deps.undoObjCtor) deps.undoObjCtor();
        else if (sim.mode === 'editor' && deps.undoArena) deps.undoArena();
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        if (sim.mode === 'constructor' && deps.redoCtor) deps.redoCtor();
        else if (sim.mode === 'objconstructor' && deps.redoObjCtor) deps.redoObjCtor();
        else if (sim.mode === 'editor' && deps.redoArena) deps.redoArena();
        return;
      }
    }

    if (e.key === 'Escape') {
      if (sim.mode === 'constructor' && deps.ctor && deps.ctor.lineStart) {
        deps.ctor.lineStart = null;
        if (deps.drawCtor) deps.drawCtor();
        e.preventDefault();
        return;
      }
      if (sim.mode === 'objconstructor' && deps.objCtor && deps.objCtor.lineStart) {
        deps.objCtor.lineStart = null;
        if (deps.drawObjCtor) deps.drawObjCtor();
        e.preventDefault();
        return;
      }
      if (sim.mode === 'editor' && sim.measureMode) {
        sim.measureMode = false;
        sim.measureStart = null;
        sim.measureCursor = null;
        const btn = document.getElementById('btnMeasure');
        if (btn) btn.classList.remove('active-tool');
        const hint = document.getElementById('measureHint');
        if (hint) hint.textContent = 'Medir: 2 cliques na arena. Esc cancela.';
        if (deps.draw) deps.draw();
        e.preventDefault();
        return;
      }
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'q', 'e', 'Q', 'E'].includes(e.key)) {
      sim.keys[e.key] = true;
      if (sim.mode === 'manual') e.preventDefault();
    }

    if (sim.mode === 'editor') {
      if (e.key === 'r' || e.key === 'R') {
        if (deps.rotateSelected) deps.rotateSelected(e.shiftKey ? -1 : 1);
        e.preventDefault();
      }
      if (e.key === 't' || e.key === 'T') {
        if (deps.mirrorSelected) deps.mirrorSelected('h');
        e.preventDefault();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sim.selectedTile && deps.TileType && sim.selectedTile.type !== deps.TileType.EMPTY) {
          e.preventDefault();
          const t = sim.selectedTile;
          if (deps.clearTileAt) deps.clearTileAt(t.gx, t.gy, t.gz || 0);
          sim.selectedTile = null;
          if (typeof deps.fillTilePropsPanel === 'function') deps.fillTilePropsPanel(null);
          const info = document.getElementById('selectedInfo');
          if (info) info.textContent = '—';
          if (deps.logUI) deps.logUI({ t: 0, msg: 'Ladrilho apagado (Del)', category: 'info' });
        }
      }
      if (e.key === 'Escape') {
        if (deps.cancelEditorTools) deps.cancelEditorTools(sim);
        e.preventDefault();
      }
    }
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'Space') sim.spaceDown = false;
    if (e.key === 'Shift') sim.shiftDown = false;
    sim.keys[e.key] = false;
  });
}
