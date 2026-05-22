import os
from typing import Any, Dict

from ..persistence.sqlite_utils import get_connection, init_schema
from .usuarios import InMemoryUsuarioRepository, SQLiteUsuarioRepository
from .animales import InMemoryAnimalRepository, SQLiteAnimalRepository
from .tokens import InMemoryTokenRepository, SQLiteTokenRepository
from .animal_auditoria import InMemoryAnimalAuditoriaRepository, SQLiteAnimalAuditoriaRepository
from .solicitudes import (
    InMemorySolicitudesRepository,
    InMemorySeguimientosRepository,
    SQLiteSolicitudesRepository,
    SQLiteSeguimientosRepository,
)
from .controles_sanitarios import InMemoryControlSanitarioRepository, SQLiteControlSanitarioRepository
from .adoptantes import InMemoryAdoptantesRepository, SQLiteAdoptantesRepository
from .visitas import InMemoryVisitasRepository, SQLiteVisitasRepository
from .entregas import InMemoryEntregasInboxRepository, SQLiteEntregasInboxRepository


def build_repositories() -> Dict[str, Any]:
    persistence = os.environ.get('PERSISTENCE', 'sqlite').lower()
    repos: Dict[str, Any] = {}

    if persistence == 'sqlite':
        db_file = os.environ.get('DB_FILE', 'data/app.db')
        conn = get_connection(db_file)
        init_schema(conn)
        repos['usuarios'] = SQLiteUsuarioRepository(conn)
        repos['animales'] = SQLiteAnimalRepository(conn)
        repos['tokens'] = SQLiteTokenRepository(conn)
        repos['animal_auditoria'] = SQLiteAnimalAuditoriaRepository(conn)
        repos['solicitudes'] = SQLiteSolicitudesRepository(conn)
        repos['seguimientos'] = SQLiteSeguimientosRepository(conn)
        repos['controles'] = SQLiteControlSanitarioRepository(conn)
        repos['adoptantes'] = SQLiteAdoptantesRepository(conn)
        repos['visitas'] = SQLiteVisitasRepository(conn)
        repos['entregas_inbox'] = SQLiteEntregasInboxRepository(conn)
        # Nota: puedes a??adir aqu?? mos repos SQLite seggn necesites.
        repos['_conn'] = conn
    else:
        repos['usuarios'] = InMemoryUsuarioRepository()
        repos['animales'] = InMemoryAnimalRepository()
        repos['tokens'] = InMemoryTokenRepository()
        repos['animal_auditoria'] = InMemoryAnimalAuditoriaRepository()
        repos['adoptantes'] = InMemoryAdoptantesRepository()
        repos['solicitudes'] = InMemorySolicitudesRepository(repos['adoptantes'])
        repos['seguimientos'] = InMemorySeguimientosRepository(repos['solicitudes'])
        repos['controles'] = InMemoryControlSanitarioRepository()
        repos['visitas'] = InMemoryVisitasRepository(repos['solicitudes'])
        repos['entregas_inbox'] = InMemoryEntregasInboxRepository()

    return repos

