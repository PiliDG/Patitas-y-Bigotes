# Solicitudes de Visita: antes o después de la adopción

El endpoint del adoptante para solicitar una visita admite dos modos:

- Con `SolicitudId` (flujo existente):
  - `POST /api/visitas/solicitudes` con `{ SolicitudId, Modalidad, Direccion?, FechaHoraSugerida?, Comentarios? }`.

- Con `AnimalId` (antes de iniciar la adopción):
  - `POST /api/visitas/solicitudes` con `{ AnimalId, Modalidad, Direccion?, FechaHoraSugerida?, Comentarios? }`.
  - El backend crea una pre-solicitud interna (estado `Pre-Visita`) y registra la visita en estado `Pendiente` sin bloquear el flujo normal de adopción.

Notas:
- Si ya existe una solicitud del usuario para ese animal, se reutiliza.
- Para visitas domiciliarias (`Modalidad=Domiciliaria`) es obligatorio indicar `Direccion`.
