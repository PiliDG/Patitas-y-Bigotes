import os
import contextlib
from typing import Iterator

import pytest


@contextlib.contextmanager
def _env(**env):
    old = {k: os.environ.get(k) for k in env}
    try:
        for k, v in env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = str(v)
        yield
    finally:
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


@pytest.fixture
def app():
    # Use in-memory repositories and enable dev features for predictable tests
    from src.app import create_app

    with _env(PERSISTENCE="memory", ENABLE_DEV_FEATURES="1", EXPOSE_VERIFY_TOKEN="0", ALLOW_ELEVATE="0"):
        app = create_app()
        app.config.update(TESTING=True)
        yield app


@pytest.fixture
def client(app):
    return app.test_client()
