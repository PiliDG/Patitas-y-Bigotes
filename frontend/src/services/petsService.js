import { apiRequest, withQuery } from './apiClient.js';

// Minimal, safe fallback data so the Pets page still works
// if the API is temporarily unavailable (e.g., 5xx or cold starts).
function fallbackPets() {
  return [
    { Id: 101, Nombre: 'Luna', Foto: 'https://placehold.co/640x426?text=Luna', EspecieRaza: 'Perro Mestizo', Sexo: 'hembra', Edad: 2, Peso: 9.5, EstadoSalud: 'Apto para adopciÃ³n', EstadoSolicitud: '', Descripcion: '' },
    { Id: 102, Nombre: 'Michi', Foto: 'https://placehold.co/640x426?text=Michi', EspecieRaza: 'Gato', Sexo: 'macho', Edad: 1, Peso: 4.2, EstadoSalud: 'En tratamiento', EstadoSolicitud: '', Descripcion: '' },
    { Id: 103, Nombre: 'Toby', Foto: 'https://placehold.co/640x426?text=Toby', EspecieRaza: 'Perro Ovejero', Sexo: 'macho', Edad: 3, Peso: 24, EstadoSalud: 'Apto para adopciÃ³n', EstadoSolicitud: '', Descripcion: '' },
    { Id: 104, Nombre: 'Mora', Foto: 'https://placehold.co/640x426?text=Mora', EspecieRaza: 'Gata Siamesa', Sexo: 'hembra', Edad: 4, Peso: 4.6, EstadoSalud: 'Pendiente de control', EstadoSolicitud: '', Descripcion: '' },
    { Id: 105, Nombre: 'Rocco', Foto: 'https://placehold.co/640x426?text=Rocco', EspecieRaza: 'Perro Pitbull', Sexo: 'macho', Edad: 5, Peso: 28, EstadoSalud: 'En tratamiento', EstadoSolicitud: '', Descripcion: '' },
    { Id: 106, Nombre: 'Kira', Foto: 'https://placehold.co/640x426?text=Kira', EspecieRaza: 'Perra Labrador', Sexo: 'hembra', Edad: 2, Peso: 20, EstadoSalud: 'Apto para adopciÃ³n', EstadoSolicitud: '', Descripcion: '' },
  ];
}

// Simple cache to avoid slow first paints and cold starts
let _petsCache = null;
let _petsTs = 0;

function _storeCache(list) {
  _petsCache = Array.isArray(list) ? list : [];
  _petsTs = Date.now();
  try { sessionStorage.setItem('pets_all', JSON.stringify(_petsCache)); } catch {}
  try { sessionStorage.setItem('pets_ts', String(_petsTs)); } catch {}
}
try {
  const fromSS = sessionStorage.getItem('pets_all');
  if (fromSS) {
    const parsed = JSON.parse(fromSS);
    // Ignore stale empty arrays; force fresh fetch instead
    if (Array.isArray(parsed) && parsed.length > 0) {
      _petsCache = parsed;
      try { _petsTs = parseInt(sessionStorage.getItem('pets_ts') || '0', 10) || 0; } catch { _petsTs = 0; }
    } else {
      _petsCache = null;
      try { sessionStorage.removeItem('pets_all'); } catch {}
    }
  }
} catch {}

// Forzar invalidaciÃ³n de cachÃ© en memoria y sessionStorage
export function invalidatePetsCache() {
  _petsCache = null;
  _petsTs = 0;
  try { sessionStorage.removeItem('pets_all'); } catch {}
  try { sessionStorage.removeItem('pets_ts'); } catch {}
}

// Recarga directa desde API ignorando cachÃ©; actualiza sessionStorage y emite evento
export async function reloadPets() {
  const data = await apiRequest('/api/animales?limit=1000');
  const list = Array.isArray(data?.animales) ? data.animales : [];
  _storeCache(list);
  try { window.dispatchEvent(new CustomEvent('pets:updated')); } catch {}
  return list;
}

// RevalidaciÃ³n en segundo plano para reemplazar fallback por la lista real
let _revalidating = false;
async function _revalidateInBackground() {
  if (_revalidating) return;
  _revalidating = true;
  try {
    const data = await apiRequest('/api/animales?limit=1000');
    const list = Array.isArray(data?.animales) ? data.animales : [];
    if (list.length) {
      _storeCache(list);
      try { window.dispatchEvent(new CustomEvent('pets:updated')); } catch {}
    }
  } catch {}
  _revalidating = false;
}

export async function getAllPets() {
  if (Array.isArray(_petsCache) && _petsCache.length) {
    // trigger background revalidation if cache is older than 60s
    const ts = _petsTs || (parseInt(sessionStorage.getItem('pets_ts') || '0', 10) || 0);
    if (ts && (Date.now() - ts > 60_000)) {
      try { setTimeout(_revalidateInBackground, 10); } catch {}
    }
    return _petsCache;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => { try { controller.abort(); } catch {} }, 6000);
  try {
    const data = await apiRequest('/api/animales?limit=1000', { signal: controller.signal });
    clearTimeout(timeout);
    const list = data?.animales || [];
    if (!Array.isArray(list) || list.length === 0) {
      console.warn('[petsService] Lista vacÃ­a desde API; usando fallback temporal');
      const fb = fallbackPets();
      _storeCache(fb);
      return fb;
    }
    _storeCache(list);
    return list;
  } catch (err) {
    clearTimeout(timeout);
    const status = err?.status || 0;
    const msg = String(err?.message || '').toLowerCase();
    if (status >= 500 || msg.includes('failed to fetch') || msg.includes('abort') || msg.includes('timeout') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      const fb = fallbackPets();
      _storeCache(fb);
      // Lanzar revalidaciÃ³n en segundo plano para reemplazar por la lista completa
      try { setTimeout(_revalidateInBackground, 50); } catch {}
      return fb;
    }
    if (Array.isArray(_petsCache) && _petsCache.length) return _petsCache;
    throw err;
  }
}

