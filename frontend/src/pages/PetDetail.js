import { getPetById } from '../services/petsService.js';
import { normalizeImageSrc } from '../utils/image.js';
import { navigateTo } from '../router.js';

function detailTemplate(pet) {
  const health = pet.EstadoSalud || 'Sin registro sanitario';
  const adoption = (pet.EstadoSolicitud || '').trim() || 'Disponible';
  const compat = [];
  try { if ((pet.Tratamiento || '').toLowerCase().includes('niÃ±o')) compat.push('Con niÃ±os'); } catch {}
  try { if ((pet.Descripcion || '').toLowerCase().includes('gato')) compat.push('Con gatos'); } catch {}
  try { if ((pet.Descripcion || '').toLowerCase().includes('perro')) compat.push('Con perros'); } catch {}

  const species = (() => {
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
  })();
  const breed = (() => {
    const r = (pet.Raza || '').toString().trim();
    if (r) return r;
    const er = (pet.EspecieRaza || '').toString().trim();
    if (!er) return '';
    const sp = species.toLowerCase();
    return er.toLowerCase().startsWith(sp) ? er.slice(sp.length).trim() : er;
  })();
  let mainImg = normalizeImageSrc(pet.Foto);
  if (!mainImg && (String(pet.Id) === '2' || String(pet.Nombre || '').toLowerCase() === 'luna')) {
    // Intentar JPG y PNG servidos por backend
    mainImg = '/api/media/animals/2/2luna1.jpg';
  }
  mainImg = mainImg || 'https://via.placeholder.com/720x420?text=Patitas+y+Bigotes';
  return `
    <article class="pet-detail">
      <div class="pet-detail__media">
        <img src="${mainImg}" alt="${pet.Nombre || 'Mascota'}" />
      </div>
      <div class="pet-detail__body">
        <h1>${pet.Nombre || 'Mascota en adopciÃ³n'}</h1>
        <p class="meta">${species}${breed ? ' · ' + breed : ''} · ${pet.Edad || 'Edad desconocida'} años · ${pet.Sexo || 'Sexo no informado'}</p>
        <p class="pet-detail__description">${pet.Descripcion || 'ConocÃ© la ficha tÃ©cnica y postulÃ¡te para adoptarla.'}</p>
        <section class="pet-detail__info">
          <article>
            <h2>Estado</h2>
            <p><strong>AdopciÃ³n:</strong> ${adoption}</p>
            <p><strong>Sanitario:</strong> ${health}</p>
          </article>
          <article>
            <h2>Compatibilidades</h2>
            <ul>
              ${compat.length ? compat.map((item) => `<li>${item}</li>`).join('') : '<li>A evaluar con el equipo.</li>'}
            </ul>
            <h2>Historia</h2>
            <p>${pet.Historia || pet.Resultado || 'Esperando su primer hogar.'}</p>
            <p><strong>Origen:</strong> ${pet.Origen || 'No informado'}</p>
          </article>
        </section>
        <div class="pet-detail__cta">
          <button type="button" class="btn-primary" data-adopt="${pet.Id}">Quiero adoptar</button>
        </div>

      </div>
    </article>
  `;
}

export default function renderPetDetail(container, context) {
  const { params } = context;
  container.innerHTML = '<p class="pending-text">Cargando ficha de la mascota...</p>';
  let active = true;

  getPetById(params?.id)
    .then((pet) => {
      if (!active) return;
      container.innerHTML = detailTemplate(pet);
      // GalerÃ­a adicional (Adjuntos)
      try {
        const media = container.querySelector('.pet-detail__media');
        const rawCandidate = (
          pet.Adjuntos || pet.Galeria || pet.ArchivosAdjuntos || pet.Evidencia ||
          pet.adjuntos || pet.galeria || pet.archivosAdjuntos || pet.evidencia || ''
        );
        const raw = (typeof rawCandidate === 'string' ? rawCandidate : JSON.stringify(rawCandidate || '')).toString().trim();
        const isLuna = (String(pet.Id) === '2' || String(pet.Nombre || '').toLowerCase() === 'luna');
        if (media && (raw || isLuna)) {
          let items = [];
          if (raw && raw.startsWith('[')) {
            try { const arr = JSON.parse(raw); items = Array.isArray(arr) ? arr.map((s)=>String(s||'').trim()) : []; } catch { items = []; }
          }
          if (raw && !items.length) {
            // Extract possible URLs: data:, http(s), or backend-relative paths like /api/media/...
            const matches = raw.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/\S+|\/[\w\-./%?=&#]+/g);
            // If no regex matches, split by newlines, commas or semicolons
            items = matches ? matches.map((s)=>s.trim()) : raw.split(/[\r\n,;]+/).map((s)=>s.trim());
          }
          // Include extra server media for Luna (Id 2), if present
          try {
            if (isLuna) {
              const lunaExtras = [
                '/api/media/animals/2/2luna1.jpg','/api/media/animals/2/2luna1.png',
                '/api/media/animals/2/2luna2.jpg','/api/media/animals/2/2luna2.png',
                '/api/media/animals/2/2luna3.jpg','/api/media/animals/2/2luna3.png'
              ];
              items = lunaExtras.concat(items);
            }
          } catch {}
          // Normalize, dedupe, and accept data:, http(s), relative "/", or blob: URLs
          const mainImageBase = (normalizeImageSrc(pet.Foto) || '').split('?')[0];
          items = Array.from(new Set(items))
            .map((u)=> normalizeImageSrc(u))
            .filter(Boolean)
            .filter((url)=> url.startsWith('data:image') || url.startsWith('http') || url.startsWith('/') || url.startsWith('blob:'))
            // Remove the main image from the gallery if present (compare without query params)
            .filter((url)=> (url.split('?')[0] !== mainImageBase));
          if (items.length) {
            const gallery = document.createElement('div');
            gallery.className = 'pet-detail__gallery';
            gallery.innerHTML = items.map((url)=>`<img class="pet-detail__thumb" src="${url}" alt="Foto adicional de ${pet.Nombre || 'Mascota'}" loading="lazy" onerror="this.remove()" />`).join('');
            media.insertAdjacentElement('afterend', gallery);
          }
        }
      } catch {}
      const button = container.querySelector('[data-adopt]');
      if (button) {
        button.addEventListener('click', () => {
          navigateTo(`/adopt?petId=${encodeURIComponent(pet.Id)}`);
        });
      }

      // Cargar controles y seguimientos asociados y pintarlos en la ficha
      // No extra clinical history is exposed on the public profile.
    })
    .catch((error) => {
      if (!active) return;
      container.innerHTML = `<div class="error-text">No pudimos cargar la mascota. ${error.message || ''}</div>`;
    });

  return () => { active = false; };
}



