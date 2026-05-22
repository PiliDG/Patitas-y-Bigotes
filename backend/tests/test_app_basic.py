from __future__ import annotations


def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["service"].startswith("patitasybigotes-backend")


def test_status_endpoint_memory_backend(client):
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["ok"] is True
    assert data["database"]["engine"] in ("memory", "sqlite")


def test_index_serves_static_html(client):
    res = client.get("/")
    assert res.status_code == 200
    text = res.get_data(as_text=True)
    assert "<!DOCTYPE html" in text or "<html" in text.lower()


def test_cors_headers_when_origin_allowed(app, client, monkeypatch):
    # Recreate app with allowed origin to ensure after_request applies headers
    from src.app import create_app

    monkeypatch.setenv("PERSISTENCE", "memory")
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://example.com")
    test_app = create_app()
    test_app.config.update(TESTING=True)
    c = test_app.test_client()

    res = c.get("/health", headers={"Origin": "https://example.com"})
    assert res.status_code == 200
    # CORS headers should be present and echo allowed origin
    assert res.headers.get("Access-Control-Allow-Origin") == "https://example.com"
    assert res.headers.get("Access-Control-Allow-Credentials") == "true"


def test_dev_seed_full_requires_flag(client):
    # By default the endpoint must be disabled (config flags off in fixture)
    res = client.post("/api/dev/seed/full")
    assert res.status_code == 404


def test_dev_seed_full_with_flag(monkeypatch):
    # Enable dev features and verify seeding works
    from src.app import create_app

    monkeypatch.setenv("PERSISTENCE", "memory")
    monkeypatch.setenv("ENABLE_DEV_FEATURES", "1")
    monkeypatch.setenv("EXPOSE_VERIFY_TOKEN", "1")
    app = create_app()
    app.config.update(TESTING=True)
    client = app.test_client()

    res = client.post("/api/dev/seed/full")
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("ok") is True
    created = data.get("created") or {}
    # Expect at least one entity seeded
    assert any(len(v) > 0 for v in created.values())
