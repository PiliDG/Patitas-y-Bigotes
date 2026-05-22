import { setState } from '../state/store.js';
import { FAQ_ITEMS, HELP_BOT_CATEGORIES, WHATSAPP_URL } from '../config.js';
import { navigateTo } from '../router.js';

function renderFaqList(categoryId) {
  const category = HELP_BOT_CATEGORIES.find((cat) => cat.id === categoryId) || HELP_BOT_CATEGORIES[0];
  const questions = (category?.faqs || [])
    .map((faqId) => FAQ_ITEMS.find((faq) => faq.id === faqId))
    .filter(Boolean);
  return `
    <div class="bot-faqs">
      ${questions
        .map(
          (faq) => `
            <article class="bot-faq">
              <h3>${faq.question}</h3>
              <p>${faq.answer}</p>
            </article>
          `,
        )
        .join('')}
      <p class="bot-fallback">${category?.fallback || ''}</p>
    </div>
  `;
}

function renderContent(categoryId) {
  return `
    ${renderFaqList(categoryId)}
    <div class="bot-actions">
      <a class="btn-whatsapp" href="${WHATSAPP_URL}" target="_blank" rel="noopener">Hablar por WhatsApp</a>
      <a class="btn-link" data-nav-contact href="/contact">Ir a Contacto</a>
    </div>
  `;
}

export default function renderHelpBot(container, state) {
  if (!state.helpOpen) {
    container.innerHTML = '';
    container.classList.remove('is-visible');
    return () => {};
  }

  container.classList.add('is-visible');
  const activeCategory = HELP_BOT_CATEGORIES[0]?.id;
  container.innerHTML = `
    <div class="overlay-backdrop" data-close-help></div>
    <section class="help-bot" role="dialog" aria-modal="true" aria-labelledby="help-bot-title">
      <header class="help-bot__header">
        <h2 id="help-bot-title">Centro de ayuda</h2>
        <button type="button" class="icon-button" data-close-help aria-label="Cerrar ayuda">
          <span class="icon material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <div class="help-bot__body">
        <nav class="help-bot__categories" aria-label="Categorías de ayuda">
          <ul>
            ${HELP_BOT_CATEGORIES.map(
              (cat, index) => `
                <li>
                  <button type="button" class="bot-category${index === 0 ? ' is-active' : ''}" data-category="${cat.id}">
                    ${cat.label}
                  </button>
                </li>
              `,
            ).join('')}
          </ul>
        </nav>
        <div class="help-bot__content">
          ${renderContent(activeCategory)}
        </div>
      </div>
    </section>
  `;

  container.querySelectorAll('[data-close-help]').forEach((btn) => {
    btn.addEventListener('click', () => setState({ helpOpen: false }));
  });

  const content = container.querySelector('.help-bot__content');
  container.querySelectorAll('.bot-category').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.bot-category').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (content) {
        content.innerHTML = renderContent(btn.dataset.category);
        attachContentListeners(content);
      }
    });
  });

  function attachContentListeners(node) {
    const link = node.querySelector('[data-nav-contact]');
    if (link) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        setState({ helpOpen: false });
        navigateTo('/contact');
      });
    }
  }

  attachContentListeners(content);

  return () => {};
}

