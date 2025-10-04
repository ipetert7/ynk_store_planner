"""Core calculations for EERR and store-level summaries."""
from __future__ import annotations

import math
from typing import Iterable

import pandas as pd

from ynk_modelo.config import (
    BUDGET_SCENARIO,
    METRIC_CONFIG,
    REAL_SCENARIO,
)
from ynk_modelo.domain.uf import latest_uf_value, uf_promedio_mensual
from ynk_modelo.io.excel import (
    get_role_cost_metadata,
    load_contribution,
    load_dictionary,
    load_other_costs,
    load_rent,
    load_sales,
    load_staff_costs,
)


MetricColumns = list[str]


def build_store_base() -> tuple[pd.DataFrame, bool, float]:
    """Devuelve la base de costos por sucursal junto a UF y si aplicar factor de diciembre."""
    diccionario = load_dictionary()[["Sucursal", "Banner"]].drop_duplicates()
    staff = load_staff_costs()
    arriendo = load_rent()
    otros = load_other_costs()
    ventas = load_sales()
    contribucion = load_contribution()

    base = (
        diccionario.merge(staff, how="left", on="Sucursal")
        .merge(arriendo, how="left", on="Sucursal")
        .merge(otros, how="left", on="Banner")
    )

    if contribucion.empty:
        rangos = pd.DataFrame(columns=["Sucursal", "Margen_min", "Margen_max"])
    else:
        rangos = (
            contribucion.dropna(subset=["Margen_pct"])
            .groupby("Sucursal")["Margen_pct"]
            .agg(Margen_min="min", Margen_max="max")
            .reset_index()
        )

    base = base.merge(rangos, how="left", on="Sucursal")

    if ventas.empty:
        ventas_stats = pd.DataFrame(columns=["Sucursal", "Venta_min", "Venta_max", "Venta_promedio"])
    else:
        ventas_stats = (
            ventas.groupby("Sucursal")["Ventas"]
            .agg(Venta_min="min", Venta_max="max", Venta_promedio="mean")
            .reset_index()
        )

    base = base.merge(ventas_stats, how="left", on="Sucursal")

    fill_defaults = {
        "Costo_dotacion_fijo": 0.0,
        "Vendedores_comision": 0.0,
        "Tasa_comision_sumada": 0.0,
        "Tasa_total_ventas": 0.0,
        "Arriendo_vmm_uf": 0.0,
        "Arriendo_porcentual": 0.0,
        "Arriendo_fondo_promocion_pct": 0.0,
        "Arriendo_factor": 1.0,
        "Arriendo_GGCC": 0.0,
        "Total otros costos": 0.0,
        "Venta_min": 0.0,
        "Venta_max": 0.0,
        "Venta_promedio": 0.0,
        "Dotacion_total": 0.0,
    }
    for columna, valor in fill_defaults.items():
        if columna in base.columns:
            base[columna] = base[columna].fillna(valor)

    if "Dotacion_detalle" in base.columns:
        base["Dotacion_detalle"] = base["Dotacion_detalle"].apply(
            lambda x: x if isinstance(x, dict) else {}
        )
    else:
        base["Dotacion_detalle"] = [{} for _ in range(len(base))]

    mes_referencia = None if ventas.empty else ventas["Mes"].max()
    es_diciembre = mes_referencia is not None and getattr(mes_referencia, "month", None) == 12
    uf_vigente = latest_uf_value()

    return base, es_diciembre, uf_vigente


