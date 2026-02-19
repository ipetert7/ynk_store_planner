"""Data loading helpers wrapping the Excel sources used by the model."""
from __future__ import annotations

from pathlib import Path
from typing import Iterable

import pandas as pd

from ynk_modelo.config import (
    BUDGET_SCENARIO,
    DICTIONARY_FILE,
    NETWORK_FILE,
    OTHER_COSTS_FILE,
    PAYMENT_FILE,
    REAL_SCENARIO,
    RENT_FILE,
    ROLE_MAP,
    SALES_FILE,
    STAFF_FILE,
    TOTAL_SALES_COMMISSIONS,
    EXCLUDED_COMMISSION_ROLES,
    UF_FILE,
)


def _read_excel(path: Path, sheet_name: str | int) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el archivo requerido: {path}")
    return pd.read_excel(path, sheet_name=sheet_name)


def load_dictionary() -> pd.DataFrame:
    """Carga el diccionario de tiendas y banners."""
    return _read_excel(DICTIONARY_FILE, sheet_name="Hoja1")


def _tidy_sales_sheet(df: pd.DataFrame, scenario: str, value_name: str) -> pd.DataFrame:
    data = (
        df.melt(id_vars="Sucursal", var_name="Mes", value_name=value_name)
        .dropna(subset=[value_name])
        .assign(Escenario=scenario)
    )
    data["Mes"] = pd.to_datetime(data["Mes"], errors="coerce")
    return data


def load_sales() -> pd.DataFrame:
    """Carga ventas mensuales por tienda en formato largo."""
    excel = pd.ExcelFile(SALES_FILE)
    sheet_names = set(excel.sheet_names)

    if {"REAL_Venta", "PPTO_Venta"}.issubset(sheet_names):
        real = _tidy_sales_sheet(excel.parse("REAL_Venta"), REAL_SCENARIO, "Venta_miles")
        budget = _tidy_sales_sheet(excel.parse("PPTO_Venta"), BUDGET_SCENARIO, "Venta_miles")
        ventas = pd.concat([real, budget], ignore_index=True)
        if not real.empty:
            claves_reales = set(zip(real["Sucursal"], real["Mes"]))
            ventas["_key"] = list(zip(ventas["Sucursal"], ventas["Mes"]))
            mask_presupuesto = ventas["Escenario"].eq(BUDGET_SCENARIO)
            mask_dup = mask_presupuesto & ventas["_key"].isin(claves_reales)
            if mask_dup.any():
                ventas = ventas.loc[~mask_dup].reset_index(drop=True)
            ventas = ventas.drop(columns="_key", errors="ignore")
    else:
        ventas = _tidy_sales_sheet(excel.parse("Venta"), REAL_SCENARIO, "Venta_miles")

    ventas["Ventas"] = ventas["Venta_miles"] * 1_000
    return ventas.drop(columns="Venta_miles")


def load_contribution() -> pd.DataFrame:
    """Carga el margen de contribución como porcentaje sobre ventas."""
    excel = pd.ExcelFile(SALES_FILE)
    sheet_names = set(excel.sheet_names)

    if {"REAL_Contribución", "PPTO_Contribución"}.issubset(sheet_names):
        real = _tidy_sales_sheet(excel.parse("REAL_Contribución"), REAL_SCENARIO, "Margen_pct")
        budget = _tidy_sales_sheet(excel.parse("PPTO_Contribución"), BUDGET_SCENARIO, "Margen_pct")
        contrib = pd.concat([real, budget], ignore_index=True)
        if not real.empty:
            claves_reales = set(zip(real["Sucursal"], real["Mes"]))
            contrib["_key"] = list(zip(contrib["Sucursal"], contrib["Mes"]))
            mask_presupuesto = contrib["Escenario"].eq(BUDGET_SCENARIO)
            mask_dup = mask_presupuesto & contrib["_key"].isin(claves_reales)
            if mask_dup.any():
                contrib = contrib.loc[~mask_dup].reset_index(drop=True)
            contrib = contrib.drop(columns="_key", errors="ignore")
    else:
        contrib = _tidy_sales_sheet(excel.parse("Contribución"), REAL_SCENARIO, "Margen_pct")

    return contrib


