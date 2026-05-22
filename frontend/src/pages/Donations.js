import { DONATION_ACCOUNT } from '../config.js';

function template() {
  return `
    <section class="donations-intro">
      <h1>Sumate con tu donación</h1>
      <p>
        Cada aporte sostiene tratamientos veterinarios, campañas de vacunación y la manutención diaria del refugio.
        Con tu ayuda garantizamos controles sanitarios y acompañamiento a cada familia adoptante.
      </p>
      <button type="button" class="btn-primary" data-open-donation>Doná</button>
    </section>
    <section class="donations-purpose">
      <article>
        <h2>Para qué juntamos</h2>
        <ul>
          <li>Alimentos balanceados y suplementos específicos.</li>
          <li>Medicaciones de tratamientos crónicos y emergencias.</li>
          <li>Campañas de castración y microchip para adopciones responsables.</li>
        </ul>
      </article>
      <article>
        <h2>A dónde va el dinero</h2>
        <ul>
          <li>60% Salud y tratamientos veterinarios.</li>
          <li>25% Mantenimiento de refugio e infraestructura.</li>
          <li>15% Programas educativos y acompañamiento a familias.</li>
        </ul>
      </article>
    </section>
  `;
}

function renderModal(destroy) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="donation-title">
      <header class="modal__header">
        <h2 id="donation-title">Transferí tu donación por CVU</h2>
        <button type="button" class="icon-button" data-close aria-label="Cerrar">
          <span class="icon material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <div class="donation-instructions">
        <p>
          Realizá una transferencia con el monto que prefieras a la siguiente cuenta.
          Luego enviá el comprobante a
          <a href="mailto:${DONATION_ACCOUNT.email}" data-copy="email">${DONATION_ACCOUNT.email}</a>
          indicando tu nombre completo.
        </p>
        <ul class="bank-data">
          <li><strong>CVU:</strong> <code data-copy="cvu">${DONATION_ACCOUNT.cvu}</code> <button type="button" class="btn-secondary" data-copy-btn="cvu">Copiar</button></li>
          <li><strong>Alias:</strong> <code data-copy="alias">${DONATION_ACCOUNT.alias}</code> <button type="button" class="btn-secondary" data-copy-btn="alias">Copiar</button></li>
          <li><strong>Titular:</strong> ${DONATION_ACCOUNT.titular}</li>
          ${DONATION_ACCOUNT.documento ? `<li><strong>Documento:</strong> ${DONATION_ACCOUNT.documento}</li>` : ''}
          ${DONATION_ACCOUNT.proveedor ? `<li><strong>Proveedor:</strong> ${DONATION_ACCOUNT.proveedor}</li>` : ''}
          ${DONATION_ACCOUNT.referencia ? `<li><strong>Referencia:</strong> ${DONATION_ACCOUNT.referencia}</li>` : ''}
        </ul>
      </div>
      <footer class="modal__footer">
        <button type="button" class="btn-primary" data-close>Cerrar</button>
      </footer>
    </div>
  `;

  function close() {
    overlay.remove();
    destroy();
  }

  overlay.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', close);
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  // Copiar al portapapeles
  function bindCopy(key) {
    let btn = overlay.querySelector(`[data-copy-btn="${key}"]`);
    const el = overlay.querySelector(`[data-copy="${key}"]`);
    if (!el) return;
    // Si no hay botón, usar el propio elemento como disparador (p.ej., el link del email)
    if (!btn) btn = el;
    const originalText = btn.textContent;
    btn.addEventListener('click', async (e) => {
      if (btn === el && e && btn.tagName === 'A') {
        e.preventDefault(); // Evita abrir mailto cuando se usa para copiar
      }
      const text = (el.textContent || '').trim();
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copiado';
        setTimeout(() => { btn.textContent = originalText; }, 1500);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = 'Copiado';
        setTimeout(() => { btn.textContent = originalText; }, 1500);
      }
    });
  }

  bindCopy('cvu');
  bindCopy('alias');
  bindCopy('email');

  document.body.appendChild(overlay);
  return close;
}

export default function renderDonations(container) {
  container.innerHTML = template();
  let modalCleanup = null;

  const openButton = container.querySelector('[data-open-donation]');
  if (openButton) {
    openButton.addEventListener('click', () => {
      if (modalCleanup) return;
      modalCleanup = renderModal(() => {
        modalCleanup = null;
      });
    });
  }

  return () => {
    if (modalCleanup) modalCleanup();
  };
}

