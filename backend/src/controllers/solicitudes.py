from __future__ import annotations
import uuid
from datetime import datetime
from flask import Blueprint, current_app, jsonify, request, session
from .decorators import require_role
from ..domain.constants import Roles, AnimalSolicitud, SolicitudEstado, VisitaEstado

from ..domain.solicitud import Solicitud
from ..domain.animal_auditoria import AnimalAuditoria


solicitudes_bp = Blueprint('solicitudes', __name__)


@solicitudes_bp.route('/solicitudes', methods=['GET'])
@require_role([Roles.ADOPTANTE.value])
def list_mis_solicitudes():
    repos = current_app.config['container']['repos']
    so = repos['solicitudes']
    # Enriquecer con datos del animal y adoptante para mejorar la UI del adoptante
    adoptantes = repos.get('adoptantes')
    usuarios = repos.get('usuarios')
    animales = repos.get('animales')

    def enrich(s: Solicitud) -> dict:
        data = s.to_dict()
        adoptante = adoptantes.get(s.AdoptanteId) if adoptantes and hasattr(adoptantes, 'get') else None
        usuario = usuarios.get(adoptante.UsuarioId) if adoptante and usuarios and hasattr(usuarios, 'get') else None
        animal = animales.get(s.AnimalId) if animales and hasattr(animales, 'get') else None
        data.update({
            'AdoptanteNombre': usuario.Nombre if usuario else '',
            'AdoptanteContacto': (adoptante.NumeroTelefono if adoptante and adoptante.NumeroTelefono else (usuario.Email if usuario else '')),
            'AdoptanteDireccion': adoptante.Direccion if adoptante else '',
            'AnimalNombre': animal.Nombre if animal else '',
            'AnimalEspecie': animal.EspecieRaza if animal else '',
        })
        return data

    out = [enrich(s) for s in so.list_for_usuario(session['user_id'])]
    return jsonify(solicitudes=out)


# NUEVO: listado completo para operadores
@solicitudes_bp.route('/solicitudes/todas', methods=['GET'])
@require_role([Roles.OPERADOR.value, Roles.VETERINARIO.value])
def list_todas_solicitudes():
    repos = current_app.config['container']['repos']
    so = repos['solicitudes']
    # Repos in-memory/sqlite exponen list_all
    if not hasattr(so, 'list_all'):
        return jsonify(error=True, message='Listado no disponible'), 501
    adoptantes = repos.get('adoptantes')
    usuarios = repos.get('usuarios')
    animales = repos.get('animales')

    def enrich(s: Solicitud) -> dict:
        data = s.to_dict()
        adoptante = adoptantes.get(s.AdoptanteId) if adoptantes and hasattr(adoptantes, 'get') else None
        usuario = usuarios.get(adoptante.UsuarioId) if adoptante and usuarios and hasattr(usuarios, 'get') else None
        animal = animales.get(s.AnimalId) if animales and hasattr(animales, 'get') else None
        data.update({
            'AdoptanteNombre': usuario.Nombre if usuario else '',
            'AdoptanteContacto': (adoptante.NumeroTelefono if adoptante and adoptante.NumeroTelefono else (usuario.Email if usuario else '')),
            'AdoptanteDireccion': adoptante.Direccion if adoptante else '',
            'AnimalNombre': animal.Nombre if animal else '',
            'AnimalEspecie': animal.EspecieRaza if animal else '',
        })
        return data

    # Para operadores debemos listar TODAS las solicitudes; no filtrar por usuario.
    # Algunos repos implementan list_all(); si no existe, caer a list() genérico.
    if hasattr(so, 'list_all'):
        base_list = so.list_all()
    elif hasattr(so, 'list'):
        base_list = so.list()
    else:
        base_list = []
    out = [enrich(s) for s in base_list]
    return jsonify(solicitudes=out)


