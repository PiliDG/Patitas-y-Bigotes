from __future__ import annotations
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class Usuario:
    Id: int
    Nombre: str
    Email: str
    ContrasenaHash: str
    Tipo: str
    EstaActivo: bool
    FechaRegistro: datetime

    def to_dict(self) -> dict:
        d = asdict(self)
        d['FechaRegistro'] = self.FechaRegistro.isoformat()
        return d

