from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class EmailVerificationToken:
    Id: int
    UsuarioId: int
    Token: str
    ExpiraEn: datetime
    Usado: bool

    def to_dict(self) -> dict:
        d = asdict(self)
        d['ExpiraEn'] = self.ExpiraEn.isoformat() if self.ExpiraEn else None
        return d

