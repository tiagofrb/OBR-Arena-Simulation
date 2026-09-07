/**
 * Constantes nomeadas do projeto.
 * Valores mágicos que carregam significado devem viver aqui e ser documentados.
 */

/** Tamanho de um ladrilho em pixels na tela (renderização). */
export const TILE_PX = 72;

/** Largura da linha de pista em pixels. */
export const LINE_W = 4;

/** Tamanho físico do ladrilho em mm (especificação OBR / RCJ). */
export const TILE_MM = 300;

/** Conversão mm → mundo (pixels de simulação). */
export const MM_TO_WORLD = TILE_PX / TILE_MM;

/** Dimensão padrão do construtor (canvas 300×300 mm, 1 px = 1 mm). */
export const CTOR_SIZE_MM = 300;

/** Padding da câmera ao encaixar a arena (px CSS). */
export const CAMERA_FIT_PAD = 24;

/** Zoom máximo ao auto-fit. */
export const CAMERA_MAX_FIT_SCALE = 2.5;

/** Zoom mínimo permitido. */
export const CAMERA_MIN_SCALE = 0.15;

/** Tamanho máximo do histórico de undo da arena. */
export const ARENA_HISTORY_MAX = 40;

/** Grade padrão ao iniciar (largura × altura em ladrilhos). */
export const DEFAULT_GRID_W = 10;
export const DEFAULT_GRID_H = 6;

/** Chaves de persistência (localStorage / IndexedDB). */
export const STORAGE_KEYS = {
  CUSTOM_TILES: 'obr_custom_tiles',
  CUSTOM_ARENA: 'obr_custom_arena',
  CUSTOM_ARENA_OBJECTS: 'obr_custom_arena_objects',
  CUSTOM_OBJECTS: 'obr_custom_objects',
  ROBOT_LIBRARY: 'obr_robot_library',
  CUSTOM_MODE: 'obr_custom_mode'
};

/** Modos de aplicação (abas). */
export const APP_MODES = {
  EDITOR: 'editor',
  SIM: 'sim',
  MANUAL: 'manual',
  CONSTRUCTOR: 'constructor',
  OBJ_CONSTRUCTOR: 'objconstructor',
  ROBOT: 'robot'
};

/** Camadas do editor. */
export const EDITOR_LAYERS = {
  OFFICIAL: 'official',
  TILES: 'tiles',
  OBJECTS: 'objects'
};
