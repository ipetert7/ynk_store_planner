# Dockerfile para YNK Modelo - Flask Server
# Compatible con Mac (local) y Rocky Linux 8.9 (producción)

FROM python:3.10-slim

# Metadatos
LABEL maintainer="YNK"
LABEL description="YNK Modelo - Generador de reportes EERR y simulador EBITDA"

# Variables de entorno
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Crear usuario no-root para seguridad
RUN groupadd -g 1000 ynk && useradd -u 1000 -g 1000 ynk


# Instalar dependencias del sistema necesarias para openpyxl y pandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Crear directorios necesarios
WORKDIR /app

# Copiar archivos de configuración y código fuente
COPY pyproject.toml ./
COPY src/ ./src/
COPY templates/ ./templates/
COPY static/ ./static/
COPY config/ ./config/
#COPY scripts/ ./scripts/

# Instalar dependencias Python (después de copiar el código)
RUN pip install --upgrade pip setuptools wheel && \
    pip install -e .[dev]

# Crear directorios de datos y salida (volúmenes montados)
RUN mkdir -p data output logs

# Cambiar permisos y usuario no-root
RUN chown -R ynk:ynk /app
USER ynk

# Exponer puerto
EXPOSE 8000

# Healthcheck
#HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
#    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/status')" || exit 1

# Comando por defecto (puede ser sobrescrito)
CMD ["python3", "-m", "ynk_modelo.cli.flask_server", "--host", "0.0.0.0", "--port", "8000"]
