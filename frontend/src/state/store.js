const subscribers = new Set();

let state = {
  user: null,
  role: 'public',
  loading: false,
  searchOpen: false,
  helpOpen: false,
  route: '/',
  routeParams: {},
  flash: null,
  searchQuery: '',
  searchError: null,
  searchResults: {
    mascotas: [],
    historias: [],
    faqs: []
  }
};

export function getState() {
  return state;
}

export function setState(update) {
  const nextState = typeof update === 'function' ? update(state) : { ...state, ...update };
  state = nextState;
  subscribers.forEach((listener) => listener(state));
  return state;
}

export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function clearFlash() {
  setState((current) => ({ ...current, flash: null }));
}
