import {
  createPet,
  updatePet,
  deactivatePet,
  getAllPets
} from '../services/petsService.js';
import {
  setUnderReview,
  approveApplication,
  rejectApplication,
  voidApplication,
  listAllApplications
} from '../services/adoptionsService.js';
import {
  createVisit,
  updateVisit,
  cancelVisit,
  listAllVisits
} from '../services/visitsService.js';
import {
  createFollowUp,
  updateFollowUp,
  cancelFollowUp,
  listAllFollowUps,
  listFollowUpsForAnimal,
  ensureSolicitudForAnimal
} from '../services/followupsService.js';
import { listControls } from '../services/controlsService.js';
import { normalizeImageSrc } from '../utils/image.js';
import { showToast } from '../components/Toast.js';
import { uploadAnimalPhoto } from '../services/petsService.js';
import { reloadPets, invalidatePetsCache } from '../services/petsService.js';

const TAB_ORDER = ['animales', 'solicitudes', 'seguimientos', 'visitas'];
const TAB_LABELS = {
  animales: 'Animales',
  solicitudes: 'Solicitudes',
  seguimientos: 'Seguimientos',
  visitas: 'Visitas'
};

const STATUS_COLORS = {
  solicitud: {
    Pendiente: 'badge--pending',
    'En revisión': 'badge--review',
    'Aprobada': 'badge--success',
    'Aprobada de manera provisional': 'badge--success',
    'Rechazada': 'badge--error',
    'Anulada': 'badge--neutral',
    'Cancelada': 'badge--neutral'
  },
  seguimiento: {
    Activo: 'badge--success',
    Pendiente: 'badge--pending',
    Cancelado: 'badge--neutral',
    Finalizado: 'badge--success'
  },
  visita: {
    Pendiente: 'badge--pending',
    Programada: 'badge--success',
    Cancelada: 'badge--error'
  },
  animal: {
    Disponible: 'badge--success',
    Reservado: 'badge--warning',
    Adoptado: 'badge--info',
    'En tránsito': 'badge--info',
    'No disponible': 'badge--neutral',
    Baja: 'badge--neutral'
  }
};

const OPERATOR_RESPONSIBLE = 'Operador PyB';

function normalizeStatusLabel(label, kind) {
  const raw = (label || '').toString().trim();
  if (!raw) return raw;
  return raw;
}

function feedback(node, message, type = 'info') {
  if (!node) return;
  const cls = type === 'error' ? 'error-text' : type === 'success' ? 'success-text' : 'pending-text';
  node.innerHTML = message ? `<p class="${cls}">${message}</p>` : '';
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '—';
  }
}

function badge(label, kind, fallback = 'badge--neutral') {
  const norm = normalizeStatusLabel(label, kind);
  const cls = STATUS_COLORS[kind]?.[norm] || fallback;
  return `<span class="status-pill ${cls}">${norm || '-'}</span>`;
}

function buildBaseLayout(container) {
  container.innerHTML = `
    <section class="dashboard-header operator-header">
      <div>
        <h1>Panel Operador</h1>
        <p>Gestión integral de adopciones</p>
      </div>
      <div class="operator-meta" data-operator-stats>
        <span class="meta-chip">Cargando métricas…</span>
      </div>
    </section>
    <section class="operator-shell">
      <div class="operator-main">
        <nav class="operator-tabs" data-operator-tabs>
          ${TAB_ORDER.map((key, index) => `
            <button type="button" class="operator-tab ${index === 0 ? 'is-active' : ''}" data-tab-target="${key}">
              ${TAB_LABELS[key]}
            </button>
          `).join('')}
        </nav>
        ${TAB_ORDER.map((key, index) => `
          <section class="operator-panel ${index === 0 ? 'is-active' : ''}" data-tab-panel="${key}">
            <div class="panel-loading" role="status">
              <span class="loader"></span>
              <p>Cargando ${TAB_LABELS[key].toLowerCase()}…</p>
            </div>
          </section>
        `).join('')}
      </div>
      <aside class="operator-side" data-operator-summary>
        <article class="summary-card">
          <header class="summary-card__header">
            <h2>Resumen reciente</h2>
            <p class="muted">Accesos rápidos a los últimos movimientos</p>
          </header>
          <nav class="summary-tabs" data-summary-tabs style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">\n            <button type="button" class="summary-tab is-active" data-summary-target="animales">🐾 Animales</button>\n            <button type="button" class="summary-tab" data-summary-target="seguimientos">📋 Seguimientos</button>\n            <button type="button" class="summary-tab" data-summary-target="solicitudes">📄 Solicitudes</button>\n            <button type="button" class="summary-tab" data-summary-target="visitas">📅 Visitas</button>\n          </nav>
          <div class="summary-list" data-summary-panel="animales">
            <p class="muted">Cargando…</p>
          </div>
          <div class="summary-list hidden" data-summary-panel="solicitudes">
            <p class="muted">Cargando…</p>
          </div>
          <div class="summary-list hidden" data-summary-panel="seguimientos">
            <p class="muted">Cargando…</p>
          </div>
        </article>
      </aside>
    </section>
  `;
}

function setupTabSwitching(container, state) {
  const tabs = container.querySelectorAll('[data-tab-target]');
  const panels = container.querySelectorAll('[data-tab-panel]');
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.tabTarget;
      state.currentTab = key;
      tabs.forEach((b) => b.classList.toggle('is-active', b === btn));
      panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.tabPanel === key));
    });
  });
}

function setupSummaryTabs(container) {
  const tabs = container.querySelectorAll('[data-summary-target]');
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.summaryTarget;
      tabs.forEach((b) => b.classList.toggle('is-active', b === btn));
      const panels = container.querySelectorAll('[data-summary-panel]');
      panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.summaryPanel !== key));
    });
  });
}

function updateAnimalViews(state, animalsPanel, summaryAside, container) {
  renderAnimals(state, animalsPanel);
  renderAnimalDetail(state, animalsPanel);
  renderSummary(state, summaryAside);
  try { enhanceSummaryFollowups(state, summaryAside); } catch {}
  renderStats(state, container);
  try { populateAnimalsDatalist(state, animalsPanel); } catch {}
}

function buildAnimalsPanel(panel) {
  panel.innerHTML = `
    <div class="panel-columns">
      <section class="panel-card">
        <header class="panel-card__header">
          <h3>Registro de animales</h3>
          <p class="muted">Controlá disponibilidad y estado sanitario.</p>
        </header>\n        <div class="toolbar" style="margin:6px 0 12px"><button type="button" class="btn-secondary" data-media-sync title="Crear carpetas de fotos">Preparar carpetas de fotos</button><span class="muted" data-media-sync-fb style="margin-left:8px"></span></div>\n        <div class="table-wrapper">
          <table class="data-table">
            <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Especie</th>
              <th>Raza</th>
              <th>Estado</th>
              <th>Estado sanitario</th>
              <th>Ingreso</th>
              <th>Última solicitud</th>
              <th class="actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody data-animals-table>
            <tr><td colspan="9" class="muted">Sin registros</td></tr>
          </tbody>
          </table>
        </div>
      </section>
      <section class="panel-card">
        <header class="panel-card__header">
          <h3>Gestión rápida</h3>
          <p class="muted">Alta, edición o baja lógica.</p>
        </header>
        <div class="form-stack" data-animal-form-block>
          <nav class="operator-tabs" data-animal-tabs>
            <button type="button" class="operator-tab is-active" data-animal-tab="registrar">📝 Registrar animal</button>
            <button type="button" class="operator-tab" data-animal-tab="modificar">✏️ Modificar animal</button>
            <button type="button" class="operator-tab" data-animal-tab="baja">🗑️ Baja lógica</button>
          </nav>
          <form class="operator-form modern" data-animal-create data-animal-panel="registrar">
            <h4>Alta de animal</h4>
            <div class="form-row">
              <label>Nombre<input name="Nombre" required /></label>
            </div>
            <input type="hidden" name="EspecieRaza" />
            <!-- Especie/Raza: solo una vez para alta -->
            <div class="form-row">
              <label>Especie
                <select name="Especie" data-especie-create>
                  <option value="Perro">Perro</option>
                  <option value="Gato">Gato</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>
              <label>Raza<input name="Raza" placeholder="Mestizo / Labrador / Siames..." data-raza-create /></label>
              <label>Estado
                <select name="EstadoSolicitud">
                  <option value="">Disponible</option>
                  <option value="Reservado">Reservado</option>
                  <option value="No disponible">No disponible</option>
                </select>
              </label>
            </div>
            <label>Descripción<textarea name="Descripcion" rows="2" placeholder="Notas generales"></textarea></label>
            <div class="form-row">
              <label>Sexo
                <select name="Sexo">
                  <option value="hembra">Hembra</option>
                  <option value="macho">Macho</option>
                </select>
              </label>
              <label>Edad<input type="number" name="Edad" min="0" /></label>
              <label>Peso (kg)<input type="number" step="0.1" name="Peso" min="0" /></label>
            </div>
            <div class="form-row">
              <label>Fecha ingreso<input type="date" name="FechaIngreso" /></label>
              <label>Origen<input name="Origen" placeholder="Rescate, refugio..." /></label>
            </div>
            <label>Estado de salud<input name="EstadoSalud" placeholder="Apto para adopción" /></label>
            <div>
              <label>Imagen (URL o base64)
                <input name="Foto" placeholder="https://..." data-foto-input-create />
              </label>
              <div class="uploader" data-uploader-create>
                <input type="file" accept="image/*" data-foto-file />
                <div class="uploader-drop" aria-label="Arrastrá una imagen, pegala o elegila">
                  <p class="muted">Arrastrá/pegá una imagen o elegila de tus archivos</p>
                  <img alt="Vista previa" data-foto-preview style="display:none; max-height:120px; border-radius:8px;" />
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary">Registrar</button>
              <div class="form-feedback" data-animal-create-feedback></div>
            </div>
            <datalist id="animals-list" data-animals-datalist></datalist>
          </form>
          <form class="operator-form modern" data-animal-update data-animal-panel="modificar" hidden>
            <h4>Editar animal</h4>
            <div class="form-row">
              <label>ID o nombre
                <input name="AnimalId" type="text" list="animals-list" placeholder="Buscar por ID o nombre" required />
              </label>
              <label>Nombre<input name="Nombre" /></label>
              <label>Estado adopción
                <select name="EstadoSolicitud">
                  <option value="">Disponible</option>
                  <option value="Reservado">Reservado</option>
                  <option value="No disponible">No disponible</option>
                  <option value="Adoptado">Adoptado</option>
                  <option value="Baja">Inactivo</option>
                </select>
              </label>
            </div>
            <label>Diagnóstico / tratamiento<textarea name="Diagnostico" rows="2" placeholder="Observaciones clínicas"></textarea></label>
            <div>
              <label>Foto (URL o base64)
                <input name="Foto" placeholder="https://..." data-foto-input-update />
              </label>
              <div class="uploader" data-uploader-update>
                <input type="file" accept="image/*" data-foto-file />
                <div class="uploader-drop" aria-label="Arrastrá una imagen, pegala o elegila">
                  <p class="muted">Arrastrá/pegá una imagen o elegila de tus archivos</p>
                  <img alt="Vista previa" data-foto-preview style="display:none; max-height:120px; border-radius:8px;" />
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-secondary">Guardar cambios</button>
              <div class="form-feedback" data-animal-update-feedback></div>
            </div>
          </form>
          <form class="operator-form modern" data-animal-deactivate data-animal-panel="baja" hidden>
            <h4>Baja lógica</h4>
            <div class="form-row">
              <label>Buscar por ID o nombre
                <input name="AnimalId" type="text" list="animals-list" placeholder="Ej.: 123 o Luna" required />
              </label>
              <label>Motivo<select name="MotivoBaja">
                <option value="Adoptado">Adoptado</option>
                <option value="Traslado">Traslado</option>
                <option value="Fallecido">Fallecido</option>
                <option value="Otro">Otro</option>
              </select></label>
            </div>
            <label>Observaciones<textarea name="ObservacionesBaja" rows="2" placeholder="Notas internas"></textarea></label>
            <div class="form-actions">
              <button type="submit" class="btn-tertiary" style="background:#ffe5ea; color:#e1678d; border-color:#f28cab;">Confirmar baja</button>
              <div class="form-feedback" data-animal-deactivate-feedback></div>
            </div>
          </form>
        </div>
      </section>
    </div>
    <section class="panel-card" data-animal-detail hidden>
      <header class="panel-card__header">
        <h3>Ficha seleccionada</h3>
        <p class="muted">Seleccioná un animal para ver sus datos resumidos.</p>
      </header>
      <div class="detail-placeholder muted">Sin selección</div>
    </section>
  `;
}

