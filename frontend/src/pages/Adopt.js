import { getAllPets } from '../services/petsService.js';
import { createApplication } from '../services/adoptionsService.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';

function infoBlock() {
  return `
    <section class="adopt-info">
      <article>
        <h2>Requisitos esenciales</h2>
        <ul>
          <li>Ser mayor de 21 años y presentar DNI.</li>
          <li>Contar con vivienda estable y espacio seguro.</li>
          <li>Comprometerse a los controles sanitarios y seguimientos.</li>
        </ul>
      </article>
      <article>
        <h2>Proceso completo</h2>
        <ol>
          <li>Completá la solicitud y adjuntá la información clave.</li>
          <li>Un operador revisará tu perfil y coordinará una visita.</li>
          <li>Firmás el acuerdo, retirás a la mascota y realizamos seguimiento.</li>
        </ol>
      </article>
      <article>
        <h2>Tiempos estimados</h2>
        <ul>
          <li>Revisión inicial: 48 h hábiles.</li>
          <li>Visita domiciliaria: dentro de los próximos 7 días.</li>
          <li>Seguimiento post adopción: 30, 90 y 180 días.</li>
        </ul>
      </article>
    </section>
  `;
}

function formTemplate() {
  return `
    <section class="adopt-form">
      <h2>Formulario “Adoptá”</h2>
      <!-- importante: usamos el mismo layout del registro -->
      <form data-adopt-form novalidate>
        <label>
          <span>Nombre completo</span>
          <input name="nombre" type="text" autocomplete="name" />
          <small class="error" data-error="nombre"></small>
        </label>

        <label>
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" />
          <small class="error" data-error="email"></small>
        </label>

        <label>
          <span>DNI</span>
          <input name='dni' type='text' inputmode='numeric' pattern='\\d{7,10}' placeholder='Ej.: 12345678' />
          <small class='error' data-error='dni'></small>
        </label>

        <label>
          <span>WhatsApp</span>
          <input name="telefono" type="tel" autocomplete="tel"  inputmode="numeric" pattern="\\d{10,15}" placeholder="Ej.: 1123456789" />
          <small class="error" data-error="telefono"></small>
        </label>

        <label class="span-2">
          <span>Domicilio</span>
          <input name="direccion" type="text" autocomplete="street-address" />
          <small class="error" data-error="direccion"></small>
        </label>

        <label>
          <span>Tipo de vivienda</span>
          <select name="vivienda">
            <option value="">Seleccioná</option>
            <option>Casa con patio</option>
            <option>Departamento</option>
            <option>Casa sin patio</option>
            <option>Otros</option>
          </select>
          <small class="error" data-error="vivienda"></small>
        </label>

        <label>
          <span>Convivencia con menores o más mascotas</span>
          <input name="convivientes" type="text" placeholder="Ej.: 2 personas adultas, 1 perro" />
        </label>

        <label class="span-2">
          <span>Experiencia con mascotas</span>
          <textarea name="experiencia" rows="3" placeholder="Contanos si tuviste animales y cómo los cuidaste"></textarea>
          <small class="error" data-error="experiencia"></small>
        </label>

        <label>
          <span>Disponibilidad diaria</span>
          <select name="disponibilidad">
            <option value="">Seleccioná</option>
            <option>Mañana</option>
            <option>Tarde</option>
            <option>Noche</option>
            <option>Mañana y Tarde</option>
            <option>Tarde y Noche</option>
            <option>Jornada completa</option>
          </select>
          <small class="error" data-error="disponibilidad"></small>
        </label>

        <label>
          <span>Preferencia de especie</span>
          <select name="prefEspecie">
            <option value="">Cualquiera</option>
            <option>Perros</option>
            <option>Gatos</option>
            <option>Otros</option>
          </select>
        </label>

        <label>
          <span>Preferencia de tamaño</span>
          <select name="prefTamano">
            <option value="">Cualquiera</option>
            <option>Pequeño</option>
            <option>Mediano</option>
            <option>Grande</option>
          </select>
        </label>

        <label>
          <span>Preferencia de edad</span>
          <select name="prefEdad">
            <option value="">Cualquiera</option>
            <option>Cachorro</option>
            <option>Joven</option>
            <option>Adulto</option>
            <option>Senior</option>
          </select>
        </label>

        <label>
          <span>Mascota</span>
          <select name="petId" data-pet-select>
            <option value="">Selecciona una mascota</option>
          </select>
          <small class="error" data-error="petId"></small>
        </label>

        <label class="span-2">
          <span>Comentarios adicionales</span>
          <textarea name="comentarios" rows="3"></textarea>
        </label>

        <label class="terms span-2">
          <div class="terms__agreement">
            <input type="checkbox" name="acepta" />
            <span>Acepto que Patitas y Bigotes valide la información y contactos.</span>
          </div>
          <small class="error" data-error="acepta"></small>
        </label>

        <!-- botones como HIJOS del form (sin wrapper) -->
        <button type="button" class="btn-link" data-go-pets>Ver mascotas disponibles</button>
        <button type="submit" class="btn-primary">Enviar solicitud</button>

        <div class="form-feedback" aria-live="polite"></div>
      </form>
    </section>
  `;
}


