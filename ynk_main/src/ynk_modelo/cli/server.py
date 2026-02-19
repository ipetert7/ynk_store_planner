"""Servidor web con auto-regeneración al cargar página."""
from __future__ import annotations

import json
import mimetypes
import time
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from ynk_modelo.cli.main import generate_reports
from ynk_modelo.config import (
    HTML_SIMULATOR_OUTPUT,
    HTML_STATE_OUTPUT,
    IS_PRODUCTION,
    OUTPUT_DIR,
    PROJECT_ROOT,
    STATIC_DIR,
)
from ynk_modelo.utils.file_watcher import FileWatcher
from ynk_modelo.utils.logger import get_logger

logger = get_logger()


class AutoRegenHandler(SimpleHTTPRequestHandler):
    """Handler HTTP que verifica cambios antes de servir páginas."""
    
    file_watcher = FileWatcher()
    
    def __init__(self, *args, **kwargs):
        # Cambiar directorio base al proyecto
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)
    
    def do_GET(self):
        """Maneja peticiones GET con verificación de cambios."""
        parsed = urlparse(self.path)
        path = parsed.path
        
        # Endpoint de verificación de cambios
        if path == '/api/check':
            self.handle_check()
            return
        
        # Endpoint de estado
        if path == '/api/status':
            self.handle_status()
            return
        
        # Para páginas HTML, verificar cambios primero
        if path.endswith('.html') or path in ('/', '/EERR_por_tienda.html', '/Simulador_EERR.html'):
            self.check_and_regenerate()
        
        # Servir archivos estáticos
        super().do_GET()
    
    def check_and_regenerate(self):
        """Verifica cambios y regenera si es necesario."""
        if not IS_PRODUCTION:
            logger.debug("Modo LOCAL - Verificación deshabilitada")
            return
        
        try:
            has_changes, changed_files = self.file_watcher.check_changes()
            
            if has_changes:
                logger.info("=" * 70)
                logger.info("¡CAMBIOS DETECTADOS! Regenerando reportes...")
                logger.info("-" * 70)
                for file_info in changed_files:
                    logger.info(f"  • {file_info}")
                logger.info("-" * 70)
                
                start_time = time.time()
                generate_reports(HTML_STATE_OUTPUT, HTML_SIMULATOR_OUTPUT)
                elapsed = time.time() - start_time
                
                self.file_watcher.update_cache()
                
                logger.info("✓ REPORTES REGENERADOS EXITOSAMENTE")
                logger.info(f"  Tiempo: {elapsed:.2f}s")
                logger.info(f"  Fecha/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                logger.info("=" * 70)
        except Exception as e:
            logger.error(f"✗ ERROR al verificar/regenerar: {e}", exc_info=True)
    
    def handle_check(self):
        """Endpoint para verificación manual de cambios."""
        try:
            has_changes, changed_files = self.file_watcher.check_changes()
            
            if has_changes:
                start_time = time.time()
                generate_reports(HTML_STATE_OUTPUT, HTML_SIMULATOR_OUTPUT)
                elapsed = time.time() - start_time
                self.file_watcher.update_cache()
                
                response = {
                    "status": "regenerated",
                    "changes": changed_files,
                    "elapsed": round(elapsed, 2),
                    "timestamp": datetime.now().isoformat(),
                }
                logger.info(f"✓ Reportes regenerados en {elapsed:.2f}s")
            else:
                response = {
                    "status": "no_changes",
                    "message": "No hay cambios en archivos de data",
                    "timestamp": datetime.now().isoformat(),
                }
            
            self.send_json_response(response)
        except Exception as e:
            logger.error(f"Error en /api/check: {e}", exc_info=True)
            self.send_json_response({
                "status": "error",
                "message": str(e),
            }, status=500)
    
    def handle_status(self):
        """Endpoint de estado del sistema."""
        summary = self.file_watcher.get_summary()
        summary["environment"] = "PROD" if IS_PRODUCTION else "LOCAL"
        summary["auto_check"] = IS_PRODUCTION
        self.send_json_response(summary)
    
    def send_json_response(self, data: dict, status: int = 200):
        """Envía respuesta JSON."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override para usar nuestro logger."""
        logger.info(f"{self.address_string()} - {format % args}")
    
    def translate_path(self, path):
        """Traduce URL a ruta de archivo."""
        # Remover query string
        path = urlparse(path).path
        
        # Rutas especiales
        if path == '/' or path == '':
            return str(OUTPUT_DIR / 'EERR_por_tienda.html')
        
        # Archivos HTML en output/
        if path.endswith('.html'):
            filename = Path(path).name
            html_path = OUTPUT_DIR / filename
            if html_path.exists():
                return str(html_path)
        
        # Archivos estáticos
        if path.startswith('/static/'):
            static_path = PROJECT_ROOT / path.lstrip('/')
            if static_path.exists():
                return str(static_path)
        
        # Default
        return str(PROJECT_ROOT / path.lstrip('/'))


def run_server(host: str = "0.0.0.0", port: int = 8000):
    """Ejecuta el servidor HTTP."""
    
    logger.info("=" * 70)
    logger.info("YNK Modelo - Servidor Web con Auto-regeneración")
    logger.info("=" * 70)
    logger.info(f"Ambiente: {'PRODUCCIÓN' if IS_PRODUCTION else 'LOCAL'}")
    logger.info(f"Auto-verificación: {'ACTIVADA' if IS_PRODUCTION else 'DESACTIVADA'}")
    logger.info(f"Servidor: http://{host}:{port}")
    logger.info("-" * 70)
    logger.info("Páginas disponibles:")
    logger.info(f"  • http://localhost:{port}/EERR_por_tienda.html")
    logger.info(f"  • http://localhost:{port}/Simulador_EERR.html")
    logger.info("-" * 70)
    logger.info("Endpoints API:")
    logger.info(f"  • http://localhost:{port}/api/check   - Verificar y regenerar")
    logger.info(f"  • http://localhost:{port}/api/status  - Estado del sistema")
    logger.info("=" * 70)
    
    if IS_PRODUCTION:
        logger.info("✓ MODO PRODUCCIÓN: Verificará cambios cada vez que visites las páginas")
    else:
        logger.info("ℹ MODO LOCAL: Sin auto-verificación (cambia ENVIRONMENT=prod en .env)")
    
    logger.info("\nPresiona Ctrl+C para detener el servidor\n")
    
    server = HTTPServer((host, port), AutoRegenHandler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("\n" + "=" * 70)
        logger.info("Servidor detenido por el usuario")
        logger.info("=" * 70)
        server.shutdown()


def main():
    """Punto de entrada del servidor."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Servidor web con auto-regeneración")
    parser.add_argument("--host", default="0.0.0.0", help="Host del servidor")
    parser.add_argument("--port", type=int, default=8000, help="Puerto del servidor")
    
    args = parser.parse_args()
    run_server(args.host, args.port)


if __name__ == "__main__":
    main()
