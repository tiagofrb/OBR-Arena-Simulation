/** Modelos base: Vec, Tile, Robot, constantes */

export const TILE_PX = 72;
export const LINE_W = 4;

export class Vec {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  add(v) { return new Vec(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec(this.x - v.x, this.y - v.y); }
  mul(s) { return new Vec(this.x * s, this.y * s); }
  len() { return Math.hypot(this.x, this.y); }
  norm() { const l = this.len() || 1; return new Vec(this.x / l, this.y / l); }
}

/** Transforma ponto normalizado (0–1 no ladrilho) com rotação e espelhos */
export function transformPoint(nx, ny, rot, mirH, mirV) {
  let x = nx, y = ny;
  if (mirH) x = 1 - x;
  if (mirV) y = 1 - y;
  const cx = x - 0.5, cy = y - 0.5;
  let rx = cx, ry = cy;
  const r = ((rot % 360) + 360) % 360;
  if (r === 90) { rx = -cy; ry = cx; }
  else if (r === 180) { rx = -cx; ry = -cy; }
  else if (r === 270) { rx = cy; ry = -cx; }
  return { x: rx + 0.5, y: ry + 0.5 };
}

export function inverseTransform(nx, ny, rot, mirH, mirV) {
  let x = nx - 0.5, y = ny - 0.5;
  const r = ((rot % 360) + 360) % 360;
  let rx = x, ry = y;
  if (r === 90) { rx = y; ry = -x; }
  else if (r === 180) { rx = -x; ry = -y; }
  else if (r === 270) { rx = -y; ry = x; }
  x = rx + 0.5; y = ry + 0.5;
  if (mirV) y = 1 - y;
  if (mirH) x = 1 - x;
  return { x, y };
}

export const TileType = {
  EMPTY: 'empty',
  START: 'start',
  FINISH: 'finish',
  STRAIGHT: 'straight',
  CURVE90: 'curve90',
  OBSTACLE: 'obstacle',
  GAP: 'gap',
  CHECKPOINT: 'checkpoint',
  INTERSECTION: 'intersection',
  INTERSECTION_T: 'intersection_t',
  LOMBADA: 'lombada',
  GANGORRA: 'gangorra',
  RAMPA: 'rampa',
  DEADEND: 'deadend',
  RESCUE_ENTRY: 'rescue_entry',
  RESCUE: 'rescue',
  RESCUE_GREEN: 'rescue_green',
  RESCUE_RED: 'rescue_red',
  RESCUE_EXIT: 'rescue_exit',
  CUSTOM: 'custom'
};

export const TILE_LABELS = {
  start: 'Start', finish: 'Chegada', straight: 'Reta', curve90: 'Curva 90°',
  obstacle: 'Obstáculo', gap: 'Gap', checkpoint: 'Checkpoint',
  intersection: 'Interseção +', intersection_t: 'Interseção T',
  lombada: 'Lombada', gangorra: 'Gangorra', rampa: 'Rampa', deadend: 'Beco',
  rescue_entry: 'Entrada', rescue: 'Resgate', rescue_green: 'Área Verde',
  rescue_red: 'Área Vermelha', rescue_exit: 'Saída', custom: 'Custom', erase: 'Apagar'
};

export class Tile {
  constructor(gx, gy, type = TileType.EMPTY, opts = {}) {
    this.gx = gx;
    this.gy = gy;
    this.type = type;
    this.opts = opts || {};
    this.rotation = opts.rotation || 0;
    this.mirrorH = !!opts.mirrorH;
    this.mirrorV = !!opts.mirrorV;
    this.scored = false;
    this.custom = opts.custom || null;
    // marcadores independentes do tipo de piso (podem coexistir com reta/curva/custom)
    this.markStart = !!opts.markStart;
    this.markFinish = !!opts.markFinish;
    this.markCheckpoint = !!opts.markCheckpoint;
  }
  get worldX() { return this.gx * TILE_PX; }
  get worldY() { return this.gy * TILE_PX; }
  get id() { return `${this.gx},${this.gy}`; }

  clone() {
    const t = new Tile(this.gx, this.gy, this.type, { ...this.opts });
    t.rotation = this.rotation;
    t.mirrorH = this.mirrorH;
    t.mirrorV = this.mirrorV;
    t.custom = this.custom ? JSON.parse(JSON.stringify(this.custom)) : null;
    t.markStart = this.markStart;
    t.markFinish = this.markFinish;
    t.markCheckpoint = this.markCheckpoint;
    return t;
  }

  /** true se este ladrilho conta como início (tipo ou marcador) */
  isStart() {
    return this.type === TileType.START || this.markStart;
  }
  isFinish() {
    return this.type === TileType.FINISH || this.markFinish;
  }
  isCheckpoint() {
    return this.type === TileType.CHECKPOINT || this.markCheckpoint;
  }

  toJSON() {
    return {
      gx: this.gx, gy: this.gy, type: this.type,
      rotation: this.rotation, mirrorH: this.mirrorH, mirrorV: this.mirrorV,
      opts: this.opts, custom: this.custom,
      markStart: this.markStart, markFinish: this.markFinish, markCheckpoint: this.markCheckpoint
    };
  }

  static fromJSON(o) {
    const t = new Tile(o.gx, o.gy, o.type, o.opts || {});
    t.rotation = o.rotation || 0;
    t.mirrorH = !!o.mirrorH;
    t.mirrorV = !!o.mirrorV;
    t.custom = o.custom || null;
    t.markStart = !!o.markStart || o.type === TileType.START;
    t.markFinish = !!o.markFinish || o.type === TileType.FINISH;
    t.markCheckpoint = !!o.markCheckpoint || o.type === TileType.CHECKPOINT;
    return t;
  }
}

export class Robot {
  constructor(x = 0, y = 0, angle = 0) {
    this.pos = new Vec(x, y);
    this.angle = angle;
    this.width = 26;
    this.height = 34;
    this.pathIndex = 0;
    this.carrying = null; // 'alive' | 'dead' | null
    // controle por script (mm/s e rad/s) — só move o sprite
    this.vLinear = 0;
    this.vAngular = 0;
    // definição ativa de detectores (opcional)
    this.definition = null;
    this.sensorReadings = {};
  }
}
