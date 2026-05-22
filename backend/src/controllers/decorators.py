from __future__ import annotations
import time
from functools import wraps
from collections import deque
from typing import Deque, Dict, Iterable, Tuple
from flask import jsonify, request, session


def _normalize_role(value: str | None) -> str:
    return (value or '').strip().lower()

def get_effective_role() -> str:
    role = _normalize_role(session.get('user_tipo'))
    if role:
        return role
    return _normalize_role(request.headers.get('X-User-Type'))


def require_role(allowed: Iterable[str]):
    allowed_set = {_normalize_role(r) for r in allowed}

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            role = get_effective_role()
            if role not in allowed_set:
                return jsonify(error=True, message='Permisos insuficientes'), 403
            return fn(*args, **kwargs)

        return wrapper
    return decorator


_RATE_LIMIT_BUCKETS: Dict[Tuple[str, str], Deque[float]] = {}


def rate_limit(limit: int = 5, window_seconds: int = 60):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if limit <= 0:
                return fn(*args, **kwargs)
            key = request.remote_addr or 'anonymous'
            bucket_key = (fn.__name__, key)
            bucket = _RATE_LIMIT_BUCKETS.setdefault(bucket_key, deque())
            now = time.time()
            threshold = now - window_seconds
            while bucket and bucket[0] <= threshold:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, int(window_seconds - (now - bucket[0])))
                response = jsonify(error=True, message='Demasiadas solicitudes, intente mas tarde')
                response.status_code = 429
                response.headers['Retry-After'] = str(retry_after)
                return response
            bucket.append(now)
            return fn(*args, **kwargs)
        return wrapper
    return decorator