@solicitudes_bp.route('/solicitudes', methods=['POST'])
@require_role([Roles.ADOPTANTE.value])
def alta_solicitud():
    repos = current_app.config['container']['repos']
    animales = repos['animales']
    so = repos['solicitudes']
    adop_repo = repos.get('adoptantes')
    if adop_repo is None:
        return jsonify(error=True, message='Repositorio de adoptantes no disponible'), 500
    auditoria = repos['animal_auditoria']

    body = request.get_json(silent=True) or {}

    # Robustez: aceptar el id del animal desde varias claves y formatos
    def _parse_animal_id(payload: dict) -> int:
        try:
            candidates = [
                payload.get('AnimalId'), payload.get('animalId'),
                payload.get('petId'), payload.get('PetId'),
                payload.get('MascotaId'), payload.get('Mascota'),
                payload.get('IdAnimal'), payload.get('Animal'),
            ]
            for v in candidates:
                if v is None:
                    continue
                try:
                    s = str(v).strip()
                    if s.isdigit():
                        return int(s)
                    # extraer primeros dígitos de cadenas con texto (ej.: "#12 Toby")
                    import re
                    m = re.search(r"\d+", s)
                    if m:
                        return int(m.group(0))
                except Exception:
                    continue
        except Exception:
            pass
        return 0

    animal_id = int(body.get('AnimalId') or 0) or _parse_animal_id(body)
    a = animales.get(animal_id)
    if not a:
        # Fallback: intentar resolver por nombre enviado por el cliente
        try:
            nombre = (body.get('AnimalNombre') or body.get('MascotaNombre') or body.get('Mascota') or body.get('Animal') or '').strip()
            if nombre and hasattr(animales, 'list'):
                import unicodedata, re
                def _norm(s: str) -> str:
                    s = unicodedata.normalize('NFKD', s)
                    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
                    return s.strip().lower()
                base_raw = nombre.split('·')[0].split('|')[0].split('-')[0]
                base = _norm(base_raw)
                best = None
                for cand in animales.list():
                    cname = str(getattr(cand, 'Nombre', '') or '')
                    n = _norm(cname)
                    if n == base or base in n or n in base:
                        best = cand
                        break
                if best:
                    a = best
                    animal_id = best.Id
        except Exception:
            pass
    if not a:
        return jsonify(error=True, message='Animal no encontrado'), 404
    # 4. Verificar disponibilidad
    if (a.EstadoSalud or '') != 'Apto para adopción' or (a.EstadoSolicitud or '') in ('Reservado', 'No disponible'):
        return jsonify(error=True, message='Actualmente no disponible'), 409

    # 5-6. Validación de campos
    acepta = bool(body.get('AceptaTerminos', False))
    if not acepta:
        return jsonify(error=True, message='Complete los campos obligatorios'), 400

    # Asegurar adoptante
    adoptante = adop_repo.get_by_usuario(session['user_id']) if adop_repo else None
    if not adoptante:
        from ..domain.adoptante import Adoptante
        adoptante = Adoptante(Id=0, UsuarioId=session['user_id'], Edad=int(body.get('Edad', 0) or 0), Direccion=body.get('Direccion',''), Convivientes=body.get('Convivientes',''), Experiencia=body.get('Experiencia',''), NumeroTelefono=body.get('NumeroTelefono',''), Adjuntos=body.get('Adjuntos',''))
        adoptante = adop_repo.add(adoptante)

    now = datetime.utcnow()
    sid = str(uuid.uuid4())[:8].upper()
    s = Solicitud(
        Id=0, IdSolicitud=sid, FechaSolicitud=now, MotivoSolicitud=body.get('MotivoSolicitud',''), EstadoSolicitud=SolicitudEstado.PENDIENTE.value, MotivoRechazo='', Comentarios=body.get('Comentarios',''), Adjuntos=body.get('Adjuntos',''), AceptaTerminos=acepta, Auditoria='Creada por adoptante', FechaActualizacion=now, AnimalId=a.Id, AdoptanteId=adoptante.Id
    )
    s = so.add(s)
    auditoria.add(AnimalAuditoria(Id=0, AnimalId=a.Id, OperadorId=None, Evento='SOLICITUD_ALTA', Detalles=f'Solicitud {sid} creada', Fecha=now))
    return jsonify(message='Solicitud creada en estado Pendiente', solicitud=s.to_dict())


@solicitudes_bp.route('/solicitudes/<int:sid>', methods=['PUT'])
@require_role([Roles.ADOPTANTE.value])
def modificar_solicitud(sid: int):
    repos = current_app.config['container']['repos']
    so = repos['solicitudes']
    adop_repo = repos.get('adoptantes')
    s = so.get(sid)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    if (s.EstadoSolicitud or '') not in ('Pendiente', 'En revisión', 'En revisi��n'):
        return jsonify(error=True, message='No se puede editar este estado'), 409
    body = request.get_json(silent=True) or {}
    # Actualizar campos permitidos
    s.Comentarios = body.get('Comentarios', s.Comentarios)
    s.Adjuntos = body.get('Adjuntos', s.Adjuntos)
    s.FechaActualizacion = datetime.utcnow()
    so.update(s)
    # Actualizar datos de contacto del adoptante si vienen
    ad = adop_repo.get_by_usuario(session['user_id']) if adop_repo else None
    if ad:
        if 'NumeroTelefono' in body:
            ad.NumeroTelefono = body['NumeroTelefono']
        if 'Direccion' in body:
            ad.Direccion = body['Direccion']
        adop_repo.update(ad)
    return jsonify(message='Solicitud actualizada', solicitud=s.to_dict())


