import { registerUser, confirmEmail } from '../state/auth.js';
import { showToast } from '../components/Toast.js';
import { isEmailValid } from '../utils/email.js';
import { isFullNameValid } from '../utils/name.js';

const ERROR_MESSAGES = {
  nombre: 'Debe ingresar nombre',
  email: 'Email inválido',
  contrasena: 'Contraseña insegura',
  acepta: 'Debes aceptar los términos'
};

function validate(form) {
  const data = new FormData(form);
  const errors = {};
  if (!isFullNameValid(data.get('nombre'))) errors.nombre = ERROR_MESSAGES.nombre;
  const email = data.get('email');
  if (!isEmailValid(email)) errors.email = ERROR_MESSAGES.email;
  const contrasena = data.get('contrasena') || '';
  if (contrasena.length < 8) errors.contrasena = ERROR_MESSAGES.contrasena;
  if (!form.elements.acepta.checked) errors.acepta = ERROR_MESSAGES.acepta;
  return errors;
}

function renderTokenSection(container) {
  return `
    <section class="auth-card">
      <h2>Confirmá tu email</h2>
      <p>Ingresá el token recibido por correo para activar tu cuenta.</p>
      <div class="token-row">
        <input type="text" name="token" placeholder="Token de verificación" inputmode="numeric" pattern="\\d{6}" maxlength="6" />
        <button type="button" class="btn-secondary" data-confirm>Confirmar</button>
      </div>
      <div class="token-feedback" aria-live="polite"></div>
    </section>
  `;
}

function renderDevTokenPanel() {
  return `
    <section class="auth-card dev-token hidden" data-dev-token>
      <h3>Token generado (solo pruebas)</h3>
      <p>Usá este token para confirmar la cuenta. No se envía email en este entorno.</p>
      <div class="dev-token__row">
        <code class="dev-token__code" data-dev-token-code>—</code>
        <div class="dev-token__actions">
          <button type="button" class="btn-secondary" data-copy-token>Copiar</button>
          <button type="button" class="btn-link" data-fill-token>Rellenar arriba</button>
        </div>
      </div>
    </section>
  `;
}

