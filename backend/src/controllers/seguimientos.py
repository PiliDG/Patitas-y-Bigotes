from __future__ import annotations
import uuid
from datetime import datetime
from typing import Iterable
from flask import Blueprint, current_app, jsonify, request, session
from .decorators import require_role
from ..domain.constants import Roles, SeguimientoEstado, SeguimientoTipo, SolicitudEstado
from ..domain.seguimiento import Seguimiento
from ..domain.solicitud import Solicitud
from ..domain.adoptante import Adoptante


seguimientos_bp = Blueprint('seguimientos', __name__)


_CANONICAL_TYPES = {
    SeguimientoTipo.VETERINARIO.value.lower(): SeguimientoTipo.VETERINARIO.value,
    SeguimientoTipo.ADMINISTRATIVO.value.lower(): SeguimientoTipo.ADMINISTRATIVO.value,
    SeguimientoTipo.DOMICILIARIO.value.lower(): SeguimientoTipo.DOMICILIARIO.value,
}


def _normalize_role(value: str | None) -> str:
    return (value or '').strip().lower()


def _get_effective_role() -> str:
    role = _normalize_role(session.get('user_tipo'))
    if role:
        return role
    return _normalize_role(request.headers.get('X-User-Type'))


def _normalize_type(value: str | None) -> str:
    return (value or '').strip().lower()


def _canonical_type(value: str | None, default: str) -> str:
    norm = _normalize_type(value)
    return _CANONICAL_TYPES.get(norm, default)


def _resolve_or_create_solicitud(repos, solicitud_id=0, animal_id=0):
    so = repos.get('solicitudes')
    if so is None:
        return None
    s = None
    if solicitud_id:
        if hasattr(so, 'get'):
            s = so.get(solicitud_id)
    elif animal_id:
        if hasattr(so, 'list_all'):
            candidatos = [x for x in so.list_all() if int(x.AnimalId or 0) == animal_id]
            candidatos.sort(key=lambda x: x.FechaSolicitud or datetime.min, reverse=True)
            s = candidatos[0] if candidatos else None
    if s:
        return s
    target_id = animal_id or solicitud_id or 0
    try:
        target_id = int(target_id)
    except Exception:
        target_id = 0
    animales_repo = repos.get('animales')
    adoptantes_repo = repos.get('adoptantes')
    if not target_id or animales_repo is None:
        return None
    animal = animales_repo.get(target_id) if hasattr(animales_repo, 'get') else None
    if not animal or adoptantes_repo is None:
        return None
    adoptante = adoptantes_repo.get_by_usuario(session.get('user_id') or 0) if hasattr(adoptantes_repo, 'get_by_usuario') else None
    if not adoptante:
        adoptante = Adoptante(Id=0, UsuarioId=session.get('user_id') or 0, Edad=0, Direccion='', Convivientes='', Experiencia='', NumeroTelefono='', Adjuntos='')
        adoptante = adoptantes_repo.add(adoptante)
    now = datetime.utcnow()
    sid = str(uuid.uuid4())[:8].upper()
    new_solicitud = Solicitud(
        Id=0,
        IdSolicitud=sid,
        FechaSolicitud=now,
        MotivoSolicitud='Seguimiento operativo',
        EstadoSolicitud=SolicitudEstado.EN_REVISION.value,
        MotivoRechazo='',
        Comentarios='Creada automáticamente desde seguimiento',
        Adjuntos='',
        AceptaTerminos=True,
        Auditoria='Creada automáticamente',
        FechaActualizacion=now,
        AnimalId=animal.Id,
        AdoptanteId=adoptante.Id,
    )
    try:
        return so.add(new_solicitud)
    except Exception:
        return None


@seguimientos_bp.route('/seguimientos', methods=['POST'])
def crear_seguimiento():
    role = _get_effective_role()
    if role not in (Roles.OPERADOR.value, Roles.VETERINARIO.value):
        return jsonify(error=True, message='Permisos insuficientes'), 403
    repos = current_app.config['container']['repos']
    seg_repo = repos.get('seguimientos')
    if seg_repo is None:
        return jsonify(error=True, message='Repositorio de seguimientos no disponible'), 500

    body = request.get_json(silent=True) or {}
    animal_id = int(body.get('AnimalId') or 0)
    solicitud_id = int(body.get('SolicitudId') or 0)
    solicitud = _resolve_or_create_solicitud(repos, solicitud_id, animal_id)
    if not solicitud:
        return jsonify(error=True, message='No se encontró un expediente asociado para este seguimiento'), 404
    if not body.get('FechaSeguimiento') or not body.get('Observaciones'):
        return jsonify(error=True, message='Debe completar todos los campos obligatorios'), 400

    if role == Roles.VETERINARIO.value:
        tipo = SeguimientoTipo.VETERINARIO.value
    else:
        tipo = _canonical_type(body.get('TipoSeguimiento'), SeguimientoTipo.ADMINISTRATIVO.value)

    seg = Seguimiento(
        Id=0,
        IdSeguimiento=str(uuid.uuid4())[:8].upper(),
        FechaSeguimiento=datetime.fromisoformat(body['FechaSeguimiento']),
        EstadoSeguimiento=body.get('EstadoSeguimiento', SeguimientoEstado.ACTIVO.value),
        TipoSeguimiento=tipo,
        Observaciones=body.get('Observaciones', ''),
        Comportamiento=body.get('Comportamiento', ''),
        Adjuntos=body.get('Adjuntos', ''),
        Firma=body.get('Firma', ''),
        SolicitudId=solicitud.Id,
    )
    seg = seg_repo.add(seg)
    return jsonify(message='Seguimiento registrado', seguimiento=seg.to_dict())


