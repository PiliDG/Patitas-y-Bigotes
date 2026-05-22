from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class Solicitud:
    Id: int
    IdSolicitud: str
    FechaSolicitud: datetime
    MotivoSolicitud: str
    EstadoSolicitud: str
    MotivoRechazo: str
    Comentarios: str
    Adjuntos: str
    AceptaTerminos: bool
    Auditoria: str
    FechaActualizacion: datetime
    AnimalId: int
    AdoptanteId: int

    def to_dict(self) -> dict:
        d = asdict(self)
        d['FechaSolicitud'] = self.FechaSolicitud.isoformat() if self.FechaSolicitud else None
        d['FechaActualizacion'] = self.FechaActualizacion.isoformat() if self.FechaActualizacion else None
        return d

