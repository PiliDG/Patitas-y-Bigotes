from enum import Enum


class Roles(str, Enum):
    ADOPTANTE = 'adoptante'
    OPERADOR = 'operador'
    VETERINARIO = 'veterinario'
    ADMIN = 'admin'


class AnimalSalud(str, Enum):
    PENDIENTE_CONTROL = 'Pendiente de Control'
    APTO_ADOPCION = 'Apto para adopción'
    EN_TRATAMIENTO = 'En tratamiento'
    NO_APTO_ADOPCION = 'No apto para adopción'


class AnimalSolicitud(str, Enum):
    RESERVADO = 'Reservado'
    NO_DISPONIBLE = 'No disponible'
    BAJA = 'Baja'
    # Nota: estado vacío representa sin solicitud especial
    VACIO = ''


class SolicitudEstado(str, Enum):
    PENDIENTE = 'Pendiente'
    EN_REVISION = 'En revisión'
    APROBADA = 'Aprobada'
    RECHAZADA = 'Rechazada'
    CANCELADA = 'Cancelada'
    ANULADA = 'Anulada'
    APROBADA_PROVISIONAL = 'Aprobada de manera provisional'


class VisitaEstado(str, Enum):
    PENDIENTE = 'Pendiente'
    PROGRAMADA = 'Programada'
    CANCELADA = 'Cancelada'


class SeguimientoEstado(str, Enum):
    ACTIVO = 'Activo'
    PENDIENTE = 'Pendiente'
    CANCELADO = 'Cancelado'
    FINALIZADO = 'Finalizado'


class SeguimientoTipo(str, Enum):
    ADMINISTRATIVO = 'Administrativo'
    VETERINARIO = 'Veterinario'
    DOMICILIARIO = 'Domiciliario'
