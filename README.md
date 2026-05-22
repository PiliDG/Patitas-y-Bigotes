# Patitas y Bigotes - App Python (Frontend + Backend)

Aplicacion web con frontend estatico y backend Flask que cubre los casos de uso de registro, gestion de animales, solicitudes de adopcion, controles sanitarios, visitas y seguimientos. Lista para desplegar en Render sin instalar nada local.


## Estructura (alto nivel)

```
.
|-- .github/
|   `-- workflows/
|       |-- pages.yml                  # Deploy de GitHub Pages (frontend estático)
|       `-- backend-tests.yml          # CI: ejecuta pytest del backend
|-- backend/
|   |-- app.py                         # Entry point Flask
|   |-- README.md                      # Docs backend
|   |-- requirements.txt               # Dependencias runtime backend
|   |-- tests/                         # Pruebas del backend (pytest)
|   |   |-- conftest.py
|   |   `-- test_app_basic.py
|   `-- src/
|       |-- app.py                     # create_app, static y blueprints
|       |-- controllers/               # Endpoints
|       |-- domain/                    # Entidades de negocio
|       |-- repositories/              # DBroker, factory, SQLite/memoria
|       |-- persistence/               # utilidades SQLite
|       `-- di/                        # build_container
|-- dev-requirements.txt               # Dependencias de desarrollo (pytest)
|-- frontend/
|   |-- index.html                     # Shell
|   |-- app.js                         # Bootstrap UI
|   |-- styles.css                     # Paleta y layout (frontend/styles.css también existe en raíz)
|   |-- assets/                        # Recursos estáticos
|   `-- src/
|       |-- main.js                    # Router + montaje
|       |-- config.js                  # Rutas y constantes
|       |-- components/                # Navbar, overlays, etc.
|       |-- pages/                     # Vistas por rol
|       |   |-- DashboardOperatorFixed.js  # Panel Operador (principal)
|       |   |-- DashboardVet.js            # Panel Veterinario
|       |   |-- DashboardAdopter.js        # Panel Adoptante
|       |   `-- ... (Adopt, Pets, etc.)
|       |-- services/                  # Clientes API (animales, visitas, etc.)
|       |-- state/                     # Store simple y auth
|       `-- utils/                     # Utilidades (roles, etc.)
|-- render.yaml                        # Configuración Render
|-- Procfile                           # Procfile para PaaS
`-- README.md                          # Este documento
```

Notas de arquitectura:
- Capas: Controllers -> Repositorios (DBroker) -> Persistencia (SQLite). El dominio no depende de infraestructura.
- Seleccion de persistencia via `PERSISTENCE=sqlite|memory` (ver `repositories/factory.py`).
- La UI aplica guardas por rol consultando `/api/auth/me`.

## Casos de Uso y Endpoints

Formatos de fecha: `Date` -> `YYYY-MM-DD`, `DateTime` -> `YYYY-MM-DDTHH:MM:SS`.

- CU 1 - Registro (POST `/api/auth/registro`, GET `/api/auth/confirmar`)
  - Validaciones: nombre requerido, email valido, contrasena segura, terminos aceptados, email unico.
- CU 2 - Gestion de Animales
  - Alta POST `/api/animales`: nombre y foto obligatorios; duplicado 409 "Posible duplicado; confirmar"; estado inicial "Pendiente de Control".
  - Modificacion PUT `/api/animales/{id}`: validaciones y auditoria.
  - Baja POST `/api/animales/{id}/baja`: bloquea si hay dependencias.
- CU 3 - Control Sanitario POST `/api/controles`: requiere diagnostico; resultado actualiza estado del animal.
- CU 4 - Busqueda GET `/api/animales/buscar`: valida formato y filtros; responde 404 si no hay resultados.
- CU 5 - Solicitud (Adoptante) POST `/api/solicitudes`: valida disponibilidad y terminos; soporta modificar/cancelar.
- CU 6 - Gestionar solicitud (Operador): poner en revision, aprobar, rechazar (motivo), anular.
- CU 7 - Visitas (Operador): programar, reprogramar, cancelar con deteccion de conflictos.
- CU 8 - Seguimiento (Operador/Veterinario): alta, modificar, cancelar con validaciones.
  - Alta puede referenciar una solicitud por `SolicitudId` o indicar solo el `AnimalId`. Si se envía `SolicitudId` y no existe, el backend intenta resolverlo como `AnimalId` del expediente más reciente.

Endpoints de referencia:
- Auth: `POST /api/auth/registro`, `GET /api/auth/confirmar`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/promote`, `GET /api/auth/me`
- Usuarios: `GET /api/usuarios`, `POST /api/usuarios`
- Animales: `GET /api/animales`, `POST /api/animales`, `PUT /api/animales/{id}`, `POST /api/animales/{id}/baja`, `GET /api/animales/buscar`
- Controles: `GET /api/controles?animalId=`, `POST /api/controles`
- Solicitudes: `GET /api/solicitudes`, `POST /api/solicitudes`, `PUT /api/solicitudes/{id}`, `POST /api/solicitudes/{id}/cancelar`, `POST /api/solicitudes/{id}/poner-en-revision`, `POST /api/solicitudes/{id}/aprobar`, `POST /api/solicitudes/{id}/rechazar`, `POST /api/solicitudes/{id}/anular`
- Visitas: `POST /api/visitas`, `PUT /api/visitas/{id}`, `POST /api/visitas/{id}/cancelar`
- Seguimientos: `POST /api/seguimientos`, `PUT /api/seguimientos/{id}`, `POST /api/seguimientos/{id}/cancelar`
- Entregas (opcion A): `POST /api/entregas/aviso` (publico), `GET /api/entregas` (operador), `GET /api/entregas/{id}`, `DELETE /api/entregas/{id}`
  - Nota: `/api/entregas/aviso` limita a 5 solicitudes por minuto por IP para evitar spam.

