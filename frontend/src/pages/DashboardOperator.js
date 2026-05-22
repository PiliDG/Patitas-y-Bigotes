import { createPet, updatePet, deactivatePet } from '../services/petsService.js';
import { setUnderReview, approveApplication, rejectApplication, voidApplication } from '../services/adoptionsService.js';
import { createVisit, updateVisit, cancelVisit } from '../services/visitsService.js';
import { createFollowUp, updateFollowUp, cancelFollowUp } from '../services/followupsService.js';
import { showToast } from '../components/Toast.js';
import { listAllApplications } from '../services/adoptionsService.js';
import { listAllFollowUps } from '../services/followupsService.js';
import { getAllPets } from '../services/petsService.js';

function feedback(form, message, type = 'info') {
  const box = form.querySelector('.form-feedback');
  if (box) {
    box.innerHTML = `<p class="${type === 'error' ? 'error-text' : type === 'success' ? 'success-text' : 'pending-text'}">${message}</p>`;
  }
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

function animalsSection() {
  return `
    <section class="dashboard-card">
      <h2>Animales (Alta / Modificación / Baja)</h2>
      <div class="operator-grid">
        <form data-animal-alta class="operator-form" novalidate>
          <h3>Alta de animal</h3>
          <label class="col-3"><span>Nombre</span><input name="Nombre" /></label>
          <label><span>Descripción</span><textarea name="Descripcion"></textarea></label>
          <div class="col-3">
            <span>Especie y raza</span>
            <div class="species-row" data-species-row>
              <button type="button" class="chip" data-species="Gato">Gato</button>
              <button type="button" class="chip" data-species="Perro">Perro</button>
              <select data-breed-select aria-label="Raza"></select>
            </div>
            <input name="EspecieRaza" placeholder="Ej.: Perro Ovejero" />
          </div>
          <label class="col-2"><span>Sexo</span>
            <select name="Sexo">
              <option value="macho">Macho</option>
              <option value="hembra">Hembra</option>
            </select>
          </label>
          <label class="col-2"><span>Fecha de ingreso</span><input name="FechaIngreso" type="date" /></label>
          <label class="col-3"><span>Origen</span><input name="Origen" /></label>
          <label class="col-2"><span>Peso (kg)</span><input name="Peso" type="number" step="0.1" /></label>
          <label><span>Edad (años)</span><input name="Edad" type="number" /></label>
          <div class="col-3">
            <span>Foto</span>
            <div class="uploader" data-uploader>
              <input type="file" accept="image/*" data-foto-file />
              <input type="hidden" name="Foto" />
              <div class="uploader-drop" aria-label="Arrastrá una imagen o pegala">
                <p class="muted">Pegá o arrastrá una imagen aquí</p>
                <img alt="Vista previa" data-foto-preview style="display:none; max-height:120px; border-radius:8px;" />
              </div>
            </div>
          </div>
          <label class="hidden" data-duplicate>
            <input type="checkbox" name="ConfirmarDuplicado" value="1" /> Confirmar posible duplicado
          </label>
          <button type="submit" class="btn-primary">Dar de alta</button>
          <div class="form-feedback" aria-live="polite"></div>
        </form>
        <form data-animal-mod class="operator-form" novalidate>
          <h3>Modificar animal</h3>
          <label class="col-2"><span>ID</span><input name="AnimalId" type="number" /></label>
          <label class="col-3"><span>Nombre</span><input name="Nombre" /></label>
          <div class="col-3">
            <span>Foto (opcional)</span>
            <div class="uploader" data-uploader-mod>
              <input type="file" accept="image/*" data-foto-file />
              <input type="hidden" name="Foto" />
              <div class="uploader-drop" aria-label="Arrastrá una imagen o pegala">
                <p class="muted">Pegá o arrastrá una imagen aquí</p>
                <img alt="Vista previa" data-foto-preview style="display:none; max-height:120px; border-radius:8px;" />
              </div>
            </div>
          </div>
          <label class="hidden" data-duplicate>
            <input type="checkbox" name="ConfirmarDuplicado" value="1" /> Confirmar posible duplicado
          </label>
          <button type="submit" class="btn-secondary">Actualizar</button>
          <div class="form-feedback" aria-live="polite"></div>
        </form>
        <form data-animal-baja class="operator-form" novalidate>
          <h3>Baja lógica</h3>
          <label class="col-2"><span>ID</span><input name="AnimalId" type="number" /></label>
          <button type="submit" class="btn-tertiary">Dar de baja</button>
          <div class="form-feedback" aria-live="polite"></div>
        </form>
      </div>
    </section>
  `;
}

function solicitudesSection() {
  return `
    <section class="dashboard-card">
      <h2>Gestión de solicitudes</h2>
      <form data-solicitudes class="operator-form inline" novalidate>
        <label><span>ID Solicitud</span><input name="SolicitudId" type="number" required /></label>
        <div class="action-row">
          <button type="button" class="btn-secondary" data-action="revision">Poner en revisión</button>
          <button type="button" class="btn-secondary" data-action="aprobar">Aprobar</button>
          <button type="button" class="btn-tertiary" data-action="rechazar">Rechazar</button>
          <button type="button" class="btn-tertiary" data-action="anular">Anular</button>
        </div>
        <label><span>Motivo / Comentarios</span><input name="Motivo" /></label>
        <div class="form-feedback" aria-live="polite"></div>
      </form>
    </section>
  `;
}

function visitasSection() {
  return `
    <section class="dashboard-card">
      <h2>Visitas</h2>
      <form data-visita-alta class="operator-form inline" novalidate>
        <label><span>ID Solicitud</span><input name="SolicitudId" type="number" /></label>
        <label><span>Fecha y hora</span><input name="FechaHoraVisita" type="datetime-local" /></label>
        <button type="submit" class="btn-primary">Programar</button>
        <div class="form-feedback" aria-live="polite"></div>
      </form>
      <form data-visita-mod class="operator-form inline" novalidate>
        <label><span>ID Visita</span><input name="VisitaId" type="number" /></label>
        <label><span>Nueva fecha y hora</span><input name="FechaHoraVisita" type="datetime-local" /></label>
        <button type="submit" class="btn-secondary">Reprogramar</button>
        <div class="form-feedback" aria-live="polite"></div>
      </form>
      <form data-visita-cancel class="operator-form inline" novalidate>
        <label><span>ID Visita</span><input name="VisitaId" type="number" /></label>
        <label><span>Motivo</span><input name="Motivo" /></label>
        <button type="submit" class="btn-tertiary">Cancelar visita</button>
        <div class="form-feedback" aria-live="polite"></div>
      </form>
    </section>
  `;
}

function seguimientosSection() {
  return `
    <section class="dashboard-card">
      <h2>Seguimientos</h2>
      <form data-seg-alta class="operator-form inline" novalidate>
        <label><span>ID Solicitud</span><input name="SolicitudId" type="number" /></label>
        <label><span>Fecha</span><input name="FechaSeguimiento" type="date" /></label>
        <label class="full"><span>Observaciones</span><textarea name="Observaciones" rows="2"></textarea></label>
        <button type="submit" class="btn-primary">Crear seguimiento</button>
        <div class="form-feedback" aria-live="polite"></div>
      </form>
      <form data-seg-mod class="operator-form inline" novalidate>
        <label><span>ID Seguimiento</span><input name="SeguimientoId" type="number" /></label>
        <label class="full"><span>Observaciones</span><textarea name="Observaciones" rows="2"></textarea></label>
        <button type="submit" class="btn-secondary">Actualizar</button>
        <div class="form-feedback" aria-live="polite"></div>
      </form>
      <form data-seg-cancel class="operator-form inline" novalidate>
        <label><span>ID Seguimiento</span><input name="SeguimientoId" type="number" /></label>
        <label class="full"><span>Observaciones</span><textarea name="Observaciones" rows="2"></textarea></label>
        <button type="submit" class="btn-tertiary">Cancelar seguimiento</button>
        <div class="form-feedback" aria-live="polite"></div>
      </form>
    </section>
  `;
}

export default function renderDashboardOperator(container) {
  container.innerHTML = `
    <section class="dashboard-header">
      <h1>Panel Operador</h1>
      <p>Gestioná animales, solicitudes, visitas y seguimientos según los casos de uso definidos.</p>
    </section>
    ${animalsSection()}
    ${solicitudesSection()}
    ${visitasSection()}
    ${seguimientosSection()}
  `;

  // Reorganizar a dos columnas y preparar panel derecho
  try {
    const header = container.querySelector('.dashboard-header');
    const cards = Array.from(container.querySelectorAll('.dashboard-card'));
    const layout = document.createElement('section');
    layout.className = 'dashboard-operator';
    const left = document.createElement('div');
    left.className = 'operator-left';
    const right = document.createElement('aside');
    right.className = 'operator-right';
    right.setAttribute('aria-label', 'Solicitudes y seguimientos');
    const panel = document.createElement('div');
    panel.className = 'operator-panel';
    panel.innerHTML = `
      <h2 class="operator-panel__title">Resumen reciente</h2>
      <div class="operator-list" data-ops-list>
        <div class="operator-list__item is-skeleton"></div>
        <div class="operator-list__item is-skeleton"></div>
        <div class="operator-list__item is-skeleton"></div>
      </div>
      <p class="muted" data-ops-empty style="display:none">No hay solicitudes ni seguimientos recientes.</p>
    `;
    right.appendChild(panel);
    // Segundo panel: listado de animales
    const panelAnimals = document.createElement('div');
    panelAnimals.className = 'operator-panel';
    panelAnimals.innerHTML = `
      <h2 class="operator-panel__title">Animales</h2>
      <div class="operator-list" data-animals-list>
        <div class="operator-list__item is-skeleton"></div>
        <div class="operator-list__item is-skeleton"></div>
      </div>
      <p class="muted" data-animals-empty style="display:none">No hay animales cargados.</p>
    `;
    right.appendChild(panelAnimals);
    cards.forEach((node) => left.appendChild(node));
    layout.appendChild(left);
    layout.appendChild(right);
    header.insertAdjacentElement('afterend', layout);
  } catch {}

  // Cargar lista de solicitudes/seguimientos
  try {
    const listNode = container.querySelector('[data-ops-list]');
    const emptyNode = container.querySelector('[data-ops-empty]');
    (async () => {
      try {
        const [sols, segs] = await Promise.allSettled([
          listAllApplications(),
          listAllFollowUps()
        ]);
        const solicitudes = sols.status === 'fulfilled' ? (sols.value || []) : [];
        const seguimientos = segs.status === 'fulfilled' ? (segs.value || []) : [];
        const items = [];
        solicitudes.slice(0, 8).forEach((s) => {
          items.push({ tipo: 'Solicitud', id: s.Id, estado: s.EstadoSolicitud || '-', fecha: s.FechaSolicitud, detalle: `Animal #${s.AnimalId}` });
        });
        seguimientos.slice(0, 8).forEach((s) => {
          items.push({ tipo: 'Seguimiento', id: s.Id, estado: s.EstadoSeguimiento || '-', fecha: s.FechaSeguimiento, detalle: `Solicitud #${s.SolicitudId}` });
        });
        items.sort((a, b) => {
          const fa = a.fecha ? Date.parse(a.fecha) : 0;
          const fb = b.fecha ? Date.parse(b.fecha) : 0;
          return fb - fa;
        });
        if (!items.length) {
          if (listNode) listNode.innerHTML = '';
          if (emptyNode) emptyNode.style.display = '';
          return;
        }
        if (listNode) {
          listNode.innerHTML = items.slice(0, 12).map((it) => `
            <div class="operator-list__item">
              <div class="operator-list__meta">
                <span class="chip ${it.tipo === 'Solicitud' ? 'chip--blue' : 'chip--green'}">${it.tipo}</span>
                <span class="muted">#${it.id}</span>
              </div>
              <div class="operator-list__main">
                <strong>${it.estado}</strong>
                <span>${it.detalle}</span>
              </div>
              <div class="operator-list__date">${it.fecha ? new Date(it.fecha).toLocaleDateString() : ''}</div>
            </div>
          `).join('');
        }
      } catch (err) {
        if (listNode) listNode.innerHTML = '<p class="error-text">No se pudo cargar el resumen.</p>';
      }
    })();
  } catch {}

  // Cargar lista de animales con ID y nombre
  try {
    const listNode = container.querySelector('[data-animals-list]');
    const emptyNode = container.querySelector('[data-animals-empty]');
    (async () => {
      try {
        const animals = await getAllPets();
        if (!animals || !animals.length) {
          if (listNode) listNode.innerHTML = '';
          if (emptyNode) emptyNode.style.display = '';
          return;
        }
        const items = animals
          .slice(0, 20)
          .map((a) => `
            <div class="operator-list__item">
              <div class="operator-list__meta">
                <span class="chip chip--blue">Animal</span>
                <span class="muted">#${a.Id}</span>
              </div>
              <div class="operator-list__main">
                <strong>${a.Nombre || 'Sin nombre'}</strong>
                <span>${a.EspecieRaza || ''}</span>
              </div>
              <div class="operator-list__date">${a.FechaActualizacion ? new Date(a.FechaActualizacion).toLocaleDateString() : ''}</div>
            </div>
          `)
          .join('');
        if (listNode) listNode.innerHTML = items;
      } catch (err) {
        if (listNode) listNode.innerHTML = '<p class="error-text">No se pudo cargar la lista de animales.</p>';
      }
    })();
  } catch {}

  const altaForm = container.querySelector('[data-animal-alta]');
  // Ayudantes de especie/raza
  try {
    const breeds = {
      Gato: ['Mestizo', 'Siames', 'Persa', 'Bengala', 'Angora'],
      Perro: ['Mestizo', 'Labrador', 'Ovejero', 'Pitbull', 'Caniche']
    };
    const row = altaForm.querySelector('[data-species-row]');
    const select = altaForm.querySelector('[data-breed-select]');
    const inputER = altaForm.elements.EspecieRaza;
    let currentSpecies = 'Perro';
    function renderBreeds() {
      const list = breeds[currentSpecies] || [];
      select.innerHTML = list.map((b) => `<option value="${b}">${b}</option>`).join('');
      inputER.value = `${currentSpecies} ${select.value}`.trim();
    }
    row.querySelectorAll('[data-species]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentSpecies = btn.dataset.species;
        renderBreeds();
      });
    });
    select.addEventListener('change', () => {
      inputER.value = `${currentSpecies} ${select.value}`.trim();
    });
    renderBreeds();
  } catch {}

  // Uploader: file + paste + drag&drop -> base64 en input hidden Foto
  try {
    const uploader = altaForm.querySelector('[data-uploader]');
    const fileInput = uploader.querySelector('[data-foto-file]');
    const hidden = altaForm.elements.Foto;
    const preview = uploader.querySelector('[data-foto-preview]');
    const drop = uploader.querySelector('.uploader-drop');
    function readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    async function setImageFromFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const dataUrl = await readFile(file);
      hidden.value = dataUrl;
      if (preview) {
        preview.src = dataUrl;
        preview.style.display = '';
      }
    }
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      await setImageFromFile(file);
    });
    // Paste
    altaForm.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const file = it.getAsFile();
          await setImageFromFile(file);
          e.preventDefault();
          break;
        }
      }
    });
    // Drag & drop
    ;['dragenter','dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-hover'); }));
    ;['dragleave','drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-hover'); }));
    drop.addEventListener('drop', async (e) => {
      const file = e.dataTransfer?.files?.[0];
      await setImageFromFile(file);
    });
  } catch {}

  altaForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const nombre = form.elements.Nombre.value.trim();
    const foto = (form.elements.Foto.value || '').trim();
    if (!nombre) {
      feedback(form, 'Debe tener nombre', 'error');
      return;
    }
    if (!foto) {
      feedback(form, 'Debe adjuntar foto', 'error');
      return;
    }
    const payload = serialize(form);
    payload.ConfirmarDuplicado = form.querySelector('[name="ConfirmarDuplicado"]').checked ? '1' : '0';
    feedback(form, 'Registrando...', 'info');
    try {
      const response = await createPet(payload);
      const message = response?.message || 'El animal fue dado de alta';
      feedback(form, message, 'success');
      showToast('success', message);
      form.reset();
      form.querySelector('[data-duplicate]').classList.add('hidden');
    } catch (error) {
      const message = error.message || 'No se pudo dar de alta';
      feedback(form, message, 'error');
      if (message.includes('Posible duplicado')) {
        form.querySelector('[data-duplicate]').classList.remove('hidden');
      }
    }
  });

  const modForm = container.querySelector('[data-animal-mod]');  try {
    const uploader = modForm.querySelector('[data-uploader-mod]');
    const fileInput = uploader?.querySelector('[data-foto-file]');
    const hidden = modForm.elements.Foto;
    const preview = uploader?.querySelector('[data-foto-preview]');
    function readFile(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
    async function setImage(file){ if(!file||!file.type.startsWith('image/')) return; const dataUrl = await readFile(file); hidden.value = dataUrl; if(preview){ preview.src = dataUrl; preview.style.display=''; } }
    if (fileInput) fileInput.addEventListener('change', async () => { const f = fileInput.files && fileInput.files[0]; await setImage(f); });
    modForm.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items || [];
      for (const it of items) { if (it.type && it.type.startsWith('image/')) { await setImage(it.getAsFile()); e.preventDefault(); break; } }
    });
    const drop = uploader?.querySelector('.uploader-drop');
    if (drop){
      ['dragenter','dragover'].forEach((ev)=> drop.addEventListener(ev,(e)=>{ e.preventDefault(); drop.classList.add('is-hover'); }));
      ['dragleave','drop'].forEach((ev)=> drop.addEventListener(ev,(e)=>{ e.preventDefault(); drop.classList.remove('is-hover'); }));
      drop.addEventListener('drop', async (e)=>{ const f = e.dataTransfer?.files?.[0]; await setImage(f); });
    }
  } catch{}
  modForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.AnimalId.value;
    if (!id) {
      feedback(form, 'Ingresá un ID válido', 'error');
      return;
    }
    const payload = serialize(form);
    payload.ConfirmarDuplicado = form.querySelector('[name="ConfirmarDuplicado"]').checked ? '1' : '0';
    feedback(form, 'Actualizando...', 'info');
    try {
      const response = await updatePet(id, payload);
      const message = response?.message || 'Datos del animal actualizados';
      feedback(form, message, 'success');
      showToast('success', message);
      form.reset();
      form.querySelector('[data-duplicate]').classList.add('hidden');
    } catch (error) {
      const message = error.message || 'No se pudo actualizar';
      feedback(form, message, 'error');
      if (message.includes('Posible duplicado')) {
        form.querySelector('[data-duplicate]').classList.remove('hidden');
      }
    }
  });

  const bajaForm = container.querySelector('[data-animal-baja]');
  bajaForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.AnimalId.value;
    if (!id) {
      feedback(form, 'Ingresá un ID válido', 'error');
      return;
    }
    feedback(form, 'Procesando...', 'info');
    try {
      const response = await deactivatePet(id);
      const message = response?.message || 'El animal fue dado de baja';
      feedback(form, message, 'success');
      showToast('success', message);
      form.reset();
    } catch (error) {
      feedback(form, error.message || 'No se pudo dar de baja', 'error');
    }
  });

  const solForm = container.querySelector('[data-solicitudes]');
  solForm.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const id = solForm.elements.SolicitudId.value;
      const motivo = solForm.elements.Motivo.value;
      if (!id) {
        feedback(solForm, 'Ingresá el ID de la solicitud', 'error');
        return;
      }
      feedback(solForm, 'Procesando...', 'info');
      try {
        let response;
        if (action === 'revision') {
          response = await setUnderReview(id);
        } else if (action === 'aprobar') {
          response = await approveApplication(id);
        } else if (action === 'rechazar') {
          response = await rejectApplication(id, { Motivo: motivo });
        } else if (action === 'anular') {
          response = await voidApplication(id, { Motivo: motivo });
        }
        const message = response?.message || 'Operación realizada';
        feedback(solForm, message, 'success');
        showToast('success', message);
      } catch (error) {
        feedback(solForm, error.message || 'No se pudo completar la operación', 'error');
      }
    });
  });

  const visitaAlta = container.querySelector('[data-visita-alta]');
  visitaAlta.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = serialize(form);
    if (!payload.SolicitudId || !payload.FechaHoraVisita) {
      feedback(form, 'Completá los campos requeridos', 'error');
      return;
    }
    feedback(form, 'Programando...', 'info');
    try {
      const response = await createVisit(payload);
      const message = response?.message || 'Visita programada';
      feedback(form, message, 'success');
      showToast('success', message);
      form.reset();
    } catch (error) {
      feedback(form, error.message || 'No se pudo programar la visita', 'error');
    }
  });

  const visitaMod = container.querySelector('[data-visita-mod]');
  visitaMod.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.VisitaId.value;
    const fecha = form.elements.FechaHoraVisita.value;
    if (!id || !fecha) {
      feedback(form, 'Ingresá ID y fecha', 'error');
      return;
    }
    feedback(form, 'Reprogramando...', 'info');
    try {
      const response = await updateVisit(id, { FechaHoraVisita: fecha });
      const message = response?.message || 'Visita reprogramada';
      feedback(form, message, 'success');
      showToast('success', message);
      form.reset();
    } catch (error) {
      feedback(form, error.message || 'No se pudo reprogramar', 'error');
    }
  });

  const visitaCancel = container.querySelector('[data-visita-cancel]');
  visitaCancel.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.VisitaId.value;
    if (!id) {
      feedback(form, 'Ingresá el ID de la visita', 'error');
      return;
    }
    feedback(form, 'Cancelando...', 'info');
    try {
      const response = await cancelVisit(id, { Motivo: form.elements.Motivo.value });
      const message = response?.message || 'Visita cancelada';
      feedback(form, message, 'success');
      showToast('success', message);
      form.reset();
    } catch (error) {
      feedback(form, error.message || 'No se pudo cancelar', 'error');
    }
  });

  const segAlta = container.querySelector('[data-seg-alta]');
  segAlta.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = serialize(form);
    if (!payload.SolicitudId || !payload.FechaSeguimiento || !payload.Observaciones) {
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
    } catch (error) {
      feedback(form, error.message || 'No se pudo registrar el seguimiento', 'error');
    }
  });

  const segMod = container.querySelector('[data-seg-mod]');
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
    } catch (error) {
      const message = error.message || 'No se pudo actualizar';
      if (message.includes('Este seguimiento no puede ser modificado')) {
        feedback(form, 'Este seguimiento no puede ser modificado', 'error');
      } else {
        feedback(form, message, 'error');
      }
    }
  });

  const segCancel = container.querySelector('[data-seg-cancel]');
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
      const message = response?.message || 'Seguimiento cancelado';
      feedback(form, message, 'success');
      showToast('success', message);
      form.reset();
    } catch (error) {
      const message = error.message || 'No se pudo cancelar';
      if (message.includes('Este seguimiento no puede cancelarse')) {
        feedback(form, 'Este seguimiento no puede cancelarse', 'error');
      } else {
        feedback(form, message, 'error');
      }
    }
  });

  return () => {};
}




