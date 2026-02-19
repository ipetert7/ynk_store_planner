from __future__ import annotations

from pathlib import Path

import pytest

from ynk_modelo.arriendos import service
from ynk_modelo.database import db as db_module
from ynk_modelo.database.db import init_db


def setup_temp_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "test_arriendos.db"
    monkeypatch.setattr(db_module, "DB_PATH", db_path)
    monkeypatch.setattr(service, "BACKUP_DIR", tmp_path / "backups")
    init_db()


def test_arriendos_schema_and_permissions(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    setup_temp_db(tmp_path, monkeypatch)

    conn = db_module.get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='stores'")
    assert cursor.fetchone() is not None

    cursor.execute("SELECT is_enabled FROM feature_flags WHERE key_name='arriendos_enabled'")
    flag_row = cursor.fetchone()
    assert flag_row is not None
    assert flag_row[0] == 1

    cursor.execute("SELECT id FROM permissions WHERE name='manage_arriendos_stores'")
    assert cursor.fetchone() is not None

    conn.close()


def test_store_lifecycle_modifications_and_backup(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    setup_temp_db(tmp_path, monkeypatch)

    store_id = service.create_store(
        {
            "store_code": "T-100",
            "name": "Tienda Test",
            "contract_start": "2026-01-01",
            "contract_end": "2027-01-01",
            "base_rent_uf": 100,
            "variable_rent_pct": 8,
            "ggcc_clp": 250000,
            "promotion_fund_pct": 1.5,
            "surface_m2": 120,
        },
        user_id=None,
    )

    metrics = service.dashboard_metrics()
    assert metrics["active_stores"] == 1

    mod_id = service.create_temporary_modification(
        store_id,
        {
            "field_name": "base_rent_uf",
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "old_value": "100",
            "new_value": "95",
        },
        user_id=None,
    )
    assert mod_id > 0

    with pytest.raises(service.ArriendosOperationError) as exc:
        service.create_temporary_modification(
            store_id,
            {
                "field_name": "base_rent_uf",
                "start_date": "2026-03-10",
                "end_date": "2026-03-20",
                "old_value": "95",
                "new_value": "90",
            },
            user_id=None,
        )
    assert exc.value.code == "OVERLAP_TEMP_MODIFICATION"

    backup = service.create_backup(user_id=None, reason="test")
    assert backup["id"].startswith("backup-")
    assert Path(backup["file_path"]).exists()
