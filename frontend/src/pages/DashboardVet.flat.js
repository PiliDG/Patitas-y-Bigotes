import { createControl, listControls } from '../services/controlsService.js';
import { createFollowUp, updateFollowUp, cancelFollowUp, listAllFollowUps } from '../services/followupsService.js';
import { getAllPets } from '../services/petsService.js';
import { showToast } from '../components/Toast.js';
import { getVetSummary } from '../services/vetSummaryService.js';

function feedback(root, message, type = 'info') {
  const box = root.querySelector('.form-feedback');
  if (!box) return;
  const cls = type === 'error' ? 'error-text' : type === 'success' ? 'success-text' : 'pending-text';
  box.innerHTML = `<p class="${cls}">${message}</p>`;
}

function serialize(form) {
  const data = new FormData(form);
  const payload = {};
  for (const [key, value] of data.entries()) {
    if (value === '') continue;
    payload[key] = value;
  }
  return payload;
}

export default function renderDashboardVet(container) {
  container.innerHTML = `
    <section class="dashboard-header">
      <h1>Panel Veterinario</h1>
      <p>RegistrÃ¡ controles sanitarios, seguÃ­ la evoluciÃ³n clÃ­nica y consultÃ¡ el historial.</p>
    </section>

    <section class="dashboard-operator">
      <div class="operator-left">
        <section class="dashboard-card">
          <div class="operator-tabs" role="tablist" aria-label="Secciones clÃ­nicas">
            <button class="chip" role="tab" aria-selected="true" aria-controls="tab-controles" id="tabbtn-controles">ðŸ©º Controles sanitarios</button>
            <button class="chip" role="tab" aria-selected="false" aria-controls="tab-seguimientos" id="tabbtn-seguimientos">ðŸ“‹ Seguimientos clÃ­nicos</button>
            <button class="chip" role="tab" aria-selected="false" aria-controls="tab-historial" id="tabbtn-historial">ðŸ“š Historial mÃ©dico</button>
          </div>

          <div id="tab-controles" role="tabpanel" aria-labelledby="tabbtn-controles">
            <form data-control class="operator-form modern" novalidate>
              <h4>Control sanitario</h4>
              <div class="form-row">
                <label><span>ID Animal</span><input name="AnimalId" type="number" list="animals-list" placeholder="Ej.: 101" /></label>
                <label><span>Fecha del control</span><input name="Fecha" type="date" /></label>
                <label><span>DiagnÃ³stico</span><input name="Diagnostico" /></label>
                <label><span>Vacunas</span><input name="Vacunas" /></label>
                <label><span>Tratamiento</span><input name="Tratamiento" /></label>
              </div>
              <div class="form-row">
                <label><span>Resultado</span>
                  <select name="Resultado">
                    <option value="">SeleccionÃ¡</option>
                    <option value="Apto">Apto</option>
                    <option value="Requiere tratamiento">Requiere tratamiento</option>
                    <option value="No apto">No apto</option>
                  </select>
                </label>
                <label><span>PrÃ³xima cita</span><input name="ProximaCita" type="date" /></label>
                <label class="full"><span>Observaciones</span><textarea name="Observaciones" rows="2"></textarea></label>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">Registrar control</button>
                <button type="button" class="btn-secondary" data-open-historial>Ver historial de controles</button>
              </div>
              <div class="form-feedback" aria-live="polite"></div>
            </form>

            <div class="operator-panel" data-historial style="display:none">
              <h2 class="operator-panel__title">Historial de controles</h2>
              <div class="operator-form inline" data-controles-list novalidate>
                <label class="col-2"><span>ID Animal</span><input name="AnimalId" type="number" list="animals-list" placeholder="Ej.: 101" /></label>
                <label class="col-2"><span>Desde</span><input name="Desde" type="date" /></label>
                <label class="col-2"><span>Hasta</span><input name="Hasta" type="date" /></label>
                <button type="button" class="btn-secondary" data-listar>Listar controles</button>
                <button type="button" class="btn-link" data-cerrar-historial>Cerrar</button>
                <div class="form-feedback" aria-live="polite"></div>
              </div>
              <div class="table-scroller" style="overflow:auto; max-height: 340px; margin-top:10px">
                <table class="data-table" data-controls-table style="width:100%">
                  <thead>
                    <tr>
                      <th>ID Control</th>
                      <th>Fecha</th>
                      <th>DiagnÃ³stico</th>
                      <th>Resultado</th>
                      <th>PrÃ³xima cita</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
          </div>

          <div id="tab-seguimientos" role="tabpanel" aria-labelledby="tabbtn-seguimientos" hidden>
            <section class="operator-panel">
              <h2 class="operator-panel__title">Seguimientos activos</h2>
              <div class="table-scroller" style="overflow:auto; max-height: 340px">
                <table class="data-table" data-segs-table style="width:100%">
                  <thead>
                    <tr>
                      <th>ID Seguimiento</th>
                      <th>Animal</th>
                      <th>Estado</th>
                      <th>Ãšltima actualizaciÃ³n</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </section>
            <form data-seg-alta class="operator-form inline" novalidate>
              <label><span>ID Solicitud (opcional)</span><input name="SolicitudId" type="number" /></label>
              <label><span>ID Animal</span><input name="AnimalId" type="number" list="animals-list" placeholder="Ej.: 101" /></label>
              <label><span>Fecha</span><input name="FechaSeguimiento" type="date" /></label>
              <label class="full"><span>Observaciones</span><textarea name="Observaciones" rows="2"></textarea></label>
              <button type="submit" class="btn-primary">Crear seguimiento</button>
              <div class="form-feedback" aria-live="polite"></div>
            </form>
          </div>

          <div id="tab-historial" role="tabpanel" aria-labelledby="tabbtn-historial" hidden>
            <form class="operator-form inline" data-search-animal novalidate>
              <label class="col-3"><span>Buscar por nombre o ID</span><input name="q" placeholder="Ej.: Luna o 101" /></label>
              <button type="submit" class="btn-secondary">Buscar</button>
              <button type="button" class="btn-link" data-exportar>Exportar PDF</button>
              <div class="form-feedback" aria-live="polite"></div>
            </form>
            <div class="operator-panel" data-animal-card style="display:none"></div>
            <div class="operator-panel" data-animal-controles style="display:none">
              <h2 class="operator-panel__title">Controles sanitarios anteriores</h2>
              <div class="operator-form inline">
                <label class="col-2"><span>Desde</span><input name="Desde" type="date" data-ctrl-desde /></label>
                <label class="col-2"><span>Hasta</span><input name="Hasta" type="date" data-ctrl-hasta /></label>
                <button type="button" class="btn-secondary" data-filtrar-controles>Filtrar</button>
              </div>
              <div class="table-scroller" style="overflow:auto; max-height: 340px">
                <table class="data-table" data-animal-ctrls style="width:100%">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>DiagnÃ³stico</th>
                      <th>Resultado</th>
                      <th>PrÃ³xima cita</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
            <div class="operator-panel" data-animal-seg style="display:none">
              <h2 class="operator-panel__title">Seguimientos clÃ­nicos anteriores</h2>
              <div class="operator-list" data-animal-seg-list></div>
            </div>
          </div>
        </section>
      </div>

      <aside class="operator-right">
        <div class="operator-panel">
          <div class="operator-tabs" role="tablist" aria-label="Resumen reciente">
            <button class="chip" role="tab" aria-selected="true" aria-controls="r-controles" id="rbtn-controles">ðŸ©º Controles recientes</button>
            <button class="chip" role="tab" aria-selected="false" aria-controls="r-seguimientos" id="rbtn-seguimientos">ðŸ“‹ Seguimientos activos</button>
            <button class="chip" role="tab" aria-selected="false" aria-controls="r-animales" id="rbtn-animales">ðŸ¾ Animales atendidos</button>
          </div>
          <div id="r-controles" role="tabpanel" aria-labelledby="rbtn-controles">
            <div class="operator-list" data-recent-controls>
              <div class="operator-list__item is-skeleton"></div>
              <div class="operator-list__item is-skeleton"></div>
            </div>
            <p class="muted" data-recent-controls-empty style="display:none">Sin datos de controles recientes.</p>
          </div>
          <div id="r-seguimientos" role="tabpanel" aria-labelledby="rbtn-seguimientos" hidden>
            <div class="operator-list" data-recent-segs>
              <div class="operator-list__item is-skeleton"></div>
            </div>
            <p class="muted" data-recent-segs-empty style="display:none">No hay seguimientos activos.</p>
          </div>
          <div id="r-animales" role="tabpanel" aria-labelledby="rbtn-animales" hidden>
            <div class="operator-list" data-recent-animals>
              <div class="operator-list__item is-skeleton"></div>
              <div class="operator-list__item is-skeleton"></div>
            </div>
            <p class="muted" data-recent-animals-empty style="display:none">No hay animales recientes.</p>
          </div>
        </div>
      </aside>

      <datalist id="animals-list"></datalist>
    </section>
  `;

  // Replace right panel with Operator-like summary-card (tabs)
  try {
    const oldAside = container.querySelector('.operator-right');
    if (oldAside) {
      const aside = document.createElement('aside');
      aside.className = 'operator-right operator-side';
      aside.setAttribute('data-vet-summary', '');
      aside.innerHTML = `
        <article class="summary-card">
          <header class="summary-card__header">
            <h2>Resumen reciente</h2>
            <p class="muted">Accesos rÃ¡pidos a los Ãºltimos movimientos</p>
          </header>
          <nav class="summary-tabs" data-summary-tabs>
            <button type="button" class="summary-tab is-active" data-summary-target="animales">ðŸ¾ Animales</button>
            <button type="button" class="summary-tab" data-summary-target="solicitudes">ðŸ“„ Solicitudes</button>
            <button type="button" class="summary-tab" data-summary-target="seguimientos">ðŸ” Seguimientos</button>
          </nav>
          <div class="summary-list" data-summary-panel="animales"><p class="muted">Cargandoâ€¦</p></div>
          <div class="summary-list hidden" data-summary-panel="solicitudes"><p class="muted">Cargandoâ€¦</p></div>
          <div class="summary-list hidden" data-summary-panel="seguimientos"><p class="muted">Cargandoâ€¦</p></div>
          <footer class="muted" data-summary-updated style="text-align:right; font-size:12px;"></footer>
        </article>`;
      oldAside.replaceWith(aside);
    }
  } catch {}

  // Summary tabs behavior
  function setupSummaryTabs(root) {
    try {
      const tabs = root.querySelectorAll('[data-summary-target]');
      const panels = root.querySelectorAll('[data-summary-panel]');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.summaryTarget;
          tabs.forEach((b) => b.classList.toggle('is-active', b === btn));
          panels.forEach((p) => p.classList.toggle('hidden', p.dataset.summaryPanel !== key));
        });
      });
    } catch {}
  }

  function badge(label, kind) {
    const map = {
      solicitud: { Pendiente: 'badge--pending', 'En revisiÃ³n': 'badge--review', Aprobada: 'badge--success', Rechazada: 'badge--error', Anulada: 'badge--neutral' },
      seguimiento: { Activo: 'badge--success', Cerrado: 'badge--neutral', Cancelado: 'badge--neutral', Finalizado: 'badge--success' },
      animal: { 'En tratamiento': 'badge--warning', 'Alta mÃ©dica': 'badge--success', Disponible: 'badge--success' }
    };
    const cls = (map[kind] && map[kind][label]) || 'badge--neutral';
    return `<span class="status-pill ${cls}">${label}</span>`;
  }

  const summaryAside = container.querySelector('[data-vet-summary]') || container.querySelector('.operator-side[data-vet-summary]');
  if (summaryAside) setupSummaryTabs(summaryAside);

  async function refreshSummary() {
    if (!summaryAside) return;
    try {
      const data = await getVetSummary();
      const animaPanel = summaryAside.querySelector('[data-summary-panel="animales"]');
      const soliPanel = summaryAside.querySelector('[data-summary-panel="solicitudes"]');
      const segPanel = summaryAside.querySelector('[data-summary-panel="seguimientos"]');
      const updated = summaryAside.querySelector('[data-summary-updated]');

      const animals = data.animales || [];
      animaPanel.innerHTML = animals.length
        ? animals.map((a) => `
            <button type="button" class="summary-item" data-goto="controles" data-animal-id="${a.animalId || a.id}">
              <span class="summary-icon">ðŸ¾</span>
              <div>
                <strong>${a.nombre || 'Sin nombre'}</strong>
                <p>${a.especie || ''}</p>
                <span>${a.fecha ? new Date(a.fecha).toLocaleDateString() : ''}</span>
              </div>
              ${badge(a.estado || 'Disponible', 'animal')}
            </button>
          `).join('')
        : '<p class="muted">Sin animales recientes.</p>';

      const solicitudes = data.solicitudes || [];
      soliPanel.innerHTML = solicitudes.length
        ? solicitudes.map((s) => `
            <button type="button" class="summary-item" data-goto="controles" data-animal-id="${s.animalId || ''}">
              <span class="summary-icon">ðŸ“„</span>
              <div>
                <strong>#${s.id}</strong>
                <p>${s.adoptante || ''} â€” ${s.animal || ''}</p>
                <span>${s.fecha ? new Date(s.fecha).toLocaleDateString() : ''}</span>
              </div>
              ${badge(s.estado || 'Pendiente', 'solicitud')}
            </button>
          `).join('')
        : '<p class="muted">Sin solicitudes recientes.</p>';

      const seguimientos = data.seguimientos || [];
      segPanel.innerHTML = seguimientos.length
        ? seguimientos.map((sg) => `
            <button type="button" class="summary-item" data-goto="seguimientos" data-seg-id="${sg.id}" data-animal-id="${sg.animalId || ''}">
              <span class="summary-icon">ðŸ”</span>
              <div>
                <strong>#${sg.id}</strong>
                <p>${sg.animal || ''}</p>
                <span>${sg.fecha ? new Date(sg.fecha).toLocaleDateString() : ''}${sg.proximaCita ? ' Â· PrÃ³x: ' + new Date(sg.proximaCita).toLocaleDateString() : ''}</span>
              </div>
              ${badge(sg.estado || 'Activo', 'seguimiento')}
            </button>
          `).join('')
        : '<p class="muted">Sin seguimientos recientes.</p>';

      if (updated) {
        const t = data.actualizadoEn ? new Date(data.actualizadoEn) : new Date();
        updated.textContent = `Actualizado el ${t.toLocaleDateString()}`;
      }

      summaryAside.querySelectorAll('.summary-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          btn.classList.add('is-pressed');
          setTimeout(() => btn.classList.remove('is-pressed'), 180);
          const goto = btn.dataset.goto;
          const animalId = btn.dataset.animalId;
          const segId = btn.dataset.segId;
          if (goto === 'controles') {
            goToTab('controles');
            if (animalId) {
              try {
                const input = container.querySelector('[data-control] input[name="AnimalId"]');
                if (input) { input.value = animalId; input.focus(); }
              } catch {}
            }
          } else if (goto === 'seguimientos') {
            goToTab('seguimientos');
            try {
              const row = container.querySelector(`[data-seg-row][data-id="${segId}"]`);
              if (row) {
                row.classList.add('is-selected');
                setTimeout(() => row.classList.remove('is-selected'), 2000);
              }
            } catch {}
          }
        }, { once: true });
      });
    } catch (error) {
      const animaPanel = summaryAside.querySelector('[data-summary-panel="animales"]');
      if (animaPanel) animaPanel.innerHTML = '<p class="error-text">No se pudo cargar el resumen.</p>';
    }
  }

  function goToTab(key) {
    const map = {
      controles: ['#tabbtn-controles', '#tab-controles'],
      seguimientos: ['#tabbtn-seguimientos', '#tab-seguimientos'],
      historial: ['#tabbtn-historial', '#tab-historial']
    };
    const m = map[key];
    if (!m) return;
    const btn = container.querySelector(m[0]);
    if (btn) btn.click();
  }

  // First load + polling auto-refresh
  refreshSummary();
  const _summaryInterval = setInterval(refreshSummary, 60000);

  // Tabs behavior (main)
  try {
    const tabs = [
      { btn: '#tabbtn-controles', panel: '#tab-controles' },
      { btn: '#tabbtn-seguimientos', panel: '#tab-seguimientos' },
      { btn: '#tabbtn-historial', panel: '#tab-historial' },
    ];
    tabs.forEach(({ btn, panel }) => {
      const b = container.querySelector(btn);
      b?.addEventListener('click', () => {
        tabs.forEach(({ btn: bb, panel: pp }) => {
          const btnEl = container.querySelector(bb);
          const panelEl = container.querySelector(pp);
          const isActive = bb === btn;
          btnEl?.setAttribute('aria-selected', String(isActive));
          if (panelEl) panelEl.hidden = !isActive;
        });
      });
    });
  } catch {}

  // Load animals for autocomplete and lookups
  let animalsCache = [];
  (async () => {
    try {
      animalsCache = await getAllPets();
      const dl = container.querySelector('#animals-list');
      if (dl) {
        dl.innerHTML = animalsCache
          .map(a => `<option value="${a.Id}">${(a.Nombre || 'Sin nombre')} Â· ${(a.EspecieRaza || '').trim()}</option>`)
          .join('');
      }
    } catch {}
  })();

  // Control sanitario: submit + validaciones
  const controlForm = container.querySelector('[data-control]');
  controlForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = serialize(form);
    if (!payload.AnimalId) {
      feedback(form, 'âš ï¸ SeleccionÃ¡ un animal antes de registrar el control.', 'error');
      return;
    }
    if (!payload.Diagnostico) {
      feedback(form, 'Debe registrar diagnÃ³stico', 'error');
      return;
    }
    // Validar prÃ³xima cita > fecha control
    try {
      const fecha = form.elements.Fecha?.value;
      const proxima = form.elements.ProximaCita?.value;
      if (fecha && proxima && Date.parse(proxima) <= Date.parse(fecha)) {
        feedback(form, 'La fecha de la prÃ³xima cita debe ser posterior al control.', 'error');
        return;
      }
    } catch {}

    feedback(form, 'Registrando...', 'info');
    try {
      const response = await createControl(payload);
      const message = response?.message || 'Control sanitario registrado';
      // Buscar nombre del animal
      const a = animalsCache.find(x => String(x.Id) === String(payload.AnimalId));
      const display = a ? `âœ… Control sanitario registrado para ${a.Nombre}` : message;
      feedback(form, display, 'success');
      showToast('success', display);
      form.reset();
      await refreshFollowups();
    } catch (error) {
      const message = error.message || 'No se pudo registrar el control';
      if (String(message).includes('Debe registrar diagnÃ³stico')) {
        feedback(form, 'Debe registrar diagnÃ³stico', 'error');
      } else if (String(message).includes('Animal no encontrado')) {
        feedback(form, 'âš ï¸ SeleccionÃ¡ un animal antes de registrar el control.', 'error');
      } else {
        feedback(form, message, 'error');
      }
    }
  });

  // Historial de controles toggle + listar
  try {
    const openBtn = container.querySelector('[data-open-historial]');
    const panel = container.querySelector('[data-historial]');
    const listarBtn = panel?.querySelector('[data-listar]');
    const cerrarBtn = panel?.querySelector('[data-cerrar-historial]');
    const tbody = panel?.querySelector('[data-controls-table] tbody');
    // Usar clases para respetar CSS (.operator-panel.is-active)
    openBtn?.addEventListener('click', () => {
      if (panel) {
        panel.style.display = '';
        panel.classList.add('is-active');
      }
    });
    cerrarBtn?.addEventListener('click', () => {
      if (panel) {
        panel.classList.remove('is-active');
        panel.style.display = 'none';
      }
    });
    const renderControls = (controles) => {
      if (!tbody) return;
      tbody.innerHTML = (controles || []).map(c => `
        <tr>
          <td>${c.Id}</td>
          <td>${(c.Fecha || c.CreadoEn) ? new Date(c.Fecha || c.CreadoEn).toLocaleDateString() : ''}</td>
          <td>${c.Diagnostico || ''}</td>
          <td>${c.Resultado || ''}</td>
          <td>${c.ProximaCita ? new Date(c.ProximaCita).toLocaleDateString() : ''}</td>
          <td><button type="button" class="btn-link" data-ver-control data-id="${c.Id}">ðŸ” Ver detalle</button></td>
        </tr>
      `).join('');
    };
    listarBtn?.addEventListener('click', async () => {
      const form = panel.querySelector('[data-controles-list]');
      const animalId = form.elements.AnimalId.value;
      if (!animalId) { feedback(form, 'IngresÃ¡ el ID del animal', 'error'); return; }
      feedback(form, 'Buscando controles...', 'info');
      try {
        let controles = await listControls(animalId);
        // Filtrar por rango de fechas si aplica
        const d = form.elements.Desde.value; const h = form.elements.Hasta.value;
        if (d || h) {
          const dts = d ? Date.parse(d) : -Infinity; const hts = h ? Date.parse(h) : Infinity;
          controles = controles.filter(c => { const ref = c.Fecha || c.CreadoEn; const t = ref ? Date.parse(ref) : 0; return t >= dts && t <= hts; });
        }
        renderControls(controles);
        feedback(form, 'Controles actualizados', 'success');
      } catch (err) {
        feedback(panel, err.message || 'No se pudieron obtener los controles', 'error');
      }
    });
    // Modal simple para detalle
    panel?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ver-control]');
      if (!btn) return;
      const row = btn.closest('tr');
      const cells = [...row.children].map(td => td.textContent);
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header"><h3>Detalle del control</h3><button class="btn-link" data-close>âœ–</button></div>
          <div class="modal__body">
            <p><strong>ID:</strong> ${cells[0]}</p>
            <p><strong>Fecha:</strong> ${cells[1]}</p>
            <p><strong>DiagnÃ³stico:</strong> ${cells[2]}</p>
            <p><strong>Resultado:</strong> ${cells[3]}</p>
            <p><strong>PrÃ³xima cita:</strong> ${cells[4]}</p>
          </div>
        </div>`;
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay || ev.target.matches('[data-close]')) overlay.remove(); });
      document.body.appendChild(overlay);
    });
  } catch {}

  let refreshFollowups = async () => {};
  // Populate Seguimientos table and quick actions
  try {
    const segTbody = container.querySelector('[data-segs-table] tbody');
    const followupsState = {
      items: [],
      animalsIndex: new Map()
    };
    const findPetForFollowup = (entry) => {
      const keys = ['AnimalId', 'SolicitudAnimalId', 'AnimalID', 'IdAnimal'];
      for (const key of keys) {
        const ref = entry?.[key];
        if (!ref) continue;
        const pet = followupsState.animalsIndex.get(String(ref));
        if (pet) return pet;
      }
      return null;
    };
    const getFollowupName = (entry) => {
      const pet = findPetForFollowup(entry);
      if (pet?.Nombre) return `${pet.Nombre} (#${pet.Id})`;
      if (entry?.SolicitudId) return `Solicitud #${entry.SolicitudId}`;
      return '-';
    };
    const formatDateForInput = (value) => {
      if (!value) return '';
      try {
        return new Date(value).toISOString().split('T')[0];
      } catch {
        return '';
      }
    };
    const openFollowupModal = (seg) => {
      if (!seg) return;
      const petName = getFollowupName(seg);
      const fecha = formatDateForInput(seg.FechaSeguimiento);
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal__header">
            <h3>Seguimiento clínico #${seg.Id}</h3>
            <button class="btn-link" data-close>✖</button>
          </div>
          <div class="modal__body">
            <p><strong>Animal:</strong> ${petName}</p>
            <p><strong>Estado:</strong> ${seg.EstadoSeguimiento || '-'}</p>
            <label class="full"><span>Fecha</span><input data-input-fecha type="date" value="${fecha}" /></label>
            <label class="full"><span>Observaciones</span><textarea data-input-obs rows="3">${seg.Observaciones || ''}</textarea></label>
          </div>
          <div class="modal__footer">
            <button class="btn-primary" data-save>Guardar cambios</button>
            <button class="btn-secondary" data-cancel-followup>Cancelar seguimiento</button>
          </div>
        </div>`;
      overlay.addEventListener('click', async (ev) => {
        if (ev.target === overlay || ev.target.matches('[data-close]')) {
          overlay.remove();
          return;
        }
        if (ev.target.matches('[data-save]')) {
          const payload = {};
          const fechaValue = overlay.querySelector('[data-input-fecha]')?.value;
          if (fechaValue) payload.FechaSeguimiento = fechaValue;
          const obsValue = overlay.querySelector('[data-input-obs]')?.value;
          if (obsValue !== undefined) {
            payload.Observaciones = obsValue;
          }
          try {
            await updateFollowUp(seg.Id, payload);
            showToast('success', '📝 Seguimiento actualizado.');
            overlay.remove();
            await refreshFollowups();
          } catch (err) {
            showToast('error', err.message || 'No se pudo guardar el seguimiento');
          }
          return;
        }
        if (ev.target.matches('[data-cancel-followup]')) {
          const reason = overlay.querySelector('[data-input-obs]')?.value || 'Cancelado desde el panel veterinario';
          const confirmCancel = window.confirm('¿Confirmás cancelar este seguimiento?');
          if (!confirmCancel) return;
          try {
            await cancelFollowUp(seg.Id, { Observaciones: reason });
            showToast('success', '✖ Seguimiento cancelado.');
            overlay.remove();
            await refreshFollowups();
          } catch (err) {
            showToast('error', err.message || 'No se pudo cancelar el seguimiento');
          }
        }
      });
      document.body.appendChild(overlay);
    };
    const renderSegs = () => {
      if (!segTbody) return;
      segTbody.innerHTML = (followupsState.items || [])
        .map((s) => {
          const name = getFollowupName(s);
          const fecha = s.FechaSeguimiento ? new Date(s.FechaSeguimiento).toLocaleDateString() : '';
          return `
            <tr data-seg-row data-id="${s.Id}">
              <td>${s.Id}</td>
              <td>${name}</td>
              <td>${s.EstadoSeguimiento || '-'}</td>
              <td>${fecha}</td>
              <td>
                <button type="button" class="btn-link" data-accion="ver">👁 Ver y reprogramar</button>
                <button type="button" class="btn-link" data-accion="cancelar">✖ Cancelar</button>
              </td>
            </tr>`;
        })
        .join('');
    };
    const loadFollowups = async () => {
      try {
        const results = await Promise.allSettled([listAllFollowUps(), getAllPets()]);
        followupsState.items = results[0]?.status === 'fulfilled' ? (results[0].value || []) : [];
        const pets = results[1]?.status === 'fulfilled' ? (results[1].value || []) : [];
        followupsState.animalsIndex = new Map((pets || []).map((p) => [String(p.Id), p]));
        renderSegs();
      } catch (error) {
        console.error('No se pudieron cargar los seguimientos', error);
      }
    };
    refreshFollowups = async () => {
      await loadFollowups();
      try {
        refreshSummary();
      } catch {}

  // Seguimiento: alta (form already wired)
  const segAlta = container.querySelector('[data-seg-alta]');
  segAlta.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = serialize(form);
    if (!payload.FechaSeguimiento || !payload.Observaciones) {
      feedback(form, 'Debe completar todos los campos obligatorios', 'error');
      return;
    }
    feedback(form, 'Registrando...', 'info');
    try {
      const response = await createFollowUp(payload);
      const message = response?.message || 'Seguimiento registrado';
      feedback(form, message, 'success');
      showToast('success', message);
      form.reset();
      await refreshFollowups();
    } catch (error) {
      const message = error.message || 'No se pudo registrar el seguimiento';
      feedback(form, message, 'error');
    }
  });

  // Formularios de modificar/cancelar (backward compatible por si se usan externamente)
  const segMod = container.querySelector('[data-seg-mod]');
  if (segMod) {
    segMod.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const id = form.elements.SeguimientoId.value;
      if (!id) {
        feedback(form, 'IngresÃ¡ el ID del seguimiento', 'error');
        return;
      }
      feedback(form, 'Actualizando...', 'info');
      try {
        const response = await updateFollowUp(id, { Observaciones: form.elements.Observaciones.value });
        const message = response?.message || 'Seguimiento actualizado';
        feedback(form, message, 'success');
        showToast('success', message);
        form.reset();
        refreshSummary();
      } catch (error) {
        const message = error.message || 'No se pudo actualizar';
        if (message.includes('Este seguimiento no puede ser modificado')) {
          feedback(form, 'Este seguimiento no puede ser modificado', 'error');
        } else {
          feedback(form, message, 'error');
        }
      }
    });
  }

  const segCancel = container.querySelector('[data-seg-cancel]');
  if (segCancel) {
    segCancel.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const id = form.elements.SeguimientoId.value;
      if (!id) {
        feedback(form, 'IngresÃ¡ el ID del seguimiento', 'error');
        return;
      }
      feedback(form, 'Cancelando...', 'info');
      try {
        const response = await cancelFollowUp(id, { Observaciones: form.elements.Observaciones.value });
        const message = response?.message || 'âœ… Seguimiento cerrado.';
        feedback(form, message, 'success');
        showToast('success', message);
        form.reset();
        refreshSummary();
      } catch (error) {
        const message = error.message || 'No se pudo cancelar';
        if (message.includes('Este seguimiento no puede cancelarse')) {
          feedback(form, 'Este seguimiento no puede cancelarse', 'error');
        } else {
          feedback(form, message, 'error');
        }
      }
    });
  }

  // Historial mÃ©dico: bÃºsqueda + render
  try {
    const searchForm = container.querySelector('[data-search-animal]');
    const card = container.querySelector('[data-animal-card]');
    const ctrlsPanel = container.querySelector('[data-animal-controles]');
    const ctrlsTbody = container.querySelector('[data-animal-ctrls] tbody');
    const segPanel = container.querySelector('[data-animal-seg]');
    const segList = container.querySelector('[data-animal-seg-list]');
    let currentAnimal = null;
    const renderCard = async (animal) => {
      if (!animal) { card.classList.remove('is-active'); card.style.display = 'none'; return; }
      const controles = await listControls(animal.Id).catch(() => []);
      const ultimo = controles[0];
      card.classList.add('is-active');
      card.style.display = '';
      card.innerHTML = `
        <h2 class="operator-panel__title">Ficha mÃ©dica</h2>
        <div><strong>ðŸ¾ ${animal.Nombre || 'Sin nombre'}</strong> â€” ${animal.EspecieRaza || ''}</div>
        <div><span class="muted">Edad:</span> ${animal.Edad ?? '-'} â€” <span class="muted">Estado actual:</span> ${animal.EstadoSalud || '-'}</div>
        <div><span class="muted">Ãšltimo control:</span> ${ultimo?.Fecha ? new Date(ultimo.Fecha).toLocaleDateString() : '-'}</div>
      `;
      // Controles en tabla
      const renderCtrlRows = (rows) => {
        ctrlsTbody.innerHTML = (rows || []).map(c => `
          <tr>
            <td>${c.Fecha ? new Date(c.Fecha).toLocaleDateString() : ''}</td>
            <td>${c.Diagnostico || ''}</td>
            <td>${c.Resultado || ''}</td>
            <td>${c.ProximaCita ? new Date(c.ProximaCita).toLocaleDateString() : ''}</td>
          </tr>`).join('');
      };
      renderCtrlRows(controles);
      if (ctrlsPanel) { ctrlsPanel.classList.add('is-active'); ctrlsPanel.style.display = ''; }
      // Seguimientos: sin vÃ­nculo directo en API; mostrar placeholder
      segList.innerHTML = '<p class="muted">No hay seguimientos vinculados a este animal.</p>';
      if (segPanel) { segPanel.classList.add('is-active'); segPanel.style.display = ''; }
    };
    searchForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const q = searchForm.elements.q.value.trim().toLowerCase();
      if (!q) { feedback(searchForm, 'IngresÃ¡ un tÃ©rmino de bÃºsqueda', 'error'); return; }
      feedback(searchForm, 'Buscando...', 'info');
      try {
        const animals = animalsCache.length ? animalsCache : await getAllPets();
        const found = animals.find(a => String(a.Id) === q || String(a.Nombre || '').toLowerCase().includes(q));
        if (!found) { feedback(searchForm, 'No se encontrÃ³ el animal', 'error'); return; }
        currentAnimal = found;
        await renderCard(found);
        feedback(searchForm, 'Resultados actualizados', 'success');
      } catch (err) {
        feedback(searchForm, err.message || 'No se pudo buscar', 'error');
      }
    });
    container.querySelector('[data-filtrar-controles]')?.addEventListener('click', async () => {
      if (!currentAnimal) return;
      const desde = container.querySelector('[data-ctrl-desde]').value;
      const hasta = container.querySelector('[data-ctrl-hasta]').value;
      let rows = await listControls(currentAnimal.Id).catch(() => []);
      const dts = desde ? Date.parse(desde) : -Infinity; const hts = hasta ? Date.parse(hasta) : Infinity;
      rows = rows.filter(c => { const t = c.Fecha ? Date.parse(c.Fecha) : 0; return t >= dts && t <= hts; });
      ctrlsTbody.innerHTML = rows.map(c => `
        <tr>
          <td>${c.Fecha ? new Date(c.Fecha).toLocaleDateString() : ''}</td>
          <td>${c.Diagnostico || ''}</td>
          <td>${c.Resultado || ''}</td>
          <td>${c.ProximaCita ? new Date(c.ProximaCita).toLocaleDateString() : ''}</td>
        </tr>`).join('');
    });
    container.querySelector('[data-exportar]')?.addEventListener('click', () => {
      // Export simple via print to PDF
      window.print();
    });
  } catch {}

  // Right panel tabs + data
  try {
    const rtabs = [
      { btn: '#rbtn-controles', panel: '#r-controles' },
      { btn: '#rbtn-seguimientos', panel: '#r-seguimientos' },
      { btn: '#rbtn-animales', panel: '#r-animales' },
    ];
    rtabs.forEach(({ btn, panel }) => {
      const b = container.querySelector(btn);
      b?.addEventListener('click', () => {
        rtabs.forEach(({ btn: bb, panel: pp }) => {
          const btnEl = container.querySelector(bb);
          const panelEl = container.querySelector(pp);
          const isActive = bb === btn;
          btnEl?.setAttribute('aria-selected', String(isActive));
          if (panelEl) panelEl.hidden = !isActive;
        });
      });
    });
    // Populate recent animals
    (async () => {
      try {
        const animals = await getAllPets();
        const listNode = container.querySelector('[data-recent-animals]');
        const empty = container.querySelector('[data-recent-animals-empty]');
        const top = animals
          .slice()
          .sort((a,b) => Date.parse(b.FechaActualizacion||0) - Date.parse(a.FechaActualizacion||0))
          .slice(0, 8);
        if (!top.length) { listNode.innerHTML=''; empty.style.display=''; } else {
          listNode.innerHTML = top.map(a => `
            <div class="operator-list__item">
              <div class="operator-list__meta">
                <span class="chip chip--blue">Animal</span>
                <span class="muted">#${a.Id}</span>
              </div>
              <div class="operator-list__main">
                <strong>${a.Nombre || 'Sin nombre'}</strong>
                <span>Estado: ${a.EstadoSalud || '-'}</span>
              </div>
              <div class="operator-list__date">${a.FechaActualizacion ? new Date(a.FechaActualizacion).toLocaleDateString() : ''}</div>
            </div>`).join('');
        }
      } catch {}
    })();
    // Populate recent followups
    (async () => {
      try {
        const segs = await listAllFollowUps();
        const listNode = container.querySelector('[data-recent-segs]');
        const empty = container.querySelector('[data-recent-segs-empty]');
        const items = segs
          .slice()
          .sort((a,b) => Date.parse(b.FechaSeguimiento||0) - Date.parse(a.FechaSeguimiento||0))
          .slice(0, 10);
        if (!items.length) { listNode.innerHTML=''; empty.style.display=''; } else {
          listNode.innerHTML = items.map(s => `
            <div class="operator-list__item">
              <div class="operator-list__meta"><span class="chip chip--green">Seguimiento</span><span class="muted">#${s.Id}</span></div>
              <div class="operator-list__main"><strong>${s.EstadoSeguimiento || '-'}</strong><span>Solicitud #${s.SolicitudId || '-'}</span></div>
              <div class="operator-list__date">${s.FechaSeguimiento ? new Date(s.FechaSeguimiento).toLocaleDateString() : ''}</div>
            </div>`).join('');
        }
      } catch {}
    })();
    // Populate recent controls (best-effort: fetch top animals, then their controls)
    (async () => {
      try {
        const animals = await getAllPets();
        const candidates = animals
          .slice()
          .sort((a,b) => Date.parse(b.FechaActualizacion||0) - Date.parse(a.FechaActualizacion||0))
          .slice(0, 5);
        const entries = [];
        for (const a of candidates) {
          try {
            const ctrls = await listControls(a.Id);
            if (ctrls && ctrls.length) {
              const last = ctrls[0];
              entries.push({ animal: a, control: last });
            }
          } catch {}
        }
        const listNode = container.querySelector('[data-recent-controls]');
        const empty = container.querySelector('[data-recent-controls-empty]');
        if (!entries.length) { listNode.innerHTML=''; empty.style.display=''; } else {
          listNode.innerHTML = entries.map(({animal, control}) => `
            <div class="operator-list__item">
              <div class="operator-list__meta"><span class="chip">Control</span><span class="muted">#${control.Id}</span></div>
              <div class="operator-list__main"><strong>${animal.Nombre || 'Sin nombre'}</strong><span>Resultado: ${control.Resultado || '-'}</span></div>
              <div class="operator-list__date">${control.Fecha ? new Date(control.Fecha).toLocaleDateString() : ''}</div>
            </div>`).join('');
        }
      } catch {}
    })();
  } catch {}

  return () => {};
}

