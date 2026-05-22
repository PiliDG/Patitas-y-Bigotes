from __future__ import annotations
from dataclasses import replace
from datetime import datetime
from typing import List, Optional
import sqlite3

from ..domain.usuario import Usuario


class InMemoryUsuarioRepository:
    def __init__(self) -> None:
        self._items: dict[int, Usuario] = {}
        self._next_id = 1

    def list(self) -> List[Usuario]:
        return list(self._items.values())

    def get(self, id_: int) -> Optional[Usuario]:
        return self._items.get(id_)

    def add(self, u: Usuario) -> Usuario:
        if u.Id == 0:
            u = replace(u, Id=self._next_id)
            self._next_id += 1
        self._items[u.Id] = u
        return u

    def update(self, u: Usuario) -> None:
        if u.Id in self._items:
            self._items[u.Id] = u

    def get_by_email(self, email: str) -> Optional[Usuario]:
        for u in self._items.values():
            if (u.Email or '').lower() == (email or '').lower():
                return u
        return None


class SQLiteUsuarioRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    @staticmethod
    def _row_to_usuario(row: sqlite3.Row) -> Usuario:
        return Usuario(
            Id=row['id'],
            Nombre=row['nombre'],
            Email=row['email'],
            ContrasenaHash=row['contrasena_hash'],
            Tipo=row['tipo'],
            EstaActivo=bool(row['esta_activo']),
            FechaRegistro=datetime.fromisoformat(row['fecha_registro']) if row['fecha_registro'] else datetime.utcnow(),
        )

    def list(self) -> List[Usuario]:
        cur = self._c.execute('SELECT * FROM usuarios ORDER BY id ASC')
        return [self._row_to_usuario(r) for r in cur.fetchall()]

    def get(self, id_: int) -> Optional[Usuario]:
        cur = self._c.execute('SELECT * FROM usuarios WHERE id=?', (id_,))
        row = cur.fetchone()
        return self._row_to_usuario(row) if row else None

    def get_by_email(self, email: str) -> Optional[Usuario]:
        # Case-insensitive email lookup for better compatibility
        try:
            cur = self._c.execute('SELECT * FROM usuarios WHERE lower(email) = lower(?)', (email,))
        except Exception:
            cur = self._c.execute('SELECT * FROM usuarios WHERE email=?', (email,))
        row = cur.fetchone()
        return self._row_to_usuario(row) if row else None

    def add(self, u: Usuario) -> Usuario:
        cur = self._c.execute(
            'INSERT INTO usuarios (nombre, email, contrasena_hash, tipo, esta_activo, fecha_registro) VALUES (?, ?, ?, ?, ?, ?)',
            (
                u.Nombre,
                u.Email,
                u.ContrasenaHash,
                u.Tipo,
                1 if u.EstaActivo else 0,
                (u.FechaRegistro or datetime.utcnow()).isoformat(),
            ),
        )
        u = replace(u, Id=cur.lastrowid)
        self._c.commit()
        return u

    def update(self, u: Usuario) -> None:
        self._c.execute(
            'UPDATE usuarios SET nombre=?, email=?, contrasena_hash=?, tipo=?, esta_activo=?, fecha_registro=? WHERE id=?',
            (
                u.Nombre,
                u.Email,
                u.ContrasenaHash,
                u.Tipo,
                1 if u.EstaActivo else 0,
                (u.FechaRegistro or datetime.utcnow()).isoformat(),
                u.Id,
            ),
        )
        self._c.commit()
