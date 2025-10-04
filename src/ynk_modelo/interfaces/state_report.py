"""HTML report generation helpers."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from ynk_modelo.config import (
    BUDGET_SCENARIO,
    EERR_TEMPLATE,
    METRIC_CONFIG,
    REAL_SCENARIO,
    ROLE_MAP,
)
from ynk_modelo.domain.eerr import build_store_base, formatear_tabla

def _prepare_store_data(
    eerr: pd.DataFrame,
) -> tuple[dict[str, dict[str, object]], dict[str, list[str]], dict[str, dict[str, object]]]:
    """Agrupa la información del EERR por sucursal y banner para la interfaz web."""
    metric_ids = [clave for clave, _, _ in METRIC_CONFIG]
    data: dict[str, dict[str, object]] = {}
    base, es_diciembre, uf_vigente = build_store_base()
    base_idx = base.set_index("Sucursal", drop=False)
    banner_map: dict[str, list[str]] = {}
    banner_summary: dict[str, dict[str, object]] = {}

    if eerr.empty:
        return data, banner_map, banner_summary

    for (sucursal, banner), grupo in eerr.groupby(["Sucursal", "Banner"], dropna=False):
        grupo = grupo.sort_values("Mes")
        valores = {metric: {} for metric in metric_ids}
        scenario_values: dict[str, dict[str, dict[str, float | None]]]
        scenario_values = {
            REAL_SCENARIO: {metric: {} for metric in metric_ids},
            BUDGET_SCENARIO: {metric: {} for metric in metric_ids},
        }
        ebitda_por_mes: dict[str, float] = {}
        meses: list[str] = []
        vistos: set[str] = set()
        month_types: dict[str, str] = {}

        for _, fila in grupo.sort_values("Mes").iterrows():
            mes_clave = fila["Mes"].strftime("%Y-%m")
            es_presupuesto = bool(fila.get("Es_presupuesto"))
            etiqueta_mes = BUDGET_SCENARIO if es_presupuesto else REAL_SCENARIO
            if mes_clave not in vistos:
                meses.append(mes_clave)
                vistos.add(mes_clave)
                month_types[mes_clave] = etiqueta_mes
            elif month_types.get(mes_clave) != REAL_SCENARIO and not es_presupuesto:
                month_types[mes_clave] = REAL_SCENARIO

            scenario_key = BUDGET_SCENARIO if es_presupuesto else REAL_SCENARIO

            for metric in metric_ids:
                valor = fila.get(metric)
                if pd.isna(valor):
                    valores[metric][mes_clave] = None
                    scenario_values[scenario_key][metric][mes_clave] = None
                else:
                    valores[metric][mes_clave] = float(valor)
                    scenario_values[scenario_key][metric][mes_clave] = float(valor)
            valor_ebitda = fila.get("EBITDA")
            ebitda_por_mes[mes_clave] = 0.0 if pd.isna(valor_ebitda) else float(valor_ebitda)

        estructura: dict[str, float] | None = None
        rangos: dict[str, float] | None = None
        umbral_variable: float | None = None
        arriendo_vmm_uf = float('nan')
        arriendo_porcentual = float('nan')
        if str(sucursal) in base_idx.index:
            fila_base = base_idx.loc[str(sucursal)]
            if isinstance(fila_base, pd.DataFrame):
                fila_base = fila_base.iloc[0]

            factor_aplicado = float(fila_base.get("Arriendo_factor", 1.0)) if es_diciembre else 1.0
            arriendo_minimo = float(fila_base.get("Arriendo_vmm_uf", 0.0)) * uf_vigente * factor_aplicado
            arriendo_vmm_uf = float(fila_base.get("Arriendo_vmm_uf", 0.0))
            arriendo_porcentual = float(fila_base.get("Arriendo_porcentual", 0.0))
            dotacion_total = float(fila_base.get("Dotacion_total", 0.0))
            dotacion_detalle = fila_base.get("Dotacion_detalle", {})
            if not isinstance(dotacion_detalle, dict):
                dotacion_detalle = {}
            vendedores = float(fila_base.get("Vendedores_comision", 0.0))
            tasa_sumada = float(fila_base.get("Tasa_comision_sumada", 0.0))
            tasa_por_vendedor = tasa_sumada / vendedores if vendedores > 0 else 0.0

            estructura = {
                "dotacion_fijo": float(fila_base.get("Costo_dotacion_fijo", 0.0)),
                "tasa_por_vendedor": tasa_por_vendedor,
                "tasa_total_ventas": float(fila_base.get("Tasa_total_ventas", 0.0)),
                "otros_costos_rate": float(fila_base.get("Total otros costos", 0.0)),
                "arriendo_minimo": arriendo_minimo,
                "arriendo_porcentual": arriendo_porcentual,
                "fondo_promocion_pct": float(fila_base.get("Arriendo_fondo_promocion_pct", 0.0)),
                "arriendo_ggcc": float(fila_base.get("Arriendo_GGCC", 0.0)),
            }
            if estructura["arriendo_porcentual"] > 0:
                umbral_variable = estructura["arriendo_minimo"] / estructura["arriendo_porcentual"]

            venta_min = float(fila_base.get("Venta_min", 0.0))
            venta_max = float(fila_base.get("Venta_max", 0.0))
            venta_prom = float(fila_base.get("Venta_promedio", 0.0))
            if venta_max <= 0 and venta_prom > 0:
                venta_min = max(0.0, venta_prom * 0.7)
                venta_max = venta_prom * 1.3
            if venta_max <= 0:
                venta_min, venta_max = 5_000_000.0, 15_000_000.0
            if abs(venta_max - venta_min) < 1e-6:
                delta = max(venta_min * 0.25, 500_000.0)
                venta_min = max(0.0, venta_min - delta)
                venta_max = venta_max + delta

            venta_min = max(0.0, venta_min * 0.80)
            if venta_max < venta_min:
                venta_max = venta_min + max(venta_min * 0.25, 500_000.0)

            margen_min = fila_base.get("Margen_min", float("nan"))
            margen_max = fila_base.get("Margen_max", float("nan"))
            if pd.isna(margen_min) or pd.isna(margen_max):
                margen_min = 0.25
                margen_max = 0.45
            margen_min = float(margen_min)
            margen_max = float(margen_max)
            if margen_max < margen_min:
                margen_min, margen_max = margen_max, margen_min
            padding = 0.05
            margen_min = max(0.0, margen_min - padding)
            margen_max = min(0.9, margen_max + padding)
            if margen_max - margen_min <= 0.005:
                margen_min = max(0.0, margen_min - 0.05)
                margen_max = min(0.9, margen_min + 0.30)

            rango_venta = max(venta_max - venta_min, 1_000_000.0)
            default_delta_venta = max(500_000.0, rango_venta / 12)
            default_delta_margen = 0.01

            rangos = {
                "sales_min": venta_min,
                "sales_max": venta_max,
                "margin_min": margen_min,
                "margin_max": margen_max,
                "default_sale_step": default_delta_venta,
                "default_margin_step": default_delta_margen,
            }

        sucursal_key = str(sucursal)
        banner_key = str(banner) if pd.notna(banner) else "Sin banner"

        data[sucursal_key] = {
            "banner": None if pd.isna(banner) else str(banner),
            "months": meses,
            "values": valores,
            "scenarios": scenario_values,
            "month_types": month_types,
            "heatmap": {
                "structure": estructura,
                "range": rangos,
                "rent_threshold": umbral_variable,
            },
            "ebitda": ebitda_por_mes,
            "rent_details": {
                "threshold_clp": umbral_variable,
                "vmm_uf": arriendo_vmm_uf,
                "percent": arriendo_porcentual,
                "fondo_promocion": float(fila_base.get("Arriendo_fondo_promocion_pct", 0.0)),
                "dotacion_total": dotacion_total,
                "dotacion_detalle": dotacion_detalle,
            },
        }

        banner_map.setdefault(banner_key, []).append(sucursal_key)
        resumen_banner = banner_summary.setdefault(
            banner_key,
            {"months": set(), "stores": {}, "types": {}},
        )
        resumen_banner["stores"][sucursal_key] = ebitda_por_mes
        resumen_banner["months"].update(ebitda_por_mes.keys())
        tipos_banner = resumen_banner["types"]
        for mes_clave, escenario_mes in month_types.items():
            if escenario_mes == REAL_SCENARIO:
                tipos_banner[mes_clave] = REAL_SCENARIO
            else:
                tipos_banner.setdefault(mes_clave, BUDGET_SCENARIO)

    banner_map = {banner: sorted(sucursales) for banner, sucursales in banner_map.items()}

    banner_summary_final: dict[str, dict[str, object]] = {}
    for banner_key, info in banner_summary.items():
        months_sorted = sorted(info["months"])
        stores_info: dict[str, dict[str, float]] = {}
        for sucursal_key, valores in info["stores"].items():
            stores_info[sucursal_key] = {
                mes: float(valores.get(mes, 0.0) or 0.0)
                for mes in months_sorted
            }
        banner_summary_final[banner_key] = {
            "months": months_sorted,
            "stores": stores_info,
            "month_types": {
                mes: info["types"].get(mes, REAL_SCENARIO)
                for mes in months_sorted
            },
        }

    return data, banner_map, banner_summary_final

def build_html_interface(
    eerr: pd.DataFrame,
    output: Path,
    store_data: dict[str, dict[str, object]] | None = None,
    banner_map: dict[str, list[str]] | None = None,
    banner_summary: dict[str, dict[str, object]] | None = None,
) -> tuple[
    dict[str, dict[str, object]],
    dict[str, list[str]],
    dict[str, dict[str, object]],
]:
    """Genera un archivo HTML con la interfaz para explorar los resultados."""
    metric_config_json = json.dumps(
        [
            {"id": clave, "label": etiqueta, "format": formato}
            for clave, etiqueta, formato in METRIC_CONFIG
        ],
        ensure_ascii=False,
    )
    if store_data is None or banner_map is None or banner_summary is None:
        store_data, banner_map, banner_summary = _prepare_store_data(eerr)
    store_data_json = json.dumps(store_data, ensure_ascii=False)
    banner_map_json = json.dumps(banner_map, ensure_ascii=False)
    banner_summary_json = json.dumps(banner_summary, ensure_ascii=False)
    staff_roles = sorted(set(ROLE_MAP.values()))
    staff_roles_json = json.dumps(staff_roles, ensure_ascii=False)

    template_path = EERR_TEMPLATE
    if not template_path.exists():
        raise FileNotFoundError(
            f"No se encontró la plantilla de EERR en {template_path}."
        )

    template = template_path.read_text(encoding="utf-8")
    replacements = {
        "__METRIC_CONFIG__": metric_config_json,
        "__STORE_DATA__": store_data_json,
        "__BANNER_MAP__": banner_map_json,
        "__BANNER_SUMMARY__": banner_summary_json,
        "__STAFF_ROLES__": staff_roles_json,
        "__SCENARIO_REAL__": REAL_SCENARIO,
        "__SCENARIO_BUDGET__": BUDGET_SCENARIO,
    }
    for marker, value in replacements.items():
        template = template.replace(marker, str(value))

    output.write_text(template, encoding="utf-8")
    return store_data, banner_map, banner_summary

def mostrar_selector(eerr: pd.DataFrame) -> None:
    """Permite elegir una sucursal y mostrar su EERR mensual."""
    sucursales = sorted(eerr["Sucursal"].unique())
    if not sucursales:
        print("No hay sucursales para mostrar.")
        return

    indice = {str(idx): nombre for idx, nombre in enumerate(sucursales, start=1)}

    print("\nSelecciona la sucursal para desplegar su EERR:")
    for idx, nombre in indice.items():
        print(f" {idx}. {nombre}")

    seleccion = None
    while not seleccion:
        opcion = input("Ingresa número o nombre (ENTER para salir): ").strip()
        if not opcion:
            return
        if opcion in indice:
            seleccion = indice[opcion]
        elif opcion in sucursales:
            seleccion = opcion
        else:
            print("Opción no válida, intenta nuevamente.")

    mostrar_eerr_sucursal(eerr, seleccion)

def mostrar_eerr_sucursal(eerr: pd.DataFrame, sucursal: str) -> None:
    """Imprime el EERR mensual de la sucursal indicada."""
    detalle = (
        eerr[eerr["Sucursal"] == sucursal]
        .sort_values("Mes")
        .reset_index(drop=True)
    )

    if detalle.empty:
        print(f"No se encontró información para '{sucursal}'.")
        return

    columnas_metricas = [
        "Venta",
        "Costo_de_venta",
        "Contribucion",
        "Margen_contribucion",
        "Arriendo_fijo",
        "Arriendo_variable",
        "Arriendo_fondo_promocion",
        "Arriendo_GGCC",
        "Arriendo_total",
        "Remuneraciones_fijo",
        "Remuneraciones_comisiones",
        "Remuneraciones_total",
        "Otros_costos",
        "Gastos_operacionales",
        "EBITDA",
        "Margen_EBITDA",
    ]

    vista = (
        detalle.set_index("Mes")[columnas_metricas]
        .sort_index()
        .T
    )
    vista.columns = [col.strftime("%Y-%m") for col in vista.columns]
    vista.index.name = "Cuenta"
    vista = vista.rename(
        index={
            "Venta": "Venta",
            "Costo_de_venta": "Costo de venta",
            "Contribucion": "Contribución",
            "Margen_contribucion": "Margen contribución (%)",
            "Arriendo_fijo": "Arriendo fijo",
            "Arriendo_variable": "Arriendo variable",
            "Arriendo_fondo_promocion": "Arriendo fondo promoción",
            "Arriendo_GGCC": "Arriendo GGCC",
            "Arriendo_total": "Arriendo total",
            "Remuneraciones_fijo": "Remuneraciones fijo",
            "Remuneraciones_comisiones": "Remuneraciones comisiones",
            "Remuneraciones_total": "Remuneraciones total",
            "Otros_costos": "Otros costos",
            "Gastos_operacionales": "Gastos operacionales",
            "EBITDA": "EBITDA",
            "Margen_EBITDA": "Margen EBITDA (%)",
        }
    )

    print(f"\nEERR mensual para: {sucursal}")
    print("")
    print(formatear_tabla(vista))

