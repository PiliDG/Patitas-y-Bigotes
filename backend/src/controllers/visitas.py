from __future__ import annotations
import uuid
from datetime import datetime
from flask import Blueprint, current_app, jsonify, request, session
from .decorators import require_role
from ..domain.constants import Roles, VisitaEstado, SolicitudEstado

from ..domain.visita import Visita
from ..domain.seguimiento import Seguimiento
from ..domain.solicitud import Solicitud
from ..domain.constants import SeguimientoEstado, SeguimientoTipo


visitas_bp = Blueprint('visitas', __name__)


@visitas_bp.route('/visitas', methods=['POST'])
@require_role([Roles.OPERADOR.value])
def crear_visita():
    repos = current_app.config['container']['repos']
    vis_repo = repos.get('visitas')
    if vis_repo is None:
        return jsonify(error=True, message='Repositorio de visitas no disponible'), 500
    so = repos['solicitudes']

    body = request.get_json(silent=True) or {}
    solicitud_id = int(body.get('SolicitudId') or 0)
    when = body.get('FechaHoraVisita')
    responsable = (body.get('Responsable') or '').strip()
    direccion = (body.get('Direccion') or '').strip()
    motivo = (body.get('Motivo') or '').strip()
    modalidad = (body.get('Modalidad') or '').strip()

    s = so.get(solicitud_id)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    if s.EstadoSolicitud not in ('En revisión', 'Aprobada', 'Aprobada de manera provisional'):
        return jsonify(error=True, message='La solicitud no permite agendar visitas en su estado actual'), 409
    if not when:
        return jsonify(error=True, message='Fecha/hora requerida'), 400
    # Conflictos
    if vis_repo.has_conflict(s.AnimalId, when):
        return jsonify(error=True, message='El turno seleccionado no está disponible'), 409

    # Si existe una visita PENDIENTE para esta solicitud, actualizarla en lugar de crear una nueva
    v = None
    try:
        # Buscar la mas reciente con Estado Pendiente
        cand = []
        if hasattr(vis_repo, 'list_all'):
            for _v in vis_repo.list_all():
                try:
                    if int(getattr(_v, 'SolicitudId', 0) or 0) == int(s.Id) and (
                        getattr(_v, 'EstadoSolicitud', '') or ''
                    ) == VisitaEstado.PENDIENTE.value:
                        cand.append(_v)
                except Exception:
                    continue
        target = cand[0] if cand else None
        if target:
            target.FechaHoraVisita = datetime.fromisoformat(when)
            target.EstadoSolicitud = VisitaEstado.PROGRAMADA.value
            target.Responsable = responsable
            target.Direccion = direccion
            # Conservar el historial de motivo previa solicitud y agregar contexto
            extra = (motivo or '').strip()
            if extra:
                target.Motivo = ((target.Motivo + ' | ') if target.Motivo else '') + extra
            target.Modalidad = modalidad
            vis_repo.update(target)
            v = target
            # Cancelar cualquier otra visita pendiente duplicada para esta solicitud
            try:
                for _v in cand[1:]:
                    _v.EstadoSolicitud = VisitaEstado.CANCELADA.value
                    _v.Motivo = ((_v.Motivo + ' | ') if _v.Motivo else '') + 'Reemplazada por programacion'
                    vis_repo.update(_v)
            except Exception:
                pass
    except Exception:
        v = None
    if v is None:
        v = Visita(
            Id=0,
            IdVisita=str(uuid.uuid4())[:8].upper(),
            FechaHoraVisita=datetime.fromisoformat(when),
            EstadoSolicitud=VisitaEstado.PROGRAMADA.value,
            MotivoRechazo='',
            SolicitudId=s.Id,
            Responsable=responsable,
            Direccion=direccion,
            Motivo=motivo,
            Modalidad=modalidad,
        )
        v = vis_repo.add(v)

    # Si es visita a domicilio, marcar/crear seguimiento tipo Domiciliario
    try:
        if (modalidad or motivo).lower().find('domicil') >= 0:
            seg_repo = repos.get('seguimientos')
            so_repo = repos.get('solicitudes')
            if seg_repo and so_repo:
                # Buscar seguimiento existente de la solicitud
                segs = getattr(seg_repo, 'list_all')() if hasattr(seg_repo, 'list_all') else []
                segs = [s for s in segs if int(getattr(s, 'SolicitudId', 0) or 0) == int(s.Id)]
                # Corrección: filtrar por solicitud actual
                segs = [s for s in (getattr(seg_repo, 'list_all')() or []) if int(getattr(s, 'SolicitudId', 0) or 0) == int(s.Id) ]
    except Exception:
        pass
    try:
        if (modalidad or motivo).lower().find('domicil') >= 0:
            seg_repo = repos.get('seguimientos')
            if seg_repo:
                # Buscar existente para esta solicitud
                existing = []
                if hasattr(seg_repo, 'list_all'):
                    existing = [s for s in seg_repo.list_all() if int(getattr(s, 'SolicitudId', 0) or 0) == int(s.Id)]
                    # El filtro anterior no sirve; rehacer con v.SolicitudId
                    existing = [s for s in seg_repo.list_all() if int(getattr(s, 'SolicitudId', 0) or 0) == int(v.SolicitudId)]
                if existing:
                    seg = existing[0]
                    seg.TipoSeguimiento = SeguimientoTipo.DOMICILIARIO.value
                    seg_repo.update(seg)
                else:
                    seg = Seguimiento(
                        Id=0,
                        IdSeguimiento=str(uuid.uuid4())[:8].upper(),
                        FechaSeguimiento=v.FechaHoraVisita,
                        EstadoSeguimiento=SeguimientoEstado.ACTIVO.value,
                        TipoSeguimiento=SeguimientoTipo.DOMICILIARIO.value,
                        Observaciones='Visita domiciliaria programada',
                        Comportamiento='', Adjuntos='', Firma='', SolicitudId=v.SolicitudId,
                    )
                    seg_repo.add(seg)
    except Exception:
        # No bloquear por errores en sincronización de seguimiento
        pass

    return jsonify(message='Visita programada', visita=v.to_dict())