export async function searchPets(filters = {}) {
  const path = withQuery('/api/animales/buscar', filters);
  // Helpers para hacer la bÃºsqueda local mÃ¡s inteligente
  const norm = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const speciesTokens = (p) => {
    const mix = norm(`${p.Especie || ''} ${p.Raza || ''} ${p.EspecieRaza || ''} ${p.Descripcion || ''} ${p.Nombre || ''}`);
    const tokens = [];
    // Perro / canino
    if (/\b(perr|can|ovejer|labrador|beagle|pitbull|dalmata|dÃ¡lmata|husky|golden|pastor|boxer|cocker|beagle|collie)\b/.test(mix)) {
      tokens.push('perro', 'can', 'canino');
    }
    // Gato / felino / michi
    if (/\b(gat|felin|siam|persa|maine|ragdoll|bengal|angora|manx|sphynx|michi)\b/.test(mix)) {
      tokens.push('gato', 'felino', 'michi');
    }
    return Array.from(new Set(tokens));
  };
  const buildBlob = (p) => `${norm(`${p.Nombre || ''} ${p.Especie || ''} ${p.Raza || ''} ${p.EspecieRaza || ''} ${p.Descripcion || ''} ${p.EstadoSalud || ''}`)} ${speciesTokens(p).join(' ')}`.trim();
  try {
    const data = await apiRequest(path);
    let list = Array.isArray(data?.animales) ? data.animales : [];
    // Si la API no devuelve resultados, aplicar bÃºsqueda local en el cache/lista completa
    if (!list.length) {
      try {
        const all = await getAllPets();
        const qRaw = (filters.q || '').toString();
        const q = norm(qRaw).trim();
        const stem = q.replace(/(os|as|o|a|s)$/,''); // perro/perra/perros â†’ perr
        const isAnimalRoot = /^(perr|gat|felin|can)/.test(stem);
        if (q) {
          const textOf = (p) => buildBlob(p);
          list = all.filter((p) => {
            const t = textOf(p);
            if (t.includes(q)) return true;
            if (isAnimalRoot) return t.includes(stem); // ej.: perro/perra â†’ perr
            return false;
          });
        } else {
          list = all;
        }
      } catch { /* si falla, devolver vacÃ­o */ }
    }
    return list;
  } catch (err) {
    const status = err?.status || 0;
    // Para errores 5xx o sin conectividad, aplicar fallback local
    if (status >= 500 || String(err?.message || '').includes('502') || String(err?.message || '').includes('failed to fetch')) {
      const qRaw = (filters.q || '').toString();
      const text = norm(qRaw);
      const stem = text.replace(/(os|as|o|a|s)$/,'');
      const isAnimalRoot = /^(perr|gat|felin|can)/.test(stem);
      const sexo = (filters.sexo || '').toString().toLowerCase();
      const estado = (filters.estado || '').toString().toLowerCase();
      const edadMin = filters.edadMin ? parseInt(filters.edadMin, 10) : undefined;
      const edadMax = filters.edadMax ? parseInt(filters.edadMax, 10) : undefined;
      let list = fallbackPets();
      const textOf = (p) => buildBlob(p);
      if (text) list = list.filter((p) => {
        const t = textOf(p);
        if (t.includes(text)) return true;
        if (isAnimalRoot) return t.includes(stem);
        return false;
      });
      if (sexo) list = list.filter(p => (p.Sexo || '').toLowerCase() === sexo);
      if (estado) list = list.filter(p => (p.EstadoSalud || '').toLowerCase().includes(estado));
      if (Number.isInteger(edadMin)) list = list.filter(p => (p.Edad ?? 0) >= edadMin);
      if (Number.isInteger(edadMax)) list = list.filter(p => (p.Edad ?? 0) <= edadMax);
      return list;
    }
    // Para 404 u otros, intentar una bÃºsqueda local sobre la lista completa
    try {
      const all = await getAllPets();
      const q = norm((filters.q || '').toString());
      const stem = q.replace(/(os|as|o|a|s)$/,'');
      const isAnimalRoot = /^(perr|gat|felin|can)/.test(stem);
      if (q) {
        const textOf = (p) => buildBlob(p);
        return all.filter((p) => {
          const t = textOf(p);
          if (t.includes(q)) return true;
          if (isAnimalRoot) return t.includes(stem);
          return false;
        });
      }
      return all;
    } catch {
      throw err;
    }
  }
}

export async function createPet(payload) {
  return apiRequest('/api/animales', {
    method: 'POST',
    body: payload
  });
}

export async function updatePet(id, payload) {
  return apiRequest(`/api/animales/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function deactivatePet(id) {
  return apiRequest(`/api/animales/${id}/baja`, {
    method: 'POST'
  });
}

export async function getPetById(id) {
  const animals = await getAllPets();
  const pet = animals.find((item) => String(item.Id) === String(id));
  if (!pet) {
    const error = new Error('Mascota no encontrada');
    error.status = 404;
    throw error;
  }
  return pet;
}

// Subida de foto para un animal: devuelve URL relativa servida por el backend
export async function uploadAnimalPhoto(animalId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await apiRequest(`/api/animales/${encodeURIComponent(animalId)}/fotos`, {
    method: 'POST',
    body: form,
    headers: { /* Dejar que el navegador ponga boundary multipart */ },
  });
  return res?.url || '';
}

