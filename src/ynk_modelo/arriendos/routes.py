"""Rutas Flask (web + API) para el modulo de arriendos."""
from __future__ import annotations

from functools import wraps
from typing import Any, Callable, TypeVar

from flask import Blueprint, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from ynk_modelo.database import User as DBUser
from ynk_modelo.arriendos import service

F = TypeVar("F", bound=Callable[..., Any])


def _common_context(active_page: str) -> dict[str, Any]:
    has_eerr = current_user.has_permission("access_eerr_report")
    has_simulator = current_user.has_permission("access_simulator")
    has_admin = current_user.has_permission("access_admin_users")
    has_arriendos = current_user.has_permission("access_arriendos_dashboard")
    arriendos_enabled = service.is_feature_enabled()
    return {
        "active_page": active_page,
        "has_access_eerr_report": has_eerr,
        "has_access_simulator": has_simulator,
        "has_access_admin_users": has_admin,
        "has_access_arriendos": has_arriendos,
        "arriendos_enabled": arriendos_enabled,
    }


def _can_access_dashboard() -> bool:
    return any(
        [
            current_user.has_permission("access_eerr_report"),
            current_user.has_permission("access_simulator"),
            current_user.has_permission("access_admin_users"),
            current_user.has_permission("access_arriendos_dashboard"),
        ]
    )


def _render_access_error(message: str, status_code: int = 403):
    return render_template(
        "error.html",
        error=message,
        error_code=status_code,
        can_access_dashboard=_can_access_dashboard(),
    ), status_code


def web_permission_required(permission_name: str, require_flag: bool = True) -> Callable[[F], F]:
    def decorator(func: F) -> F:
        @wraps(func)
        @login_required
        def wrapped(*args: Any, **kwargs: Any):
            if require_flag and not service.is_feature_enabled():
                return _render_access_error("El modulo de arriendos no esta habilitado", 404)
            if not current_user.has_permission(permission_name):
                return _render_access_error("No tienes permisos para acceder a esta pagina", 403)
            return func(*args, **kwargs)

        return wrapped  # type: ignore[return-value]

    return decorator


def api_permission_required(permission_name: str, require_flag: bool = True) -> Callable[[F], F]:
    def decorator(func: F) -> F:
        @wraps(func)
        @login_required
        def wrapped(*args: Any, **kwargs: Any):
            if require_flag and not service.is_feature_enabled():
                return jsonify({"error": "Modulo deshabilitado", "code": "FEATURE_DISABLED"}), 503
            if not current_user.has_permission(permission_name):
                return jsonify({"error": "Sin permisos", "code": "FORBIDDEN"}), 403
            return func(*args, **kwargs)

        return wrapped  # type: ignore[return-value]

    return decorator


def _payload() -> dict[str, Any]:
    if request.is_json:
        return dict(request.get_json(silent=True) or {})
    return dict(request.form.to_dict(flat=True))


def _handle_operation_error(exc: service.ArriendosOperationError):
    return jsonify({"error": exc.message, "code": exc.code}), exc.status_code