# Adopción: el adoptante puede crear una solicitud de visita (intención)
@visitas_bp.route('/visitas/solicitudes', methods=['POST'])
@require_role([Roles.ADOPTANTE.value])
def crear_solicitud_visita():
    repos = current_app.config['container']['repos']
    vis_repo = repos.get('visitas')
    so_repo = repos.get('solicitudes')
    if vis_repo is None or so_repo is None:
        return jsonify(error=True, message='Repositorio de visitas no disponible'), 500

    body = request.get_json(silent=True) or {}
    # Extensión: permitir solicitar visita con AnimalId (antes de iniciar adopción)
    try:
        if not (body.get('SolicitudId') or 0) and (body.get('AnimalId') or 0):
            animal_id = int(body.get('AnimalId') or 0)
            adop_repo = repos.get('adoptantes')
            animales_repo = repos.get('animales')
            so_repo = repos.get('solicitudes')
            animal = animales_repo.get(animal_id) if animales_repo and hasattr(animales_repo, 'get') else None
            if not animal:
                return jsonify(error=True, message='Animal no encontrado'), 404
            adoptante = None
            if adop_repo and hasattr(adop_repo, 'get_by_usuario'):
                adoptante = adop_repo.get_by_usuario(session['user_id'])
            if not adoptante and adop_repo and hasattr(adop_repo, 'add'):
                from ..domain.adoptante import Adoptante
                adoptante = Adoptante(Id=0, UsuarioId=session['user_id'], Edad=0, Direccion='', Convivientes='', Experiencia='', NumeroTelefono='', Adjuntos='')
                adoptante = adop_repo.add(adoptante)
            if not adoptante:
                return jsonify(error=True, message='No fue posible vincular el adoptante actual'), 500
            existentes = []
            try:
                existentes = [x for x in so_repo.list_for_usuario(session['user_id']) if int(getattr(x, 'AnimalId', 0) or 0) == int(animal_id)]
            except Exception:
                existentes = []
            s_tmp = existentes[0] if existentes else None
            if not s_tmp:
                now = datetime.utcnow()
                sid = str(uuid.uuid4())[:8].upper()
                s_tmp = Solicitud(
                    Id=0,
                    IdSolicitud=sid,
                    FechaSolicitud=now,
                    MotivoSolicitud='Pre-Visita',
                    EstadoSolicitud='Pre-Visita',
                    MotivoRechazo='',
                    Comentarios='Generada automáticamente para solicitud de visita',
                    Adjuntos='',
                    AceptaTerminos=False,
                    Auditoria='Creada para visita previa',
                    FechaActualizacion=now,
                    AnimalId=animal_id,
                    AdoptanteId=adoptante.Id,
                )
                s_tmp = so_repo.add(s_tmp)
            # Inyectar SolicitudId para continuar flujo clásico
            body['SolicitudId'] = s_tmp.Id
    except Exception:
        # fallback silencioso: continúa validación clásica
        pass
    solicitud_id = int(body.get('SolicitudId') or 0)
    if not solicitud_id:
        return jsonify(error=True, message='SolicitudId requerido'), 400
    s = so_repo.get(solicitud_id)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404

    # Verificar que la solicitud pertenezca al usuario actual
    adop_repo = repos.get('adoptantes')
    adoptante = adop_repo.get(s.AdoptanteId) if adop_repo and hasattr(adop_repo, 'get') else None
    current_uid = int(session.get('user_id') or 0)
    permitted = bool(adoptante and int(getattr(adoptante, 'UsuarioId', 0)) == current_uid)
    # Fallback robusto: si por datos antiguos no hay relación adoptante->usuario,
    # validamos con el listado filtrado por usuario.
    if not permitted:
        try:
            mine = [x.Id for x in so_repo.list_for_usuario(current_uid)]
            permitted = s.Id in mine
        except Exception:
            permitted = False
    if not permitted:
        return jsonify(error=True, message='Permisos insuficientes'), 403

    # Validar estado que permita solicitar visita
    if (getattr(s, 'EstadoSolicitud', '') or '') == 'Pre-Visita':
        try:
            s.EstadoSolicitud = 'Pendiente'
        except Exception:
            pass
    # Permitir pre-solicitud de visita sin bloquear validación
    if (getattr(s, 'EstadoSolicitud', '') or '') == 'Pre-Visita':
        try:
            s.EstadoSolicitud = 'Pendiente'
        except Exception:
            pass
    if s.EstadoSolicitud not in ('Pendiente', 'En revisión', 'En revisi\u00f3n'):
        return jsonify(error=True, message='La solicitud no permite pedir visita en su estado actual'), 409

    modalidad = (body.get('Modalidad') or '').strip()  # 'Domiciliaria' | 'Presencial' | 'Virtual'
    direccion = (body.get('Direccion') or '').strip()
    sugerida = (body.get('FechaHoraSugerida') or '').strip()
    comentarios = (body.get('Comentarios') or '').strip()

    if modalidad.lower().startswith('domic') and not direccion:
        return jsonify(error=True, message='Debe indicar la dirección para visita domiciliaria'), 400

    note = 'Solicitada por adoptante'
    if sugerida:
        note += f' | Sugerida: {sugerida}'
    if comentarios:
        note += f' | Comentarios: {comentarios}'
    if modalidad:
        note += f' | Modalidad: {modalidad}'

    # Evitar duplicados: si ya hay una visita PENDIENTE para esta solicitud, actualizarla
    try:
        existing = []
        if hasattr(vis_repo, 'list_all'):
            for _v in vis_repo.list_all():
                if int(getattr(_v, 'SolicitudId', 0) or 0) == int(s.Id) and (getattr(_v, 'EstadoSolicitud', '') or '') == VisitaEstado.PENDIENTE.value:
                    existing.append(_v)
    except Exception:
        existing = []
    if existing:
        v = existing[0]
        if direccion:
            v.Direccion = direccion
        if modalidad:
            v.Modalidad = modalidad
        v.Motivo = ((v.Motivo + ' | ') if v.Motivo else '') + note
        vis_repo.update(v)
        return jsonify(message='Solicitud de visita actualizada', visita=v.to_dict())

    v = Visita(
        Id=0,
        IdVisita=str(uuid.uuid4())[:8].upper(),
        FechaHoraVisita=None,
        EstadoSolicitud=VisitaEstado.PENDIENTE.value,
        MotivoRechazo='',
        SolicitudId=s.Id,
        Responsable='',
        Direccion=direccion,
        Motivo=note,
        Modalidad=modalidad,
    )
    v = vis_repo.add(v)
    return jsonify(message='Visita solicitada. Esperá la confirmación del operador.', visita=v.to_dict())


