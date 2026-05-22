from __future__ import annotations
from dataclasses import replace
from datetime import datetime
from typing import List
import sqlite3

from ..domain.animal_auditoria import AnimalAuditoria


class InMemoryAnimalAuditoriaRepository:
    def __init__(self) -> None:
        self._items: List[AnimalAuditoria] = []
        self._next_id = 1

    def add(self, a: AnimalAuditoria) -> AnimalAuditoria:
        if a.Id == 0:
            a = replace(a, Id=self._next_id)
            self._next_id += 1
        self._items.append(a)
        return a

    def list_for_animal(self, animal_id: int) -> List[AnimalAuditoria]:
        return [x for x in self._items if x.AnimalId == animal_id]


class SQLiteAnimalAuditoriaRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    def add(self, a: AnimalAuditoria) -> AnimalAuditoria:
        cur = self._c.execute(
            'INSERT INTO animales_auditoria (animal_id, operador_id, evento, detalles, fecha) VALUES (?, ?, ?, ?, ?)',
            (a.AnimalId, a.OperadorId, a.Evento, a.Detalles, (a.Fecha or datetime.utcnow()).isoformat()),
        )
        self._c.commit()
        return replace(a, Id=cur.lastrowid)

    def list_for_animal(self, animal_id: int) -> List[AnimalAuditoria]:
        cur = self._c.execute('SELECT * FROM animales_auditoria WHERE animal_id=? ORDER BY fecha DESC', (animal_id,))
        items: List[AnimalAuditoria] = []
        for r in cur.fetchall():
            items.append(
                AnimalAuditoria(
                    Id=r['id'],
                    AnimalId=r['animal_id'],
                    OperadorId=r['operador_id'],
                    Evento=r['evento'],
                    Detalles=r['detalles'],
                    Fecha=datetime.fromisoformat(r['fecha']),
                )
            )
        return items

