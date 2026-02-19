"""Utilities related to the UF time series."""
from __future__ import annotations

import pandas as pd
from pandas.tseries.offsets import MonthBegin

from ynk_modelo.io.excel import load_uf_diaria


def uf_promedio_mensual(meses: pd.Series) -> pd.Series:
    """Calcula la UF promedio 15-14 para cada mes solicitado."""
    if meses.empty:
        return pd.Series(dtype=float)

    meses = pd.to_datetime(meses)
    uf_diaria = load_uf_diaria()

    inicio_requerido = (meses.min() - MonthBegin(1)) + pd.Timedelta(days=14)
    fin_requerido = meses.max() + pd.Timedelta(days=13)
    rango = pd.date_range(start=inicio_requerido, end=fin_requerido, freq="D")
    if not rango.empty:
        faltantes = rango.difference(uf_diaria.index)
        if not faltantes.empty:
            uf_diaria = uf_diaria.reindex(uf_diaria.index.union(faltantes)).sort_index()
            uf_diaria = uf_diaria.interpolate(method="linear").ffill().bfill()

    promedios = {}
    for mes in meses.unique():
        inicio = mes - MonthBegin(1) + pd.Timedelta(days=14)
        fin = mes + pd.Timedelta(days=13)
        ventana = uf_diaria.loc[inicio:fin]
        if ventana.empty:
            raise ValueError(
                f"No hay datos de UF suficientes para calcular el promedio de {mes:%Y-%m}."
            )
        promedios[mes] = ventana.mean()

    return pd.Series(promedios)


def latest_uf_value() -> float:
    """Devuelve el valor más reciente disponible de la UF."""
    serie = load_uf_diaria()
    if serie.empty:
        raise ValueError("No hay datos de UF disponibles.")
    return float(serie.iloc[-1])