function buildSolicitudesPanel(panel) {
  panel.innerHTML = `
    <section class="panel-card">
      <header class="panel-card__header">
        <div>
          <h3>Solicitudes</h3>
          <p class="muted">Filtrá por ID, adoptante o animal.</p>
        </div>
        <div class="search-box">
          <label>
            <span class="sr-only">Buscar</span>
            <input type="search" placeholder="Buscar solicitud…" data-solicitud-search />
          </label>
        </div>
      </header>\n        <div class="toolbar" style="margin:6px 0 12px"><button type="button" class="btn-secondary" data-media-sync title="Crear carpetas de fotos">Preparar carpetas de fotos</button><span class="muted" data-media-sync-fb style="margin-left:8px"></span></div>\n        <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Solicitud</th>
              <th>Adoptante</th>
              <th>Animal</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody data-solicitudes-table>
            <tr><td colspan="5" class="muted">Sin solicitudes</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel-card" data-solicitud-detail>
      <header class="panel-card__header">
        <h3>Detalle y acciones</h3>
        <p class="muted">Seleccioná una solicitud para administrar su estado.</p>
      </header>
      <div class="detail-placeholder muted">Sin selección</div>
    </section>
  `;
}

function buildSeguimientosPanel(panel) {
  panel.innerHTML = `
    <section class="panel-card">
      <header class="panel-card__header">
        <div>
          <h3>Seguimientos</h3>
          <p class="muted">Controlá los casos posteriores a la adopción.</p>
        </div>
        <label class="muted" style="display:flex; align-items:center; gap:8px;">
          <span>Tipo</span>
          <select data-followup-filter>
            <option value="">Todos</option>
            <option value="Administrativo">Administrativo</option>
            <option value="Veterinario">Veterinario</option>
            <option value="Domiciliario">Domiciliario</option>
          </select>
        </label>
      </header>\n        <div class="toolbar" style="margin:6px 0 12px"><button type="button" class="btn-secondary" data-media-sync title="Crear carpetas de fotos">Preparar carpetas de fotos</button><span class="muted" data-media-sync-fb style="margin-left:8px"></span></div>\n        <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Animal</th>
              <th>Tipo de seguimiento</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Observaciones</th>
              <th class="actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody data-seguimientos-table>
            <tr><td colspan="7" class="muted">Sin seguimientos</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <div class="panel-columns">
      <section class="panel-card">
        <header class="panel-card__header">
          <h3>Nuevo seguimiento</h3>
        </header>
        <form class="operator-form modern" data-followup-create>
          <div class="form-row">
            <label>ID o nombre de Animal
              <input name="AnimalId" type="text" list="animals-list" placeholder="Buscar por ID o nombre (ej.: 123 o Luna)" />
            </label>
            <label>Fecha<input name="FechaSeguimiento" type="date" /></label>
            <label>Estado
              <select name="EstadoSeguimiento">
                <option value="Activo">Activo</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Finalizado">Finalizado</option>
              </select>
            </label>
            <label>Tipo de seguimiento
              <select name="TipoSeguimiento">
                <option value="Administrativo">Administrativo</option>
                <option value="Veterinario">Veterinario</option>
                <option value="Domiciliario">Domiciliario</option>
              </select>
            </label>
          </div>
          <p class="muted" style="margin:6px 0 0">El seguimiento se vincula automaticamente al ultimo expediente disponible del animal seleccionado.</p>
          <label>Observaciones<textarea name="Observaciones" rows="3" placeholder="Notas internas y recomendaciones"></textarea></label>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Crear seguimiento</button>
            <div class="form-feedback" data-followup-create-feedback></div>
          </div>
        </form>
      </section>
      <section class="panel-card">
        <header class="panel-card__header">
          <h3>Actualizar / cancelar</h3>
        </header>
        <form class="operator-form modern" data-followup-update>
          <div class="form-row">
            <label>ID Seguimiento<input name="SeguimientoId" type="number" required /></label>
            <label>Estado
              <select name="EstadoSeguimiento">
                <option value="">Sin cambios</option>
                <option value="Activo">Activo</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </label>
            <label>Tipo de seguimiento
              <select name="TipoSeguimiento">
                <option value="">Sin cambios</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Veterinario">Veterinario</option>
                <option value="Domiciliario">Domiciliario</option>
              </select>
            </label>
          </div>
          <label>Observaciones<textarea name="Observaciones" rows="3"></textarea></label>
          <div class="form-actions">
            <button type="submit" class="btn-secondary">Guardar</button>
            <button type="button" class="btn-tertiary" data-followup-cancel>Cancelar seguimiento</button>
            <div class="form-feedback" data-followup-update-feedback></div>
          </div>
        </form>
      </section>
    </div>
  `;
}

function buildVisitasPanel(panel) {
  panel.innerHTML = `
    <section class="panel-card">
      <header class="panel-card__header">
        <div>
          <h3>Visitas programadas</h3>
          <p class="muted">Coordiná inspecciones y seguimientos domiciliarios.</p>
        </div>
        <button type="button" class="btn-primary" data-visit-open-create>Programar nueva visita</button>
      </header>\n        <div class="toolbar" style="margin:6px 0 12px"><button type="button" class="btn-secondary" data-media-sync title="Crear carpetas de fotos">Preparar carpetas de fotos</button><span class="muted" data-media-sync-fb style="margin-left:8px"></span></div>\n        <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Solicitud</th>
              <th>Fecha y hora</th>
              <th>Responsable</th>
              <th>Dirección</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th class="actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody data-visitas-table>
            <tr><td colspan="7" class="muted">Sin visitas programadas</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    <div class="panel-columns" data-visita-forms>
      <section class="panel-card" data-visita-create-card hidden>
        <header class="panel-card__header">
          <h3>Programar visita</h3>
          <button type="button" class="btn-link" data-visit-close-create>Cancelar</button>
        </header>
        <form class="operator-form modern" data-visit-create>
          <div class="form-row">
            <label>ID Solicitud<input name="SolicitudId" type="number" required /></label>
            <label>Fecha y hora<input name="FechaHoraVisita" type="datetime-local" required /></label>
          </div>
          <div class="form-row">
            <label>Modalidad<input name="Modalidad" placeholder="Presencial / Virtual" /></label>
          </div>
          <input type="hidden" name="Responsable" value="${OPERATOR_RESPONSIBLE}" />
          <p class="muted" style="margin:4px 0 8px">Responsable asignado: ${OPERATOR_RESPONSIBLE}.</p>
          <label>Dirección<input name="Direccion" placeholder="Lugar de la visita" /></label>
          <label>Motivo<textarea name="Motivo" rows="2" placeholder="Objetivo o notas para el equipo"></textarea></label>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Crear visita</button>
            <div class="form-feedback" data-visit-create-feedback></div>
          </div>
        </form>
      </section>
      <section class="panel-card">
        <header class="panel-card__header">
          <h3>Reprogramar / cancelar</h3>
        </header>
        <form class="operator-form modern" data-visit-update>
          <div class="form-row">
            <label>ID Visita<input name="VisitaId" type="number" required /></label>
            <label>Nueva fecha y hora<input name="FechaHoraVisita" type="datetime-local" required /></label>
          </div>
          <div class="form-row">
            <label>Modalidad<input name="Modalidad" placeholder="Opcional" /></label>
          </div>
          <input type="hidden" name="Responsable" value="${OPERATOR_RESPONSIBLE}" />
          <p class="muted" style="margin:4px 0 8px">Responsable asignado automáticamente: ${OPERATOR_RESPONSIBLE}.</p>
          <label>Dirección<input name="Direccion" placeholder="Opcional" /></label>
          <label>Motivo<textarea name="Motivo" rows="2" placeholder="Notas adicionales"></textarea></label>
          <div class="form-actions">
            <button type="submit" class="btn-secondary">Reprogramar</button>
            <button type="button" class="btn-tertiary" data-visit-cancel>Cancelar visita</button>
            <div class="form-feedback" data-visit-update-feedback></div>
          </div>
        </form>
      </section>
    </div>
  `;
}

function sortByDateDesc(items, field) {
  return [...items].sort((a, b) => {
    const da = a[field] ? Date.parse(a[field]) : 0;
    const db = b[field] ? Date.parse(b[field]) : 0;
    return db - da;
  });
}

