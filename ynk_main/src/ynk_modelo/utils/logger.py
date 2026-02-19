"""Sistema de logging para el generador de reportes."""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from ynk_modelo.config import LOGS_DIR


def setup_logger(name: str = "ynk_modelo") -> logging.Logger:
    """Configura y retorna un logger con formato personalizado."""
    
    # Crear directorio de logs si no existe
    LOGS_DIR.mkdir(exist_ok=True, parents=True)
    
    # Crear logger
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Evitar duplicación de handlers
    if logger.handlers:
        return logger
    
    # Formato de log
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Handler para archivo (log diario)
    log_file = LOGS_DIR / f"ynk_modelo_{datetime.now().strftime('%Y%m%d')}.log"
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Handler para consola
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger


def get_logger(name: str = "ynk_modelo") -> logging.Logger:
    """Obtiene el logger existente o crea uno nuevo."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        return setup_logger(name)
    return logger
