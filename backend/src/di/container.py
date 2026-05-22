from ..repositories.factory import build_repositories
from ..services.email_service import build_email_sender_from_env


def build_container():
    # Retorna un diccionario de repositorios según env var PERSISTENCE
    return {
        'repos': build_repositories(),
        'services': {
            'email': build_email_sender_from_env(),
        },
    }
