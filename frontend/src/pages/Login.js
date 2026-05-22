import { loginUser } from '../state/auth.js';
import { getState } from '../state/store.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';
import { ROUTE_NAMES } from '../config.js';
import { isEmailValid } from '../utils/email.js';

export default function renderLogin(container) {
  container.innerHTML = `
    <section class="auth-header">
      <h1>Iniciar sesión</h1>
      <p>Accedé a tu panel según tu rol en Patitas y Bigotes.</p>
    </section>
    <section class="auth-card">
      <h2>Log In</h2>
      <form data-login-form novalidate>
        <label>
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" />
          <small class="error" data-error="email"></small>
        </label>
        <label>
          <span>Contraseña</span>
          <input name="contrasena" type="password" autocomplete="current-password" />
          <small class="error" data-error="contrasena"></small>
        </label>
        <button type="submit" class="btn-primary">Ingresar</button>
        <p class="auth-note">¿No tenés cuenta? <a href="${ROUTE_NAMES.signin}" data-nav-signup>Registrate.</a></p>
        <div class="form-feedback" aria-live="polite"></div>
      </form>
    </section>
  `;

  const form = container.querySelector('[data-login-form]');
  const feedback = form.querySelector('.form-feedback');
  const signupLink = form.querySelector('[data-nav-signup]');
  if (signupLink) {
    signupLink.addEventListener('click', (event) => {
      event.preventDefault();
      navigateTo(ROUTE_NAMES.signin);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.textContent = '';
    form.querySelectorAll('.error').forEach((el) => (el.textContent = ''));
    const data = new FormData(form);
    const email = (data.get('email') || '').trim();
    const pass = (data.get('contrasena') || '').trim();
    let hasError = false;
    if (!isEmailValid(email)) {
      form.querySelector('[data-error="email"]').textContent = 'Email inválido';
      hasError = true;
    }
    if (!pass) {
      form.querySelector('[data-error="contrasena"]').textContent = 'Ingresá tu contraseña';
      hasError = true;
    }
    if (hasError) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ingresando...';
    feedback.innerHTML = '<p class="pending-text">Verificando credenciales...</p>';

    try {
      const resp = await loginUser({ email, contrasena: pass });
      feedback.innerHTML = `<p class="success-text">${resp?.message || 'Sesión iniciada.'}</p>`;
      showToast('success', resp?.message || 'Sesión iniciada');
      const currentRole = (getState()?.role || 'adoptante');
      const destination = currentRole === 'operador'
        ? ROUTE_NAMES.dashboardOperator
        : currentRole === 'veterinario'
          ? ROUTE_NAMES.dashboardVet
          : ROUTE_NAMES.dashboardAdopter;
      navigateTo(destination);
    } catch (error) {
      feedback.innerHTML = `<p class="error-text">${error.message || 'No se pudo iniciar sesión'}</p>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ingresar';
    }
  });

  

  return () => {};
}
