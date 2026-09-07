/**
 * Loop principal de animação e wiring de resize do canvas.
 */

/**
 * Inicia o requestAnimationFrame loop.
 * @param {object} sim
 * @param {{ update: (dt: number) => void, draw: () => void }} deps
 */
export function startGameLoop(sim, deps) {
  function loop() {
    if (sim.mode === 'sim' && sim.running) {
      deps.update(sim.dt * sim.speed);
      deps.draw();
    } else if (sim.mode === 'manual') {
      deps.update(sim.dt * sim.speed);
      deps.draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

/**
 * Liga o listener de resize da janela.
 * @param {() => void} resizeCanvas
 */
export function wireResize(resizeCanvas) {
  window.addEventListener('resize', () => resizeCanvas());
}
