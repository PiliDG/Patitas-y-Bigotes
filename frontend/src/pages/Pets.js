import { getAllPets, searchPets } from '../services/petsService.js';
import { normalizeImageSrc } from '../utils/image.js';
import { navigateTo } from '../router.js';

const PAGE_SIZE = 9;

function sizeLabel(weight) {
  if (weight === null || weight === undefined) return 'TamaÃ±o desconocido';
  if (weight <= 8) return 'PequeÃ±o';
  if (weight <= 20) return 'Mediano';
  return 'Grande';
}

function availabilityBadge(pet) {
  const health = (pet.EstadoSalud || '').toLowerCase();
  const req = (pet.EstadoSolicitud || '').toLowerCase();
  // Mostrar siempre "Apto para adopción" en la grilla cuando el back indica Disponible
  if (health.includes('apto') && !health.includes('no apto')) return 'Apto para adopciÃ³n';
  if (req.includes('disponible')) return 'Apto para adopciÃ³n';
  if (health.includes('tratamiento')) return 'En tratamiento';
  if (health.includes('no apto')) return 'No apto';
  return pet.EstadoSalud || 'Pendiente de Control';
}


// Helpers to show Species · Breed consistently in cards
function speciesOf(pet) {
  const e = (pet.Especie || '').toString().trim().toLowerCase();
  if (e) {
    if (e.includes('gat')) return 'Gato';
    if (e.includes('perr')) return 'Perro';
    if (e.includes('otro')) return 'Otro';
    return 'Otro';
  }
  const mix = (String(pet.Raza || '') + ' ' + String(pet.EspecieRaza || '') + ' ' + String(pet.Descripcion || '')).toLowerCase();
  if (/gato|michi|siam|persa|maine|ragdoll|bengal|angora|manx|sphynx/.test(mix)) return 'Gato';
  if (/conejo|cuy|ave|p[aá]jaro|tortuga|pez|hur[oó]n|caballo|h[aá]mster|loro|canario/.test(mix)) return 'Otro';
  return 'Perro';
}

function breedOf(pet) {
  const r = (pet.Raza || '').toString().trim();
  if (r) return r;
  const er = (pet.EspecieRaza || '').toString().trim();
  if (!er) return '';
  const sp = speciesOf(pet).toLowerCase();
  return er.toLowerCase().startsWith(sp) ? er.slice(sp.length).trim() : er;
}

function petCard(pet) {
  let imgSrc = normalizeImageSrc(pet.Foto);
  let onErr = "this.onerror=null;this.src='https://via.placeholder.com/320x220?text=Patitas+y+Bigotes';";
  if (!imgSrc && String(pet.Id) === '2') {
    // Luna: intentar JPG y caer a PNG si no existe
    imgSrc = '/api/media/animals/2/2luna1.jpg';
    onErr = "this.onerror=null;this.src='/api/media/animals/2/2luna1.png'";
  }
  imgSrc = imgSrc || 'https://via.placeholder.com/320x220?text=Patitas+y+Bigotes';
  return `
    <article class="pet-card" data-open-pet="${pet.Id}">
      <div class="pet-card__media">
        <img src="${imgSrc}" alt="${pet.Nombre || 'Mascota'}" onerror="${onErr}" />
      </div>
      <div class="pet-card__body">
        <h3>${pet.Nombre || 'Mascota sin nombre'}</h3>
        <p class="pet-meta">${speciesOf(pet)}${breedOf(pet) ? ' · ' + breedOf(pet) : ''} · ${pet.Edad || 'Edad desconocida'} años · ${sizeLabel(pet.Peso)}</p>
        <span class="badge">${availabilityBadge(pet)}</span>
        <p class="pet-description">${pet.Descripcion || 'ConocÃ© mÃ¡s en la ficha completa.'}</p>
        <button type="button" class="btn-secondary">Ver detalle</button>
      </div>
    </article>
  `;
}

