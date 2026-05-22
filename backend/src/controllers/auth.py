from __future__ import annotations
import re
from datetime import datetime
import sqlite3
import os
from flask import Blueprint, current_app, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash
from ..domain.constants import Roles

from ..domain.usuario import Usuario

auth_bp = Blueprint('auth', __name__)

NAME_PATTERN = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[\s'\-]+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$")


def _validate_email(email: str) -> bool:
    if not email:
        return False
    return re.match(r"^[^@\s]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[^@\s]+$", email) is not None


def _validate_full_name(name: str) -> bool:
    if not name:
        return False
    candidate = name.strip()
    if len(candidate) < 3:
        return False
    return bool(NAME_PATTERN.match(candidate))


@auth_bp.route('/auth/registro', methods=['POST'])
def registro():
    body = request.get_json(silent=True) or {}
    nombre = (body.get('nombre') or '').strip()
    email = (body.get('email') or '').strip().lower()
    contrasena = (body.get('contrasena') or '').strip()
    acepta = bool(body.get('aceptaTerminos', False))

    # Paso 4: Validaciones
    if not _validate_full_name(nombre):
        return jsonify(error=True, message='Debe ingresar nombre'), 400
    if not email or not _validate_email(email):
        return jsonify(error=True, message='Email inválido'), 400
    if len(contrasena) < 8:
        return jsonify(error=True, message='Contraseña insegura'), 400
    if not acepta:
        return jsonify(error=True, message='Debe aceptar términos'), 400

    repos = current_app.config['container']['repos']
    usuarios = repos['usuarios']
    # Determinar rol asignado al crear la cuenta
    rol_deseado = (body.get('rolDeseado') or '').strip().lower()
    tipo_asignado = 'adoptante'
    allowed_roles = {'adoptante'}
    # Solo permitir roles elevados en entornos de prueba
    # TambiÃ©n habilitar si DEBUG=1 para facilitar pruebas
    try:
        debug_on = (os.environ.get('DEBUG', '1') == '1')
    except Exception:
        debug_on = False
    if current_app.config.get('ALLOW_ELEVATE', False) or debug_on:
        allowed_roles.update({'operador', 'veterinario', 'admin'})
    if rol_deseado in allowed_roles:
        tipo_asignado = rol_deseado

    # Paso 6: Verificar email no exista
    if hasattr(usuarios, 'get_by_email') and usuarios.get_by_email(email) is not None:
        return jsonify(error=True, message='El email ya está registrado'), 409

    # Paso 7: Crear cuenta y enviar email de verificaciÃ³n
    u = Usuario(
        Id=0,
        Nombre=nombre,
        Email=email,
        ContrasenaHash=generate_password_hash(contrasena),
        Tipo=tipo_asignado,
        EstaActivo=False,
        FechaRegistro=datetime.utcnow(),
    )
    u = usuarios.add(u)

    tokens = repos.get('tokens')
    evt = None
    try:
        if not tokens:
            raise RuntimeError('Repositorio de tokens no disponible')
        evt = tokens.create_for_user(u.Id, minutes=60)
    except Exception:
        try:
            conn = repos.get('_conn')
            if conn is not None:
                from ..persistence.sqlite_utils import init_schema as _init
                _init(conn)
                t = repos.get('tokens')
                if t:
                    evt = t.create_for_user(u.Id, minutes=60)
        except Exception:
            try:
                u.EstaActivo = True
                usuarios.update(u)
            except Exception:
                pass

    # Enviar email de verificación si hay SMTP configurado
    try:
        services = current_app.config.get('container', {}).get('services', {})
        email_sender = services.get('email')
        if getattr(email_sender, 'enabled', False):
            ok = email_sender.send_verification(u.Email, u.Nombre or 'usuario', evt.Token)
            if not ok:
                current_app.logger.warning('Fallo al enviar email de verificación a %s', u.Email)
        else:
            current_app.logger.info('EmailSender no configurado; no se envía correo de verificación')
    except Exception as _exc:
        current_app.logger.exception('Error inesperado al intentar enviar email de verificación: %s', _exc)

    expose = current_app.config.get('EXPOSE_VERIFY_TOKEN', False) or (os.environ.get('DEBUG', '1') == '1')
    msg = 'Cuenta creada, se envió email de verificación'
    if evt is None:
        msg = 'Cuenta creada. Verificación omitida por el entorno'
    return jsonify(ok=True, message=msg, token=(evt.Token if (evt and expose) else None))


@auth_bp.route('/auth/confirmar', methods=['GET'])
def confirmar_email():
    token = request.args.get('token')
    if not token:
        return jsonify(error=True, message='Token requerido'), 400
    repos = current_app.config['container']['repos']
    tokens = repos.get('tokens')
    usuarios = repos['usuarios']
    evt = tokens.get(token)
    if not evt:
        return jsonify(error=True, message='Token inválido'), 400
    if evt.Usado:
        return jsonify(error=True, message='Token ya utilizado'), 400
    if evt.ExpiraEn < datetime.utcnow():
        return jsonify(error=True, message='Token expirado'), 400

    u = usuarios.get(evt.UsuarioId)
    if not u:
        return jsonify(error=True, message='Usuario no encontrado'), 404
    u.EstaActivo = True
    usuarios.update(u)
    tokens.mark_used(token)

    # Paso 9: Abrir sesiÃ³n
    session['user_id'] = u.Id
    session['user_tipo'] = u.Tipo
    return jsonify(ok=True, message='Cuenta verificada y sesión iniciada', usuario=u.to_dict())


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get('email') or '').strip().lower()
    contrasena = (body.get('contrasena') or '').strip()
    repos = current_app.config['container']['repos']
    usuarios = repos['usuarios']
    # Defensive: ensure schema exists (some ephemeral deploys might start without init)
    try:
        conn = repos.get('_conn')
        if conn is not None:
            from ..persistence.sqlite_utils import init_schema as _init
            _init(conn)
    except Exception:
        pass
    # Atajo: operador fijo preconfigurado para despliegues
    # Permite iniciar sesión sin registro/confirmación previos.
    FIX_EMAIL = 'patitasybigotes.adopta@gmail.com'
    FIX_PASS = 'Patitasybigotes2025'
    if email == FIX_EMAIL and contrasena == FIX_PASS:
        # Robust get-or-create with retry in case of transient DB issues
        def _get_by_email(addr: str):
            return usuarios.get_by_email(addr) if hasattr(usuarios, 'get_by_email') else None
        u = None
        for _ in range(2):
            try:
                u = _get_by_email(FIX_EMAIL)
                if not u:
                    u = Usuario(
                        Id=0,
                        Nombre='Operador PyB',
                        Email=FIX_EMAIL,
                        ContrasenaHash=generate_password_hash(FIX_PASS),
                        Tipo=Roles.OPERADOR.value,
                        EstaActivo=True,
                        FechaRegistro=datetime.utcnow(),
                    )
                    u = usuarios.add(u)
                else:
                    # Asegurar rol y activación; actualizar contraseña fija si cambiara
                    changed = False
                    if not u.EstaActivo:
                        u.EstaActivo = True
                        changed = True
                    if getattr(u, 'Tipo', '') != Roles.OPERADOR.value:
                        u.Tipo = Roles.OPERADOR.value
                        changed = True
                    if not check_password_hash(u.ContrasenaHash, FIX_PASS):
                        u.ContrasenaHash = generate_password_hash(FIX_PASS)
                        changed = True
                    if changed and hasattr(usuarios, 'update'):
                        usuarios.update(u)
                break
            except Exception:
                # Try to re-init schema and retry once
                try:
                    conn = repos.get('_conn')
                    if conn is not None:
                        from ..persistence.sqlite_utils import init_schema as _init
                        _init(conn)
                except Exception:
                    pass
        if not u:
            return jsonify(error=True, message='No se pudo iniciar sesión'), 500
        session['user_id'] = u.Id
        session['user_tipo'] = u.Tipo
        return jsonify(ok=True, message='Sesión iniciada', usuario=u.to_dict())
    # Atajo: veterinarios fijos (sin registro previo)
    FIX_VETS = {
        'frenkel.lara@comunidad.ub.edu.ar': 'Patitasybigotes2025',
        'orianal.ferrari@comunidad.ub.edu.ar': 'Patitasybigotes2025',
    }
    if email in FIX_VETS and contrasena == FIX_VETS[email]:
        def _get_by_email(addr: str):
            return usuarios.get_by_email(addr) if hasattr(usuarios, 'get_by_email') else None
        v = None
        for _ in range(2):
            try:
                v = _get_by_email(email)
                if not v:
                    v = Usuario(
                        Id=0,
                        Nombre=email.split('@')[0],
                        Email=email,
                        ContrasenaHash=generate_password_hash(contrasena),
                        Tipo=Roles.VETERINARIO.value,
                        EstaActivo=True,
                        FechaRegistro=datetime.utcnow(),
                    )
                    v = usuarios.add(v)
                else:
                    changed = False
                    if not v.EstaActivo:
                        v.EstaActivo = True
                        changed = True
                    if getattr(v, 'Tipo', '') != Roles.VETERINARIO.value:
                        v.Tipo = Roles.VETERINARIO.value
                        changed = True
                    if not check_password_hash(v.ContrasenaHash, contrasena):
                        v.ContrasenaHash = generate_password_hash(contrasena)
                        changed = True
                    if changed and hasattr(usuarios, 'update'):
                        usuarios.update(v)
                break
            except Exception:
                try:
                    conn = repos.get('_conn')
                    if conn is not None:
                        from ..persistence.sqlite_utils import init_schema as _init
                        _init(conn)
                except Exception:
                    pass
        if not v:
            return jsonify(error=True, message='No se pudo iniciar sesión'), 500
        session['user_id'] = v.Id
        session['user_tipo'] = v.Tipo
        return jsonify(ok=True, message='Sesión iniciada', usuario=v.to_dict())

    u = usuarios.get_by_email(email) if hasattr(usuarios, 'get_by_email') else None
    if not u or not check_password_hash(u.ContrasenaHash, contrasena):
        return jsonify(error=True, message='Credenciales inválidas'), 401
    if not u.EstaActivo:
        return jsonify(error=True, message='Cuenta no verificada'), 403
    session['user_id'] = u.Id
    session['user_tipo'] = u.Tipo
    return jsonify(ok=True, message='Sesión iniciada', usuario=u.to_dict())