@solicitudes_bp.route('/solicitudes/<int:sid>/cancelar', methods=['POST'])
@require_role([Roles.ADOPTANTE.value])
def cancelar_solicitud(sid: int):
    repos = current_app.config['container']['repos']
    so = repos['solicitudes']
    s = so.get(sid)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    if (s.EstadoSolicitud or '') not in ('Pendiente', 'En revisión', 'En revisi��n'):
        return jsonify(error=True, message='Esta solicitud no puede cancelarse'), 409
    body = request.get_json(silent=True) or {}
    motivo = body.get('Motivo','')
    s.EstadoSolicitud = SolicitudEstado.CANCELADA.value
    s.MotivoRechazo = motivo
    s.Auditoria = (s.Auditoria or '') + f' | Cancelada por adoptante: {motivo}'
    s.FechaActualizacion = datetime.utcnow()
    so.update(s)
    return jsonify(message='La solicitud fue cancelada', solicitud=s.to_dict())


@solicitudes_bp.route('/solicitudes/<int:sid>/poner-en-revision', methods=['POST'])
@require_role([Roles.OPERADOR.value])
def poner_en_revision(sid: int):
    repos = current_app.config['container']['repos']
    so = repos['solicitudes']
    animales = repos['animales']
    body = request.get_json(silent=True) or {}
    s = so.get(sid)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    if (s.EstadoSolicitud or '') != SolicitudEstado.PENDIENTE.value:
        return jsonify(error=True, message='Estado no válido para poner en revisión'), 409
    a = animales.get(s.AnimalId)
    # Chequeo adicional de disponibilidad (reservado/baja)
    try:
        reservado = getattr(AnimalSolicitud, 'RESERVADO').value
        baja = getattr(AnimalSolicitud, 'BAJA').value
    except Exception:
        reservado = 'Reservado'
        baja = 'Baja'
    if not a or (a.EstadoSolicitud or '') in (reservado, baja):
        return jsonify(error=True, message='Animal no disponible'), 409
    if not a or (a.EstadoSolicitud or '') == AnimalSolicitud.NO_DISPONIBLE.value:
        return jsonify(error=True, message='Animal no disponible'), 409
    # Requerimiento de información (obligatorio) + plazo opcional
    requerimiento = (body.get('Requerimiento') or body.get('Motivo') or '').strip()
    plazo = (body.get('Plazo') or body.get('PlazoDias') or '').strip()
    if not requerimiento:
        return jsonify(error=True, message='Escriba el requerimiento de información'), 400
    s.EstadoSolicitud = SolicitudEstado.EN_REVISION.value
    # Anexar detalles del requerimiento a la auditoría y comentarios visibles
    detalle_req = f" | Requerimiento: {requerimiento}" + (f"; Plazo: {plazo}" if plazo else '')
    s.Auditoria = (s.Auditoria or '') + detalle_req
    s.Comentarios = (s.Comentarios + ' | ' if s.Comentarios else '') + ('Requerimiento: ' + requerimiento + (f" (Plazo: {plazo})" if plazo else ''))
    s.Auditoria = (s.Auditoria or '') + ' | Puesta en revisión'
    s.FechaActualizacion = datetime.utcnow()
    so.update(s)
    return jsonify(message='Solicitud en revisión', solicitud=s.to_dict())


