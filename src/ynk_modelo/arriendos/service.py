"""Servicios de dominio para el modulo de gestion de arriendos."""
from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd

from ynk_modelo.config import PROJECT_ROOT
from ynk_modelo.database import db as db_module
from ynk_modelo.database.db import get_db
from ynk_modelo.utils.logger import get_logger

logger = get_logger()

FEATURE_FLAG_KEY = "arriendos_enabled"
BACKUP_DIR = PROJECT_ROOT / "output" / "arriendos_backups"
BACKUP_OPERATION_IN_PROGRESS = "BACKUP_OPERATION_IN_PROGRESS"
RESTORE_IN_PROGRESS = "RESTORE_IN_PROGRESS"

_BACKUP_LOCK = threading.Lock()
_RESTORE_LOCK = threading.Lock()


class ArriendosOperationError(RuntimeError):
    """Error de operacion para APIs del modulo arriendos."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


def _dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [{key: row[key] for key in row.keys()} for row in rows]


def _to_iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    value_str = str(value).strip()
    return value_str or None


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def is_feature_enabled(key: str = FEATURE_FLAG_KEY) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT is_enabled FROM feature_flags WHERE key_name = ?",
        (key,),
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return False
    return bool(row[0])


def set_feature_flag(enabled: bool, user_id: int | None, key: str = FEATURE_FLAG_KEY) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO feature_flags (key_name, is_enabled, updated_by, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key_name) DO UPDATE SET
            is_enabled = excluded.is_enabled,
            updated_by = excluded.updated_by,
            updated_at = CURRENT_TIMESTAMP
        """,
        (key, 1 if enabled else 0, user_id),
    )
    conn.commit()
    conn.close()


def dashboard_metrics() -> dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM stores WHERE status = 'active'")
    active_stores = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM stores WHERE status = 'closed'")
    closed_stores = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(SUM(surface_m2), 0) FROM stores WHERE status = 'active'")
    total_surface = float(cursor.fetchone()[0] or 0.0)

    cursor.execute(
        """
        SELECT COALESCE(SUM(base_rent_uf), 0)
        FROM store_contracts
        WHERE is_active = 1
        """
    )
    total_vmm_uf = float(cursor.fetchone()[0] or 0.0)

    cursor.execute(
        "SELECT value FROM uf_values ORDER BY uf_date DESC LIMIT 1"
    )
    uf_row = cursor.fetchone()
    current_uf = float(uf_row[0]) if uf_row else 0.0

    conn.close()

    total_vmm_clp = total_vmm_uf * current_uf if current_uf > 0 else 0.0

    return {
        "active_stores": active_stores,
        "closed_stores": closed_stores,
        "total_surface_m2": total_surface,
        "total_vmm_uf": total_vmm_uf,
        "current_uf": current_uf,
        "total_vmm_clp": total_vmm_clp,
    }


def list_stores(
    search: str | None = None,
    status: str | None = None,
    sort: str = "name",
    order: str = "asc",
) -> list[dict[str, Any]]:
    order = "DESC" if order.lower() == "desc" else "ASC"
    sortable = {
        "name": "s.name",
        "store_code": "s.store_code",
        "status": "s.status",
        "contract_end": "c.contract_end",
        "base_rent_uf": "c.base_rent_uf",
    }
    sort_column = sortable.get(sort, "s.name")

    where_parts: list[str] = []
    params: list[Any] = []

    if search:
        where_parts.append("(s.name LIKE ? OR s.store_code LIKE ? OR COALESCE(s.banner, '') LIKE ?)")
        search_param = f"%{search.strip()}%"
        params.extend([search_param, search_param, search_param])

    if status and status != "all":
        where_parts.append("s.status = ?")
        params.append(status)

    where_clause = ""
    if where_parts:
        where_clause = "WHERE " + " AND ".join(where_parts)

    query = f"""
        SELECT
            s.id,
            s.store_code,
            s.name,
            s.banner,
            s.city,
            s.region,
            s.surface_m2,
            s.status,
            s.notification_days,
            c.id AS contract_id,
            c.contract_start,
            c.contract_end,
            c.base_rent_uf,
            c.variable_rent_pct,
            c.ggcc_clp,
            c.promotion_fund_pct
        FROM stores s
        LEFT JOIN store_contracts c ON c.store_id = s.id AND c.is_active = 1
        {where_clause}
        ORDER BY {sort_column} {order}
    """

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = _dicts(cursor.fetchall())
    conn.close()
    return rows


