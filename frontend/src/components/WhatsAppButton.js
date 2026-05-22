import { WHATSAPP_URL } from '../config.js';

export default function renderWhatsAppButton(container) {
  container.innerHTML = `
    <a class="whatsapp-button" href="${WHATSAPP_URL}" target="_blank" rel="noopener" aria-label="¿Dudas? Escribinos por WhatsApp">
      <span class="icon material-symbols-outlined" aria-hidden="true">chat</span>
      <span class="whatsapp-text">¿Dudas? Escribinos</span>
    </a>
  `;
}

