import os
import sqlite3
from pathlib import Path


def get_connection(db_file: str) -> sqlite3.Connection:
    Path(os.path.dirname(db_file) or '.').mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_file, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON;')
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    # Usuarios base
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL,
            contrasena_hash TEXT NOT NULL,
            tipo TEXT NOT NULL,
            esta_activo INTEGER NOT NULL,
            fecha_registro TEXT NOT NULL
        );'''
    )
    cur.execute('CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_email ON usuarios(email);')

    # Operadores y Veterinarios (herencia por separación)
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS operadores (
            id INTEGER PRIMARY KEY,
            turno TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES usuarios(id) ON DELETE CASCADE
        );'''
    )
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS veterinarios (
            id INTEGER PRIMARY KEY,
            matricula TEXT NOT NULL,
            FOREIGN KEY(id) REFERENCES usuarios(id) ON DELETE CASCADE
        );'''
    )

    # Adoptantes
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS adoptantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            edad INTEGER,
            direccion TEXT,
            convivientes TEXT,
            experiencia TEXT,
            numero_telefono TEXT,
            adjuntos TEXT,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );'''
    )

    # Animales
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS animales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT,
            descripcion TEXT,
            especie_raza TEXT,
            sexo TEXT,
            fecha_ingreso TEXT,
            origen TEXT,
            peso REAL,
            edad INTEGER,
            estado_salud TEXT,
            estado_solicitud TEXT,
            diagnostico TEXT,
            tratamiento TEXT,
            adjuntos TEXT,
            fecha_control TEXT,
            vacunas TEXT,
            resultado TEXT,
            foto TEXT,
            operador_id INTEGER,
            fecha_creacion TEXT,
            fecha_actualizacion TEXT,
            FOREIGN KEY(operador_id) REFERENCES usuarios(id)
        );'''
    )

    # Control Sanitario
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS controles_sanitarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            animal_id INTEGER NOT NULL,
            veterinario_id INTEGER NOT NULL,
            registrado_por_id INTEGER NOT NULL,
            fecha TEXT,
            diagnostico TEXT,
            vacunas TEXT,
            tratamiento TEXT,
            observaciones TEXT,
            adjuntos TEXT,
            resultado TEXT,
            proxima_cita TEXT,
            creado_en TEXT,
            FOREIGN KEY(animal_id) REFERENCES animales(id) ON DELETE CASCADE,
            FOREIGN KEY(veterinario_id) REFERENCES usuarios(id),
            FOREIGN KEY(registrado_por_id) REFERENCES usuarios(id)
        );'''
    )

    # Auditoría de Animal
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS animales_auditoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            animal_id INTEGER NOT NULL,
            operador_id INTEGER,
            evento TEXT,
            detalles TEXT,
            fecha TEXT,
            FOREIGN KEY(animal_id) REFERENCES animales(id) ON DELETE CASCADE,
            FOREIGN KEY(operador_id) REFERENCES usuarios(id)
        );'''
    )

    # Solicitudes y dependientes
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS solicitudes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_solicitud TEXT,
            fecha_solicitud TEXT,
            motivo_solicitud TEXT,
            estado_solicitud TEXT,
            motivo_rechazo TEXT,
            comentarios TEXT,
            adjuntos TEXT,
            acepta_terminos INTEGER,
            auditoria TEXT,
            fecha_actualizacion TEXT,
            animal_id INTEGER NOT NULL,
            adoptante_id INTEGER NOT NULL,
            FOREIGN KEY(animal_id) REFERENCES animales(id) ON DELETE CASCADE,
            FOREIGN KEY(adoptante_id) REFERENCES adoptantes(id)
        );'''
    )

    cur.execute(
        '''CREATE TABLE IF NOT EXISTS visitas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_visita TEXT,
            fecha_hora_visita TEXT,
            estado_solicitud TEXT,
            motivo_rechazo TEXT,
            solicitud_id INTEGER NOT NULL,
            responsable TEXT,
            direccion TEXT,
            motivo TEXT,
            modalidad TEXT,
            FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
        );'''
    )

    # Evolución de schema: columnas opcionales para responsable/dirección/motivo/modalidad
    for column in ('responsable', 'direccion', 'motivo', 'modalidad'):
        try:
            cur.execute(f'ALTER TABLE visitas ADD COLUMN {column} TEXT')
        except sqlite3.OperationalError:
            pass

    cur.execute(
        '''CREATE TABLE IF NOT EXISTS seguimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_seguimiento TEXT,
            fecha_seguimiento TEXT,
            estado_seguimiento TEXT,
            tipo_seguimiento TEXT,
            observaciones TEXT,
            comportamiento TEXT,
            adjuntos TEXT,
            firma TEXT,
            solicitud_id INTEGER NOT NULL,
            FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id) ON DELETE CASCADE
        );'''
    )

    # Evolución de schema: agregar columna tipo_seguimiento si falta
    try:
        cur.execute('ALTER TABLE seguimientos ADD COLUMN tipo_seguimiento TEXT')
    except sqlite3.OperationalError:
        pass

    # Email verification tokens
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            expira_en TEXT NOT NULL,
            usado INTEGER NOT NULL,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );'''
    )

    # Inbox de entregas (infra; no pertenece al modelo de dominio)
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS entregas_inbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            contacto TEXT NOT NULL,
            ubicacion TEXT,
            descripcion TEXT NOT NULL,
            foto TEXT,
            creado_en TEXT NOT NULL
        );'''
    )
    conn.commit()