@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify(ok=True, message='Sesión cerrada')


@auth_bp.route('/auth/promote', methods=['POST'])
def promote():
    # Utilidad para pruebas: cambiar Tipo del usuario logueado si ALLOW_ELEVATE=1
    if not current_app.config.get('ALLOW_ELEVATE', False):
        return jsonify(error=True, message='Operación no permitida'), 403
    uid = session.get('user_id')
    if not uid:
        return jsonify(error=True, message='Debe iniciar sesión'), 401
    body = request.get_json(silent=True) or {}
    tipo = body.get('Tipo')
    if tipo not in (Roles.OPERADOR.value, Roles.VETERINARIO.value, Roles.ADOPTANTE.value, Roles.ADMIN.value):
        return jsonify(error=True, message='Tipo inválido'), 400
    repos = current_app.config['container']['repos']
    u = repos['usuarios'].get(uid)
    u.Tipo = tipo
    repos['usuarios'].update(u)
    session['user_tipo'] = u.Tipo
    return jsonify(ok=True, message='Tipo actualizado', usuario=u.to_dict())
@auth_bp.route('/auth/me', methods=['GET'])
def me():
    uid = session.get('user_id')
    if not uid:
        return jsonify(authenticated=False)
    repos = current_app.config['container']['repos']
    u = repos['usuarios'].get(uid)
    if not u:
        session.clear()
        return jsonify(authenticated=False)
    return jsonify(authenticated=True, usuario=u.to_dict())