@visitas_bp.route('/visitas/<int:vid>', methods=['PUT'])
@require_role([Roles.OPERADOR.value])
def reprogramar_visita(vid: int):
    repos = current_app.config['container']['repos']
    vis_repo = repos.get('visitas')
    if vis_repo is None:
        return jsonify(error=True, message='Repositorio de visitas no disponible'), 500
    so = repos['solicitudes']
    v = vis_repo.get(vid)
    if not v:
        return jsonify(error=True, message='Visita no encontrada'), 404
    if v.EstadoSolicitud != VisitaEstado.PROGRAMADA.value:
        return jsonify(error=True, message='El nuevo turno no está disponible'), 409
    body = request.get_json(silent=True) or {}
    when = body.get('FechaHoraVisita')
    if not when:
        return jsonify(error=True, message='Fecha/hora requerida'), 400
    if 'Responsable' in body:
        v.Responsable = (body.get('Responsable') or '').strip()
    if 'Direccion' in body:
        v.Direccion = (body.get('Direccion') or '').strip()
    if 'Motivo' in body:
        v.Motivo = (body.get('Motivo') or '').strip()
    if 'Modalidad' in body:
        v.Modalidad = (body.get('Modalidad') or '').strip()
    s = so.get(v.SolicitudId)
    if vis_repo.has_conflict(s.AnimalId, when):
        return jsonify(error=True, message='El nuevo turno no está disponible'), 409
    v.FechaHoraVisita = datetime.fromisoformat(when)
    vis_repo.update(v)
    return jsonify(message='Visita reprogramada', visita=v.to_dict())