function renderAnimals(state, container) {
  const tbody = container.querySelector('[data-animals-table]');
  if (!tbody) return;
  if (!state.animals.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="muted">No hay animales cargados.</td></tr>';
    return;
  }
  const getSpecies = (animal) => {
    // 1) Use explicit field if present
    const eRaw = (animal.Especie || '').toString().trim().toLowerCase();
    if (eRaw) {
      if (eRaw.includes('perr')) return 'Perro';
      if (eRaw.includes('gat')) return 'Gato';
      if (eRaw.includes('otro')) return 'Otro';
      // Unknown explicit value → treat as Otro
      return 'Otro';
    }

    // 2) Infer from breed/combined field or description
    const hay = `${animal.Raza || ''} ${animal.EspecieRaza || ''} ${animal.Descripcion || ''}`.toLowerCase();
    if (/(gato|michi|siam|persa|maine|ragdoll|bengal|angora|manx|sphynx)/.test(hay)) return 'Gato';
    if (/(conejo|cuy|ave|p[aá]jaro|tortuga|pez|hur[oó]n|caballo|h[aá]mster|loro|canario)/.test(hay)) return 'Otro';

    // 3) Fallback by common cat names provided
    const name = (animal.Nombre || '').toString().trim().toLowerCase();
    const catNames = new Set(['tom','nube','felix','milo','oliver','zeus','salem','tango','cloe']);
    if (name && catNames.has(name)) return 'Gato';

    // 4) Default → Perro (dataset mayoritario)
    return 'Perro';
  };
  const getBreed = (animal) => {
    const r = (animal.Raza || '').toString().trim();
    if (r) return r;
    const er = (animal.EspecieRaza || '').toString().trim();
    if (!er) return '-';
    const especie = (animal.Especie || '').toString().trim().toLowerCase();
    if (especie && er.toLowerCase().startsWith(especie)) {
      return er.slice(especie.length).trim() || '-';
    }
    // If we guessed species from keywords, remove them from start
    let out = er;
    if (out.toLowerCase().startsWith('perro')) out = out.slice(5).trim();
    if (out.toLowerCase().startsWith('gato')) out = out.slice(4).trim();
    return out || '-';
  };
  const rows = state.animals.map((animal) => {
    const estado = (animal.EstadoSolicitud || '').trim() || 'Disponible';
    const isSelected = String(animal.Id) === String(state.selectedAnimalId);
    return `
      <tr data-id="${animal.Id}" class="${isSelected ? 'is-selected' : ''}">
        <td>#${animal.Id}</td>
        <td><span data-animal-name data-animal-id="${animal.Id}">${animal.Nombre || 'Sin nombre'}</span></td>
        <td>${getSpecies(animal)}</td>
        <td>${getBreed(animal)}</td>
        <td>${badge(estado, 'animal')}</td>
        <td>${animal.EstadoSalud || '-'}</td>
        <td>${formatDate(animal.FechaIngreso)}</td>
        <td>${animal.Resultado || '-'}</td>
        <td class="actions-col">
          <button type="button" class="btn-link" data-action="view" data-id="${animal.Id}">Ver ficha</button>
          <button type="button" class="btn-link" data-action="edit" data-id="${animal.Id}">Editar</button>
        </td>
      </tr>
    `;
  }).join('');
  tbody.innerHTML = rows;
  // Hover card (rollover) con ficha completa del animal (centrado, sin seguir el cursor)
  try {
    const ensureHoverCard = () => {
      let card = document.getElementById('animal-hover-card');
      if (!card) {
        card = document.createElement('div');
        card.id = 'animal-hover-card';
        // Centrado en pantalla, estilo tarjeta
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
                <div><dt>Estado adopción</dt><dd>${badge(a.EstadoSolicitud || 'Disponible', 'animal')}</dd></div>
                <div><dt>Estado salud</dt><dd>${a.EstadoSalud || '-'}</dd></div>
                <div><dt>Ingreso</dt><dd>${formatDate(a.FechaIngreso)}</dd></div>
                <div><dt>Última actualización</dt><dd>${formatDateTime(a.FechaActualizacion)}</dd></div>
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
              <div style="margin-top:12px;display:grid;gap:12px">
                <section>
                  <h4 style="margin:0 0 6px">Controles recientes</h4>
                  <div data-card-controls class="muted">Cargando…</div>
                </section>
                <section>
                  <h4 style="margin:0 0 6px">Seguimientos recientes</h4>
                  <div data-card-followups class="muted">Cargando…</div>
                </section>
              </div>
            </div>
          </div>
        </article>`;
    };
    const card = ensureHoverCard();
    const overlay = ensureOverlay();
    const show = (html) => {
      card.innerHTML = html;
      overlay.style.display = 'block';
      card.style.display = 'block';
      try { document.documentElement.style.overflow = 'hidden'; } catch {}
    };
    const hide = () => {
      card.style.display = 'none';
      overlay.style.display = 'none';
      try { document.documentElement.style.overflow = ''; } catch {}
      try { const det = container.querySelector('[data-animal-detail]'); if (det) det.style.visibility = ''; } catch {}
    };
    // Mostrar ficha solo al presionar "Ver ficha"
    let escHandler = null;
    tbody.querySelectorAll('[data-action="view"]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const id = btn.getAttribute('data-id');
        const a = (state.animals || []).find((x) => String(x.Id) === String(id));
        if (!a) return;
        show(buildCard(a));
        // Cargar resumen de controles/seguimientos dentro de la tarjeta
        (async () => {
          try {
            const cBox = card.querySelector('[data-card-controls]');
            const fBox = card.querySelector('[data-card-followups]');
            const [ctrls, segs] = await Promise.all([
              listControls(a.Id).catch(() => []),
              listFollowUpsForAnimal(a.Id).catch(() => []),
            ]);
            if (cBox) {
              cBox.innerHTML = (ctrls && ctrls.length)
                ? ctrls.slice(0, 5).map(c => {
                    const fecha = c.Fecha || c.CreadoEn || '';
                    const f = fecha ? new Date(fecha).toLocaleDateString() : '';
                    const res = c.Resultado || 'Control';
                    const prox = c.ProximaCita ? ` · Próxima: ${new Date(c.ProximaCita).toLocaleDateString()}` : '';
                    return `<div class=\"operator-list__item\" style=\"padding:6px 0;border-bottom:1px solid #f0f0f4\"><strong>${f}</strong> · ${res}${prox}</div>`;
                  }).join('')
                : '<p class="muted">Sin controles.</p>';
            }
            if (fBox) {
              fBox.innerHTML = (segs && segs.length)
                ? segs.slice(0, 5).map(s => {
                    const f = s.FechaSeguimiento ? new Date(s.FechaSeguimiento).toLocaleDateString() : '';
                    const estado = s.EstadoSeguimiento || 'Activo';
                    const tipo = s.TipoSeguimiento || '';
                    return `<div class=\"operator-list__item\" style=\"padding:6px 0;border-bottom:1px solid #f0f0f4\"><strong>${f}</strong> · ${estado}<div class=\"muted\">${tipo}${s.Observaciones ? ` - ${s.Observaciones}` : ''}</div></div>`;
                  }).join('')
                : '<p class="muted">Sin seguimientos.</p>';
            }
          } catch {}
        })();
        try { const det = container.querySelector('[data-animal-detail]'); if (det) det.style.visibility = 'hidden'; } catch {}
        const clickHandler = () => { hide(); if (escHandler) window.removeEventListener('keydown', escHandler, true); overlay.onclick = null; };
        escHandler = (e) => { if (e.key === 'Escape') { hide(); if (escHandler) window.removeEventListener('keydown', escHandler, true); } };
        window.addEventListener('keydown', escHandler, true);
        try {
          const closeBtn = document.getElementById('animal-hover-card')?.querySelector('[data-close-card]');
          closeBtn?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clickHandler(); });
          overlay.onclick = (e) => { e.preventDefault(); e.stopPropagation(); clickHandler(); };
        } catch {}
      });
    });
  } catch {}
}

function renderAnimalDetail(state, container) {
  const box = container.querySelector('[data-animal-detail]');
  if (!box) return;
  const target = box.querySelector('.panel-card__body') || box;
  const animal = state.animals.find((item) => String(item.Id) === String(state.selectedAnimalId));
  if (!animal) {
    box.innerHTML = `
      <header class="panel-card__header">
        <h3>Ficha seleccionada</h3>
        <p class="muted">Seleccioná un animal para ver sus datos resumidos.</p>
      </header>
      <div class="detail-placeholder muted">Sin selección</div>
    `;
    return;
  }
  box.innerHTML = `
    <header class="panel-card__header">
      <h3>${animal.Nombre}</h3>
      <p class="muted">ID #${animal.Id} · ${animal.EspecieRaza || '—'}</p>
    </header>
    <dl class="detail-grid">
      <div><dt>Estado adopción</dt><dd>${badge(animal.EstadoSolicitud || 'Disponible', 'animal')}</dd></div>
      <div><dt>Estado salud</dt><dd>${animal.EstadoSalud || '—'}</dd></div>
      <div><dt>Ingreso</dt><dd>${formatDate(animal.FechaIngreso)}</dd></div>
      <div><dt>Última actualización</dt><dd>${formatDateTime(animal.FechaActualizacion)}</dd></div>
      <div><dt>Origen</dt><dd>${animal.Origen || '—'}</dd></div>
      <div><dt>Resultado</dt><dd>${animal.Resultado || '—'}</dd></div>
      <div class="full"><dt>Descripción</dt><dd>${animal.Descripcion || '—'}</dd></div>
    </dl>
  `;
}