@seguimientos_bp.route('/seguimientos/solicitud-por-animal', methods=['POST'])
def solicitud_por_animal():
    role = _get_effective_role()
    if role not in (Roles.OPERADOR.value, Roles.VETERINARIO.value):
        return jsonify(error=True, message='Permisos insuficientes'), 403
    repos = current_app.config['container']['repos']
    body = request.get_json(silent=True) or {}
    animal_id = int(body.get('AnimalId') or 0)
    if not animal_id:
        return jsonify(error=True, message='AnimalId requerido'), 400
    solicitud = _resolve_or_create_solicitud(repos, 0, animal_id)
    if not solicitud:
        return jsonify(error=True, message='No se pudo obtener o crear un expediente'), 404
    return jsonify(solicitud=solicitud.to_dict())


@seguimientos_bp.route('/seguimientos', methods=['GET'])
def listar_seguimientos():
    role = _get_effective_role()
    if role not in (Roles.OPERADOR.value, Roles.VETERINARIO.value):
        return jsonify(error=True, message='Permisos insuficientes'), 403
    repos = current_app.config['container']['repos']
    seg_repo = repos.get('seguimientos')
    if seg_repo is None:
        return jsonify(error=True, message='Repositorio de seguimientos no disponible'), 500
    if not hasattr(seg_repo, 'list_all'):
        return jsonify(error=True, message='Listado no disponible'), 501
    out = [s.to_dict() for s in seg_repo.list_all()]
    return jsonify(seguimientos=out)


@seguimientos_bp.route('/seguimientos/por-animal', methods=['GET'])
def seguimientos_por_animal():
    repos = current_app.config['container']['repos']
    seg_repo = repos.get('seguimientos')
    so_repo = repos.get('solicitudes')
    if seg_repo is None or so_repo is None:
        return jsonify(error=True, message='Repositorio no disponible'), 500
    animal_id = request.args.get('animalId', type=int)
    if not animal_id:
        return jsonify(error=True, message='animalId requerido'), 400
    segs = getattr(seg_repo, 'list_all')() if hasattr(seg_repo, 'list_all') else []
    out = []
    for seg in segs:
        solicitud = so_repo.get(getattr(seg, 'SolicitudId', 0)) if hasattr(so_repo, 'get') else None
        if solicitud and int(getattr(solicitud, 'AnimalId', 0) or 0) == int(animal_id):
            out.append(seg.to_dict())
    try:
        out.sort(key=lambda x: (x.get('FechaSeguimiento') or ''), reverse=True)
    except Exception:
        pass
    return jsonify(seguimientos=out)


@seguimientos_bp.route('/seguimientos/<int:sid>', methods=['PUT'])
def modificar_seguimiento(sid: int):
    role = _get_effective_role()
    if role not in (Roles.OPERADOR.value, Roles.VETERINARIO.value):
        return jsonify(error=True, message='Permisos insuficientes'), 403
    repos = current_app.config['container']['repos']
    seg_repo = repos.get('seguimientos')
    if seg_repo is None:
        return jsonify(error=True, message='Repositorio de seguimientos no disponible'), 500
    seg = seg_repo.get(sid)
    if not seg:
        return jsonify(error=True, message='Seguimiento no encontrado'), 404
    if seg.EstadoSeguimiento not in (SeguimientoEstado.ACTIVO.value, SeguimientoEstado.PENDIENTE.value):
        return jsonify(error=True, message='Este seguimiento no puede ser modificado'), 409
    if role == Roles.VETERINARIO.value and _normalize_type(seg.TipoSeguimiento) != Roles.VETERINARIO.value:
        return jsonify(error=True, message='Permisos insuficientes'), 403
    body = request.get_json(silent=True) or {}
    if 'Observaciones' in body:
        seg.Observaciones = body['Observaciones']
    if 'Adjuntos' in body:
        seg.Adjuntos = body['Adjuntos']
    if 'EstadoSeguimiento' in body:
        seg.EstadoSeguimiento = body['EstadoSeguimiento']
    if role == Roles.OPERADOR.value and 'TipoSeguimiento' in body:
        seg.TipoSeguimiento = _canonical_type(body.get('TipoSeguimiento'), seg.TipoSeguimiento or SeguimientoTipo.ADMINISTRATIVO.value)
    seg_repo.update(seg)
    return jsonify(message='Seguimiento actualizado', seguimiento=seg.to_dict())


