/**
 * Detecção e conversão bidirecional de arenas no formato oficial RCJ/OBR
 * (tileSet + tiles como objeto chave "x,y,z").
 *
 * Compatível com o export do Line Map Editor 2024
 * (robocup-junior/rcj-rescue-cms).
 */

import { classifyOfficialTile } from './officialTileClassifier.js';

export function isOfficialArenaFormat(data) {
  return !!(
    data &&
    data.tileSet &&
    data.tiles &&
    typeof data.tiles === 'object' &&
    !Array.isArray(data.tiles)
  );
}

/**
 * Converte arena oficial → formato interno do app
 * { gridW, gridH, tiles[], objects[], meta }
 *
 * Preserva: start/start2, checkpoint, levelUp/Down, rampPoints,
 * obstacles/speedbumps, z (andares), duration, victims, finished.
 */
export function convertOfficialArena(data) {
  const gridW = data.width || 10;
  const gridH = data.length || data.height || 6; // "length" no oficial = profundidade (Y)
  const floorCount = Math.max(1, data.height || 1); // "height" = número de andares
  const tiles = [];
  const objects = [];

  for (const key of Object.keys(data.tiles || {})) {
    const t = data.tiles[key];
    const z = t.z != null ? t.z : 0;

    const tt = t.tileType || {};
    const cls = classifyOfficialTile(tt);
    const items = t.items || {};

    const tile = {
      gx: t.x,
      gy: t.y,
      gz: z,
      type: cls.type,
      rotation: t.rot || 0,
      mirrorH: false,
      mirrorV: false,
      opts: {
        ...(cls.extra || {}),
        officialId: tt._id,
        officialImage: tt.image,
        officialPaths: tt.paths,
        officialGaps: tt.gaps || 0,
        officialSeesaw: tt.seesaw || 0,
        officialIntersections: tt.intersections || 0,
        rampPoints: !!items.rampPoints,
        levelUp: t.levelUp || undefined,
        levelDown: t.levelDown || undefined,
        obstacles: items.obstacles || 0,
        speedbumps: items.speedbumps || 0,
        ...(cls.note ? { officialNote: cls.note } : {})
      },
      custom: null,
      markStart: !!t.start,
      markStart2: !!t.start2,
      markFinish: cls.type === 'rescue_exit',
      markCheckpoint: !!t.checkpoint
    };
    tiles.push(tile);

    // Objetos derivados dos contadores oficiais (apenas no térreo visualizado
    // ou em todos os andares — o app de simulação usa o mesmo grid X/Y)
    const obstN = items.obstacles || 0;
    for (let i = 0; i < obstN; i++) {
      objects.push({
        gx: t.x, gy: t.y, gz: z,
        type: 'obstacle', rotation: 0, points: 20
      });
    }
    const bumpN = items.speedbumps || 0;
    for (let i = 0; i < bumpN; i++) {
      objects.push({
        gx: t.x, gy: t.y, gz: z,
        type: 'lombada', rotation: 0, points: 10
      });
    }
  }

  // startTile / startTile2 oficiais (podem existir mesmo sem flag no tile)
  const st = data.startTile || { x: -1, y: -1, z: -1 };
  const st2 = data.startTile2 || { x: -1, y: -1, z: -1 };
  if (st.x >= 0 && st.y >= 0) {
    const found = tiles.find(t => t.gx === st.x && t.gy === st.y && (t.gz || 0) === (st.z || 0));
    if (found) found.markStart = true;
  }
  if (st2.x >= 0 && st2.y >= 0) {
    const found = tiles.find(t => t.gx === st2.x && t.gy === st2.y && (t.gz || 0) === (st2.z || 0));
    if (found) found.markStart2 = true;
  }

  return {
    gridW,
    gridH,
    tiles,
    objects,
    meta: {
      importedFrom: 'official',
      name: data.name || null,
      duration: data.duration != null ? data.duration : 480,
      victims: data.victims || { live: 0, dead: 0 },
      tileSet: data.tileSet || null,
      height: floorCount,
      finished: !!data.finished,
      startTile: st,
      startTile2: st2
    }
  };
}

