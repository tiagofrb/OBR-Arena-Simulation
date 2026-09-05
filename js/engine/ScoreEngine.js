/** ScoreEngine — regras OBR 2026 (parcial) */
export class ScoreEngine {
  constructor() { this.reset(); }

  reset() {
    this.trajeto = 0;
    this.checkpoints = 0;
    this.finish = 0;
    this.multiplier = 1;
    this.fails = 0;
    this.events = [];
    this.scoredHazards = new Set();
  }

  get total() {
    return Math.ceil((this.trajeto + this.checkpoints + this.finish) * this.multiplier);
  }

  addEvent(type, points, msg, category = 'info', time = 0) {
    const ev = { t: time, type, points, msg, category };
    this.events.unshift(ev);
    if (this.events.length > 60) this.events.pop();
    return ev;
  }

  scoreHazard(id, points, msg, time = 0) {
    if (this.scoredHazards.has(id)) return null;
    this.scoredHazards.add(id);
    this.trajeto += points;
    return this.addEvent('hazard', points, msg, 'success', time);
  }

  scoreCheckpoint(tiles, attempt, time = 0) {
    const ptsPer = attempt === 1 ? 5 : attempt === 2 ? 3 : attempt === 3 ? 1 : 0;
    const pts = tiles * ptsPer;
    this.checkpoints += pts;
    return this.addEvent('checkpoint', pts, `Checkpoint: ${tiles}×${ptsPer} pts (tent. ${attempt})`, 'success', time);
  }

  scoreFinish(time = 0) {
    this.finish = Math.max(0, 60 - 5 * this.fails);
    return this.addEvent('finish', this.finish, `Chegada: 60−5×${this.fails}=${this.finish}`, 'success', time);
  }

  addFail(reason, time = 0) {
    this.fails++;
    return this.addEvent('fail', 0, `Falha #${this.fails}: ${reason}`, 'fail', time);
  }

  addMultiplier(f, reason, time = 0) {
    this.multiplier *= f;
    return this.addEvent('mult', 0, `Mult ×${f.toFixed(2)} — ${reason}`, 'warning', time);
  }
}
