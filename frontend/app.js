// ConfiguraciÃ³n del endpoint del backend
// Si defines window.API_URL, se usa esa; de lo contrario, usa mismo origen ("" relativo)
const API_URL = (typeof window !== 'undefined' && window.API_URL) || '';

// Flags de depuración para mostrar controles en la UI (ocultos por defecto)
const SHOW_ROLE_REFRESH = !!(typeof window !== 'undefined' && window.SHOW_ROLE_REFRESH);
const SHOW_ROLE_BADGE = !!(typeof window !== 'undefined' && window.SHOW_ROLE_BADGE);

const out = (m) => (document.getElementById('output').textContent = m);
const $ = (id) => document.getElementById(id);

const feedbackEl = document.getElementById("feedback");
let feedbackTimer = null;

function clearMessage() {
  if (!feedbackEl) return;
  feedbackEl.classList.add("hidden");
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
}

function showMessage(type, message, duration = 5000) {
  if (!feedbackEl) return;
  feedbackEl.className = "toast " + (type || "info");
  feedbackEl.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = message;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "toast-close";
  btn.textContent = "Cerrar";
  btn.addEventListener("click", clearMessage);
  feedbackEl.append(span, btn);
  feedbackEl.classList.remove("hidden");
  if (feedbackTimer) clearTimeout(feedbackTimer);
  if (duration > 0) {
    feedbackTimer = setTimeout(() => {
      feedbackEl.classList.add("hidden");
      feedbackTimer = null;
    }, duration);
  }
}

function setBusy(button, busy, loadingText = "Procesando...") {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.classList.add("is-loading");
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

const searchResultsEl = document.getElementById("searchResults");
const showcaseListEl = document.getElementById("showcaseList");
const showcaseEmptyEl = document.getElementById("showcaseEmpty");
const pageButtons = Array.from(document.querySelectorAll('.nav-btn'));
// Oculta elementos de depuración si no están habilitados
(function setupDebugControls(){
  try {
    const btn = document.getElementById('btnRefreshRole');
    if (btn && !SHOW_ROLE_REFRESH) btn.classList.add('hidden');
    const badge = document.getElementById('roleBadge');
    if (badge && !SHOW_ROLE_BADGE) badge.classList.add('hidden');
  } catch (_) {}
})();

function renderAnimalResults(items) {
  if (!searchResultsEl) return;
  searchResultsEl.innerHTML = "";
  if (!items || !items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No se encontraron animales.";
    searchResultsEl.appendChild(empty);
    return;
  }
  items.forEach(animal => {
    const card = document.createElement("article");
    card.className = "card";
    if (animal.Foto) {
      const img = document.createElement("img");
      img.src = animal.Foto;
      img.alt = animal.Nombre || "Animal";
      img.className = "card-img";
      card.appendChild(img);
    }
    const title = document.createElement("h3");
    title.textContent = animal.Nombre || "Sin nombre";
    card.appendChild(title);
    const meta = document.createElement("small");
    meta.textContent = [animal.EspecieRaza, animal.Sexo].filter(Boolean).join(" · ");
    if (meta.textContent) card.appendChild(meta);
    if (animal.EstadoSalud) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = animal.EstadoSalud;
      card.appendChild(badge);
    }
    if (animal.Descripcion) {
      const desc = document.createElement("p");
      desc.textContent = animal.Descripcion;
      card.appendChild(desc);
    }
    if (animal.Origen) {
      const origen = document.createElement("p");
      origen.textContent = "Origen: " + animal.Origen;
      card.appendChild(origen);
    }
    searchResultsEl.appendChild(card);
  });
}

