"""Tests de humo para validar que el paquete importa correctamente."""
from __future__ import annotations

def test_import_main_package() -> None:
    import importlib

    module = importlib.import_module("ynk_modelo")
    assert module is not None