def get_store(store_id: int) -> dict[str, Any] | None:
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            id,
            store_code,
            name,
            banner,
            city,
            region,
            address,
            surface_m2,
            status,
            notification_days,
            closed_at,
            created_at,
            updated_at
        FROM stores
        WHERE id = ?
        """,
        (store_id,),
    )
    store = _dict(cursor.fetchone())
    if not store:
        conn.close()
        return None

    cursor.execute(
        """
        SELECT
            id,
            store_id,
            contract_start,
            contract_end,
            base_rent_uf,
            variable_rent_pct,
            ggcc_clp,
            promotion_fund_pct,
            currency,
            notes,
            is_active,
            created_at,
            updated_at
        FROM store_contracts
        WHERE store_id = ?
        ORDER BY is_active DESC, contract_start DESC
        """,
        (store_id,),
    )
    contracts = _dicts(cursor.fetchall())

    cursor.execute(
        """
        SELECT
            id,
            store_id,
            contract_id,
            start_date,
            end_date,
            field_name,
            old_value,
            new_value,
            reason,
            is_active,
            created_at
        FROM temporary_modifications
        WHERE store_id = ?
        ORDER BY start_date DESC
        """,
        (store_id,),
    )
    temp_mods = _dicts(cursor.fetchall())

    cursor.execute(
        """
        SELECT
            id,
            store_id,
            contract_id,
            effective_date,
            field_name,
            old_value,
            new_value,
            reason,
            created_at
        FROM permanent_modifications
        WHERE store_id = ?
        ORDER BY effective_date DESC
        """,
        (store_id,),
    )
    perm_mods = _dicts(cursor.fetchall())

    cursor.execute(
        """
        SELECT
            a.id,
            a.action,
            a.entity_type,
            a.entity_id,
            a.details,
            a.created_at,
            u.username
        FROM arriendos_audit_log a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.store_id = ?
        ORDER BY a.created_at DESC
        LIMIT 100
        """,
        (store_id,),
    )
    audit = _dicts(cursor.fetchall())

    conn.close()

    store["contracts"] = contracts
    store["temporary_modifications"] = temp_mods
    store["permanent_modifications"] = perm_mods
    store["audit"] = audit
    return store


def _set_active_contract(cursor: sqlite3.Cursor, store_id: int, contract_id: int | None) -> None:
    cursor.execute(
        "UPDATE store_contracts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE store_id = ?",
        (store_id,),
    )
    if contract_id:
        cursor.execute(
            "UPDATE store_contracts SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (contract_id,),
        )


def _insert_contract(
    cursor: sqlite3.Cursor,
    store_id: int,
    payload: dict[str, Any],
    user_id: int | None,
    is_active: bool = True,
) -> int:
    cursor.execute(
        """
        INSERT INTO store_contracts (
            store_id,
            contract_start,
            contract_end,
            base_rent_uf,
            variable_rent_pct,
            ggcc_clp,
            promotion_fund_pct,
            currency,
            notes,
            is_active,
            created_by,
            updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            store_id,
            _to_iso(payload.get("contract_start")),
            _to_iso(payload.get("contract_end")),
            _to_float(payload.get("base_rent_uf")),
            _to_float(payload.get("variable_rent_pct")),
            _to_float(payload.get("ggcc_clp")),
            _to_float(payload.get("promotion_fund_pct")),
            (payload.get("currency") or "UF")[:8],
            payload.get("notes"),
            1 if is_active else 0,
            user_id,
            user_id,
        ),
    )
    return int(cursor.lastrowid)