@visitas_bp.route('/visitas/<int:vid>/cancelar', methods=['POST'])
@require_role([Roles.OPERADOR.value])
def cancelar_visita(vid: int):
    repos = current_app.config['container']['repos']
    vis_repo = repos.get('visitas')
    if vis_repo is None:
        return jsonify(error=True, message='Repositorio de visitas no disponible'), 500
    v = vis_repo.get(vid)
    if not v:
        return jsonify(error=True, message='Visita no encontrada'), 404
    if v.EstadoSolicitud != VisitaEstado.PROGRAMADA.value:
        return jsonify(error=True, message='La visita no puede cancelarse'), 409
    body = request.get_json(silent=True) or {}
    v.EstadoSolicitud = VisitaEstado.CANCELADA.value
    v.MotivoRechazo = body.get('Motivo','')
    vis_repo.update(v)
    return jsonify(message='Visita cancelada', visita=v.to_dict())


@visitas_bp.route('/visitas', methods=['GET'])
@require_role([Roles.OPERADOR.value, Roles.VETERINARIO.value])
def listar_visitas():
    repos = current_app.config['container']['repos']
    vis_repo = repos.get('visitas')
    if vis_repo is None or not hasattr(vis_repo, 'list_all'):
        return jsonify(error=True, message='Repositorio de visitas no disponible'), 500

    solicitudes_repo = repos.get('solicitudes')
    animales_repo = repos.get('animales')
    adoptantes_repo = repos.get('adoptantes')
    usuarios_repo = repos.get('usuarios')

    def resolve_context(solicitud_id: int) -> dict:
        s = solicitudes_repo.get(solicitud_id) if solicitudes_repo and hasattr(solicitudes_repo, 'get') else None
        animal = animales_repo.get(s.AnimalId) if s and animales_repo and hasattr(animales_repo, 'get') else None
        adoptante = adoptantes_repo.get(s.AdoptanteId) if s and adoptantes_repo and hasattr(adoptantes_repo, 'get') else None
        usuario = usuarios_repo.get(adoptante.UsuarioId) if adoptante and usuarios_repo and hasattr(usuarios_repo, 'get') else None
        return {
            'SolicitudId': s.Id if s else None,
            'SolicitudCodigo': s.IdSolicitud if s else '',
            'SolicitudFecha': (s.FechaSolicitud.isoformat() if getattr(s, 'FechaSolicitud', None) else (s.FechaActualizacion.isoformat() if getattr(s, 'FechaActualizacion', None) else '')),
            'AnimalNombre': animal.Nombre if animal else '',
            'AnimalEspecie': animal.EspecieRaza if animal else '',
            'AdoptanteNombre': usuario.Nombre if usuario else '',
            'AdoptanteContacto': (adoptante.NumeroTelefono if adoptante and adoptante.NumeroTelefono else (usuario.Email if usuario else '')),
        }

    # Evitar duplicados: si hay varias visitas para la misma solicitud,
    # priorizar Programada > Pendiente > Cancelada y tomar la mas reciente.
    raw = list(vis_repo.list_all())
    by_sol = {}
    def rank_estado(e):
        if e == VisitaEstado.PROGRAMADA.value:
            return 3
        if e == VisitaEstado.PENDIENTE.value:
            return 2
        if e == VisitaEstado.CANCELADA.value:
            return 1
        return 0
    for visita in raw:
        sid = int(getattr(visita, 'SolicitudId', 0) or 0)
        key = sid
        cur = by_sol.get(key)
        # escoge por ranking y por fecha
        if cur is None:
            by_sol[key] = visita
        else:
            a, b = cur, visita
            ra, rb = rank_estado(getattr(a, 'EstadoSolicitud','') or ''), rank_estado(getattr(b, 'EstadoSolicitud','') or '')
            ta = (getattr(a, 'FechaHoraVisita', None) or datetime.min)
            tb = (getattr(b, 'FechaHoraVisita', None) or datetime.min)
            if rb > ra or (rb == ra and tb >= ta):
                by_sol[key] = b
    visitas = []
    for visita in by_sol.values():
        data = visita.to_dict()
        data.update(resolve_context(visita.SolicitudId))
        visitas.append(data)
    # ordenar por fecha
    visitas.sort(key=lambda x: (x.get('FechaHoraVisita') or ''), reverse=True)
    return jsonify(visitas=visitas)


