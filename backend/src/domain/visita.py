from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class Visita:
    Id: int
    IdVisita: str
    FechaHoraVisita: datetime
    EstadoSolicitud: str
    MotivoRechazo: str
    SolicitudId: int
    Responsable: str = ''
    Direccion: str = ''
    Motivo: str = ''
    Modalidad: str = ''

    def to_dict(self) -> dict:
        d = asdict(self)
        d['FechaHoraVisita'] = self.FechaHoraVisita.isoformat() if self.FechaHoraVisita else None
        return d