def create_store(payload: dict[str, Any], user_id: int | None) -> int:
    if not payload.get("name"):
        raise ArriendosOperationError("VALIDATION_ERROR", "El nombre de la tienda es obligatorio")
    if not payload.get("contract_start"):
        raise ArriendosOperationError("VALIDATION_ERROR", "La fecha de inicio de contrato es obligatoria")

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO stores (
                store_code,
                name,
                banner,
                city,
                region,
                address,
                surface_m2,
                status,
                notification_days,
                created_by,
                updated_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.get("store_code"),
                payload.get("name").strip(),
                payload.get("banner"),
                payload.get("city"),
                payload.get("region"),
                payload.get("address"),
                _to_float(payload.get("surface_m2")),
                payload.get("status") or "active",
                max(1, _to_int(payload.get("notification_days"), 90)),
                user_id,
                user_id,
            ),
        )
        store_id = int(cursor.lastrowid)
        contract_id = _insert_contract(cursor, store_id, payload, user_id, is_active=True)
        _set_active_contract(cursor, store_id, contract_id)

        log_audit(
            cursor,
            store_id=store_id,
            user_id=user_id,
            action="store_created",
            entity_type="store",
            entity_id=str(store_id),
            details={"name": payload.get("name"), "store_code": payload.get("store_code")},
        )

        conn.commit()
        return store_id
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise ArriendosOperationError("STORE_CONFLICT", f"No se pudo crear tienda: {exc}") from exc
    finally:
        conn.close()