const requiredMessages = {
  nombre: 'Ingresá tu nombre',
  email: 'Ingresá un email válido',
  dni: 'Ingresá tu DNI',
  telefono: 'Ingresá un teléfono de contacto',
  direccion: 'Ingresá tu domicilio',
  vivienda: 'Seleccioná el tipo de vivienda',
  experiencia: 'Contanos tu experiencia con mascotas',
  disponibilidad: 'Indicanos tu disponibilidad diaria',
  petId: 'Selecciona una mascota',
  acepta: 'Debes aceptar términos y condiciones'
};

function validate(form) {
  const errors = {};
  const data = new FormData(form);
  Object.entries(requiredMessages).forEach(([field, message]) => {
    if (field === 'acepta') {
      if (!form.elements.acepta.checked) {
        errors[field] = message;
      }
      return;
    }
    const value = data.get(field);
    if (!value || !String(value).trim()) {
      errors[field] = message;
    }
  });
  const email = data.get('email');
  if (email && !/.+@.+\..+/.test(email)) {
    errors.email = 'Email inválido';
  }
  const dniRaw = data.get('dni') || '';
  const dniDigits = String(dniRaw).replace(/\\D+/g, '');
  if (!errors.dni) {
    if (!/^[0-9]{7,10}$/.test(dniDigits)) {
      errors.dni = 'DNI inválido (7 a 10 dígitos)';
    } else if (dniDigits !== String(dniRaw)) {
      errors.dni = 'Usa solo números';
    }
  }

    const telRaw = data.get('telefono') || '';
  const telDigits = String(telRaw).replace(/\\D+/g, '');
    if (!errors.telefono) {
    if (!/^[0-9]{10,15}$/.test(telDigits)) {
      errors.telefono = 'WhatsApp invalido (10 a 15 digitos)';
    } else if (telDigits !== String(telRaw)) {
      errors.telefono = 'Usa solo numeros';
    }
  }
  return errors;
}

async function populatePets(select, prefill) {
  select.innerHTML = '<option value="">Cargando mascotas...</option>';
  try {
    const all = await getAllPets();
    // Guardar catálogo para validaciones en submit
    try { select.dataset.catalog = JSON.stringify(all || []); } catch {}
    // Visibilidad pública (consistente con listado)
    const isPublicVisible = (pet) => {
      const state = (pet.EstadoSolicitud || '').toLowerCase();
      const health = (pet.EstadoSalud || '').toLowerCase();
      const hasHome = !!(pet.Resultado && String(pet.Resultado).trim());
      const notAvailable = state === 'reservado' || state === 'no disponible' || state === 'baja' || health.includes('no apto') || hasHome;
      return !notAvailable;
    };
    // Solo mostrar adoptables para evitar rechazos del backend
    const adoptables = all
      .filter(isPublicVisible)
      .filter((pet) => (pet.EstadoSalud || '').toLowerCase().includes('apto'));
    if (!adoptables.length) {
      select.innerHTML = '<option value="">No hay mascotas disponibles ahora mismo</option>';
      return;
    }
    select.innerHTML = '<option value="">Selecciona una mascota</option>' + adoptables
      .map((pet) => `<option value="${pet.Id}">${pet.Nombre || 'Sin nombre'} - ${pet.EspecieRaza || ''}</option>` )
      .join('');
    if (prefill) {
      select.value = prefill;
      if (!select.value) {
        const option = document.createElement('option');
        option.value = prefill;
        option.textContent = `Mascota ${prefill} (no disponible para adopción)`;
        option.disabled = true;
        option.selected = true;
        select.appendChild(option);
      }
    }
  } catch (error) {
    select.innerHTML = `<option value="">Error al cargar mascotas (${error.message})</option>`;
  }
}

