from __future__ import annotations

import math

from ynk_modelo.domain.eerr import build_eerr, build_store_base
from ynk_modelo.interfaces.state_report import _prepare_store_data


def test_threshold_uses_base_rent_without_december_factor() -> None:
    eerr = build_eerr()
    base_df, _, _, uf_vigente = build_store_base()
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

    default_month = detalles.get("default_month")
    aplica_factor = bool(default_month and str(default_month).endswith("-12"))
    arriendo_minimo_referencia = (
        arriendo_minimo_base * factor_diciembre if aplica_factor else arriendo_minimo_base
    )
    esperado_base = arriendo_minimo_referencia / arriendo_porcentual
    thresholds_por_mes = detalles.get("thresholds_by_month") or {}
    dec_values = [
        float(valor)
        for mes, valor in sorted(thresholds_por_mes.items())
        if str(mes).endswith("-12") and valor is not None
    ]
    esperado_peak = dec_values[-1] if dec_values else esperado_base * factor_diciembre

    assert math.isclose(threshold_base, esperado_base, rel_tol=1e-6)
    assert math.isclose(threshold_peak, esperado_peak, rel_tol=1e-6)
