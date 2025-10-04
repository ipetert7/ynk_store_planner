"""Project-wide configuration constants and helpers."""
from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "01. Ima\u0301genes"
TEMPLATES_DIR = PROJECT_ROOT / "templates"
STATIC_DIR = PROJECT_ROOT / "static"
DIST_DIR = PROJECT_ROOT / "dist"

REAL_SCENARIO = "Real"
BUDGET_SCENARIO = "Presupuesto"

DICTIONARY_FILE = DATA_DIR / "D0_Diccionario tiendas.xlsx"
SALES_FILE = DATA_DIR / "D1_Venta y Contribucion.xlsx"
STAFF_FILE = DATA_DIR / "D3_Dotacion.xlsx"
RENT_FILE = DATA_DIR / "D2_Arriendos.xlsx"
OTHER_COSTS_FILE = DATA_DIR / "D4_Otros costos.xlsx"
UF_FILE = DATA_DIR / "D5_UF.xlsx"

HTML_STATE_OUTPUT = PROJECT_ROOT / "EERR_por_tienda.html"
HTML_SIMULATOR_OUTPUT = PROJECT_ROOT / "Simulador_EERR.html"
EERR_TEMPLATE = TEMPLATES_DIR / "eerr_report.html"
SIMULATOR_TEMPLATE = TEMPLATES_DIR / "simulador.html"

ROLE_MAP = {
    "JEFE": "Jefe",
    "SUB JEFE": "Sub jefe",
    "CAJERO": "Cajera FT",
    "CAJERO PT20": "Cajeras PT20",
    "BODEGUERO": "Bodeguero",
    "FT": "Fulltime",
    "PT30": "Part Time 30",
    "PT20": "Part Time 20",
    "ANFITRIONA": "Anfitri\u00f3n",
    "VISUAL": "Visual",
}

TOTAL_SALES_COMMISSIONS = {"Jefe", "Sub jefe"}
EXCLUDED_COMMISSION_ROLES = {
    "Cajera FT",
    "Cajeras PT20",
    "Bodeguero",
    "Anfitri\u00f3n",
    "Visual",
}

METRIC_CONFIG = [
    ("Venta", "Venta", "currency"),
    ("Costo_de_venta", "Costo de venta", "currency"),
    ("Contribucion", "Contribuci\u00f3n", "currency"),
    ("Margen_contribucion", "Margen contribuci\u00f3n (%)", "percent"),
    ("Arriendo_fijo", "Arriendo fijo", "currency"),
    ("Arriendo_variable", "Arriendo variable", "currency"),
    ("Arriendo_fondo_promocion", "Arriendo fondo promoci\u00f3n", "currency"),
    ("Arriendo_GGCC", "Arriendo GGCC", "currency"),
    ("Arriendo_total", "Arriendo total", "currency"),
    ("Remuneraciones_fijo", "Remuneraciones fijo", "currency"),
    ("Remuneraciones_comisiones", "Remuneraciones comisiones", "currency"),
    ("Remuneraciones_total", "Remuneraciones total", "currency"),
    ("Otros_costos", "Otros costos", "currency"),
    ("Gastos_operacionales", "Gastos operacionales", "currency"),
    ("EBITDA", "EBITDA", "currency"),
    ("Margen_EBITDA", "Margen EBITDA (%)", "percent"),
]

# Default HTML widths for generated interfaces.
DEFAULT_CONTAINER_WIDTH = 1900
