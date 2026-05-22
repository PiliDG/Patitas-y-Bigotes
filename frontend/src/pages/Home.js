import { navigateTo } from '../router.js';
import { getAllPets } from '../services/petsService.js';
import { ROUTE_NAMES } from '../config.js';
import { normalizeImageSrc } from '../utils/image.js';
function createHeroSection() {
  return `
    <section class="home-hero">
      <div class="home-hero__copy">
        <span class="eyebrow">Adopciones con seguimiento real</span>
        <h1>Cambiá la vida de una mascota y sumate a una comunidad responsable.</h1>
        <p>
          En Patitas y Bigotes conectamos refugios, voluntariado y familias adoptantes con una plataforma segura. 
          Conocé historias reales, postulá y hacé seguimiento de cada paso.
        </p>
        <div class="hero-buttons">
          <button type="button" class="btn-primary" data-go-adopt>Adoptá</button>
          <button type="button" class="btn-secondary" data-go-pets>Ver mascotas</button>
        </div>
      </div>
      <div class="home-hero__visual" aria-hidden="true">
        <img class="hero-image" src="/assets/adoptá.png" alt="Adoptá responsablemente" loading="eager" decoding="async" />
        <div class="hero-card">
          <span class="badge">Lista para adoptar</span>
          <h3>Luna</h3>
          <p>Amorosa y compañera, convive con niños y otros animales.</p>
          <span class="chip">Vacunas al día</span>
        </div>
        <div class="hero-illustration"></div>
      </div>
    </section>
  `;
}

function createAboutSection() {
  return `
    <section class="home-about" id="quienes-somos">
      <div class="about-image">
        <img src="/assets/sobre-nosotros.png" alt="Equipo de Patitas y Bigotes trabajando con animales" loading="lazy" onerror="this.onerror=null;this.src='/assets/logo-fallback.png';">
      </div>
      <div class="about-copy">
        <h2>Quiénes somos</h2>
        <p>
          Somos una red de refugios, profesionales veterinarios y familias que creen en la adopción responsable.
          Administramos procesos clínicos, visitas y seguimientos para asegurar que cada mascota encuentre el hogar ideal.
        </p>
        <ul>
          <li>Instalaciones climatizadas y espacios de recreación.</li>
          <li>Equipo veterinario con controles sanitarios periódicos.</li>
          <li>Voluntariado activo para rescates y campañas de castración.</li>
        </ul>
      </div>
    </section>
  `;
}

