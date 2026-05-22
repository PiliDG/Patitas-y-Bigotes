from dataclasses import dataclass, asdict
from datetime import date, datetime


@dataclass
class Animal:
    Id: int
    Nombre: str
    Descripcion: str
    EspecieRaza: str
    Sexo: str
    FechaIngreso: date
    Origen: str
    Peso: float
    Edad: int
    EstadoSalud: str
    EstadoSolicitud: str
    Diagnostico: str
    Tratamiento: str
    Adjuntos: str
    FechaControl: date
    Vacunas: str
    Resultado: str
    Foto: str
    OperadorId: int
    FechaCreacion: datetime
    FechaActualizacion: datetime

    def to_dict(self) -> dict:
        d = asdict(self)
        d['FechaIngreso'] = self.FechaIngreso.isoformat() if self.FechaIngreso else None
        d['FechaControl'] = self.FechaControl.isoformat() if self.FechaControl else None
        d['FechaCreacion'] = self.FechaCreacion.isoformat() if self.FechaCreacion else None
        d['FechaActualizacion'] = self.FechaActualizacion.isoformat() if self.FechaActualizacion else None
        return d

