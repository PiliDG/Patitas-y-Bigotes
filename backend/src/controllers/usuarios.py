from __future__ import annotations
from datetime import datetime
from flask import Blueprint, current_app, jsonify, request

usuarios_bp = Blueprint('usuarios', __name__)


@usuarios_bp.route('/usuarios', methods=['GET'])
def list_usuarios():
    repo = current_app.config['container']['repos']['usuarios']
    data = [u.to_dict() for u in repo.list()]
    return jsonify(usuarios=data)


@usuarios_bp.route('/usuarios', methods=['POST'])
def add_usuario():
    from ..domain.usuario import Usuario

    repo = current_app.config['container']['repos']['usuarios']
    body = request.get_json(silent=True) or {}
    u = Usuario(
        Id=0,
        Nombre=body.get('Nombre', ''),
        Email=body.get('Email', ''),
        ContrasenaHash=body.get('ContrasenaHash', ''),
        Tipo=body.get('Tipo', 'operador'),
        EstaActivo=bool(body.get('EstaActivo', True)),
        FechaRegistro=datetime.fromisoformat(body['FechaRegistro']) if body.get('FechaRegistro') else datetime.utcnow(),
    )
    u = repo.add(u)
    return jsonify(usuario=u.to_dict()), 201