export default function renderAdopt(container, context) {
  const prefillPetId = context?.query?.petId || '';
  container.innerHTML = `
    <section class="auth-header">
      <h1>Iniciá tu adopción</h1>
      <p>Completá el formulario para que nuestro equipo evalúe tu perfil y coordine una visita.</p>
    </section>

    ${infoBlock()}

    <section class="auth-grid">
      <article class="auth-card">
        ${formTemplate()}
      </article>
    </section>
  `;


  const form = container.querySelector('[data-adopt-form]');
  const feedback = form.querySelector('.form-feedback');
  const petSelect = form.querySelector('[data-pet-select]');
  const goPetsBtn = form.querySelector('[data-go-pets]');

  populatePets(petSelect, prefillPetId);

  const phoneInput = form.elements?.telefono;
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      const digits = phoneInput.value.replace(/\\D+/g, '').slice(0, 15);
      if (phoneInput.value !== digits) phoneInput.value = digits;
    });
  }

    const dniInput = form.elements?.dni;
  if (dniInput) {
    dniInput.addEventListener('input', () => {
      const digits = dniInput.value.replace(/\\D+/g, '').slice(0, 10);
      if (dniInput.value !== digits) dniInput.value = digits;
    });
  }

  if (goPetsBtn) {
    goPetsBtn.addEventListener('click', (e) => {
      try { e.preventDefault(); e.stopPropagation(); } catch (_){ }
      navigateTo('/pets');
    });
  }

  function showErrors(errors) {
    form.querySelectorAll('.error').forEach((el) => {
      el.textContent = '';
    });
    Object.entries(errors).forEach(([field, message]) => {
      const errorEl = form.querySelector(`[data-error="${field}"]`);
      if (errorEl) errorEl.textContent = message;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    feedback.innerHTML = '';
    const errors = validate(form);
    if (Object.keys(errors).length) {
      showErrors(errors);
      return;
    }
    showErrors({});
    const formData = new FormData(form);

    const telRaw = formData.get('telefono') || '';
    const telDigits = String(telRaw).replace(/\\D+/g, '');

    // Robustez: asegurar que el AnimalId viaje correcto
    const sel = form.querySelector('[data-pet-select]');
    let selId = Number(formData.get('petId'));
    if (!selId) {
      try {
        const label = sel?.selectedOptions?.[0]?.textContent || '';
        const m = String(label).match(/\d+/);
        if (m) selId = Number(m[0]);
      } catch {}
    }
    if (!selId) {
      showErrors({ petId: 'Selecciona una mascota' });
      return;
    }
    // Validación adicional: solo permitir adoptables
    try {
      const catalog = JSON.parse(sel.dataset.catalog || '[]');
      const picked = catalog.find((p) => String(p.Id) === String(selId));
      const isAdoptable = picked && (String(picked.EstadoSalud || '').toLowerCase().includes('apto')) && !['reservado','no disponible','baja'].includes(String(picked.EstadoSolicitud||'').toLowerCase());
      if (!isAdoptable) {
        showErrors({ petId: 'Esta mascota no está disponible para adopción' });
        return;
      }
    } catch {}

    const labelText = sel?.selectedOptions?.[0]?.textContent || '';
    const animalName = (labelText.split(' - ')[0] || '').trim();
    const payload = {
      AnimalId: selId,
      AnimalNombre: animalName,
      // Claves duplicadas para máxima compatibilidad backend
      animalId: selId,
      PetId: selId,
      IdAnimal: selId,
      AceptaTerminos: !!form.elements.acepta?.checked,
      NumeroTelefono: telDigits,
      Direccion: formData.get('direccion'),
      Experiencia: formData.get('experiencia'),
      Disponibilidad: formData.get('disponibilidad'),
      Convivientes: formData.get('convivientes'),
      MotivoSolicitud: `Tipo vivienda: ${formData.get('vivienda')}`,
      Adjuntos: '',
      Email: formData.get('email'),
      Nombre: formData.get('nombre')
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    feedback.innerHTML = '<p class="pending-text">Enviando tu solicitud...</p>';

    try {
      const response = await createApplication(payload);
      feedback.innerHTML = '<p class="success-text">Recibimos tu postulación. Te contactamos pronto.</p>';
      showToast('success', 'Solicitud creada en estado Pendiente');
      form.reset();
      if (prefillPetId) {
        populatePets(petSelect);
      }
    } catch (error) {
      const status = error.status || 0;
      const message = error.message || 'No pudimos registrar la solicitud.';
      let friendly = message;
      if (status === 403) friendly = 'Debes iniciar sesión como adoptante para enviar la solicitud.';
      feedback.innerHTML = `<p class="error-text">${friendly}</p>`;
      if (message.includes('Actualmente no disponible')) {
        showErrors({ petId: 'Actualmente no disponible' });
      }
      if (message.includes('Complete los campos obligatorios')) {
        feedback.innerHTML = '<p class="error-text">Complete los campos obligatorios.</p>';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar solicitud';
    }
  }

  form.addEventListener('submit', handleSubmit);

  return () => {};
}











