# Patitas y Bigotes

Aplicación web Full Stack desarrollada como proyecto académico grupal para la gestión de rescate, atención y adopción de animales.

El sistema permite gestionar animales, solicitudes de adopción, controles sanitarios, visitas y seguimientos mediante diferentes roles de usuario.

<h2>Vista de la aplicación</h2>

<h3>Página principal</h3>

<img src="docs/screenshots/home.png" alt="Página principal de Patitas y Bigotes" width="100%">

<br>

<table>
  <tr>
    <td width="50%">
      <strong>Proceso de adopción</strong><br><br>
      <img src="docs/screenshots/adopcion.png" alt="Formulario de adopción">
    </td>
    <td width="50%">
      <strong>Registro de usuarios</strong><br><br>
      <img src="docs/screenshots/registro.png" alt="Registro de usuarios">
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Contacto y consultas</strong><br><br>
      <img src="docs/screenshots/contacto.png" alt="Página de contacto">
    </td>
    <td width="50%">
      <strong>Donaciones</strong><br><br>
      <img src="docs/screenshots/donaciones.png" alt="Página de donaciones">
    </td>
  </tr>
</table>

## Mi participación

Durante el proyecto trabajé principalmente en:

* Desarrollo frontend.
* Análisis funcional y relevamiento de requerimientos.
* Definición de funcionalidades y roles de usuario.
* Diseño y adaptación responsive de la interfaz.
* Evolución del sistema hacia una base de datos relacional.
* Documentación y seguimiento de funcionalidades.

> Proyecto académico realizado en equipo. Este repositorio es un fork del proyecto original y esta sección describe específicamente mi participación.

## Tecnologías

**Frontend:** HTML, CSS, JavaScript
**Backend:** Python, Flask, APIs REST
**Base de datos:** SQLite
**Testing:** Pytest
**Control de versiones y CI:** Git, GitHub, GitHub Actions
**Despliegue:** Render, Railway

## Funcionalidades principales

El sistema contempla diferentes procesos relacionados con la gestión de rescate y adopción de animales:

* Registro y autenticación de usuarios.
* Alta, modificación, búsqueda y baja de animales.
* Controles sanitarios.
* Solicitudes de adopción.
* Gestión y seguimiento de solicitudes.
* Programación y gestión de visitas.
* Seguimiento posterior.
* Gestión de avisos de entrega de animales.

## Roles de usuario

La aplicación adapta sus funcionalidades según el tipo de usuario:

**Adoptante:** puede consultar animales, realizar solicitudes de adopción y gestionar sus visitas y seguimientos.

**Veterinario:** registra controles sanitarios y seguimientos.

**Operador:** administra animales, solicitudes, visitas y avisos de entrega.

**Entregador:** puede informar sobre un animal para su ingreso al sistema.

La interfaz aplica permisos según el rol del usuario autenticado.

## Arquitectura

El backend utiliza una arquitectura organizada por capas:

`Controllers → Repositories → Persistence`

La aplicación separa dominio, lógica de acceso a datos y persistencia.

La persistencia puede configurarse mediante:

```text
PERSISTENCE=sqlite
PERSISTENCE=memory
```

El frontend consume los endpoints del backend y adapta la navegación y las vistas según el rol del usuario.

## Estructura del proyecto

```text
.
├── .github/
│   └── workflows/
│       ├── pages.yml
│       └── backend-tests.yml
│
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── tests/
│   └── src/
│       ├── controllers/
│       ├── domain/
│       ├── repositories/
│       ├── persistence/
│       └── di/
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── assets/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── state/
│       └── utils/
│
├── render.yaml
├── Procfile
└── README.md
```

## API y casos de uso

Entre los principales endpoints se encuentran:

### Autenticación

```text
POST /api/auth/registro
GET  /api/auth/confirmar
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Animales

```text
GET  /api/animales
POST /api/animales
PUT  /api/animales/{id}
POST /api/animales/{id}/baja
GET  /api/animales/buscar
```

### Controles sanitarios

```text
GET  /api/controles
POST /api/controles
```

### Solicitudes de adopción

```text
GET  /api/solicitudes
POST /api/solicitudes
PUT  /api/solicitudes/{id}
POST /api/solicitudes/{id}/aprobar
POST /api/solicitudes/{id}/rechazar
POST /api/solicitudes/{id}/cancelar
```

### Visitas y seguimientos

```text
POST /api/visitas
PUT  /api/visitas/{id}

POST /api/seguimientos
PUT  /api/seguimientos/{id}
```

## Testing

El backend cuenta con pruebas automatizadas realizadas con **Pytest**.

Para ejecutar los tests:

```bash
pip install -r requirements.txt -r dev-requirements.txt
```

Desde la carpeta `backend/`:

```bash
pytest -q
```

Los tests pueden utilizar persistencia en memoria para evitar modificaciones sobre la base de datos.

Además, el proyecto incluye un workflow de **GitHub Actions** que ejecuta automáticamente los tests del backend.

## Despliegue

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new?repo=PiliDG/Patitas-y-Bigotes&environment=production)

Railway detecta el proyecto Python y utiliza el `Procfile`:

```text
web: python backend/app.py
```

### Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/PiliDG/Patitas-y-Bigotes)

Para el despliegue se utilizan:

```text
SECRET_KEY=<clave segura>
PERSISTENCE=sqlite
DB_FILE=data/app.db
```

También puede configurarse `ALLOWED_ORIGINS` según el entorno.

El archivo `render.yaml` contiene la configuración necesaria para crear el servicio.

## Documentación adicional

El repositorio cuenta con documentación específica para cada parte del proyecto:

* `frontend/README.md` — estructura del frontend, roles y configuración de la API.
* `backend/README.md` — arquitectura, persistencia, variables y ejecución local.

## Estado del proyecto

Proyecto académico desarrollado como aplicación Full Stack funcional, con frontend, backend, persistencia, autenticación por roles, testing automatizado y configuración para despliegue.
