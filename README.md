# YNK Modelo EBITDA

Este repositorio contiene el generador de reportes EERR y el simulador EBITDA
utilizado por Yáneken. A partir de insumos en Excel se construyen dashboards en
HTML para el resultado real y el presupuesto, junto con una herramienta de
simulación.

## Estructura del proyecto

- `src/ynk_modelo/`: paquete Python con los módulos de ingestión, lógica de
  negocio y CLI.
- `templates/`: plantillas HTML base utilizadas para renderizar los reportes.
- `static/`: activos estáticos compartidos (CSS, imágenes, JS).
- `images/`: recursos gráficos consumidos por las plantillas.
- `data/`: fuentes de datos de entrada en Excel.
- `EERR_por_tienda.html` / `Simulador_EERR.html`: salidas generadas.

## Requisitos

- Python 3.10 o superior.
- Dependencias Python listadas en `pyproject.toml` (`pandas`, `openpyxl`).

## Instalación (entorno local)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
```

## Generar reportes

```bash
ynk-eerr --sin-selector
```

Parámetros útiles:

- `--sucursal "Nombre"`: imprime el estado de resultados de una sucursal
  específica en consola.
- `--output ruta.html`: cambia la ubicación del reporte principal.
- `--simulador ruta.html`: cambia la ubicación del simulador.

## Pruebas

El directorio `tests/` contiene un placeholder para ensayos automatizados. Una
vez que existan fixtures anonimizado, se recomienda implementar pruebas con
`pytest`.

```bash
pytest
```
