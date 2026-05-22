import { getState, setState } from './state/store.js';
import { requireRole } from './state/auth.js';

const routes = [];
let notFoundRoute = null;
let onRouteChange = null;

function normalize(pathname) {
  if (!pathname) return '/';
  if (pathname !== '/' && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '');
  }
  return pathname || '/';
}

function compilePattern(pattern) {
  const segments = normalize(pattern).split('/').filter(Boolean);
  return segments.map((segment) => {
    if (segment.startsWith(':')) {
      return { dynamic: true, name: segment.slice(1) };
    }
    return { dynamic: false, name: segment };
  });
}

function findMatch(pathname) {
  const urlPath = normalize(pathname);
  const pathSegments = urlPath.split('/').filter(Boolean);

  for (const route of routes) {
    if (route.path === '*' || route.path === '/404') continue;
    const pattern = route._compiled || compilePattern(route.path);
    route._compiled = pattern;
    if (pattern.length !== pathSegments.length) {
      continue;
    }
    const params = {};
    let matched = true;
    for (let i = 0; i < pattern.length; i += 1) {
      const segment = pattern[i];
      const value = pathSegments[i];
      if (segment.dynamic) {
        params[segment.name] = decodeURIComponent(value);
      } else if (segment.name !== value) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;

    const allowed = !route.roles || route.roles.length === 0 || requireRole(route.roles);
    if (!allowed) {
      return { route: null, params: {}, redirect: route.fallback || '/login' };
    }

    return { route, params };
  }

  if (notFoundRoute) {
    return { route: notFoundRoute, params: {} };
  }

  return { route: null, params: {}, redirect: '/' };
}

function emitRouteChange(match, url) {
  const stateParams = {
    route: match?.route?.path || normalize(url.pathname),
    routeParams: match?.params || {},
    query: Object.fromEntries(url.searchParams.entries())
  };
  setState((current) => ({ ...current, ...stateParams }));
  if (typeof onRouteChange === 'function') {
    onRouteChange({ ...match, url });
  }
}

export function defineRoutes(routeList) {
  routes.splice(0, routes.length, ...routeList);
  notFoundRoute = routeList.find((route) => route.path === '/404' || route.path === '*') || null;
}

export function navigateTo(path, { replace = false } = {}) {
  const url = new URL(path, window.location.origin);
  const match = findMatch(url.pathname);
  if (match.redirect) {
    if (url.pathname !== match.redirect) {
      navigateTo(match.redirect, { replace: true });
    }
    return match;
  }

  if (replace) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
  emitRouteChange(match, url);
  return match;
}

export function initRouter(listener) {
  onRouteChange = listener;
  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    const match = findMatch(url.pathname);
    if (match.redirect) {
      navigateTo(match.redirect, { replace: true });
      return;
    }
    emitRouteChange(match, url);
  });

  const initialUrl = new URL(window.location.href);
  const initialMatch = findMatch(initialUrl.pathname);
  if (initialMatch.redirect) {
    navigateTo(initialMatch.redirect, { replace: true });
    return;
  }
  emitRouteChange(initialMatch, initialUrl);
}

export function isActiveRoute(pathname) {
  const state = getState();
  return normalize(state.route) === normalize(pathname);
}

export function resolveLink(pathname) {
  return new URL(pathname, window.location.origin).pathname;
}