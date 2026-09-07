/**
 * Import/export de arena (formato app + oficial RCJ/OBR) e pathfinding agendado.
 */

/**
 * Dispara download de um arquivo JSON.
 * @param {string} filename
 * @param {*} data
 */
export function downloadJSONFile(filename, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  );
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Exporta a arena no formato oficial ou do app.
 * @param {object} sim
 * @param {'official'|'app'|null} forceFormat
 * @param {object} deps
 * @param {() => void} deps.syncMapMetaFromUI
 * @param {Function} deps.convertToOfficialArena
 * @param {Function} deps.updateTileIndex
 * @param {Function} deps.validateOfficialMap
 * @param {*} deps.TileType
 * @param {(ev: object) => void} deps.logUI
 */
export function exportArenaJSON(sim, forceFormat, deps) {
  const format = forceFormat || (sim.customMode ? 'app' : 'official');
  try {
    if (format === 'official') {
      deps.syncMapMetaFromUI();
      let official = deps.convertToOfficialArena({
        gridW: sim.gridW,
        gridH: sim.gridH,
        tiles: sim.tiles.filter(t => t.type !== deps.TileType.EMPTY).map(t => t.toJSON()),
        objects: sim.objects,
        meta: sim.officialMeta || {}
      });
      const pf = deps.updateTileIndex(official);
      official = pf.map;
      const v = deps.validateOfficialMap(official);
      if (!v.ok) {
        const msg = v.errors.join('; ');
        deps.logUI({ t: 0, msg: 'Validação oficial: ' + msg, category: 'warning' });
        if (!confirm('Aviso de validação:\n' + msg + '\n\nExportar mesmo assim?')) return;
      }
      const name = (official.name || 'arena').replace(/[^\w\-]+/g, '_');
      downloadJSONFile(name + '-oficial.json', official);
      deps.logUI({
        t: 0,
        msg: `Exportado RCJ/OBR (${Object.keys(official.tiles || {}).length} tiles, path index=${official.indexCount || 0})`,
        category: 'success'
      });
    } else {
      const data = {
        gridW: sim.gridW,
        gridH: sim.gridH,
        tiles: sim.tiles.filter(t => t.type !== deps.TileType.EMPTY).map(t => t.toJSON()),
        objects: sim.objects,
        meta: sim.officialMeta || null
      };
      downloadJSONFile('obr-arena.json', data);
      deps.logUI({
        t: 0,
        msg: 'Exportado no formato do trainer (obr-arena.json).',
        category: 'success'
      });
    }
  } catch (err) {
    alert('Falha ao exportar: ' + err.message);
  }
}

/**
 * Agenda pathfinding (debounce 120 ms).
 * @param {{ timer: number|null }} state
 * @param {() => void} runPathfinding
 * @returns {() => void} schedulePathfinding
 */
export function createPathfindingScheduler(state, runPathfinding) {
  return function schedulePathfinding() {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(runPathfinding, 120);
  };
}

/**
 * Executa pathfinding e espelha índices nos tiles internos.
 * @param {object} sim
 * @param {object} deps
 * @param {() => void} [deps.syncMapMetaFromUI]
 * @param {Function} deps.convertToOfficialArena
 * @param {Function} deps.updateTileIndex
 * @param {*} deps.TileType
 */
export function runPathfinding(sim, deps) {
  try {
    if (typeof deps.syncMapMetaFromUI === 'function') deps.syncMapMetaFromUI();
    const official = deps.convertToOfficialArena({
      gridW: sim.gridW,
      gridH: sim.gridH,
      tiles: (sim.tiles || [])
        .filter(t => t.type !== deps.TileType.EMPTY)
        .map(t => t.toJSON()),
      objects: sim.objects || [],
      meta: sim.officialMeta || {}
    });
    const { map, indexCount } = deps.updateTileIndex(official);
    for (const key of Object.keys(map.tiles || {})) {
      const ot = map.tiles[key];
      const parts = key.split(',').map(Number);
      const [x, y, z] = parts;
      const tile = (sim.tiles || []).find(
        t => t.gx === x && t.gy === y && (t.gz || 0) === (z || 0)
      );
      if (tile) {
        if (!tile.opts) tile.opts = {};
        tile.opts.pathIndex = ot.index || [];
        tile.opts.pathNext = ot.next || [];
      }
    }
    if (sim.officialMeta) {
      sim.officialMeta.indexCount = indexCount;
      sim.officialMeta.EvacuationAreaLoPIndex = map.EvacuationAreaLoPIndex;
    }
  } catch (err) {
    console.warn('pathfinding:', err);
  }
}

/**
 * Importa JSON de arena (oficial ou app) a partir de um File input event.
 * @param {Event} e — change do input file
 * @param {object} sim
 * @param {object} deps
 */
