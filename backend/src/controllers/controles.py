from __future__ import annotations
from datetime import date, datetime
import sqlite3
from flask import Blueprint, current_app, jsonify, request, session
from ..domain.constants import Roles, AnimalSalud

from ..domain.control_sanitario import ControlSanitario
from ..domain.animal_auditoria import AnimalAuditoria


controles_bp = Blueprint('controles', __name__)


def _normalize_role(value: str | None) -> str:
    return (value or '').strip().lower()


ALLOWED_CONTROL_ROLES = frozenset({
    _normalize_role(Roles.VETERINARIO.value),
    _normalize_role(Roles.OPERADOR.value),
})


@controles_bp.route('/controles', methods=['GET'])
def list_controles():
    animal_id = request.args.get('animalId', type=int)
    if not animal_id:
        return jsonify(error=True, message='animalId requerido'), 400
    controles = current_app.config['container']['repos'].get('controles')
    if controles is None:
        return jsonify(error=True, message='Repositorio de controles no disponible'), 500
    data = [c.to_dict() for c in controles.list_for_animal(animal_id)]
    return jsonify(controles=data)


@controles_bp.route('/controles', methods=['POST'])
def add_control():
    if False:
        return jsonify(error=True, message='Permisos insuficientes'), 403

    repos = current_app.config['container']['repos']
    animales = repos['animales']
    controles = repos.get('controles')
    if controles is None:
        return jsonify(error=True, message='Repositorio de controles no disponible'), 500
    auditoria = repos['animal_auditoria']
    usuarios_repo = repos.get('usuarios')

    body = request.get_json(silent=True) or {}
    animal_id = int(body.get('AnimalId') or 0)
    veterinario_id = session.get('user_id')
    user_tipo = _normalize_role(session.get('user_tipo'))

    header_id = None
    if not veterinario_id:
        header_id = request.headers.get('X-User-Id')
        header_tipo = _normalize_role(request.headers.get('X-User-Type'))
        if header_id and header_tipo in ALLOWED_CONTROL_ROLES:
            try:
                veterinario_id = int(header_id)
            except (TypeError, ValueError):
                veterinario_id = 0
            user_tipo = header_tipo
    registrado_por_id = session.get('user_id') or veterinario_id
    if not veterinario_id:
        return jsonify(error=True, message='Debes iniciar sesión como veterinario u operador'), 401
    if user_tipo not in ALLOWED_CONTROL_ROLES:
        return jsonify(error=True, message='Permisos insuficientes'), 403
    if usuarios_repo:
        usuario = usuarios_repo.get(veterinario_id)
        if not usuario:
            return jsonify(error=True, message='Veterinario no encontrado'), 403
        if _normalize_role(usuario.Tipo) not in ALLOWED_CONTROL_ROLES:
            return jsonify(error=True, message='Veterinario no encontrado'), 403
    fecha = body.get('Fecha')
    diagnostico = (body.get('Diagnostico') or '').strip()
    vacunas = body.get('Vacunas') or ''
    tratamiento = body.get('Tratamiento') or ''
    observaciones = body.get('Observaciones') or ''
    adjuntos = body.get('Adjuntos') or ''
    resultado = (body.get('Resultado') or '').strip()  # Apto | Requiere tratamiento | No apto
    proxima = body.get('ProximaCita')

    # Validaciones CU3
    a = animales.get(animal_id)
    if not a:
        return jsonify(error=True, message='Animal no encontrado'), 404
    if a.EstadoSalud not in ('Pendiente de Control', AnimalSalud.EN_TRATAMIENTO.value, 'Apto para adopción', 'No apto para adopción'):
        pass  # permitir estados conocidos, precondición informativa
    if not diagnostico:
        return jsonify(error=True, message='Debe registrar diagnóstico'), 400

    def parse_date(s):
        return date.fromisoformat(s) if s else None

    now = datetime.utcnow()
    c = ControlSanitario(
        Id=0,
        AnimalId=animal_id,
        VeterinarioId=veterinario_id,
        RegistradoPorId=registrado_por_id,
        Fecha=parse_date(fecha),
        Diagnostico=diagnostico,
        Vacunas=vacunas,
        Tratamiento=tratamiento,
        Observaciones=observaciones,
        Adjuntos=adjuntos,
        Resultado=resultado,
        ProximaCita=parse_date(proxima),
        CreadoEn=now,
    )
    try:
        c = controles.add(c)
    except sqlite3.IntegrityError as err:
        current_app.logger.warning('Error de integridad al agregar control: %s', err)
        return jsonify(error=True, message='No se pudo registrar el control por datos inválidos'), 409

    # Procesar resultado
    if resultado == 'Apto':
        a.EstadoSalud = 'Apto para adopción'
    elif resultado == 'Requiere tratamiento':
        a.EstadoSalud = AnimalSalud.EN_TRATAMIENTO.value
        if c.ProximaCita:
            a.FechaControl = c.ProximaCita
    elif resultado == 'No apto':
        a.EstadoSalud = 'No apto para adopción'
    a.FechaActualizacion = now
    try:
        a.Diagnostico = diagnostico or getattr(a, 'Diagnostico', '')
        a.Tratamiento = tratamiento or getattr(a, 'Tratamiento', '')
        a.Vacunas = vacunas or getattr(a, 'Vacunas', '')
    except Exception:
        pass
    animales.update(a)

    auditoria.add(AnimalAuditoria(Id=0, AnimalId=a.Id, OperadorId=None, Evento='CONTROL_SANITARIO', Detalles=f'Resultado: {resultado}', Fecha=now))

    return jsonify(message='Control sanitario registrado', control=c.to_dict(), animal=a.to_dict())







