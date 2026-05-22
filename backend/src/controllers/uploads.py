from __future__ import annotations
import os
from datetime import datetime
from pathlib import Path
from flask import Blueprint, current_app, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename
from .decorators import require_role
from ..domain.constants import Roles


uploads_bp = Blueprint('uploads', __name__)


def _media_root() -> str:
    # Base absoluta para archivos subidos; configurable por env
    root = current_app.config.get('MEDIA_ROOT') or os.environ.get('MEDIA_ROOT') or 'media'
    Path(root).mkdir(parents=True, exist_ok=True)
    return root


def _allowed_image(filename: str) -> bool:
    name = (filename or '').lower()
    return any(name.endswith(ext) for ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'))


@uploads_bp.route('/media/animals/<int:animal_id>/<path:filename>', methods=['GET'])
def serve_animal_file(animal_id: int, filename: str):
    # Sirve archivos subidos de un animal en particular
    root = os.path.join(_media_root(), 'animals', str(animal_id))
    if not os.path.isdir(root):
        return jsonify(error=True, message='Archivo no encontrado'), 404
    try:
        return send_from_directory(root, filename, as_attachment=False, max_age=3600)
    except Exception:
        return jsonify(error=True, message='Archivo no encontrado'), 404


@uploads_bp.route('/animales/<int:animal_id>/fotos', methods=['POST'])
def upload_animal_photo(animal_id: int):
    # Carga una imagen para el animal indicado. Guarda en media/animals/<animal_id>/
    if 'file' not in request.files:
        return jsonify(error=True, message='Falta archivo (campo file)'), 400
    file = request.files['file']
    if not file or not getattr(file, 'filename', ''):
        return jsonify(error=True, message='Archivo inválido'), 400
    if not _allowed_image(file.filename):
        return jsonify(error=True, message='Formato no permitido'), 400

    # Crear carpeta por animal para evitar colisiones y facilitar limpieza
    base = os.path.join(_media_root(), 'animals', str(animal_id))
    Path(base).mkdir(parents=True, exist_ok=True)

    # Nombre único: fecha + original saneado
    original = secure_filename(file.filename)
    ts = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    name = f"{ts}_{original}" if original else f"{ts}.jpg"
    dest = os.path.join(base, name)
    file.save(dest)

    # URL pública relativa servida por el mismo backend
    url = f"/api/media/animals/{animal_id}/{name}"
    return jsonify(ok=True, url=url, path=dest)


@uploads_bp.route('/media/animals/sync', methods=['POST'])
@require_role([Roles.OPERADOR.value, Roles.ADMIN.value])
def ensure_dirs_for_all_animals():
    """Crea (si no existen) las carpetas media/animals/<Id> para cada animal.
    Útil para preparar el almacenamiento inicial (ej.: 36 animales seed)."""
    try:
        repos = current_app.config.get('container', {}).get('repos', {})
        animals_repo = repos.get('animales')
        if not animals_repo or not hasattr(animals_repo, 'list'):
            return jsonify(error=True, message='Repositorio de animales no disponible'), 500
        items = animals_repo.list() or []
        base_root = os.path.join(_media_root(), 'animals')
        created = 0
        ensured = 0
        for a in items:
            try:
                aid = int(getattr(a, 'Id', 0) or 0)
                if not aid:
                    continue
                target = os.path.join(base_root, str(aid))
                if not os.path.isdir(target):
                    Path(target).mkdir(parents=True, exist_ok=True)
                    created += 1
                else:
                    ensured += 1
            except Exception:
                # no romper por un id inválido
                continue
        return jsonify(ok=True, created=created, existing=ensured, total=len(items), root=base_root)
    except Exception as exc:
        return jsonify(error=True, message=str(exc)), 500
