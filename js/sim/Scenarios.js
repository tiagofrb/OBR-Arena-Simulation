/**
 * Cenários de demonstração da simulação (build + path + objetos).
 */
import { TILE_PX } from '../core/constants.js';
import { Tile, TileType, Vec } from '../engine/Models.js';

export const scenarios = {
  basic: {
    name: 'Trajeto Básico + Obstáculo',
    help: 'Obstáculo 20 pts, checkpoint, chegada.',
    build() {
      const t = [];
      for (let i = 0; i < 8; i++) {
        let type = TileType.STRAIGHT;
        if (i === 0) type = TileType.START;
        if (i === 7) type = TileType.FINISH;
        if (i === 5) type = TileType.CHECKPOINT;
        t.push(new Tile(i, 2, type));
      }
      return t;
    },
    objects() {
      return [{ gx: 3, gy: 2, type: 'obstacle', rotation: 0, points: 20 }];
    },
    path(tiles) {
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const t = tiles[i];
        const cx = t.worldX + TILE_PX / 2,
          cy = t.worldY + TILE_PX / 2;
        if (i === 3) {
          pts.push(
            new Vec(cx - 18, cy),
            new Vec(cx - 8, cy + 32),
            new Vec(cx + 8, cy + 32),
            new Vec(cx + 18, cy)
          );
        } else pts.push(new Vec(cx, cy));
      }
      return pts;
    }
  },
  gap: {
    name: 'Gap + Lombada',
    help: 'Gap e lombada (10 pts cada).',
    build() {
      const t = [];
      for (let i = 0; i < 7; i++) {
        let type = TileType.STRAIGHT;
        if (i === 0) type = TileType.START;
        if (i === 6) type = TileType.FINISH;
        if (i === 2) type = TileType.GAP;
        if (i === 4) type = TileType.LOMBADA;
        t.push(new Tile(i, 2, type));
      }
      return t;
    },
    path(tiles) {
      return tiles.map(t => new Vec(t.worldX + TILE_PX / 2, t.worldY + TILE_PX / 2));
    }
  },
  intersection: {
    name: 'Interseção com Verde',
    help: 'Virar à esquerda na marcação verde.',
    build() {
      return [
        new Tile(1, 2, TileType.START),
        new Tile(2, 2, TileType.STRAIGHT),
        new Tile(3, 2, TileType.INTERSECTION, { hasGreen: true }),
        new Tile(3, 1, TileType.STRAIGHT),
        new Tile(3, 0, TileType.FINISH),
        new Tile(3, 3, TileType.STRAIGHT),
        new Tile(4, 2, TileType.STRAIGHT)
      ];
    },
    path() {
      return [
        new Vec(1.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(2.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(3.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(3.5 * TILE_PX, 1.5 * TILE_PX),
        new Vec(3.5 * TILE_PX, 0.5 * TILE_PX)
      ];
    }
  },
  rescue: {
    name: 'Sala de Resgate',
    help: 'Entregar vítima viva na área verde (×1.3).',
    build() {
      return [
        new Tile(0, 2, TileType.START),
        new Tile(1, 2, TileType.STRAIGHT),
        new Tile(2, 2, TileType.RESCUE_ENTRY),
        new Tile(3, 1, TileType.RESCUE_GREEN),
        new Tile(4, 1, TileType.RESCUE),
        new Tile(3, 2, TileType.RESCUE),
        new Tile(4, 2, TileType.RESCUE_RED),
        new Tile(5, 2, TileType.RESCUE_EXIT),
        new Tile(6, 2, TileType.STRAIGHT),
        new Tile(7, 2, TileType.FINISH)
      ];
    },
    path() {
      return [
        new Vec(0.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(1.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(2.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(3.3 * TILE_PX, 1.7 * TILE_PX),
        new Vec(3.5 * TILE_PX, 1.5 * TILE_PX),
        new Vec(3.7 * TILE_PX, 1.9 * TILE_PX),
        new Vec(4.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(5.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(6.5 * TILE_PX, 2.5 * TILE_PX),
        new Vec(7.5 * TILE_PX, 2.5 * TILE_PX)
      ];
    }
  }
};
