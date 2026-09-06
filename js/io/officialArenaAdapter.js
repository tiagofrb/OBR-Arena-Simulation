/**
 * Detecção e conversão de arenas no formato oficial (tileSet + tiles como objeto).
 * Inclui export reverso: formato interno → oficial.
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
 */
export function convertOfficialArena(data) {
  const gridW = data.width || 10;
  const gridH = data.length || data.height || 6; // "length" no oficial = altura
  const tiles = [];
  const objects = [];

  for (const key of Object.keys(data.tiles || {})) {
    const t = data.tiles[key];
    if (t.z && t.z !== 0) continue; // só térreo por ora

    const tt = t.tileType || {};
    const cls = classifyOfficialTile(tt);

    tiles.push({
      gx: t.x,
      gy: t.y,
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
        ...(cls.note ? { officialNote: cls.note } : {})
      },
      custom: null,
      markStart: !!t.start,
      markFinish: cls.type === 'rescue_exit',
      markCheckpoint: false
    });

    const items = t.items || {};
    for (let i = 0; i < (items.obstacles || 0); i++) {
      objects.push({ gx: t.x, gy: t.y, type: 'obstacle', rotation: 0, points: 20 });
    }
    for (let i = 0; i < (items.speedbumps || 0); i++) {
      objects.push({ gx: t.x, gy: t.y, type: 'lombada', rotation: 0, points: 10 });
    }
  }

  return {
    gridW,
    gridH,
    tiles,
    objects,
    meta: {
      importedFrom: 'official',
      name: data.name || null,
      duration: data.duration || null,
      victims: data.victims || null,
      tileSet: data.tileSet || null,
      height: data.height || 1
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
 * Converte arena interna do app → formato oficial OBR
 * @param {{ gridW, gridH, tiles, objects, meta? }} arena
 */
export function convertToOfficialArena(arena) {
  const gridW = arena.gridW || 10;
  const gridH = arena.gridH || 6;
  const meta = arena.meta || {};
  const tilesIn = (arena.tiles || []).filter(t => t && t.type && t.type !== 'empty');
  const objects = arena.objects || [];

  // Agrupa objetos por célula
  const itemsAt = new Map(); // key "x,y" → { obstacles, speedbumps }
  for (const o of objects) {
    const k = `${o.gx},${o.gy}`;
    if (!itemsAt.has(k)) itemsAt.set(k, { obstacles: 0, speedbumps: 0, rampPoints: false });
    const it = itemsAt.get(k);
    if (o.type === 'obstacle') it.obstacles += 1;
    else if (o.type === 'lombada') it.speedbumps += 1;
  }

  const tiles = {};
  let startTile = { x: -1, y: -1, z: -1 };

  for (const t of tilesIn) {
    const x = t.gx;
    const y = t.gy;
    const z = 0;
    const key = `${x},${y},${z}`;
    const cellItems = itemsAt.get(`${x},${y}`) || { obstacles: 0, speedbumps: 0, rampPoints: false };

    const entry = {
      rot: t.rotation || 0,
      tileType: tileTypeFromInternal(t),
      items: {
        obstacles: cellItems.obstacles,
        speedbumps: cellItems.speedbumps,
        rampPoints: !!cellItems.rampPoints
      },
      index: [],
      next: [],
      x,
      y,
      z
    };

    if (t.markStart || t.type === 'start') {
      entry.start = true;
      startTile = { x, y, z };
    }

    tiles[key] = entry;
  }

  return {
    tileSet: meta.tileSet || 'exported-from-obr-judge-trainer',
    name: meta.name || 'arena-export',
    length: gridH,
    height: meta.height || 1,
    width: gridW,
    duration: meta.duration != null ? meta.duration : 480,
    startTile,
    startTile2: { x: -1, y: -1, z: -1 },
    tiles,
    victims: meta.victims || { live: 0, dead: 0 }
  };
}

/** Caminho de asset para imagem oficial (quando os PNGs existirem) */
export function getOfficialTileImagePath(filename) {
  if (!filename) return null;
  // sanitiza só o nome do arquivo
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

export default {
  isOfficialArenaFormat,
  convertOfficialArena,
  convertToOfficialArena,
  getOfficialTileImagePath,
  getCachedOfficialImage,
  preloadOfficialImage
};
