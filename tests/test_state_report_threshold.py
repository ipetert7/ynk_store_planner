from __future__ import annotations

import math

from ynk_modelo.domain.eerr import build_eerr, build_store_base
from ynk_modelo.interfaces.state_report import _prepare_store_data


def test_threshold_uses_base_rent_without_december_factor() -> None:
    eerr = build_eerr()
    base_df, _, uf_vigente = build_store_base()
    store_data, _, _ = _prepare_store_data(eerr)

    detalles = store_data["8006-Aufbau Temuco"]["rent_details"]

    peak_factor = detalles["peak_factor"]

    threshold_base = detalles["threshold_clp"]
    threshold_peak = detalles["threshold_peak_clp"]

    assert threshold_base is not None
    assert threshold_peak is not None

    fila = base_df.loc[base_df["Sucursal"] == "8006-Aufbau Temuco"].iloc[0]
    arriendo_minimo_base = float(fila["Arriendo_vmm_uf"]) * uf_vigente
    arriendo_porcentual = float(fila["Arriendo_porcentual"])
    factor_diciembre = float(fila["Arriendo_factor"])

    assert math.isclose(peak_factor or 0.0, factor_diciembre, rel_tol=1e-9)

    esperado_base = arriendo_minimo_base / arriendo_porcentual
    esperado_peak = esperado_base * factor_diciembre

    assert math.isclose(threshold_base, esperado_base, rel_tol=1e-6)
    assert math.isclose(threshold_peak, esperado_peak, rel_tol=1e-6)
