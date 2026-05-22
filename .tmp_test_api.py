from backend.src.app import create_app
app = create_app()
with app.test_client() as c:
    r = c.get('/api/animales')
    print(r.status_code)
    data = r.get_json()
    print('count:', len(data.get('animales', [])))
    print([a['Nombre'] for a in data.get('animales', [])[:3]])
