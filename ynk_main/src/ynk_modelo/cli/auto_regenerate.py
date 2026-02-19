"""Script de auto-regeneración para ambiente PROD."""
from __future__ import annotations

import time
from datetime import datetime

from ynk_modelo.cli.main import generate_reports
from ynk_modelo.config import (
    AUTO_REGENERATE,
    CHECK_INTERVAL,
    HTML_SIMULATOR_OUTPUT,
    HTML_STATE_OUTPUT,
    IS_PRODUCTION,
)
from ynk_modelo.utils.file_watcher import FileWatcher
from ynk_modelo.utils.logger import get_logger

logger = get_logger()


def run_auto_regenerate() -> None:
    """Ejecuta loop de auto-regeneración en PROD."""
    
    if not IS_PRODUCTION:
        logger.info("Modo LOCAL detectado. Auto-regeneración deshabilitada.")
        logger.info("Para habilitar, cambia ENVIRONMENT=prod en .env")
        return
    
    if not AUTO_REGENERATE:
        logger.info("Auto-regeneración deshabilitada por configuración.")
        return
    
    logger.info("=" * 70)
    logger.info("MODO PRODUCCIÓN - Auto-regeneración ACTIVADA")
    logger.info(f"Intervalo de verificación: {CHECK_INTERVAL} segundos")
    logger.info("=" * 70)
    
    watcher = FileWatcher()
    
    # Primera generación al iniciar
    logger.info("Generando reportes iniciales...")
    try:
        generate_reports(HTML_STATE_OUTPUT, HTML_SIMULATOR_OUTPUT)
        watcher.update_cache()
        logger.info("✓ Reportes iniciales generados exitosamente")
    except Exception as e:
        logger.error(f"✗ Error al generar reportes iniciales: {e}", exc_info=True)
    
    # Loop de monitoreo
    logger.info(f"\nMonitoreando cambios en archivos de data...")
    
    try:
        while True:
            time.sleep(CHECK_INTERVAL)
            
            logger.debug(f"Verificando cambios... [{datetime.now().strftime('%H:%M:%S')}]")
            
            has_changes, changed_files = watcher.check_changes()
            
            if has_changes:
                logger.info("\n" + "=" * 70)
                logger.info("¡CAMBIOS DETECTADOS EN ARCHIVOS DE DATA!")
                logger.info("-" * 70)
                for file_info in changed_files:
                    logger.info(f"  • {file_info}")
                logger.info("-" * 70)
                logger.info("Iniciando regeneración de reportes...")
                
                try:
                    start_time = time.time()
                    generate_reports(HTML_STATE_OUTPUT, HTML_SIMULATOR_OUTPUT)
                    elapsed = time.time() - start_time
                    
                    watcher.update_cache()
                    
                    logger.info("=" * 70)
                    logger.info(f"✓ REPORTES REGENERADOS EXITOSAMENTE")
                    logger.info(f"  Tiempo de ejecución: {elapsed:.2f}s")
                    logger.info(f"  Fecha/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                    logger.info(f"  Archivos actualizados:")
                    logger.info(f"    - {HTML_STATE_OUTPUT.name}")
                    logger.info(f"    - {HTML_SIMULATOR_OUTPUT.name}")
                    logger.info("=" * 70 + "\n")
                    
                except Exception as e:
                    logger.error("=" * 70)
                    logger.error(f"✗ ERROR AL REGENERAR REPORTES: {e}")
                    logger.error("=" * 70 + "\n", exc_info=True)
            
    except KeyboardInterrupt:
        logger.info("\n" + "=" * 70)
        logger.info("Auto-regeneración detenida por el usuario")
        logger.info("=" * 70)


def main() -> None:
    """Punto de entrada del script."""
    run_auto_regenerate()


if __name__ == "__main__":
    main()