def create_blueprint() -> Blueprint:
    bp = Blueprint("arriendos", __name__)

    @bp.route("/arriendos")
    @web_permission_required("access_arriendos_dashboard")
    def arriendos_dashboard():
        metrics = service.dashboard_metrics()
        expiring = service.list_expiring_contracts(days=60)
        context = _common_context("arriendos_dashboard")
        context.update({"metrics": metrics, "expiring": expiring})
        return render_template("arriendos/dashboard.html", **context)

    @bp.route("/arriendos/stores")
    @web_permission_required("manage_arriendos_stores")
    def arriendos_stores():
        stores = service.list_stores(
            search=request.args.get("search"),
            status=request.args.get("status"),
            sort=request.args.get("sort", "name"),
            order=request.args.get("order", "asc"),
        )
        context = _common_context("arriendos_stores")
        context.update({
            "stores": stores,
            "query": request.args.get("search", ""),
            "status_filter": request.args.get("status", "all"),
        })
        return render_template("arriendos/stores.html", **context)

    @bp.route("/arriendos/stores/new", methods=["GET", "POST"])
    @web_permission_required("manage_arriendos_stores")
    def arriendos_store_new():
        if request.method == "POST":
            payload = _payload()
            try:
                store_id = service.create_store(payload, current_user.id)
                return redirect(url_for("arriendos.arriendos_store_detail", store_id=store_id))
            except service.ArriendosOperationError as exc:
                context = _common_context("arriendos_stores")
                context.update({"mode": "create", "error": exc.message, "store": payload})
                return render_template("arriendos/store_form.html", **context), exc.status_code

        context = _common_context("arriendos_stores")
        context.update({"mode": "create", "store": None})
        return render_template("arriendos/store_form.html", **context)

    @bp.route("/arriendos/stores/<int:store_id>")
    @web_permission_required("manage_arriendos_stores")
    def arriendos_store_detail(store_id: int):
        store = service.get_store(store_id)
        if not store:
            return _render_access_error("Tienda no encontrada", 404)
        context = _common_context("arriendos_stores")
        context.update({"store": store})
        return render_template("arriendos/store_detail.html", **context)

    @bp.route("/arriendos/stores/<int:store_id>/edit", methods=["GET", "POST"])
    @web_permission_required("manage_arriendos_stores")
    def arriendos_store_edit(store_id: int):
        store = service.get_store(store_id)
        if not store:
            return _render_access_error("Tienda no encontrada", 404)

        if request.method == "POST":
            payload = _payload()
            try:
                service.update_store(store_id, payload, current_user.id)
                return redirect(url_for("arriendos.arriendos_store_detail", store_id=store_id))
            except service.ArriendosOperationError as exc:
                context = _common_context("arriendos_stores")
                context.update({"mode": "edit", "error": exc.message, "store": payload})
                return render_template("arriendos/store_form.html", **context), exc.status_code

        contract = next((item for item in store["contracts"] if item["is_active"]), None)
        context = _common_context("arriendos_stores")
        context.update({
            "mode": "edit",
            "store": {
                **store,
                **(contract or {}),
                "contract_id": contract["id"] if contract else None,
            },
        })
        return render_template("arriendos/store_form.html", **context)

    @bp.route("/arriendos/stores/<int:store_id>/close", methods=["POST"])
    @web_permission_required("manage_arriendos_stores")
    def arriendos_store_close(store_id: int):
        try:
            service.close_store(store_id, current_user.id)
            return redirect(url_for("arriendos.arriendos_stores"))
        except service.ArriendosOperationError as exc:
            return _render_access_error(exc.message, exc.status_code)

    @bp.route("/arriendos/stores/expiring")
    @web_permission_required("access_arriendos_dashboard")
    def arriendos_expiring():
        days = request.args.get("days", type=int)
        contracts = service.list_expiring_contracts(days=days)
        context = _common_context("arriendos_expiring")
        context.update({"contracts": contracts, "days": days})
        return render_template("arriendos/expiring.html", **context)

    @bp.route("/arriendos/settings/import", methods=["GET", "POST"])
    @web_permission_required("manage_arriendos_import")
    def arriendos_import():
        validation: dict[str, Any] | None = None
        process_result: dict[str, Any] | None = None
        error: str | None = None

        if request.method == "POST":
            action = request.form.get("action", "validate")
            try:
                dataframe = service.load_excel_from_upload(request.files.get("file"))
                if action == "process":
                    process_result = service.process_import_dataframe(dataframe, current_user.id)
                else:
                    validation = service.validate_import_dataframe(dataframe)
            except service.ArriendosOperationError as exc:
                error = exc.message

        context = _common_context("arriendos_import")
        context.update(
            {
                "validation": validation,
                "process_result": process_result,
                "error": error,
            }
        )
        return render_template("arriendos/import.html", **context)

    @bp.route("/arriendos/profile", methods=["GET", "POST"])
    @web_permission_required("access_arriendos_dashboard")
    def arriendos_profile():
        db_user = DBUser.get_by_id(int(current_user.id))
        if not db_user:
            return _render_access_error("Usuario no encontrado", 404)

        error: str | None = None
        message: str | None = None

        if request.method == "POST":
            full_name = request.form.get("full_name", "").strip()
            email = request.form.get("email", "").strip() or None
            password = request.form.get("password", "").strip()

            if not full_name:
                error = "El nombre completo es obligatorio"
            else:
                db_user.full_name = full_name
                db_user.email = email
                if password:
                    db_user.set_password(password)
                db_user.update()
                message = "Perfil actualizado correctamente"

        context = _common_context("arriendos_profile")
        context.update({"db_user": db_user, "error": error, "message": message})
        return render_template("arriendos/profile.html", **context)

    @bp.route("/arriendos/backups")
    @web_permission_required("manage_arriendos_backups")
    def arriendos_backups():
        backups = service.list_backups()
        context = _common_context("arriendos_backups")
        context.update({"backups": backups})
        return render_template("arriendos/backups.html", **context)

    @bp.route("/arriendos/backups/create", methods=["POST"])
    @web_permission_required("manage_arriendos_backups")
    def arriendos_backups_create():
        try:
            service.create_backup(current_user.id, reason="web")
        except service.ArriendosOperationError:
            pass
        return redirect(url_for("arriendos.arriendos_backups"))

    @bp.route("/arriendos/backups/<backup_id>/restore", methods=["POST"])
    @web_permission_required("manage_arriendos_backups")
    def arriendos_backups_restore(backup_id: str):
        try:
            service.restore_backup(backup_id, current_user.id)
        except service.ArriendosOperationError:
            pass
        return redirect(url_for("arriendos.arriendos_backups"))

    @bp.route("/arriendos/backups/<backup_id>/delete", methods=["POST"])
    @web_permission_required("manage_arriendos_backups")
    def arriendos_backups_delete(backup_id: str):
        try:
            service.delete_backup(backup_id, current_user.id)
        except service.ArriendosOperationError:
            pass
        return redirect(url_for("arriendos.arriendos_backups"))

    @bp.route("/api/arriendos/feature-flag", methods=["GET", "POST"])
    @api_permission_required("access_admin_users", require_flag=False)
    def api_arriendos_feature_flag():
        if request.method == "GET":
            return jsonify({"enabled": service.is_feature_enabled()})

        payload = _payload()
        enabled = str(payload.get("enabled", "true")).lower() in {"1", "true", "yes", "on"}
        service.set_feature_flag(enabled, current_user.id)
        return jsonify({"enabled": service.is_feature_enabled()})

    @bp.route("/api/arriendos/stores", methods=["GET", "POST"])
    @api_permission_required("manage_arriendos_stores")
    def api_arriendos_stores():
        if request.method == "GET":
            rows = service.list_stores(
                search=request.args.get("search"),
                status=request.args.get("status"),
                sort=request.args.get("sort", "name"),
                order=request.args.get("order", "asc"),
            )
            return jsonify({"items": rows})

        payload = _payload()
        try:
            store_id = service.create_store(payload, current_user.id)
            return jsonify({"id": store_id}), 201
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/stores/<int:store_id>", methods=["GET", "PUT", "DELETE"])
    @api_permission_required("manage_arriendos_stores")
    def api_arriendos_store_detail(store_id: int):
        if request.method == "GET":
            row = service.get_store(store_id)
            if not row:
                return jsonify({"error": "Tienda no encontrada", "code": "STORE_NOT_FOUND"}), 404
            return jsonify(row)

        if request.method == "DELETE":
            try:
                service.close_store(store_id, current_user.id)
                return jsonify({"ok": True})
            except service.ArriendosOperationError as exc:
                return _handle_operation_error(exc)

        payload = _payload()
        try:
            service.update_store(store_id, payload, current_user.id)
            return jsonify({"ok": True})
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/stores/<int:store_id>/temporary-modifications", methods=["GET", "POST"])
    @api_permission_required("manage_arriendos_modifications")
    def api_arriendos_temporary_modifications(store_id: int):
        store = service.get_store(store_id)
        if not store:
            return jsonify({"error": "Tienda no encontrada", "code": "STORE_NOT_FOUND"}), 404

        if request.method == "GET":
            return jsonify({"items": store["temporary_modifications"]})

        payload = _payload()
        try:
            modification_id = service.create_temporary_modification(store_id, payload, current_user.id)
            return jsonify({"id": modification_id}), 201
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route(
        "/api/arriendos/stores/<int:store_id>/temporary-modifications/<int:modification_id>",
        methods=["DELETE"],
    )
    @api_permission_required("manage_arriendos_modifications")
    def api_arriendos_temporary_modification_delete(store_id: int, modification_id: int):
        try:
            service.delete_temporary_modification(store_id, modification_id, current_user.id)
            return jsonify({"ok": True})
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/stores/<int:store_id>/permanent-modifications", methods=["GET", "POST"])
    @api_permission_required("manage_arriendos_modifications")
    def api_arriendos_permanent_modifications(store_id: int):
        store = service.get_store(store_id)
        if not store:
            return jsonify({"error": "Tienda no encontrada", "code": "STORE_NOT_FOUND"}), 404

        if request.method == "GET":
            return jsonify({"items": store["permanent_modifications"]})

        payload = _payload()
        try:
            modification_id = service.create_permanent_modification(store_id, payload, current_user.id)
            return jsonify({"id": modification_id}), 201
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/stores/<int:store_id>/audit", methods=["GET"])
    @api_permission_required("view_arriendos_audit")
    def api_arriendos_audit_store(store_id: int):
        return jsonify({"items": service.list_audit(store_id=store_id, limit=request.args.get("limit", 100, int))})

    @bp.route("/api/arriendos/uf", methods=["GET", "POST"])
    @login_required
    def api_arriendos_uf():
        if request.method == "GET":
            if not current_user.has_permission("access_arriendos_dashboard"):
                return jsonify({"error": "Sin permisos", "code": "FORBIDDEN"}), 403
            return jsonify({"items": service.list_uf_values(limit=request.args.get("limit", 120, int))})

        if not current_user.has_permission("manage_arriendos_uf"):
            return jsonify({"error": "Sin permisos", "code": "FORBIDDEN"}), 403

        payload = _payload()
        if payload.get("mode") == "fetch":
            try:
                return jsonify(service.fetch_and_store_latest_uf(current_user.id))
            except service.ArriendosOperationError as exc:
                return _handle_operation_error(exc)

        uf_date = payload.get("uf_date")
        value = payload.get("value")
        if not uf_date or value is None:
            return jsonify({"error": "uf_date y value son obligatorios", "code": "VALIDATION_ERROR"}), 400

        try:
            service.upsert_uf_value(str(uf_date), float(value), source="manual", user_id=current_user.id)
            return jsonify({"ok": True})
        except (TypeError, ValueError):
            return jsonify({"error": "value debe ser numerico", "code": "VALIDATION_ERROR"}), 400

    @bp.route("/api/arriendos/expiring", methods=["GET"])
    @api_permission_required("access_arriendos_dashboard")
    def api_arriendos_expiring():
        return jsonify({"items": service.list_expiring_contracts(days=request.args.get("days", type=int))})

    @bp.route("/api/arriendos/import/validate", methods=["POST"])
    @api_permission_required("manage_arriendos_import")
    def api_arriendos_import_validate():
        try:
            dataframe = service.load_excel_from_upload(request.files.get("file"))
            return jsonify(service.validate_import_dataframe(dataframe))
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/import/process", methods=["POST"])
    @api_permission_required("manage_arriendos_import")
    def api_arriendos_import_process():
        try:
            dataframe = service.load_excel_from_upload(request.files.get("file"))
            result = service.process_import_dataframe(dataframe, current_user.id)
            return jsonify(result)
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/backups", methods=["GET"])
    @api_permission_required("manage_arriendos_backups")
    def api_arriendos_backups_list():
        return jsonify({"items": service.list_backups()})

    @bp.route("/api/arriendos/backups/create", methods=["POST"])
    @api_permission_required("manage_arriendos_backups")
    def api_arriendos_backups_create():
        try:
            return jsonify(service.create_backup(current_user.id, reason="api")), 201
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/backups/<backup_id>/restore", methods=["POST"])
    @api_permission_required("manage_arriendos_backups")
    def api_arriendos_backups_restore(backup_id: str):
        try:
            return jsonify(service.restore_backup(backup_id, current_user.id))
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/backups/<backup_id>", methods=["DELETE"])
    @api_permission_required("manage_arriendos_backups")
    def api_arriendos_backups_delete(backup_id: str):
        try:
            service.delete_backup(backup_id, current_user.id)
            return jsonify({"ok": True})
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/jobs/uf-refresh", methods=["POST"])
    @api_permission_required("manage_arriendos_uf")
    def api_arriendos_job_uf_refresh():
        try:
            payload = service.fetch_and_store_latest_uf(current_user.id)
            return jsonify({"ok": True, "uf": payload})
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    @bp.route("/api/arriendos/jobs/revert-modifications", methods=["POST"])
    @bp.route("/api/arriendos/jobs/revert-temporary-modifications", methods=["POST"])
    @api_permission_required("manage_arriendos_modifications")
    def api_arriendos_job_revert_modifications():
        return jsonify({"ok": True, "result": service.revert_expired_temporary_modifications(current_user.id)})

    @bp.route("/api/arriendos/jobs/backup", methods=["POST"])
    @api_permission_required("manage_arriendos_backups")
    def api_arriendos_job_backup():
        try:
            payload = service.create_backup(current_user.id, reason="job")
            return jsonify({"ok": True, "backup": payload}), 201
        except service.ArriendosOperationError as exc:
            return _handle_operation_error(exc)

    return bp
