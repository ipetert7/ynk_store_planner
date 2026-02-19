"""Modulo de arriendos para Flask."""
from __future__ import annotations

def create_blueprint():
    """Carga diferida del blueprint para evitar dependencias en import de tests."""
    from ynk_modelo.arriendos.routes import create_blueprint as _factory

    return _factory()

__all__ = ["create_blueprint"]
