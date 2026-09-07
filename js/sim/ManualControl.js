/**
 * Controle manual (WASD / setas / QE) → atualiza pose do robô.
 */
import {
  MANUAL_LINEAR_SPEED,
  MANUAL_ANGULAR_SPEED
} from '../core/constants.js';

/**
 * Aplica teclas de `sim.keys` à pose do robô.
 * @param {object} sim
 * @param {object} robot
 * @param {number} dt
 */
export function applyManualControl(sim, robot, dt) {
  const speed = MANUAL_LINEAR_SPEED * sim.speed;
  const rot = MANUAL_ANGULAR_SPEED * sim.speed;
  let dx = 0,
    dy = 0;
  if (sim.keys['ArrowUp'] || sim.keys['w'] || sim.keys['W']) {
    dx += Math.sin(robot.angle) * speed * dt;
    dy -= Math.cos(robot.angle) * speed * dt;
  }
  if (sim.keys['ArrowDown'] || sim.keys['s'] || sim.keys['S']) {
    dx -= Math.sin(robot.angle) * speed * dt;
    dy += Math.cos(robot.angle) * speed * dt;
  }
  if (sim.keys['ArrowLeft'] || sim.keys['a'] || sim.keys['A']) robot.angle -= rot * dt;
  if (sim.keys['ArrowRight'] || sim.keys['d'] || sim.keys['D']) robot.angle += rot * dt;
  if (sim.keys['q'] || sim.keys['Q']) robot.angle -= rot * dt;
  if (sim.keys['e'] || sim.keys['E']) robot.angle += rot * dt;
  robot.pos.x += dx;
  robot.pos.y += dy;
}
