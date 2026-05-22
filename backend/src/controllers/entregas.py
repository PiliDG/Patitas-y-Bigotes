from __future__ import annotations
from datetime import datetime
from flask import Blueprint, current_app, jsonify, request, session
from .decorators import rate_limit


entregas_bp = Blueprint('entregas', __name__)


@rate_limit(limit=5, window_seconds=60)
@entregas_bp.route('/entregas/aviso', methods=['POST'])
def aviso_entrega():
    body = request.get_json(silent=True) or {}
    nombre = (body.get('nombre') or '').strip()
    contacto = (body.get('contacto') or '').strip()
    descripcion = (body.get('descripcion') or '').strip()
    if not nombre:
        return jsonify(error=True, message='Debe ingresar nombre'), 400
    if not contacto:
        return jsonify(error=True, message='Debe ingresar un contacto'), 400
    if not descripcion:
        return jsonify(error=True, message='Debe describir al animal'), 400

    repo = current_app.config['container']['repos']['entregas_inbox']
    item = repo.add({
        'nombre': nombre,
        'contacto': contacto,
        'ubicacion': body.get('ubicacion',''),
        'descripcion': descripcion,
        'foto': body.get('foto',''),
        'creado_en': datetime.utcnow(),
    })
    ticket = f"E-{item['id']:06d}"
    return jsonify(ok=True, message='Aviso de entrega registrado', ticket=ticket, data=item), 201


@entregas_bp.route('/entregas', methods=['GET'])
def listar_entregas():
    # Solo operador puede ver la bandeja
    if session.get('user_tipo') != 'operador':
        return jsonify(error=True, message='Permisos insuficientes'), 403
    repo = current_app.config['container']['repos']['entregas_inbox']
    return jsonify(entregas=repo.list_all())


@entregas_bp.route('/entregas/<int:entrega_id>', methods=['GET'])
def obtener_entrega(entrega_id: int):
    if session.get('user_tipo') != 'operador':
        return jsonify(error=True, message='Permisos insuficientes'), 403
    repo = current_app.config['container']['repos']['entregas_inbox']
    item = repo.get(entrega_id)
    if not item:
        return jsonify(error=True, message='Aviso no encontrado'), 404
    return jsonify(entrega=item)


@entregas_bp.route('/entregas/<int:entrega_id>', methods=['DELETE'])
def eliminar_entrega(entrega_id: int):
    if session.get('user_tipo') != 'operador':
        return jsonify(error=True, message='Permisos insuficientes'), 403
    repo = current_app.config['container']['repos']['entregas_inbox']
    ok = repo.delete(entrega_id)
    if not ok:
        return jsonify(error=True, message='Aviso no encontrado'), 404
    return jsonify(ok=True, message='Aviso archivado')