function createStepsSection() {
  const steps = [
    {
      title: 'Conocé',
      copy: 'Explorá mascotas según tu estilo de vida y agendá una visita virtual o presencial.'
    },
    {
      title: 'Postulá',
      copy: 'Completá la solicitud, cargá documentos y coordiná con nuestro equipo operador.'
    },
    {
      title: 'Adoptá',
      copy: 'Firmá el acuerdo, agendá seguimientos y recibí acompañamiento en los primeros meses.'
    }
  ];
  return `
    <section class="home-steps" aria-label="Cómo funciona">
      <h2>Cómo funciona</h2>
      <div class="step-grid">
        ${steps
          .map(
            (step, index) => `
              <article class="step-card">
                <div class="step-header">
                  <span class="step-number">${index + 1}</span>
                  <h3 class="step-title">${step.title}</h3>
                </div>
                <p>${step.copy}</p>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function storyCard(story) {
  const imgSrc = normalizeImageSrc(story.Foto || story.FotoDespues || story.FotoAntes || '');
  const alt = story.Nombre ? `Historia de ${story.Nombre}` : 'Historia con hogar';
  return `
    <article class="story-card">
      <div class="story-card__media" role="presentation">
        ${imgSrc ? `<img class="story-photo" src="${imgSrc}" alt="${alt}" loading="lazy" onerror="this.onerror=null;this.src='/assets/logo-fallback.png';" />` : `
        <span class="story-label">Antes</span>
        <div class="story-before">${story.Nombre || 'Sin nombre'}</div>
        <span class="story-label">Después</span>
        <div class="story-after">${story.Resultado || 'Con hogar'}</div>`}
      </div>
      <div class="story-card__copy">
        <h3>${story.Nombre || 'Mascota adoptada'}</h3>
        <p>${story.Historia || story.Descripcion || 'Familia feliz y seguimiento completado.'}</p>
        <button type="button" class="btn-link" data-story-id="${story.Id}">Ver detalles</button>
      </div>
    </article>
  `;
}

function createStoriesSection() {
  return `
    <section class="home-stories" aria-label="Historias con hogar">
      <div class="section-header">
        <h2>Historias que inspiran</h2>
        <p>Conocé casos reales de adopciones acompañadas por Patitas y Bigotes.</p>
      </div>
      <div class="stories-carousel">
        <button type="button" class="carousel-btn carousel-btn--prev" data-stories-prev aria-label="Anterior">&lsaquo;</button>
        <div class="stories-track stories-carousel__track" data-stories>
          <div class="story-card story-card--skeleton"></div>
          <div class="story-card story-card--skeleton"></div>
          <div class="story-card story-card--skeleton"></div>
        </div>
        <button type="button" class="carousel-btn carousel-btn--next" data-stories-next aria-label="Siguiente">&rsaquo;</button>
      </div>
      <div class="stories-empty hidden" data-stories-empty>
        Aún no registramos historias con hogar. ¡Sumá la tuya adoptando hoy!
      </div>
    </section>
  `;
}

function createFinalCTA() {
  return `
    <section class="home-cta">
      <div class="cta-card">
        <h2>Adoptá y transformá vidas</h2>
        <p>
          Postulate y recibí acompañamiento integral del equipo operador y veterinario.
          Estamos listos para ayudarte en cada paso.
        </p>
        <button type="button" class="btn-primary" data-go-adopt>Adoptá</button>
      </div>
    </section>
  `;
}

export default function renderHome(container) {
  container.innerHTML = `
    ${createHeroSection()}
    ${createAboutSection()}
    ${createStepsSection()}
    ${createStoriesSection()}
    ${createFinalCTA()}
  `;

  const adoptButtons = container.querySelectorAll('[data-go-adopt]');
  adoptButtons.forEach((btn) => btn.addEventListener('click', () => navigateTo(ROUTE_NAMES.adopt)));
  const goPets = container.querySelector('[data-go-pets]');
  if (goPets) {
    goPets.addEventListener('click', () => navigateTo(ROUTE_NAMES.pets));
  }

  // Upgrade key images to progressive loading with fallback -> real src swap
  try {
    // Hero image: force a valid candidate immediately
    const hero = container.querySelector('.hero-image');
    if (hero && !hero.dataset.src) {
      hero.classList.add('progressive');
      hero.src = '/assets/logo-fallback.png';
      hero.setAttribute('data-src', '/assets/Adopt%C3%A1.jpg');
    }
    // About image
    const about = container.querySelector('.about-image img');
    if (about && !about.dataset.src) {
      about.classList.add('progressive');
      about.src = '/assets/logo-fallback.png';
      about.setAttribute('data-src', '/assets/sobre-nosotros.png');
    }
    // Kick progressive loader for existing elements
    import('../utils/image.js').then((m) => m.applyProgressiveLoading(container)).catch(() => {});
  } catch {}

  let active = true;
  const storiesTrack = container.querySelector('[data-stories]');
  const emptyState = container.querySelector('[data-stories-empty]');
  const prevBtn = container.querySelector('[data-stories-prev]');
  const nextBtn = container.querySelector('[data-stories-next]');
  // Filtros removidos: solo render de historias

  // Robust image selection for hero: try multiple file variants
  try {
    const heroImg = container.querySelector('.hero-image');
    if (heroImg) {
      const candidates = [
        '/assets/adoptá.png',
        '/assets/Adoptá.png',
        '/assets/Adoptá.jpg',
        '/assets/Adopt%C3%A1.jpg',
        '/assets/Adopt�.jpg',
        '/assets/adopta.png',
        '/assets/adopta.jpg',
        '/assets/sobre-nosotros.png',
        '/assets/logo-fallback.png'
      ];
      let idx = 0;
      const tryNext = () => {
        if (idx >= candidates.length) return;
        const url = candidates[idx++];
        const tester = new Image();
        tester.onload = () => { heroImg.src = url; };
        tester.onerror = () => tryNext();
        tester.src = url;
      };
      // Start chain with current src as first attempt
      tryNext();
    }
  } catch {}

  // Delegación: asegurar que "Ver detalles" funcione aunque se re-renderice la lista
  if (storiesTrack) {
    storiesTrack.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest('[data-story-id]');
      if (btn) {
        ev.preventDefault();
        const id = btn.dataset.storyId;
        if (id) navigateTo(ROUTE_NAMES.petDetail(id));
      }
    });
  }

  getAllPets()
    .then((pets) => {
      if (!active || !storiesTrack) return;
      // Solo mostrar mascotas YA ADOPTADAS en "Historias que inspiran"
      const adopted = pets.filter((pet) => {
        const resultado = (pet.Resultado || '').toLowerCase();
        // Criterios: resultado que indique adopción/hogar definitivo
        return resultado.includes('adopt') || resultado.includes('con hogar') || resultado.includes('hogar');
      });
      let items = adopted;
      // Also include pets marked as adopted via EstadoSolicitud
      const byEstado = pets.filter((pet) => {
        const estado = (pet.EstadoSolicitud || '').toLowerCase();
        // Incluir animales en BAJA: suele aplicarse cuando la adopción se concreta
        return estado.includes('adopt') || estado.includes('entreg') || estado.includes('baja');
      });
      if (byEstado.length) {
        const map = new Map();
        adopted.concat(byEstado).forEach((p) => { map.set(String(p.Id), p); });
        items = Array.from(map.values());
      }
      // Sin fallback a "recientes": si no hay adoptados, mostrar estado vacío
      if (!items.length) {
        storiesTrack.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }
      if (!items.length) {
        storiesTrack.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }
      // Sort: most recent first when date exists
      const withDate = [];
      const withoutDate = [];
      items.forEach((it) => {
        const ref = it.FechaActualizacion || it.FechaIngreso || '';
        const t = ref ? Date.parse(ref) : NaN;
        if (!Number.isNaN(t)) withDate.push({ t, it }); else withoutDate.push(it);
      });
      withDate.sort((a, b) => b.t - a.t);
      const ordered = [...withDate.map((x) => x.it), ...withoutDate];

      const limited = ordered.slice(0, 12);
      storiesTrack.innerHTML = limited.map((item) => storyCard(item)).join('');
      // Convert immediate src images to progressive data-src to avoid flashing
      try {
        Array.from(storiesTrack.querySelectorAll('.story-card__media img.story-photo:not([data-src])')).forEach((img) => {
          const src = img.getAttribute('src');
          img.classList.add('progressive');
          img.setAttribute('data-src', src || '');
          img.setAttribute('src', '/assets/logo-fallback.png');
          img.removeAttribute('onerror');
        });
        import('../utils/image.js').then((m) => m.applyProgressiveLoading(storiesTrack)).catch(() => {});
      } catch {}
      if (emptyState) emptyState.classList.add('hidden');
      storiesTrack.querySelectorAll('[data-story-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          navigateTo(`/pets/${btn.dataset.storyId}`);
        });
      });

      // Post-render: add dataset attrs and optional images
      const cards = Array.from(storiesTrack.querySelectorAll('.story-card'));
      cards.forEach((card, idx) => {
        const data = limited[idx];
        if (!data) return;
        const especie = (data.EspecieRaza || '').toString();
        const fechaRef = data.FechaActualizacion || data.FechaIngreso || '';
        const year = fechaRef ? new Date(fechaRef).getFullYear() : '';
        card.setAttribute('data-especie', especie.toLowerCase());
        if (year) card.setAttribute('data-anio', String(year));

        const beforePane = card.querySelector('.story-before, .story-pane') || card.querySelector('.story-before');
        const afterPane = card.querySelector('.story-after, .story-pane') || card.querySelector('.story-after');
        const beforeUrl = data.FotoAntes || null;
        const afterUrl = data.FotoDespues || null;
        const singleUrl = data.Foto || null;
        const nombre = data.Nombre || 'Sin nombre';

        function ensureImg(container, url, alt) {
          if (!container) return;
          const src = normalizeImageSrc(url || '');
          const single = normalizeImageSrc(singleUrl || '');
          if (src) {
            container.innerHTML = `<img class="story-photo" src="${src}" alt="${alt}" loading="lazy" />`;
          } else if (single) {
            container.innerHTML = `<img class="story-photo" src="${single}" alt="Historia de ${nombre}" loading="lazy" />`;
          }
        }

        // Only inject if panes exist and we have any image field
        if ((beforePane || afterPane) && (beforeUrl || afterUrl || singleUrl)) {
          if (beforePane) ensureImg(beforePane, beforeUrl, `Antes de ${nombre}`);
          if (afterPane) ensureImg(afterPane, afterUrl, `Después de ${nombre}`);
        }
      });

      // Override: mostrar una sola imagen (sin antes/despu9s)
      cards.forEach((card, idx) => {
        const data = limited[idx];
        if (!data) return;
        const media = card.querySelector('.story-card__media');
        const imageUrl = normalizeImageSrc(data.Foto || data.FotoDespues || data.FotoAntes || '');
        const nombre = data.Nombre || 'Sin nombre';
        if (media && imageUrl) {
          media.innerHTML = `<img class=\"story-photo\" src=\"${imageUrl}\" alt=\"${nombre}\" loading=\"lazy\" />`;
        }
      });

      // After any overrides, convert to progressive and load
      try {
        Array.from(storiesTrack.querySelectorAll('.story-card__media img.story-photo:not([data-src])')).forEach((img) => {
          const src = img.getAttribute('src');
          img.classList.add('progressive');
          img.setAttribute('data-src', src || '');
          img.setAttribute('src', '/assets/logo-fallback.png');
          img.removeAttribute('onerror');
        });
        import('../utils/image.js').then((m) => m.applyProgressiveLoading(storiesTrack)).catch(() => {});
      } catch {}

      // Filtros removidos
      // --- Carousel wiring ---
  // Si el servicio revalida y obtiene la lista completa, refrescar historias
  function onPetsUpdated() {
    if (!active || !storiesTrack) return;
    getAllPets()
      .then((pets) => {
        if (!active) return;
        const adopted = pets.filter((pet) => {
          const resultado = (pet.Resultado || '').toLowerCase();
          const estado = (pet.EstadoSolicitud || '').toLowerCase();
          return resultado.includes('adopt') || resultado.includes('hogar') || estado.includes('baja');
        });
        if (!adopted.length) return;
        const limited = adopted.slice(0, 12);
        storiesTrack.innerHTML = limited.map((item) => storyCard(item)).join('');
        try {
          Array.from(storiesTrack.querySelectorAll('.story-card__media img.story-photo:not([data-src])')).forEach((img) => {
            const src = img.getAttribute('src');
            img.classList.add('progressive');
            img.setAttribute('data-src', src || '');
            img.setAttribute('src', '/assets/logo-fallback.png');
            img.removeAttribute('onerror');
          });
          import('../utils/image.js').then((m) => m.applyProgressiveLoading(storiesTrack)).catch(() => {});
        } catch {}
      })
      .catch(() => {});
  }
  try { window.addEventListener('pets:updated', onPetsUpdated); } catch {}

      const track = storiesTrack;
      // Ensure carousel layout (in case CSS hasn't loaded yet)
      track.style.display = 'flex';
      track.style.overflowX = 'auto';
      track.style.scrollSnapType = 'x mandatory';
      track.style.gap = track.style.gap || '16px';
      track.style.padding = track.style.padding || '6px 44px 10px';

      const gapPx = (() => {
        try {
          const cs = getComputedStyle(track);
          const g = (cs.columnGap || cs.gap || '16px').replace('px', '');
          return parseInt(g, 10) || 16;
        } catch (e) { return 16; }
      })();

      function stepSize() {
        const first = track.querySelector('.story-card');
        if (!first) return Math.max(200, Math.floor(track.clientWidth * 0.9));
        const w = first.getBoundingClientRect().width;
        return Math.max(200, Math.min(w + gapPx, track.clientWidth));
      }

      function updateNav() {
        const canScroll = track.scrollWidth > track.clientWidth + 2;
        if (prevBtn) prevBtn.hidden = !canScroll;
        if (nextBtn) nextBtn.hidden = !canScroll;
        if (!canScroll) return;
        const atStart = track.scrollLeft <= 2;
        const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
        if (prevBtn) prevBtn.disabled = atStart;
        if (nextBtn) nextBtn.disabled = atEnd;
      }

      if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => track.scrollBy({ left: -stepSize(), behavior: 'smooth' }));
        nextBtn.addEventListener('click', () => track.scrollBy({ left: stepSize(), behavior: 'smooth' }));
        track.addEventListener('scroll', updateNav);
        window.addEventListener('resize', updateNav);
        requestAnimationFrame(updateNav);
      }
    })
    .catch(() => {
      if (!active || !storiesTrack) return;
      storiesTrack.innerHTML = '<p class="error-text">No pudimos cargar las historias. Reintentá más tarde.</p>';
    });

  return () => {
    active = false;
  };
}


