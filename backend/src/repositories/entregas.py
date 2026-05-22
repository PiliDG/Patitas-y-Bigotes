from __future__ import annotations
from datetime import datetime
from typing import List, Dict
import sqlite3


class InMemoryEntregasInboxRepository:
    def __init__(self) -> None:
        self._items: List[Dict] = []
        self._next_id = 1

    def add(self, data: Dict) -> Dict:
        item = {
            'id': self._next_id,
            'nombre': data.get('nombre',''),
            'contacto': data.get('contacto',''),
            'ubicacion': data.get('ubicacion',''),
            'descripcion': data.get('descripcion',''),
            'foto': data.get('foto',''),
            'creado_en': (data.get('creado_en') or datetime.utcnow()).isoformat(),
        }
        self._next_id += 1
        self._items.append(item)
        return item

    def list_all(self) -> List[Dict]:
        return list(self._items)

    def get(self, id_: int) -> Dict | None:
        return next((x for x in self._items if x['id'] == id_), None)

    def delete(self, id_: int) -> bool:
        before = len(self._items)
        self._items = [x for x in self._items if x['id'] != id_]
        return len(self._items) < before


class SQLiteEntregasInboxRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    def add(self, data: Dict) -> Dict:
        now = (data.get('creado_en') or datetime.utcnow()).isoformat()
        cur = self._c.execute(
            'INSERT INTO entregas_inbox (nombre, contacto, ubicacion, descripcion, foto, creado_en) VALUES (?,?,?,?,?,?)',
            (data.get('nombre',''), data.get('contacto',''), data.get('ubicacion',''), data.get('descripcion',''), data.get('foto',''), now),
        )
        self._c.commit()
        return {
            'id': cur.lastrowid,
            'nombre': data.get('nombre',''),
            'contacto': data.get('contacto',''),
            'ubicacion': data.get('ubicacion',''),
            'descripcion': data.get('descripcion',''),
            'foto': data.get('foto',''),
            'creado_en': now,
        }

    def list_all(self) -> List[Dict]:
        cur = self._c.execute('SELECT * FROM entregas_inbox ORDER BY id DESC')
        return [dict(r) for r in cur.fetchall()]

    def get(self, id_: int) -> Dict | None:
        cur = self._c.execute('SELECT * FROM entregas_inbox WHERE id=?', (id_,))
        r = cur.fetchone()
        return dict(r) if r else None

    def delete(self, id_: int) -> bool:
        cur = self._c.execute('DELETE FROM entregas_inbox WHERE id=?', (id_,))
        self._c.commit()
        return cur.rowcount > 0
