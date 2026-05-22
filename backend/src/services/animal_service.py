from __future__ import annotations
from datetime import datetime, date
from typing import Tuple, Any

from ..domain.animal import Animal
from ..domain.constants import AnimalSalud, AnimalSolicitud


class AnimalService:
    def __init__(self, animal_repo, auditoria_repo) -> None:
        self._animals = animal_repo
        self._audit = auditoria_repo

    @staticmethod
    def _parse_date(s: str | None) -> date | None:
        return date.fromisoformat(s) if s else None

    def create_from_payload(self, body: dict, operador_id: int | None) -> Tuple[bool, dict, int]:
        nombre = (body.get('Nombre') or '').strip()
        foto = (body.get('Foto') or '').strip()
        if not nombre:
            return False, {"error": True, "message": "Debe tener nombre"}, 400
        if not foto:
            return False, {"error": True, "message": "Debe adjuntar foto"}, 400

        confirmar = str(body.get('ConfirmarDuplicado', '0')).lower() in ('1', 'true')
        fecha_ingreso = self._parse_date(body.get('FechaIngreso'))
        origen = (body.get('Origen') or '').strip()
        # Detección simple de duplicado
        if hasattr(self._animals, 'list'):
            posibles = [
                x for x in self._animals.list()
                if (x.Nombre or '').strip().lower() == nombre.lower()
                and (x.Origen or '').strip().lower() == origen.lower()
                and (x.FechaIngreso == fecha_ingreso)
                # Ignorar registros dados de baja al evaluar duplicado
                and (str(getattr(x, 'EstadoSolicitud', '') or '').strip().lower() != str(AnimalSolicitud.BAJA.value).strip().lower())
            ]
            if posibles and not confirmar:
                return False, {"error": True, "message": "Posible duplicado; confirmar"}, 409

        # Parseos tolerantes para evitar 500 por datos de UI
        def _to_int(v: Any, default: int = 0) -> int:
            try:
                if v is None:
                    return default
                s = str(v).strip()
                # extraer primer grupo de dígitos si viene con texto ("2 años")
                import re
                m = re.search(r"\d+", s)
                return int(m.group(0)) if m else default
            except Exception:
                return default

        def _to_float(v: Any, default: float = 0.0) -> float:
            try:
                if v is None:
                    return default
                s = str(v).strip().replace(',', '.')
                return float(s) if s else default
            except Exception:
                return default

        now = datetime.utcnow()
        a = Animal(
            Id=0,
            Nombre=nombre,
            Descripcion=body.get('Descripcion', ''),
            EspecieRaza=body.get('EspecieRaza', ''),
            Sexo=body.get('Sexo', ''),
            FechaIngreso=fecha_ingreso,
            Origen=origen,
            Peso=_to_float(body.get('Peso', 0)),
            Edad=_to_int(body.get('Edad', 0)),
            EstadoSalud=AnimalSalud.PENDIENTE_CONTROL.value,
            EstadoSolicitud=body.get('EstadoSolicitud', ''),
            Diagnostico=body.get('Diagnostico', ''),
            Tratamiento=body.get('Tratamiento', ''),
            Adjuntos=body.get('Adjuntos', ''),
            FechaControl=self._parse_date(body.get('FechaControl')),
            Vacunas=body.get('Vacunas', ''),
            Resultado=body.get('Resultado', ''),
            Foto=foto,
            # Si no hay operador autenticado, no forzar 0 para evitar FK inválida
            OperadorId=(int(operador_id) if operador_id else None),
            FechaCreacion=now,
            FechaActualizacion=now,
        )
        # Si el resultado indica adopción/hogar, marcar estado de solicitud en Baja
        try:
            mark = f"{a.Resultado} {body.get('EstadoSolicitud','')}".lower()
            if any(k in mark for k in ('adopt', 'hogar', 'entreg')):
                a.EstadoSolicitud = AnimalSolicitud.BAJA.value
        except Exception:
            pass
        a = self._animals.add(a)

        # Auditoría (best-effort)
        try:
            from ..domain.animal_auditoria import AnimalAuditoria
            self._audit.add(AnimalAuditoria(Id=0, AnimalId=a.Id, OperadorId=operador_id, Evento='ALTA', Detalles='Alta de animal', Fecha=now))
        except Exception:
            pass

        return True, {"message": "El animal fue dado de alta", "animal": a.to_dict()}, 201

