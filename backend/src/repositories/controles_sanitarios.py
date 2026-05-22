from __future__ import annotations
from dataclasses import replace
from datetime import date, datetime
from typing import List
import sqlite3

from ..domain.control_sanitario import ControlSanitario


class InMemoryControlSanitarioRepository:
    def __init__(self) -> None:
        self._items: dict[int, ControlSanitario] = {}
        self._next_id = 1

    def list_for_animal(self, animal_id: int) -> List[ControlSanitario]:
        return sorted(
            (c for c in self._items.values() if c.AnimalId == animal_id),
            key=lambda c: c.CreadoEn or datetime.min,
            reverse=True,
        )

    def list_recent(self, limit: int = 5) -> List[ControlSanitario]:
        items = sorted(
            self._items.values(),
            key=lambda c: c.CreadoEn or datetime.min,
            reverse=True,
        )
        return items[:limit]

    def add(self, c: ControlSanitario) -> ControlSanitario:
        if c.Id == 0:
            c = replace(c, Id=self._next_id)
            self._next_id += 1
        self._items[c.Id] = c
        return c


class SQLiteControlSanitarioRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    @staticmethod
    def _row_to_ctrl(r: sqlite3.Row) -> ControlSanitario:
        def to_date(s):
            return date.fromisoformat(s) if s else None
        def to_dt(s):
            return datetime.fromisoformat(s) if s else None
        return ControlSanitario(
            Id=r['id'],
            AnimalId=r['animal_id'],
            VeterinarioId=r['veterinario_id'],
            RegistradoPorId=r['registrado_por_id'],
            Fecha=to_date(r['fecha']),
            Diagnostico=r['diagnostico'],
            Vacunas=r['vacunas'],
            Tratamiento=r['tratamiento'],
            Observaciones=r['observaciones'],
            Adjuntos=r['adjuntos'],
            Resultado=r['resultado'],
            ProximaCita=to_date(r['proxima_cita']),
            CreadoEn=to_dt(r['creado_en']) or datetime.utcnow(),
        )

    def list_for_animal(self, animal_id: int) -> List[ControlSanitario]:
        cur = self._c.execute('SELECT * FROM controles_sanitarios WHERE animal_id=? ORDER BY creado_en DESC', (animal_id,))
        return [self._row_to_ctrl(r) for r in cur.fetchall()]

    def list_recent(self, limit: int = 5) -> List[ControlSanitario]:
        cur = self._c.execute(
            'SELECT * FROM controles_sanitarios ORDER BY creado_en DESC LIMIT ?',
            (limit,),
        )
        return [self._row_to_ctrl(r) for r in cur.fetchall()]

    def add(self, c: ControlSanitario) -> ControlSanitario:
        cur = self._c.execute(
            '''INSERT INTO controles_sanitarios (
                animal_id, veterinario_id, registrado_por_id, fecha, diagnostico, vacunas, tratamiento, observaciones, adjuntos, resultado, proxima_cita, creado_en
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
            (
                c.AnimalId, c.VeterinarioId, c.RegistradoPorId,
                c.Fecha.isoformat() if c.Fecha else None,
                c.Diagnostico, c.Vacunas, c.Tratamiento, c.Observaciones, c.Adjuntos,
                c.Resultado, c.ProximaCita.isoformat() if c.ProximaCita else None,
                (c.CreadoEn or datetime.utcnow()).isoformat(),
            ),
        )
        self._c.commit()
        return replace(c, Id=cur.lastrowid)

