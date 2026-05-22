# Frontend (Patitas y Bigotes)

Cliente web estatico que se sirve junto al backend Flask o puede publicarse en cualquier hosting estatico.

## Estructura de archivos

```
frontend/
|- index.html        # Maqueta principal + navegacion por paginas/rol
|- app.js            # Logica de UI, llamadas a la API, guards y router basico
|- styles.css        # Estilos y paleta de marca
`- assets/
   |- logo.png       # Logo de marca (coloca tu archivo aqui; minusculas)
   `- logo-fallback.svg
```

Notas:
- El header carga `logo-fallback.svg` por defecto y lo reemplaza por `logo.png` cuando existe.
- El favicon intenta usar `/assets/logo.png` y cae al SVG como respaldo.
- El frontend asume same-origin con el backend; si lo sirves desde otro origen define `window.API_URL` antes de cargar `app.js`.

## Navegacion y roles
- `GET /api/auth/me` determina el rol actual y aplica guardas (`public`, `adoptante`, `operador`, `veterinario`).
- La barra superior expone paginas `General`, `Adoptante`, `Operador` y `Clinica`, mostrando solo las vistas habilitadas para el rol activo.
- Pagina **General**: registro/login, aviso de entrega y busqueda publica de animales.
- Pagina **Adoptante**: alta, listado y gestion de solicitudes propias.
- Pagina **Operador**: ABM de animales, gestion completa de solicitudes y manejo de visitas.
- Pagina **Clinica**: controles sanitarios (veterinario) y seguimientos compartidos (operador/veterinario).
- La consola de salida permanece visible en todo momento para revisar las respuestas de la API.

Botón “Panel” en navbar (según rol)
- Mostrar solo para `operador` y `veterinario`; oculto para `adoptante` y `public`.
- Al hacer clic, navega directamente al panel correspondiente: `Operador` si el rol es operador, `Clinica` si es veterinario.
- Implementación sugerida:
  - Opción simple (HTML): añadir un botón con `class="nav-btn guard"` y `data-roles="operador,veterinario"`, con un atributo `data-go` vacío que se setea en runtime.
  - JS: en `refreshRole()` determinar el rol y establecer `btn.dataset.go = role === 'operador' ? 'operador' : 'clinica'`; también ajustar el texto del botón a “Panel Operador” o “Panel Clínica”.
  - El botón no debe interferir con la lógica existente de `showPage/ensureActivePage` ni mostrarse cuando no corresponda (usa las guardas existentes).

Panel Operador – mejoras de formularios
- Diseño en grilla (`.operator-form` y `.operator-grid`) con 6 columnas responsivas para alinear campos y acciones.
- Controles con etiquetas claras y feedback en `.form-feedback` por operación.
- Secciones: Animales (Alta/Mod/Baja), Solicitudes (acciones), Visitas (alta/mod/cancel), Seguimientos (alta/mod/cancel).
- Estilos en `styles.css`: helpers `.col-2/.col-3/.col-4/.col-6` para controlar el ancho de cada campo.

## Desarrollo local (opcional)
- Servir con Flask (recomendado): `python backend/app.py` y abrir `http://127.0.0.1:5000`.
- Alternativa estatica: `python -m http.server 8000 -d frontend` (define `window.API_URL` apuntando al backend).
## Experiencia de uso
- Los formularios clave muestran estados de carga, exito o error mediante la barra de mensajes superior.
- Los botones se deshabilitan mientras la peticion corre para evitar envios duplicados.
- La busqueda publica renderiza los animales en tarjetas con foto y metadata, manteniendo visible la respuesta cruda en la consola para depuracion.
- La homepage incluye un hero con CTAs y un listado dinamico de animales activos para navegar sin filtros previos.
