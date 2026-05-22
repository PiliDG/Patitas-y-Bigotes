import { clearFlash, setState } from '../state/store.js';

let timeoutId = null;

export function showToast(type, message, options = {}) {
  const duration = options.duration ?? 6000;
  setState({ flash: { type, message, duration, id: Date.now() } });
}

export default function renderToast(container, state) {
  const toast = state.flash;
  if (!toast) {
    container.innerHTML = '';
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    return;
  }

  container.innerHTML = `
    <div class="toast toast-${toast.type || 'info'}" role="status">
      <span>${toast.message}</span>
      <button type="button" class="toast-close" aria-label="Cerrar aviso">Cerrar</button>
    </div>
  `;

  const closeBtn = container.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearFlash();
    });
  }

  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(() => {
    clearFlash();
    timeoutId = null;
  }, toast.duration || 6000);
}