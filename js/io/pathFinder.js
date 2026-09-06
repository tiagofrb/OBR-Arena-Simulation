/**
 * Pathfinding automático compatível com RCJ Line Map Editor
 * (public/javascripts/pathFinder.js do robocup-junior/rcj-rescue-cms).
 *
 * Percorre a linha a partir de startTile, preenche `index[]` e `next[]`
 * em cada tile e calcula indexCount / EvacuationAreaLoPIndex.
 */

function flipDir(dir) {
  switch (dir) {
    case 'top': return 'bottom';
    case 'right': return 'left';
    case 'bottom': return 'top';
    case 'left': return 'right';
    default: return dir;
  }
}

function rotateDir(dir, rot) {
  const r = ((rot % 360) + 360) % 360;
  if (r === 0) return dir;
  if (r === 90) {
    switch (dir) {
      case 'top': return 'right';
      case 'right': return 'bottom';
      case 'bottom': return 'left';
      case 'left': return 'top';
    }
  }
  if (r === 180) return flipDir(dir);
  if (r === 270) {
    switch (dir) {
      case 'top': return 'left';
      case 'right': return 'top';
      case 'bottom': return 'right';
      case 'left': return 'bottom';
    }
  }
  return dir;
}

function exitDir(curTile, entryDir) {
  const dir = rotateDir(entryDir, -curTile.rot);
  const paths = (curTile.tileType && curTile.tileType.paths) || {};
  const exitLocal = paths[dir];
  if (!exitLocal) return entryDir;
  return rotateDir(exitLocal, curTile.rot);
}

function nextCoord(curTile, entryDir) {
  const exit = exitDir(curTile, entryDir);
  let coord;
  switch (exit) {
    case 'top':
      coord = curTile.x + ',' + (curTile.y - 1);
      break;
    case 'right':
      coord = (curTile.x + 1) + ',' + curTile.y;
      break;
    case 'bottom':
      coord = curTile.x + ',' + (curTile.y + 1);
      break;
    case 'left':
      coord = (curTile.x - 1) + ',' + curTile.y;
      break;
    default:
      return null;
  }
  if (curTile.levelUp !== undefined && exit === curTile.levelUp) {
    coord += ',' + (curTile.z + 1);
  } else if (curTile.levelDown !== undefined && exit === curTile.levelDown) {
    coord += ',' + (curTile.z - 1);
  } else {
    coord += ',' + curTile.z;
  }
  return coord;
}

function fromCoord(curTile, fromDir) {
  let coord;
  switch (fromDir) {
    case 'top':
      coord = curTile.x + ',' + (curTile.y - 1);
      break;
    case 'right':
      coord = (curTile.x + 1) + ',' + curTile.y;
      break;
    case 'bottom':
      coord = curTile.x + ',' + (curTile.y + 1);
      break;
    case 'left':
      coord = (curTile.x - 1) + ',' + curTile.y;
      break;
    default:
      return null;
  }
  return coord + ',' + curTile.z;
}

function isEvacTile(tile) {
  if (!tile || !tile.tileType) return false;
  const img = tile.tileType.image || '';
  // Zonas de evacuação/resgate oficiais
  if (/^ev[123]\.png$/i.test(img)) return true;
  const id = tile.tileType._id || '';
  // IDs legados do RCJ CMS
  return id === '58cfd6549792e9313b1610e1'
    || id === '58cfd6549792e9313b1610e2'
    || id === '58cfd6549792e9313b1610e3';
}

function isExitTile(tile) {
  if (!tile || !tile.tileType) return false;
  const img = tile.tileType.image || '';
  if (/^exit\.png$/i.test(img)) return true;
  return (tile.tileType._id || '') === '58cfd6549792e9313b1610e0';
}

function dir2num(dir) {
  switch (dir) {
    case 'top': return 0;
    case 'right': return 90;
    case 'bottom': return 180;
    case 'left': return 270;
    default: return 0;
  }
}

/**
 * Executa pathfinding no mapa oficial (mutável).
 * @param {object} map - formato RCJ { tiles, startTile, startTile2, ... }
 * @returns {object} map atualizado
 */
