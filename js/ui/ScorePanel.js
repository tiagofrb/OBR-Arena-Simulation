/**
 * Placar e log de eventos da simulação.
 * Funções puras de DOM — recebem `sim` / evento; sem estado interno.
 */

/**
 * Atualiza os elementos de pontuação a partir de `sim.score`.
 * @param {{ score: { total: number, trajeto: number, checkpoints: number, finish: number, multiplier: number, fails: number } }} sim
 */
export function updateScoreUI(sim) {
  const total = document.getElementById('totalScore');
  if (total) total.textContent = sim.score.total;
  const trajeto = document.getElementById('scoreTrajeto');
  if (trajeto) trajeto.textContent = sim.score.trajeto;
  const cp = document.getElementById('scoreCP');
  if (cp) cp.textContent = sim.score.checkpoints;
  const finish = document.getElementById('scoreFinish');
  if (finish) finish.textContent = sim.score.finish;
  const mult = document.getElementById('scoreMult');
  if (mult) mult.textContent = '×' + sim.score.multiplier.toFixed(2);
  const fails = document.getElementById('failCount');
  if (fails) fails.textContent = sim.score.fails;
}

/**
 * Acrescenta uma linha no log de eventos.
 * @param {{ t?: number, msg: string, category?: string, points?: number }} ev
 */
export function logUI(ev) {
  const log = document.getElementById('eventLog');
  if (!log) return;
  const div = document.createElement('div');
  div.className = 'event ' + (ev.category || 'info');
  div.innerHTML = `<span class="time">${(ev.t || 0).toFixed(1)}s</span> ${ev.msg}${ev.points ? ` <strong>+${ev.points}</strong>` : ''}`;
  log.prepend(div);
}

/** Limpa o log de eventos. */
export function clearLog() {
  const log = document.getElementById('eventLog');
  if (log) log.innerHTML = '';
}