export default function renderSignIn(container) {
  container.innerHTML = `
    <section class="auth-header">
      <h1>Registrate en Patitas y Bigotes</h1>
      <p>Creá tu cuenta de adoptante para postularte y hacer seguimiento.</p>
    </section>

    <div class="auth-grid">
      <section class="auth-card">
        <h2>Sign In (Registro)</h2>
        <form data-signup-form novalidate>
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
            <span>Contraseña</span>
            <input name="contrasena" type="password" autocomplete="new-password" />
            <small class="error" data-error="contrasena"></small>
          </label>
          <input type="hidden" name="rol" value="adoptante" />
          <label class="terms">
            <div class="terms__agreement">
              <input type="checkbox" name="acepta" />
              <span>Acepto los términos y condiciones de uso.</span>
            </div>
            <button type="button" class="btn-link" data-open-terms>Ver términos</button>
            <small class="error" data-error="acepta"></small>
          </label>
          <button type="submit" class="btn-primary">Crear cuenta</button>
          <div class="form-feedback" aria-live="polite"></div>
        </form>
      </section>

      ${renderTokenSection(container)}
    </div>

  `;

  // ---------- helpers (consola) ----------
  function openTermsModal() {
    const root = document.getElementById('overlay-root');
    if (!root) return;
    if (root.querySelector('[data-terms-modal]')) return;
    root.innerHTML = `
      <div class="modal-overlay" data-terms-modal>
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
          <header class="modal__header">
            <h2 id="terms-title">Términos y Condiciones</h2>
            <button type="button" class="icon-button" data-close-terms aria-label="Cerrar">
              <span class="icon material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </header>
          <div class="modal__body" style="line-height:1.6">
            <p>Al crear una cuenta aceptas los siguientes términos:</p>
            <ul>
              <li>Usaremos tus datos para gestionar el proceso de adopción y coordinación de visitas.</li>
              <li>Podemos contactarte por email o WhatsApp con información relevante a tus solicitudes.</li>
              <li>Debes proporcionar datos veraces y actualizar tu información cuando sea necesario.</li>
              <li>Nos reservamos el derecho de rechazar o anular solicitudes por incumplimientos o datos incompletos.</li>
              <li>Para más detalles de privacidad, consulta nuestra política de datos si está disponible.</li>
            </ul>
            <p>Si no estás de acuerdo, no continúes con el registro.</p>
          </div>
            <div class="modal__footer">
              <button type="button" class="btn-secondary" data-close-terms data-accept-terms>Acepto</button>
            </div>
          </section>
        </div>`;
    const closeAll = () => { root.innerHTML = ''; };
    const acceptBtn = root.querySelector('[data-accept-terms]');
    acceptBtn?.addEventListener('click', () => {
      const checkbox = form?.elements?.acepta;
      if (checkbox) checkbox.checked = true;
      closeAll();
    });
    root.addEventListener('click', (ev) => {
      const target = ev.target;
      if (target.matches('[data-terms-modal]') || target.matches('[data-close-terms]')) closeAll();
    });
    document.addEventListener('keydown', function onEsc(e){
      if (e.key === 'Escape') { closeAll(); document.removeEventListener('keydown', onEsc); }
    });
  }
  const termsBtn = container.querySelector('[data-open-terms]');
  termsBtn?.addEventListener('click', openTermsModal);

  // ---------- helpers (token) ----------
  const isLikelyToken = (v) =>
    typeof v === 'string' && /\d/.test(v) && v.trim().length >= 4;

  function getTokenFromResponse(resp) {
    const candidates = [
      resp?.token,
      resp?.verificationToken,
      resp?.verification_code,
      resp?.codigo,
      resp?.codigoConfirmacion,
      resp?.data?.token,
      resp?.data?.verificationToken,
    ].filter(Boolean);

    return candidates.find((v) => typeof v === 'string' && /[0-9]/.test(v) && v.trim().length >= 4) || null;
  }

  const form = container.querySelector('[data-signup-form]');
  const feedback = form.querySelector('.form-feedback');
  const tokenSection = container.querySelector('.token-row');
  const tokenFeedback = container.querySelector('.token-feedback');
  const tokenInput = tokenSection?.querySelector('input[name="token"]');

  // ---------- Prefill si quedó guardado de antes ----------
// Prefill deshabilitado: ya no mostramos tokens previos automáticamente
/* try {
    const stored = localStorage.getItem('lastSignUpToken');
    if (isLikelyToken(stored) && tokenSection) {
      const tokenInputInit = tokenSection.querySelector('input[name="token"]');
      const devPanelInit = container.querySelector('[data-dev-token]');
      const codeElInit = container.querySelector('[data-dev-token-code]');
      if (tokenInputInit) tokenInputInit.value = stored;
      if (codeElInit) codeElInit.textContent = stored;
      if (devPanelInit) devPanelInit.classList.remove('hidden');
    } else {
      localStorage.removeItem('lastSignUpToken');
    }
  } catch {} */

  // ---------- Registro ----------
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.textContent = '';

    const errors = validate(form);
    form.querySelectorAll('.error').forEach((el) => (el.textContent = ''));
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([field, message]) => {
        const target = form.querySelector(`[data-error="${field}"]`);
        if (target) target.textContent = message;
      });
      return;
    }

    const formData = new FormData(form);
    // Registrar siempre como adoptante
    const rol = 'adoptante';
    const payload = {
      nombre: (formData.get('nombre') || '').trim(),
      email: (formData.get('email') || '').trim(),
      contrasena: (formData.get('contrasena') || '').trim(),
      aceptaTerminos: true,
      rolDeseado: rol
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';
    feedback.innerHTML = '<p class="pending-text">Creando cuenta...</p>';

    try {
      const response = await registerUser(payload);

      const message = response?.message || 'Cuenta creada. Revisa tu email.';
      feedback.innerHTML = `<p class="success-text">${message}</p>`;
      showToast('success', message);

      const token = getTokenFromResponse(response);
      if (token) {
        if (tokenInput) tokenInput.value = token;
      } else {
        showToast('info', 'Te enviamos el token por email. Pegalo en el campo de confirmación.');
      }

    } catch (error) {
      const message = error.message || 'No pudimos crear la cuenta';
      feedback.innerHTML = `<p class="error-text">${message}</p>`;
      if (message.includes('Debe ingresar nombre')) {
        form.querySelector('[data-error="nombre"]').textContent = 'Debe ingresar nombre';
      }
      if (message.includes('Email inválido')) {
        form.querySelector('[data-error="email"]').textContent = 'Email inválido';
      }
      if (message.includes('Contraseña insegura')) {
        form.querySelector('[data-error="contrasena"]').textContent = 'Contraseña insegura';
      }
      if (message.includes('El email ya está registrado')) {
        form.querySelector('[data-error="email"]').textContent = 'El email ya está registrado';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear cuenta';
    }
  });

  // ---------- Confirmación ----------
  if (tokenSection && tokenInput) {
    const confirmBtn = tokenSection.querySelector('[data-confirm]');
    confirmBtn.addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      if (!token) {
        tokenFeedback.innerHTML = '<p class="error-text">Ingresá el token recibido.</p>';
        return;
      }
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Confirmando...';
      tokenFeedback.innerHTML = '<p class="pending-text">Confirmando cuenta...</p>';
      try {
        const data = await confirmEmail(token);

        tokenFeedback.innerHTML = `<p class="success-text">${data?.message || 'Cuenta confirmada. Ya podés iniciar sesión.'}</p>`;
        showToast('success', 'Cuenta confirmada');
      } catch (error) {
        tokenFeedback.innerHTML = `<p class="error-text">${error.message || 'No se pudo confirmar la cuenta.'}</p>`;
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar';
      }
    });
  }

  return () => {};
}
