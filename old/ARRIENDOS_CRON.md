# Jobs programados para Arriendos (servidor)

Este módulo usa jobs externos (cron/systemd timer) y no incorpora scheduler interno en Flask.

## Comandos

```bash
# Actualizar UF
python3 scripts/arriendos_jobs.py uf-refresh

# Revertir modificaciones temporales expiradas
python3 scripts/arriendos_jobs.py revert-modifications

# Crear backup de SQLite
python3 scripts/arriendos_jobs.py backup
```

## Ejemplo de crontab

```cron
# 01:00 - UF
0 1 * * * cd /opt/ynk-modelo && /usr/bin/python3 scripts/arriendos_jobs.py uf-refresh >> logs/arriendos-jobs.log 2>&1

# 02:00 - revertir temporales expiradas
0 2 * * * cd /opt/ynk-modelo && /usr/bin/python3 scripts/arriendos_jobs.py revert-modifications >> logs/arriendos-jobs.log 2>&1

# 03:00 - backup
0 3 * * * cd /opt/ynk-modelo && /usr/bin/python3 scripts/arriendos_jobs.py backup >> logs/arriendos-jobs.log 2>&1
```

## Notas

- Los backups se guardan en `output/arriendos_backups/`.
- Cada ejecución genera trazabilidad en `arriendos_audit_log`.
- Para registrar un usuario específico en auditoría, usar `--user-id`.
