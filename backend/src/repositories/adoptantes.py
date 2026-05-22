from __future__ import annotations
from dataclasses import replace
from typing import Optional
import sqlite3

from ..domain.adoptante import Adoptante


class InMemoryAdoptantesRepository:
    def __init__(self) -> None:
        self._items: dict[int, Adoptante] = {}
        self._next_id = 1

    def get(self, adoptante_id: int) -> Optional[Adoptante]:
        return self._items.get(adoptante_id)

    def get_by_usuario(self, usuario_id: int) -> Optional[Adoptante]:
        for item in self._items.values():
            if item.UsuarioId == usuario_id:
                return item
        return None

    def add(self, a: Adoptante) -> Adoptante:
        if a.Id == 0:
            a = replace(a, Id=self._next_id)
            self._next_id += 1
        self._items[a.Id] = a
        return a

    def update(self, a: Adoptante) -> None:
        if a.Id in self._items:
            self._items[a.Id] = a


class SQLiteAdoptantesRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    @staticmethod
    def _row_to_adoptante(r: sqlite3.Row) -> Adoptante:
        return Adoptante(
            Id=r['id'], UsuarioId=r['usuario_id'], Edad=r['edad'] or 0, Direccion=r['direccion'] or '',
            Convivientes=r['convivientes'] or '', Experiencia=r['experiencia'] or '', NumeroTelefono=r['numero_telefono'] or '', Adjuntos=r['adjuntos'] or ''
        )

    def get(self, adoptante_id: int) -> Optional[Adoptante]:
        cur = self._c.execute('SELECT * FROM adoptantes WHERE id=?', (adoptante_id,))
        r = cur.fetchone()
        return self._row_to_adoptante(r) if r else None

    def get_by_usuario(self, usuario_id: int) -> Optional[Adoptante]:
        cur = self._c.execute('SELECT * FROM adoptantes WHERE usuario_id=?', (usuario_id,))
        r = cur.fetchone()
        return self._row_to_adoptante(r) if r else None

    def add(self, a: Adoptante) -> Adoptante:
        cur = self._c.execute(
            'INSERT INTO adoptantes (usuario_id, edad, direccion, convivientes, experiencia, numero_telefono, adjuntos) VALUES (?,?,?,?,?,?,?)',
            (a.UsuarioId, a.Edad, a.Direccion, a.Convivientes, a.Experiencia, a.NumeroTelefono, a.Adjuntos),
        )
        self._c.commit()
        return replace(a, Id=cur.lastrowid)

    def update(self, a: Adoptante) -> None:
        self._c.execute(
            'UPDATE adoptantes SET edad=?, direccion=?, convivientes=?, experiencia=?, numero_telefono=?, adjuntos=? WHERE id=?',
            (a.Edad, a.Direccion, a.Convivientes, a.Experiencia, a.NumeroTelefono, a.Adjuntos, a.Id),
        )
        self._c.commit()
