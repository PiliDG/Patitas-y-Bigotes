import { API_BASE_URL } from '../config.js';

const defaultHeaders = {
  Accept: 'application/json'
};

function buildUrl(path) {
  if (!path.startsWith('http')) {
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/$/, '') : '';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (!base) {
      return normalizedPath;
    }
    return `${base}${normalizedPath}`;
  }
  return path;
}

async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : null;
  if (!response.ok || (data && data.error)) {
    const message = data?.message || `Error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

export async function apiRequest(path, options = {}) {
  const url = buildUrl(path);
  const { headers, body, ...rest } = options;
  const requestInit = {
    method: options.method || 'GET',
    credentials: 'include',
    headers: Object.assign({}, defaultHeaders, headers || {}),
    body: undefined,
    ...rest
  };

  // Smart body handling: support JSON and FormData/Blob transparently
  const isGetLike = (requestInit.method === 'GET' || requestInit.method === 'HEAD');
  if (!isGetLike && body !== undefined && body !== null) {
    const isFormData = (typeof FormData !== 'undefined') && body instanceof FormData;
    const isBlob = (typeof Blob !== 'undefined') && body instanceof Blob;
    const isURLParams = (typeof URLSearchParams !== 'undefined') && body instanceof URLSearchParams;
    if (isFormData || isBlob || isURLParams) {
      // Let the browser set the correct Content-Type (boundary) for FormData
      // or the appropriate type for Blob/URLSearchParams
      requestInit.body = body;
      // Remove any JSON content-type header that might have been set by default
      if (requestInit.headers && requestInit.headers['Content-Type']) {
        delete requestInit.headers['Content-Type'];
      }
    } else if (typeof body === 'string') {
      requestInit.body = body;
      // If caller passed a raw string, assume they set proper headers
    } else {
      // Fallback to JSON
      requestInit.headers = Object.assign({ 'Content-Type': 'application/json' }, requestInit.headers || {});
      requestInit.body = JSON.stringify(body);
    }
  }

  if (isGetLike) {
    delete requestInit.body;
  }

  try {
    const response = await fetch(url, requestInit);
    return await handleResponse(response);
  } catch (error) {
    if (error.name === 'TypeError' && !navigator.onLine) {
      const offline = new Error('Sin conexión. Reintentá cuando tengas internet.');
      offline.cause = error;
      throw offline;
    }
    throw error;
  }
}

export function withQuery(path, params = {}) {
  const base = API_BASE_URL || window.location.origin;
  const url = new URL(path, base);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, value);
  });
  return url.pathname + (url.search ? url.search : '');
}
