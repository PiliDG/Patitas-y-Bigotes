import os
from src.app import create_app
from src.controllers.veterinario import veterinario_bp
from src.controllers.uploads import uploads_bp


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('DEBUG', '1') == '1'
    app = create_app()
    # Ajustes de sesión y CORS para SPA/frontends en distinto origen
    try:
        samesite = os.environ.get('SESSION_COOKIE_SAMESITE') or 'Lax'
        app.config['SESSION_COOKIE_SAMESITE'] = samesite
        allowed = os.environ.get('ALLOWED_ORIGINS') or ''
        if any(o.strip() for o in allowed.split(',')):
            # Para permitir cookies en fetch con credentials cross-site
            app.config['SESSION_COOKIE_SAMESITE'] = 'None'
            app.config['SESSION_COOKIE_SECURE'] = True

            @app.after_request
            def _cors_override(resp):
                origin = (os.environ.get('DEV_ORIGIN') or '')
                request_origin = None
                try:
                    from flask import request
                    request_origin = request.headers.get('Origin')
                except Exception:
                    request_origin = None
                chosen = request_origin if request_origin and request_origin in {o.strip() for o in allowed.split(',') if o.strip()} else (origin if origin in allowed else None)
                if chosen:
                    resp.headers['Access-Control-Allow-Origin'] = chosen
                    resp.headers['Access-Control-Allow-Credentials'] = 'true'
                    resp.headers['Vary'] = 'Origin'
                    if resp.status_code == 200 and getattr(resp, 'request', None) and getattr(resp.request, 'method', 'GET') == 'OPTIONS':
                        resp.status_code = 204
                return resp
    except Exception:
        pass
    # Configurar MEDIA_ROOT (carpeta de subidas) si no viene desde create_app
    try:
        if not app.config.get('MEDIA_ROOT'):
            here = os.path.abspath(os.path.dirname(__file__))
            default_media = os.path.normpath(os.path.join(here, 'media'))
            app.config['MEDIA_ROOT'] = os.environ.get('MEDIA_ROOT', default_media)
    except Exception:
        pass
    # Registrar blueprints adicionales (workaround por encoding de src/app.py)
    try:
        app.register_blueprint(veterinario_bp, url_prefix='/api')
    except Exception:
        pass
    try:
        app.register_blueprint(uploads_bp, url_prefix='/api')
    except Exception:
        pass
    app.run(host=host, port=port, debug=debug)
