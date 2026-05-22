from dataclasses import dataclass
from .usuario import Usuario


@dataclass
class Veterinario(Usuario):
    Matricula: str