# Adopción: endpoints del adoptante (limitados a sus solicitudes)

@visitas_bp.route('/visitas/mias', methods=['GET'])
@require_role([Roles.ADOPTANTE.value])
def listar_mis_visitas():
    repos = current_app.config['container']['repos']
    vis_repo = repos.get('visitas')
    so_repo = repos.get('solicitudes')
    if vis_repo is None or so_repo is None:
        return jsonify(error=True, message='Repositorio no disponible'), 500
    mis_solicitudes = [s.Id for s in so_repo.list_for_usuario(session['user_id'])]

    solicitudes_repo = repos.get('solicitudes')
    animales_repo = repos.get('animales')
    adoptantes_repo = repos.get('adoptantes')
    usuarios_repo = repos.get('usuarios')

    def resolve_context(solicitud_id: int) -> dict:
        s = solicitudes_repo.get(solicitud_id) if solicitudes_repo and hasattr(solicitudes_repo, 'get') else None
        animal = animales_repo.get(s.AnimalId) if s and animales_repo and hasattr(animales_repo, 'get') else None
        adoptante = adoptantes_repo.get(s.AdoptanteId) if s and adoptantes_repo and hasattr(adoptantes_repo, 'get') else None
        usuario = usuarios_repo.get(adoptante.UsuarioId) if adoptante and usuarios_repo and hasattr(usuarios_repo, 'get') else None
        return {
            'SolicitudId': s.Id if s else None,
            'SolicitudCodigo': s.IdSolicitud if s else '',
            'SolicitudFecha': (s.FechaSolicitud.isoformat() if getattr(s, 'FechaSolicitud', None) else (s.FechaActualizacion.isoformat() if getattr(s, 'FechaActualizacion', None) else '')),
            'AnimalNombre': animal.Nombre if animal else '',
            'AnimalEspecie': animal.EspecieRaza if animal else '',
            'AdoptanteNombre': usuario.Nombre if usuario else '',
            'AdoptanteContacto': (adoptante.NumeroTelefono if adoptante and adoptante.NumeroTelefono else (usuario.Email if usuario else '')),
        }

    visitas = []
    for v in getattr(vis_repo, 'list_all')() if hasattr(vis_repo, 'list_all') else []:
        if int(getattr(v, 'SolicitudId', 0) or 0) in mis_solicitudes:
            data = v.to_dict()
            data.update(resolve_context(v.SolicitudId))
            visitas.append(data)
    return jsonify(visitas=visitas)


