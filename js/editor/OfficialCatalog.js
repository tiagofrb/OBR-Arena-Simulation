/**
 * Catálogo de ladrilhos oficiais (probe de imagem + paleta DOM).
 * Estado fica em `sim.officialTileFiles` / `sim.placingOfficialFile`.
 */

/**
 * @param {string} file
 * @param {(file: string) => string} classifyOfficialFilename
 * @returns {Promise<{ file: string, url: string, ok: boolean, type?: string }>}
 */
export function probeOfficialImage(file, classifyOfficialFilename) {
  return new Promise(resolve => {
    const img = new Image();
    const url = `assets/official-tiles/${file}`;
    img.onload = () => resolve({ file, url, ok: true, type: classifyOfficialFilename(file) });
    img.onerror = () => resolve({ file, url, ok: false });
    img.src = url;
  });
}

/**
 * @param {object} sim
 * @param {(file: string) => string} classifyOfficialFilename
 * @returns {Promise<Array>}
 */
export async function loadOfficialTileCatalog(sim, classifyOfficialFilename) {
  const candidates = [];
  for (let i = 0; i <= 83; i++) candidates.push(`tile-${i}.png`);
  candidates.push('seesaw.png', 'exit.png', 'ev1.png', 'ev2.png', 'ev3.png');
  const results = await Promise.all(
    candidates.map(f => probeOfficialImage(f, classifyOfficialFilename))
  );
  sim.officialTileFiles = results.filter(r => r.ok);
  return sim.officialTileFiles;
}

/**
 * @param {object} sim
 * @param {object} deps
 * @param {(file: string) => void} deps.selectOfficialTile
 * @param {(payload: object) => void} deps.setDragPayload
 * @param {(x: number, y: number, payload: object, invalid: boolean) => void} deps.showTileDragPreview
 * @param {() => void} deps.hideTileDragPreview
 */
export function renderOfficialPalette(sim, deps) {
  const wrap = document.getElementById('officialTileTools');
  const status = document.getElementById('officialTileStatus');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!sim.officialTileFiles.length) {
    if (status) {
      status.textContent =
        'Nenhuma imagem em assets/official-tiles/. Coloque os PNGs oficiais nessa pasta.';
    }
    return;
  }
  if (status) {
    status.textContent = `${sim.officialTileFiles.length} ladrilhos · arraste para a grade`;
  }
  sim.officialTileFiles.forEach(({ file, url, type }) => {
    const btn = document.createElement('button');
    btn.className = 'tile-btn';
    btn.dataset.official = file;
    btn.dataset.dragKind = 'official';
    btn.draggable = true;
    btn.title = `${file} (${type})`;
    if (sim.placingOfficialFile === file && sim.selectedTool === 'official') {
      btn.classList.add('active-tool');
    }
    const sw = document.createElement('span');
    sw.className = 'swatch';
    const img = document.createElement('img');
    img.src = url;
    img.alt = file;
    img.draggable = false;
    sw.appendChild(img);
    btn.appendChild(sw);
    btn.onclick = () => deps.selectOfficialTile(file);
    btn.addEventListener('dragstart', (ev) => {
      const payload = { kind: 'official', file };
      deps.setDragPayload(payload);
      ev.dataTransfer.setData('application/x-obr-tile', JSON.stringify(payload));
      ev.dataTransfer.effectAllowed = 'copy';
      try {
        const empty = document.createElement('canvas');
        empty.width = 1;
        empty.height = 1;
        ev.dataTransfer.setDragImage(empty, 0, 0);
      } catch (_) { /* ignore */ }
      btn.classList.add('drag-ghost');
      deps.showTileDragPreview(ev.clientX, ev.clientY, payload, false);
    });
    btn.addEventListener('dragend', () => {
      btn.classList.remove('drag-ghost');
      deps.hideTileDragPreview();
    });
    wrap.appendChild(btn);
  });
}

/**
 * Carrega o catálogo uma vez e renderiza a paleta.
 * @param {object} sim
 * @param {object} state — `{ loaded: boolean }` mutável (evita reload)
 * @param {object} deps
 * @param {(file: string) => string} deps.classifyOfficialFilename
 * @param {(file: string) => void} deps.selectOfficialTile
 * @param {(payload: object) => void} deps.setDragPayload
 * @param {Function} deps.showTileDragPreview
 * @param {Function} deps.hideTileDragPreview
 */
export async function ensureOfficialPalette(sim, state, deps) {
  if (!state.loaded) {
    const status = document.getElementById('officialTileStatus');
    if (status) status.textContent = 'Carregando catálogo…';
    await loadOfficialTileCatalog(sim, deps.classifyOfficialFilename);
    state.loaded = true;
  }
  renderOfficialPalette(sim, deps);
}
