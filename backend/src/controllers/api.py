from flask import Blueprint, current_app, jsonify
from datetime import datetime, timedelta
import uuid
from werkzeug.security import generate_password_hash

from ..domain.constants import Roles, AnimalSolicitud, SolicitudEstado, VisitaEstado
from ..domain.usuario import Usuario
from ..domain.adoptante import Adoptante
from ..domain.solicitud import Solicitud
from ..domain.visita import Visita
from ..domain.seguimiento import Seguimiento
from ..domain.constants import SeguimientoTipo


api_bp = Blueprint('api', __name__)


@api_bp.route('/status', methods=['GET'])
def status():
    container = current_app.config.get('container', {})
    repos = container.get('repos', {})
    db_info = {'ok': False, 'engine': 'unknown'}
    try:
        conn = repos.get('_conn')
        if conn is not None:
            conn.execute('SELECT 1;')
            db_info.update(ok=True, engine='sqlite')
        else:
            # In-memory repositories se usan solo en entornos de desarrollo/pruebas
            db_info.update(ok=True, engine='memory')
    except Exception:
        current_app.logger.exception('Database health check failed')
        db_info['error'] = 'check failed'

    overall_ok = db_info.get('ok', False)
    status_code = 200 if overall_ok else 503
    payload = {'ok': overall_ok, 'database': db_info}
    return jsonify(payload), status_code


@api_bp.route('/dev/seed/full', methods=['POST'])
def dev_seed_full():
    # Solo en entornos de desarrollo (flags configuradas en app)
    allow = bool(current_app.config.get('ALLOW_ELEVATE')) or bool(current_app.config.get('EXPOSE_VERIFY_TOKEN'))
    if not allow:
        return jsonify(error=True, message='No disponible'), 404

    repos = current_app.config['container']['repos']
    animales = repos['animales']
    usuarios = repos['usuarios']
    adoptantes = repos.get('adoptantes')
    solicitudes = repos['solicitudes']
    visitas = repos.get('visitas')
    seguimientos = repos.get('seguimientos')

    # Sembrar animales si no hay
    if not animales.list():
        try:
            from .animales import list_animales
            with current_app.test_request_context('/api/animales'):
                list_animales()
        except Exception:
            pass

    def ensure_user(email, nombre, tipo):
        u = usuarios.get_by_email(email) if hasattr(usuarios, 'get_by_email') else None
        if not u:
            u = Usuario(Id=0, Nombre=nombre, Email=email, ContrasenaHash=generate_password_hash('Secreta123'), Tipo=tipo, EstaActivo=True, FechaRegistro=datetime.utcnow())
            u = usuarios.add(u)
        else:
            changed = False
            if not u.EstaActivo:
                u.EstaActivo = True
                changed = True
            if u.Tipo != tipo:
                u.Tipo = tipo
                changed = True
            if changed and hasattr(usuarios, 'update'):
                usuarios.update(u)
        return u

    u_adopt = ensure_user('demo+adoptante@pyb.dev', 'Adoptante Demo', Roles.ADOPTANTE.value)
    ensure_user('demo+operador@pyb.dev', 'Operador Demo', Roles.OPERADOR.value)

    ad = adoptantes.get_by_usuario(u_adopt.Id) if adoptantes else None
    if not ad and adoptantes:
        ad = Adoptante(Id=0, UsuarioId=u_adopt.Id, Edad=32, Direccion='Av. Siempreviva 123', Convivientes='2 adultos, 1 niño', Experiencia='Perros y gatos', NumeroTelefono='555-1234', Adjuntos='')
        ad = adoptantes.add(ad)

    by_name = {a.Nombre: a for a in animales.list()}
    now = datetime.utcnow()

    created = {'solicitudes': [], 'visitas': [], 'seguimientos': []}

    def add_solicitud(animal, estado, motivo_rechazo=''):
        if not animal or not ad:
            return None
        s = Solicitud(
            Id=0,
            IdSolicitud=str(uuid.uuid4())[:8].upper(),
            FechaSolicitud=now,
            MotivoSolicitud='Adopción responsable',
            EstadoSolicitud=estado,
            MotivoRechazo=motivo_rechazo,
            Comentarios='', Adjuntos='', AceptaTerminos=True,
            Auditoria=f'Seed {estado}',
            FechaActualizacion=now,
            AnimalId=animal.Id,
            AdoptanteId=ad.Id,
        )
        s = solicitudes.add(s)
        if estado == SolicitudEstado.APROBADA.value:
            animal.EstadoSolicitud = AnimalSolicitud.RESERVADO.value
            animal.FechaActualizacion = now
            animales.update(animal)
        created['solicitudes'].append(s.to_dict())
        return s

    s_pend = add_solicitud(by_name.get('Luna'), SolicitudEstado.PENDIENTE.value)
    s_rev = add_solicitud(by_name.get('Kira'), 'En revisión')
    s_apr = add_solicitud(by_name.get('Toby'), SolicitudEstado.APROBADA.value)
    add_solicitud(by_name.get('Greta'), 'Rechazada', motivo_rechazo='No cumple requisitos (demo)')

    if visitas and s_rev:
        v = Visita(Id=0, IdVisita=str(uuid.uuid4())[:8].upper(), FechaHoraVisita=now + timedelta(days=2), EstadoSolicitud=VisitaEstado.PROGRAMADA.value, MotivoRechazo='', SolicitudId=s_rev.Id)
        v = visitas.add(v)
        created['visitas'].append(v.to_dict())

    if seguimientos and s_apr:
        seg = Seguimiento(Id=0, IdSeguimiento=str(uuid.uuid4())[:8].upper(), FechaSeguimiento=now + timedelta(days=15), EstadoSeguimiento='Activo', TipoSeguimiento=SeguimientoTipo.ADMINISTRATIVO.value, Observaciones='Primer control post adopción (demo)', Comportamiento='Adaptación favorable', Adjuntos='', Firma='', SolicitudId=s_apr.Id)
        seg = seguimientos.add(seg)
        created['seguimientos'].append(seg.to_dict())

    return jsonify(ok=True, created=created)
