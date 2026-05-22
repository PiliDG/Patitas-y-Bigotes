from __future__ import annotations
from dataclasses import replace
from datetime import datetime
from typing import List
import sqlite3

from ..domain.visita import Visita


class InMemoryVisitasRepository:
    def __init__(self, solicitudes_repo) -> None:
        self._items: dict[int, Visita] = {}
        self._next_id = 1
        self._solicitudes = solicitudes_repo
        self._ordered_ids: list[int] = []

    def add(self, v: Visita) -> Visita:
        if v.Id == 0:
            v = replace(v, Id=self._next_id)
            self._next_id += 1
        self._items[v.Id] = v
        self._ordered_ids.append(v.Id)
        self._ordered_ids.sort(key=lambda vid: self._items[vid].FechaHoraVisita or datetime.min, reverse=True)
        return v

    def get(self, visita_id: int) -> Visita | None:
        return self._items.get(visita_id)

    def update(self, v: Visita) -> None:
        if v.Id in self._items:
            self._items[v.Id] = v
            if v.Id not in self._ordered_ids:
                self._ordered_ids.append(v.Id)
            self._ordered_ids.sort(key=lambda vid: self._items[vid].FechaHoraVisita or datetime.min, reverse=True)

    def list_all(self) -> List[Visita]:
        if not self._ordered_ids:
            self._ordered_ids = sorted(
                self._items.keys(),
                key=lambda vid: self._items[vid].FechaHoraVisita or datetime.min,
                reverse=True,
            )
        return [self._items[vid] for vid in self._ordered_ids]

    def has_conflict(self, animal_id: int, when_iso: str) -> bool:
        for visita in self._items.values():
            if (visita.EstadoSolicitud or '') != 'Programada':
                continue
            solicitud = self._solicitudes.get(visita.SolicitudId) if self._solicitudes else None
            if solicitud and solicitud.AnimalId == animal_id:
                stored = visita.FechaHoraVisita.isoformat() if visita.FechaHoraVisita else None
                if stored == when_iso:
                    return True
        return False


class SQLiteVisitasRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    def _row_to_visita(self, r: sqlite3.Row) -> Visita:
        return Visita(
            Id=r['id'], IdVisita=r['id_visita'] or '', FechaHoraVisita=datetime.fromisoformat(r['fecha_hora_visita']) if r['fecha_hora_visita'] else None,
            EstadoSolicitud=r['estado_solicitud'] or 'Programada', MotivoRechazo=r['motivo_rechazo'] or '', SolicitudId=r['solicitud_id'],
            Responsable=r['responsable'] or '', Direccion=r['direccion'] or '', Motivo=r['motivo'] or '', Modalidad=r['modalidad'] or '',
        )

    def add(self, v: Visita) -> Visita:
        cur = self._c.execute(
            '''INSERT INTO visitas (id_visita, fecha_hora_visita, estado_solicitud, motivo_rechazo, solicitud_id, responsable, direccion, motivo, modalidad)
               VALUES (?,?,?,?,?,?,?,?,?)''',
            (
                v.IdVisita,
                v.FechaHoraVisita.isoformat() if v.FechaHoraVisita else None,
                v.EstadoSolicitud,
                v.MotivoRechazo,
                v.SolicitudId,
                v.Responsable,
                v.Direccion,
                v.Motivo,
                v.Modalidad,
            ),
        )
        self._c.commit()
        return replace(v, Id=cur.lastrowid)

    def get(self, visita_id: int) -> Visita | None:
        cur = self._c.execute('SELECT * FROM visitas WHERE id=?', (visita_id,))
        r = cur.fetchone()
        return self._row_to_visita(r) if r else None

    def update(self, v: Visita) -> None:
        self._c.execute(
            '''UPDATE visitas
               SET id_visita=?, fecha_hora_visita=?, estado_solicitud=?, motivo_rechazo=?, solicitud_id=?, responsable=?, direccion=?, motivo=?, modalidad=?
               WHERE id=?''',
            (
                v.IdVisita,
                v.FechaHoraVisita.isoformat() if v.FechaHoraVisita else None,
                v.EstadoSolicitud,
                v.MotivoRechazo,
                v.SolicitudId,
                v.Responsable,
                v.Direccion,
                v.Motivo,
                v.Modalidad,
                v.Id,
            ),
        )
        self._c.commit()

    def list_all(self) -> List[Visita]:
        cur = self._c.execute('SELECT * FROM visitas ORDER BY fecha_hora_visita DESC, id DESC')
        return [self._row_to_visita(r) for r in cur.fetchall()]

    def has_conflict(self, animal_id: int, when_iso: str) -> bool:
        # conficto si ya hay visita programada para el mismo animal en la misma fecha/hora
        cur = self._c.execute(
            '''SELECT 1 FROM visitas v JOIN solicitudes s ON s.id = v.solicitud_id
               WHERE s.animal_id=? AND v.fecha_hora_visita=? AND v.estado_solicitud='Programada' LIMIT 1''',
            (animal_id, when_iso),
        )
        return cur.fetchone() is not None
