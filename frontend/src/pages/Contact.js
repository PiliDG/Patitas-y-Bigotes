// Contact.js
import { FAQ_ITEMS } from '../config.js';

function faqList() {
  // Excluir solo en Contacto la pregunta sobre cambio de rol
  const items = FAQ_ITEMS.filter(
    (faq) => faq?.id !== 'cuenta-roles' && !/cambiar\s+mi\s+rol/i.test(faq?.question || '')
  );
  return items
    .map(
      (faq) => `
    <details class="faq-item">
      <summary>${faq.question}</summary>
      <p>${faq.answer}</p>
    </details>
  `,
    )
    .join('');
}

export default function renderContact(container) {
  container.innerHTML = `
    <section class="auth-header">
      <h1>Contacto</h1>
      <p>Visitá el refugio, escribinos o coordiná una reunión virtual con nuestro equipo.</p>
    </section>

    <section class="auth-grid">
      <!-- Columna izquierda: formulario -->
      <article class="auth-card">
        <h2>Formulario de contacto</h2>
        <form data-contact-form novalidate>
          <label>
            <span>Nombre</span>
            <input name="nombre" type="text" />
            <small class="error" data-error="nombre"></small>
          </label>

          <label>
            <span>Email</span>
            <input name="email" type="email" />
            <small class="error" data-error="email"></small>
          </label>

          <label>
            <span>Motivo</span>
            <select name="motivo">
              <option value="">Seleccioná</option>
              <option>Adopciones</option>
              <option>Donaciones</option>
              <option>Voluntariado</option>
              <option>Otro</option>
            </select>
            <small class="error" data-error="motivo"></small>
          </label>

          <label class="span-2">
            <span>Mensaje</span>
            <textarea name="mensaje" rows="4"></textarea>
            <small class="error" data-error="mensaje"></small>
          </label>

          <button type="submit" class="btn-primary">Enviar</button>
          <div class="form-feedback" aria-live="polite"></div>
        </form>
      </article>

      <!-- Columna derecha: info + FAQ -->
      <article class="auth-card">
        <h2>Información</h2>
        <ul>
          <li><strong>Dirección:</strong> Av. Siempreviva 1234, CABA.</li>
          <li><strong>Horarios:</strong> Martes a sábado de 10 a 18 h.</li>
          <li><strong>Teléfono:</strong> (011) 5555-2222</li>
          <li><strong>Email:</strong> hola@patitasybigotes.org</li>
          <li><strong>Redes:</strong> @patitasybigotes en Instagram y Facebook</li>
        </ul>

        <div style="height:12px"></div>
        <h3>Preguntas frecuentes</h3>
        <div class="faq-list">
          ${faqList()}
        </div>
      </article>
    </section>
  `;

  const form = container.querySelector('[data-contact-form]');
  const feedback = form.querySelector('.form-feedback');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const errors = {};

    if (!data.get('nombre')) errors.nombre = 'Ingresá tu nombre';
    const email = data.get('email');
    if (!email) errors.email = 'Ingresá tu email';
    else if (!/.+@.+\..+/.test(email)) errors.email = 'Email inválido';
    if (!data.get('motivo')) errors.motivo = 'Seleccioná el motivo';
    if (!data.get('mensaje')) errors.mensaje = 'Completá tu mensaje';

    form.querySelectorAll('.error').forEach((el) => (el.textContent = ''));
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([field, msg]) => {
        const el = form.querySelector(`[data-error="${field}"]`);
        if (el) el.textContent = msg;
      });
      feedback.textContent = '';
      return;
    }

    feedback.innerHTML = '<p class="success-text">Gracias por escribirnos. Te responderemos a la brevedad.</p>';
    form.reset();
  });

  return () => {};
}
