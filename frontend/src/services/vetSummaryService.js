import { apiRequest } from './apiClient.js';
import { getAllPets } from './petsService.js';
import { listAllApplications } from './adoptionsService.js';
import { listAllFollowUps } from './followupsService.js';

export async function getVetSummary() {
  try {
    const data = await apiRequest('/api/veterinario/resumen');
    return {
      animales: data.animales || [],
      solicitudes: data.solicitudes || [],
      seguimientos: data.seguimientos || [],
      actualizadoEn: data.actualizadoEn || null
    };
  } catch (err) {
    // Fallback local cuando el endpoint no está disponible/registrado
    try {
      const [animals, solicitudes, seguimientos] = await Promise.all([
        getAllPets().catch(() => []),
        listAllApplications().catch(() => []),
        listAllFollowUps().catch(() => [])
      ]);
      const animales = (animals || [])
        .map((a) => ({
          id: a.Id,
          animalId: a.Id,
          nombre: a.Nombre || '',
          especie: a.EspecieRaza || '',
          estado: (a.EstadoSalud || '').toLowerCase().includes('tratamiento') ? 'En tratamiento'
            : (a.EstadoSalud || '').toLowerCase().includes('apto') ? 'Alta médica'
            : 'Disponible',
          fecha: a.FechaActualizacion || a.FechaIngreso || null,
        }))
        .slice(0, 5);
      const solicitudesFmt = (solicitudes || []).slice(0, 5).map((s) => ({
        id: s.Id,
        animalId: s.AnimalId,
        adoptante: s.AdoptanteNombre || s.Adoptante || '',
        animal: s.AnimalNombre || s.Animal || '',
        estado: s.EstadoSolicitud || 'Pendiente',
        fecha: s.FechaSolicitud || s.FechaActualizacion || null,
      }));
      const segFmt = (seguimientos || []).slice(0, 5).map((sg) => ({
        id: sg.Id,
        animalId: sg.AnimalId || null,
        animal: sg.Animal || '',
        estado: sg.EstadoSeguimiento || 'Activo',
        fecha: sg.FechaSeguimiento || null,
        proximaCita: sg.ProximaCita || null,
      }));
      return { animales, solicitudes: solicitudesFmt, seguimientos: segFmt, actualizadoEn: new Date().toISOString() };
    } catch (e) {
      throw err;
    }
  }
}