/** Paths padrão quando o tile não veio do oficial (aprox. por tipo do app) */
function defaultPathsForType(type) {
  switch (type) {
    case 'straight':
    case 'start':
    case 'finish':
    case 'checkpoint':
    case 'lombada':
    case 'gap':
      return { left: 'right', right: 'left' };
    case 'curve90':
      return { bottom: 'left', left: 'bottom' };
    case 'intersection':
      return { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
    case 'intersection_t':
      return { left: 'right', right: 'left', bottom: 'top' };
    case 'deadend':
      return { left: 'right' };
    case 'gangorra':
      return { left: 'right', right: 'left' };
    case 'rescue':
    case 'rescue_entry':
    case 'rescue_exit':
    case 'rescue_green':
    case 'rescue_red':
      return {};
    default:
      return {};
  }
}

function defaultImageForType(type) {
  switch (type) {
    case 'gangorra': return 'seesaw.png';
    case 'rescue_exit': return 'exit.png';
    case 'rescue':
    case 'rescue_green':
    case 'rescue_red':
    case 'rescue_entry':
      return 'ev1.png';
    default:
      return null;
  }
}

/**
 * Reconstrói tileType oficial a partir de um tile interno do app.
 */
function tileTypeFromInternal(tile) {
  const opts = tile.opts || {};
  const type = tile.type;

  const paths = opts.officialPaths || defaultPathsForType(type);
  const image = opts.officialImage || defaultImageForType(type) || 'tile-0.png';
  const gaps = opts.officialGaps != null
    ? opts.officialGaps
    : (opts.gaps != null ? opts.gaps : (type === 'gap' ? 1 : 0));
  const seesaw = opts.officialSeesaw != null
    ? opts.officialSeesaw
    : (type === 'gangorra' ? 1 : 0);
  const intersections = opts.officialIntersections || 0;

  const tt = {
    gaps: gaps || 0,
    intersections: intersections || 0,
    seesaw: seesaw || 0,
    image,
    paths: paths || {}
  };
  if (opts.officialId) tt._id = opts.officialId;
  return tt;
}

/**
 * Converte arena interna do app → formato oficial RCJ/OBR
 * @param {{ gridW, gridH, tiles, objects, meta? }} arena
 */
export function convertToOfficialArena(arena) {
  const gridW = arena.gridW || 10;
  const gridH = arena.gridH || 6;
  const meta = arena.meta || {};
  const floorCount = Math.max(1, meta.height || 1);
  const tilesIn = (arena.tiles || []).filter(t => t && t.type && t.type !== 'empty');
  const objects = arena.objects || [];

  // Agrupa objetos por célula (inclui z)
  const itemsAt = new Map(); // key "x,y,z" → { obstacles, speedbumps, rampPoints }
  for (const o of objects) {
    const z = o.gz != null ? o.gz : 0;
    const k = `${o.gx},${o.gy},${z}`;
    if (!itemsAt.has(k)) itemsAt.set(k, { obstacles: 0, speedbumps: 0, rampPoints: false });
    const it = itemsAt.get(k);
    if (o.type === 'obstacle') it.obstacles += 1;
    else if (o.type === 'lombada') it.speedbumps += 1;
  }

  const tiles = {};
  let startTile = { x: -1, y: -1, z: -1 };
  let startTile2 = { x: -1, y: -1, z: -1 };

  for (const t of tilesIn) {
    const x = t.gx;
    const y = t.gy;
    const z = t.gz != null ? t.gz : 0;
    const key = `${x},${y},${z}`;
    const cellItems = itemsAt.get(key) || { obstacles: 0, speedbumps: 0, rampPoints: false };

    // Prefer contadores em opts (editados no modal) sobre objetos derivados
    const obstacles = (t.opts && t.opts.obstacles != null)
      ? t.opts.obstacles
      : cellItems.obstacles;
    const speedbumps = (t.opts && t.opts.speedbumps != null)
      ? t.opts.speedbumps
      : cellItems.speedbumps;
    const rampPoints = !!(t.opts && t.opts.rampPoints) || !!cellItems.rampPoints;

    const entry = {
      rot: t.rotation || 0,
      tileType: tileTypeFromInternal(t),
      items: {
        obstacles: obstacles || 0,
        speedbumps: speedbumps || 0,
        rampPoints
      },
      index: [],
      next: [],
      x,
      y,
      z
    };

    if (t.opts && t.opts.levelUp) entry.levelUp = t.opts.levelUp;
    if (t.opts && t.opts.levelDown) entry.levelDown = t.opts.levelDown;

    if (t.markStart || t.type === 'start') {
      entry.start = true;
      startTile = { x, y, z };
    }
    if (t.markStart2) {
      entry.start2 = true;
      startTile2 = { x, y, z };
    }
    if (t.markCheckpoint || t.type === 'checkpoint') {
      entry.checkpoint = true;
    }

    tiles[key] = entry;
  }

  // Só usa meta se nenhum tile tiver a flag (tiles têm prioridade)
  if (startTile.x < 0 && meta.startTile && meta.startTile.x >= 0) startTile = meta.startTile;
  if (startTile2.x < 0 && meta.startTile2 && meta.startTile2.x >= 0) startTile2 = meta.startTile2;

  return {
    tileSet: meta.tileSet || 'exported-from-obr-judge-trainer',
    name: meta.name || 'arena-export',
    length: gridH,
    height: floorCount,
    width: gridW,
    duration: meta.duration != null ? meta.duration : 480,
    finished: !!meta.finished,
    startTile,
    startTile2,
    tiles,
    victims: meta.victims || { live: 0, dead: 0 }
  };
}

/** Caminho de asset para imagem oficial (quando os PNGs existirem) */
export function getOfficialTileImagePath(filename) {
  if (!filename) return null;
  const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '');
  return `assets/official-tiles/${safe}`;
}

const _imgCache = new Map();

export function getCachedOfficialImage(filename) {
  if (!filename) return null;
  if (_imgCache.has(filename)) return _imgCache.get(filename);
  const img = new Image();
  img.src = getOfficialTileImagePath(filename);
  _imgCache.set(filename, img);
  return img;
}

export function preloadOfficialImage(filename) {
  return getCachedOfficialImage(filename);
}

/**
 * Valida mapa no formato oficial (ex.: finished exige startTile).
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateOfficialMap(map) {
  const errors = [];
  if (!map || typeof map !== 'object') {
    return { ok: false, errors: ['Mapa inválido'] };
  }
  if (!map.tiles || typeof map.tiles !== 'object') {
    errors.push('Campo tiles ausente');
  }
  const st = map.startTile || { x: -1, y: -1, z: -1 };
  if (map.finished && (st.x < 0 || st.y < 0)) {
    errors.push('Mapa marcado como finalizado, mas nenhum tile de início (start) foi definido');
  }
  return { ok: errors.length === 0, errors };
}

export default {
  isOfficialArenaFormat,
  convertOfficialArena,
  convertToOfficialArena,
  getOfficialTileImagePath,
  getCachedOfficialImage,
  preloadOfficialImage,
  validateOfficialMap
};
