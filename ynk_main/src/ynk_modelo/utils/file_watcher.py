"""Detección de cambios en archivos de data."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from ynk_modelo.config import DATA_DIR, PROJECT_ROOT
from ynk_modelo.utils.logger import get_logger

logger = get_logger()


class FileWatcher:
    """Monitorea cambios en archivos de data."""
    
    def __init__(self, cache_file: Path | None = None):
        """Inicializa el watcher con archivo de caché de timestamps."""
        self.cache_file = cache_file or PROJECT_ROOT / ".data_cache.json"
        self.timestamps: dict[str, float] = self._load_cache()
    
    def _load_cache(self) -> dict[str, float]:
        """Carga timestamps previos desde caché."""
        if not self.cache_file.exists():
            return {}
        
        try:
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"No se pudo cargar caché de timestamps: {e}")
            return {}
    
    def _save_cache(self) -> None:
        """Guarda timestamps actuales en caché."""
        try:
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.timestamps, f, indent=2)
        except IOError as e:
            logger.error(f"No se pudo guardar caché de timestamps: {e}")
    
    def get_data_files(self) -> list[Path]:
        """Obtiene lista de archivos Excel en data/."""
        if not DATA_DIR.exists():
            logger.warning(f"Directorio {DATA_DIR} no existe")
            return []
        
        # Buscar archivos .xlsx y .xls
        files = list(DATA_DIR.glob("*.xlsx")) + list(DATA_DIR.glob("*.xls"))
        # Filtrar:
        # - Solo archivos que empiezan con D0-D7 (archivos de datos)
        # - Excluir archivos temporales de Excel (empiezan con ~$)
        data_files = [
            f for f in files 
            if f.name.startswith(('D0_', 'D1_', 'D2_', 'D3_', 'D4_', 'D5_', 'D6_', 'D7_'))
            and not f.name.startswith('~$')
        ]
        return sorted(data_files)
    
    def check_changes(self) -> tuple[bool, list[str]]:
        """
        Verifica si hay cambios en archivos de data.
        
        Returns:
            tuple: (hay_cambios: bool, archivos_modificados: list[str])
        """
        files = self.get_data_files()
        changed_files = []
        
        for file_path in files:
            file_key = str(file_path.relative_to(PROJECT_ROOT))
            current_mtime = file_path.stat().st_mtime
            cached_mtime = self.timestamps.get(file_key)
            
            if cached_mtime is None:
                # Archivo nuevo
                changed_files.append(f"{file_path.name} (nuevo)")
                logger.info(f"Archivo nuevo detectado: {file_path.name}")
            elif current_mtime > cached_mtime:
                # Archivo modificado
                mod_time = datetime.fromtimestamp(current_mtime)
                changed_files.append(f"{file_path.name} (modificado {mod_time.strftime('%Y-%m-%d %H:%M:%S')})")
                logger.info(f"Cambio detectado en: {file_path.name}")
            
            # Actualizar timestamp
            self.timestamps[file_key] = current_mtime
        
        has_changes = len(changed_files) > 0
        return has_changes, changed_files
    
    def update_cache(self) -> None:
        """Actualiza el caché de timestamps."""
        self._save_cache()
        logger.debug("Caché de timestamps actualizado")
    
    def get_summary(self) -> dict[str, object]:
        """Retorna resumen del estado actual de archivos."""
        files = self.get_data_files()
        
        summary = {
            "total_files": len(files),
            "files": [],
            "last_check": datetime.now().isoformat(),
        }
        
        for file_path in files:
            mtime = file_path.stat().st_mtime
            summary["files"].append({
                "name": file_path.name,
                "size_kb": round(file_path.stat().st_size / 1024, 2),
                "modified": datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S'),
            })
        
        return summary