function template() {
  return `
    <section class="pets-header">
      <h1>Nuestras Mascotas</h1>
      <p>AplicÃ¡ filtros para encontrar a tu compañera ideal entre las mascotas listas para adoptar.</p>
    </section>
    <section class="tab-panel" data-panel="available">
      <div class="filter-bar" data-filter-bar>
        <div class="filter" data-key="sexo">
          <button type="button" class="filter-trigger" data-open="sexo">Sexo: <span data-label>Cualquiera</span></button>
          <div class="filter-menu" data-menu="sexo">
            <button type="button" data-option="">Cualquiera</button>
            <button type="button" data-option="macho">Macho</button>
            <button type="button" data-option="hembra">Hembra</button>
            <button type="button" class="filter-clear" data-clear>Limpiar filtros</button>
          </div>
        </div>
        <div class="filter" data-key="estado" style="display:none">
          <button type="button" class="filter-trigger" data-open="estado">Estado: <span data-label>Cualquiera</span></button>
          <div class="filter-menu" data-menu="estado">
            <button type="button" data-option="">Cualquiera</button>
            <button type="button" data-option="Apto para adopciÃ³n">Apto para adopciÃ³n</button>
            <button type="button" data-option="En tratamiento">En tratamiento</button>
            <button type="button" data-option="Pendiente de control">Pendiente de control</button>
            <button type="button" data-option="No apto para adopciÃ³n">No apto para adopciÃ³n</button>
            <button type="button" class="filter-clear" data-clear>Limpiar filtros</button>
          </div>
        </div>
        <div class="filter" data-key="tamano">
          <button type="button" class="filter-trigger" data-open="tamano">TamaÃ±o: <span data-label>Cualquiera</span></button>
          <div class="filter-menu" data-menu="tamano">
            <button type="button" data-option="">Cualquiera</button>
            <button type="button" data-option="PequeÃ±o">PequeÃ±o</button>
            <button type="button" data-option="Mediano">Mediano</button>
            <button type="button" data-option="Grande">Grande</button>
            <button type="button" class="filter-clear" data-clear>Limpiar filtros</button>
          </div>
        </div>
        <div class="filter" data-key="edad">
          <button type="button" class="filter-trigger" data-open="edad">Edad: <span data-label>Cualquiera</span></button>
          <div class="filter-menu" data-menu="edad">
            <button type="button" data-range="">Cualquiera</button>
            <button type="button" data-range="0-2">0-2 aÃ±os</button>
            <button type="button" data-range="3-7">3-7 aÃ±os</button>
            <button type="button" data-range="8-30">8+ años</button>
            <button type="button" class="filter-clear" data-clear>Limpiar filtros</button>
          </div>
        </div>
      </div>
      <!-- Formulario anterior oculto (se mantiene para compatibilidad) -->
      <form class="filters hidden" data-filter-form>
        <fieldset>
          <legend>Filtros</legend>
          <div class="filters-grid">
            <label>
              <span>Especie</span>
              <input name="especie" type="text" placeholder="Perro, gato..." />
            </label>
            <label>
              <span>Raza</span>
              <input name="raza" type="text" placeholder="Cruza, mestizo..." />
            </label>
            <label>
              <span>Sexo</span>
              <select name="sexo">
                <option value="">Cualquiera</option>
                <option value="macho">Macho</option>
                <option value="hembra">Hembra</option>
              </select>
            </label>
            <label hidden>
              <span>Estado sanitario</span>
              <select name="estado" disabled>
                <option value="">Cualquiera</option>
                <option value="Apto para adopciÃ³n">Apto para adopciÃ³n</option>
                <option value="En tratamiento">En tratamiento</option>
                <option value="Pendiente de control">Pendiente de control</option>
                <option value="No apto para adopciÃ³n">No apto para adopciÃ³n</option>
              </select>
            </label>
            <label>
              <span>Edad mÃ­nima</span>
              <input name="edadMin" type="number" min="0" placeholder="0" />
            </label>
            <label>
              <span>Edad mÃ¡xima</span>
              <input name="edadMax" type="number" min="0" placeholder="15" />
            </label>
            <label>
              <span>TamaÃ±o</span>
              <select name="tamano">
                <option value="">Cualquiera</option>
                <option value="PequeÃ±o">PequeÃ±o</option>
                <option value="Mediano">Mediano</option>
                <option value="Grande">Grande</option>
              </select>
            </label>
          </div>
          <div class="filter-actions">
            <button type="submit" class="btn-primary">Buscar</button>
            <button type="button" class="btn-link" data-reset>Limpiar filtros</button>
          </div>
        </fieldset>
      </form>
      <div class="results" data-results>
        <div class="result-empty hidden" data-empty>
          No se encontraron animales. ProbÃ¡ modificando los filtros o volvÃ© a intentarlo mÃ¡s tarde.
        </div>
        <div class="result-grid" data-grid></div>
        <div class="pagination" data-pagination></div>
      </div>
    </section>
  `;
}