function renderShowcaseAnimals(items) {
  if (!showcaseListEl) return;
  showcaseListEl.innerHTML = "";
  if (!items || !items.length) {
    if (showcaseEmptyEl) showcaseEmptyEl.classList.remove("hidden");
    return;
  }
  if (showcaseEmptyEl) showcaseEmptyEl.classList.add("hidden");
  items.slice(0, 6).forEach(animal => {
    const card = document.createElement("article");
    card.className = "card";
    if (animal.Foto) {
      const img = document.createElement("img");
      img.src = animal.Foto;
      img.alt = animal.Nombre || "Animal";
      img.className = "card-img";
      card.appendChild(img);
    }
    const title = document.createElement("h3");
    title.textContent = animal.Nombre || "Sin nombre";
    card.appendChild(title);
    if (animal.EspecieRaza || animal.Sexo) {
      const meta = document.createElement("small");
      meta.textContent = [animal.EspecieRaza, animal.Sexo].filter(Boolean).join(" · ");
      card.appendChild(meta);
    }
    if (animal.Descripcion) {
      const desc = document.createElement("p");
      desc.textContent = animal.Descripcion;
      card.appendChild(desc);
    }
    if (animal.EstadoSalud) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = animal.EstadoSalud;
      card.appendChild(badge);
    }
    showcaseListEl.appendChild(card);
  });
}
const pages = Array.from(document.querySelectorAll('.page'));
async function loadShowcaseAnimals() {
  if (!showcaseListEl) return;
  showcaseListEl.innerHTML = "";
  const placeholder = document.createElement("p");
  placeholder.className = "empty-state";
  placeholder.textContent = "Cargando animales...";
  showcaseListEl.appendChild(placeholder);
  if (showcaseEmptyEl) showcaseEmptyEl.classList.add("hidden");
  try {
    const res = await apiFetch(`${API_URL}/api/animales`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.message || "No se pudo cargar la lista");
    renderShowcaseAnimals(data.animales || []);
  } catch (e) {
    placeholder.textContent = "Error al cargar animales: " + ((e && e.message) || "Intenta nuevamente");
  }
}
let currentPage = null;

function showPage(pageId) {
  if (!pageId) return false;
  const btn = pageButtons.find(b => b.dataset.page === pageId);
  const page = pages.find(p => p.dataset.page === pageId);
  if (!btn || !page || btn.classList.contains("hidden") || page.classList.contains("hidden")) {
    return false;
  }
  pageButtons.forEach(b => b.classList.toggle("active", b === btn));
  pages.forEach(p => p.classList.toggle("active", p === page));
  currentPage = pageId;
  return true;
}

function ensureActivePage(force = false) {
  if (!force && currentPage) {
    const btn = pageButtons.find(b => b.dataset.page === currentPage);
    const page = pages.find(p => p.dataset.page === currentPage);
    if (btn && page && !btn.classList.contains('hidden') && !page.classList.contains('hidden')) {
      return;
    }
  }
  const fallback = pageButtons.find(b => !b.classList.contains('hidden'));
  if (fallback) {
    showPage(fallback.dataset.page);
  } else {
    pages.forEach(p => p.classList.remove('active'));
    currentPage = null;
  }
}

function setupShortcuts() {
  document.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-go");
      const ok = showPage(target);
      if (!ok) {
        const roleHint = btn.getAttribute("data-role-hint");
        const msg = roleHint ? `Necesitas iniciar sesión como ${roleHint} para acceder.` : "Inicia sesión para acceder a esta sección.";
        showMessage("info", msg, 6000);
        return;
      }
      ensureActivePage();
      const active = document.querySelector(".page.active");
      if (active) {
        active.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function initNavigation() {
  pageButtons.forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });
  const preset = pageButtons.find(btn => btn.classList.contains('active') && !btn.classList.contains('hidden'));
  if (preset) {
    showPage(preset.dataset.page);
  } else {
    ensureActivePage(true);
  }
}
async function apiFetch(url, options = {}) {
  const opts = Object.assign({ credentials: 'include' }, options);
  return fetch(url, opts);
}

