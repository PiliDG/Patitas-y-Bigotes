from __future__ import annotations
from typing import Optional
import sqlite3

from datetime import datetime
from dataclasses import replace

from ..domain.solicitud import Solicitud
from ..domain.seguimiento import Seguimiento


class InMemorySolicitudesRepository:
    def __init__(self, adoptantes_repo) -> None:
        self._items: dict[int, Solicitud] = {}
        self._next_id = 1
        self._adoptantes = adoptantes_repo

    def has_open_for_animal(self, animal_id: int) -> bool:
        abiertos = {'Pendiente', 'En revisi??n', 'Aprobada', 'Aprobada de manera provisional'}
        for item in self._items.values():
            if item.AnimalId == animal_id and (item.EstadoSolicitud or '') in abiertos:
                return True
        return False

    def list_for_usuario(self, usuario_id: int):
        adoptante = self._adoptantes.get_by_usuario(usuario_id) if self._adoptantes else None
        if not adoptante:
            return []
        return sorted(
            (s for s in self._items.values() if s.AdoptanteId == adoptante.Id),
            key=lambda s: s.FechaSolicitud or datetime.min,
            reverse=True,
        )

    def add(self, s: Solicitud) -> Solicitud:
        if s.Id == 0:
            s = replace(s, Id=self._next_id)
            self._next_id += 1
        self._items[s.Id] = s
        return s

    def get(self, solicitud_id: int) -> Solicitud | None:
        return self._items.get(solicitud_id)

    def update(self, s: Solicitud) -> None:
        if s.Id in self._items:
            self._items[s.Id] = s

    # NUEVO: listado completo para operadores
    def list_all(self):
        return sorted(
            self._items.values(),
            key=lambda s: s.FechaSolicitud or datetime.min,
            reverse=True,
        )


class InMemorySeguimientosRepository:
    def __init__(self, solicitudes_repo) -> None:
        self._items: dict[int, Seguimiento] = {}
        self._next_id = 1
        self._solicitudes = solicitudes_repo

    def has_open_for_animal(self, animal_id: int) -> bool:
        for seg in self._items.values():
            if (seg.EstadoSeguimiento or '') == 'Cancelado':
                continue
            solicitud = self._solicitudes.get(seg.SolicitudId) if self._solicitudes else None
            if solicitud and solicitud.AnimalId == animal_id:
                return True
        return False

    def add(self, seg: Seguimiento) -> Seguimiento:
        if seg.Id == 0:
            seg = replace(seg, Id=self._next_id)
            self._next_id += 1
        self._items[seg.Id] = seg
        return seg

    def get(self, seg_id: int) -> Seguimiento | None:
        return self._items.get(seg_id)

    def update(self, seg: Seguimiento) -> None:
        if seg.Id in self._items:
            self._items[seg.Id] = seg

    # NUEVO: listado completo para operadores/veterinarios
    def list_all(self):
        return sorted(
            self._items.values(),
            key=lambda s: s.FechaSeguimiento or datetime.min,
            reverse=True,
        )


class SQLiteSolicitudesRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    def has_open_for_animal(self, animal_id: int) -> bool:
        # Estados abiertos seggn CU: Pendiente, En revisi??n, Aprobada (provisional)
        abiertos = ('Pendiente', 'En revisi??n', 'Aprobada', 'Aprobada de manera provisional')
        cur = self._c.execute(
            'SELECT 1 FROM solicitudes WHERE animal_id=? AND estado_solicitud IN (%s) LIMIT 1' % (','.join(['?']*len(abiertos))),
            (animal_id, *abiertos),
        )
        return cur.fetchone() is not None

    def list_for_usuario(self, usuario_id: int):
        cur = self._c.execute('SELECT * FROM solicitudes WHERE adoptante_id IN (SELECT id FROM adoptantes WHERE usuario_id=?) ORDER BY fecha_solicitud DESC', (usuario_id,))
        out = []
        for r in cur.fetchall():
            out.append(Solicitud(
                Id=r['id'], IdSolicitud=r['id_solicitud'], FechaSolicitud=datetime.fromisoformat(r['fecha_solicitud']) if r['fecha_solicitud'] else None,
                MotivoSolicitud=r['motivo_solicitud'] or '', EstadoSolicitud=r['estado_solicitud'] or '', MotivoRechazo=r['motivo_rechazo'] or '', Comentarios=r['comentarios'] or '',
                Adjuntos=r['adjuntos'] or '', AceptaTerminos=bool(r['acepta_terminos']), Auditoria=r['auditoria'] or '', FechaActualizacion=datetime.fromisoformat(r['fecha_actualizacion']) if r['fecha_actualizacion'] else None,
                AnimalId=r['animal_id'], AdoptanteId=r['adoptante_id']
            ))
        return out

    def add(self, s: Solicitud) -> Solicitud:
        cur = self._c.execute(
            '''INSERT INTO solicitudes (
                id_solicitud, fecha_solicitud, motivo_solicitud, estado_solicitud, motivo_rechazo, comentarios, adjuntos, acepta_terminos, auditoria, fecha_actualizacion, animal_id, adoptante_id
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
            (s.IdSolicitud, (s.FechaSolicitud or datetime.utcnow()).isoformat(), s.MotivoSolicitud, s.EstadoSolicitud, s.MotivoRechazo, s.Comentarios, s.Adjuntos, 1 if s.AceptaTerminos else 0, s.Auditoria, (s.FechaActualizacion or datetime.utcnow()).isoformat(), s.AnimalId, s.AdoptanteId),
        )
        self._c.commit()
        return replace(s, Id=cur.lastrowid)

    def get(self, solicitud_id: int) -> Solicitud | None:
        cur = self._c.execute('SELECT * FROM solicitudes WHERE id=?', (solicitud_id,))
        r = cur.fetchone()
        if not r:
            return None
        return Solicitud(
            Id=r['id'], IdSolicitud=r['id_solicitud'], FechaSolicitud=datetime.fromisoformat(r['fecha_solicitud']) if r['fecha_solicitud'] else None,
            MotivoSolicitud=r['motivo_solicitud'] or '', EstadoSolicitud=r['estado_solicitud'] or '', MotivoRechazo=r['motivo_rechazo'] or '', Comentarios=r['comentarios'] or '',
            Adjuntos=r['adjuntos'] or '', AceptaTerminos=bool(r['acepta_terminos']), Auditoria=r['auditoria'] or '', FechaActualizacion=datetime.fromisoformat(r['fecha_actualizacion']) if r['fecha_actualizacion'] else None,
            AnimalId=r['animal_id'], AdoptanteId=r['adoptante_id']
        )

    def update(self, s: Solicitud) -> None:
        self._c.execute(
            '''UPDATE solicitudes SET id_solicitud=?, fecha_solicitud=?, motivo_solicitud=?, estado_solicitud=?, motivo_rechazo=?, comentarios=?, adjuntos=?, acepta_terminos=?, auditoria=?, fecha_actualizacion=?, animal_id=?, adoptante_id=? WHERE id=?''',
            (s.IdSolicitud, (s.FechaSolicitud or datetime.utcnow()).isoformat(), s.MotivoSolicitud, s.EstadoSolicitud, s.MotivoRechazo, s.Comentarios, s.Adjuntos, 1 if s.AceptaTerminos else 0, s.Auditoria, (s.FechaActualizacion or datetime.utcnow()).isoformat(), s.AnimalId, s.AdoptanteId, s.Id),
        )
        self._c.commit()

    # NUEVO: listado completo para operadores
    def list_all(self):
        cur = self._c.execute('SELECT * FROM solicitudes ORDER BY fecha_solicitud DESC')
        out = []
        for r in cur.fetchall():
            out.append(Solicitud(
                Id=r['id'], IdSolicitud=r['id_solicitud'], FechaSolicitud=datetime.fromisoformat(r['fecha_solicitud']) if r['fecha_solicitud'] else None,
                MotivoSolicitud=r['motivo_solicitud'] or '', EstadoSolicitud=r['estado_solicitud'] or '', MotivoRechazo=r['motivo_rechazo'] or '', Comentarios=r['comentarios'] or '',
                Adjuntos=r['adjuntos'] or '', AceptaTerminos=bool(r['acepta_terminos']), Auditoria=r['auditoria'] or '', FechaActualizacion=datetime.fromisoformat(r['fecha_actualizacion']) if r['fecha_actualizacion'] else None,
                AnimalId=r['animal_id'], AdoptanteId=r['adoptante_id']
            ))
        return out


class SQLiteSeguimientosRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    def has_open_for_animal(self, animal_id: int) -> bool:
        # Si hay seguimientos asociados a solicitudes del animal que no est?n cancelados
        cur = self._c.execute(
            '''SELECT 1
               FROM seguimientos s
               JOIN solicitudes so ON so.id = s.solicitud_id
               WHERE so.animal_id=? AND COALESCE(s.estado_seguimiento,'') <> 'Cancelado'
               LIMIT 1''',
            (animal_id,),
        )
        return cur.fetchone() is not None

    def add(self, seg):
        cur = self._c.execute(
            'INSERT INTO seguimientos (id_seguimiento, fecha_seguimiento, estado_seguimiento, tipo_seguimiento, observaciones, comportamiento, adjuntos, firma, solicitud_id) VALUES (?,?,?,?,?,?,?,?,?)',
            (seg.IdSeguimiento, seg.FechaSeguimiento.isoformat() if seg.FechaSeguimiento else None, seg.EstadoSeguimiento, getattr(seg, 'TipoSeguimiento', '') or '', seg.Observaciones, seg.Comportamiento, seg.Adjuntos, seg.Firma, seg.SolicitudId),
        )
        self._c.commit()
        seg.Id = cur.lastrowid
        return seg

    def get(self, seg_id: int):
        cur = self._c.execute('SELECT * FROM seguimientos WHERE id=?', (seg_id,))
        r = cur.fetchone()
        if not r:
            return None
        return Seguimiento(
            Id=r['id'], IdSeguimiento=r['id_seguimiento'] or '', FechaSeguimiento=datetime.fromisoformat(r['fecha_seguimiento']) if r['fecha_seguimiento'] else None,
            EstadoSeguimiento=r['estado_seguimiento'] or '', TipoSeguimiento=r['tipo_seguimiento'] or '', Observaciones=r['observaciones'] or '', Comportamiento=r['comportamiento'] or '', Adjuntos=r['adjuntos'] or '', Firma=r['firma'] or '', SolicitudId=r['solicitud_id']
        )

    def update(self, seg):
        self._c.execute(
            'UPDATE seguimientos SET id_seguimiento=?, fecha_seguimiento=?, estado_seguimiento=?, tipo_seguimiento=?, observaciones=?, comportamiento=?, adjuntos=?, firma=?, solicitud_id=? WHERE id=?',
            (seg.IdSeguimiento, seg.FechaSeguimiento.isoformat() if seg.FechaSeguimiento else None, seg.EstadoSeguimiento, getattr(seg, 'TipoSeguimiento', '') or '', seg.Observaciones, seg.Comportamiento, seg.Adjuntos, seg.Firma, seg.SolicitudId, seg.Id),
        )
        self._c.commit()

    # NUEVO: listado completo para operadores/veterinarios
    def list_all(self):
        cur = self._c.execute('SELECT * FROM seguimientos ORDER BY fecha_seguimiento DESC')
        out = []
        for r in cur.fetchall():
            out.append(Seguimiento(
                Id=r['id'], IdSeguimiento=r['id_seguimiento'] or '', FechaSeguimiento=datetime.fromisoformat(r['fecha_seguimiento']) if r['fecha_seguimiento'] else None,
                EstadoSeguimiento=r['estado_seguimiento'] or '', TipoSeguimiento=r['tipo_seguimiento'] or '', Observaciones=r['observaciones'] or '', Comportamiento=r['comportamiento'] or '', Adjuntos=r['adjuntos'] or '', Firma=r['firma'] or '', SolicitudId=r['solicitud_id']
            ))
        return out