## Notas de mantenimiento

- Robustecimos las transiciones de estado de solicitudes en el panel de operador. Ahora las rutas para “poner en revisión” y “anular” aceptan ambas variantes de texto de estado (“En revisión”/“En revisi��n”) y usan constantes de dominio al actualizar, evitando errores por codificación al comparar estados. No hay cambios de API.
 - Seguimientos: el endpoint de alta ahora acepta `AnimalId` además de `SolicitudId`. Para mantener compatibilidad con el frontend actual, si se envía `SolicitudId` y no corresponde a una solicitud válida, el sistema lo interpreta como `AnimalId` y vincula el seguimiento al expediente más reciente del animal.

## UI por rol (frontend)

- Rol actual: `/api/auth/me`.
- Guardas: solo se muestran secciones permitidas (`public`, `adoptante`, `operador`, `veterinario`).
- Operador: puede precargar altas desde avisos y archivar avisos.
- Navbar: agregar un botón de acceso al panel según rol. Si el usuario es `operador` navega al panel de Operador; si es `veterinario` navega al panel de Clínica. No debe mostrarse para `adoptante` ni `public`.
 - Operador (UI): formularios del panel remaquetados en grilla para alta/modificación/baja, visitas y seguimientos; campos alineados, acciones claras y mensajes de estado.

## Documentacion por carpeta

- Frontend: ver `frontend/README.md` (estructura, roles, como apuntar a otra API).
- Backend: ver `backend/README.md` (capas, arbol detallado, variables, ejecucion local).

## Actores y RBAC

- Adoptante: solicita adopcion, gestiona sus solicitudes, visitas y seguimientos.
- Entregador: vecino o voluntario que notifica un animal al centro (solo "aviso de entrega").
- Veterinario: registra controles sanitarios y seguimientos.
- Operador: gestiona animales, solicitudes, visitas y avisos de entrega.
- DBroker: componente interno que abstrae la base de datos (repositorios/factoria).

La UI aplica guardas segun `Usuario.Tipo`, consultando `/api/auth/me` y ocultando secciones no autorizadas.


## Pruebas (backend)

- Requisitos: Python 3.10+ y `pip` instalados.
- Instala dependencias de app y desarrollo: `pip install -r requirements.txt -r dev-requirements.txt`
- Ejecuta tests desde `backend/`: `pytest -q`
- Los tests usan `PERSISTENCE=memory` y no escriben en disco.
- CI: se incluyó `/.github/workflows/backend-tests.yml` para correr pytest en GitHub Actions.

## Notas de UI (fichas con rollover)

- En los paneles de Operador y Veterinario las fichas de animales ahora aparecen como un rollover al pasar el mouse por el nombre/ítem del animal.
- El rollover muestra TODOS los campos relevantes del animal más su foto (si está disponible).
- Implementación no intrusiva: se inyecta un contenedor flotante con estilos inline; no requiere cambios de backend ni de build.