def load_staff_costs() -> pd.DataFrame:
    """Calcula el costo mensual de dotación por tienda."""
    dotacion = _read_excel(STAFF_FILE, sheet_name="Dotacion").fillna(0)
    costos = _read_excel(STAFF_FILE, sheet_name="Costos")
    costos_idx = costos.set_index("Cargo")
    componentes_fijos = costos_idx.drop(columns="Comisión").sum(axis=1)
    valores_comision = costos_idx["Comisión"]

    registros = []
    for _, row in dotacion.iterrows():
        fijo = 0.0
        vendedores = 0.0
        tasa_sumada = 0.0
        tasa_total_ventas = 0.0
        dotacion_total = 0.0
        detalle: dict[str, float] = {}
        for columna, role in ROLE_MAP.items():
            cantidad = float(row.get(columna, 0) or 0)
            if not cantidad:
                continue
            dotacion_total += cantidad
            detalle[role] = detalle.get(role, 0.0) + cantidad
            fijo += cantidad * float(componentes_fijos.get(role, 0.0))
            comision = float(valores_comision.get(role, 0.0))
            if role in TOTAL_SALES_COMMISSIONS and comision > 0:
                tasa = comision if comision <= 1 else comision / 100_000_000
                tasa_total_ventas += cantidad * tasa
                continue
            if role in EXCLUDED_COMMISSION_ROLES:
                continue
            if comision > 1:
                fijo += cantidad * comision
            elif comision > 0:
                vendedores += cantidad
                tasa_sumada += cantidad * comision

        registros.append(
            {
                "Sucursal": row["SUCURSAL"],
                "Costo_dotacion_fijo": fijo,
                "Vendedores_comision": vendedores,
                "Tasa_comision_sumada": tasa_sumada,
                "Tasa_total_ventas": tasa_total_ventas,
                "Dotacion_total": dotacion_total,
                "Dotacion_detalle": detalle,
            }
        )

    return pd.DataFrame(registros)


def get_role_cost_metadata() -> dict[str, dict[str, float]]:
    """Devuelve costos fijos y comisiones por rol."""
    costos = _read_excel(STAFF_FILE, sheet_name="Costos").set_index("Cargo")
    componentes_fijos = costos.drop(columns="Comisión").sum(axis=1)
    valores_comision = costos["Comisión"]

    metadata: dict[str, dict[str, float]] = {}
    for rol in componentes_fijos.index.union(valores_comision.index):
        fijo = float(componentes_fijos.get(rol, 0.0) or 0.0)
        comision = float(valores_comision.get(rol, 0.0) or 0.0)
        metadata[str(rol)] = {"fixed": fijo, "commission": comision}
    return metadata


def load_rent() -> pd.DataFrame:
    """Obtiene parámetros de arriendo por tienda."""
    arriendo = _read_excel(RENT_FILE, sheet_name="Arriendos").fillna(0)
    arriendo = arriendo.rename(
        columns={
            "VMM (UF)": "Arriendo_vmm_uf",
            "Variable": "Arriendo_porcentual",
            "Fondo promoción": "Arriendo_fondo_promocion_pct",
            "GGCC": "Arriendo_GGCC",
            "Factor Diciembre": "Arriendo_factor",
        }
    )
    keep = [
        "Sucursal",
        "Arriendo_vmm_uf",
        "Arriendo_porcentual",
        "Arriendo_fondo_promocion_pct",
        "Arriendo_factor",
        "Arriendo_GGCC",
    ]
    return arriendo[keep]


def load_other_costs() -> pd.DataFrame:
    """Carga coeficientes para otros costos por banner."""
    otros = _read_excel(OTHER_COSTS_FILE, sheet_name=0)
    return otros.rename(columns={"Otros costos": "Total otros costos"})


def load_uf_diaria() -> pd.Series:
    """Devuelve serie diaria de UF con interpolación."""
    uf = _read_excel(UF_FILE, sheet_name=0)
    uf["Fecha"] = pd.to_datetime(uf["Fecha"])
    uf = uf.sort_values("Fecha").set_index("Fecha")
    serie = uf["UF"].astype(float)
    serie_diaria = serie.resample("D").interpolate(method="linear")
    return serie_diaria.ffill().bfill()


def load_network_costs() -> dict[str, float]:
    """Carga los parámetros de costos de redes y sistemas."""
    redes = _read_excel(NETWORK_FILE, sheet_name=0)
    
    # Extract values from the Banner column structure
    gasto_mensual_row = redes[redes["Banner"] == "Gasto mensual"]
    pct_retail_row = redes[redes["Banner"] == "% asignado a retail"]
    
    gasto_mensual = float(gasto_mensual_row["Redes y sistemas"].iloc[0]) if not gasto_mensual_row.empty else 0.0
    pct_retail = float(pct_retail_row["Redes y sistemas"].iloc[0]) if not pct_retail_row.empty else 0.0
    
    return {
        "gasto_mensual": gasto_mensual,
        "pct_retail": pct_retail,
    }


def load_payment_commission() -> pd.DataFrame:
    """Carga las comisiones de medio de pago por banner."""
    medio_pago = _read_excel(PAYMENT_FILE, sheet_name=0)
    return medio_pago.rename(columns={"Medio de pago": "Comision_medio_pago"})