def build_break_even_table() -> pd.DataFrame:
    """Calcula la venta necesaria para que el EBITDA sea 0 en cada sucursal."""
    base, es_diciembre, uf_vigente = build_store_base()

    mascarilla = base["Vendedores_comision"] > 0
    base["Tasa_comision_vendedores"] = 0.0
    base.loc[mascarilla, "Tasa_comision_vendedores"] = (
        base.loc[mascarilla, "Tasa_comision_sumada"]
        / base.loc[mascarilla, "Vendedores_comision"]
    )
    base["Tasa_variable_total"] = (
        base["Tasa_comision_vendedores"]
        + base["Tasa_total_ventas"]
        + base["Total otros costos"]
    )

    resultados: list[dict[str, float | str]] = []
    for _, fila in base.iterrows():
        factor_aplicado = fila["Arriendo_factor"] if es_diciembre else 1.0
        arriendo_minimo_clp = fila["Arriendo_vmm_uf"] * uf_vigente * factor_aplicado
        arriendo_porcentual = fila["Arriendo_porcentual"]
        arriendo_ggcc = fila["Arriendo_GGCC"]
        fondo_promocion_pct = float(fila.get("Arriendo_fondo_promocion_pct", 0.0) or 0.0)
        dotacion_fijo = fila["Costo_dotacion_fijo"]
        tasa_variable = fila["Tasa_variable_total"]

        margen_min = fila.get("Margen_min", float("nan"))
        margen_max = fila.get("Margen_max", float("nan"))
        if pd.isna(margen_min) or pd.isna(margen_max):
            limite_inferior = 0.05
            limite_superior = 0.80
        else:
            limite_inferior = max(0.0, margen_min - 0.10)
            limite_superior = min(1.0, margen_max + 0.10)
            if limite_superior < limite_inferior:
                limite_inferior, limite_superior = limite_superior, limite_inferior

        inicio_paso = max(0, math.floor(limite_inferior * 1000))
        fin_paso = min(1000, math.ceil(limite_superior * 1000))
        if fin_paso < inicio_paso:
            fin_paso = inicio_paso

        umbral_variable = (
            arriendo_minimo_clp / arriendo_porcentual
            if arriendo_porcentual > 0
            else float("inf")
        )

        for paso in range(inicio_paso, fin_paso + 1):
            margen_decimal = paso / 1000
            margen_pct = margen_decimal * 100

            venta_requerida = float("nan")

            denom_minimo = margen_decimal - tasa_variable
            if denom_minimo > 0:
                numerador_minimo = (
                    dotacion_fijo
                    + arriendo_minimo_clp * (1 + fondo_promocion_pct)
                    + arriendo_ggcc
                )
                venta_posible = numerador_minimo / denom_minimo
                if arriendo_porcentual == 0 or venta_posible <= umbral_variable * (1 + 1e-9):
                    venta_requerida = venta_posible

            if arriendo_porcentual > 0:
                tasa_arriendo_variable = arriendo_porcentual * (1 + fondo_promocion_pct)
                denom_variable = margen_decimal - tasa_variable - tasa_arriendo_variable
                if denom_variable > 0:
                    numerador_variable = dotacion_fijo + arriendo_ggcc
                    venta_variable = numerador_variable / denom_variable
                    if venta_variable >= umbral_variable * (1 - 1e-9):
                        if pd.isna(venta_requerida):
                            venta_requerida = venta_variable
                        else:
                            venta_requerida = min(venta_requerida, venta_variable)

            if pd.notna(venta_requerida) and venta_requerida < 0:
                venta_requerida = float("nan")

            resultados.append(
                {
                    "Sucursal": fila["Sucursal"],
                    "Margen_contribucion": margen_pct,
                    "Venta_necesaria": venta_requerida,
                }
            )

    return pd.DataFrame(resultados)


def _append_missing_months(
    eerr: pd.DataFrame,
    metric_columns: MetricColumns,
    scenario_column: str | None = None,
) -> pd.DataFrame:
    """Completa con filas vacías los meses faltantes hasta diciembre por año."""
    if eerr.empty:
        return eerr

    work = eerr.copy()
    work["_year"] = work["Mes"].dt.year.astype(int)
    work["_month"] = work["Mes"].dt.month.astype(int)

    grouping_columns = ["Sucursal", "_year"]
    key_columns = ["Sucursal", "_year", "_month"]
    if scenario_column and scenario_column in work.columns:
        grouping_columns.insert(1, scenario_column)
        key_columns.insert(1, scenario_column)

    existing = {
        tuple(values)
        for values in work[key_columns].itertuples(index=False, name=None)
    }

    missing_rows: list[dict[str, object]] = []
    for keys, grupo in work.groupby(grouping_columns, dropna=False):
        if grupo.empty:
            continue

        if not isinstance(keys, tuple):
            keys = (keys,)
        key_map = {col: val for col, val in zip(grouping_columns, keys)}
        banner = grupo["Banner"].iloc[0] if "Banner" in grupo else pd.NA
        scenario_value = key_map.get(scenario_column)
        months_present = sorted(set(grupo["Mes"].dt.month.astype(int)))
        if not months_present:
            continue

        min_month = months_present[0]
        max_month = months_present[-1]

        missing_between = [
            mes
            for mes in range(min_month, max_month)
            if mes not in months_present
        ]
        missing_after = [mes for mes in range(max_month + 1, 13)]
        for mes in missing_between + missing_after:
            key_items = [key_map.get("Sucursal"), key_map.get("_year"), mes]
            if scenario_column and scenario_column in key_map:
                key_items.insert(1, key_map[scenario_column])
            key = tuple(key_items)
            if key in existing:
                continue
            registro = {
                "Sucursal": key_map.get("Sucursal"),
                "Banner": banner,
                "Mes": pd.Timestamp(year=int(key_map.get("_year", 0)), month=int(mes), day=1),
            }
            if scenario_column and scenario_column in work.columns:
                registro[scenario_column] = scenario_value
            for columna in metric_columns:
                registro[columna] = float("nan")
            missing_rows.append(registro)
            existing.add(key)

    work = work.drop(columns=["_year", "_month"], errors="ignore")
    if missing_rows:
        extras = pd.DataFrame(missing_rows)
        work = pd.concat([work, extras], ignore_index=True, sort=False)
    return work


