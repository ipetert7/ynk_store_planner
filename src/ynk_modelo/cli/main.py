"""Command-line interface for generating the YNK EERR reports."""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from ynk_modelo.config import (
    EXCLUDED_COMMISSION_ROLES,
    HTML_SIMULATOR_OUTPUT,
    HTML_STATE_OUTPUT,
    ROLE_MAP,
    TOTAL_SALES_COMMISSIONS,
)
from ynk_modelo.domain.eerr import build_eerr, build_store_base
from ynk_modelo.interfaces.simulator import build_simulator_interface
from ynk_modelo.interfaces.state_report import (
    build_html_interface,
    mostrar_eerr_sucursal,
    mostrar_selector,
)
from ynk_modelo.io.excel import get_role_cost_metadata


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Genera y muestra el EERR mensual por tienda.",
    )
    parser.add_argument(
        "--sucursal",
        help="Nombre exacto de la sucursal para imprimir el EERR (omite selector).",
    )
    parser.add_argument(
        "--sin-selector",
        action="store_true",
        help="No abrir el selector interactivo tras generar el archivo.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=HTML_STATE_OUTPUT,
        help="Ruta del HTML de estado de resultados (por defecto EERR_por_tienda.html).",
    )
    parser.add_argument(
        "--simulador",
        type=Path,
        default=HTML_SIMULATOR_OUTPUT,
        help="Ruta del HTML del simulador (por defecto Simulador_EERR.html).",
    )
    return parser.parse_args()


def generate_reports(estado_path: Path, simulador_path: Path) -> tuple[pd.DataFrame, dict[str, dict[str, object]]]:
    """Builds all data artifacts required by the HTML outputs."""
    eerr = build_eerr()
    store_data, banner_map, banner_summary = build_html_interface(
        eerr,
        estado_path,
    )

    base_df, _, uf_vigente = build_store_base()
    role_costs = get_role_cost_metadata()
    staff_roles = sorted({*ROLE_MAP.values(), *role_costs.keys()})
    total_sales_commissions = sorted(TOTAL_SALES_COMMISSIONS)
    excluded_roles = sorted(EXCLUDED_COMMISSION_ROLES)

    build_simulator_interface(
        store_data,
        base_df,
        role_costs,
        total_sales_commissions,
        excluded_roles,
        staff_roles,
        uf_vigente,
        simulador_path,
    )

    return eerr, store_data


def main() -> None:
    args = parse_args()
    eerr, _ = generate_reports(args.output, args.simulador)

    print("Interfaz generada:", args.output)
    print("Simulador generado:", args.simulador)

    if args.sucursal:
        mostrar_eerr_sucursal(eerr, args.sucursal)
    elif not args.sin_selector:
        print("Procesamiento completado. Los archivos HTML han sido generados exitosamente.")
        print("Puedes abrir", args.output.name, "o", args.simulador.name, "en tu navegador.")
        mostrar_selector(eerr)


if __name__ == "__main__":
    main()