function applyRoleGuards(role) {
  const badge = $('roleBadge');
  if (badge) {
    badge.textContent = 'Rol: ' + (role || 'publico');
    if (!SHOW_ROLE_BADGE && (!role || role === 'public')) {
      badge.classList.add('hidden');
    } else {
      badge.classList.remove('hidden');
    }
  }
  document.querySelectorAll('.guard').forEach(el => {
    const roles = (el.getAttribute('data-roles') || '').split(',').map(s => s.trim());
    const allowed = roles.includes('public') || roles.includes(role);
    el.classList.toggle('hidden', !allowed);
    if (!allowed) {
      if (el.classList.contains('nav-btn')) el.classList.remove('active');
      if (el.classList.contains('page')) el.classList.remove('active');
    }
  });
  ensureActivePage();
}

async function refreshRole() {
  try {
    const res = await apiFetch(`${API_URL}/api/auth/me`);
    const data = await res.json();
    const role = data && data.authenticated && data.usuario ? (data.usuario.Tipo || '').toLowerCase() : null;
    applyRoleGuards(role);
  } catch (e) { applyRoleGuards(null); }
}

// --- Listados bÃ¡sicos
async function listarUsuarios() {
  out('Consultando ' + API_URL + '/api/usuarios ...');
  try {
    const res = await apiFetch(`${API_URL}/api/usuarios`);
    const data = await res.json();
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}

async function listarAnimales() {
  out('Consultando ' + API_URL + '/api/animales ...');
  try {
    const res = await apiFetch(`${API_URL}/api/animales`);
    const data = await res.json();
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}

// --- Auth
async function registro(event) {
  if (event) event.preventDefault();
  const btn = event ? event.currentTarget : null;
  const nombre = $("regNombre").value;
  const email = $("regEmail").value;
  const contrasena = $("regPass").value;
  const aceptaTerminos = $("regTerminos").checked;
  try {
    setBusy(btn, true, "Creando...");
    showMessage("info", "Creando cuenta...");
    const res = await apiFetch(`${API_URL}/api/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, contrasena, aceptaTerminos })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.message || "No se pudo crear la cuenta");
    out(JSON.stringify({ message: data.message, token: data.token }, null, 2));
    if (data.token) $("tokenField").value = data.token;
    showMessage("success", data.message || "Cuenta creada. Revisa tu email.");
  } catch (e) {
    const msg = (e && e.message) || "Error inesperado al registrar";
    showMessage("error", msg);
    out("Error: " + msg);
  } finally {
    setBusy(btn, false);
  }
}

async function confirmar(event) {
  if (event) event.preventDefault();
  const btn = event ? event.currentTarget : null;
  const token = $("tokenField").value;
  if (!token) {
    showMessage("error", "Ingresa el token de verificacion");
    return;
  }
  try {
    setBusy(btn, true, "Confirmando...");
    showMessage("info", "Confirmando cuenta...");
    const res = await apiFetch(`${API_URL}/api/auth/confirmar?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.message || "No se pudo confirmar la cuenta");
    out(JSON.stringify(data, null, 2));
    showMessage("success", data.message || "Cuenta confirmada");
  } catch (e) {
    const msg = (e && e.message) || "Error inesperado al confirmar";
    showMessage("error", msg);
    out("Error: " + msg);
  } finally {
    setBusy(btn, false);
  }
}

document.getElementById('btnRegistro').addEventListener('click', registro);
document.getElementById('btnConfirmar').addEventListener('click', confirmar);
document.getElementById('btnListUsuarios').addEventListener('click', listarUsuarios);
document.getElementById('btnListAnimales').addEventListener('click', listarAnimales);

// Login / Logout / Promote
async function login(event) {
  if (event) event.preventDefault();
  const btn = event ? event.currentTarget : null;
  const email = $("loginEmail").value;
  const contrasena = $("loginPass").value;
  try {
    setBusy(btn, true, "Ingresando...");
    showMessage("info", "Iniciando sesion...");
    const res = await apiFetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, contrasena })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.message || "Credenciales invalidas");
    out(JSON.stringify(data, null, 2));
    showMessage("success", data.message || "Sesion iniciada");
    refreshRole();
  } catch (e) {
    const msg = (e && e.message) || "No se pudo iniciar sesion";
    showMessage("error", msg);
    out("Error: " + msg);
  } finally {
    setBusy(btn, false);
  }
}
async function logout(event) {
  if (event) event.preventDefault();
  const btn = event ? event.currentTarget : null;
  try {
    setBusy(btn, true, "Cerrando...");
    showMessage("info", "Cerrando sesion...");
    const res = await apiFetch(`${API_URL}/api/auth/logout`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.message || "No se pudo cerrar la sesion");
    out(JSON.stringify(data, null, 2));
    showMessage("success", data.message || "Sesion finalizada");
    refreshRole();
  } catch (e) {
    const msg = (e && e.message) || "Error al cerrar sesion";
    showMessage("error", msg);
    out("Error: " + msg);
  } finally {
    setBusy(btn, false);
  }
}
async function promote(event) {
  if (event) event.preventDefault();
  const btn = event ? event.currentTarget : null;
  const Tipo = $("promoteTipo").value;
  try {
    setBusy(btn, true, "Actualizando...");
    showMessage("info", "Actualizando rol...");
    const res = await apiFetch(`${API_URL}/api/auth/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Tipo })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.message || "No se pudo actualizar el rol");
    out(JSON.stringify(data, null, 2));
    showMessage("success", data.message || "Rol actualizado");
    refreshRole();
  } catch (e) {
    const msg = (e && e.message) || "Error al actualizar el rol";
    showMessage("error", msg);
    out("Error: " + msg);
  } finally {
    setBusy(btn, false);
  }
}
$('btnLogin').addEventListener('click', login);
$('btnLogout').addEventListener('click', logout);
$('btnPromote').addEventListener('click', promote);
// El botón de refrescar rol es opcional (se oculta por defecto)
try { const _b = $('btnRefreshRole'); if (_b) _b.addEventListener('click', refreshRole); } catch (_) {}

// --- Entregador - Aviso de entrega (Option A)
async function avisoEntrega(event) {
  if (event) event.preventDefault();
  const btn = event ? event.currentTarget : null;
  const body = {
    nombre: $("eNombre").value,
    contacto: $("eContacto").value,
    ubicacion: $("eUbic").value,
    foto: $("eFoto").value,
    descripcion: $("eDesc").value,
  };
  try {
    setBusy(btn, true, "Enviando...");
    showMessage("info", "Enviando aviso de entrega...");
    const res = await apiFetch(`${API_URL}/api/entregas/aviso`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.message || "No se pudo registrar el aviso");
    out(JSON.stringify(data, null, 2));
    showMessage("success", data.message || "Aviso registrado");
  } catch (e) {
    const msg = (e && e.message) || "Error al registrar aviso";
    showMessage("error", msg);
    out("Error: " + msg);
  } finally {
    setBusy(btn, false);
  }
}
async function listAvisos() {
  try {
    const res = await apiFetch(`${API_URL}/api/entregas`);
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error (requiere operador)');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
document.getElementById('btnAvisoEntrega').addEventListener('click', avisoEntrega);
document.getElementById('btnListAvisos').addEventListener('click', listAvisos);

// Convertir aviso -> alta de animal (operador)
async function precargarDesdeAviso() {
  const id = $('eId').value;
  if (!id) return out('IngresÃ¡ un AvisoId');
  try {
    const res = await apiFetch(`${API_URL}/api/entregas/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    const it = data.entrega;
    $('aNombre').value = it.descripcion || '';
    $('aFoto').value = it.foto || '';
    $('aOrigen').value = it.ubicacion || '';
    if (!$('aFechaIngreso').value) {
      const today = new Date().toISOString().slice(0,10);
      $('aFechaIngreso').value = today;
    }
    out('Formulario de Alta precargado desde aviso ' + id + '. RevisÃ¡ y guardÃ¡.');
  } catch (e) { out('Error: ' + e.message); }
}
async function archivarAviso() {
  const id = $('eId').value;
  if (!id) return out('IngresÃ¡ un AvisoId');
  try {
    const res = await apiFetch(`${API_URL}/api/entregas/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
$('btnPrecargarAviso').addEventListener('click', precargarDesdeAviso);
$('btnArchivarAviso').addEventListener('click', archivarAviso);

// --- Animales CU2
async function altaAnimal() {
  const body = {
    Nombre: $('aNombre').value,
    Foto: $('aFoto').value,
    Origen: $('aOrigen').value,
    FechaIngreso: $('aFechaIngreso').value,
    ConfirmarDuplicado: $('aConfirmDup').checked ? 1 : 0
  };
  out('Alta animal...');
  try {
    const res = await apiFetch(`${API_URL}/api/animales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function modAnimal() {
  const id = $('uAnimalId').value;
  const body = { Nombre: $('uNombre').value, Foto: $('uFoto').value };
  try {
    const res = await apiFetch(`${API_URL}/api/animales/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function bajaAnimal() {
  const id = $('bAnimalId').value;
  try {
    const res = await apiFetch(`${API_URL}/api/animales/${encodeURIComponent(id)}/baja`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
$('btnAltaAnimal').addEventListener('click', altaAnimal);
$('btnModAnimal').addEventListener('click', modAnimal);
$('btnBajaAnimal').addEventListener('click', bajaAnimal);

// --- Control sanitario CU3
async function controlSanitario() {
  const body = {
    AnimalId: parseInt($('cAnimalId').value || '0', 10),
    Fecha: $('cFecha').value,
    Diagnostico: $('cDiag').value,
    Resultado: $('cRes').value,
    ProximaCita: $('cProx').value
  };
  out('Registrando control...');
  try {
    const res = await apiFetch(`${API_URL}/api/controles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
$('btnControl').addEventListener('click', controlSanitario);

// --- BÃºsqueda CU4
async function buscar(event) {
  if (event) event.preventDefault();
  const btn = event ? event.currentTarget : null;
  const p = new URLSearchParams();
  const vals = {
    especie: $("qEspecie").value,
    sexo: $("qSexo").value,
    estado: $("qEstado").value,
    edadMin: $("qEdadMin").value,
    edadMax: $("qEdadMax").value,
    q: $("qTexto").value,
  };
  Object.keys(vals).forEach(k => { if (vals[k]) p.set(k, vals[k]); });
  try {
    setBusy(btn, true, "Buscando...");
    showMessage("info", "Buscando animales...");
    const res = await apiFetch(`${API_URL}/api/animales/buscar?${p.toString()}`);
    const data = await res.json();
    if (!res.ok || data.error) {
      renderAnimalResults([]);
      throw new Error(data.message || "No se encontraron animales");
    }
    const list = data.animales || [];
    renderAnimalResults(list);
    out(JSON.stringify(data, null, 2));
    showMessage("success", list.length === 1 ? "Se encontro 1 animal" : ("Se encontraron " + list.length + " animales"));
  } catch (e) {
    const msg = (e && e.message) || "Error al buscar animales";
    showMessage("error", msg);
    out("Error: " + msg);
  } finally {
    setBusy(btn, false);
  }
}
$('btnBuscar').addEventListener('click', buscar);

// --- Solicitudes CU5/6 (adoptante)
async function altaSolicitud() {
  const body = { AnimalId: parseInt($('sAnimalId').value || '0', 10), AceptaTerminos: $('sAcepta').checked };
  try {
    const res = await apiFetch(`${API_URL}/api/solicitudes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function listSolicitudes() {
  try {
    const res = await apiFetch(`${API_URL}/api/solicitudes`);
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function modSolicitud() {
  const sid = $('sid').value;
  const body = { Comentarios: $('sComentarios').value };
  try {
    const res = await apiFetch(`${API_URL}/api/solicitudes/${encodeURIComponent(sid)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function cancelSolicitud() {
  const sid = $('sid').value;
  const body = { Motivo: $('sMotivoCancel').value };
  try {
    const res = await apiFetch(`${API_URL}/api/solicitudes/${encodeURIComponent(sid)}/cancelar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
$('btnAltaSol').addEventListener('click', altaSolicitud);
$('btnListSol').addEventListener('click', listSolicitudes);
$('btnModSol').addEventListener('click', modSolicitud);
$('btnCancelSol').addEventListener('click', cancelSolicitud);

// --- GestiÃ³n Operador CU6 (revisiÃ³n/aprobar/rechazar/anular)
async function ponerRevision() {
  const sid = $('sidOp').value;
  try {
    const res = await apiFetch(`${API_URL}/api/solicitudes/${encodeURIComponent(sid)}/poner-en-revision`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function aprobarSol() {
  const sid = $('sidOp').value;
  try {
    const res = await apiFetch(`${API_URL}/api/solicitudes/${encodeURIComponent(sid)}/aprobar`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function rechazarSol() {
  const sid = $('sidOp').value;
  const body = { Motivo: $('sMotivoRech').value };
  try {
    const res = await apiFetch(`${API_URL}/api/solicitudes/${encodeURIComponent(sid)}/rechazar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function anularSol() {
  const sid = $('sidOp').value;
  const body = { Motivo: $('sMotivoAnu').value };
  try {
    const res = await apiFetch(`${API_URL}/api/solicitudes/${encodeURIComponent(sid)}/anular`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
$('btnRevSol').addEventListener('click', ponerRevision);
$('btnAprSol').addEventListener('click', aprobarSol);
$('btnRechSol').addEventListener('click', rechazarSol);
$('btnAnuSol').addEventListener('click', anularSol);

// --- Visitas CU7
async function programarVisita() {
  const body = { SolicitudId: parseInt($('vSolId').value || '0', 10), FechaHoraVisita: $('vFecha').value };
  try {
    const res = await apiFetch(`${API_URL}/api/visitas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function reprogramarVisita() {
  const vid = $('vId').value;
  const body = { FechaHoraVisita: $('vFechaNew').value };
  try {
    const res = await apiFetch(`${API_URL}/api/visitas/${encodeURIComponent(vid)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function cancelarVisita() {
  const vid = $('vId').value;
  try {
    const res = await apiFetch(`${API_URL}/api/visitas/${encodeURIComponent(vid)}/cancelar`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
$('btnProgVis').addEventListener('click', programarVisita);
$('btnReprogVis').addEventListener('click', reprogramarVisita);
$('btnCancelVis').addEventListener('click', cancelarVisita);

// --- Seguimientos CU8
async function altaSeg() {
  const body = { SolicitudId: parseInt($('gSolId').value || '0', 10), FechaSeguimiento: $('gFecha').value, Observaciones: $('gObs').value };
  try {
    const res = await apiFetch(`${API_URL}/api/seguimientos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function modSeg() {
  const sid = $('gId').value;
  const body = { Observaciones: $('gObsNew').value };
  try {
    const res = await apiFetch(`${API_URL}/api/seguimientos/${encodeURIComponent(sid)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
async function cancelSeg() {
  const sid = $('gId').value;
  try {
    const res = await apiFetch(`${API_URL}/api/seguimientos/${encodeURIComponent(sid)}/cancelar`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || data.error) return out(data.message || 'Error');
    out(JSON.stringify(data, null, 2));
  } catch (e) { out('Error: ' + e.message); }
}
$('btnAltaSeg').addEventListener('click', altaSeg);
$('btnModSeg').addEventListener('click', modSeg);
$('btnCancelSeg').addEventListener('click', cancelSeg);

// Inicializa navegacion y guards
setupShortcuts();
initNavigation();
refreshRole();
loadShowcaseAnimals();








