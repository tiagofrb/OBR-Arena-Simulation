/**
 * Compilação e execução do script do robô (function update(sensors, dt)).
 * Monkey-patch de window.setVelocity / window.stop isolado aqui.
 */

/**
 * @param {object} sim
 * @param {string} mode — 'path' | 'script'
 * @param {{ logUI: Function }} deps
 */
export function setControlMode(sim, mode, deps) {
  sim.controlMode = mode;
  const bp = document.getElementById('btnControlPath');
  const bs = document.getElementById('btnControlScript');
  if (bp) {
    bp.classList.toggle('active-tool', mode === 'path');
    bp.classList.toggle('primary', mode === 'path');
  }
  if (bs) {
    bs.classList.toggle('active-tool', mode === 'script');
    bs.classList.toggle('primary', mode === 'script');
  }
  if (sim.robot) {
    sim.robot.vLinear = 0;
    sim.robot.vAngular = 0;
  }
  deps.logUI({
    t: 0,
    msg: mode === 'script' ? 'Controle: Script.' : 'Controle: Path.',
    category: 'info'
  });
}

/**
 * Compila o código do usuário e grava em `sim.scriptFn`.
 * @param {object} sim
 * @param {string} src
 * @param {{ logUI: Function }} deps
 * @returns {boolean}
 */
export function compileRobotScript(sim, src, deps) {
  try {
    const body = src.includes('function update')
      ? src + '\n; return update;'
      : `function update(sensors, dt) {\n${src}\n}\n; return update;`;
    const fn = new Function(body)();
    if (typeof fn !== 'function') throw new Error('Defina function update(sensors, dt)');
    sim.scriptFn = fn;
    sim.scriptError = null;
    deps.logUI({ t: 0, msg: 'Script aplicado.', category: 'success' });
    return true;
  } catch (err) {
    sim.scriptFn = null;
    sim.scriptError = String(err.message || err);
    deps.logUI({
      t: 0,
      msg: 'Erro no script: ' + sim.scriptError,
      category: 'warning'
    });
    return false;
  }
}

/**
 * Executa o script com setVelocity/stop no window (documentado).
 * @param {object} sim
 * @param {object} robot
 * @param {number} dt
 * @param {{ logUI: Function }} deps
 */
export function runRobotScript(sim, robot, dt, deps) {
  if (!sim.scriptFn) return;
  const sensors = robot.sensorReadings || {};
  try {
    const prevV = window.setVelocity;
    const prevS = window.stop;
    window.setVelocity = (nv, nw) => {
      robot.vLinear = Number(nv) || 0;
      robot.vAngular = Number(nw) || 0;
    };
    window.stop = () => {
      robot.vLinear = 0;
      robot.vAngular = 0;
    };
    sim.scriptFn(sensors, dt);
    window.setVelocity = prevV;
    window.stop = prevS;
  } catch (err) {
    robot.vLinear = 0;
    robot.vAngular = 0;
    if (!sim.scriptError) {
      sim.scriptError = String(err.message || err);
      deps.logUI({
        t: sim.time,
        msg: 'Runtime script: ' + sim.scriptError,
        category: 'warning'
      });
    }
  }
}

/**
 * Liga botões Path/Script e aplicar/exemplo.
 * @param {object} sim
 * @param {{ logUI: Function }} deps
 */
export function wireRobotScriptUI(sim, deps) {
  document.getElementById('btnControlPath')?.addEventListener('click', () =>
    setControlMode(sim, 'path', deps)
  );
  document.getElementById('btnControlScript')?.addEventListener('click', () =>
    setControlMode(sim, 'script', deps)
  );
  document.getElementById('btnScriptApply')?.addEventListener('click', () => {
    compileRobotScript(sim, document.getElementById('robotScript')?.value || '', deps);
    setControlMode(sim, 'script', deps);
  });
  document.getElementById('btnScriptExample')?.addEventListener('click', () => {
    const ex = `// Seguidor de linha (line_left / line_right)
function update(sensors, dt) {
  const L = sensors.line_left ? sensors.line_left.lum : 200;
  const R = sensors.line_right ? sensors.line_right.lum : 200;
  const leftOn = L < 80;
  const rightOn = R < 80;
  if (leftOn && rightOn) setVelocity(50, 0);
  else if (leftOn) setVelocity(30, -1.2);
  else if (rightOn) setVelocity(30, 1.2);
  else setVelocity(35, 0.4);
}`;
    const ta = document.getElementById('robotScript');
    if (ta) ta.value = ex;
  });
}