export function pathFinder(map) {
  if (!map || !map.tiles) return map;

  // Limpa índices anteriores
  for (const key of Object.keys(map.tiles)) {
    const t = map.tiles[key];
    t.index = [];
    t.next = [];
    if (t.evacExit != null) delete t.evacExit;
  }

  const tiles = map.tiles;
  const st = map.startTile || { x: -1, y: -1, z: -1 };
  if (st.x < 0) {
    map.indexCount = 0;
    return map;
  }
  const startKey = st.x + ',' + st.y + ',' + (st.z || 0);
  const startTile = tiles[startKey];
  if (!startTile) {
    map.indexCount = 0;
    return map;
  }

  let startDir = '';
  const startPaths = (startTile.tileType && startTile.tileType.paths) || {};
  for (const dir of Object.keys(startPaths)) {
    if (dir === '$init') continue;
    if (!startPaths[dir]) continue;
    const nc = nextCoord(startTile, rotateDir(dir, startTile.rot || 0));
    if (nc && tiles[nc] !== undefined) {
      startDir = rotateDir(dir, startTile.rot || 0);
      break;
    }
  }
  if (!startDir) {
    // fallback: qualquer direção com path
    const keys = Object.keys(startPaths).filter(k => k !== '$init' && startPaths[k]);
    if (keys.length) startDir = rotateDir(keys[0], startTile.rot || 0);
  }

  let lastCheckpointIndex = -1;
  const MAX_STEPS = 2000;

  function traverse(curTile, entryDir, index, chpCount, restartFlag) {
    if (!curTile || index > MAX_STEPS) {
      map.indexCount = index;
      map.EvacuationAreaLoPIndex = chpCount;
      return map;
    }
    if (curTile.checkpoint || curTile.checkPoint) chpCount++;

    const key = curTile.x + ',' + curTile.y + ',' + curTile.z;
    if (!tiles[key].index) tiles[key].index = [];
    if (!tiles[key].next) tiles[key].next = [];
    tiles[key].index.push(index);

    if (curTile.checkpoint || curTile.checkPoint) {
      lastCheckpointIndex = index;
    }

    if (isExitTile(curTile)) {
      map.indexCount = index + 1;
      map.EvacuationAreaLoPIndex = chpCount;
      return map;
    }

    const next_Coord = nextCoord(curTile, entryDir);
    const nextTile = next_Coord ? tiles[next_Coord] : undefined;

    if (nextTile === undefined || isEvacTile(nextTile)) {
      const st2 = map.startTile2 || { x: -1, y: -1, z: -1 };
      const startTile2 = (st2.x >= 0)
        ? tiles[st2.x + ',' + st2.y + ',' + (st2.z || 0)]
        : undefined;

      if (startTile2 === undefined || restartFlag) {
        map.EvacuationAreaLoPIndex = chpCount;
        map.indexCount = index + 1;
        return map;
      }

      let startDir2 = '';
      const startPaths2 = (startTile2.tileType && startTile2.tileType.paths) || {};
      for (const [keyP, value] of Object.entries(startPaths2)) {
        if (keyP === '$init' || !value) continue;
        const entryDir2 = rotateDir(keyP, startTile2.rot || 0);
        const fromKey = fromCoord(startTile2, entryDir2);
        const fromTile = fromKey ? tiles[fromKey] : undefined;
        if (fromTile !== undefined && isEvacTile(fromTile)) {
          fromTile.evacExit = dir2num(flipDir(entryDir2));
          startDir2 = entryDir2;
          break;
        }
      }
      if (!startDir2) {
        const keys2 = Object.keys(startPaths2).filter(k => k !== '$init' && startPaths2[k]);
        if (keys2.length) startDir2 = rotateDir(keys2[0], startTile2.rot || 0);
      }

      if (next_Coord) tiles[key].next.push(next_Coord);
      map.EvacuationAreaLoPIndex = chpCount;
      return traverse(startTile2, startDir2, index + 1, chpCount, true);
    }

    tiles[key].next.push(next_Coord);
    return traverse(nextTile, flipDir(exitDir(curTile, entryDir)), index + 1, chpCount, restartFlag);
  }

  return traverse(startTile, startDir, 0, 0, false);
}

/**
 * Atualiza index/next no mapa oficial e devolve estatísticas.
 */
export function updateTileIndex(map) {
  const result = pathFinder(map);
  return {
    map: result,
    indexCount: result.indexCount || 0,
    evacuationLoP: result.EvacuationAreaLoPIndex != null ? result.EvacuationAreaLoPIndex : 0
  };
}

export default { pathFinder, updateTileIndex };