function renderSolicitudes(state, container) {
  const tbody = container.querySelector('[data-solicitudes-table]');
  if (!tbody) return;
  const term = (state.solicitudSearch || '').trim().toLowerCase();
  const filtered = state.solicitudes.filter((sol) => {
    if (!term) return true;
    return (
      String(sol.Id).includes(term) ||
      (sol.IdSolicitud || '').toLowerCase().includes(term) ||
      (sol.AdoptanteNombre || '').toLowerCase().includes(term) ||
      (sol.AnimalNombre || '').toLowerCase().includes(term)
    );
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">No se encontraron solicitudes con ese criterio.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((sol) => `
    <tr data-id="${sol.Id}" class="${String(sol.Id) === String(state.selectedSolicitudId) ? 'is-selected' : ''}">
      <td>#${sol.IdSolicitud || sol.Id}</td>
      <td>${sol.AdoptanteNombre || '—'}</td>
      <td>${sol.AnimalNombre || '—'}</td>
      <td>${badge(sol.EstadoSolicitud || 'Pendiente', 'solicitud')}</td>
      <td>${formatDate(sol.FechaSolicitud)}</td>
    </tr>
  `).join('');
}

function solicitationDetailTemplate(sol, hasFollowUp) {
  const contact = sol.AdoptanteContacto || sol.AdoptanteDireccion || '—';
  return `
    <div class="detail-grid">
      <div><dt>Solicitud</dt><dd>#${sol.IdSolicitud || sol.Id}</dd></div>
      <div><dt>Estado</dt><dd>${badge(sol.EstadoSolicitud || 'Pendiente', 'solicitud')}</dd></div>
      <div><dt>Fecha</dt><dd>${formatDate(sol.FechaSolicitud)}</dd></div>
      <div><dt>Animal</dt><dd>${sol.AnimalNombre || '—'}</dd></div>
      <div><dt>Adoptante</dt><dd>${sol.AdoptanteNombre || '—'}</dd></div>
      <div><dt>Contacto</dt><dd>${contact}</dd></div>
      <div class="full"><dt>Comentarios</dt><dd>${sol.Comentarios || '—'}</dd></div>
      <div class="full detail-actions">
        <button type="button" class="btn-secondary" data-sol-action="review">Poner en revisión</button>
        <button type="button" class="btn-primary" data-sol-action="approve">Aprobar</button>
        <button type="button" class="btn-tertiary" data-sol-action="reject">Rechazar</button>
        <button type="button" class="btn-tertiary" data-sol-action="void">Anular</button>
        ${hasFollowUp ? '<button type="button" class="btn-link" data-sol-action="followup">Ver seguimiento asociado</button>' : ''}
      </div>
      <div class="full">
        <label>Observaciones / motivo<textarea rows="3" data-sol-notes placeholder="Anotá el motivo o requerimiento"></textarea></label>
        <div class="form-feedback" data-sol-feedback></div>
      </div>
    </div>
  `;
}

function renderSolicitudDetail(state, container) {
  const box = container.querySelector('[data-solicitud-detail]');
  if (!box) return;
  const solicitud = state.solicitudes.find((s) => String(s.Id) === String(state.selectedSolicitudId));
  if (!solicitud) {
    box.innerHTML = `
      <header class="panel-card__header">
        <h3>Detalle y acciones</h3>
        <p class="muted">Seleccioná una solicitud para administrar su estado.</p>
      </header>
      <div class="detail-placeholder muted">Sin selección</div>
    `;
    return;
  }
  const hasFollowUp = state.followups.some((seg) => Number(seg.SolicitudId) === Number(solicitud.Id));
  box.innerHTML = `
    <header class="panel-card__header">
      <h3>Solicitud #${solicitud.IdSolicitud || solicitud.Id}</h3>
      <p class="muted">${solicitud.AdoptanteNombre || 'Adoptante'} · ${solicitud.AnimalNombre || 'Animal'} </p>
    </header>
    ${solicitationDetailTemplate(solicitud, hasFollowUp)}
  `;
}

  function renderSeguimientos(state, container) {
    const tbody = container.querySelector('[data-seguimientos-table]');
    if (!tbody) return;
    const typeFilter = container.querySelector('[data-followup-filter]')?.value || '';
    const list = typeFilter ? state.followups.filter((x) => (x.TipoSeguimiento || '').toLowerCase() === typeFilter.toLowerCase()) : state.followups;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">No hay seguimientos registrados.</td></tr>';
      return;
    }
    const resolveAnimal = (seg) => {
      try {
        const sol = state.solicitudes.find((s) => Number(s.Id) === Number(seg.SolicitudId));
        const candidateIds = [
          seg.AnimalId,
          seg.AnimalID,
          seg.IdAnimal,
          sol?.AnimalId
        ].filter(Boolean).map((value) => Number(value));
        const animalId = candidateIds.find((value) => Number.isFinite(value));
        let name = '';
        if (Number.isFinite(animalId)) {
          const found = (state.animals || []).find((a) => Number(a.Id) === animalId);
          if (found && found.Nombre) {
            name = found.Nombre;
          }
        }
        if (!name && sol?.AnimalNombre) name = sol.AnimalNombre;
        if (!name && seg.AnimalNombre) name = seg.AnimalNombre;
        return { name: name || '', id: animalId || null };
      } catch { return { name: '', id: null }; }
    };
    const rows = list.map((seg) => {
      const { name: animalNombre } = resolveAnimal(seg);
      const isSelected = String(seg.Id) === String(state.selectedFollowupId);
      return `
          <tr data-id="${seg.Id}" class="${isSelected ? 'is-selected' : ''}">
          <td>#${seg.Id}</td>
          <td>${animalNombre || '-'}</td>
          <td>${seg.TipoSeguimiento || 'Administrativo'}</td>
          <td>${badge(seg.EstadoSeguimiento || 'Activo', 'seguimiento')}</td>
          <td>${formatDate(seg.FechaSeguimiento)}</td>
          <td>${(seg.Observaciones || '').slice(0, 60)}</td>
          <td class="actions-col">
          <button type="button" class="btn-link" data-followup-view="${seg.Id}">Ver</button>
          <button type="button" class="btn-link" data-followup-edit="${seg.Id}">Editar</button>
          </td>
        </tr>
      `;
    }).join('');
    tbody.innerHTML = rows;
  }

function populateAnimalsDatalist(state, container) {
  try {
    const dl = container.querySelector('[data-animals-datalist]') || document.querySelector('[data-animals-datalist]');
    if (!dl) return;
    const options = (state.animals || []).map((a) => {
      const name = (a.Nombre || '').toString().trim();
      return `<option value="${a.Id} - ${name}"></option>`;
    }).join('');
    dl.innerHTML = options;
  } catch {}
}

function renderVisitas(state, container) {
  const tbody = container.querySelector('[data-visitas-table]');
  if (!tbody) return;
  if (!state.visits.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">No hay visitas programadas.</td></tr>';
    return;
  }
  // Deduplicar por SolicitudId: preferir Programada y la más reciente
  const _bySolicitud = new Map();
  (state.visits || []).forEach((v) => {
    const sid = v.SolicitudId;
    const curr = _bySolicitud.get(sid);
    if (!curr) { _bySolicitud.set(sid, v); return; }
    const ce = (curr.EstadoSolicitud || '').toLowerCase();
    const ve = (v.EstadoSolicitud || '').toLowerCase();
    const currProg = ce === 'programada';
    const vProg = ve === 'programada';
    if (vProg && !currProg) { _bySolicitud.set(sid, v); return; }
    if (vProg === currProg) {
      const ct = curr.FechaHoraVisita ? Date.parse(curr.FechaHoraVisita) : 0;
      const vt = v.FechaHoraVisita ? Date.parse(v.FechaHoraVisita) : 0;
      if (vt > ct) _bySolicitud.set(sid, v);
    }
  });
  const visitsList = Array.from(_bySolicitud.values());
  const rows = visitsList.map((vis) => `
    <tr data-id="${vis.Id}">
      <td>#${vis.SolicitudCodigo || vis.SolicitudId}</td>
      <td>${formatDateTime(vis.FechaHoraVisita)}</td>
      <td>${vis.Responsable || '—'}</td>
      <td>${vis.Direccion || '—'}</td>
      <td>${vis.Motivo || '—'}</td>
      <td>${badge(vis.EstadoSolicitud || 'Programada', 'visita')}</td>
      <td class="actions-col">
        ${ (vis.EstadoSolicitud || '') === 'Pendiente'
          ? `<button type="button" class="btn-link" data-visit-program="${vis.Id}" data-sid="${vis.SolicitudId}">Programar</button>`
          : `<button type="button" class="btn-link" data-visit-fill="${vis.Id}">Editar</button>` }
      </td>
    </tr>
  `).join('');
  tbody.innerHTML = rows;
}

function renderSummary(state, container) {
  const animalsPanel = container.querySelector('[data-summary-panel="animales"]');
  const solicitudesPanel = container.querySelector('[data-summary-panel="solicitudes"]');
  const seguimientosPanel = container.querySelector('[data-summary-panel="seguimientos"]');
  let visitasPanel = container.querySelector('[data-summary-panel="visitas"]');
  if (!visitasPanel) {
    try {
      const host = container.querySelector('.summary-card') || container;
      const node = document.createElement('div');
      node.className = 'summary-list hidden';
      node.setAttribute('data-summary-panel', 'visitas');
      node.innerHTML = '<p class="muted">Cargando…</p>';
      host.appendChild(node);
      visitasPanel = node;
    } catch {}
  }

  const latestAnimals = sortByDateDesc(state.animals, 'FechaActualizacion').slice(0, 3);
  const speciesOf = (a) => {
    const e = (a.Especie || '').toString().trim().toLowerCase();
    if (e) return e.includes('gat') ? 'Gato' : e.includes('perr') ? 'Perro' : 'Otro';
    const mix = `${a.Raza || ''} ${a.EspecieRaza || ''}`.toLowerCase();
    if (/gato|michi|siam|persa|maine|ragdoll|bengal|angora|manx|sphynx/.test(mix)) return 'Gato';
    if (/conejo|cuy|ave|p[aá]jaro|tortuga|pez|hur[oó]n|caballo|h[aá]mster|loro|canario/.test(mix)) return 'Otro';
    return 'Perro';
  };
  const breedOf = (a) => {
    const r = (a.Raza || '').toString().trim();
    if (r) return r;
    const er = (a.EspecieRaza || '').toString().trim();
    if (!er) return '';
    const sp = speciesOf(a).toLowerCase();
    if (sp && er.toLowerCase().startsWith(sp)) return er.slice(sp.length).trim();
    return er;
  };
  animalsPanel.innerHTML = latestAnimals.length
    ? latestAnimals.map((animal) => `
        <button type="button" class="summary-item" data-summary-goto="animales" data-summary-id="${animal.Id}">
          <img class="summary-icon" src="/assets/logo.png" alt="" style="width:18px;height:18px;object-fit:contain;border-radius:3px" onerror="this.style.display='none'" />
          <div>
            <strong>${animal.Nombre}</strong>
            <p>${speciesOf(animal)}${breedOf(animal) ? ' · ' + breedOf(animal) : ''}</p>
            <span>${formatDate(animal.FechaActualizacion || animal.FechaIngreso)}</span>
          </div>
          ${badge(animal.EstadoSolicitud || 'Disponible', 'animal')}
        </button>
      `).join('')
    : '<p class="muted">Sin animales recientes.</p>';

  const latestSolicitudes = sortByDateDesc(state.solicitudes, 'FechaSolicitud').slice(0, 3);
  solicitudesPanel.innerHTML = latestSolicitudes.length
    ? latestSolicitudes.map((sol) => `
        <button type="button" class="summary-item" data-summary-goto="solicitudes" data-summary-id="${sol.Id}">
          <img class="summary-icon" src="/assets/logo.png" alt="" style="width:18px;height:18px;object-fit:contain;border-radius:3px" onerror="this.style.display='none'" />
          <div>
            <strong>#${sol.IdSolicitud || sol.Id}</strong>
            <p>${sol.AdoptanteNombre || '—'} · ${sol.AnimalNombre || '—'}</p>
            <span>${formatDate(sol.FechaSolicitud)}</span>
          </div>
          ${badge(sol.EstadoSolicitud || 'Pendiente', 'solicitud')}
        </button>
      `).join('')
    : '<p class="muted">Sin solicitudes recientes.</p>';

  const latestSeguimientos = sortByDateDesc(state.followups, 'FechaSeguimiento').slice(0, 3);
  seguimientosPanel.innerHTML = latestSeguimientos.length
    ? latestSeguimientos.map((seg) => {
        const solicitud = state.solicitudes.find((s) => Number(s.Id) === Number(seg.SolicitudId));
        return `
          <button type="button" class="summary-item" data-summary-goto="seguimientos" data-summary-id="${seg.Id}">
            <span class="summary-icon">📋</span>
            <div>
              <strong>#${seg.Id}</strong>
              <p>${solicitud?.AdoptanteNombre || '—'}</p>
              <span>${formatDate(seg.FechaSeguimiento)}</span>
            </div>
            ${badge(seg.EstadoSeguimiento || 'Activo', 'seguimiento')}
          </button>
        `;
      }).join('')
    : '<p class="muted">Sin seguimientos recientes.</p>';

  // Visitas: priorizar Programadas por fecha ascendente; si no hay, mostrar Pendientes recientes
  try {
    const programadas = (state.visits || []).filter(v => (v.EstadoSolicitud||'').trim()==='Programada').sort((a,b)=>{
      const ta = a.FechaHoraVisita ? Date.parse(a.FechaHoraVisita) : Number.MAX_SAFE_INTEGER;
      const tb = b.FechaHoraVisita ? Date.parse(b.FechaHoraVisita) : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    }).slice(0,3);
    const fallback = (state.visits || []).filter(v => (v.EstadoSolicitud||'').trim()==='Pendiente').slice(0,3);
    const show = programadas.length ? programadas : fallback;
    visitasPanel.innerHTML = show.length
      ? show.map((v) => `
          <button type="button" class="summary-item" data-summary-goto="visitas" data-summary-id="${v.Id}">
            <span class="summary-icon">📅</span>
            <div>
              <strong>${v.AnimalNombre || 'Visita'}</strong>
              <p>${v.FechaHoraVisita ? formatDateTime(v.FechaHoraVisita) : 'A confirmar'}</p>
            </div>
            ${badge(v.EstadoSolicitud || 'Programada', 'visita')}
          </button>
        `).join('')
      : '<p class="muted">Sin visitas próximas.</p>';
  } catch { visitasPanel.innerHTML = '<p class="muted">Sin visitas.</p>'; }
  // Asegurar mensaje de vacío para Visitas cuando no hay elementos
  if (visitasPanel && !visitasPanel.querySelector('.summary-item')) {
    const txt = (visitasPanel.textContent || '').trim().toLowerCase();
    if (!txt || txt.includes('sin visitas') || txt.includes('cargando')) {
      visitasPanel.innerHTML = '<p class="muted">Sin visitas recientes.</p>';
    }
  }
}

function renderStats(state, container) {
  const statsNode = container.querySelector('[data-operator-stats]');
  if (!statsNode) return;

  const norm = (s) => (s || '').toString().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isReserved = (a) => norm(a.EstadoSolicitud).includes('reserv');
  const isUnavailable = (a) => {
    const est = norm(a.EstadoSolicitud);
    return est.includes('no disponible') || est === 'baja' || est.includes('baja');
  };
  const isAdopted = (a) => norm(a.Resultado).includes('adopt') || norm(a.EstadoSolicitud).includes('adopt');
  const isHealthApto = (a) => {
    const h = norm(a.EstadoSalud);
    return h.includes('apto') && !h.includes('no apto');
  };
  const isAvailable = (a) => !isReserved(a) && !isUnavailable(a) && (isHealthApto(a) || norm(a.EstadoSolicitud).includes('dispon') || norm(a.EstadoSolicitud).includes('adop'));

  const totalAnimales = state.animals.length;
  const disponibles = state.animals.filter(isAvailable).length;
  const reservas = state.animals.filter(isReserved).length;
  const adoptados = state.animals.filter(isAdopted).length;
  const pendientes = (state.solicitudes || []).filter((s) => norm(s.EstadoSolicitud).includes('pend')).length;

  statsNode.innerHTML = `
    <span class="meta-chip">Animales: ${totalAnimales}</span>
    <span class="meta-chip">Disponibles: ${disponibles}</span>
    <span class="meta-chip">Reservados: ${reservas}</span>
    <span class="meta-chip">Adoptados: ${adoptados}</span>
    <span class="meta-chip">Solicitudes pendientes: ${pendientes}</span>
  `;
}

function attachAnimalEvents(container, state, refresh) {
  const table = container.querySelector('[data-animals-table]');
  const createForm = container.querySelector('[data-animal-create]');
  const updateForm = container.querySelector('[data-animal-update]');
  const deactivateForm = container.querySelector('[data-animal-deactivate]');

  // Tabs internos: Registrar / Modificar / Baja
  try {
    const tabsContainer = container.querySelector('[data-animal-tabs]');
    if (tabsContainer) {
      const tabs = Array.from(tabsContainer.querySelectorAll('[data-animal-tab]'));
      const panels = Array.from(container.querySelectorAll('[data-animal-panel]'));
      const showPanel = (key) => {
        panels.forEach((p) => {
          const active = p.dataset.animalPanel === key;
          p.hidden = !active;
          p.classList.toggle('is-active', active);
        });
        tabs.forEach((b) => b.classList.toggle('is-active', b.dataset.animalTab === key));
      };
      tabs.forEach((btn) => btn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = btn.dataset.animalTab;
        if (key) showPanel(key);
      }));
      // Estado inicial
      showPanel('registrar');
    }
  } catch {}

  // Link Especie/Raza to EspecieRaza (create)
  try {
    const especie = createForm?.querySelector('[data-especie-create]');
    const raza = createForm?.querySelector('[data-raza-create]');
    const er = createForm?.elements?.EspecieRaza;
    const sync = () => { if (er) er.value = `${especie?.value || ''} ${raza?.value || ''}`.trim(); };
    especie?.addEventListener('change', sync);
    raza?.addEventListener('input', sync);
  } catch {}

  // Link Especie/Raza to EspecieRaza (update)
  try {
    const especieU = updateForm?.querySelector('[data-especie-update]');
    const razaU = updateForm?.querySelector('[data-raza-update]');
    const erU = updateForm?.elements?.EspecieRaza;
    const syncU = () => { if (erU) erU.value = `${especieU?.value || ''} ${razaU?.value || ''}`.trim(); };
    especieU?.addEventListener('change', syncU);
    razaU?.addEventListener('input', syncU);
  } catch {}

  // Autocomplete and selection handling (update/deactivate)
  function findAnimalFromQuery(text) {
    if (!text) return null;
    const trimmed = String(text).trim();
    const idMatch = trimmed.match(/^(#?)(\d+)/);
    if (idMatch) {
      const id = idMatch[2];
      const byId = state.animals.find((a) => String(a.Id) === String(id));
      if (byId) return byId;
    }
    const lower = trimmed.toLowerCase();
    return state.animals.find((a) => (a.Nombre || '').toLowerCase().includes(lower)) || null;
  }

  try {
    const dlContainer = container; // animals panel
    populateAnimalsDatalist(state, dlContainer);
  } catch {}

  try {
    const inputU = updateForm?.elements?.AnimalId;
    inputU?.addEventListener('change', () => {
      const a = findAnimalFromQuery(inputU.value);
      if (!a) return;
      updateForm.elements.AnimalId.value = a.Id;
      updateForm.elements.Nombre.value = a.Nombre || '';
      if (updateForm.elements.EspecieRaza) updateForm.elements.EspecieRaza.value = a.EspecieRaza || '';
      updateForm.elements.EstadoSolicitud.value = a.EstadoSolicitud || '';
      updateForm.elements.Diagnostico.value = a.Diagnostico || '';
      if (updateForm.elements.Foto) updateForm.elements.Foto.value = a.Foto || '';
      const uploader = updateForm.querySelector('[data-uploader-update]');
      const preview = uploader?.querySelector('[data-foto-preview]');
      if (preview && a.Foto) { preview.src = normalizeImageSrc(a.Foto); preview.style.display = ''; }
      try {
        const raw = (
          a.Adjuntos || a.Galeria || a.ArchivosAdjuntos || a.Evidencia || a.adjuntos || a.galeria || a.archivosAdjuntos || a.evidencia || ''
        );
        let urls = [];
        if (typeof raw === 'string' && raw.trim()) {
          const s = raw.trim();
          if (s.startsWith('[')) { try { const arr = JSON.parse(s); urls = Array.isArray(arr) ? arr.map((x)=>String(x||'').trim()) : []; } catch {} }
          if (!urls.length) {
            const m = s.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/\S+/g);
            urls = (m||[]).map((u)=>u.trim());
          }
        }
        const main = (a.Foto || '').trim();
        if (main && !urls.includes(main)) urls.unshift(main);
        if (updateForm.elements.Adjuntos) updateForm.elements.Adjuntos.value = urls.length ? JSON.stringify(urls) : '';
        if (uploader && typeof uploader._setGallery === 'function') uploader._setGallery(urls);
      } catch {}
    });
  } catch {}

  try {
    const inputB = deactivateForm?.elements?.AnimalId;
    const bajaText = deactivateForm?.querySelector('[data-baja-confirm]');
    inputB?.addEventListener('change', () => {
      const a = findAnimalFromQuery(inputB.value);
      if (!a) { if (bajaText) bajaText.textContent = ''; return; }
      if (bajaText) bajaText.textContent = `¿Confirmás dar de baja lógica al animal ${a.Nombre || ('#' + a.Id)}? Esta acción lo marcará como inactivo sin eliminarlo del sistema.`;
      deactivateForm.elements.AnimalId.value = a.Id;
    });
  } catch {}

  // Uploader helpers: bind file select, paste and drag&drop
  function setupUploader({ form, uploaderSelector, inputSelector, gallerySelector }) {
    if (!form) return;
    const uploader = form.querySelector(uploaderSelector);
    const textInput = form.querySelector(inputSelector);
    if (!uploader || !textInput) return;
    const fileInput = uploader.querySelector('[data-foto-file]');
    const drop = uploader.querySelector('.uploader-drop');
    const preview = uploader.querySelector('[data-foto-preview]');

    // Ensure hidden Adjuntos field and gallery container exist
    let adjInput = form.elements['Adjuntos'];
    if (!adjInput) {
      adjInput = document.createElement('input');
      adjInput.type = 'hidden';
      adjInput.name = 'Adjuntos';
      uploader.appendChild(adjInput);
    }
    let galleryEl = gallerySelector ? uploader.querySelector(gallerySelector) : null;
    if (!galleryEl) {
      galleryEl = document.createElement('div');
      galleryEl.className = 'mini-gallery';
      galleryEl.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;';
      uploader.appendChild(galleryEl);
    }

    // Keep an in-form gallery list
    let gallery = [];
    function syncAdjuntos() {
      adjInput.value = gallery.length ? JSON.stringify(gallery) : '';
    }
    function renderGallery() {
      galleryEl.innerHTML = gallery
        .map((url, idx) => (
          `<div class="thumb-wrap" data-gwrap="${idx}" style="position:relative;">`
          + `<button type="button" data-gsel="${idx}" title="${idx===0?'Principal':''}" style="border:0;padding:0;background:none;cursor:pointer;">`
          + `<img src="${url}" alt="Foto ${idx+1}" style="width:${idx===0?84:64}px;height:${idx===0?84:64}px;object-fit:cover;border-radius:8px;border:${idx===0?'2px solid var(--color-primary)':'1px solid var(--color-border)'}" />`
          + `</button>`
          + `<button type="button" data-gdel="${idx}" title="Quitar" aria-label="Quitar imagen" style="position:absolute;top:-6px;right:-6px;background:#fff;border:1px solid var(--color-border);border-radius:999px;width:20px;height:20px;line-height:18px;text-align:center;font-size:12px;color:#e02424;">×</button>`
          + `</div>`
        ))
        .join('');
      galleryEl.querySelectorAll('[data-gsel]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.getAttribute('data-gsel'), 10);
          if (isNaN(i) || i < 0 || i >= gallery.length) return;
          const [picked] = gallery.splice(i, 1);
          gallery.unshift(picked);
          textInput.value = gallery[0] || '';
          if (preview) { preview.src = textInput.value; preview.style.display = textInput.value ? '' : 'none'; }
          syncAdjuntos();
          renderGallery();
        });
      });
      galleryEl.querySelectorAll('[data-gdel]').forEach((btn) => {
        btn.addEventListener('click', (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          const i = parseInt(btn.getAttribute('data-gdel'), 10);
          if (isNaN(i) || i < 0 || i >= gallery.length) return;
          gallery.splice(i, 1);
          textInput.value = gallery[0] || '';
          if (preview) {
            if (textInput.value) { preview.src = textInput.value; preview.style.display = ''; }
            else { preview.removeAttribute('src'); preview.style.display = 'none'; }
          }
          syncAdjuntos();
          renderGallery();
        });
      });
    }

    function addToGallery(url) {
      if (!url) return;
      const norm = normalizeImageSrc(url);
      if (!norm) return;
      if (!gallery.includes(norm)) gallery.push(norm);
      if (!textInput.value) textInput.value = gallery[0];
      syncAdjuntos();
      renderGallery();
      if (preview && textInput.value) { preview.src = normalizeImageSrc(textInput.value); preview.style.display = ''; }
    }

    function readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    async function setImageFromFile(file) {
      try {
        if (!file || !file.type || !file.type.startsWith('image/')) return;
        // Show immediate local preview (object URL) for responsiveness
        let localUrl = '';
        try { localUrl = URL.createObjectURL(file); } catch {}
        if (localUrl) {
          addToGallery(localUrl);
          const primary = normalizeImageSrc(localUrl);
          textInput.value = primary;
          if (preview) { preview.src = primary; preview.style.display = ''; }
          try { const idx = gallery.indexOf(primary); if (idx > 0) { gallery.splice(idx, 1); gallery.unshift(primary); } } catch {}
          syncAdjuntos();
          renderGallery();
        }

        // Try to upload if we are editing an existing animal (has ID)
        const animalId = (form.elements && form.elements.AnimalId && form.elements.AnimalId.value)
          ? String(form.elements.AnimalId.value).trim()
          : '';
        if (animalId) {
          try {
            const uploaded = await uploadAnimalPhoto(animalId, file);
            if (uploaded) {
              const serverUrl = normalizeImageSrc(uploaded);
              // Replace local preview with server URL as primary
              const idx = gallery.indexOf(localUrl);
              if (idx !== -1) {
                gallery.splice(idx, 1, serverUrl);
              } else if (!gallery.includes(serverUrl)) {
                gallery.unshift(serverUrl);
              }
              textInput.value = serverUrl;
              if (preview) { preview.src = serverUrl; preview.style.display = ''; }
              syncAdjuntos();
              renderGallery();
              try { if (localUrl) URL.revokeObjectURL(localUrl); } catch {}
              return;
            }
          } catch (e) {
            console.warn('[uploader] Upload failed, keeping local preview:', e?.message || e);
          }
        }
        // If we couldn’t upload (no ID or failure), ensure we at least embed a data URL (persistable)
        const dataUrl = await readFile(file);
        const dataPrimary = normalizeImageSrc(dataUrl);
        // Replace local object URL with data URL for persistence in the form payload
        const i2 = gallery.indexOf(localUrl);
        if (i2 !== -1) {
          gallery.splice(i2, 1, dataPrimary);
        } else if (!gallery.includes(dataPrimary)) {
          gallery.unshift(dataPrimary);
        }
        textInput.value = dataPrimary;
        if (preview) { preview.src = dataPrimary; preview.style.display = ''; }
        syncAdjuntos();
        renderGallery();
        try { if (localUrl) URL.revokeObjectURL(localUrl); } catch {}
      } catch {}
    }
    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        await setImageFromFile(file);
      });
    }
    form.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          e.preventDefault();
          await setImageFromFile(it.getAsFile());
          break;
        }
      }
    });
    if (drop) {
      ['dragenter','dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-hover'); }));
      ['dragleave','drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-hover'); }));
      drop.addEventListener('drop', async (e) => {
        const file = e.dataTransfer?.files?.[0];
        await setImageFromFile(file);
      });
    }
    // If the user types/pastes a URL in the text field, add it to gallery
    textInput.addEventListener('change', () => {
      const url = (textInput.value || '').trim();
      if (url) addToGallery(url);
    });

    // Initialize from existing values (when editing)
    try {
      const initial = (adjInput.value || '').trim();
      let urls = [];
      if (initial) {
        if (initial.startsWith('[')) {
          try { const arr = JSON.parse(initial); urls = Array.isArray(arr) ? arr.map((s)=>String(s||'').trim()) : []; } catch {}
        } else {
          const matches = initial.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/\S+/g);
          urls = (matches || []).map((s)=>s.trim());
        }
      }
      const main = (textInput.value || '').trim();
      if (main && !urls.includes(main)) urls.unshift(main);
      urls.filter(Boolean).forEach(addToGallery);
    } catch {}

    // Expose API to set gallery later (when cargando animal en editar)
    uploader._setGallery = (urls) => {
      try {
        gallery = [];
        (urls || []).map((s)=>String(s||'').trim()).filter(Boolean).forEach(addToGallery);
      } catch {}
    };
  }

  // Bind uploaders for create and update forms
  setupUploader({ form: createForm, uploaderSelector: '[data-uploader-create]', inputSelector: '[data-foto-input-create]', gallerySelector: '[data-gallery-create]' });
  setupUploader({ form: updateForm, uploaderSelector: '[data-uploader-update]', inputSelector: '[data-foto-input-update]', gallerySelector: '[data-gallery-update]' });

  // Remove empty string fields to avoid backend validations on blank values
  function pruneEmpty(obj) {
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      const s = typeof v === 'string' ? v.trim() : v;
      if (typeof s === 'string' && s === '') return;
      out[k] = v;
    });
    return out;
  }

  table?.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    const id = target.dataset.id;
    const action = target.dataset.action;
    state.selectedAnimalId = id;
    renderAnimalDetail(state, container);
    if (action === 'edit' && updateForm) {
      const animal = state.animals.find((a) => String(a.Id) === String(id));
      if (!animal) return;
      updateForm.elements.AnimalId.value = animal.Id;
      updateForm.elements.Nombre.value = animal.Nombre || '';
      updateForm.elements.EstadoSolicitud.value = animal.EstadoSolicitud || '';
      updateForm.elements.Diagnostico.value = animal.Diagnostico || '';
      updateForm.elements.Foto.value = animal.Foto || '';
      // Update preview if available
      try {
        const uploader = updateForm.querySelector('[data-uploader-update]');
        const preview = uploader?.querySelector('[data-foto-preview]');
        if (preview && animal.Foto) {
          preview.src = animal.Foto;
          preview.style.display = '';
        }
        try {
          const raw = (animal.Adjuntos || animal.Galeria || animal.ArchivosAdjuntos || animal.Evidencia || animal.adjuntos || animal.galeria || animal.archivosAdjuntos || animal.evidencia || '');
          let urls = [];
          if (typeof raw === 'string' && raw.trim()) {
            const s = raw.trim();
            if (s.startsWith('[')) { try { const arr = JSON.parse(s); urls = Array.isArray(arr) ? arr.map((x)=>String(x||'').trim()) : []; } catch {} }
            if (!urls.length) {
              const m = s.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/\S+/g);
              urls = (m||[]).map((u)=>normalizeImageSrc(u.trim())).filter(Boolean);
            }
          }
          const main = (animal.Foto || '').trim();
          const mainNorm = normalizeImageSrc(main);
          if (mainNorm && !urls.includes(mainNorm)) urls.unshift(mainNorm);
          if (updateForm.elements.Adjuntos) updateForm.elements.Adjuntos.value = urls.length ? JSON.stringify(urls) : '';
          if (uploader && typeof uploader._setGallery === 'function') uploader._setGallery(urls);
        } catch {}
      } catch {}
      // Switch to Modificar tab
      try { container.querySelector('[data-animal-tabs] [data-animal-tab="modificar"]').click(); } catch {}
    }
    if (action === 'view') {
      renderAnimalDetail(state, container);
    }
    table.querySelectorAll('tr').forEach((row) => {
      row.classList.toggle('is-selected', row.dataset.id === String(id));
    });
  });

createForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    let payload = Object.fromEntries(new FormData(form));
    if (!payload.EspecieRaza) {
      const combined = `${payload.Especie || ''} ${payload.Raza || ''}`.trim();
      if (combined) {
        payload.EspecieRaza = combined;
        try { form.elements.EspecieRaza.value = combined; } catch {}
      }
    }
    // Ensure a photo is present; if not provided, use a placeholder to satisfy backend
    if (!payload.Foto || !String(payload.Foto).trim()) {
      const name = (payload.Nombre || 'Mascota').toString().trim() || 'Mascota';
      payload.Foto = `https://placehold.co/640x426?text=${encodeURIComponent(name)}`;
    }
    payload = pruneEmpty(payload);

    if (!payload.Nombre || !payload.EspecieRaza || !payload.Foto) {
      feedback(container.querySelector('[data-animal-create-feedback]'), 'Completá los campos obligatorios.', 'error');
      return;
    }
    feedback(container.querySelector('[data-animal-create-feedback]'), 'Registrando…', 'info');
  try {
      const response = await createPet(payload);
      const okMsgCreate = ' ✔ Animal registrado correctamente.';
      feedback(container.querySelector('[data-animal-create-feedback]'), okMsgCreate, 'success');
      showToast('success', okMsgCreate);
      form.reset();
      try { invalidatePetsCache(); } catch {}
      await refresh.animals();
    } catch (error) {
      // Si el backend avisa posible duplicado, confirmamos y reintentamos una vez
      const msg = String(error?.message || '').toLowerCase();
      if (error?.status === 409 && msg.includes('duplic')) {
        try {
          const confirmPayload = { ...payload, ConfirmarDuplicado: '1' };
          const response2 = await createPet(confirmPayload);
          const okMsg = ' ✔ Animal registrado (confirmado como duplicado).';
          feedback(container.querySelector('[data-animal-create-feedback]'), okMsg, 'success');
          showToast('success', okMsg);
          form.reset();
          try { invalidatePetsCache(); } catch {}
          await refresh.animals();
          return;
        } catch (e2) {
          feedback(container.querySelector('[data-animal-create-feedback]'), e2.message || 'No se pudo registrar el animal.', 'error');
          return;
        }
      }
      feedback(container.querySelector('[data-animal-create-feedback]'), error.message || ' No se pudo registrar el animal. Revisá los campos e intentá nuevamente.', 'error');
    }
  });

updateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    let payload = Object.fromEntries(new FormData(form));
    let id = payload.AnimalId;
    const resolvedAnimal = findAnimalFromQuery(payload.AnimalId);
    if (resolvedAnimal) {
      id = resolvedAnimal.Id;
      payload.AnimalId = String(resolvedAnimal.Id);
    } else if (typeof id === 'string') {
      const digits = id.match(/\d+/);
      if (digits) {
        id = digits[0];
        payload.AnimalId = digits[0];
      }
    }
    if (id !== undefined && id !== null) {
      id = String(id).trim().replace(/^#/, '');
      if (id) payload.AnimalId = id;
    }
    if (!id) {
      feedback(container.querySelector('[data-animal-update-feedback]'), 'Indicá el ID del animal.', 'error');
      return;
    }
    // Do not send empty fields (especially Foto='') to avoid 400 validation errors
    payload = pruneEmpty(payload);
    feedback(container.querySelector('[data-animal-update-feedback]'), 'Actualizando…', 'info');
  try {
      const response = await updatePet(id, payload);
      const okMsgUpdate = ' ✔ Datos del animal actualizados correctamente.';
      feedback(container.querySelector('[data-animal-update-feedback]'), okMsgUpdate, 'success');
      showToast('success', okMsgUpdate);
      try { invalidatePetsCache(); } catch {}
      await refresh.animals();
    } catch (error) {
      const msg = String(error?.message || '').toLowerCase();
      if (error?.status === 409 && msg.includes('duplic')) {
        try {
          const response2 = await updatePet(id, { ...payload, ConfirmarDuplicado: '1' });
          const okMsg = ' ✔ Datos actualizados (confirmado como duplicado).';
          feedback(container.querySelector('[data-animal-update-feedback]'), okMsg, 'success');
          showToast('success', okMsg);
          try { invalidatePetsCache(); } catch {}
          await refresh.animals();
          return;
        } catch (e2) {
          feedback(container.querySelector('[data-animal-update-feedback]'), e2.message || 'No se pudo actualizar.', 'error');
          return;
        }
      }
      feedback(container.querySelector('[data-animal-update-feedback]'), error.message || 'No se pudo actualizar.', 'error');
    }
  });

  deactivateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.AnimalId.value;
    if (!id) {
      feedback(container.querySelector('[data-animal-deactivate-feedback]'), 'Ingresá el ID del animal.', 'error');
      return;
    }
    feedback(container.querySelector('[data-animal-deactivate-feedback]'), 'Procesando…', 'info');
    try {
      const response = await deactivatePet(id);
      const okMsgDeactivate = ' ✔ Animal dado de baja lógicamente.';
      feedback(container.querySelector('[data-animal-deactivate-feedback]'), okMsgDeactivate, 'success');
      showToast('success', okMsgDeactivate);
      form.reset();
      try { invalidatePetsCache(); } catch {}
      await refresh.animals();
    } catch (error) {
      feedback(container.querySelector('[data-animal-deactivate-feedback]'), error.message || 'No se pudo dar de baja.', 'error');
    }
  });
}

