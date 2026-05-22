from __future__ import annotations
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Optional
import secrets
import sqlite3

from ..domain.email_verification_token import EmailVerificationToken


class InMemoryTokenRepository:
    def __init__(self) -> None:
        self._items: dict[str, EmailVerificationToken] = {}
        self._next_id = 1

    def create_for_user(self, usuario_id: int, minutes: int = 60) -> EmailVerificationToken:
        # Generar un token numérico de 6 dígitos
        token = f"{secrets.randbelow(1_000_000):06d}"
        # Evitar colisiones poco probables en memoria
        while token in self._items:
            token = f"{secrets.randbelow(1_000_000):06d}"
        evt = EmailVerificationToken(
            Id=0,
            UsuarioId=usuario_id,
            Token=token,
            ExpiraEn=datetime.utcnow() + timedelta(minutes=minutes),
            Usado=False,
        )
        evt = replace(evt, Id=self._next_id)
        self._next_id += 1
        self._items[token] = evt
        return evt

    def get(self, token: str) -> Optional[EmailVerificationToken]:
        return self._items.get(token)

    def mark_used(self, token: str) -> None:
        evt = self._items.get(token)
        if evt:
            self._items[token] = replace(evt, Usado=True)


class SQLiteTokenRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    def create_for_user(self, usuario_id: int, minutes: int = 60) -> EmailVerificationToken:
        # Generar un token numérico de 6 dígitos y asegurar que no exista en DB
        token = f"{secrets.randbelow(1_000_000):06d}"
        # Intentar regenerar si hay colisión (muy improbable)
        for _ in range(5):
            cur = self._c.execute('SELECT 1 FROM email_verification_tokens WHERE token=?', (token,))
            if cur.fetchone() is None:
                break
            token = f"{secrets.randbelow(1_000_000):06d}"
        exp = (datetime.utcnow() + timedelta(minutes=minutes)).isoformat()
        cur = self._c.execute(
            'INSERT INTO email_verification_tokens (usuario_id, token, expira_en, usado) VALUES (?, ?, ?, ?)',
            (usuario_id, token, exp, 0),
        )
        self._c.commit()
        return EmailVerificationToken(Id=cur.lastrowid, UsuarioId=usuario_id, Token=token, ExpiraEn=datetime.fromisoformat(exp), Usado=False)

    def get(self, token: str) -> Optional[EmailVerificationToken]:
        cur = self._c.execute('SELECT * FROM email_verification_tokens WHERE token=?', (token,))
        row = cur.fetchone()
        if not row:
            return None
        return EmailVerificationToken(
            Id=row['id'],
            UsuarioId=row['usuario_id'],
            Token=row['token'],
            ExpiraEn=datetime.fromisoformat(row['expira_en']),
            Usado=bool(row['usado']),
        )

    def mark_used(self, token: str) -> None:
        self._c.execute('UPDATE email_verification_tokens SET usado=1 WHERE token=?', (token,))
        self._c.commit()

