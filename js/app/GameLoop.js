/**
 * Loop principal de animação e wiring de resize do canvas.
 * Erros em update/draw são capturados para o RAF não morrer
 * (app “congelado” se uma exceção interromper o loop).
 */

/**
 * Inicia o requestAnimationFrame loop.
 * @param {object} sim
 * @param {{ update: (dt: number) => void, draw: () => void }} deps
 */
export function startGameLoop(sim, deps) {
  function loop() {
    try {
      if (sim.mode === 'sim' && sim.running) {
        deps.update(sim.dt * sim.speed);
        deps.draw();
      } else if (sim.mode === 'manual') {
        deps.update(sim.dt * sim.speed);
        deps.draw();
      }
    } catch (err) {
      console.error('[GameLoop]', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

/**
 * Liga o listener de resize da janela (idempotente).
 * @param {() => void} resizeCanvas
 */
export function wireResize(resizeCanvas) {
  if (wireResize._wired) return;
  wireResize._wired = true;
  window.addEventListener('resize', () => {
    try {
      resizeCanvas();
    } catch (err) {
      console.error('[resize]', err);
    }
  });
}
