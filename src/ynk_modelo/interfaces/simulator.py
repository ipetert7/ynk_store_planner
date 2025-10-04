"""Simulador HTML helpers."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from ynk_modelo.config import METRIC_CONFIG, SIMULATOR_TEMPLATE


def build_simulator_interface(
    store_data: dict[str, dict[str, object]],
    base: pd.DataFrame,
    role_costs: dict[str, dict[str, float]],
    total_sales_commissions: list[str],
    excluded_roles: list[str],
    staff_roles: list[str],
    uf_vigente: float,
    output: Path,
) -> None:
    """Actualiza el Simulador de EERR inyectando los datos calculados."""

    metric_config_json = json.dumps(
        [
            {"id": clave, "label": etiqueta, "format": formato}
            for clave, etiqueta, formato in METRIC_CONFIG
        ],
        ensure_ascii=False,
    )
    role_costs_json = json.dumps(role_costs, ensure_ascii=False)
    staff_roles_json = json.dumps(staff_roles, ensure_ascii=False)
    total_sales_commissions_json = json.dumps(total_sales_commissions, ensure_ascii=False)
    excluded_roles_json = json.dumps(excluded_roles, ensure_ascii=False)

    base_idx = base.set_index("Sucursal", drop=False)
    store_config: dict[str, dict[str, object]] = {}
    current_year = int(pd.Timestamp.today().year)

    for store_key, info in store_data.items():
        if store_key not in base_idx.index:
            continue
        fila = base_idx.loc[store_key]
        if isinstance(fila, pd.DataFrame):
            fila = fila.iloc[0]

        meses = [str(mes) for mes in info.get("months", []) if mes]
        if not meses:
            meses = [f"{current_year}-{mes:02d}" for mes in range(1, 13)]

        valores = info.get("values", {}) if isinstance(info, dict) else {}
        ventas_valores = valores.get("Venta", {}) if isinstance(valores, dict) else {}
        margen_valores = valores.get("Margen_contribucion", {}) if isinstance(valores, dict) else {}

        default_ventas: dict[str, float | None] = {}
        default_margenes: dict[str, float | None] = {}
        for mes in meses:
            venta = ventas_valores.get(mes)
            default_ventas[mes] = None if venta is None else float(venta)
            margen = margen_valores.get(mes)
            default_margenes[mes] = None if margen is None else float(margen)

        detalle_dotacion = fila.get("Dotacion_detalle", {})
        if not isinstance(detalle_dotacion, dict):
            detalle_dotacion = {}
        staff_counts = {
            rol: float(detalle_dotacion.get(rol, 0.0) or 0.0)
            for rol in staff_roles
        }

        banner_value = info.get("banner")
        banner_label = "Sin banner" if not banner_value else str(banner_value)

        store_config[store_key] = {
            "banner": banner_label,
            "months": meses,
            "sales": default_ventas,
            "margins": default_margenes,
            "staff": staff_counts,
            "rent": {
                "vmm_uf": float(fila.get("Arriendo_vmm_uf", 0.0) or 0.0),
                "percent": float(fila.get("Arriendo_porcentual", 0.0) or 0.0),
                "ggcc": float(fila.get("Arriendo_GGCC", 0.0) or 0.0),
                "fondo_promocion": float(fila.get("Arriendo_fondo_promocion_pct", 0.0) or 0.0),
                "uf_value": float(uf_vigente or 0.0),
            },
            "others_rate": float(fila.get("Total otros costos", 0.0) or 0.0),
        }

    store_config_json = json.dumps(store_config, ensure_ascii=False)
    default_uf_json = json.dumps(float(uf_vigente or 0.0))

    if not SIMULATOR_TEMPLATE.exists():
        raise FileNotFoundError(
            f"No se encontró la plantilla del simulador en {SIMULATOR_TEMPLATE}."
        )

    template = SIMULATOR_TEMPLATE.read_text(encoding="utf-8")
    replacements = {
        "__METRIC_CONFIG__": metric_config_json,
        "__STORE_CONFIG__": store_config_json,
        "__ROLE_COSTS__": role_costs_json,
        "__STAFF_ROLES__": staff_roles_json,
        "__COMMISSION_ROLES__": json.dumps(
            [
                rol
                for rol in ("Jefe", "Sub jefe", "Fulltime", "Part Time 30", "Part Time 20")
                if rol in staff_roles
            ],
            ensure_ascii=False,
        ),
        "__NON_COMMISSION_ROLES__": json.dumps(
            [rol for rol in staff_roles if rol not in {"Jefe", "Sub jefe", "Fulltime", "Part Time 30", "Part Time 20"}],
            ensure_ascii=False,
        ),
        "__TOTAL_SALES_COMMISSIONS__": total_sales_commissions_json,
        "__EXCLUDED_COMMISSION_ROLES__": excluded_roles_json,
        "__DEFAULT_UF__": default_uf_json,
    }

    rendered = template
    for marker, value in replacements.items():
        rendered = rendered.replace(marker, str(value))

    output.write_text(rendered, encoding="utf-8")
