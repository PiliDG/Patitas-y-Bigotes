from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class AnimalAuditoria:
    Id: int
    AnimalId: int
    OperadorId: int | None
    Evento: str
    Detalles: str
    Fecha: datetime

    def to_dict(self) -> dict:
        d = asdict(self)
        d['Fecha'] = self.Fecha.isoformat() if self.Fecha else None
        return d

