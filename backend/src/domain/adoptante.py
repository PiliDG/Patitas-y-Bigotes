from dataclasses import dataclass, asdict


@dataclass
class Adoptante:
    Id: int
    UsuarioId: int
    Edad: int
    Direccion: str
    Convivientes: str
    Experiencia: str
    NumeroTelefono: str
    Adjuntos: str

    def to_dict(self) -> dict:
        return asdict(self)

