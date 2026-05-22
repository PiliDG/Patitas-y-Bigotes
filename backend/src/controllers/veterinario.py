from __future__ import annotations
from datetime import datetime, date
from flask import Blueprint, current_app, jsonify

from .decorators import require_role
from ..domain.constants import Roles


veterinario_bp = Blueprint('veterinario', __name__)


def _to_iso(d: date | datetime | None) -> str | None:
    if not d:
        return None
    try:
        if isinstance(d, datetime):
            return d.isoformat()
        return d.isoformat()
    except Exception:
        return None


@veterinario_bp.route('/veterinario/resumen', methods=['GET'])
@require_role([Roles.VETERINARIO.value, Roles.OPERADOR.value])
def resumen_reciente_veterinario():
    repos = current_app.config['container']['repos']
    animales_repo = repos.get('animales')
    controles_repo = repos.get('controles')
    solicitudes_repo = repos.get('solicitudes')
    seguimientos_repo = repos.get('seguimientos')
    usuarios_repo = repos.get('usuarios')
    if not animales_repo or not controles_repo or not solicitudes_repo or not seguimientos_repo:
        return jsonify(error=True, message='Repositorios requeridos no disponibles'), 500

    # Animales con controles sanitarios recientes (ultimos 5)
    animales = []
    try:
        for a in getattr(animales_repo, 'list')() or []:
            ctrls = controles_repo.list_for_animal(a.Id) if hasattr(controles_repo, 'list_for_animal') else []
            if not ctrls:
                continue
            c = ctrls[0]
            estado_salud = (a.EstadoSalud or '').strip()
            estado_map = estado_salud
            if not estado_map:
                estado_map = 'Disponible'
            elif 'tratamiento' in estado_salud.lower():
                estado_map = 'En tratamiento'
            elif 'apto' in estado_salud.lower():
                estado_map = 'Alta médica'
            animales.append({
                'id': a.Id,
                'nombre': a.Nombre or '',
                'especie': a.EspecieRaza or '',
                'estado': estado_map,
                'fecha': _to_iso(c.Fecha or c.CreadoEn),
                'animalId': a.Id,
            })
        animales.sort(key=lambda x: (x.get('fecha') or ''), reverse=True)
        animales = animales[:5]
    except Exception:
        animales = []

    # Solicitudes con revision veterinaria o pendientes (ultimas 5)
    solicitudes = []
    try:
        so_list = getattr(solicitudes_repo, 'list_all')() if hasattr(solicitudes_repo, 'list_all') else []
        for s in so_list:
            estado = (s.EstadoSolicitud or '')
            el = estado.lower()
            if ('pendiente' in el) or ('revisi' in el):
                adoptante_nombre = ''
                animal_nombre = ''
                try:
                    adoptantes = repos.get('adoptantes')
                    adoptante = adoptantes.get(s.AdoptanteId) if adoptantes and hasattr(adoptantes, 'get') else None
                    usuario = usuarios_repo.get(adoptante.UsuarioId) if adoptante and usuarios_repo and hasattr(usuarios_repo, 'get') else None
                    a = animales_repo.get(s.AnimalId) if hasattr(animales_repo, 'get') else None
                    adoptante_nombre = getattr(usuario, 'Nombre', '') or ''
                    animal_nombre = getattr(a, 'Nombre', '') or ''
                except Exception:
                    pass
                solicitudes.append({
                    'id': s.Id,
                    'animalId': s.AnimalId,
                    'adoptante': adoptante_nombre,
                    'animal': animal_nombre,
                    'estado': s.EstadoSolicitud or 'Pendiente',
                    'fecha': _to_iso(s.FechaSolicitud or s.FechaActualizacion),
                })
        solicitudes.sort(key=lambda x: (x.get('fecha') or ''), reverse=True)
        solicitudes = solicitudes[:5]
    except Exception:
        solicitudes = []

    followups_summary = []
    try:
        seg_list = getattr(seguimientos_repo, 'list_all')() if hasattr(seguimientos_repo, 'list_all') else []
        for seg in seg_list:
            solicitud = solicitudes_repo.get(seg.SolicitudId) if hasattr(solicitudes_repo, 'get') else None
            animal = animales_repo.get(solicitud.AnimalId) if solicitud and hasattr(animales_repo, 'get') else None
            estado = (seg.EstadoSeguimiento or '')
            estado_norm = 'Activo' if estado == 'Activo' else ('Cerrado' if estado in ('Finalizado', 'Cancelado') else (estado or 'Activo'))
            tipo = (seg.TipoSeguimiento or '').strip().lower()
            if tipo and tipo != 'veterinario':
                continue
            proxima = None
            try:
                if animal and hasattr(controles_repo, 'list_for_animal'):
                    ctrl_list = controles_repo.list_for_animal(animal.Id)
                    if ctrl_list:
                        proxima = _to_iso(ctrl_list[0].ProximaCita)
            except Exception:
                pass
            followups_summary.append({
                'id': seg.Id,
                'animalId': getattr(animal, 'Id', None),
                'animal': getattr(animal, 'Nombre', '') or '',
                'estado': estado_norm,
                'fecha': _to_iso(seg.FechaSeguimiento),
                'proximaCita': proxima,
                'source': 'seguimiento',
                'tipo': getattr(seg, 'TipoSeguimiento', '') or '',
            })
    except Exception:
        followups_summary = []

    control_summary = []
    try:
        recent_ctrls = controles_repo.list_recent(5) if hasattr(controles_repo, 'list_recent') else []
        for ctrl in recent_ctrls:
            animal = animales_repo.get(ctrl.AnimalId) if hasattr(animales_repo, 'get') else None
            control_summary.append({
                'id': ctrl.Id,
                'animalId': ctrl.AnimalId,
                'animal': getattr(animal, 'Nombre', '') or '',
                'estado': ctrl.Resultado or 'Control sanitario',
                'fecha': _to_iso(ctrl.CreadoEn) or _to_iso(ctrl.Fecha),
                'proximaCita': _to_iso(ctrl.ProximaCita),
                'source': 'control',
                'tipo': 'Control sanitario',
            })
    except Exception:
        control_summary = []

    all_seguimientos = followups_summary + control_summary
    try:
        all_seguimientos.sort(key=lambda x: (x.get('fecha') or ''), reverse=True)
    except Exception:
        pass
    seguimientos = all_seguimientos[:5]

    return jsonify({
        'animales': animales,
        'solicitudes': solicitudes,
        'seguimientos': seguimientos,
        'actualizadoEn': datetime.utcnow().isoformat(),
    })