def build_eerr() -> pd.DataFrame:
    """Arma el estado de resultados mensual por tienda."""
    ventas = load_sales()
    contrib = load_contribution()
    staff = load_staff_costs()
    arriendo = load_rent()
    otros = load_other_costs()
    diccionario = load_dictionary()

    merge_keys = ["Sucursal", "Mes", "Escenario"]
    eerr = ventas.merge(contrib, how="left", on=merge_keys)
    eerr = eerr.merge(diccionario, how="left", on="Sucursal")
    eerr = eerr.merge(staff, how="left", on="Sucursal")
    eerr = eerr.merge(arriendo, how="left", on="Sucursal")
    eerr = eerr.merge(otros, how="left", on="Banner")

    fill_zero = {
        "Margen_pct": 0,
        "Costo_dotacion_fijo": 0,
        "Vendedores_comision": 0,
        "Tasa_comision_sumada": 0,
        "Tasa_total_ventas": 0,
        "Arriendo_vmm_uf": 0,
        "Arriendo_porcentual": 0,
        "Arriendo_fondo_promocion_pct": 0,
        "Arriendo_factor": 1,
        "Arriendo_GGCC": 0,
        "Total otros costos": 0,
    }
    for columna, valor in fill_zero.items():
        if columna in eerr.columns:
            eerr[columna] = eerr[columna].fillna(valor)

    eerr["Margen_contribucion"] = eerr["Ventas"] * eerr["Margen_pct"]
    eerr["Costo_venta"] = eerr["Ventas"] - eerr["Margen_contribucion"]

    uf_promedios = uf_promedio_mensual(eerr["Mes"])
    eerr["UF_promedio"] = eerr["Mes"].map(uf_promedios)

    factores_diciembre = eerr["Mes"].dt.month.eq(12)
    factor_aplicable = eerr["Arriendo_factor"].where(factores_diciembre, 1)

    arriendo_minimo_clp = eerr["Arriendo_vmm_uf"] * eerr["UF_promedio"] * factor_aplicable
    monto_porcentual = eerr["Ventas"] * eerr["Arriendo_porcentual"]
    arriendo_base = pd.concat([monto_porcentual, arriendo_minimo_clp], axis=1).max(axis=1)
    arriendo_variable = (arriendo_base - arriendo_minimo_clp).clip(lower=0)
    arriendo_fijo = arriendo_base - arriendo_variable
    arriendo_fondo_promocion = (arriendo_fijo + arriendo_variable) * eerr["Arriendo_fondo_promocion_pct"]

    eerr["Arriendo_fijo"] = arriendo_fijo
    eerr["Arriendo_variable"] = arriendo_variable
    eerr["Arriendo_fondo_promocion"] = arriendo_fondo_promocion
    eerr["Arriendo_total"] = arriendo_fijo + arriendo_variable + arriendo_fondo_promocion + eerr["Arriendo_GGCC"]
    eerr["Otros_costos"] = eerr["Ventas"] * eerr["Total otros costos"]

    eerr["Comisiones_variables"] = 0.0
    mask_vendedores = (eerr["Vendedores_comision"] > 0) & (eerr["Ventas"] > 0)
    eerr.loc[mask_vendedores, "Comisiones_variables"] = (
        eerr.loc[mask_vendedores, "Ventas"]
        / eerr.loc[mask_vendedores, "Vendedores_comision"]
        * eerr.loc[mask_vendedores, "Tasa_comision_sumada"]
    )
    eerr["Comisiones_variables"] += eerr["Ventas"] * eerr["Tasa_total_ventas"]
    eerr["Costo_dotacion"] = eerr["Costo_dotacion_fijo"] + eerr["Comisiones_variables"]

    eerr["Gasto_operacional"] = eerr["Costo_dotacion"] + eerr["Arriendo_total"] + eerr["Otros_costos"]
    eerr["EBITDA"] = eerr["Margen_contribucion"] - eerr["Gasto_operacional"]
    eerr["Margen_EBITDA"] = (
        eerr["EBITDA"].where(eerr["Ventas"] != 0, 0)
        / eerr["Ventas"].where(eerr["Ventas"] != 0, 1)
        * 100
    )

    eerr["Contribucion"] = eerr["Margen_contribucion"]
    eerr["Margen_contribucion_pct"] = eerr["Margen_pct"] * 100
    eerr["Remuneraciones_fijo"] = eerr["Costo_dotacion_fijo"]
    eerr["Remuneraciones_comisiones"] = eerr["Comisiones_variables"]
    eerr["Remuneraciones_total"] = eerr["Costo_dotacion"]
    eerr["Gastos_operacionales"] = eerr["Gasto_operacional"]

    eerr = eerr.drop(columns=["Margen_contribucion"])
    rename_map = {
        "Ventas": "Venta",
        "Costo_venta": "Costo_de_venta",
        "Margen_contribucion_pct": "Margen_contribucion",
        "Margen_EBITDA": "Margen_EBITDA",
    }
    eerr = eerr.rename(columns=rename_map)

    eerr["Es_presupuesto"] = eerr["Escenario"].eq(BUDGET_SCENARIO)

    metric_columns = [
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
    ordered_columns = [
        "Sucursal",
        "Banner",
        "Mes",
        "Escenario",
        "Es_presupuesto",
        *metric_columns,
    ]
    eerr = eerr[ordered_columns]
    eerr = _append_missing_months(eerr, metric_columns, scenario_column="Escenario")

    eerr["Es_presupuesto"] = eerr["Escenario"].eq(BUDGET_SCENARIO)

    if not eerr.empty:
        claves_presupuesto = pd.MultiIndex.from_frame(
            eerr.loc[eerr["Es_presupuesto"], ["Sucursal", "Mes"]]
        )
        if len(claves_presupuesto) > 0:
            metric_na = eerr[[*metric_columns]].isna().all(axis=1)
            es_real = ~eerr["Es_presupuesto"]
            claves = pd.MultiIndex.from_frame(eerr[["Sucursal", "Mes"]])
            filler_mask = es_real & metric_na & claves.isin(claves_presupuesto)
            if filler_mask.any():
                eerr = eerr.loc[~filler_mask].reset_index(drop=True)

    return eerr[ordered_columns].sort_values(["Sucursal", "Mes"]).reset_index(drop=True)


def eerr_en_columnas(eerr: pd.DataFrame) -> pd.DataFrame:
    """Devuelve el EERR con los meses como columnas y métricas como subcolumnas."""
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

    tabla = eerr.pivot_table(
        index=["Sucursal", "Banner"],
        columns="Mes",
        values=columnas_metricas,
        aggfunc="first",
    )

    if tabla.empty:
        return tabla

    tabla = tabla.swaplevel(axis=1).sort_index(axis=1, level=0)
    tabla.columns = pd.MultiIndex.from_tuples(
        [
            (mes.strftime("%Y-%m"), cuenta)
            for mes, cuenta in tabla.columns
        ],
        names=["Mes", "Cuenta"],
    )
    return tabla.sort_index()


def formatear_tabla(df: pd.DataFrame) -> str:
    """Devuelve una representación tabulada en texto con columnas espaciadas."""
    if df.empty:
        return "(sin datos)"

    headers = ["Cuenta"] + [str(col) for col in df.columns]
    cuerpo = []
    for idx, row in df.iterrows():
        idx_str = str(idx)
        idx_lower = idx_str.lower()
        fila = [idx_str]
        for valor in row:
            if pd.isna(valor):
                fila.append("-")
            else:
                if idx_lower.startswith("margen"):
                    fila.append(f"{valor:,.1f}%")
                else:
                    fila.append(f"{valor:,.0f}")
        cuerpo.append(fila)

    anchos = [len(titulo) for titulo in headers]
    for fila in cuerpo:
        for i, celda in enumerate(fila):
            anchos[i] = max(anchos[i], len(celda))

    def _fmt(fila: list[str]) -> str:
        return " | ".join(celda.rjust(anchos[i]) for i, celda in enumerate(fila))

    linea_header = _fmt(headers)
    linea_sep = "-+-".join("-" * ancho for ancho in anchos)
    lineas_datos = [_fmt(fila) for fila in cuerpo]
    return "\n".join([linea_header, linea_sep, *lineas_datos])
