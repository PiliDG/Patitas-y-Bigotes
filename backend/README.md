# Backend (Patitas y Bigotes)

API Flask que sirve el frontend y expone endpoints para los casos de uso CU1â€“CU8, respetando el dominio provisto.

## Arquitectura por capas

- Controllers (Flask Blueprints): capa de interfaz (GRASP: Controller).
- Repositories (DBroker): acceso a datos InMemory/SQLite y factorÃ­a por env var.
- Persistence: utilidades de conexiÃ³n/DDL para SQLite.
- Domain: entidades del diagrama (sin dependencias de infraestructura).
- DI Container: composiciÃ³n de repositorios (`build_container`).

## Ãrbol de archivos

```
backend/
â”œâ”€ app.py                     # Ejecutable: python backend/app.py
â””â”€ src/
   â”œâ”€ app.py                  # create_app, static folder y blueprints
   â”œâ”€ controllers/
   â”‚  â”œâ”€ api.py               # /api/status
   â”‚  â”œâ”€ auth.py              # /api/auth/* (registro, login, logout, confirmar, promote, me)
   â”‚  â”œâ”€ usuarios.py          # /api/usuarios
   â”‚  â”œâ”€ animales.py          # /api/animales (+baja, buscar)
   â”‚  â”œâ”€ controles.py         # /api/controles
   â”‚  â”œâ”€ solicitudes.py       # /api/solicitudes + acciones
   â”‚  â”œâ”€ visitas.py           # /api/visitas
   â”‚  â””â”€ seguimientos.py      # /api/seguimientos
   â”œâ”€ domain/
   â”‚  â”œâ”€ usuario.py, operador.py, veterinario.py
   â”‚  â”œâ”€ animal.py, control_sanitario.py, animal_auditoria.py
   â”‚  â”œâ”€ adoptante.py, solicitud.py, visita.py, seguimiento.py
   â”‚  â””â”€ email_verification_token.py
   â”œâ”€ repositories/
   â”‚  â”œâ”€ factory.py           # PERSISTENCE=sqlite|memory
   â”‚  â”œâ”€ usuarios.py, animales.py, tokens.py, adoptantes.py
   â”‚  â”œâ”€ solicitudes.py, visitas.py, controles_sanitarios.py
   â”‚  â”œâ”€ animal_auditoria.py
   â”‚  â””â”€ entregas.py          # Inbox â€œaviso de entregaâ€ (OpciÃ³n A)
   â”œâ”€ persistence/sqlite_utils.py
   â””â”€ di/container.py
```

## Variables de entorno (Render y local)

- `SECRET_KEY`: obligatorio. Usa una clave aleatoria de 32+ caracteres para firmar cookies.
- `PERSISTENCE=sqlite|memory` (default: `sqlite`). Emplea `memory` solo para pruebas efimeras.
- `DB_FILE=data/app.db` (ruta del archivo SQLite cuando aplica).
- `ALLOWED_ORIGINS=https://tusitio.com,...` lista de origenes permitidos para CORS.
- `SESSION_COOKIE_SECURE=0|1` (default `1`; pon `0` solo en desarrollo sin HTTPS).
- `LOG_LEVEL=INFO|DEBUG|WARNING` (default `INFO`).
- `ENABLE_DEV_FEATURES=1` habilita rutas de prueba (`EXPOSE_VERIFY_TOKEN`, `ALLOW_ELEVATE`).
- `AUTO_SEED_ON_EMPTY=1` (dev) crea datos de ejemplo automticamente si la lista de animales est vaca.
- `EXPOSE_VERIFY_TOKEN=1` expone tokens de verificacion (requiere `ENABLE_DEV_FEATURES=1`).
- `ALLOW_ELEVATE=1` permite `/api/auth/promote` (requiere `ENABLE_DEV_FEATURES=1`).
- `PORT`, `HOST`, `DEBUG` (opcional, parametros estandar de Flask).

## Ejecutar localmente (opcional)

```
# InMemory
python backend/app.py

# SQLite
set PERSISTENCE=sqlite
set DB_FILE=data/app.db
python backend/app.py
```


## Rutas de prueba (dev only)

Con `ENABLE_DEV_FEATURES=1` puedes sembrar animales de ejemplo:

```
POST /api/dev/animales/seed

Respuesta 201 {
  ok: true,
  count: <n>,
  animales: [ ... ]
}
```

Crea mascotas en distintos estados para probar el frontend:
- Disponibles (EstadoSolicitud vacío)
- Reservado (EstadoSolicitud "Reservado")
- No disponible (EstadoSolicitud "No disponible")
- Adoptados/historias (Resultado "Adoptado"/"Con hogar")

Nota: la ruta está deshabilitada en producción si `ENABLE_DEV_FEATURES` no está activo.

Si prefieres auto-seeding sin llamar a la ruta, define `AUTO_SEED_ON_EMPTY=1` y al primer GET `/api/animales` se crearán registros de muestra si no hay animales.

Además, puedes crear un escenario completo para probar CU 5–8:

```
POST /api/dev/seed/full

Respuesta { ok: true, created: { solicitudes: [...], visitas: [...], seguimientos: [...] } }
```

Este endpoint de desarrollo:
- Crea usuarios demo (adoptante y operador) si no existen.
- Genera solicitudes en estados Pendiente, En revisión, Aprobada y Rechazada.
- Programa una visita (Programada) para la solicitud en revisión.
- Registra un seguimiento Activo para la solicitud aprobada.
