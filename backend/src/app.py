import logging
import os
from pathlib import Path
from flask import Flask, g, request, jsonify
import sqlite3
from werkzeug.exceptions import HTTPException

from .controllers.api import api_bp
from .controllers.usuarios import usuarios_bp
from .controllers.animales import animales_bp
from .controllers.auth import auth_bp
from .controllers.controles import controles_bp
from .controllers.solicitudes import solicitudes_bp
from .controllers.visitas import visitas_bp
from .controllers.seguimientos import seguimientos_bp
from .controllers.entregas import entregas_bp
from .controllers.veterinario import veterinario_bp
from .di.container import build_container



def _configure_logging() -> None:
    level_name = os.environ.get('LOG_LEVEL', 'INFO').upper()
    level = getattr(logging, level_name, logging.INFO)
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(
            level=level,
            format='%(asctime)s %(levelname)s %(name)s %(message)s',
        )
    else:
        root.setLevel(level)
    logging.getLogger('werkzeug').setLevel(level)


def _frontend_path() -> str:
    # backend/src -> backend -> repo root -> frontend
    here = Path(__file__).resolve()
    frontend = here.parent.parent.parent / 'frontend'
    return str(frontend)


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder=_frontend_path(),
        static_url_path='',
    )

    # SECRET_KEY: en prod debe definirse. Para evitar fallas de arranque
    # cuando no est· presente en el entorno, generamos una clave efÌmera.
    secret_key = os.environ.get('SECRET_KEY')
    if not secret_key:
        try:
            import secrets
            secret_key = secrets.token_hex(32)
        except Exception:
            secret_key = os.urandom(32).hex()
    app.secret_key = secret_key
    _configure_logging()
    app.logger.setLevel(logging.getLogger().level)

    app.config.setdefault('SESSION_COOKIE_HTTPONLY', True)
    app.config.setdefault('SESSION_COOKIE_SAMESITE', 'Strict')
    if os.environ.get('SESSION_COOKIE_SECURE', '1') != '0':
        app.config['SESSION_COOKIE_SECURE'] = True


    # DI container (GRASP: Creator; GoF: Factory)
    container = build_container()
    app.config['container'] = container

    # CORS b√°sico; ajusta para producci√≥n
    @app.after_request
    def add_cors_headers(response):
        allowed_origins = {o.strip() for o in (os.environ.get('ALLOWED_ORIGINS') or '').split(',') if o.strip()}
        origin = request.headers.get('Origin')
        if allowed_origins and origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Vary'] = 'Origin'
            request_headers = request.headers.get('Access-Control-Request-Headers', 'Content-Type, Authorization')
            response.headers['Access-Control-Allow-Headers'] = request_headers
            response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
            if request.method == 'OPTIONS' and response.status_code == 200:
                response.status_code = 204
        return response

        return response

    # Request-scoped SQLite connection (if enabled)
    from .persistence.sqlite_utils import get_connection

    @app.before_request
    def _bind_request_db():
        if os.environ.get('PERSISTENCE', 'sqlite').lower() == 'sqlite':
            db_file = os.environ.get('DB_FILE', 'data/app.db')
            g.db = get_connection(db_file)
            repos = app.config.get('container', {}).get('repos', {})
            for repo in repos.values():
                if hasattr(repo, '_c'):
                    repo._c = g.db

    @app.teardown_request
    def _close_request_db(exc):
        db = getattr(g, 'db', None)
        if db is not None:
            try:
                db.close()
            except Exception:
                pass

    # API blueprints (GRASP: Controller)
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(usuarios_bp, url_prefix='/api')
    app.register_blueprint(animales_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(controles_bp, url_prefix='/api')
    app.register_blueprint(solicitudes_bp, url_prefix='/api')
    app.register_blueprint(visitas_bp, url_prefix='/api')
    app.register_blueprint(seguimientos_bp, url_prefix='/api')
    app.register_blueprint(entregas_bp, url_prefix='/api')
    app.register_blueprint(veterinario_bp, url_prefix='/api')

    # Manejo de errores uniforme para APIs
    @app.errorhandler(sqlite3.IntegrityError)
    def handle_sqlite_integrity(err):
        app.logger.warning('SQLite integrity error: %s', err)
        return jsonify(error=True, message='Conflicto de datos'), 409

    @app.errorhandler(HTTPException)
    def handle_http_exception(err: HTTPException):
        if request.path.startswith('/api/'):
            return jsonify(error=True, message=(err.description or 'Error')), err.code
        return err

    @app.errorhandler(Exception)
    def handle_generic_exception(err: Exception):
        app.logger.exception('Unhandled exception: %s', err)
        if request.path.startswith('/api/'):
            return jsonify(error=True, message='Error interno del servidor'), 500
        return err

    # RaÌz sirve el frontend est·tico
    @app.route('/')
    def index():
        return app.send_static_file('index.html')

    # Favicon cl·sico: algunos navegadores piden /favicon.ico siempre
    @app.route('/favicon.ico')
    def favicon_ico():
        return app.send_static_file('assets/logo-fallback.png')

    @app.route('/health')
    def health():
        return {'status': 'ok', 'service': 'patitasybigotes-backend'}

    # Exponer flag para token de verificaci√≥n en dev
    allow_test_features = os.environ.get('ENABLE_DEV_FEATURES', '0') == '1'
    app.config['EXPOSE_VERIFY_TOKEN'] = allow_test_features and os.environ.get('EXPOSE_VERIFY_TOKEN', '0') == '1'
    app.config['ALLOW_ELEVATE'] = allow_test_features and os.environ.get('ALLOW_ELEVATE', '0') == '1'


    app.logger.info('Application configured', extra={'component': 'startup'})
    return app


