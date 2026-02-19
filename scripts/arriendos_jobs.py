#!/usr/bin/env python3
"""Jobs operativos del módulo de arriendos para cron del servidor."""
from __future__ import annotations

import argparse
import json

from ynk_modelo.database import init_db
from ynk_modelo.arriendos import service


def main() -> None:
    parser = argparse.ArgumentParser(description="Jobs del módulo arriendos")
    parser.add_argument(
        "job",
        choices=["uf-refresh", "revert-modifications", "backup"],
        help="Job a ejecutar",
    )
    parser.add_argument("--user-id", type=int, default=None, help="Usuario para auditoría")
    args = parser.parse_args()

    init_db()

    if args.job == "uf-refresh":
        result = service.fetch_and_store_latest_uf(user_id=args.user_id)
    elif args.job == "revert-modifications":
        result = service.revert_expired_temporary_modifications(user_id=args.user_id)
    else:
        result = service.create_backup(user_id=args.user_id, reason="cron")

    print(json.dumps(result, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