@visitas_bp.route('/visitas/<int:vid>/confirmar-asistencia', methods=['POST'])
@require_role([Roles.ADOPTANTE.value])
def confirmar_asistencia_adoptante(vid: int):
    repos = current_app.config['container']['repos']
    vis_repo = repos.get('visitas')
    so_repo = repos.get('solicitudes')
    if vis_repo is None or so_repo is None:
        return jsonify(error=True, message='Repositorio no disponible'), 500
    v = vis_repo.get(vid)
    if not v:
        return jsonify(error=True, message='Visita no encontrada'), 404
    s = so_repo.get(v.SolicitudId)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    # Verificar que la solicitud pertenezca al usuario actual
    adop_repo = repos.get('adoptantes')
    adoptante = adop_repo.get(s.AdoptanteId) if adop_repo and hasattr(adop_repo, 'get') else None
    if not adoptante or int(getattr(adoptante, 'UsuarioId', 0)) != int(session.get('user_id') or 0):
        return jsonify(error=True, message='Permisos insuficientes'), 403
    if v.EstadoSolicitud != VisitaEstado.PROGRAMADA.value:
        return jsonify(error=True, message='La visita no puede confirmarse en su estado actual'), 409
    # Registrar confirmación en el campo Motivo (registro liviano sin alterar esquema)
    note = 'Confirmada por adoptante'
    v.Motivo = (v.Motivo + ' | ' if v.Motivo else '') + note
    vis_repo.update(v)
    return jsonify(message='Tu asistencia fue confirmada', visita=v.to_dict())


@visitas_bp.route('/visitas/<int:vid>/solicitar-cambio', methods=['POST'])
@require_role([Roles.ADOPTANTE.value])
def solicitar_cambio_visita(vid: int):
    repos = current_app.config['container']['repos']
    vis_repo = repos.get('visitas')
    so_repo = repos.get('solicitudes')
    if vis_repo is None or so_repo is None:
        return jsonify(error=True, message='Repositorio no disponible'), 500
    v = vis_repo.get(vid)
    if not v:
        return jsonify(error=True, message='Visita no encontrada'), 404
    s = so_repo.get(v.SolicitudId)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    adop_repo = repos.get('adoptantes')
    adoptante = adop_repo.get(s.AdoptanteId) if adop_repo and hasattr(adop_repo, 'get') else None
    if not adoptante or int(getattr(adoptante, 'UsuarioId', 0)) != int(session.get('user_id') or 0):
        return jsonify(error=True, message='Permisos insuficientes'), 403
    if v.EstadoSolicitud != VisitaEstado.PROGRAMADA.value:
        return jsonify(error=True, message='La visita no puede reprogramarse en su estado actual'), 409
    body = request.get_json(silent=True) or {}
    sugerencia = (body.get('NuevaFechaHora') or '').strip()
    razon = (body.get('Motivo') or '').strip()
    note = 'Solicitud de cambio por adoptante'
    if sugerencia:
        note += f' - Nueva fecha/hora sugerida: {sugerencia}'
    if razon:
        note += f' - Motivo: {razon}'
    v.Motivo = (v.Motivo + ' | ' if v.Motivo else '') + note
    vis_repo.update(v)
    return jsonify(message='Se registró tu solicitud de cambio. El equipo te confirmará a la brevedad.', visita=v.to_dict())
