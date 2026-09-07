/**
 * Modo Custom: gates de UI (espelho, objetos custom, hint de export) e toggle persistido.
 */

/**
 * Habilita/desabilita botões de espelhamento conforme `sim.customMode`.
 * @param {object} sim
 */
export function updateMirrorUI(sim) {
  const h = document.getElementById('btnMirrorH');
  const v = document.getElementById('btnMirrorV');
  const hint = document.getElementById('mirrorHint');
  const allow = !!sim.customMode;
  if (h) {
    h.disabled = !allow;
    h.style.opacity = allow ? '1' : '0.45';
    h.title = allow ? 'Espelhar horizontal' : 'Disponível apenas no Modo Custom';
  }
  if (v) {
    v.disabled = !allow;
    v.style.opacity = allow ? '1' : '0.45';
    v.title = allow ? 'Espelhar vertical' : 'Disponível apenas no Modo Custom';
  }
  if (hint) {
    hint.textContent = allow
      ? 'Espelhamento: ativo (Modo Custom).'
      : 'Espelhamento: desativado (ative Modo Custom para usar — evita incompatibilidade com o oficial).';
  }
}

/**
 * Mostra/esconde bloco de objetos custom e re-liga o botão.
 * @param {object} sim
 * @param {{ logUI: (ev: object) => void }} deps
 */
export function updateCustomObjectUI(sim, deps) {
  const block = document.getElementById('customObjectsBlock');
  const btn =
    document.querySelector('#objectToolsCustom button[data-obj="custom"]') ||
    document.querySelector('#objectTools button[data-obj="custom"]');
  const sel = document.getElementById('customObjSelect');
  const allow = !!sim.customMode;
  if (block) block.classList.toggle('hidden', !allow);
  if (btn) {
    btn.disabled = !allow;
    btn.style.opacity = allow ? '1' : '0.45';
    btn.title = allow ? 'Objeto custom' : 'Disponível apenas no Modo Custom';
    if (!btn._wiredCustom) {
      btn._wiredCustom = true;
      btn.onclick = () => {
        if (!sim.customMode) {
          deps.logUI({
            t: 0,
            msg: 'Modo oficial: objetos personalizados bloqueados.',
            category: 'warning'
          });
          return;
        }
        document
          .querySelectorAll('#objectTools button, #objectToolsCustom button')
          .forEach(b => b.classList.remove('active-tool'));
        btn.classList.add('active-tool');
        sim.objectTool = 'custom';
        sim.selectedTool = null;
        sim.markerTool = null;
        const s = document.getElementById('customObjSelect');
        if (s && s.value !== '') sim.placingCustomObjId = parseInt(s.value, 10);
      };
    }
  }
  if (sel) {
    sel.disabled = !allow;
    sel.style.opacity = allow ? '1' : '0.45';
  }
  if (!allow && sim.objectTool === 'custom') {
    sim.objectTool = null;
  }
}

/**
 * Texto de ajuda do export conforme modo.
 * @param {object} sim
 */
export function updateExportHint(sim) {
  const el = document.getElementById('exportHint');
  if (!el) return;
  el.textContent = sim.customMode
    ? 'Modo Custom: Exportar = formato do app. «Exportar (outro)» = JSON oficial RCJ. Arraste tiles · Shift+R = anti-horário.'
    : 'Modo oficial: Exportar = JSON RCJ/OBR (com pathfinding). «Exportar (outro)» = formato do app. Arraste tiles · Shift+R = anti-horário.';
}

/**
 * Liga/desliga modo custom, persiste e atualiza UI relacionada.
 * @param {object} sim
 * @param {boolean} enabled
 * @param {object} deps
 * @param {(key: string, value: *) => void} deps.persist
 * @param {() => void} deps.renderTilePalette
 * @param {(layer: string) => void} deps.setEditorLayer
 * @param {(ev: object) => void} deps.logUI
 * @param {() => void} deps.draw
 */
export function applyCustomMode(sim, enabled, deps) {
  sim.customMode = !!enabled;
  deps.persist('obr_custom_mode', sim.customMode);
  const tog = document.getElementById('toggleCustomMode');
  if (tog) tog.checked = sim.customMode;
  if (!sim.customMode) {
    (sim.tiles || []).forEach(t => {
      t.mirrorH = false;
      t.mirrorV = false;
    });
    (sim.objects || []).forEach(o => {
      o.mirrorH = false;
      o.mirrorV = false;
    });
    if (sim.selectedTool === 'custom') {
      sim.selectedTool = 'straight';
      sim.placingCustomId = null;
    }
  }
  updateMirrorUI(sim);
  deps.renderTilePalette();
  updateCustomObjectUI(sim, { logUI: deps.logUI });
  updateExportHint(sim);
  if (!sim.customMode) {
    deps.setEditorLayer('official');
  }
  deps.logUI({
    t: 0,
    msg: sim.customMode
      ? 'Modo custom ativado — espelhamento, ladrilhos e objetos personalizados liberados.'
      : 'Modo custom desativado — personalizados bloqueados; export padrão = JSON oficial RCJ/OBR.',
    category: sim.customMode ? 'warning' : 'success'
  });
  deps.draw();
}