function attachSolicitudesEvents(container, state, refresh, goToTab) {
  const searchInput = container.querySelector('[data-solicitud-search]');
  const table = container.querySelector('[data-solicitudes-table]');

  searchInput?.addEventListener('input', () => {
    state.solicitudSearch = searchInput.value;
    renderSolicitudes(state, container);
  });

  table?.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-id]');
    if (!row) return;
    state.selectedSolicitudId = row.dataset.id;
    renderSolicitudes(state, container);
    renderSolicitudDetail(state, container);
  });

  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-sol-action]');
    if (!button) return;
    const action = button.dataset.solAction;
    const solicitud = state.solicitudes.find((s) => String(s.Id) === String(state.selectedSolicitudId));
    const feedbackNode = container.querySelector('[data-sol-feedback]');
    if (!solicitud) {
      feedback(feedbackNode, 'Elegí una solicitud para continuar.', 'error');
      return;
    }
    if (action === 'followup') {
      const seg = state.followups.find((item) => Number(item.SolicitudId) === Number(solicitud.Id));
      if (!seg) {
        feedback(feedbackNode, 'La solicitud no tiene seguimiento asociado.', 'error');
        return;
      }
      state.selectedFollowupId = seg.Id;
      goToTab('seguimientos');
      const followupRow = container.ownerDocument.querySelector('[data-tab-panel="seguimientos"] [data-seguimientos-table]');
      followupRow?.querySelectorAll('tr').forEach((row) => {
        row.classList.toggle('is-selected', row.dataset.id === String(seg.Id));
      });
      return;
    }
    const notes = (container.querySelector('[data-sol-notes]')?.value || '').trim();
    try {
      feedback(feedbackNode, 'Procesando…', 'info');
      if (action === 'review') {
        if (!notes) {
          feedback(feedbackNode, 'Necesitás indicar el requerimiento para poner en revisión.', 'error');
          return;
        }
        await setUnderReview(solicitud.Id, { Motivo: notes });
        showToast('info', `Solicitud #${solicitud.IdSolicitud || solicitud.Id} en revisión.`);
      } else if (action === 'approve') {
        await approveApplication(solicitud.Id);
        showToast('success', `Solicitud #${solicitud.IdSolicitud || solicitud.Id} aprobada correctamente.`);
      } else if (action === 'reject') {
        if (!notes) {
          feedback(feedbackNode, 'Indicá el motivo del rechazo.', 'error');
          return;
        }
        await rejectApplication(solicitud.Id, { Motivo: notes });
        showToast('warning', `Solicitud #${solicitud.IdSolicitud || solicitud.Id} rechazada.`);
      } else if (action === 'void') {
        if ((solicitud.EstadoSolicitud || '').toLowerCase() === 'rechazada') {
          const msg = ' No se puede anular una solicitud rechazada.';
          feedback(feedbackNode, msg, 'error');
          showToast('warning', msg);
          return;
        }
        await voidApplication(solicitud.Id, { Motivo: notes });
        showToast('info', `Solicitud #${solicitud.IdSolicitud || solicitud.Id} anulada.`);
      }
      feedback(feedbackNode, 'Estado actualizado.', 'success');
      container.querySelector('[data-sol-notes]').value = '';
      await refresh.solicitudes();
    } catch (error) {
      feedback(feedbackNode, error.message || 'No se pudo completar la acción.', 'error');
    }
  });
}

