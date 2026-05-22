from dataclasses import dataclass, asdict
from datetime import date, datetime


@dataclass
class ControlSanitario:
    Id: int
    AnimalId: int
    VeterinarioId: int
    RegistradoPorId: int
    Fecha: date
    Diagnostico: str
    Vacunas: str
    Tratamiento: str
    Observaciones: str
    Adjuntos: str
    Resultado: str
    ProximaCita: date
    CreadoEn: datetime

    def to_dict(self) -> dict:
        d = asdict(self)
        d['Fecha'] = self.Fecha.isoformat() if self.Fecha else None
        d['ProximaCita'] = self.ProximaCita.isoformat() if self.ProximaCita else None
        d['CreadoEn'] = self.CreadoEn.isoformat() if self.CreadoEn else None
        return d

