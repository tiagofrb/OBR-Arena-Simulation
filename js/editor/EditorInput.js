/**
 * Input do canvas no modo editor: clique (place/select/markers/objects),
 * pan, picker (botão do meio), context menu, wheel zoom.
 * Também trata clique de posicionar robô no modo manual.
 */

import { TILE_PX } from '../core/constants.js';

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {object} opts.cam
 * @param {object} opts.sim
 * @param {object} opts.deps — callbacks injetados
 */
export function wireEditorInput({ canvas, cam, sim, deps }) {
  const {
    screenToWorld,
    worldToGrid,
    draw,
    logUI,
    pushArenaUndo,
    clearTileSelection,
    fillTilePropsPanel,
    schedulePathfinding,
    classifyOfficialFilename,
    setEditorLayer,
    ensureOfficialPalette,
    selectOfficialTile,
    selectTileTool,
    refreshCustomSelect,
    showTileContextMenu,
    hideTileContextMenu,
    setZoom,
    updateZoomUI,
    Tile,
    Robot,
    TileType
  } = deps;

  canvas.addEventListener('click', e => {
    if (e.button !== 0 || cam.panning) return;
    const w = screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = worldToGrid(w.x, w.y);

    if (sim.mode === 'editor') {
      if (sim.measureMode) {
        if (!sim.measureStart) {
          sim.measureStart = { x: w.x, y: w.y };
        } else {
          const scaleMm = 300 / TILE_PX;
          const distMm =
            Math.hypot(w.x - sim.measureStart.x, w.y - sim.measureStart.y) * scaleMm;
          logUI({
            t: 0,
            msg: `Medição (arena): ${distMm.toFixed(1)} mm`,
            category: 'info'
          });
          sim.measureStart = null;
          sim.measureCursor = null;
        }
        draw();
        return;
      }
      if (gx < 0 || gy < 0 || gx >= sim.gridW || gy >= sim.gridH) {
        if (sim.selectedTile || sim.selectedObject) {
          sim.selectedTile = null;
          sim.selectedObject = null;
          const info = document.getElementById('selectedInfo');
          if (info) info.textContent = '— (seleção)';
          if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(null);
          draw();
        }
        return;
      }
      let tile = sim.tiles.find(t => t.gx === gx && t.gy === gy);
      if (!tile) {
        tile = new Tile(gx, gy);
        sim.tiles.push(tile);
      }

      if (sim.markerTool) {
        if (tile.type === TileType.EMPTY) {
          logUI({
            t: 0,
            msg: 'Coloque um ladrilho de piso antes de marcar.',
            category: 'warning'
          });
          return;
        }
        pushArenaUndo();
        if (sim.markerTool === 'clear') {
          tile.markStart = false;
          tile.markFinish = false;
          tile.markCheckpoint = false;
        } else if (sim.markerTool === 'start') {
          sim.tiles.forEach(tt => {
            if (tt !== tile) tt.markStart = false;
          });
          tile.markStart = !tile.markStart;
        } else if (sim.markerTool === 'finish') {
          tile.markFinish = !tile.markFinish;
        } else if (sim.markerTool === 'checkpoint') {
          tile.markCheckpoint = !tile.markCheckpoint;
        }
        sim.selectedTile = tile;
        sim.selectedObject = null;
        const flags = [
          tile.markStart ? 'START' : null,
          tile.markFinish ? 'CHEGADA' : null,
          tile.markCheckpoint ? 'CP' : null
        ]
          .filter(Boolean)
          .join('+') || 'nenhum';
        document.getElementById('selectedInfo').textContent =
          `${tile.type} @${gx},${gy} [${flags}]`;
        if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(tile);
        draw();
        return;
      }

      if (sim.objectTool) {
        pushArenaUndo();
        if (sim.objectTool === 'erase') {
          sim.objects = sim.objects.filter(o => !(o.gx === gx && o.gy === gy));
          sim.selectedObject = null;
        } else if (sim.objectTool === 'custom') {
          if (!sim.customMode) {
            logUI({
              t: 0,
              msg: 'Modo oficial: objetos personalizados bloqueados.',
              category: 'warning'
            });
            return;
          }
          const osel = document.getElementById('customObjSelect');
          if (osel && osel.value !== '') {
            sim.placingCustomObjId = parseInt(osel.value, 10);
          }
          const oid = sim.placingCustomObjId;
          if (oid != null && Number.isFinite(oid) && sim.customObjLibrary[oid]) {
            const def = JSON.parse(JSON.stringify(sim.customObjLibrary[oid]));
            def._instanceId =
              'o' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            sim.objects = sim.objects.filter(o => !(o.gx === gx && o.gy === gy));
            const obj = {
              gx,
              gy,
              type: 'custom',
              rotation: 0,
              mirrorH: false,
              mirrorV: false,
              custom: def,
              points: def.points,
              _img: null,
              _imgSrc: null,
              _imgToken: null
            };
            sim.objects.push(obj);
            sim.selectedObject = obj;
          }
        } else {
          sim.objects = sim.objects.filter(o => !(o.gx === gx && o.gy === gy));
          const pts = sim.objectTool === 'rampa' ? 10 : 20;
          const obj = {
            gx,
            gy,
            type: sim.objectTool,
            rotation: 0,
            mirrorH: false,
            mirrorV: false,
            points: pts
          };
          sim.objects.push(obj);
          sim.selectedObject = obj;
        }
        document.getElementById('selectedInfo').textContent = sim.selectedObject
          ? `obj ${sim.selectedObject.type} @${gx},${gy}`
          : '—';
        draw();
        return;
      }

      if (
        sim.selectedTool === 'erase' ||
        sim.selectedTool === 'custom' ||
        sim.selectedTool === 'official' ||
        sim.selectedTool
      ) {
        pushArenaUndo();
      }
      if (sim.selectedTool === 'erase') {
        tile.type = TileType.EMPTY;
        tile.custom = null;
        tile.rotation = 0;
        tile.mirrorH = false;
        tile.mirrorV = false;
        tile._img = null;
        tile._imgSrc = null;
        tile._imgToken = null;
        tile.opts = {};
        tile.markStart = false;
        tile.markFinish = false;
        tile.markCheckpoint = false;
        sim.selectedTile = null;
      } else if (sim.selectedTool === 'official' && sim.placingOfficialFile) {
        const file = sim.placingOfficialFile;
        const entry = (sim.officialTileFiles || []).find(x => x.file === file);
        const type = (entry && entry.type) || classifyOfficialFilename(file);
        tile.type = type;
        tile.custom = null;
        tile._img = null;
        tile._imgSrc = null;
        tile._imgToken = null;
        tile.rotation = 0;
        tile.mirrorH = false;
        tile.mirrorV = false;
        tile.opts = {
          officialImage: file,
          officialId: file.replace(/\.png$/i, ''),
          fromOfficialPalette: true
        };
        if (type === 'rescue_exit') tile.markFinish = true;
        tile.gz = sim.currentFloor || 0;
        sim.selectedTile = tile;
        document.getElementById('selectedInfo').textContent =
          `oficial ${file} @${gx},${gy},z${tile.gz}`;
        if (!sim.shiftDown) clearTileSelection();
        fillTilePropsPanel(tile);
      } else if (sim.selectedTool === 'custom') {
        if (!sim.customMode) {
          logUI({
            t: 0,
            msg:
              'Modo oficial ativo: apenas ladrilhos do catálogo OBR. Ative Modo Custom em Backup & dados para usar personalizados.',
            category: 'warning'
          });
          return;
        }
        const cid = sim.placingCustomId;
        if (cid != null && Number.isFinite(cid) && sim.customLibrary[cid]) {
          tile.type = TileType.CUSTOM;
          tile.custom = JSON.parse(JSON.stringify(sim.customLibrary[cid]));
          tile.custom._instanceId =
            'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          tile.rotation = 0;
          tile.mirrorH = false;
          tile.mirrorV = false;
          tile.gz = sim.currentFloor || 0;
          tile._img = null;
          tile._imgSrc = null;
          tile._imgToken = null;
          sim.selectedTile = tile;
          document.getElementById('selectedInfo').textContent =
            `custom "${tile.custom.name}" @${gx},${gy},z${tile.gz}`;
          if (!sim.shiftDown) clearTileSelection();
          fillTilePropsPanel(tile);
        }
      } else if (sim.selectedTool && sim.selectedTool !== 'official') {
        tile.type = sim.selectedTool;
        tile.custom = null;
        tile._img = null;
        tile._imgSrc = null;
        tile._imgToken = null;
        tile.opts = sim.selectedTool === 'intersection' ? { hasGreen: true } : {};
        tile.rotation = 0;
        tile.mirrorH = false;
        tile.mirrorV = false;
        tile.gz = sim.currentFloor || 0;
        if (sim.selectedTool === 'start') {
          sim.tiles.forEach(tt => {
            if (tt !== tile) {
              tt.markStart = false;
            }
          });
          tile.markStart = true;
          tile.markFinish = false;
          tile.markCheckpoint = false;
        } else if (sim.selectedTool === 'finish') {
          tile.markFinish = true;
        } else if (sim.selectedTool === 'checkpoint') {
          tile.markCheckpoint = true;
        }
        sim.selectedTile = tile;
        document.getElementById('selectedInfo').textContent =
          `${tile.type} @${gx},${gy}`;
        if (!sim.shiftDown && sim.selectedTool) clearTileSelection();
        fillTilePropsPanel(tile);
      } else {
        const obj = (sim.objects || []).find(
          o =>
            o.gx === gx &&
            o.gy === gy &&
            (o.gz || 0) === (sim.currentFloor || 0)
        );
        if (obj) {
          sim.selectedObject = obj;
          sim.selectedTile = null;
          document.getElementById('selectedInfo').textContent =
            `obj ${obj.type} @${gx},${gy}`;
          if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(null);
        } else if (tile.type !== TileType.EMPTY) {
          sim.selectedTile = tile;
          sim.selectedObject = null;
          document.getElementById('selectedInfo').textContent =
            `${tile.type} @${gx},${gy} rot=${tile.rotation || 0}°`;
          if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(tile);
        } else {
          sim.selectedTile = null;
          sim.selectedObject = null;
          const info = document.getElementById('selectedInfo');
          if (info) info.textContent = '— (seleção)';
          if (typeof fillTilePropsPanel === 'function') fillTilePropsPanel(null);
        }
      }
      draw();
      schedulePathfinding();
    } else if (sim.mode === 'manual' && sim.placingRobot) {
      if (!sim.robot) sim.robot = new Robot(w.x, w.y, 0);
      else {
        sim.robot.pos.x = w.x;
        sim.robot.pos.y = w.y;
      }
      sim.placingRobot = false;
      document.getElementById('btnPlaceRobot').textContent = 'Posicionar Robô';
      draw();
    }
  });

  canvas.addEventListener('mousedown', e => {
    if (e.button === 1 && e.shiftKey) {
      e.preventDefault();
      cam.panning = true;
      cam.lastX = e.clientX;
      cam.lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('mousemove', e => {
    if (cam.panning) {
      cam.ox += e.clientX - cam.lastX;
      cam.oy += e.clientY - cam.lastY;
      cam.lastX = e.clientX;
      cam.lastY = e.clientY;
      cam.userZoom = cam.scale;
      updateZoomUI();
      draw();
      return;
    }
    if (sim.mode === 'editor' && sim.measureMode) {
      const wpos = screenToWorld(e.clientX, e.clientY);
      sim.measureCursor = { x: wpos.x, y: wpos.y };
      draw();
    }
  });

  window.addEventListener('mouseup', () => {
    if (cam.panning) {
      cam.panning = false;
      canvas.style.cursor = '';
    }
  });

  canvas.addEventListener('mousedown', e => {
    if (e.button === 1) e.preventDefault();
  });

  canvas.addEventListener('auxclick', e => {
    if (e.button !== 1 || sim.mode !== 'editor') return;
    e.preventDefault();
    const w = screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = worldToGrid(w.x, w.y);
    const tile = sim.tiles.find(t => t.gx === gx && t.gy === gy);
    if (!tile || tile.type === TileType.EMPTY) return;

    sim.selectedTile = tile;
    sim.objectTool = null;
    sim.markerTool = null;
    document
      .querySelectorAll('#objectTools button, #markerTools button')
      .forEach(b => b.classList.remove('active-tool'));

    if (tile.opts && tile.opts.officialImage) {
      const file = tile.opts.officialImage;
      setEditorLayer('official');
      ensureOfficialPalette().then(() => {
        selectOfficialTile(file);
        document.getElementById('selectedInfo').textContent =
          `oficial ${file} @${gx},${gy} rot=${tile.rotation || 0}`;
        logUI({ t: 0, msg: `Picker: oficial ${file}`, category: 'info' });
        draw();
      });
      return;
    }

    if (tile.type === TileType.CUSTOM && tile.custom) {
      setEditorLayer('tiles');
      let idx = sim.customLibrary.findIndex(c => c.name === tile.custom.name);
      if (idx < 0) {
        sim.customLibrary.push(JSON.parse(JSON.stringify(tile.custom)));
        idx = sim.customLibrary.length - 1;
        refreshCustomSelect();
      }
      selectTileTool('custom', idx);
      document.getElementById('selectedInfo').textContent =
        `custom "${tile.custom.name}" @${gx},${gy}`;
      logUI({
        t: 0,
        msg: `Picker: custom "${tile.custom.name}"`,
        category: 'info'
      });
      draw();
      return;
    }

    setEditorLayer('tiles');
    selectTileTool(tile.type, null);
    document.getElementById('selectedInfo').textContent =
      `${tile.type} @${gx},${gy} rot=${tile.rotation || 0}`;
    logUI({ t: 0, msg: `Picker: ${tile.type}`, category: 'info' });
    draw();
  });

  canvas.addEventListener('contextmenu', e => {
    if (sim.mode !== 'editor') return;
    e.preventDefault();
    const w = screenToWorld(e.clientX, e.clientY);
    const { gx, gy } = worldToGrid(w.x, w.y);
    const z = sim.currentFloor || 0;
    const tile =
      sim.tiles.find(t => t.gx === gx && t.gy === gy && (t.gz || 0) === z) ||
      sim.tiles.find(t => t.gx === gx && t.gy === gy);
    if (!tile || tile.type === TileType.EMPTY) {
      hideTileContextMenu();
      logUI({ t: 0, msg: 'Nenhum ladrilho nesta célula.', category: 'warning' });
      return;
    }
    sim.selectedTile = tile;
    showTileContextMenu(e.clientX, e.clientY, tile);
  });

  canvas.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      setZoom(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    },
    { passive: false }
  );
}