function attachFollowupsEvents(container, state, refresh) {
  const table = container.querySelector('[data-seguimientos-table]');
  const createForm = container.querySelector('[data-followup-create]');
  const updateForm = container.querySelector('[data-followup-update]');
  const cancelButton = updateForm?.querySelector('[data-followup-cancel]');
  const filter = container.querySelector('[data-followup-filter]');

  const findLatestSolicitudForAnimal = (animalId) => {
    if (!animalId) return null;
    const matches = (state.solicitudes || []).filter((sol) => String(sol.AnimalId) === String(animalId));
    if (!matches.length) return null;
    return matches.reduce((best, current) => {
      if (!best) return current;
      const bestTs = best?.FechaSolicitud ? Date.parse(best.FechaSolicitud) : 0;
      const currentTs = current?.FechaSolicitud ? Date.parse(current.FechaSolicitud) : 0;
      return currentTs >= bestTs ? current : best;
    }, null);
  };
  const findSolicitudByReference = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;
    const normalized = text.replace(/^#/, '');
    const upper = text.toUpperCase();
    const bareUpper = normalized.toUpperCase();
    return (state.solicitudes || []).find((sol) => {
      if (!sol) return false;
      if (String(sol.Id) === normalized) return true;
      const idSolicitud = String(sol.IdSolicitud || '').toUpperCase();
      if (idSolicitud === upper || idSolicitud === bareUpper) return true;
      return false;
    }) || null;
  };

  // Populate animals datalist so the Animal selector shows all options
  try { populateAnimalsDatalist(state, container); } catch {}

  const animalInput = container.querySelector('input[name="AnimalId"]');

  // Help parse "123 - Luna" or name-only into a valid ID
  const findAnimalFromQuery = (text) => {
    if (!text) return null;
    const trimmed = String(text).trim();
    const idMatch = trimmed.match(/^(#?)(\d+)/);
    if (idMatch) {
      const id = idMatch[2];
      const byId = (state.animals || []).find((a) => String(a.Id) === String(id));
      if (byId) return byId;
    }
    const lower = trimmed.toLowerCase();
    return (state.animals || []).find((a) => (a.Nombre || '').toLowerCase().includes(lower)) || null;
  };
  const normalizeAnimalId = (raw) => {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    const matched = trimmed.match(/^(#?)(\d+)/);
    if (matched) return matched[2];
    const found = findAnimalFromQuery(trimmed);
    return found ? String(found.Id) : '';
  };
  try {
    animalInput?.addEventListener('change', () => {
      const normalized = normalizeAnimalId(animalInput.value);
      if (normalized) animalInput.value = normalized;
    });
  } catch {}
  filter?.addEventListener('change', () => {
    renderSeguimientos(state, container);
  });

  // Construir y manejar rollover (ficha) para "Ver"
  try {
    const ensureHoverCard = () => {
      let card = document.getElementById('followup-hover-card');
      if (!card) {
        card = document.createElement('div');
        card.id = 'followup-hover-card';
        card.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;pointer-events:auto;display:none;width:min(720px,90vw);max-height:80vh;overflow:auto;background:#fff;border:1px solid #e6e6e6;border-radius:16px;box-shadow:0 12px 28px rgba(0,0,0,.18);padding:16px;';
        document.body.appendChild(card);
      }
      return card;
    };
    const ensureOverlay = () => {
      let ov = document.getElementById('followup-overlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'followup-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:9998;display:none;';
        document.body.appendChild(ov);
      }
      return ov;
    };
    const buildCard = (seg) => {
      const solicitud = (state.solicitudes || []).find((s) => Number(s.Id) === Number(seg.SolicitudId));
      const adoptante = solicitud?.AdoptanteNombre || '-';
      // Resolver animal por múltiples fuentes: solicitud, propio seguimiento o lista de animales
      let animalNombre = solicitud?.AnimalNombre;
      let animalId = solicitud?.AnimalId;
      const segAnimalId = seg.AnimalId || seg.AnimalID || seg.IdAnimal;
      if (!animalId && segAnimalId) animalId = segAnimalId;
      if (!animalNombre && animalId) {
        const found = (state.animals || []).find((a) => Number(a.Id) === Number(animalId));
        if (found) animalNombre = found.Nombre;
      }
      const animal = animalNombre || '-';
      return `
        <article class="panel-card" style="box-shadow:none;padding:0;background:transparent;position:relative;">
          <div class="card-close-bar" style="position:relative;display:flex;justify-content:flex-end;padding:8px;background:linear-gradient(#fff,#fff);z-index:1;border-top-left-radius:16px;border-top-right-radius:16px;">
            <button type="button" class="card-close-btn" data-close-card aria-label="Cerrar" title="Cerrar" style="width:32px;height:32px;border:1px solid #e6e6e6;border-radius:999px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#444;">
              <span class="icon material-symbols-outlined" aria-hidden="true">close</span>
              <span class="sr-only">Cerrar</span>
            </button>
          </div>
          <button type="button" data-close-card aria-label="Cerrar" title="Cerrar" style="position:absolute;right:8px;top:8px;width:32px;height:32px;border:1px solid #e6e6e6;border-radius:999px;background:#fff;cursor:pointer;line-height:30px;text-align:center;font-size:18px;color:#444">×</button>
          <header class="panel-card__header" style="margin:0 16px 8px;">
            <h3 style="margin:0">Seguimiento #${seg.Id}</h3>
            <p class="muted" style="margin:4px 0 0">${animal} — ${adoptante}</p>
          </header>
          <dl class="detail-grid" style="padding:0 16px 16px;">
            <div><dt>Estado</dt><dd>${badge(seg.EstadoSeguimiento || 'Activo', 'seguimiento')}</dd></div>
            <div><dt>Tipo</dt><dd>${seg.TipoSeguimiento || '-'}</dd></div>
            <div><dt>Animal</dt><dd>${animal}${animalId ? ` (ID #${animalId})` : ''}</dd></div>
            <div><dt>Fecha</dt><dd>${formatDate(seg.FechaSeguimiento)}</dd></div>
            <div class="full"><dt>Observaciones</dt><dd>${seg.Observaciones || '-'}</dd></div>
          </dl>
        </article>`;
    };
    const card = ensureHoverCard();
    const overlay = ensureOverlay();
    const show = (html) => {
      card.innerHTML = html;
      overlay.style.display = 'block';
      card.style.display = 'block';
      try { document.documentElement.style.overflow = 'hidden'; } catch {}
    };
    const hide = () => {
      card.style.display = 'none';
      overlay.style.display = 'none';
      try { document.documentElement.style.overflow = ''; } catch {}
    };
    const showFollowupCard = (seg) => {
      if (!seg) return;
      show(buildCard(seg));
    };
    container.showFollowupDetail = showFollowupCard;
    let escHandler = null;
    table?.addEventListener('click', (event) => {
      const target = event.target;
      const viewBtn = target.closest('[data-followup-view]');
      const editBtn = target.closest('[data-followup-edit]');
      const cancelBtn = target.closest('[data-followup-cancel]');
      if (!viewBtn && !editBtn && !cancelBtn) return;
      event.preventDefault();
      if (viewBtn) {
        const id = viewBtn.getAttribute('data-followup-view');
        const seg = (state.followups || []).find((x) => String(x.Id) === String(id));
        if (!seg) return;
        show(buildCard(seg));
        const clickHandler = () => { hide(); document.removeEventListener('click', clickHandler, true); if (escHandler) window.removeEventListener('keydown', escHandler, true); overlay.onclick = null; };
        document.addEventListener('click', clickHandler, true);
        escHandler = (e) => { if (e.key === 'Escape') { hide(); if (escHandler) window.removeEventListener('keydown', escHandler, true); document.removeEventListener('click', clickHandler, true); } };
        window.addEventListener('keydown', escHandler, true);
        try {
          const closeBtn = document.getElementById('followup-hover-card')?.querySelector('[data-close-card]');
          closeBtn?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clickHandler(); });
          overlay.onclick = (e) => { e.preventDefault(); e.stopPropagation(); clickHandler(); };
        } catch {}
        return;
      }
      if (editBtn) {
        const id = editBtn.getAttribute('data-followup-edit');
        const seg = state.followups.find((item) => String(item.Id) === String(id));
        if (!seg || !updateForm) return;
        state.selectedFollowupId = id;
        updateForm.elements.SeguimientoId.value = seg.Id;
        updateForm.elements.EstadoSeguimiento.value = seg.EstadoSeguimiento || '';
        if (updateForm.elements.TipoSeguimiento) {
          updateForm.elements.TipoSeguimiento.value = seg.TipoSeguimiento || '';
        }
        updateForm.elements.Observaciones.value = seg.Observaciones || '';
        table.querySelectorAll('tr').forEach((row) => {
          row.classList.toggle('is-selected', row.dataset.id === String(id));
        });
        try { updateForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
        return;
      }
      if (cancelBtn) {
        const id = cancelBtn.getAttribute('data-followup-cancel');
        const seg = state.followups.find((item) => String(item.Id) === String(id));
        if (!seg) return;
        const proceed = window.confirm ? window.confirm(`¿Cancelar seguimiento #${id}?`) : true;
        if (!proceed) return;
        (async () => {
          try {
            feedback(container.querySelector('[data-followup-update-feedback]'), 'Cancelando.', 'info');
            await cancelFollowUp(id, { Observaciones: (seg.Observaciones || 'Cancelado desde listado') });
            showToast('warning', `Seguimiento #${id} cancelado.`);
            updateForm?.reset();
            await refresh.followups();
          } catch (error) {
            feedback(container.querySelector('[data-followup-update-feedback]'), error.message || 'No se pudo cancelar.', 'error');
          }
        })();
        return;
      }
    });
  } catch {}

  createForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(createForm));
    payload.Responsable = OPERATOR_RESPONSIBLE;
    payload.Responsable = OPERATOR_RESPONSIBLE;
    const rawAnimalValue = payload.AnimalId || '';
    const solicitudByReference = findSolicitudByReference(rawAnimalValue);
    const normalizedAnimal = normalizeAnimalId(rawAnimalValue);
    payload.AnimalId = normalizedAnimal || (solicitudByReference?.AnimalId ? String(solicitudByReference.AnimalId) : '');
    if (!payload.AnimalId) {
      feedback(container.querySelector('[data-followup-create-feedback]'), 'Indicá el ID del animal.', 'error');
      return;
    }
    let matched = solicitudByReference || findLatestSolicitudForAnimal(payload.AnimalId);
    if (!matched) {
      try {
        matched = await ensureSolicitudForAnimal(payload.AnimalId);
      } catch (error) {
        feedback(container.querySelector('[data-followup-create-feedback]'), error.message || 'No se pudo obtener el expediente del animal.', 'error');
        return;
      }
    }
    if (matched) {
      payload.SolicitudId = matched.Id;
    } else {
      delete payload.SolicitudId;
    }
    if (!payload.TipoSeguimiento) payload.TipoSeguimiento = 'Veterinario';
    payload.Observaciones = payload.Observaciones?.trim() || 'Seguimiento registrado desde el panel.';
    try {
      feedback(container.querySelector('[data-followup-create-feedback]'), 'Creando seguimiento.', 'info');
      await createFollowUp(payload);
      showToast('success', `Seguimiento creado para el animal #${payload.AnimalId}.`);
      feedback(container.querySelector('[data-followup-create-feedback]'), 'Seguimiento creado.', 'success');
      createForm.reset();
      await refresh.followups();
      try { await refresh.solicitudes(); } catch {}
    } catch (error) {
      feedback(container.querySelector('[data-followup-create-feedback]'), error.message || 'No se pudo crear el seguimiento.', 'error');
    }
  });
  updateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(updateForm));
    payload.Responsable = OPERATOR_RESPONSIBLE;
    payload.Responsable = OPERATOR_RESPONSIBLE;
    if (!payload.SeguimientoId) {
      feedback(container.querySelector('[data-followup-update-feedback]'), 'Indicá el ID del seguimiento.', 'error');
      return;
    }
    try {
      feedback(container.querySelector('[data-followup-update-feedback]'), 'Actualizando…', 'info');
      await updateFollowUp(payload.SeguimientoId, payload);
      showToast('success', `Seguimiento #${payload.SeguimientoId} actualizado.`);
      feedback(container.querySelector('[data-followup-update-feedback]'), 'Seguimiento actualizado.', 'success');
      await refresh.followups();
    } catch (error) {
      feedback(container.querySelector('[data-followup-update-feedback]'), error.message || 'No se pudo actualizar.', 'error');
    }
  });

  cancelButton?.addEventListener('click', async () => {
    const id = updateForm.elements.SeguimientoId.value;
    const notes = updateForm.elements.Observaciones.value;
    if (!id) {
      feedback(container.querySelector('[data-followup-update-feedback]'), 'Indicá el ID del seguimiento.', 'error');
      return;
    }
    try {
      feedback(container.querySelector('[data-followup-update-feedback]'), 'Cancelando…', 'info');
      await cancelFollowUp(id, { Observaciones: notes });
      showToast('warning', `Seguimiento #${id} cancelado.`);
      feedback(container.querySelector('[data-followup-update-feedback]'), 'Seguimiento cancelado.', 'success');
      updateForm.reset();
      await refresh.followups();
    } catch (error) {
      feedback(container.querySelector('[data-followup-update-feedback]'), error.message || 'No se pudo cancelar.', 'error');
    }
  });
}

