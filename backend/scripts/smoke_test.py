import os
import json
import time
import pathlib

BASE = pathlib.Path(__file__).resolve().parents[2]
DATA_PATH = BASE / 'data'
DATA_PATH.mkdir(exist_ok=True)
DB_FILE = DATA_PATH / 'smoke_test.db'
if DB_FILE.exists():
    DB_FILE.unlink()

os.environ['SECRET_KEY'] = 'smoke-secret-key-please-change'
os.environ['PERSISTENCE'] = 'sqlite'
os.environ['DB_FILE'] = str(DB_FILE)
os.environ['ENABLE_DEV_FEATURES'] = '1'
os.environ['EXPOSE_VERIFY_TOKEN'] = '1'
os.environ['ALLOW_ELEVATE'] = '1'

from backend.src.app import create_app

app = create_app()
client = app.test_client()

results = []

def record(title, response):
    try:
        payload = response.get_json()
    except Exception:
        payload = response.data.decode('utf-8')
    results.append({
        'title': title,
        'status': response.status_code,
        'body': payload,
    })

resp = client.get('/api/status')
record('GET /api/status', resp)

email = f"smoke+{int(time.time())}@example.com"
resp = client.post('/api/auth/registro', json={
    'nombre': 'Smoke Tester',
    'email': email,
    'contrasena': 'Secreta123',
    'aceptaTerminos': True,
})
record('POST /api/auth/registro', resp)

token = resp.json.get('token')
if not token:
    raise SystemExit('No se expuso token de verificacion aun en modo dev')

resp = client.get(f'/api/auth/confirmar?token={token}')
record('GET /api/auth/confirmar', resp)

resp = client.post('/api/auth/login', json={'email': email, 'contrasena': 'Secreta123'})
record('POST /api/auth/login', resp)

resp = client.post('/api/auth/promote', json={'Tipo': 'operador'})
record('POST /api/auth/promote', resp)

resp = client.post('/api/animales', json={
    'Nombre': 'Copito',
    'Foto': 'https://example.com/copito.jpg',
    'Origen': 'Rescate',
    'FechaIngreso': '2025-04-10'
})
record('POST /api/animales', resp)

resp = client.get('/api/animales/buscar?q=copito')
record('GET /api/animales/buscar', resp)

for i in range(1, 7):
    resp = client.post('/api/entregas/aviso', json={
        'nombre': f'Remitente {i}',
        'contacto': '555-0000',
        'descripcion': 'Perro en la calle'
    })
    record(f'POST /api/entregas/aviso intento {i}', resp)

summary = {
    'db_file': str(DB_FILE),
    'db_exists': DB_FILE.exists(),
    'db_size': DB_FILE.stat().st_size if DB_FILE.exists() else 0,
    'steps': results,
}

print(json.dumps(summary, indent=2))
