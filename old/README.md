# YNK Modelo EBITDA

Este repositorio contiene el generador de reportes EERR y el simulador EBITDA
utilizado por Yáneken. A partir de insumos en Excel se construyen dashboards en
HTML para el resultado real y el presupuesto, junto con una herramienta de
simulación.

## Estructura del proyecto

- `src/ynk_modelo/`: paquete Python con los módulos de ingestión, lógica de
  negocio y CLI.
- `templates/`: plantillas HTML base utilizadas para renderizar los reportes.
- `static/`: activos estáticos compartidos (CSS en `static/css/`, imágenes en
  `static/images/`).
- `data/`: fuentes de datos de entrada en Excel.
- `output/`: archivos HTML generados (`EERR_por_tienda.html` y `Simulador_EERR.html`).
- `scripts/`: scripts auxiliares y helpers de ejecución.
- `tests/`: pruebas automatizadas del proyecto.

## Requisitos

- Python 3.10 o superior.
- Dependencias Python listadas en `pyproject.toml` (`pandas`, `openpyxl`).

## Inicio Rápido con Docker 🐳

**Recomendado para desarrollo y producción**

### Mac (Local)

```bash
# 1. Configurar variables de entorno
cp env.example .env

# 2. Construir imagen
./scripts/docker-build.sh

# 3. Ejecutar contenedor
./scripts/docker-run.sh

# Acceder a http://localhost:8000/login
```

### Rocky Linux 8.9 (Producción)

```bash
# 1. Instalar Docker (si no está instalado)
sudo dnf install -y docker docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
newgrp docker

# 2. Configurar y desplegar
cp env.example .env
# Editar .env y configurar ENVIRONMENT=prod
./scripts/docker-prod.sh
```

**Ver [DOCKER.md](DOCKER.md) para documentación completa de Docker.**

## Instalación (entorno local sin Docker)

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
- `--output ruta.html`: cambia la ubicación del reporte principal (por defecto:
  `output/EERR_por_tienda.html`).
- `--simulador ruta.html`: cambia la ubicación del simulador (por defecto:
  `output/Simulador_EERR.html`).

## Modo Producción

### Local (Mac)

```bash
# Iniciar servidor con auto-regeneración
./scripts/daemon_start.sh

# Acceder a http://localhost:8000
```

Ver [DEPLOYMENT.md](DEPLOYMENT.md) para más detalles.

### Servidor (Rocky Linux)

Para deploy en servidor de producción:

- **Con Docker** (recomendado): Ver [DOCKER.md](DOCKER.md)
- **Sin Docker**: Ver [DEPLOYMENT_LINUX.md](DEPLOYMENT_LINUX.md)

## Pruebas

El directorio `tests/` contiene un placeholder para ensayos automatizados. Una
vez que existan fixtures anonimizado, se recomienda implementar pruebas con
`pytest`.

```bash
pytest
```