function attachVisitsEvents(container, state, refresh) {
  const table = container.querySelector('[data-visitas-table]');
  const createCard = container.querySelector('[data-visita-create-card]');
  const createForm = container.querySelector('[data-visit-create]');
  const openCreate = container.querySelector('[data-visit-open-create]');
  const closeCreate = container.querySelector('[data-visit-close-create]');
  const updateForm = container.querySelector('[data-visit-update]');
  const cancelBtn = container.querySelector('[data-visit-cancel]');

  openCreate?.addEventListener('click', () => {
    createCard.hidden = false;
    createForm.reset();
  });
  closeCreate?.addEventListener('click', () => {
    createCard.hidden = true;
    createForm.reset();
  });

  table?.addEventListener('click', (event) => {
    const fillBtn = event.target.closest('[data-visit-fill]');
    if (fillBtn) {
      const visit = state.visits.find((item) => String(item.Id) === String(fillBtn.dataset.visitFill));
      if (!visit) return;
      updateForm.elements.VisitaId.value = visit.Id;
      updateForm.elements.FechaHoraVisita.value = visit.FechaHoraVisita ? visit.FechaHoraVisita.slice(0, 16) : '';
      updateForm.elements.Direccion.value = visit.Direccion || '';
      updateForm.elements.Motivo.value = visit.Motivo || '';
      updateForm.elements.Modalidad.value = visit.Modalidad || '';
      table.querySelectorAll('tr').forEach((row) => {
        row.classList.toggle('is-selected', row.dataset.id === String(visit.Id));
      });
      return;
    }
    const programBtn = event.target.closest('[data-visit-program]');
    if (programBtn) {
      const visit = state.visits.find((item) => String(item.Id) === String(programBtn.dataset.visitProgram));
      if (!visit) return;
      // Abrir card de creación y precargar campos
      if (createCard) createCard.hidden = false;
      if (createForm) {
        if (createForm.elements.SolicitudId) createForm.elements.SolicitudId.value = visit.SolicitudId || '';
        if (createForm.elements.Modalidad) createForm.elements.Modalidad.value = visit.Modalidad || '';
        if (createForm.elements.Direccion) createForm.elements.Direccion.value = visit.Direccion || '';
        if (createForm.elements.Motivo && visit.Motivo) createForm.elements.Motivo.value = visit.Motivo;
      }
      return;
    }
  });

  createForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(createForm));
    payload.Responsable = OPERATOR_RESPONSIBLE;
    if (!payload.SolicitudId || !payload.FechaHoraVisita) {
      feedback(container.querySelector('[data-visit-create-feedback]'), 'Completá los campos obligatorios.', 'error');
      return;
    }
    try {
      feedback(container.querySelector('[data-visit-create-feedback]'), 'Programando visita…', 'info');
      await createVisit(payload);
      showToast('success', `Visita creada para la solicitud #${payload.SolicitudId}.`);
      feedback(container.querySelector('[data-visit-create-feedback]'), 'Visita programada.', 'success');
      createForm.reset();
      createCard.hidden = true;
      await refresh.visits();
    } catch (error) {
      feedback(container.querySelector('[data-visit-create-feedback]'), error.message || 'No se pudo programar la visita.', 'error');
    }
  });

  updateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(updateForm));
    payload.Responsable = OPERATOR_RESPONSIBLE;
    if (!payload.VisitaId || !payload.FechaHoraVisita) {
      feedback(container.querySelector('[data-visit-update-feedback]'), 'Completá los campos obligatorios.', 'error');
      return;
    }
    try {
      feedback(container.querySelector('[data-visit-update-feedback]'), 'Actualizando…', 'info');
      await updateVisit(payload.VisitaId, payload);
      showToast('info', `Visita #${payload.VisitaId} reprogramada.`);
      feedback(container.querySelector('[data-visit-update-feedback]'), 'Visita actualizada.', 'success');
      await refresh.visits();
    } catch (error) {
      feedback(container.querySelector('[data-visit-update-feedback]'), error.message || 'No se pudo reprogramar la visita.', 'error');
    }
  });

  cancelBtn?.addEventListener('click', async () => {
    const id = updateForm.elements.VisitaId.value;
    const motivo = updateForm.elements.Motivo.value;
    if (!id) {
      feedback(container.querySelector('[data-visit-update-feedback]'), 'Indicá el ID de la visita.', 'error');
      return;
    }
    try {
      feedback(container.querySelector('[data-visit-update-feedback]'), 'Cancelando visita…', 'info');
      await cancelVisit(id, { Motivo: motivo });
      showToast('warning', `Visita #${id} cancelada.`);
      feedback(container.querySelector('[data-visit-update-feedback]'), 'Visita cancelada.', 'success');
      updateForm.reset();
      await refresh.visits();
    } catch (error) {
      feedback(container.querySelector('[data-visit-update-feedback]'), error.message || 'No se pudo cancelar la visita.', 'error');
    }
  });
}

function attachSummaryNavigation(container, state, goToTab) {
  container.querySelectorAll('[data-summary-panel]').forEach((panel) => {
    panel.addEventListener('click', (event) => {
      const item = event.target.closest('[data-summary-goto]');
      if (!item) return;
      const tab = item.dataset.summaryGoto;
      const id = item.dataset.summaryId;
      goToTab(tab);
      if (tab === 'animales') {
        state.selectedAnimalId = id;
        const animalsPanel = container.ownerDocument.querySelector('[data-tab-panel="animales"]');
        renderAnimalDetail(state, animalsPanel);
        renderAnimals(state, animalsPanel);
        // Además de resaltar en la grilla, abrir la ficha (overlay)
        try {
          setTimeout(() => {
            const btn = animalsPanel?.querySelector(`[data-action="view"][data-id="${id}"]`);
            if (btn) btn.click();
          }, 0);
        } catch {}
      } else if (tab === 'solicitudes') {
        state.selectedSolicitudId = id;
        renderSolicitudes(state, container.ownerDocument.querySelector('[data-tab-panel="solicitudes"]'));
        renderSolicitudDetail(state, container.ownerDocument.querySelector('[data-tab-panel="solicitudes"]'));
      } else if (tab === 'seguimientos') {
        state.selectedFollowupId = id;
        const followupsPanel = container.ownerDocument.querySelector('[data-tab-panel="seguimientos"]');
        renderSeguimientos(state, followupsPanel);
        const seg = state.followups.find((item) => String(item.Id) === String(id));
        try {
          const followupRow = followupsPanel?.querySelector(`[data-seg-row][data-id="${id}"]`);
          if (followupRow) {
            followupRow.classList.add('is-selected');
            setTimeout(() => followupRow.classList.remove('is-selected'), 1600);
          }
          followupsPanel?.showFollowupDetail?.(seg);
        } catch {}
      } else if (tab === 'visitas') {
        renderVisitas(state, container.ownerDocument.querySelector('[data-tab-panel="visitas"]'));
        try {
          const row = container.ownerDocument.querySelector('[data-tab-panel="visitas"] [data-visitas-table]');
          const hit = row?.querySelector(`tr[data-id="${id}"]`);
          if (hit) { hit.classList.add('is-selected'); setTimeout(()=>hit.classList.remove('is-selected'), 1500); }
        } catch {}
      }
    });
  });
}

export default function renderDashboardOperator(container) {
  const state = {
    currentTab: TAB_ORDER[0],
    animals: [],
    solicitudes: [],
    followups: [],
    visits: [],
    selectedAnimalId: null,
    selectedSolicitudId: null,
    selectedFollowupId: null,
    solicitudSearch: ''
  };

  buildBaseLayout(container);
  const animalsPanel = container.querySelector('[data-tab-panel="animales"]');
  const solicitudesPanel = container.querySelector('[data-tab-panel="solicitudes"]');
  const seguimientosPanel = container.querySelector('[data-tab-panel="seguimientos"]');
  const visitasPanel = container.querySelector('[data-tab-panel="visitas"]');
  const summaryAside = container.querySelector('[data-operator-summary]');

  buildAnimalsPanel(animalsPanel);
  buildSolicitudesPanel(solicitudesPanel);
  buildSeguimientosPanel(seguimientosPanel);
  buildVisitasPanel(visitasPanel);

  // Botón utilitario: preparar carpetas de fotos por animal
  try {
    const mediaBtn = animalsPanel?.querySelector('[data-media-sync]');
    const mediaFb = animalsPanel?.querySelector('[data-media-sync-fb]');
    mediaBtn?.addEventListener('click', async () => {
      if (!mediaBtn) return;
      mediaBtn.disabled = true;
      if (mediaFb) mediaFb.textContent = 'Creando carpetas...';
      try {
        const resp = await fetch('/api/media/animals/sync', { method: 'POST', credentials: 'include' });
        const data = await resp.json().catch(()=>({}));
        if (!resp.ok) throw new Error(data?.message || 'No se pudo crear');
        const msg = `Listo: ${data.created||0} nuevas, ${data.existing||0} existentes`;
        if (mediaFb) mediaFb.textContent = msg;
        showToast('success', data?.message || msg);
      } catch (e) {
        const m = e?.message || 'Error al crear carpetas';
        if (mediaFb) mediaFb.textContent = m;
        showToast('error', m);
      } finally {
        mediaBtn.disabled = false;
      }
    });
  } catch {}

  const goToTab = (tab) => {
    state.currentTab = tab;
    container.querySelectorAll('[data-tab-target]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tabTarget === tab);
    });
    container.querySelectorAll('[data-tab-panel]').forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.tabPanel === tab);
    });
  };

  setupTabSwitching(container, state);
  setupSummaryTabs(summaryAside);

  let animalsReloadInFlight = null;
  const renderCurrentAnimals = () => updateAnimalViews(state, animalsPanel, summaryAside, container);
  const refreshAnimalsList = async () => {
    let fallbackReloaded = false;
    try {
      state.animals = await getAllPets();
    } catch {
      fallbackReloaded = true;
      state.animals = await reloadPets();
    }
    renderCurrentAnimals();
    if (fallbackReloaded || animalsReloadInFlight) return;
    animalsReloadInFlight = reloadPets()
      .then((latest) => {
        if (Array.isArray(latest) && latest.length) {
          state.animals = latest;
          renderCurrentAnimals();
        }
      })
      .catch(() => {})
      .finally(() => {
        animalsReloadInFlight = null;
      });
  };

  const refresh = {
    animals: refreshAnimalsList,
    solicitudes: async () => {
      state.solicitudes = await listAllApplications();
      renderSolicitudes(state, solicitudesPanel);
      renderSolicitudDetail(state, solicitudesPanel);
      renderSummary(state, summaryAside);
      try { enhanceSummaryFollowups(state, summaryAside); } catch {}
      renderStats(state, container);
    },
    followups: async () => {
      state.followups = await listAllFollowUps();
      renderSeguimientos(state, seguimientosPanel);
      renderSummary(state, summaryAside);
      try { enhanceSummaryFollowups(state, summaryAside); } catch {}
    },
    visits: async () => {
      state.visits = await listAllVisits();
      renderVisitas(state, visitasPanel);
      renderSummary(state, summaryAside);
      try { enhanceSummaryFollowups(state, summaryAside); } catch {}
    }
  };

  attachAnimalEvents(animalsPanel, state, refresh);
  attachSolicitudesEvents(solicitudesPanel, state, refresh, goToTab);
  attachFollowupsEvents(seguimientosPanel, state, refresh);
  attachVisitsEvents(visitasPanel, state, refresh);
  attachSummaryNavigation(summaryAside, state, goToTab);

  (async () => {
    try {
      const results = await Promise.allSettled([
        refresh.animals(),
        refresh.solicitudes(),
        refresh.followups(),
        refresh.visits()
      ]);
      if (results.some((result) => result.status === 'rejected')) {
        showToast('info', 'Cargamos el panel en modo parcial por una caída temporal del API.');
      }
    } catch (error) {
      showToast('error', error.message || 'No se pudieron cargar los datos del panel.');
    }
  })();

  // Si llega la lista real desde el servicio (revalidación), refrescar animales
  try {
    window.addEventListener('pets:updated', async () => {
      try { await refresh.animals(); } catch {}
    });
  } catch {}

  return () => {};
}

// Post-procesa el panel de "Seguimientos" en el resumen lateral para mostrar icono y tipo
  function enhanceSummaryFollowups(state, aside) {
  const panel = aside?.querySelector('[data-summary-panel="seguimientos"]');
    if (!panel) return;
    const latest = sortByDateDesc(state.followups, 'FechaSeguimiento').slice(0, 3);
    if (!latest.length) return;
    panel.innerHTML = latest.map((seg) => {
    const solicitud = state.solicitudes.find((s) => Number(s.Id) === Number(seg.SolicitudId));
    let animalNombre = solicitud?.AnimalNombre || '';
    let animalId = solicitud?.AnimalId;
    const segAnimalId = seg.AnimalId || seg.AnimalID || seg.IdAnimal;
    if (!animalId && segAnimalId) animalId = segAnimalId;
    if (!animalNombre && animalId) {
      const found = (state.animals || []).find((a) => Number(a.Id) === Number(animalId));
      if (found) animalNombre = found.Nombre;
    }
    if (!animalNombre && seg.AnimalNombre) animalNombre = seg.AnimalNombre;
    const tipo = seg.TipoSeguimiento || 'Administrativo';
    const icon = tipo === 'Veterinario' ? '🩺' : (tipo === 'Domiciliario' ? '🏠' : '📋');
    return `
      <button type="button" class="summary-item" data-summary-goto="seguimientos" data-summary-id="${seg.Id}">
        <span class="summary-icon">${icon}</span>
        <div>
          <strong>${animalNombre || 'Seguimiento'}</strong>
          <p>${tipo} - ${seg.EstadoSeguimiento || 'Activo'} - ${formatDate(seg.FechaSeguimiento)}</p>
        </div>
        ${badge(seg.EstadoSeguimiento || 'Activo', 'seguimiento')}
      </button>
    `;
  }).join('');
  }


  // Ensure animals datalist is populated for the Animal selector
  try { populateAnimalsDatalist(state, container); } catch {}




