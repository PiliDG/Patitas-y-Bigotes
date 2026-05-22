from dataclasses import dataclass
from .usuario import Usuario


@dataclass
class Operador(Usuario):
    Turno: str