@seguimientos_bp.route('/seguimientos/<int:sid>/cancelar', methods=['POST'])
def cancelar_seguimiento(sid: int):
    role = _get_effective_role()
    if role not in (Roles.OPERADOR.value, Roles.VETERINARIO.value):
        return jsonify(error=True, message='Permisos insuficientes'), 403
    repos = current_app.config['container']['repos']
    seg_repo = repos.get('seguimientos')
    if seg_repo is None:
        return jsonify(error=True, message='Repositorio de seguimientos no disponible'), 500
    seg = seg_repo.get(sid)
    if not seg:
        return jsonify(error=True, message='Seguimiento no encontrado'), 404
    if seg.EstadoSeguimiento not in (SeguimientoEstado.ACTIVO.value, SeguimientoEstado.PENDIENTE.value):
        return jsonify(error=True, message='Este seguimiento no puede cancelarse'), 409
    if role == Roles.VETERINARIO.value and _normalize_type(seg.TipoSeguimiento) != Roles.VETERINARIO.value:
        return jsonify(error=True, message='Permisos insuficientes'), 403
    body = request.get_json(silent=True) or {}
    seg.EstadoSeguimiento = SeguimientoEstado.CANCELADO.value
    if 'Observaciones' in body:
        seg.Observaciones = body['Observaciones']
    if 'Adjuntos' in body:
        seg.Adjuntos = body['Adjuntos']
    seg_repo.update(seg)
    return jsonify(message='Seguimiento cancelado', seguimiento=seg.to_dict())


@seguimientos_bp.route('/seguimientos/mios', methods=['GET'])
@require_role([Roles.ADOPTANTE.value])
def listar_mis_seguimientos():
    repos = current_app.config['container']['repos']
    seg_repo = repos.get('seguimientos')
    so_repo = repos.get('solicitudes')
    if seg_repo is None or so_repo is None:
        return jsonify(error=True, message='Repositorio no disponible'), 500
    segs = getattr(seg_repo, 'list_all')() if hasattr(seg_repo, 'list_all') else []
    solicitud_ids = {s.Id for s in so_repo.list_for_usuario(session['user_id'])}
    out = [s.to_dict() for s in segs if int(getattr(s, 'SolicitudId', 0) or 0) in solicitud_ids]
    return jsonify(seguimientos=out)


@seguimientos_bp.route('/seguimientos/mios', methods=['POST'])
@require_role([Roles.ADOPTANTE.value])
def crear_mi_seguimiento():
    repos = current_app.config['container']['repos']
    so = repos.get('solicitudes')
    seg_repo = repos.get('seguimientos')
    if seg_repo is None or so is None:
        return jsonify(error=True, message='Repositorio no disponible'), 500
    body = request.get_json(silent=True) or {}
    solicitud_id = int(body.get('SolicitudId') or 0)
    if not solicitud_id:
        return jsonify(error=True, message='SolicitudId requerido'), 400
    solicitud = so.get(solicitud_id)
    if not solicitud:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    if solicitud.AdoptanteId is None:
        return jsonify(error=True, message='Permisos insuficientes'), 403
    adoptantes_repo = repos.get('adoptantes')
    adoptante = adoptantes_repo.get(solicitud.AdoptanteId) if adoptantes_repo and hasattr(adoptantes_repo, 'get') else None
    if not adoptante or int(getattr(adoptante, 'UsuarioId', 0)) != int(session.get('user_id') or 0):
        return jsonify(error=True, message='Permisos insuficientes'), 403
    if not body.get('Observaciones'):
        return jsonify(error=True, message='Debe ingresar observaciones'), 400
    tipo = _canonical_type(body.get('TipoSeguimiento'), SeguimientoTipo.DOMICILIARIO.value)
    estado = body.get('EstadoSeguimiento') or SeguimientoEstado.ACTIVO.value
    now = datetime.utcnow()
    seg = Seguimiento(
        Id=0,
        IdSeguimiento=str(uuid.uuid4())[:8].upper(),
        FechaSeguimiento=datetime.fromisoformat(body.get('FechaSeguimiento') or now.isoformat()),
        EstadoSeguimiento=estado,
        TipoSeguimiento=tipo,
        Observaciones=body.get('Observaciones', ''),
        Comportamiento=body.get('Comportamiento', ''),
        Adjuntos=body.get('Adjuntos', ''),
        Firma=body.get('Firma', ''),
        SolicitudId=solicitud.Id,
    )
    seg = seg_repo.add(seg)
    return jsonify(message='Seguimiento domiciliario registrado', seguimiento=seg.to_dict())