export async function importArenaFromFile(e, sim, deps) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    let data = JSON.parse(await file.text());

    if (deps.isOfficialArenaFormat(data)) {
      if (sim.customMode) {
        alert(
          'Modo custom está ativo. Desative-o para importar arenas do formato oficial.'
        );
        e.target.value = '';
        return;
      }
      data = deps.convertOfficialArena(data);
      sim.officialMeta = data.meta || null;
      deps.logUI({
        t: 0,
        msg: `Arena oficial convertida${data.meta?.name ? ': ' + data.meta.name : ''} (${data.tiles.length} ladrilhos).`,
        category: 'info'
      });
    } else if (data.gridW || Array.isArray(data.tiles)) {
      if (data.meta) sim.officialMeta = data.meta;
    }

    deps.pushArenaUndo();
    sim.tiles.forEach(t => {
      t.type = deps.TileType.EMPTY;
      t.custom = null;
      t._img = null;
      t._imgSrc = null;
    });
    sim.objects = [];
    sim.selectedTile = null;
    sim.selectedObject = null;

    if (data.gridW) sim.gridW = data.gridW;
    if (data.gridH) sim.gridH = data.gridH;
    const gw = document.getElementById('gridW');
    const gh = document.getElementById('gridH');
    const gwv = document.getElementById('gridWVal');
    const ghv = document.getElementById('gridHVal');
    if (gw) gw.value = sim.gridW;
    if (gh) gh.value = sim.gridH;
    if (gwv) gwv.textContent = sim.gridW;
    if (ghv) ghv.textContent = sim.gridH;
    deps.ensureGridMatrix();
    (data.tiles || data).forEach(o => {
      const t = deps.Tile.fromJSON(o);
      const idx = sim.tiles.findIndex(
        x => x.gx === t.gx && x.gy === t.gy && (x.gz || 0) === (t.gz || 0)
      );
      if (idx >= 0) sim.tiles[idx] = t;
      else sim.tiles.push(t);
    });
    sim.objects = data.objects || [];
    sim.customArena = sim.tiles
      .filter(t => t.type !== deps.TileType.EMPTY)
      .map(t => t.toJSON());
    sim.customArenaObjects = JSON.parse(JSON.stringify(sim.objects));
    deps.persist('obr_custom_arena', sim.customArena);
    deps.persist('obr_custom_arena_objects', sim.customArenaObjects);
    if (sim.officialMeta) deps.applyMapMetaToUI();
    else deps.ensureMapMetaDefaults();
    deps.logUI({ t: 0, msg: 'Arena limpa e importada.', category: 'success' });
    deps.fitCamera();
    deps.draw();
  } catch (err) {
    alert('JSON inválido: ' + err.message);
  }
  e.target.value = '';
}

/**
 * Salva a arena atual nas chaves de persistência.
 * @param {object} sim
 * @param {object} deps
 */
export function saveArenaToStorage(sim, deps) {
  sim.customArena = sim.tiles
    .filter(t => t.type !== deps.TileType.EMPTY)
    .map(t => t.toJSON());
  sim.customArenaObjects = JSON.parse(JSON.stringify(sim.objects));
  deps.logUI({
    t: 0,
    msg: `Arena salva (${sim.customArena.length} ladrilhos, ${sim.objects.length} objetos).`,
    category: 'success'
  });
  try {
    deps.persist('obr_custom_arena', sim.customArena);
    deps.persist('obr_custom_arena_objects', sim.customArenaObjects);
  } catch (e) { /* quota */ }
}

/**
 * Liga botões de export/import/medida/save.
 * @param {object} sim
 * @param {object} deps
 */
export function wireArenaIO(sim, deps) {
  document.getElementById('btnExport')?.addEventListener('click', () =>
    exportArenaJSON(sim, null, deps)
  );
  document.getElementById('btnExportAlt')?.addEventListener('click', () =>
    exportArenaJSON(sim, sim.customMode ? 'official' : 'app', deps)
  );
  document.getElementById('btnImportJSON').onclick = () =>
    document.getElementById('importFile').click();
  document.getElementById('importFile').onchange = e =>
    importArenaFromFile(e, sim, deps);
  document.getElementById('btnSaveArena').onclick = () =>
    saveArenaToStorage(sim, deps);
  document.getElementById('btnMeasure').onclick = () => {
    sim.measureMode = !sim.measureMode;
    sim.measureStart = null;
    sim.measureCursor = null;
    sim.objectTool = null;
    sim.selectedTool = null;
    document
      .querySelectorAll('#tileTools button, #objectTools button')
      .forEach(b => b.classList.remove('active-tool'));
    document
      .getElementById('btnMeasure')
      .classList.toggle('active-tool', sim.measureMode);
    document.getElementById('measureHint').textContent = sim.measureMode
      ? 'Medição ATIVA: clique 2 pontos. Esc cancela.'
      : 'Medir: 2 cliques na arena. Esc cancela.';
    deps.draw();
  };
}