def _cerrar_logic(s, accion: str, motivo: str, animales, so, visitas=None):
    estado = (s.EstadoSolicitud or '')
    # admitir variantes presentes en el repo
    estados_validos = ('Pendiente', 'En revisi��n', 'En revisi������n')
    if estado not in estados_validos:
        return jsonify(error=True, message='No se puede cerrar este estado'), 409

    accion = (accion or '').strip().lower()
    if accion not in ('rechazar', 'anular'):
        return jsonify(error=True, message='Accion invalida'), 400
    if accion == 'rechazar' and not motivo:
        return jsonify(error=True, message='Motivo es obligatorio para rechazar'), 400

    if accion == 'rechazar':
        s.EstadoSolicitud = 'Rechazada'
        s.MotivoRechazo = motivo
        s.Auditoria = (s.Auditoria or '') + f' | Rechazada: {motivo}'
        s.FechaActualizacion = datetime.utcnow()
        so.update(s)
        # Al rechazar, cancelar visitas asociadas (si existen)
        try:
            if visitas and hasattr(visitas, 'list_all'):
                for v in visitas.list_all():
                    try:
                        if int(getattr(v, 'SolicitudId', 0) or 0) == int(s.Id) and (getattr(v, 'EstadoSolicitud', '') or '') != VisitaEstado.CANCELADA.value:
                            v.EstadoSolicitud = VisitaEstado.CANCELADA.value
                            v.Motivo = ((v.Motivo + ' | ') if v.Motivo else '') + 'Cancelada por solicitud rechazada'
                            visitas.update(v)
                    except Exception:
                        continue
        except Exception:
            pass
        a = animales.get(s.AnimalId)
        if a and (a.EstadoSolicitud or '') == AnimalSolicitud.RESERVADO.value:
            a.EstadoSolicitud = AnimalSolicitud.VACIO.value
            a.FechaActualizacion = datetime.utcnow()
            animales.update(a)
        return jsonify(message='La solicitud fue rechazada', solicitud=s.to_dict())

    # anular
    s.EstadoSolicitud = 'Anulada'
    if motivo:
        s.MotivoRechazo = motivo
    s.Auditoria = (s.Auditoria or '') + (f' | Anulada: {motivo}' if motivo else ' | Anulada')
    s.FechaActualizacion = datetime.utcnow()
    so.update(s)
    # Al anular, cancelar visitas asociadas (pendientes o programadas)
    try:
        if visitas and hasattr(visitas, 'list_all'):
            for v in visitas.list_all():
                try:
                    if int(getattr(v, 'SolicitudId', 0) or 0) == int(s.Id) and (getattr(v, 'EstadoSolicitud', '') or '') != VisitaEstado.CANCELADA.value:
                        v.EstadoSolicitud = VisitaEstado.CANCELADA.value
                        v.Motivo = ((v.Motivo + ' | ') if v.Motivo else '') + 'Cancelada por solicitud anulada'
                        visitas.update(v)
                except Exception:
                    continue
    except Exception:
        pass
    return jsonify(message='Solicitud anulada', solicitud=s.to_dict())


@solicitudes_bp.route('/solicitudes/<int:sid>/cerrar', methods=['POST'])
@require_role([Roles.OPERADOR.value])
def cerrar_solicitud(sid: int):
    repos = current_app.config['container']['repos']
    so = repos['solicitudes']
    animales = repos['animales']
    visitas = repos.get('visitas')
    s = so.get(sid)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    body = request.get_json(silent=True) or {}
    accion = (body.get('Accion') or '').strip().lower()
    motivo = (body.get('Motivo') or '').strip()
    return _cerrar_logic(s, accion, motivo, animales, so, visitas)

@solicitudes_bp.route('/solicitudes/<int:sid>/aprobar', methods=['POST'])
@require_role([Roles.OPERADOR.value])
def aprobar_solicitud(sid: int):
    repos = current_app.config['container']['repos']
    so = repos['solicitudes']
    animales = repos['animales']
    s = so.get(sid)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    a = animales.get(s.AnimalId)
    if not a or (a.EstadoSolicitud or '') == AnimalSolicitud.RESERVADO.value:
        return jsonify(error=True, message='No se puede aprobar: conflicto de disponibilidad'), 409
    s.EstadoSolicitud = SolicitudEstado.APROBADA.value
    s.Auditoria = (s.Auditoria or '') + ' | Aprobada'
    s.FechaActualizacion = datetime.utcnow()
    so.update(s)
    a.EstadoSolicitud = AnimalSolicitud.RESERVADO.value
    a.FechaActualizacion = datetime.utcnow()
    animales.update(a)
    return jsonify(message='Solicitud aprobada', solicitud=s.to_dict())


@solicitudes_bp.route('/solicitudes/<int:sid>/rechazar', methods=['POST'])
@require_role([Roles.OPERADOR.value])
def rechazar_solicitud(sid: int):
    repos = current_app.config['container']['repos']
    so = repos['solicitudes']
    animales = repos['animales']
    visitas = repos.get('visitas')
    s = so.get(sid)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    body = request.get_json(silent=True) or {}
    motivo = (body.get('Motivo') or '').strip()
    return _cerrar_logic(s, 'rechazar', motivo, animales, so, visitas)


@solicitudes_bp.route('/solicitudes/<int:sid>/anular', methods=['POST'])
@require_role([Roles.OPERADOR.value])
def anular_solicitud(sid: int):
    repos = current_app.config['container']['repos']
    so = repos['solicitudes']
    animales = repos['animales']
    visitas = repos.get('visitas')
    s = so.get(sid)
    if not s:
        return jsonify(error=True, message='Solicitud no encontrada'), 404
    body = request.get_json(silent=True) or {}
    motivo = (body.get('Motivo') or '').strip()
    return _cerrar_logic(s, 'anular', motivo, animales, so, visitas)
