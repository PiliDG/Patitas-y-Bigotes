import { createControl, listControls } from '../services/controlsService.js';
import { createFollowUp, updateFollowUp, cancelFollowUp, listAllFollowUps } from '../services/followupsService.js';
import { getAllPets, invalidatePetsCache, reloadPets } from '../services/petsService.js';
import { listAllApplications } from '../services/adoptionsService.js';
import { showToast } from '../components/Toast.js';
import { getVetSummary } from '../services/vetSummaryService.js';
import { normalizeImageSrc } from '../utils/image.js';
import { getState } from '../state/store.js';

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

const FOLLOWUP_STATUS_BADGES = {
  activo: 'badge--success',
  pendiente: 'badge--pending',
  cancelado: 'badge--neutral',
  finalizado: 'badge--info'
};

function renderStatusBadge(value) {
  const label = (value || '').toString().trim() || '-';
  const key = label.toLowerCase();
  const cls = FOLLOWUP_STATUS_BADGES[key] || 'badge--neutral';
  return `<span class="status-pill ${cls}">${label}</span>`;
}

export default function renderDashboardVet(container) {
  container.innerHTML = `
    <section class="dashboard-header operator-header">
      <h1>Panel Veterinario</h1>
      <p>Registrá controles sanitarios, seguí la evolución clínica y consultá el historial.</p>
    </section>

    <section class="dashboard-operator">
      <div class="operator-left">
        <section class="dashboard-card">
          <div class="operator-tabs" role="tablist" aria-label="Secciones clínicas">
            <button class="chip" role="tab" aria-selected="true" aria-controls="tab-controles" id="tabbtn-controles">🩺 Controles sanitarios</button>
            <button class="chip" role="tab" aria-selected="false" aria-controls="tab-seguimientos" id="tabbtn-seguimientos">📋 Seguimientos clínicos</button>
            <button class="chip" role="tab" aria-selected="false" aria-controls="tab-historial" id="tabbtn-historial">📚 Historial médico</button>
          </div>

          <div id="tab-controles" role="tabpanel" aria-labelledby="tabbtn-controles">
            <form data-control class="operator-form modern" novalidate>
              <h4>Control sanitario</h4>
              <div class="form-row">
                <label><span>ID Animal</span><input name="AnimalId" type="text" inputmode="numeric" pattern="[0-9]*" list="animals-list" placeholder="Ej.: 101" /></label>
                <label><span>Fecha del control</span><input name="Fecha" type="date" /></label>
                <label><span>Diagnóstico</span><input name="Diagnostico" /></label>
                <label><span>Vacunas</span><input name="Vacunas" /></label>
                <label><span>Tratamiento</span><input name="Tratamiento" /></label>
              </div>
              <div class="form-row">
                <label><span>Resultado</span>
                  <select name="Resultado">
                    <option value="">Seleccioná</option>
                    <option value="Apto">Apto</option>
                    <option value="Requiere tratamiento">Requiere tratamiento</option>
                    <option value="No apto">No apto</option>
                  </select>
                </label>
                <label><span>Próxima cita</span><input name="ProximaCita" type="date" /></label>
                <label class="full"><span>Observaciones</span><textarea name="Observaciones" rows="2"></textarea></label>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">Registrar control</button>
                <button type="button" class="btn-secondary" data-open-historial>Ver historial de controles</button>
              </div>
              <p class="error-text" data-baja-notice style="display:none; margin-top:8px;">Este animal ya fue dado de baja.</p>
              <div class="form-feedback" aria-live="polite"></div>
            </form>

            <div class="operator-panel" data-historial style="display:none">
              <h2 class="operator-panel__title">Historial de controles</h2>
              <div class="operator-form inline" data-controles-list novalidate>
                <label class="col-2"><span>ID Animal</span><input name="AnimalId" type="text" inputmode="numeric" pattern="[0-9]*" list="animals-list" placeholder="Ej.: 101" /></label>
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
                      <th>Diagnóstico</th>
                      <th>Resultado</th>
                      <th>Próxima cita</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
          </div>

          <div id="tab-seguimientos" role="tabpanel" aria-labelledby="tabbtn-seguimientos" hidden>
            <section class="panel-card followups-card">
              <header class="panel-card__header followups-card__header">
                <div>
                  <h3>Seguimientos</h3>
                  <p class="muted">Controla los casos posteriores a la adopcion.</p>
                </div>
                <label class="followups-card__filter">
                  <span>Tipo</span>
                  <select data-followup-filter>
                    <option value="">Todos</option>
                    <option value="Veterinario" selected>Veterinario</option>
                    <option value="Domiciliario">Domiciliario</option>
                    <option value="Administrativo">Administrativo</option>
                  </select>
                </label>
              </header>
              <div class="table-wrapper followups-card__table">
                <table class="data-table" data-segs-table>
                  <thead>
                    <tr>
                      <th>ID seguimiento</th>
                      <th>Animal</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Observaciones</th>
                      <th class="actions-col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </section>
            <div class="panel-columns" style="margin-top:16px">
              <section class="panel-card">
                <header class="panel-card__header">
                  <h3>Nuevo seguimiento</h3>
                </header>
            <form data-seg-alta class="operator-form modern" novalidate>
              <input type="hidden" name="TipoSeguimiento" value="Veterinario" />
              <div class="form-row">
                <label>ID o nombre de Animal<input name="AnimalId" type="text" list="animals-list" placeholder="Ej.: 101 o Luna" /></label>
              </div>
              <div class="form-row">
                <label>Fecha<input name="FechaSeguimiento" type="date" /></label>
                <label>Estado
                  <select name="EstadoSeguimiento">
                    <option value="Activo">Activo</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Finalizado">Finalizado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </label>
              </div>
              <label>Observaciones<textarea name="Observaciones" rows="3" placeholder="Notas internas, recomendaciones o molestias detectadas"></textarea></label>
              <div class="form-actions">
                <button type="submit" class="btn-primary">Crear seguimiento</button>
                    <div class="form-feedback" aria-live="polite"></div>
                  </div>
                </form>
              </section>
              <section class="panel-card">
                <header class="panel-card__header">
                  <h3>Actualizar / cancelar</h3>
                </header>
                <form data-seg-mod class="operator-form modern" novalidate>
                  <div class="form-row">
                    <label>ID Seguimiento<input name="SeguimientoId" type="number" /></label>
                    <label>Estado
                      <select name="EstadoSeguimiento">
                        <option value="">Sin cambios</option>
                        <option value="Activo">Activo</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Finalizado">Finalizado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </label>
                    <label>Tipo
                      <select name="TipoSeguimiento">
                        <option value="">Sin cambios</option>
                        <option value="Veterinario">Veterinario</option>
                        <option value="Administrativo">Administrativo</option>
                        <option value="Domiciliario">Domiciliario</option>
                      </select>
                    </label>
                  </div>
                  <label>Observaciones<textarea name="Observaciones" rows="3" placeholder="Actualizaciones clínicas o evolución"></textarea></label>
                  <div class="form-actions">
                    <button type="submit" class="btn-secondary">Guardar</button>
                    <div class="form-feedback" aria-live="polite"></div>
                  </div>
                </form>
                <form data-seg-cancel class="operator-form modern" novalidate>
                  <label>ID Seguimiento<input name="SeguimientoId" type="number" /></label>
                  <label>Motivo<textarea name="Observaciones" rows="2" placeholder="Motivo de cancelación"></textarea></label>
                  <div class="form-actions">
                    <button type="submit" class="btn-tertiary">Cancelar seguimiento</button>
                    <div class="form-feedback" aria-live="polite"></div>
                  </div>
                </form>
              </section>
            </div>
          </div>

          <div id="tab-historial" role="tabpanel" aria-labelledby="tabbtn-historial" hidden>
            <form class="operator-form inline" data-search-animal novalidate>
              <label class="col-3"><span>Buscar por nombre o ID</span><input name="q" placeholder="Ej.: Luna o 101" list="animals-list" /></label>
              <button type="submit" class="btn-secondary">Buscar</button>
              <button type="button" class="btn-link" data-exportar>Exportar PDF</button>
              <div class="form-feedback" aria-live="polite"></div>
            </form>
            <div class="operator-panel" data-animal-card style="display:none"></div>
            <div class="operator-panel" data-animal-controles style="display:none">
              <h2 class="operator-panel__title">Controles sanitarios anteriores</h2>
              <div class="table-scroller" style="overflow:auto; max-height: 340px">
                <table class="data-table" data-animal-ctrls style="width:100%">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Diagnóstico</th>
                      <th>Resultado</th>
                      <th>Próxima cita</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
            <div class="operator-panel" data-animal-seg style="display:none">
              <h2 class="operator-panel__title">Seguimientos clínicos anteriores</h2>
              <div class="operator-list" data-animal-seg-list></div>
            </div>
          </div>
        </section>
      </div>

      <aside class="operator-right">
        <div class="operator-panel">
          <div class="operator-tabs" role="tablist" aria-label="Resumen reciente">
            <button class="chip" role="tab" aria-selected="true" aria-controls="r-controles" id="rbtn-controles">🩺 Controles recientes</button>
            <button class="chip" role="tab" aria-selected="false" aria-controls="r-seguimientos" id="rbtn-seguimientos">📋 Seguimientos activos</button>
            <button class="chip" role="tab" aria-selected="false" aria-controls="r-animales" id="rbtn-animales">🐾 Animales atendidos</button>
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

  // Asegurar contenedor para métricas del encabezado
  try {
    const header = container.querySelector('.dashboard-header');
    if (header && !header.querySelector('[data-vet-stats]')) {
      const meta = document.createElement('div');
      meta.className = 'operator-meta';
      meta.setAttribute('data-vet-stats', '');
      meta.innerHTML = '<span class="meta-chip">Cargando métricas…</span>';
      header.appendChild(meta);
    }
  } catch {}

  const dispatchControlRegistered = (animalId) => {
    const id = animalId ? String(animalId) : null;
    if (!id) return;
    try {
      window.dispatchEvent(new CustomEvent('dashboard:control-registered', { detail: { animalId: id } }));
    } catch {}
  };

  let vetMetricsUpdater = null;



  async function refreshMetrics() {

    if (!vetMetricsUpdater) return;

    try {

      await vetMetricsUpdater();

    } catch {}

  }



  function setupVetStats() {

    const statsNode = container.querySelector('[data-vet-stats]');

    if (!statsNode) return null;



    const ensureStructure = () => {

      if (statsNode.querySelector('[data-key]')) return;

      statsNode.setAttribute('aria-live', 'polite');

      statsNode.setAttribute('aria-busy', 'true');

      statsNode.innerHTML = [

        '<span class="meta-chip" data-key="total">Total: <b data-value>0</b></span>',

        '<span class="meta-chip" data-key="aptos">Aptos: <b data-value>0</b></span>',

        '<span class="meta-chip" data-key="tratamiento">Tratamiento: <b data-value>0</b></span>',

        '<span class="meta-chip" data-key="solicitudes">Solicitudes: <b data-value>0</b></span>',

        '<span class="meta-chip" data-key="seguimientos">Seguimientos activos: <b data-value>0</b></span>'

      ].join('');

    };



    const setValue = (key, value) => {

      const el = statsNode.querySelector(`[data-key="${key}"] b[data-value]`);

      if (!el) return;

      const text = value ?? '-';

      if (el.textContent !== String(text)) el.textContent = String(text);

    };



    return async function updateValues() {

      ensureStructure();

      statsNode.setAttribute('aria-busy', 'true');

      try {

        const [animals, apps, followups] = await Promise.all([

          reloadPets().catch(async () => await getAllPets().catch(() => [])),

          listAllApplications().catch(() => []),

          listAllFollowUps().catch(() => [])

        ]);



        const total = (animals || []).length;

        const aptos = (animals || []).filter(a => {

          const s = String(a.EstadoSalud || '').toLowerCase();

          const hasApto = /apto/.test(s) || s.includes('apto para adop');

          const isNotApto = /no\s+apto/.test(s) || /inapto/.test(s);

          return hasApto && !isNotApto;

        }).length;

        const tratamiento = (animals || []).filter(a => String(a.EstadoSalud || '').toLowerCase().includes('tratamiento')).length;

        const solicitudesPendRev = (apps || []).filter(s => {

          const st = String(s.EstadoSolicitud || '').toLowerCase();

          return st.includes('pendiente') || st.includes('revisi');

        }).length;

        const segActivos = (followups || []).filter(sg => {

          const s = String(sg.EstadoSeguimiento || '').toLowerCase();

          const isActive = /activo/.test(s);

          const isInactive = /inactivo/.test(s);

          return isActive && !isInactive;

        }).length;



        setValue('total', total);

        setValue('aptos', aptos);

        setValue('tratamiento', tratamiento);

        setValue('solicitudes', solicitudesPendRev);

        setValue('seguimientos', segActivos);

        statsNode.removeAttribute('data-error');

        statsNode.removeAttribute('title');

      } catch (err) {

        statsNode.setAttribute('data-error', 'true');

        statsNode.setAttribute('title', 'No se pudieron cargar métricas');

      } finally {

        statsNode.setAttribute('aria-busy', 'false');

      }

    };

  }



  vetMetricsUpdater = setupVetStats();



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
            <p class="muted">Accesos rápidos a los últimos movimientos</p>
          </header>
          <nav class="summary-tabs" data-summary-tabs>
            <button type="button" class="summary-tab is-active" data-summary-target="animales">🐾 Animales</button>
            <button type="button" class="summary-tab" data-summary-target="solicitudes">📄 Solicitudes</button>
            <button type="button" class="summary-tab" data-summary-target="seguimientos">🔍 Seguimientos</button>
            <button type="button" class="summary-tab" data-summary-target="pendientes">⏱ Pendientes de control</button>
          </nav>
          <div class="summary-list" data-summary-panel="animales"><p class="muted">Cargando…</p></div>
          <div class="summary-list hidden" data-summary-panel="solicitudes"><p class="muted">Cargando…</p></div>
          <div class="summary-list hidden" data-summary-panel="seguimientos"><p class="muted">Cargando…</p></div>
          <div class="summary-list hidden" data-summary-panel="pendientes"><p class="muted">Cargando…</p></div>
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
      solicitud: { Pendiente: 'badge--pending', 'En revisión': 'badge--review', Aprobada: 'badge--success', Rechazada: 'badge--error', Anulada: 'badge--neutral' },
      seguimiento: { Activo: 'badge--success', Cerrado: 'badge--neutral', Cancelado: 'badge--neutral', Finalizado: 'badge--success' },
      animal: {
        'En tratamiento': 'badge--warning',
        'Alta médica': 'badge--success',
        Disponible: 'badge--success',
        'Pendiente de control': 'badge--warning',
        'No apto': 'badge--error',
        Baja: 'badge--neutral'
      },
      control: {
        'Apto': 'badge--success',
        'Requiere tratamiento': 'badge--warning',
        'No apto': 'badge--error',
        'Control sanitario': 'badge--neutral',
      }
    };
    const cls = (map[kind] && map[kind][label]) || 'badge--neutral';
    return `<span class="status-pill ${cls}">${label}</span>`;
  }

  const summaryAside = container.querySelector('[data-vet-summary]') || container.querySelector('.operator-side[data-vet-summary]');
  if (summaryAside) setupSummaryTabs(summaryAside);

  const state = {
    followups: []
  };

  const normalizeStateLabel = (value) => {
    const label = (value || '').toString().trim();
    const normalized = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!label) return 'Disponible';
    if (normalized.includes('pendient')) return 'Pendiente de control';
    if (normalized.includes('tratamiento')) return 'En tratamiento';
    if (normalized.includes('no apto')) return 'No apto';
    if (normalized.includes('baja')) return 'Baja';
    if (normalized.includes('apto') || normalized.includes('alta')) return 'Alta médica';
    if (normalized.includes('disponible')) return 'Disponible';
    return label;
  };

  const normalizeStateValue = (value) =>
    value?.toString().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() || '';

  const isPendingControlState = (pet) => {
    if (!pet) return false;
    const salud = normalizeStateValue(pet.EstadoSalud);
    const solicitud = normalizeStateValue(pet.EstadoSolicitud);
    const excluded = /(baja|no disponible|adoptado?|reservado)/.test(solicitud);
    if (excluded) return false;
    return salud.includes('pendient') || solicitud.includes('pendient');
  };

  const mapPetToSummaryItem = (pet) => {
    const estadoRaw = (pet.EstadoSalud || pet.estado || '').toString();
    const mappedEstado = normalizeStateLabel(estadoRaw);
    return {
      id: pet.Id,
      animalId: pet.Id,
      nombre: pet.Nombre || '',
      especie: pet.EspecieRaza || '',
      estado: mappedEstado,
      estadoRaw,
      fecha: pet.FechaActualizacion || pet.FechaIngreso || null,
    };
  };

  let summaryPetsCache = null;
  const ensureSummaryPets = async () => {
    if (Array.isArray(summaryPetsCache)) return summaryPetsCache;
    const list = await getAllPets().catch(() => []);
    summaryPetsCache = Array.isArray(list) ? list : [];
    return summaryPetsCache;
  };

  async function refreshSummary() {
    if (!summaryAside) return;
    try {
      const data = await getVetSummary();
      const animaPanel = summaryAside.querySelector('[data-summary-panel="animales"]');
      const soliPanel = summaryAside.querySelector('[data-summary-panel="solicitudes"]');
       const segPanel = summaryAside.querySelector('[data-summary-panel="seguimientos"]');
       const pendingPanel = summaryAside.querySelector('[data-summary-panel="pendientes"]');
      const updated = summaryAside.querySelector('[data-summary-updated]');

      let animals = data.animales || [];
      if (!animals.length) {
        const pets = await ensureSummaryPets();
        const mapped = (Array.isArray(pets) ? pets : [])
          .slice(0, 5)
          .map(mapPetToSummaryItem);
        animals = mapped;
      }
      animaPanel.innerHTML = animals.length
        ? animals.map((a) => `
            <button type="button" class="summary-item" data-goto="controles" data-animal-id="${a.animalId || a.id}">
              <span class="summary-icon">🐾</span>
              <div>
                <strong>${a.nombre || 'Sin nombre'}</strong>
                <p>${a.especie || ''}</p>
                <span>${a.fecha ? new Date(a.fecha).toLocaleDateString() : ''}</span>
              </div>
              ${badge((() => { const s = (a.estado||'').toString().trim(); const low = s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); if (low.includes('adop')) return 'Disponible'; if (low.includes('no adopt')) return 'No disponible'; return s || 'Disponible'; })(), 'animal')}
            </button>
          `).join('')
        : '<p class="muted">Sin animales recientes.</p>';

      const solicitudes = data.solicitudes || [];
      soliPanel.innerHTML = solicitudes.length
        ? solicitudes.map((s) => `
            <button type="button" class="summary-item" data-goto="controles" data-animal-id="${s.animalId || ''}">
              <span class="summary-icon">📄</span>
              <div>
                <strong>#${s.id}</strong>
                <p>${s.adoptante || ''} — ${s.animal || ''}</p>
                <span>${s.fecha ? new Date(s.fecha).toLocaleDateString() : ''}</span>
              </div>
              ${badge(s.estado || 'Pendiente', 'solicitud')}
            </button>
          `).join('')
        : '<p class="muted">Sin solicitudes recientes.</p>';

      state.followups = await listAllFollowUps().catch(() => state.followups);
      const summarySegs = data.seguimientos || [];
      const combined = new Map();
      const normalizeSeg = (sg) => ({
        id: sg.Id || sg.id,
        animalId: sg.AnimalId || sg.animalId || sg.IdAnimal || null,
        animal: sg.AnimalNombre || sg.animal || sg.Animal || '',
        estado: sg.EstadoSeguimiento || sg.estado || 'Activo',
        fecha: sg.FechaSeguimiento || sg.fecha || null,
        proximaCita: sg.ProximaCita || null,
        tipo: sg.TipoSeguimiento || sg.tipo || '',
        source: sg.source || ''
      });
      (state.followups || []).forEach((sg) => {
        const normalized = normalizeSeg(sg);
        if (normalized.id) combined.set(normalized.id, normalized);
      });
      summarySegs.forEach((sg) => {
        const normalized = normalizeSeg(sg);
        if (normalized.id) combined.set(normalized.id, normalized);
      });
      const allSeguimientos = Array.from(combined.values());
      const veterinarySeguimientos = allSeguimientos.filter((sg) => {
        const tipo = (sg.tipo || '').toString().toLowerCase();
        const estado = (sg.estado || '').toString().toLowerCase();
        const isVeterinarySource = sg.source === 'control';
        return tipo === 'veterinario' || isVeterinarySource || estado.includes('veterinario');
      });
      segPanel.innerHTML = veterinarySeguimientos.length
        ? veterinarySeguimientos.map((sg) => {
            const isControl = sg.source === 'control';
            const icon = '🩺';
            const title = isControl ? `Control #${sg.id}` : `Seguimiento #${sg.id}`;
            const estadoEtiqueta = sg.estado || (isControl ? 'Control sanitario' : 'Activo');
            const subtitle = `${sg.animal || 'Sin animal'}${isControl ? ` · ${estadoEtiqueta}` : ''}`;
            const metaParts = [
              sg.fecha ? new Date(sg.fecha).toLocaleDateString() : '',
              sg.proximaCita ? `Próx: ${new Date(sg.proximaCita).toLocaleDateString()}` : ''
            ].filter(Boolean).join(' · ');
            const badgeKind = isControl ? 'control' : 'seguimiento';
            const gotoTarget = isControl ? 'controles' : 'seguimientos';
            return `
              <button type="button" class="summary-item" data-goto="${gotoTarget}" data-seg-id="${sg.id}" data-animal-id="${sg.animalId || ''}">
                <span class="summary-icon">${icon}</span>
                <div>
                  <strong>${title}</strong>
                  <p>${subtitle}</p>
                  <span>${metaParts}</span>
                </div>
                ${badge(estadoEtiqueta, badgeKind)}
              </button>
            `;
          }).join('')
        : '<p class="muted">Sin seguimientos recientes.</p>';

      if (pendingPanel) {
        const pets = await ensureSummaryPets();
        const pending = (pets || [])
          .filter((p) => isPendingControlState(p))
          .slice(0, 5)
          .map(mapPetToSummaryItem);
        pendingPanel.innerHTML = pending.length
          ? pending.map((a) => `
              <button type="button" class="summary-item" data-goto="controles" data-animal-id="${a.animalId || a.id}">
                <span class="summary-icon">⏱</span>
                <div>
                  <strong>${a.nombre || 'Sin nombre'}</strong>
                  <p>${a.especie || ''}</p>
                  <span>${a.fecha ? new Date(a.fecha).toLocaleDateString() : ''}</span>
                </div>
                ${badge(a.estado || 'Pendiente de control', 'animal')}
              </button>
            `).join('')
          : '<p class="muted">Sin pendientes de control.</p>';
      }

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
            try {
              setTimeout(() => {
                const viewBtn = container.querySelector(`[data-followup-view="${segId}"]`);
                if (viewBtn) viewBtn.click();
              }, 50);
            } catch {}
          }
        }, { once: true });
      });
      // Hover card (rollover) con estilo del panel del Operador: tarjeta centrada con overlay y botón cerrar
      try {
        let animalsCache = null;
        const ensureHoverCard = () => {
          let card = document.getElementById('animal-hover-card');
          if (!card) {
            card = document.createElement('div');
            card.id = 'animal-hover-card';
            card.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;pointer-events:auto;display:none;width:min(860px,90vw);max-height:80vh;overflow:auto;background:#fff;border:1px solid #e6e6e6;border-radius:16px;box-shadow:0 12px 28px rgba(0,0,0,.18);padding:16px;';
            document.body.appendChild(card);
          }
          return card;
        };
        const ensureOverlay = () => {
          let ov = document.getElementById('animal-overlay');
          if (!ov) {
            ov = document.createElement('div');
            ov.id = 'animal-overlay';
            ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:9998;display:none;';
            document.body.appendChild(ov);
          }
          return ov;
        };
        const buildCard = (a) => {
          const imgSrc = normalizeImageSrc(a.Foto);
          const photo = imgSrc ? `<img src="${imgSrc}" alt="${a.Nombre||''}" style="width:100%;height:auto;border-radius:12px;object-fit:cover;" onerror="this.style.display='none'"/>` : '';
          const fmtDate = (s) => { try { return s ? new Date(s).toLocaleDateString() : '-'; } catch { return '-'; } };
          const fmtDateTime = (s) => { try { const d = s ? new Date(s) : null; return d ? `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : '-'; } catch { return '-'; } };
          return `
            <article class="panel-card" style="box-shadow:none;padding:0;background:transparent;position:relative;">
              <div class="card-close-bar" style="position:relative;display:flex;justify-content:flex-end;padding:8px;background:linear-gradient(#fff,#fff);z-index:1;border-top-left-radius:16px;border-top-right-radius:16px;">
                <button type="button" class="card-close-btn" data-close-card aria-label="Cerrar" title="Cerrar" style="width:32px;height:32px;border:1px solid #e6e6e6;border-radius:999px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#444;">
                  <span class="icon material-symbols-outlined" aria-hidden="true">close</span>
                  <span class="sr-only">Cerrar</span>
                </button>
              </div>
              <button type="button" data-close-card aria-label="Cerrar" title="Cerrar" style="position:absolute;right:8px;top:8px;width:32px;height:32px;border:1px solid #e6e6e6;border-radius:999px;background:#fff;cursor:pointer;line-height:30px;text-align:center;font-size:18px;color:#444">×</button>
              <div style="display:grid;grid-template-columns: 280px 1fr;gap:20px;align-items:start;">
                <div>${photo}</div>
                <div>
                  <header class="panel-card__header" style="margin-bottom:8px;">
                    <h3 style="margin:0">${a.Nombre || ''}</h3>
                    <p class="muted" style="margin:4px 0 0">ID #${a.Id} · ${a.EspecieRaza || ''}</p>
                  </header>
                  <dl class="detail-grid">
                <div><dt>Estado adopción</dt><dd>${badge((() => { const s=(a.EstadoSolicitud||'').toString().trim(); const low=s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); if (low.includes('adop')) return 'Disponible'; if (low.includes('no adopt')) return 'No disponible'; return s || 'Disponible'; })(), 'animal')}</dd></div>
                    <div><dt>Estado salud</dt><dd>${a.EstadoSalud || '-'}</dd></div>
                    <div><dt>Ingreso</dt><dd>${fmtDate(a.FechaIngreso)}</dd></div>
                    <div><dt>Última actualización</dt><dd>${fmtDateTime(a.FechaActualizacion)}</dd></div>
                    <div><dt>Origen</dt><dd>${a.Origen || '-'}</dd></div>
                    <div><dt>Resultado</dt><dd>${a.Resultado || '-'}</dd></div>
                    <div><dt>Sexo</dt><dd>${a.Sexo || '-'}</dd></div>
                    <div><dt>Edad</dt><dd>${a.Edad ?? '-'}</dd></div>
                    <div><dt>Peso</dt><dd>${a.Peso ?? '-'}</dd></div>
                    <div class="full"><dt>Diagnóstico</dt><dd>${a.Diagnostico || '-'}</dd></div>
                    <div class="full"><dt>Tratamiento</dt><dd>${a.Tratamiento || '-'}</dd></div>
                    <div class="full"><dt>Vacunas</dt><dd>${a.Vacunas || '-'}</dd></div>
                    <div class="full"><dt>Descripción</dt><dd>${a.Descripcion || '-'}</dd></div>
                  </dl>
                </div>
              </div>
            </article>`;
        };
        const card = ensureHoverCard();
        const overlay = ensureOverlay();
        const show = (html) => { card.innerHTML = html; overlay.style.display='block'; card.style.display='block'; try { document.documentElement.style.overflow='hidden'; } catch {} };
        const hide = () => { card.style.display='none'; overlay.style.display='none'; try { document.documentElement.style.overflow=''; } catch {} };
        const getAnimal = async (id) => {
          if (!animalsCache) { try { animalsCache = await getAllPets(); } catch { animalsCache = []; } }
          return (animalsCache || []).find((x) => String(x.Id) === String(id));
        };
        // Unificar comportamiento: abrir al hacer click en cualquier elemento con data-animal-id
        summaryAside.querySelectorAll('[data-animal-id]').forEach((el) => {
          el.addEventListener('click', async (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            const a = await getAnimal(el.dataset.animalId); if (!a) return;
            show(buildCard(a));
            const clickHandler = () => { hide(); document.removeEventListener('click', clickHandler, true); if (escHandler) window.removeEventListener('keydown', escHandler, true); overlay.onclick = null; };
            document.addEventListener('click', clickHandler, true);
            var escHandler = (e) => { if (e.key === 'Escape') { hide(); window.removeEventListener('keydown', escHandler, true); document.removeEventListener('click', clickHandler, true); } };
            window.addEventListener('keydown', escHandler, true);
            try {
              const closeBtn = document.getElementById('animal-hover-card')?.querySelector('[data-close-card]');
              closeBtn?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clickHandler(); });
              overlay.onclick = (e) => { e.preventDefault(); e.stopPropagation(); clickHandler(); };
            } catch {}
          });
        });
      } catch {}
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
  refreshMetrics();
  const _summaryInterval = setInterval(() => { try { refreshSummary(); refreshMetrics(); } catch {} }, 60000);
  // Actualizar métricas cuando otra parte del sistema recargue mascotas
  const _onPetsUpdated = () => { try { refreshMetrics(); } catch {} };
  try { window.addEventListener('pets:updated', _onPetsUpdated); } catch {}

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

  const controlForm = container.querySelector('[data-control]');
  const controlAnimalIdInput = controlForm?.querySelector('input[name="AnimalId"]');
  const bajaNotice = controlForm?.querySelector('[data-baja-notice]');
  const controlSubmitBtn = controlForm?.querySelector('button[type="submit"]');
  let isCurrentAnimalBaja = false;
  let animalsCache = [];

  const setBajaNoticeState = (flag) => {
    isCurrentAnimalBaja = flag;
    if (bajaNotice) bajaNotice.style.display = flag ? '' : 'none';
    if (controlSubmitBtn) controlSubmitBtn.disabled = flag;
  };

  const updateBajaWarning = async (value) => {
    const id = (value || '').toString().trim();
    if (!id) {
      setBajaNoticeState(false);
      return;
    }
    let match = (animalsCache || []).find((pet) => String(pet.Id) === id);
    if (!match) {
      const list = await getAllPets().catch(() => []);
      if (Array.isArray(list) && list.length) animalsCache = list;
      match = (animalsCache || []).find((pet) => String(pet.Id) === id);
    }
    const isBaja = !!match && (String(match.EstadoSolicitud || '').toLowerCase() === 'baja');
    setBajaNoticeState(isBaja);
  };

  const triggerBajaCheck = () => { updateBajaWarning(controlAnimalIdInput?.value); };
  controlAnimalIdInput?.addEventListener('input', triggerBajaCheck);
  controlAnimalIdInput?.addEventListener('change', triggerBajaCheck);

  // Load animals for autocomplete and lookups
  (async () => {
    try {
      animalsCache = await getAllPets();
      const dl = container.querySelector('#animals-list');
      if (dl) {
        dl.innerHTML = animalsCache
          .map(a => `<option value="${a.Id}">${(a.Nombre || 'Sin nombre')} - ${(a.EspecieRaza || '').trim()}</option>`)
          .join('');
      }
      try {
        const searchInput = container.querySelector('#tab-historial [data-search-animal] input[name="q"]');
        const searchLabel = searchInput?.closest('label');
        if (searchInput && searchLabel) {
          searchLabel.style.position = 'relative';
          const menu = document.createElement('div');
          menu.setAttribute('data-animal-suggest');
          Object.assign(menu.style, {
            position: 'absolute', top: '100%', left: '0', right: '0', zIndex: '30',
            background: 'var(--color-surface, #fff)', borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,.12)', marginTop: '6px', maxHeight: '240px',
            overflow: 'auto', padding: '6px 0', display: 'none'
          });
          searchLabel.appendChild(menu);

          const render = (items) => {
            menu.innerHTML = (items || []).slice(0, 50).map((a) => `
              <button type="button" data-id="${a.Id}" style="display:flex;gap:12px;align-items:center;width:100%;padding:8px 12px;background:none;border:none;text-align:left;cursor:pointer">
                <span style="width:28px;color:var(--color-muted,#666);font-variant-numeric:tabular-nums">${a.Id}</span>
                <span>${(a.Nombre || 'Sin nombre')} - ${(a.EspecieRaza || '').trim()}</span>
              </button>
            `).join('');
            menu.querySelectorAll('button[data-id]')?.forEach((btn) => {
              btn.addEventListener('click', () => {
                searchInput.value = btn.getAttribute('data-id') || '';
                menu.style.display = 'none';
                searchInput.focus();
              });
            });
          };

          const openMenu = () => { render(animalsCache); menu.style.display = ''; };
          const closeMenu = () => { menu.style.display = 'none'; };
          searchInput.addEventListener('focus', () => { if (!searchInput.value) openMenu(); });
          searchInput.addEventListener('keydown', (e) => {
            if (e.key === ' ' && !searchInput.value) { e.preventDefault(); openMenu(); }
            if (e.key === 'Escape') closeMenu();
          });
          searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            if (!q) { openMenu(); return; }
            const filtered = animalsCache.filter(a => String(a.Id).includes(q) || String(a.Nombre||'').toLowerCase().includes(q));
            render(filtered);
            menu.style.display = '';
          });
          document.addEventListener('click', (ev) => { if (!searchLabel.contains(ev.target)) closeMenu(); });
        }
      } catch {}
      if (controlAnimalIdInput?.value) {
        try { await updateBajaWarning(controlAnimalIdInput.value); } catch {}
      }
    } catch {}
  })();
  // Control sanitario: submit + validaciones
  controlForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = serialize(form);
    if (!payload.AnimalId) {
      feedback(form, '⚠️ Seleccioná un animal antes de registrar el control.', 'error');
      return;
    }
    if (!payload.Diagnostico) {
      feedback(form, 'Debe registrar diagnóstico', 'error');
      return;
    }
    await updateBajaWarning(payload.AnimalId);
    if (isCurrentAnimalBaja) {
      feedback(form, 'Este animal ya fue dado de baja', 'error');
      return;
    }
    // Validar próxima cita > fecha control
    try {
      const fecha = form.elements.Fecha?.value;
      const proxima = form.elements.ProximaCita?.value;
      if (fecha && proxima && Date.parse(proxima) <= Date.parse(fecha)) {
        feedback(form, 'La fecha de la próxima cita debe ser posterior al control.', 'error');
        return;
      }
    } catch {}

    const state = getState();
    const user = state.user || {};
    const controlHeaders = {};
    if (user.Id) controlHeaders['X-User-Id'] = String(user.Id);
    if (user.Tipo) controlHeaders['X-User-Type'] = user.Tipo;
    feedback(form, 'Registrando...', 'info');
    try {
      const response = await createControl(payload, { headers: controlHeaders });
      const message = response?.message || 'Control sanitario registrado';
      // Buscar nombre del animal
      const a = animalsCache.find(x => String(x.Id) === String(payload.AnimalId));
      const display = a ? `✅ Control sanitario registrado para ${a.Nombre}` : message;
      feedback(form, display, 'success');
      showToast('success', display);
      form.reset();
      refreshSummary();
      refreshMetrics();
      // Invalidate and eagerly reload pets so "Apto" appears in Nuestras Mascotas
      try {
        invalidatePetsCache();
        const fresh = await reloadPets();
        if (Array.isArray(fresh)) {
          animalsCache = fresh;
          const dl = container.querySelector('#animals-list');
          if (dl) {
            dl.innerHTML = animalsCache
              .map(a => `<option value="${a.Id}">${(a.Nombre || 'Sin nombre')} · ${(a.EspecieRaza || '').trim()}</option>`)
              .join('');
          }
        }
      } catch {}
      dispatchControlRegistered(payload.AnimalId);
    } catch (error) {
      const message = error.message || 'No se pudo registrar el control';
      if (String(message).includes('Debe registrar diagnóstico')) {
        feedback(form, 'Debe registrar diagnóstico', 'error');
      } else if (String(message).includes('Animal no encontrado')) {
        feedback(form, '⚠️ Seleccioná un animal antes de registrar el control.', 'error');
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
    // Redirigir al tab de Historial mdico en lugar de abrir panel debajo del formulario
    openBtn?.addEventListener('click', () => {
      try {
        if (typeof goToTab === 'function') goToTab('historial');
        const q = container.querySelector('#tab-historial [data-search-animal] input[name="q"]');
        if (q) q.focus();
      } catch {}
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
          <td><button type="button" class="btn-link" data-ver-control data-id="${c.Id}">🔍 Ver detalle</button></td>
        </tr>
      `).join('');
    };
    listarBtn?.addEventListener('click', async () => {
      const form = panel.querySelector('[data-controles-list]');
      const animalId = form.elements.AnimalId.value;
      if (!animalId) { feedback(form, 'Ingresá el ID del animal', 'error'); return; }
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
          <div class="modal__header"><h3>Detalle del control</h3><button class="btn-link" data-close>✖</button></div>
          <div class="modal__body">
            <p><strong>ID:</strong> ${cells[0]}</p>
            <p><strong>Fecha:</strong> ${cells[1]}</p>
            <p><strong>Diagnóstico:</strong> ${cells[2]}</p>
            <p><strong>Resultado:</strong> ${cells[3]}</p>
            <p><strong>Próxima cita:</strong> ${cells[4]}</p>
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
      animalsIndex: new Map(),
      applicationsIndex: new Map()
    };
    const followupFilterSelect = container.querySelector('[data-followup-filter]');
    const getActiveFollowupFilter = () => (followupFilterSelect?.value || '').toString().trim().toLowerCase();
    const filterFollowups = (items) => {
      const filter = getActiveFollowupFilter();
      if (!filter) return items || [];
      return (items || []).filter((entry) => {
        const tipo = (entry?.TipoSeguimiento || '').toString().trim().toLowerCase();
        return Boolean(tipo) && tipo === filter;
      });
    };
    const findPetForFollowup = (entry) => {
      const keys = ['AnimalId', 'SolicitudAnimalId', 'AnimalID', 'IdAnimal'];
      for (const key of keys) {
        const ref = entry?.[key];
        if (!ref) continue;
        const pet = followupsState.animalsIndex.get(String(ref));
        if (pet) return pet;
      }
      const solicitud = followupsState.applicationsIndex.get(String(entry?.SolicitudId));
      if (solicitud?.AnimalId) {
        const pet = followupsState.animalsIndex.get(String(solicitud.AnimalId));
        if (pet) return pet;
      }
      return null;
    };

    const getFollowupName = (entry) => {
      const pet = findPetForFollowup(entry);
      if (pet?.Nombre) return pet.Nombre;
      const solicitud = followupsState.applicationsIndex.get(String(entry?.SolicitudId));
      if (solicitud?.AnimalNombre) return solicitud.AnimalNombre;
      if (solicitud?.IdSolicitud) return `Solicitud #${solicitud.IdSolicitud}`;
      if (entry?.AnimalNombre) return entry.AnimalNombre;
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
      const list = filterFollowups(followupsState.items);
      if (!list.length) {
        segTbody.innerHTML = '<tr><td colspan="7" class="muted">Sin seguimientos para el filtro seleccionado.</td></tr>';
        return;
      }
      segTbody.innerHTML = list
        .map((s) => {
          const name = getFollowupName(s);
          const fecha = s.FechaSeguimiento ? new Date(s.FechaSeguimiento).toLocaleDateString() : '';
          const tipo = s.TipoSeguimiento || '-';
          const observaciones = (s.Observaciones || '').replace(/\s+/g, ' ').trim() || '-';
          const estado = renderStatusBadge(s.EstadoSeguimiento || '');
          return `
            <tr data-seg-row data-id="${s.Id}">
              <td>#${s.Id}</td>
              <td>${name}</td>
              <td>${tipo}</td>
              <td>${estado}</td>
              <td>${fecha}</td>
              <td>${observaciones}</td>
              <td>
                <button type="button" class="btn-link" data-accion="ver">Ver</button>
                <button type="button" class="btn-link" data-accion="cancelar">Cancelar</button>
              </td>
            </tr>`;
        })
        .join('');
    };
    followupFilterSelect?.addEventListener('change', () => {
      renderSegs();
    });

    const loadFollowups = async () => {
      try {
        const results = await Promise.allSettled([listAllFollowUps(), getAllPets(), listAllApplications()]);
        const raw = results[0]?.status === 'fulfilled' ? (results[0].value || []) : [];
        const toTimestamp = (entry) => {
          const ref = entry?.FechaSeguimiento || entry?.Fecha || entry?.CreadoEn;
          const ts = ref ? Date.parse(ref) : NaN;
          return Number.isFinite(ts) ? ts : 0;
        };
        followupsState.items = (raw || []).slice().sort((a, b) => toTimestamp(b) - toTimestamp(a));
        const pets = results[1]?.status === 'fulfilled' ? (results[1].value || []) : [];
        const apps = results[2]?.status === 'fulfilled' ? (results[2].value || []) : [];
        followupsState.animalsIndex = new Map((pets || []).map((p) => [String(p.Id), p]));
        followupsState.applicationsIndex = new Map(
          (apps || [])
            .filter((app) => app && app.Id !== undefined && app.Id !== null)
            .map((app) => [String(app.Id), app])
        );
        renderSegs();
      } catch (error) {
        console.error('No se pudieron cargar los seguimientos', error);
      }
    };
    refreshFollowups = async () => {
      await loadFollowups();
      try { refreshSummary(); refreshMetrics(); } catch {}
    };
    loadFollowups();
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-accion]');
      if (!btn) return;
      const row = btn.closest('[data-seg-row]');
      const id = row?.dataset.id;
      if (!id) return;
      if (btn.dataset.accion === 'cancelar') {
        try {
          await cancelFollowUp(id, { Observaciones: 'Cancelado desde panel veterinario' });
          showToast('success', '✖ Seguimiento cancelado.');
          await refreshFollowups();
        } catch (err) {
          showToast('error', err.message || 'No se pudo cancelar el seguimiento');
        }
        return;
      }
      if (btn.dataset.accion === 'ver') {
        const seguimiento = followupsState.items.find((item) => String(item.Id) === String(id));
        if (!seguimiento) return;
        openFollowupModal(seguimiento);
      }
    });
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
        feedback(form, 'Ingresá el ID del seguimiento', 'error');
        return;
      }
      feedback(form, 'Actualizando...', 'info');
      try {
        const response = await updateFollowUp(id, { Observaciones: form.elements.Observaciones.value });
        const message = response?.message || 'Seguimiento actualizado';
        feedback(form, message, 'success');
        showToast('success', message);
        form.reset();
        await refreshFollowups();
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
        feedback(form, 'Ingresá el ID del seguimiento', 'error');
        return;
      }
      feedback(form, 'Cancelando...', 'info');
      try {
        const response = await cancelFollowUp(id, { Observaciones: form.elements.Observaciones.value });
        const message = response?.message || '✅ Seguimiento cerrado.';
        feedback(form, message, 'success');
        showToast('success', message);
        form.reset();
        await refreshFollowups();
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

  // Historial médico: búsqueda + render
  try {
    const searchForm = container.querySelector('[data-search-animal]');
    const card = container.querySelector('[data-animal-card]');
    const ctrlsPanel = container.querySelector('[data-animal-controles]');
    const ctrlsTbody = container.querySelector('[data-animal-ctrls] tbody');
    const segPanel = container.querySelector('[data-animal-seg]');
    const segList = container.querySelector('[data-animal-seg-list]');
    let currentAnimal = null;
    const renderCard = async (animal) => {
      if (!animal) {
        currentAnimal = null;
        card.classList.remove('is-active');
        card.style.display = 'none';
        return;
      }
      currentAnimal = animal;
      const controles = await listControls(animal.Id).catch(() => []);
      const ultimo = controles[0];
      card.classList.add('is-active');
      card.style.display = '';
      card.innerHTML = `
        <h2 class="operator-panel__title">Ficha médica</h2>
        <div><strong>🐾 ${animal.Nombre || 'Sin nombre'}</strong> — ${animal.EspecieRaza || ''}</div>
        <div><span class="muted">Edad:</span> ${animal.Edad ?? '-'} — <span class="muted">Estado actual:</span> ${animal.EstadoSalud || '-'}</div>
        <div><span class="muted">Último control:</span> ${ultimo?.Fecha ? new Date(ultimo.Fecha).toLocaleDateString() : '-'}</div>
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
      // Seguimientos: sin vínculo directo en API; mostrar placeholder
      segList.innerHTML = '<p class="muted">No hay seguimientos vinculados a este animal.</p>';
      if (segPanel) { segPanel.classList.add('is-active'); segPanel.style.display = ''; }
    };
    const refreshCardForAnimal = async (animalId) => {
      try {
        const animals = animalsCache.length ? animalsCache : await getAllPets();
        const match = animals.find(a => String(a.Id) === String(animalId));
        if (match) await renderCard(match);
      } catch {}
    };
    try {
      window.addEventListener('dashboard:control-registered', (event) => {
        const animalId = event?.detail?.animalId;
        if (!animalId) return;
        if (currentAnimal && String(currentAnimal.Id) === String(animalId)) {
          refreshCardForAnimal(animalId);
        }
      });
    } catch {}
    searchForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const q = searchForm.elements.q.value.trim().toLowerCase();
      if (!q) { feedback(searchForm, 'Ingresá un término de búsqueda', 'error'); return; }
      feedback(searchForm, 'Buscando...', 'info');
      try {
        const animals = animalsCache.length ? animalsCache : await getAllPets();
        const found = animals.find(a => String(a.Id) === q || String(a.Nombre || '').toLowerCase().includes(q));
        if (!found) { feedback(searchForm, 'No se encontró el animal', 'error'); return; }
        currentAnimal = found;
        await renderCard(found);
        feedback(searchForm, 'Resultados actualizados', 'success');
      } catch (err) {
        feedback(searchForm, err.message || 'No se pudo buscar', 'error');
      }
    });
    // Filtro de controles eliminado para simplificar el historial
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

  return () => {
    try { clearInterval(_summaryInterval); } catch {}
    try { window.removeEventListener('pets:updated', _onPetsUpdated); } catch {}
  };
}
