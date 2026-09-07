/**
 * Shell da aplicação: abas, painéis, drawer de ajuda e troca de modo.
 * Depende de callbacks injetados para abrir/fechar construtores e desenhar.
 */

const MODE_LABELS = {
  sim: 'Simulação',
  editor: 'Editor',
  manual: 'Manual',
  constructor: 'Construtor Tile',
  objconstructor: 'Construtor Obj',
  robot: 'Construtor Robô'
};

/**
 * Liga o drawer de ajuda (scrim + botões).
 */
export function initHelpDrawer() {
  const btn = document.getElementById('btnHelp2');
  const scrim = document.getElementById('scrim');
  const drawer = document.getElementById('drawer');
  const closeBtn = document.getElementById('btnCloseDrawer');
  const open = () => {
    if (scrim) scrim.classList.add('open');
    if (drawer) drawer.classList.add('open');
  };
  const close = () => {
    if (scrim) scrim.classList.remove('open');
    if (drawer) drawer.classList.remove('open');
  };
  if (btn) btn.onclick = open;
  if (closeBtn) closeBtn.onclick = close;
  if (scrim) scrim.onclick = close;
}

/**
 * Liga as abas do topo aos modos.
 * @param {(mode: string) => void} setMode
 */
export function wireTabs(setMode) {
  const map = [
    ['tabSim', 'sim'],
    ['tabEditor', 'editor'],
    ['tabManual', 'manual'],
    ['tabConstructor', 'constructor'],
    ['tabObjConstructor', 'objconstructor'],
    ['tabRobot', 'robot']
  ];
  for (const [id, mode] of map) {
    const el = document.getElementById(id);
    if (el) el.onclick = () => setMode(mode);
  }
}

/**
 * Troca o modo da aplicação (abas + painéis + help).
 *
 * @param {object} sim
 * @param {string} mode
 * @param {object} deps
 * @param {() => void} deps.closeConstructorTab
 * @param {() => void} deps.closeObjConstructorTab
 * @param {() => void} deps.closeRobotConstructorTab
 * @param {() => void} deps.openConstructorTab
 * @param {() => void} deps.openObjConstructorTab
 * @param {() => void} deps.openRobotConstructorTab
 * @param {() => void} deps.ensureGridMatrix
 * @param {(layer: string) => void} deps.setEditorLayer
 * @param {() => void} deps.updateCustomObjectUI
 * @param {() => void} deps.updateExportHint
 * @param {() => void} deps.fitCamera
 * @param {() => void} deps.draw
 * @param {() => void} deps.schedulePathfinding
 * @param {() => void} deps.placeRobotAtStart
 */
export function setMode(sim, mode, deps) {
  sim.mode = mode;
  sim.running = false;

  // Abas
  document.getElementById('tabSim')?.classList.toggle('active', mode === 'sim');
  document.getElementById('tabEditor')?.classList.toggle('active', mode === 'editor');
  document.getElementById('tabManual')?.classList.toggle('active', mode === 'manual');
  document.getElementById('tabConstructor')?.classList.toggle('active', mode === 'constructor');
  document.getElementById('tabObjConstructor')?.classList.toggle('active', mode === 'objconstructor');
  document.getElementById('tabRobot')?.classList.toggle('active', mode === 'robot');

  // Painéis laterais
  document.getElementById('panelSim')?.classList.toggle('hidden', mode !== 'sim');
  document.getElementById('panelEditor')?.classList.toggle('hidden', mode !== 'editor');
  document.getElementById('panelManual')?.classList.toggle('hidden', mode !== 'manual');
  document.getElementById('panelConstructor')?.classList.toggle('hidden', mode !== 'constructor');
  document.getElementById('panelObjConstructor')?.classList.toggle('hidden', mode !== 'objconstructor');
  document.getElementById('panelRobot')?.classList.toggle('hidden', mode !== 'robot');

  const simModeEl = document.getElementById('simMode');
  if (simModeEl) simModeEl.textContent = MODE_LABELS[mode] || mode;
  const simStateEl = document.getElementById('simState');
  if (simStateEl) simStateEl.textContent = 'Parado';

  // Fecha todos os construtores (só esconde canvases extras)
  deps.closeConstructorTab();
  deps.closeObjConstructorTab();
  deps.closeRobotConstructorTab();

  const isCtorMode = mode === 'constructor' || mode === 'objconstructor' || mode === 'robot';
  if (!isCtorMode) {
    document.getElementById('arena')?.classList.remove('hidden');
    document.getElementById('arenaZoomBar')?.classList.remove('hidden');
  }

  try {
    if (mode === 'constructor') {
      deps.openConstructorTab();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Construtor de ladrilho 3×3. Shift+meio=pan · Scroll=zoom';
    } else if (mode === 'objconstructor') {
      deps.openObjConstructorTab();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Construtor de objeto 300×300. Só pincel/cores. Ctrl+Z/Y';
    } else if (mode === 'robot') {
      deps.openRobotConstructorTab();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Construtor de robô: corpo + detectores under/forward. +Y = frente.';
    } else if (mode === 'editor') {
      if (!sim.tiles.length) deps.ensureGridMatrix();
      // Oficial por padrão; App/Custom só quando modo custom
      deps.setEditorLayer(sim.customMode ? 'tiles' : 'official');
      deps.updateCustomObjectUI();
      deps.updateExportHint();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Arraste da paleta · arraste tile para mover/remover · Shift+R anti-horário · Meio=picker · Clique direito=props';
      deps.fitCamera();
      deps.draw();
      deps.schedulePathfinding();
    } else if (mode === 'manual') {
      if (!sim.robot) deps.placeRobotAtStart();
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'WASD/setas. Após chegada use Voltar ao Início.';
      deps.fitCamera();
      deps.draw();
    } else {
      const hb = document.getElementById('helpBox');
      if (hb) hb.textContent = 'Play/Pause/Step. Zoom Fit para ver tudo.';
      deps.fitCamera();
      deps.draw();
    }
  } catch (err) {
    console.error('setMode error:', mode, err);
  }
}
