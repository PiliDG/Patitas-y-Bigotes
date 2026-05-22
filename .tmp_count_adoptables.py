from backend.src.app import create_app
from backend.src.domain.constants import AnimalSolicitud
app = create_app()
with app.test_client() as c:
    data = c.get('/api/animales').get_json()
    animals = data.get('animales', [])
    def is_adoptable(a):
        h = (a.get('EstadoSalud') or '').lower()
        s = (a.get('EstadoSolicitud') or '').strip()
        has_home = bool((a.get('Resultado') or '').strip())
        return (('apto' in h and 'no apto' not in h) and s != AnimalSolicitud.BAJA.value and not has_home)
    adoptables = [a for a in animals if is_adoptable(a)]
    print('adoptables:', len(adoptables))
    print('sample:', [a['Nombre'] for a in adoptables[:18]])
