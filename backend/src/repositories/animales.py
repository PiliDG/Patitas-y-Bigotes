from __future__ import annotations
from dataclasses import replace
from datetime import date, datetime
from typing import List, Optional
import sqlite3

from ..domain.animal import Animal


class InMemoryAnimalRepository:
    def __init__(self) -> None:
        self._items: dict[int, Animal] = {}
        self._next_id = 1

    def list(self) -> List[Animal]:
        return list(self._items.values())

    def get(self, id_: int) -> Optional[Animal]:
        return self._items.get(id_)

    def add(self, a: Animal) -> Animal:
        if a.Id == 0:
            a = replace(a, Id=self._next_id)
            self._next_id += 1
        self._items[a.Id] = a
        return a

    def update(self, a: Animal) -> None:
        if a.Id in self._items:
            self._items[a.Id] = a


class SQLiteAnimalRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._c = conn

    @staticmethod
    def _iso_to_date(s: Optional[str]) -> Optional[date]:
        if not s:
            return None
        return date.fromisoformat(s)

    @staticmethod
    def _iso_to_dt(s: Optional[str]) -> Optional[datetime]:
        if not s:
            return None
        return datetime.fromisoformat(s)

    @staticmethod
    def _row_to_animal(row: sqlite3.Row) -> Animal:
        return Animal(
            Id=row['id'],
            Nombre=row['nombre'],
            Descripcion=row['descripcion'],
            EspecieRaza=row['especie_raza'],
            Sexo=row['sexo'],
            FechaIngreso=SQLiteAnimalRepository._iso_to_date(row['fecha_ingreso']),
            Origen=row['origen'],
            Peso=row['peso'] if row['peso'] is not None else 0.0,
            Edad=row['edad'] if row['edad'] is not None else 0,
            EstadoSalud=row['estado_salud'],
            EstadoSolicitud=row['estado_solicitud'],
            Diagnostico=row['diagnostico'],
            Tratamiento=row['tratamiento'],
            Adjuntos=row['adjuntos'],
            FechaControl=SQLiteAnimalRepository._iso_to_date(row['fecha_control']),
            Vacunas=row['vacunas'],
            Resultado=row['resultado'],
            Foto=row['foto'],
            OperadorId=row['operador_id'] if row['operador_id'] is not None else 0,
            FechaCreacion=SQLiteAnimalRepository._iso_to_dt(row['fecha_creacion']) or datetime.utcnow(),
            FechaActualizacion=SQLiteAnimalRepository._iso_to_dt(row['fecha_actualizacion']) or datetime.utcnow(),
        )

    def list(self) -> List[Animal]:
        cur = self._c.execute('SELECT * FROM animales ORDER BY id ASC')
        return [self._row_to_animal(r) for r in cur.fetchall()]

    def get(self, id_: int) -> Optional[Animal]:
        cur = self._c.execute('SELECT * FROM animales WHERE id=?', (id_,))
        row = cur.fetchone()
        return self._row_to_animal(row) if row else None

    def add(self, a: Animal) -> Animal:
        cur = self._c.execute(
            '''INSERT INTO animales (
                nombre, descripcion, especie_raza, sexo, fecha_ingreso, origen, peso, edad,
                estado_salud, estado_solicitud, diagnostico, tratamiento, adjuntos, fecha_control,
                vacunas, resultado, foto, operador_id, fecha_creacion, fecha_actualizacion
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (
                a.Nombre,
                a.Descripcion,
                a.EspecieRaza,
                a.Sexo,
                a.FechaIngreso.isoformat() if a.FechaIngreso else None,
                a.Origen,
                a.Peso,
                a.Edad,
                a.EstadoSalud,
                a.EstadoSolicitud,
                a.Diagnostico,
                a.Tratamiento,
                a.Adjuntos,
                a.FechaControl.isoformat() if a.FechaControl else None,
                a.Vacunas,
                a.Resultado,
                a.Foto,
                a.OperadorId if a.OperadorId else None,
                (a.FechaCreacion or datetime.utcnow()).isoformat(),
                (a.FechaActualizacion or datetime.utcnow()).isoformat(),
            ),
        )
        a = replace(a, Id=cur.lastrowid)
        self._c.commit()
        return a

    def update(self, a: Animal) -> None:
        self._c.execute(
            '''UPDATE animales SET
                nombre=?, descripcion=?, especie_raza=?, sexo=?, fecha_ingreso=?, origen=?, peso=?, edad=?,
                estado_salud=?, estado_solicitud=?, diagnostico=?, tratamiento=?, adjuntos=?, fecha_control=?,
                vacunas=?, resultado=?, foto=?, operador_id=?, fecha_creacion=?, fecha_actualizacion=?
               WHERE id=?''',
            (
                a.Nombre,
                a.Descripcion,
                a.EspecieRaza,
                a.Sexo,
                a.FechaIngreso.isoformat() if a.FechaIngreso else None,
                a.Origen,
                a.Peso,
                a.Edad,
                a.EstadoSalud,
                a.EstadoSolicitud,
                a.Diagnostico,
                a.Tratamiento,
                a.Adjuntos,
                a.FechaControl.isoformat() if a.FechaControl else None,
                a.Vacunas,
                a.Resultado,
                a.Foto,
                a.OperadorId if a.OperadorId else None,
                (a.FechaCreacion or datetime.utcnow()).isoformat(),
                (a.FechaActualizacion or datetime.utcnow()).isoformat(),
                a.Id,
            ),
        )
        self._c.commit()

