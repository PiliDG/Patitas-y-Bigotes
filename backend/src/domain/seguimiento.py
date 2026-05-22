from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class Seguimiento:
    Id: int
    IdSeguimiento: str
    FechaSeguimiento: datetime
    EstadoSeguimiento: str
    TipoSeguimiento: str
    Observaciones: str
    Comportamiento: str
    Adjuntos: str
    Firma: str
    SolicitudId: int

    def to_dict(self) -> dict:
        d = asdict(self)
        d['FechaSeguimiento'] = self.FechaSeguimiento.isoformat() if self.FechaSeguimiento else None
        return d

