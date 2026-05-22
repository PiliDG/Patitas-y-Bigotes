import { navigateTo } from '../router.js';
import { setState } from '../state/store.js';
import { logoutUser } from '../state/auth.js';
import { ROUTE_NAMES } from '../config.js';
import { getRoleLabel } from '../utils/roles.js';

function navLink(label, path, currentPath) {
  const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path));
  return `
    <li>
      <a href="${path}" data-nav-link class="nav-link${isActive ? ' is-active' : ''}">
        ${label}
      </a>
    </li>
  `;
}

export default function renderNavbar(container, state) {
  const currentPath = state?.route || window.location.pathname;
  const role = (state?.role || 'public').toLowerCase();
  const user = state?.user || null;

  let roleLinks = '';
  if (role === 'adoptante') {
    roleLinks += navLink('Mis solicitudes', ROUTE_NAMES.dashboardAdopter, currentPath);
  } else if (role === 'operador') {
    roleLinks += navLink('Panel Operador', ROUTE_NAMES.dashboardOperator, currentPath);
  } else if (role === 'veterinario') {
    roleLinks += navLink('Panel Clínica', ROUTE_NAMES.dashboardVet, currentPath);
  }

  const initials = (() => {
    const name = (user?.Nombre || user?.nombre || user?.Email || '').trim();
    if (!name) return '::';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  const navHtml = `
    <header class="site-header" role="banner">
      <div class="topbar">
        <button class="menu-toggle" data-menu-toggle aria-expanded="false" aria-controls="site-menu">
          <span class="sr-only">Abrir menu</span>
          <span class="menu-icon"></span>
        </button>
        <a href="/" class="brand" data-nav-link>
          <img src="/assets/logo.png" alt="Patitas y Bigotes" onerror="this.src='/assets/logo-fallback.png'" />
          <span class="brand-copy">
            <strong>Patitas y Bigotes</strong>
            <span>Adopciones responsables</span>
          </span>
        </a>
        <div class="actions">
          <button type="button" class="icon-button" data-open-search aria-label="Abrir busqueda global">
            <span class="icon material-symbols-outlined" aria-hidden="true">search</span>
          </button>
          ${user ? `
          <div class="profile" data-profile>
            <button type="button" class="icon-button profile-toggle" data-profile-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="profile-menu" title="Cuenta">
              <span class="avatar" aria-hidden="true">${initials}</span>
              <span class="sr-only">Abrir menu de perfil</span>
            </button>
            <div class="profile-menu" id="profile-menu" role="menu" hidden>
              <button type="button" class="link-button" data-logout>Cerrar sesión</button>
            </div>
          </div>
          ` : `
          <button type="button" class="link-button" data-nav="${ROUTE_NAMES.signin}">Sign In</button>
          <button type="button" class="link-button" data-nav="${ROUTE_NAMES.login}">Log In</button>
          `}
          <button type="button" class="icon-button" data-open-help aria-label="Abrir ayuda">
            <span class="icon material-symbols-outlined" aria-hidden="true">support_agent</span>
          </button>
        </div>
      </div>
      <nav class="primary-nav" id="site-menu" aria-label="Principal">
        <ul>
          ${navLink('Donaciones', ROUTE_NAMES.donations, currentPath)}
          ${navLink('Nuestras Mascotas', ROUTE_NAMES.pets, currentPath)}
          ${navLink('Adoptar', ROUTE_NAMES.adopt, currentPath)}
          ${navLink('Contacto', ROUTE_NAMES.contact, currentPath)}
          ${roleLinks}
        </ul>
      </nav>
      <div class="role-chip" role="status">${getRoleLabel(state?.role)}</div>
    </header>
  `;
  container.innerHTML = navHtml;

  const menuToggle = container.querySelector('[data-menu-toggle]');
  const nav = container.querySelector('#site-menu');
  let closeMenu = null;
  if (menuToggle && nav) {
    let hoverTimeout = null;

    const setMenuOpen = (open) => {
      menuToggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };

    closeMenu = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      setMenuOpen(false);
    };

    const onToggleClick = () => {
      const isOpen = nav.classList.contains('is-open');
      setMenuOpen(!isOpen);
    };

    menuToggle.addEventListener('click', onToggleClick);

    const canHover = window.matchMedia('(hover: hover)').matches;
    if (canHover) {
      const cancelClose = () => {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
      };

      const scheduleClose = () => {
        cancelClose();
        hoverTimeout = window.setTimeout(closeMenu, 150);
      };

      menuToggle.addEventListener('mouseenter', () => {
        cancelClose();
        setMenuOpen(true);
      });

      menuToggle.addEventListener('mouseleave', scheduleClose);
      nav.addEventListener('mouseenter', cancelClose);
      nav.addEventListener('mouseleave', scheduleClose);
    }
  }

  container.querySelectorAll('[data-nav-link], [data-nav]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const href = el.getAttribute('href') || el.dataset.nav;
      if (!href) return;
      const url = new URL(href, window.location.origin);
      if (closeMenu) {
        closeMenu();
      } else {
        if (nav) {
          nav.classList.remove('is-open');
        }
        if (menuToggle) {
          menuToggle.setAttribute('aria-expanded', 'false');
        }
      }
      navigateTo(url.pathname + url.search);
    });
  });

  const searchBtn = container.querySelector('[data-open-search]');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      setState({ searchOpen: true });
    });
  }
  const helpBtn = container.querySelector('[data-open-help]');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      setState({ helpOpen: true });
    });
  }

  // Profile menu behavior (only if authenticated)
  const profile = container.querySelector('[data-profile]');
  let docClickHandler = null;
  if (profile) {
    const toggle = profile.querySelector('[data-profile-toggle]');
    const menu = profile.querySelector('.profile-menu');
    const setOpen = (open) => {
      if (!toggle || !menu) return;
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      if (open) {
        menu.removeAttribute('hidden');
      } else {
        menu.setAttribute('hidden', '');
      }
    };
    docClickHandler = (ev) => {
      if (!profile.contains(ev.target)) setOpen(false);
    };
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = toggle.getAttribute('aria-expanded') === 'true';
        setOpen(!isOpen);
      });
    }
    document.addEventListener('click', docClickHandler, { passive: true });

    const logoutBtn = profile.querySelector('[data-logout]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (ev) => {
        // Evitar que el handler global de click cierre el menú
        // antes de completar la acción o que un enlace navegue.
        try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
        try {
          await logoutUser();
        } finally {
          setOpen(false);
          navigateTo('/');
        }
      });
    }
  }

  return () => {
    if (menuToggle) menuToggle.replaceWith(menuToggle.cloneNode(true));
    if (docClickHandler) document.removeEventListener('click', docClickHandler);
  };
}