def update_store(store_id: int, payload: dict[str, Any], user_id: int | None) -> None:
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM stores WHERE id = ?", (store_id,))
    if not cursor.fetchone():
        conn.close()
        raise ArriendosOperationError("STORE_NOT_FOUND", "Tienda no encontrada", status_code=404)

    cursor.execute(
        """
        UPDATE stores
        SET
            store_code = ?,
            name = ?,
            banner = ?,
            city = ?,
            region = ?,
            address = ?,
            surface_m2 = ?,
            status = ?,
            notification_days = ?,
            updated_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            payload.get("store_code"),
            payload.get("name"),
            payload.get("banner"),
            payload.get("city"),
            payload.get("region"),
            payload.get("address"),
            _to_float(payload.get("surface_m2")),
            payload.get("status") or "active",
            max(1, _to_int(payload.get("notification_days"), 90)),
            user_id,
            store_id,
        ),
    )

    # Permite actualizar contrato activo o crear una nueva version de contrato
    if payload.get("contract_start"):
        active_contract_id = payload.get("contract_id")
        if active_contract_id:
            cursor.execute(
                """
                UPDATE store_contracts
                SET
                    contract_start = ?,
                    contract_end = ?,
                    base_rent_uf = ?,
                    variable_rent_pct = ?,
                    ggcc_clp = ?,
                    promotion_fund_pct = ?,
                    currency = ?,
                    notes = ?,
                    updated_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND store_id = ?
                """,
                (
                    _to_iso(payload.get("contract_start")),
                    _to_iso(payload.get("contract_end")),
                    _to_float(payload.get("base_rent_uf")),
                    _to_float(payload.get("variable_rent_pct")),
                    _to_float(payload.get("ggcc_clp")),
                    _to_float(payload.get("promotion_fund_pct")),
                    payload.get("currency") or "UF",
                    payload.get("notes"),
                    user_id,
                    active_contract_id,
                    store_id,
                ),
            )
            if cursor.rowcount == 0:
                # Si no existe el contrato indicado, crear uno nuevo activo.
                contract_id = _insert_contract(cursor, store_id, payload, user_id, is_active=True)
                _set_active_contract(cursor, store_id, contract_id)
        else:
            contract_id = _insert_contract(cursor, store_id, payload, user_id, is_active=True)
            _set_active_contract(cursor, store_id, contract_id)

    log_audit(
        cursor,
        store_id=store_id,
        user_id=user_id,
        action="store_updated",
        entity_type="store",
        entity_id=str(store_id),
        details={"name": payload.get("name")},
    )

    conn.commit()
    conn.close()


def close_store(store_id: int, user_id: int | None) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE stores
        SET status = 'closed', closed_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (user_id, store_id),
    )
    if cursor.rowcount == 0:
        conn.close()
        raise ArriendosOperationError("STORE_NOT_FOUND", "Tienda no encontrada", status_code=404)

    log_audit(
        cursor,
        store_id=store_id,
        user_id=user_id,
        action="store_closed",
        entity_type="store",
        entity_id=str(store_id),
        details={},
    )

    conn.commit()
    conn.close()


def log_audit(
    cursor: sqlite3.Cursor,
    store_id: int | None,
    user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict[str, Any],
) -> None:
    cursor.execute(
        """
        INSERT INTO arriendos_audit_log (
            store_id,
            user_id,
            action,
            entity_type,
            entity_id,
            details
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (store_id, user_id, action, entity_type, entity_id, _json(details)),
    )


def list_audit(store_id: int | None = None, limit: int = 100) -> list[dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    if store_id:
        cursor.execute(
            """
            SELECT a.id, a.store_id, a.user_id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.username
            FROM arriendos_audit_log a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE a.store_id = ?
            ORDER BY a.created_at DESC
            LIMIT ?
            """,
            (store_id, limit),
        )
    else:
        cursor.execute(
            """
            SELECT a.id, a.store_id, a.user_id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.username
            FROM arriendos_audit_log a
            LEFT JOIN users u ON u.id = a.user_id
            ORDER BY a.created_at DESC
            LIMIT ?
            """,
            (limit,),
        )
    rows = _dicts(cursor.fetchall())
    conn.close()
    return rows


def _has_overlap(
    cursor: sqlite3.Cursor,
    store_id: int,
    field_name: str,
    start_date: str,
    end_date: str,
    exclude_id: int | None = None,
) -> bool:
    query = """
        SELECT COUNT(*)
        FROM temporary_modifications
        WHERE store_id = ?
          AND field_name = ?
          AND is_active = 1
          AND NOT (end_date < ? OR start_date > ?)
    """
    params: list[Any] = [store_id, field_name, start_date, end_date]
    if exclude_id is not None:
        query += " AND id != ?"
        params.append(exclude_id)

    cursor.execute(query, params)
    return cursor.fetchone()[0] > 0


def create_temporary_modification(store_id: int, payload: dict[str, Any], user_id: int | None) -> int:
    start_date = _to_iso(payload.get("start_date"))
    end_date = _to_iso(payload.get("end_date"))
    field_name = (payload.get("field_name") or "").strip()

    if not start_date or not end_date or not field_name:
        raise ArriendosOperationError(
            "VALIDATION_ERROR",
            "start_date, end_date y field_name son obligatorios",
        )

    if start_date > end_date:
        raise ArriendosOperationError("VALIDATION_ERROR", "El rango de fechas es invalido")

    conn = get_db()
    cursor = conn.cursor()

    if _has_overlap(cursor, store_id, field_name, start_date, end_date):
        conn.close()
        raise ArriendosOperationError(
            "OVERLAP_TEMP_MODIFICATION",
            "Existe una modificacion temporal solapada para el mismo campo",
        )

    cursor.execute(
        """
        INSERT INTO temporary_modifications (
            store_id,
            contract_id,
            start_date,
            end_date,
            field_name,
            old_value,
            new_value,
            reason,
            is_active,
            created_by,
            updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            store_id,
            payload.get("contract_id"),
            start_date,
            end_date,
            field_name,
            str(payload.get("old_value") or ""),
            str(payload.get("new_value") or ""),
            payload.get("reason"),
            user_id,
            user_id,
        ),
    )
    mod_id = int(cursor.lastrowid)

    log_audit(
        cursor,
        store_id=store_id,
        user_id=user_id,
        action="temporary_modification_created",
        entity_type="temporary_modification",
        entity_id=str(mod_id),
        details={
            "field_name": field_name,
            "start_date": start_date,
            "end_date": end_date,
            "new_value": payload.get("new_value"),
        },
    )

    conn.commit()
    conn.close()
    return mod_id


def create_permanent_modification(store_id: int, payload: dict[str, Any], user_id: int | None) -> int:
    effective_date = _to_iso(payload.get("effective_date")) or date.today().isoformat()
    field_name = (payload.get("field_name") or "").strip()

    if not field_name:
        raise ArriendosOperationError("VALIDATION_ERROR", "field_name es obligatorio")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO permanent_modifications (
            store_id,
            contract_id,
            effective_date,
            field_name,
            old_value,
            new_value,
            reason,
            created_by,
            updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            store_id,
            payload.get("contract_id"),
            effective_date,
            field_name,
            str(payload.get("old_value") or ""),
            str(payload.get("new_value") or ""),
            payload.get("reason"),
            user_id,
            user_id,
        ),
    )
    mod_id = int(cursor.lastrowid)

    log_audit(
        cursor,
        store_id=store_id,
        user_id=user_id,
        action="permanent_modification_created",
        entity_type="permanent_modification",
        entity_id=str(mod_id),
        details={"field_name": field_name, "effective_date": effective_date},
    )

    conn.commit()
    conn.close()
    return mod_id


def delete_temporary_modification(store_id: int, modification_id: int, user_id: int | None) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE temporary_modifications
        SET is_active = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND store_id = ?
        """,
        (user_id, modification_id, store_id),
    )
    if cursor.rowcount == 0:
        conn.close()
        raise ArriendosOperationError(
            "MODIFICATION_NOT_FOUND",
            "Modificacion temporal no encontrada",
            status_code=404,
        )

    log_audit(
        cursor,
        store_id=store_id,
        user_id=user_id,
        action="temporary_modification_deactivated",
        entity_type="temporary_modification",
        entity_id=str(modification_id),
        details={},
    )

    conn.commit()
    conn.close()


def list_uf_values(limit: int = 120) -> list[dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT uf_date, value, source, created_at
        FROM uf_values
        ORDER BY uf_date DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = _dicts(cursor.fetchall())
    conn.close()
    return rows


def upsert_uf_value(uf_date: str, value: float, source: str, user_id: int | None = None) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO uf_values (uf_date, value, source, created_by, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(uf_date) DO UPDATE SET
            value = excluded.value,
            source = excluded.source,
            created_by = excluded.created_by,
            created_at = CURRENT_TIMESTAMP
        """,
        (uf_date, value, source, user_id),
    )
    conn.commit()
    conn.close()


def fetch_and_store_latest_uf(user_id: int | None = None) -> dict[str, Any]:
    today = date.today().isoformat()
    try:
        with urllib.request.urlopen("https://mindicador.cl/api/uf", timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))

        serie = payload.get("serie", [])
        if not serie:
            raise ArriendosOperationError("UF_FETCH_EMPTY", "La respuesta de UF no contiene datos", status_code=502)

        latest = serie[0]
        value = float(latest["valor"])
        uf_date = str(latest["fecha"])[:10]

        upsert_uf_value(uf_date=uf_date, value=value, source="mindicador.cl", user_id=user_id)
        return {"uf_date": uf_date, "value": value, "source": "mindicador.cl"}
    except urllib.error.URLError as exc:
        logger.warning("No fue posible obtener UF desde mindicador.cl: %s", exc)
        # Fallback: usa ultimo valor almacenado.
        values = list_uf_values(limit=1)
        if values:
            return values[0]
        raise ArriendosOperationError("UF_FETCH_FAILED", "No fue posible obtener UF", status_code=502) from exc
    except (KeyError, ValueError, TypeError) as exc:
        raise ArriendosOperationError("UF_PARSE_ERROR", "Respuesta UF invalida", status_code=502) from exc


def list_expiring_contracts(days: int | None = None) -> list[dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()

    if days is not None:
        target_date = date.today() + timedelta(days=days)
        cursor.execute(
            """
            SELECT
                s.id,
                s.store_code,
                s.name,
                s.notification_days,
                c.id AS contract_id,
                c.contract_start,
                c.contract_end,
                c.base_rent_uf
            FROM stores s
            INNER JOIN store_contracts c ON c.store_id = s.id AND c.is_active = 1
            WHERE s.status = 'active'
              AND c.contract_end IS NOT NULL
              AND DATE(c.contract_end) <= DATE(?)
            ORDER BY c.contract_end ASC
            """,
            (target_date.isoformat(),),
        )
    else:
        cursor.execute(
            """
            SELECT
                s.id,
                s.store_code,
                s.name,
                s.notification_days,
                c.id AS contract_id,
                c.contract_start,
                c.contract_end,
                c.base_rent_uf
            FROM stores s
            INNER JOIN store_contracts c ON c.store_id = s.id AND c.is_active = 1
            WHERE s.status = 'active'
              AND c.contract_end IS NOT NULL
              AND DATE(c.contract_end) <= DATE('now', '+' || s.notification_days || ' day')
            ORDER BY c.contract_end ASC
            """
        )

    rows = _dicts(cursor.fetchall())
    conn.close()
    return rows


def _normalize_columns(columns: list[str]) -> list[str]:
    return [str(c).strip().lower().replace(" ", "_") for c in columns]


def _rename_import_columns(df: pd.DataFrame) -> pd.DataFrame:
    aliases = {
        "tienda": "name",
        "sucursal": "name",
        "nombre": "name",
        "codigo": "store_code",
        "store_code": "store_code",
        "banner": "banner",
        "ciudad": "city",
        "region": "region",
        "direccion": "address",
        "superficie_m2": "surface_m2",
        "inicio_contrato": "contract_start",
        "fin_contrato": "contract_end",
        "arriendo_base_uf": "base_rent_uf",
        "arriendo_variable_pct": "variable_rent_pct",
        "ggcc_clp": "ggcc_clp",
        "fondo_promocion_pct": "promotion_fund_pct",
        "dias_notificacion": "notification_days",
        "estado": "status",
    }

    normalized = _normalize_columns(list(df.columns))
    mapping: dict[str, str] = {}
    for original, normalized_col in zip(df.columns, normalized):
        mapping[original] = aliases.get(normalized_col, normalized_col)

    return df.rename(columns=mapping)


def validate_import_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    df = _rename_import_columns(df)

    required = ["name", "contract_start", "base_rent_uf"]
    missing = [col for col in required if col not in df.columns]
    errors: list[str] = []

    if missing:
        errors.append(f"Faltan columnas obligatorias: {', '.join(missing)}")

    if "name" in df.columns:
        empty_names = df["name"].isna().sum()
        if empty_names:
            errors.append(f"Hay {int(empty_names)} filas sin nombre de tienda")

    if "contract_start" in df.columns:
        invalid_dates = 0
        for value in df["contract_start"].tolist():
            if pd.isna(value):
                invalid_dates += 1
                continue
            parsed = pd.to_datetime(value, errors="coerce")
            if pd.isna(parsed):
                invalid_dates += 1
        if invalid_dates:
            errors.append(f"Hay {invalid_dates} fechas de inicio invalidas")

    if "base_rent_uf" in df.columns:
        invalid_base = 0
        for value in df["base_rent_uf"].tolist():
            try:
                float(value)
            except (TypeError, ValueError):
                invalid_base += 1
        if invalid_base:
            errors.append(f"Hay {invalid_base} valores de arriendo base UF invalidos")

    return {
        "valid": not errors,
        "errors": errors,
        "rows": int(len(df.index)),
        "columns": list(df.columns),
    }


def process_import_dataframe(df: pd.DataFrame, user_id: int | None) -> dict[str, Any]:
    df = _rename_import_columns(df)
    report = validate_import_dataframe(df)
    if not report["valid"]:
        raise ArriendosOperationError("IMPORT_VALIDATION_ERROR", "; ".join(report["errors"]))

    created = 0
    updated = 0
    skipped = 0

    for _, row in df.iterrows():
        name = str(row.get("name") or "").strip()
        store_code = str(row.get("store_code") or "").strip() or None
        if not name:
            skipped += 1
            continue

        contract_start = pd.to_datetime(row.get("contract_start"), errors="coerce")
        contract_end = pd.to_datetime(row.get("contract_end"), errors="coerce")
        if pd.isna(contract_start):
            skipped += 1
            continue

        payload = {
            "store_code": store_code,
            "name": name,
            "banner": str(row.get("banner") or "").strip() or None,
            "city": str(row.get("city") or "").strip() or None,
            "region": str(row.get("region") or "").strip() or None,
            "address": str(row.get("address") or "").strip() or None,
            "surface_m2": _to_float(row.get("surface_m2")),
            "notification_days": _to_int(row.get("notification_days"), 90),
            "status": str(row.get("status") or "active").strip() or "active",
            "contract_start": contract_start.date().isoformat(),
            "contract_end": None if pd.isna(contract_end) else contract_end.date().isoformat(),
            "base_rent_uf": _to_float(row.get("base_rent_uf")),
            "variable_rent_pct": _to_float(row.get("variable_rent_pct")),
            "ggcc_clp": _to_float(row.get("ggcc_clp")),
            "promotion_fund_pct": _to_float(row.get("promotion_fund_pct")),
        }

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM stores WHERE name = ?",
            (name,),
        )
        store_row = cursor.fetchone()
        conn.close()

        if store_row:
            update_store(int(store_row[0]), payload, user_id)
            updated += 1
        else:
            create_store(payload, user_id)
            created += 1

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "rows": int(len(df.index)),
    }


def _ensure_backup_dir() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_obj:
        for chunk in iter(lambda: file_obj.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _create_sqlite_backup(source: Path, destination: Path) -> None:
    src_conn = sqlite3.connect(str(source))
    dst_conn = sqlite3.connect(str(destination))
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()


def _restore_sqlite_backup(source: Path, destination: Path) -> None:
    src_conn = sqlite3.connect(str(source))
    dst_conn = sqlite3.connect(str(destination))
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()


def create_backup(user_id: int | None, reason: str = "manual") -> dict[str, Any]:
    if not _BACKUP_LOCK.acquire(blocking=False):
        raise ArriendosOperationError(
            BACKUP_OPERATION_IN_PROGRESS,
            "Ya existe una operacion de backup en curso",
            status_code=503,
        )

    try:
        _ensure_backup_dir()
        now = datetime.now()
        backup_id = now.strftime("backup-%Y%m%d-%H%M%S")
        backup_file = BACKUP_DIR / f"{backup_id}.sqlite3"

        source_db = db_module.DB_PATH
        _create_sqlite_backup(source_db, backup_file)

        checksum = _sha256(backup_file)
        size_bytes = backup_file.stat().st_size

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM stores")
        store_count = int(cursor.fetchone()[0])

        cursor.execute(
            """
            INSERT INTO backup_metadata (
                id,
                file_path,
                checksum_sha256,
                size_bytes,
                store_count,
                created_by,
                created_at,
                reason
            )
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            """,
            (
                backup_id,
                str(backup_file),
                checksum,
                size_bytes,
                store_count,
                user_id,
                reason,
            ),
        )

        log_audit(
            cursor,
            store_id=None,
            user_id=user_id,
            action="backup_created",
            entity_type="backup",
            entity_id=backup_id,
            details={"size_bytes": size_bytes, "reason": reason},
        )

        conn.commit()
        conn.close()

        return {
            "id": backup_id,
            "file_path": str(backup_file),
            "checksum_sha256": checksum,
            "size_bytes": size_bytes,
            "store_count": store_count,
            "reason": reason,
            "created_at": now.isoformat(),
        }
    finally:
        _BACKUP_LOCK.release()


def list_backups() -> list[dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, file_path, checksum_sha256, size_bytes, store_count, created_by, created_at, reason
        FROM backup_metadata
        ORDER BY created_at DESC
        """
    )
    rows = _dicts(cursor.fetchall())
    conn.close()
    return rows


def restore_backup(backup_id: str, user_id: int | None) -> dict[str, Any]:
    if not _RESTORE_LOCK.acquire(blocking=False):
        raise ArriendosOperationError(
            RESTORE_IN_PROGRESS,
            "Ya existe una restauracion en curso",
            status_code=503,
        )

    try:
        backups = {item["id"]: item for item in list_backups()}
        metadata = backups.get(backup_id)
        if not metadata:
            raise ArriendosOperationError("BACKUP_NOT_FOUND", "Backup no encontrado", status_code=404)

        backup_path = Path(metadata["file_path"])
        if not backup_path.exists():
            raise ArriendosOperationError("BACKUP_FILE_MISSING", "Archivo de backup no encontrado", status_code=404)

        # Backup preventivo antes del restore.
        pre_restore = create_backup(user_id=user_id, reason=f"pre_restore:{backup_id}")
        _restore_sqlite_backup(backup_path, db_module.DB_PATH)

        conn = get_db()
        cursor = conn.cursor()
        log_audit(
            cursor,
            store_id=None,
            user_id=user_id,
            action="backup_restored",
            entity_type="backup",
            entity_id=backup_id,
            details={"pre_restore_backup_id": pre_restore["id"]},
        )
        conn.commit()
        conn.close()

        return {
            "restored_backup_id": backup_id,
            "pre_restore_backup_id": pre_restore["id"],
        }
    finally:
        _RESTORE_LOCK.release()


def delete_backup(backup_id: str, user_id: int | None) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT file_path FROM backup_metadata WHERE id = ?",
        (backup_id,),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ArriendosOperationError("BACKUP_NOT_FOUND", "Backup no encontrado", status_code=404)

    path = Path(row[0])
    if path.exists():
        path.unlink()

    cursor.execute("DELETE FROM backup_metadata WHERE id = ?", (backup_id,))

    log_audit(
        cursor,
        store_id=None,
        user_id=user_id,
        action="backup_deleted",
        entity_type="backup",
        entity_id=backup_id,
        details={},
    )

    conn.commit()
    conn.close()


def revert_expired_temporary_modifications(user_id: int | None) -> dict[str, Any]:
    today = date.today().isoformat()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, store_id
        FROM temporary_modifications
        WHERE is_active = 1
          AND end_date IS NOT NULL
          AND DATE(end_date) < DATE(?)
        """,
        (today,),
    )
    rows = cursor.fetchall()

    reverted = 0
    for row in rows:
        mod_id = int(row[0])
        store_id = int(row[1])
        cursor.execute(
            """
            UPDATE temporary_modifications
            SET is_active = 0,
                updated_by = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (user_id, mod_id),
        )
        log_audit(
            cursor,
            store_id=store_id,
            user_id=user_id,
            action="temporary_modification_auto_reverted",
            entity_type="temporary_modification",
            entity_id=str(mod_id),
            details={"reason": "expired"},
        )
        reverted += 1

    conn.commit()
    conn.close()

    return {"reverted": reverted, "date": today}


def load_excel_from_upload(file_storage: Any) -> pd.DataFrame:
    if file_storage is None:
        raise ArriendosOperationError("IMPORT_FILE_REQUIRED", "Debes subir un archivo")

    filename = (getattr(file_storage, "filename", "") or "").lower()
    if not filename.endswith((".xlsx", ".xls", ".xlsm")):
        raise ArriendosOperationError("IMPORT_FILE_INVALID", "El archivo debe ser Excel (.xlsx/.xls)")

    try:
        return pd.read_excel(file_storage)
    except Exception as exc:  # pragma: no cover - pandas usa excepciones variadas.
        raise ArriendosOperationError("IMPORT_READ_ERROR", f"No se pudo leer el archivo: {exc}") from exc