export default function renderPets(container) {
  container.innerHTML = template();
  const filterForm = container.querySelector('[data-filter-form]');
  const filterBar = container.querySelector('[data-filter-bar]');
  const grid = container.querySelector('[data-grid]');
  const paginationEl = container.querySelector('[data-pagination]');
  const emptyState = container.querySelector('[data-empty]');

  let active = true;
  let availablePets = [];
  let currentResults = [];
  let currentPage = 1;

  const navigateToPetDetail = (rawId) => {
    const targetId = String(rawId || '').trim();
    if (!targetId) return;
    navigateTo(`/pets/${targetId}`);
  };

  const handleGridClick = (event) => {
    const source = event.target instanceof Element ? event.target : event.target?.parentElement;
    const card = source?.closest('[data-open-pet]');
    if (!card) return;
    event.preventDefault();
    navigateToPetDetail(card.dataset.openPet);
  };

  grid?.addEventListener('click', handleGridClick);

  const handlePaginationClick = (ev) => {
    const target = ev.target && ev.target.closest('[data-page]');
    if (!target || target.hasAttribute('disabled')) return;
    const totalPages = Math.ceil(currentResults.length / PAGE_SIZE) || 1;
    if (target.dataset.page === 'prev' && currentPage > 1) currentPage -= 1;
    if (target.dataset.page === 'next' && currentPage < totalPages) currentPage += 1;
    applyPagination();
    try {
      const header = container.querySelector('.pets-header');
      const top = header ? header.offsetTop : 0;
      window.scrollTo({ top, behavior: 'smooth' });
    } catch {}
  };

  paginationEl?.addEventListener('click', handlePaginationClick);

  // Criterio para listado: mostrar casi todos salvo bajas/adoptados explÃ­citos.
  // Permitimos "reservado" y "no disponible" para que la grilla no quede vacÃ­a.
  function isPublicVisible(pet) {
    const state = (pet.EstadoSolicitud || '').toLowerCase();
    const health = (pet.EstadoSalud || '').toLowerCase();
    const hasHome = !!(pet.Resultado && String(pet.Resultado).trim());
    const notVisible = state === 'baja' || health.includes('no apto') || hasHome;
    return !notVisible;
  }

  function applyPagination() {
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = currentResults.slice(start, start + PAGE_SIZE);
  grid.innerHTML = pageItems.map((pet) => petCard(pet)).join('');

    const totalPages = Math.ceil(currentResults.length / PAGE_SIZE) || 1;
    const controls = [];
    if (totalPages > 1) {
      controls.push(`<button type="button" class="btn-secondary" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>`);
      controls.push(`<span class="page-indicator">PÃ¡gina ${currentPage} de ${totalPages}</span>`);
      controls.push(`<button type="button" class="btn-secondary" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente</button>`);
    }
    paginationEl.innerHTML = controls.join('');
  }

  function updateResults(list) {
    currentResults = list;
    currentPage = 1;
    if (!list.length) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      paginationEl.innerHTML = '';
      return;
    }
    emptyState.classList.add('hidden');
    applyPagination();
  }

  function filterBySize(pets, size) {
    if (!size) return pets;
    return pets.filter((pet) => sizeLabel(pet.Peso) === size);
  }
  
  // Mascotas aptas para adopciÃ³n (robusto ante variantes de datos)
  function isAdoptable(pet) {
    const h = (pet.EstadoSalud || '').toLowerCase();
    const s = (pet.EstadoSolicitud || '').toLowerCase();
    const hasHome = !!(pet.Resultado && String(pet.Resultado).trim());
    // CondiciÃ³n principal: indica aptitud sanitaria explÃ­cita
    const explicitApto = h.includes('apto') && !h.includes('no apto');
    // Alternativa: backend marca disponibilidad en EstadoSolicitud
    const bySolicitud = s.includes('disponible');
    // Alternativa amplia: sin dato sanitario pero tampoco reservado/no disponible/baja ni adoptado
    const noRestrictions = !h && !hasHome && !['reservado','no disponible','baja'].includes(s);
    return explicitApto;
  }

  async function loadInitial() {
    grid.innerHTML = '<p class="pending-text">Cargando mascotas...</p>';
    try {
      const all = await getAllPets();
      if (!active) return;
      // Mostrar amplio: visibles por estado general; si aÃºn queda muy poco, no aplicar filtro de aptitud
      let list = all.filter(isPublicVisible);
      const strict = list.filter(isAdoptable);
      availablePets = strict;
      updateResults(availablePets);
    } catch (error) {
      grid.innerHTML = `<p class="error-text">No pudimos cargar las mascotas. ${error.message || ''}</p>`;
    }
  }

  if (filterForm) filterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(filterForm);
    grid.innerHTML = '<p class="pending-text">Buscando animales...</p>';
    paginationEl.innerHTML = '';
    emptyState.classList.add('hidden');
    try {
      const filters = {
        especie: formData.get('especie'),
        sexo: formData.get('sexo'),
        edadMin: formData.get('edadMin'),
        edadMax: formData.get('edadMax'),
        q: formData.get('q') || formData.get('raza')
      };
      const size = formData.get('tamano');
      const results = await searchPets(filters);
      {
        const visible = results.filter(isPublicVisible);
        const strict = visible.filter(isAdoptable);
        const base = strict.length >= 9 ? strict : visible;
        const filtered = filterBySize(base, size);
        updateResults(filtered);
        return;
      }
      if (!filtered.length) {
        emptyState.innerHTML = 'No se encontraron animales. ProbÃ¡ con otra combinaciÃ³n de filtros o reducÃ­ las restricciones.';
        emptyState.classList.remove('hidden');
      }
    } catch (error) {
      const message = error.message || 'Error desconocido';
      if (message.includes('Formato') || error.status === 400) {
        emptyState.innerHTML = 'Formato de bÃºsqueda incorrecto';
      } else if (message.includes('No se encontraron animales') || error.status === 404) {
        emptyState.innerHTML = 'No se encontraron animales. ProbÃ¡ con otra combinaciÃ³n de filtros o reducÃ­ las restricciones.';
      } else {
        emptyState.innerHTML = `No pudimos buscar mascotas. ${message}`;
      }
      emptyState.classList.remove('hidden');
      grid.innerHTML = '';
    }
  });

  if (filterForm) {
    const resetBtn = container.querySelector('[data-reset]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        filterForm.reset();
        updateResults(availablePets);
      });
    }
  }

  // MenÃºs de filtros horizontales
  const state = { sexo: '', tamano: '', edadMin: '', edadMax: '' };

  function setLabel(key, text) {
    const filter = filterBar?.querySelector(`[data-key="${key}"]`);
    const span = filter && filter.querySelector('[data-label]');
    if (span) span.textContent = text || 'Cualquiera';
  }

  function closeAllMenus() {
    filterBar?.querySelectorAll('.filter-menu').forEach((m) => m.classList.remove('is-open'));
  }
  function openMenu(name) {
    closeAllMenus();
    const menu = filterBar?.querySelector(`[data-menu="${name}"]`);
    if (menu) menu.classList.add('is-open');
  }
  // Close open filter menus when clicking outside (clean up on unmount)
  const onDocClick = (e) => {
    if (filterBar && !filterBar.contains(e.target)) closeAllMenus();
  };
  document.addEventListener('click', onDocClick);
  filterBar?.querySelectorAll('[data-open]')?.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = btn.dataset.open;
      const menu = filterBar.querySelector(`[data-menu="${name}"]`);
      const isOpen = menu && menu.classList.contains('is-open');
      closeAllMenus();
      if (!isOpen) openMenu(name);
    });
  });

  async function runSearch() {
    const hasAny = !!(state.sexo || state.edadMin || state.edadMax || state.tamano);
    if (!hasAny) { updateResults(availablePets); return; }
    grid.innerHTML = '<p class="pending-text">Buscando animales...</p>';
    paginationEl.innerHTML = '';
    emptyState.classList.add('hidden');
    try {
      const filters = { especie: '', sexo: state.sexo, edadMin: state.edadMin, edadMax: state.edadMax };
      const results = await searchPets(filters);
      const visible = results.filter(isPublicVisible);
      const strict = visible.filter(isAdoptable);
      const base = strict.length >= 9 ? strict : visible;
      const filtered = filterBySize(base, state.tamano);
      updateResults(filtered);
      if (!filtered.length) {
        emptyState.innerHTML = 'No se encontraron animales. ProbÃ¡ con otra combinaciÃ³n de filtros o reducÃ­ las restricciones.';
        emptyState.classList.remove('hidden');
      }
    } catch (error) {
      const message = error.message || 'Error desconocido';
      emptyState.innerHTML = `No pudimos buscar mascotas. ${message}`;
      emptyState.classList.remove('hidden');
      grid.innerHTML = '';
    }
  }

  filterBar?.querySelectorAll('[data-menu="sexo"] [data-option]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.option || '';
      state.sexo = state.sexo === val ? '' : val;
      setLabel('sexo', state.sexo || 'Cualquiera');
      runSearch();
    });
  });
  // filtro 'estado' eliminado
  filterBar?.querySelectorAll('[data-menu="tamano"] [data-option]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.option || '';
      state.tamano = state.tamano === val ? '' : val;
      setLabel('tamano', state.tamano || 'Cualquiera');
      runSearch();
    });
  });
  filterBar?.querySelectorAll('[data-menu="edad"] [data-range]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.range || '';
      if (!val) { state.edadMin = state.edadMax = ''; setLabel('edad', 'Cualquiera'); runSearch(); return; }
      const [a,b] = val.split('-');
      const min = a ? parseInt(a,10) : '';
      const max = b ? parseInt(b,10) : '';
      if (String(state.edadMin) === String(min) && String(state.edadMax) === String(max)) {
        state.edadMin = state.edadMax = '';
        setLabel('edad', 'Cualquiera');
      } else {
        state.edadMin = min || '';
        state.edadMax = max || '';
        setLabel('edad', `${val} aÃ±os`);
      }
      runSearch();
    });
  });
  filterBar?.querySelectorAll('[data-clear]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.sexo = state.tamano = '';
      state.edadMin = state.edadMax = '';
      setLabel('sexo'); setLabel('tamano'); setLabel('edad');
      closeAllMenus();
      runSearch();
    });
  });

  loadInitial();

  // Si llega la lista real luego del fallback, refrescar sin bloquear la UI
  function onPetsUpdated() {
    if (!active) return;
    getAllPets()
      .then((all) => {
        if (!active) return;
        {
          const list = all.filter(isPublicVisible);
          const strict = list.filter(isAdoptable);
          availablePets = strict;
        }
        updateResults(availablePets);
      })
      .catch(() => {});
  }
  try { window.addEventListener('pets:updated', onPetsUpdated); } catch {}

  return () => {
    active = false;
    try { document.removeEventListener('click', onDocClick); } catch (_) {}
    try { window.removeEventListener('pets:updated', onPetsUpdated); } catch {}
  };
}

