"""Servidor Flask con autenticación y auto-regeneración."""
from __future__ import annotations

import argparse
import os
import time
from datetime import datetime
from functools import wraps
from pathlib import Path
from urllib.parse import urlparse

import jwt
from flask import (
    Flask,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
    make_response,
)
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)

from ynk_modelo.cli.main import generate_reports
from ynk_modelo.config import (
    AUTO_REGENERATE,
    HTML_SIMULATOR_OUTPUT,
    HTML_STATE_OUTPUT,
    IS_PRODUCTION,
    OUTPUT_DIR,
    PORT,
    PROJECT_ROOT,
    SSO_REFRESH_TTL,
    SSO_SECRET,
    SSO_SYNC_SECRET,
    SSO_TOKEN_TTL,
    STATIC_DIR,
)
from ynk_modelo.database import init_db, User as DBUser
from ynk_modelo.utils.file_watcher import FileWatcher
from ynk_modelo.utils.logger import get_logger

logger = get_logger()


def _safe_next_path(next_page: str | None, fallback: str) -> str:
    """Valida next para permitir solo rutas locales."""
    if not next_page:
        return fallback
    parsed = urlparse(next_page)
    if parsed.scheme or parsed.netloc:
        return fallback
    if not next_page.startswith("/"):
        return fallback
    return next_page


def _build_sso_payload(user: User) -> dict:
    """Construye el payload JWT para SSO."""
    now = int(time.time())
    email = user.email or f"{user.username}@ynk.local"
    return {
        "sub": str(user.id),
        "username": user.username,
        "email": email,
        "full_name": user.name,
        "is_active": bool(user.is_active),
        "roles": user.get_roles(),
        "permissions": user._db_user.get_permissions(),
        "iat": now,
        "exp": now + SSO_TOKEN_TTL,
    }


def _set_sso_cookie(response, user: User) -> None:
    """Setea cookie SSO firmada."""
    payload = _build_sso_payload(user)
    token = jwt.encode(payload, SSO_SECRET, algorithm="HS256")
    response.set_cookie(
        "ynk_sso",
        token,
        max_age=SSO_REFRESH_TTL,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="Lax",
        path="/",
    )


class User(UserMixin):
    """Modelo de usuario para Flask-Login compatible con base de datos."""

    def __init__(self, db_user: DBUser):
        self.id = db_user.id
        self.username = db_user.username
        self.name = db_user.full_name
        self.email = db_user.email
        self._db_user = db_user
        self._is_active = db_user.is_active
    
    @property
    def is_active(self) -> bool:
        """Propiedad is_active requerida por Flask-Login."""
        return self._is_active
    
    def has_permission(self, permission_name: str) -> bool:
        """Verifica si el usuario tiene un permiso."""
        return self._db_user.has_permission(permission_name)
    
    def has_role(self, role_name: str) -> bool:
        """Verifica si el usuario tiene un rol."""
        return self._db_user.has_role(role_name)
    
    def get_roles(self) -> list[str]:
        """Obtiene los roles del usuario."""
        return self._db_user.get_roles()


# Inicializar Flask
app = Flask(
    __name__,
    template_folder=str(PROJECT_ROOT / "templates"),
    static_folder=str(STATIC_DIR),
)
app.secret_key = os.getenv("SECRET_KEY", "ynk-dev-secret-key-change-in-production")

# Inicializar Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message = "Por favor inicia sesión para acceder."

# Context processor para hacer disponibles las variables de permisos en todos los templates
@app.context_processor
def inject_permissions():
    """Inyecta variables de permisos en todos los templates."""
    try:
        from flask_login import current_user
        if hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
            return {
                'has_access_eerr_report': current_user.has_permission("access_eerr_report"),
                'has_access_simulator': current_user.has_permission("access_simulator"),
                'has_access_admin_users': current_user.has_permission("access_admin_users"),
                'has_access_rent_manager': current_user.has_permission("access_rent_manager"),
            }
    except Exception:
        pass
    return {
        'has_access_eerr_report': False,
        'has_access_simulator': False,
        'has_access_admin_users': False,
        'has_access_rent_manager': False,
    }

# FileWatcher para auto-regeneración
file_watcher = FileWatcher()

# Inicializar base de datos al iniciar
try:
    init_db()
    logger.info("✓ Base de datos inicializada")
except Exception as e:
    logger.warning(f"⚠ Error al inicializar base de datos: {e}")


@login_manager.user_loader
def load_user(user_id: str) -> User | None:
    """Carga usuario desde ID."""
    try:
        db_user = DBUser.get_by_id(int(user_id))
        if db_user and db_user.is_active:
            return User(db_user)
    except (ValueError, TypeError):
        pass
    return None


def permission_required(permission_name: str):
    """Decorador para verificar permisos."""
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated_function(*args, **kwargs):
            if not current_user.has_permission(permission_name):
                # Verificar si puede acceder al dashboard
                has_eerr = current_user.has_permission("access_eerr_report")
                has_simulator = current_user.has_permission("access_simulator")
                has_admin = current_user.has_permission("access_admin_users")
                has_rent_manager = current_user.has_permission("access_rent_manager")
                can_access_dashboard = has_eerr or has_simulator or has_admin or has_rent_manager
                
                return render_template("error.html", 
                    error="No tienes permisos para acceder a esta página",
                    error_code=403,
                    can_access_dashboard=can_access_dashboard), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def check_and_regenerate() -> tuple[bool, list[str]]:
    """Verifica cambios y regenera si es necesario."""
    # Verificar si auto-regeneración está habilitada
    if not AUTO_REGENERATE:
        logger.debug("Auto-regeneración deshabilitada")
        return False, []

    try:
        has_changes, changed_files = file_watcher.check_changes()

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

            file_watcher.update_cache()

            logger.info("✓ REPORTES REGENERADOS EXITOSAMENTE")
            logger.info(f"  Tiempo: {elapsed:.2f}s")
            logger.info(f"  Fecha/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info("=" * 70)

        return has_changes, changed_files
    except Exception as e:
        logger.error(f"✗ ERROR al verificar/regenerar: {e}", exc_info=True)
        return False, []


# ============================================================================
# RUTAS DE AUTENTICACIÓN
# ============================================================================


@app.route("/login", methods=["GET", "POST"])
def login():
    """Página de login."""
    default_path = url_for("dashboard")
    if current_user.is_authenticated:
        next_page = _safe_next_path(request.args.get("next"), default_path)
        response = make_response(redirect(next_page))
        _set_sso_cookie(response, current_user)
        return response

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        db_user = DBUser.get_by_username(username)
        if db_user and db_user.is_active and db_user.check_password(password):
            user = User(db_user)
            login_user(user, remember=request.form.get("remember") == "on")
            logger.info(f"Usuario '{username}' inició sesión")

            next_page = _safe_next_path(request.args.get("next"), default_path)
            response = make_response(redirect(next_page))
            _set_sso_cookie(response, user)
            return response

        logger.warning(f"Intento de login fallido para usuario: {username}")
        return render_template("login.html", error="Usuario o contraseña incorrectos")

    return render_template("login.html")


@app.route("/logout")
@login_required
def logout():
    """Cierra sesión del usuario."""
    logger.info(f"Usuario '{current_user.username}' cerró sesión")
    logout_user()
    if request.args.get("from") != "arriendos":
        response = make_response(redirect("/arriendos/api/sso/logout"))
        response.delete_cookie("ynk_sso", path="/")
        return response
    response = make_response(redirect(url_for("login")))
    response.delete_cookie("ynk_sso", path="/")
    return response


# ============================================================================
# RUTAS PRINCIPALES (PROTEGIDAS)
# ============================================================================


@app.route("/")
@login_required
def index():
    """Redirige al dashboard."""
    return redirect(url_for("dashboard"))


@app.route("/dashboard")
@login_required
def dashboard():
    """Dashboard principal con módulos disponibles según permisos."""
    # Verificar que el usuario tenga al menos un permiso
    has_eerr = current_user.has_permission("access_eerr_report")
    has_simulator = current_user.has_permission("access_simulator")
    has_admin = current_user.has_permission("access_admin_users")
    has_rent_manager = current_user.has_permission("access_rent_manager")
    
    # Si no tiene ningún permiso, mostrar error
    if not (has_eerr or has_simulator or has_admin or has_rent_manager):
        return render_template("error.html", 
            error="No tienes permisos para acceder a ningún módulo. Contacta al administrador.",
            error_code=403,
            can_access_dashboard=False), 403
    
    return render_template("dashboard.html",
                         active_page="dashboard",
                         has_access_eerr_report=has_eerr,
                         has_access_simulator=has_simulator,
                         has_access_admin_users=has_admin,
                         has_access_rent_manager=has_rent_manager)


@app.route("/EERR_por_tienda.html")
@permission_required("access_eerr_report")
def eerr_report():
    """Sirve el reporte de EERR."""
    from ynk_modelo.config import EERR_TEMPLATE, HTML_STATE_OUTPUT
    
    # Verificar si el template es más reciente que el output
    template_path = EERR_TEMPLATE
    output_path = HTML_STATE_OUTPUT
    
    should_regenerate = False
    if not output_path.exists():
        should_regenerate = True
        logger.info("Archivo EERR_por_tienda.html no existe, regenerando...")
    elif template_path.exists():
        template_mtime = template_path.stat().st_mtime
        output_mtime = output_path.stat().st_mtime
        if template_mtime > output_mtime:
            should_regenerate = True
            logger.info("Template eerr_report.html es más reciente, regenerando...")
    
    if should_regenerate:
        try:
            from ynk_modelo.cli.main import generate_reports
            generate_reports(HTML_STATE_OUTPUT, HTML_SIMULATOR_OUTPUT)
            logger.info("✓ Reporte EERR regenerado exitosamente")
        except Exception as e:
            logger.error(f"Error al regenerar reporte EERR: {e}", exc_info=True)
    else:
        # Verificar cambios en datos también
        check_and_regenerate()
    
    # Leer el contenido del HTML generado
    if output_path.exists():
        html_content_raw = output_path.read_text(encoding="utf-8")
        # Extraer el contenido del container y los scripts por separado
        # El HTML generado tiene: <body><div class="container">...</div><script>...</script></body>
        container_start = html_content_raw.find('<div class="container">')
        script_start = html_content_raw.find('<script>', container_start) if container_start != -1 else -1
        body_end = html_content_raw.rfind('</body>')
        
        if container_start != -1:
            # Extraer solo el container (sin scripts)
            if script_start != -1:
                # Buscar el cierre del container principal antes del script
                before_script = html_content_raw[container_start:script_start]
                # Contar divs para encontrar el cierre correcto del container
                last_div_pos = -1
                for i in range(len(before_script) - 6, -1, -1):
                    if before_script[i:i+6] == '</div>':
                        # Verificar si este cierra el container principal
                        before_this_div = before_script[:i]
                        divs_open = before_this_div.count('<div')
                        divs_close = before_this_div.count('</div>')
                        if divs_open == divs_close + 1:
                            # Este es el cierre del container principal
                            last_div_pos = container_start + i + 6
                            break
                if last_div_pos != -1:
                    html_content = html_content_raw[container_start:last_div_pos]
                else:
                    # Fallback: tomar hasta antes del script
                    html_content = html_content_raw[container_start:script_start].rstrip()
            else:
                # Si no hay script, buscar hasta </body>
                if body_end != -1:
                    html_content = html_content_raw[container_start:body_end].rstrip()
                else:
                    html_content = html_content_raw[container_start:]
            
            # Extraer los scripts por separado
            if script_start != -1 and body_end != -1:
                html_scripts = html_content_raw[script_start:body_end].rstrip()
            else:
                html_scripts = ""
        else:
            # Si no encuentra el container, buscar body y extraer todo excepto brand-bar
            body_start = html_content_raw.find('<body>')
            if body_start != -1:
                if body_end != -1:
                    body_content = html_content_raw[body_start + 6:body_end]
                    # Eliminar brand-bar si existe
                    brand_bar_start = body_content.find('<div class="brand-bar">')
                    if brand_bar_start != -1:
                        # Buscar el cierre del brand-bar contando divs
                        pos = brand_bar_start
                        depth = 1
                        brand_bar_end = -1
                        while pos < len(body_content) and depth > 0:
                            pos = body_content.find('</div>', pos + 1)
                            if pos == -1:
                                break
                            # Contar divs antes de esta posición
                            before = body_content[brand_bar_start:pos]
                            depth = before.count('<div') - before.count('</div>')
                            if depth == 0:
                                brand_bar_end = pos + 6
                                break
                        if brand_bar_end != -1:
                            body_content = body_content[:brand_bar_start] + body_content[brand_bar_end:]
                    html_content = body_content
                    html_scripts = ""
                else:
                    html_content = html_content_raw[body_start + 6:]
                    html_scripts = ""
            else:
                html_content = "<div class='container'><p>Error: No se pudo generar el reporte.</p></div>"
                html_scripts = ""
    else:
        html_content = "<div class='container'><p>Error: No se pudo generar el reporte.</p></div>"
        html_scripts = ""
    
    # Obtener permisos para el brand-bar
    has_eerr = current_user.has_permission("access_eerr_report")
    has_simulator = current_user.has_permission("access_simulator")
    has_admin = current_user.has_permission("access_admin_users")
    
    logger.info(f"Renderizando report_wrapper.html con html_content length: {len(html_content)}")
    logger.info(f"Permisos - EERR: {has_eerr}, Simulator: {has_simulator}, Admin: {has_admin}")
    
    return render_template("report_wrapper.html",
                         html_content=html_content,
                         html_scripts=html_scripts,
                         active_page="eerr",
                         has_access_eerr_report=has_eerr,
                         has_access_simulator=has_simulator,
                         has_access_admin_users=has_admin)


@app.route("/Simulador_EERR.html")
@permission_required("access_simulator")
def simulator():
    """Sirve el simulador."""
    from ynk_modelo.config import SIMULATOR_TEMPLATE, HTML_SIMULATOR_OUTPUT
    
    # Verificar si el template es más reciente que el output
    template_path = SIMULATOR_TEMPLATE
    output_path = HTML_SIMULATOR_OUTPUT
    
    should_regenerate = False
    if not output_path.exists():
        should_regenerate = True
        logger.info("Archivo Simulador_EERR.html no existe, regenerando...")
    elif template_path.exists():
        template_mtime = template_path.stat().st_mtime
        output_mtime = output_path.stat().st_mtime
        if template_mtime > output_mtime:
            should_regenerate = True
            logger.info("Template simulador.html es más reciente, regenerando...")
    
    if should_regenerate:
        try:
            from ynk_modelo.cli.main import generate_reports
            generate_reports(HTML_STATE_OUTPUT, HTML_SIMULATOR_OUTPUT)
            logger.info("✓ Simulador regenerado exitosamente")
        except Exception as e:
            logger.error(f"Error al regenerar simulador: {e}", exc_info=True)
    else:
        # Verificar cambios en datos también
        check_and_regenerate()
    
    # Leer el contenido del HTML generado
    if output_path.exists():
        html_content_raw = output_path.read_text(encoding="utf-8")
        # Extraer el contenido del container y los scripts por separado
        container_start = html_content_raw.find('<div class="container">')
        script_start = html_content_raw.find('<script>', container_start) if container_start != -1 else -1
        body_end = html_content_raw.rfind('</body>')
        
        if container_start != -1:
            # Extraer solo el container (sin scripts)
            if script_start != -1:
                # Buscar el cierre del container principal antes del script
                before_script = html_content_raw[container_start:script_start]
                # Contar divs para encontrar el cierre correcto del container
                last_div_pos = -1
                for i in range(len(before_script) - 6, -1, -1):
                    if before_script[i:i+6] == '</div>':
                        # Verificar si este cierra el container principal
                        before_this_div = before_script[:i]
                        divs_open = before_this_div.count('<div')
                        divs_close = before_this_div.count('</div>')
                        if divs_open == divs_close + 1:
                            # Este es el cierre del container principal
                            last_div_pos = container_start + i + 6
                            break
                if last_div_pos != -1:
                    html_content = html_content_raw[container_start:last_div_pos]
                else:
                    # Fallback: tomar hasta antes del script
                    html_content = html_content_raw[container_start:script_start].rstrip()
            else:
                # Si no hay script, buscar hasta </body>
                if body_end != -1:
                    html_content = html_content_raw[container_start:body_end].rstrip()
                else:
                    html_content = html_content_raw[container_start:]
            
            # Extraer los scripts por separado
            if script_start != -1 and body_end != -1:
                html_scripts = html_content_raw[script_start:body_end].rstrip()
            else:
                html_scripts = ""
        else:
            # Si no encuentra el container, buscar body y extraer todo excepto brand-bar
            body_start = html_content_raw.find('<body>')
            if body_start != -1:
                if body_end != -1:
                    body_content = html_content_raw[body_start + 6:body_end]
                    # Eliminar brand-bar si existe
                    brand_bar_start = body_content.find('<div class="brand-bar">')
                    if brand_bar_start != -1:
                        # Buscar el cierre del brand-bar contando divs
                        pos = brand_bar_start
                        depth = 1
                        brand_bar_end = -1
                        while pos < len(body_content) and depth > 0:
                            pos = body_content.find('</div>', pos + 1)
                            if pos == -1:
                                break
                            # Contar divs antes de esta posición
                            before = body_content[brand_bar_start:pos]
                            depth = before.count('<div') - before.count('</div>')
                            if depth == 0:
                                brand_bar_end = pos + 6
                                break
                        if brand_bar_end != -1:
                            body_content = body_content[:brand_bar_start] + body_content[brand_bar_end:]
                    html_content = body_content
                    html_scripts = ""
                else:
                    html_content = html_content_raw[body_start + 6:]
                    html_scripts = ""
            else:
                html_content = "<div class='container'><p>Error: No se pudo generar el simulador.</p></div>"
                html_scripts = ""
    else:
        html_content = "<div class='container'><p>Error: No se pudo generar el simulador.</p></div>"
        html_scripts = ""
    
    # Obtener permisos para el brand-bar
    has_eerr = current_user.has_permission("access_eerr_report")
    has_simulator = current_user.has_permission("access_simulator")
    has_admin = current_user.has_permission("access_admin_users")
    
    logger.info(f"Renderizando report_wrapper.html (simulator) con html_content length: {len(html_content)}")
    logger.info(f"Permisos - EERR: {has_eerr}, Simulator: {has_simulator}, Admin: {has_admin}")
    
    return render_template("report_wrapper.html",
                         html_content=html_content,
                         html_scripts=html_scripts,
                         active_page="simulator",
                         has_access_eerr_report=has_eerr,
                         has_access_simulator=has_simulator,
                         has_access_admin_users=has_admin)


# ============================================================================
# ARCHIVOS ESTÁTICOS Y API
# ============================================================================


@app.route("/static/<path:filename>")
def serve_static(filename):
    """Sirve archivos estáticos (CSS, imágenes, etc.)."""
    return send_from_directory(STATIC_DIR, filename)


@app.route("/api/check")
@login_required
def api_check():
    """Endpoint para verificación manual de cambios."""
    has_changes, changed_files = check_and_regenerate()

    if has_changes:
        return {
            "status": "regenerated",
            "changed_files": changed_files,
            "timestamp": datetime.now().isoformat(),
        }

    return {"status": "no_changes", "timestamp": datetime.now().isoformat()}


@app.route("/api/status")
@login_required
def api_status():
    """Endpoint de estado del sistema."""
    return {
        "status": "online",
        "environment": "PRODUCTION" if IS_PRODUCTION else "LOCAL",
        "user": current_user.username,
        "timestamp": datetime.now().isoformat(),
    }


@app.route("/api/sso/refresh")
@login_required
def api_sso_refresh():
    """Re-emite cookie SSO para sesión activa."""
    response = make_response({"ok": True, "timestamp": datetime.now().isoformat()})
    _set_sso_cookie(response, current_user)
    return response


@app.route("/api/sso/users")
def api_sso_users():
    """Entrega listado de usuarios para sincronización."""
    auth_header = request.headers.get("authorization", "")
    expected = f"Bearer {SSO_SYNC_SECRET}"
    if auth_header != expected:
        return {"error": "Unauthorized"}, 401

    from ynk_modelo.database import User as DBUser

    users = DBUser.list_all()
    payload = []
    for user in users:
        payload.append({
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email or f"{user.username}@ynk.local",
            "is_active": bool(user.is_active),
            "roles": user.get_roles(),
            "permissions": user.get_permissions(),
        })
    return {"users": payload, "timestamp": datetime.now().isoformat()}


# ============================================================================
# GESTIÓN DE USUARIOS (requiere permiso manage_users)
# ============================================================================


@app.route("/admin/users")
@permission_required("access_admin_users")
def admin_users():
    """Lista de usuarios."""
    from ynk_modelo.database import User as DBUser, Role
    
    users = DBUser.list_all()
    roles = Role.list_all()
    
    # Obtener roles de cada usuario
    users_with_roles = []
    for user in users:
        user_roles = user.get_roles()
        users_with_roles.append({
            "user": user,
            "roles": user_roles,
        })
    
    # Obtener permisos para el brand-bar
    has_eerr = current_user.has_permission("access_eerr_report")
    has_simulator = current_user.has_permission("access_simulator")
    has_admin = current_user.has_permission("access_admin_users")
    
    return render_template("admin_users.html",
                         users_with_roles=users_with_roles,
                         all_roles=roles,
                         active_page="admin_users",
                         has_access_eerr_report=has_eerr,
                         has_access_simulator=has_simulator,
                         has_access_admin_users=has_admin)


@app.route("/admin/users/create", methods=["GET", "POST"])
@permission_required("access_admin_users")
def admin_users_create():
    """Crear nuevo usuario."""
    from ynk_modelo.database import User as DBUser, Role, UserRole
    
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip() or None
        role_ids = [int(r) for r in request.form.getlist("roles") if r.isdigit()]
        
        # Validaciones
        if not username or not password or not full_name:
            return render_template("admin_users_form.html",
                error="Todos los campos obligatorios deben ser completados",
                roles=Role.list_all(),
                mode="create")
        
        # Verificar si el usuario ya existe
        if DBUser.get_by_username(username):
            return render_template("admin_users_form.html",
                error=f"El usuario '{username}' ya existe",
                roles=Role.list_all(),
                mode="create")
        
        try:
            # Crear usuario
            user = DBUser.create(username, password, full_name, email)
            
            # Asignar roles
            if role_ids:
                UserRole.set_user_roles(user.id, role_ids)
            
            logger.info(f"Usuario '{username}' creado por '{current_user.username}'")
            return redirect(url_for("admin_users"))
        
        except Exception as e:
            logger.error(f"Error al crear usuario: {e}", exc_info=True)
            return render_template("admin_users_form.html",
                error=f"Error al crear usuario: {str(e)}",
                roles=Role.list_all(),
                mode="create")
    
    return render_template("admin_users_form.html", 
                         roles=Role.list_all(),
                         mode="create")


@app.route("/admin/users/<int:user_id>/edit", methods=["GET", "POST"])
@permission_required("access_admin_users")
def admin_users_edit(user_id: int):
    """Editar usuario."""
    from ynk_modelo.database import User as DBUser, Role, UserRole
    
    user = DBUser.get_by_id(user_id)
    if not user:
        # Verificar si puede acceder al dashboard
        has_eerr = current_user.has_permission("access_eerr_report")
        has_simulator = current_user.has_permission("access_simulator")
        has_admin = current_user.has_permission("access_admin_users")
        has_rent_manager = current_user.has_permission("access_rent_manager")
        can_access_dashboard = has_eerr or has_simulator or has_admin or has_rent_manager
        
        return render_template("error.html", 
            error="Usuario no encontrado",
            error_code=404,
            can_access_dashboard=can_access_dashboard), 404
    
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip() or None
        is_active = request.form.get("is_active") == "on"
        role_ids = [int(r) for r in request.form.getlist("roles") if r.isdigit()]
        
        # Validaciones
        if not username or not full_name:
            return render_template("admin_users_form.html",
                error="Todos los campos obligatorios deben ser completados",
                user=user,
                roles=Role.list_all(),
                mode="edit")
        
        try:
            # Actualizar usuario
            user.username = username
            user.full_name = full_name
            user.email = email
            user.is_active = is_active
            
            # Actualizar contraseña si se proporcionó
            if password:
                user.set_password(password)
            
            user.update()
            
            # Actualizar roles
            UserRole.set_user_roles(user.id, role_ids)
            
            logger.info(f"Usuario '{username}' actualizado por '{current_user.username}'")
            return redirect(url_for("admin_users"))
        
        except Exception as e:
            logger.error(f"Error al actualizar usuario: {e}", exc_info=True)
            return render_template("admin_users_form.html",
                error=f"Error al actualizar usuario: {str(e)}",
                user=user,
                roles=Role.list_all(),
                mode="edit")
    
    # Obtener roles actuales del usuario
    user_role_ids = []
    for role in Role.list_all():
        if user.has_role(role.name):
            user_role_ids.append(role.id)
    
    return render_template("admin_users_form.html",
                         user=user,
                         roles=Role.list_all(),
                         user_role_ids=user_role_ids,
                         mode="edit")


@app.route("/admin/users/<int:user_id>/delete", methods=["POST"])
@permission_required("access_admin_users")
def admin_users_delete(user_id: int):
    """Eliminar usuario."""
    from ynk_modelo.database import User as DBUser
    
    user = DBUser.get_by_id(user_id)
    if not user:
        return {"error": "Usuario no encontrado"}, 404
    
    if user.id == current_user.id:
        return {"error": "No puedes eliminar tu propio usuario"}, 400
    
    try:
        username = user.username
        user.delete()
        logger.info(f"Usuario '{username}' eliminado por '{current_user.username}'")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error al eliminar usuario: {e}", exc_info=True)
        return {"error": str(e)}, 500


# ============================================================================
# GESTIÓN DE ROLES (requiere permiso access_admin_users)
# ============================================================================


@app.route("/admin/roles")
@permission_required("access_admin_users")
def admin_roles():
    """Lista de roles."""
    from ynk_modelo.database import Role, Permission
    
    roles = Role.list_all()
    permissions = Permission.list_all()
    
    # Obtener permisos de cada rol
    roles_with_permissions = []
    for role in roles:
        role_permissions = role.get_permissions()
        roles_with_permissions.append({
            "role": role,
            "permissions": role_permissions,
        })
    
    # Obtener permisos para el brand-bar
    has_eerr = current_user.has_permission("access_eerr_report")
    has_simulator = current_user.has_permission("access_simulator")
    has_admin = current_user.has_permission("access_admin_users")
    
    return render_template("admin_roles.html",
                         roles_with_permissions=roles_with_permissions,
                         all_permissions=permissions,
                         active_page="admin_roles",
                         has_access_eerr_report=has_eerr,
                         has_access_simulator=has_simulator,
                         has_access_admin_users=has_admin)


@app.route("/admin/roles/create", methods=["GET", "POST"])
@permission_required("access_admin_users")
def admin_roles_create():
    """Crear nuevo rol."""
    from ynk_modelo.database import Role, Permission
    
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        description = request.form.get("description", "").strip() or None
        permission_ids = [int(p) for p in request.form.getlist("permissions") if p.isdigit()]
        
        # Validaciones
        if not name:
            return render_template("admin_roles_form.html",
                error="El nombre del rol es obligatorio",
                permissions=Permission.list_all(),
                mode="create")
        
        # Verificar si el rol ya existe
        if Role.get_by_name(name):
            return render_template("admin_roles_form.html",
                error=f"El rol '{name}' ya existe",
                permissions=Permission.list_all(),
                mode="create")
        
        try:
            # Crear rol
            role = Role.create(name, description)
            
            # Asignar permisos
            if permission_ids:
                role.set_permissions(permission_ids)
            
            logger.info(f"Rol '{name}' creado por '{current_user.username}'")
            return redirect(url_for("admin_roles"))
        
        except Exception as e:
            logger.error(f"Error al crear rol: {e}", exc_info=True)
            return render_template("admin_roles_form.html",
                error=f"Error al crear rol: {str(e)}",
                permissions=Permission.list_all(),
                mode="create")
    
    return render_template("admin_roles_form.html",
                         permissions=Permission.list_all(),
                         mode="create")


@app.route("/admin/roles/<int:role_id>/edit", methods=["GET", "POST"])
@permission_required("access_admin_users")
def admin_roles_edit(role_id: int):
    """Editar rol."""
    from ynk_modelo.database import Role, Permission
    
    role = Role.get_by_id(role_id)
    if not role:
        has_eerr = current_user.has_permission("access_eerr_report")
        has_simulator = current_user.has_permission("access_simulator")
        has_admin = current_user.has_permission("access_admin_users")
        has_rent_manager = current_user.has_permission("access_rent_manager")
        can_access_dashboard = has_eerr or has_simulator or has_admin or has_rent_manager
        
        return render_template("error.html",
            error="Rol no encontrado",
            error_code=404,
            can_access_dashboard=can_access_dashboard), 404
    
    # No permitir editar el rol admin
    if role.name == "admin":
        return render_template("error.html",
            error="No se puede editar el rol 'admin'",
            error_code=403,
            can_access_dashboard=True), 403
    
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        description = request.form.get("description", "").strip() or None
        permission_ids = [int(p) for p in request.form.getlist("permissions") if p.isdigit()]
        
        # Validaciones
        if not name:
            return render_template("admin_roles_form.html",
                error="El nombre del rol es obligatorio",
                role=role,
                permissions=Permission.list_all(),
                mode="edit")
        
        # Verificar si el nombre ya existe (y no es el mismo rol)
        existing_role = Role.get_by_name(name)
        if existing_role and existing_role.id != role.id:
            return render_template("admin_roles_form.html",
                error=f"El rol '{name}' ya existe",
                role=role,
                permissions=Permission.list_all(),
                mode="edit")
        
        try:
            # Actualizar rol
            role.name = name
            role.description = description
            role.update()
            
            # Actualizar permisos
            role.set_permissions(permission_ids)
            
            logger.info(f"Rol '{name}' actualizado por '{current_user.username}'")
            return redirect(url_for("admin_roles"))
        
        except Exception as e:
            logger.error(f"Error al actualizar rol: {e}", exc_info=True)
            return render_template("admin_roles_form.html",
                error=f"Error al actualizar rol: {str(e)}",
                role=role,
                permissions=Permission.list_all(),
                mode="edit")
    
    # Obtener permisos actuales del rol
    role_permission_ids = role.get_permission_ids()
    
    return render_template("admin_roles_form.html",
                         role=role,
                         permissions=Permission.list_all(),
                         role_permission_ids=role_permission_ids,
                         mode="edit")


@app.route("/admin/roles/<int:role_id>/delete", methods=["POST"])
@permission_required("access_admin_users")
def admin_roles_delete(role_id: int):
    """Eliminar rol."""
    from ynk_modelo.database import Role
    
    role = Role.get_by_id(role_id)
    if not role:
        return {"error": "Rol no encontrado"}, 404
    
    # No permitir eliminar el rol admin
    if role.name == "admin":
        return {"error": "No se puede eliminar el rol 'admin'"}, 400
    
    try:
        role_name = role.name
        role.delete()
        logger.info(f"Rol '{role_name}' eliminado por '{current_user.username}'")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error al eliminar rol: {e}", exc_info=True)
        return {"error": str(e)}, 500


# ============================================================================
# GESTIÓN DE PERMISOS (requiere permiso access_admin_users)
# ============================================================================


@app.route("/admin/permissions")
@permission_required("access_admin_users")
def admin_permissions():
    """Lista de permisos."""
    from ynk_modelo.database import Permission
    
    permissions = Permission.list_all()
    
    # Obtener permisos para el brand-bar
    has_eerr = current_user.has_permission("access_eerr_report")
    has_simulator = current_user.has_permission("access_simulator")
    has_admin = current_user.has_permission("access_admin_users")
    
    return render_template("admin_permissions.html",
                         permissions=permissions,
                         active_page="admin_permissions",
                         has_access_eerr_report=has_eerr,
                         has_access_simulator=has_simulator,
                         has_access_admin_users=has_admin)


@app.route("/admin/permissions/create", methods=["GET", "POST"])
@permission_required("access_admin_users")
def admin_permissions_create():
    """Crear nuevo permiso."""
    from ynk_modelo.database import Permission
    
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        description = request.form.get("description", "").strip() or None
        resource = request.form.get("resource", "").strip() or None
        action = request.form.get("action", "").strip() or None
        
        # Validaciones
        if not name:
            return render_template("admin_permissions_form.html",
                error="El nombre del permiso es obligatorio",
                mode="create")
        
        # Verificar si el permiso ya existe
        if Permission.get_by_name(name):
            return render_template("admin_permissions_form.html",
                error=f"El permiso '{name}' ya existe",
                mode="create")
        
        try:
            # Crear permiso
            permission = Permission.create(name, description, resource, action)
            
            logger.info(f"Permiso '{name}' creado por '{current_user.username}'")
            return redirect(url_for("admin_permissions"))
        
        except Exception as e:
            logger.error(f"Error al crear permiso: {e}", exc_info=True)
            return render_template("admin_permissions_form.html",
                error=f"Error al crear permiso: {str(e)}",
                mode="create")
    
    return render_template("admin_permissions_form.html", mode="create")


@app.route("/admin/permissions/<int:permission_id>/edit", methods=["GET", "POST"])
@permission_required("access_admin_users")
def admin_permissions_edit(permission_id: int):
    """Editar permiso."""
    from ynk_modelo.database import Permission
    
    permission = Permission.get_by_id(permission_id)
    if not permission:
        has_eerr = current_user.has_permission("access_eerr_report")
        has_simulator = current_user.has_permission("access_simulator")
        has_admin = current_user.has_permission("access_admin_users")
        has_rent_manager = current_user.has_permission("access_rent_manager")
        can_access_dashboard = has_eerr or has_simulator or has_admin or has_rent_manager
        
        return render_template("error.html",
            error="Permiso no encontrado",
            error_code=404,
            can_access_dashboard=can_access_dashboard), 404
    
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        description = request.form.get("description", "").strip() or None
        resource = request.form.get("resource", "").strip() or None
        action = request.form.get("action", "").strip() or None
        
        # Validaciones
        if not name:
            return render_template("admin_permissions_form.html",
                error="El nombre del permiso es obligatorio",
                permission=permission,
                mode="edit")
        
        # Verificar si el nombre ya existe (y no es el mismo permiso)
        existing_permission = Permission.get_by_name(name)
        if existing_permission and existing_permission.id != permission.id:
            return render_template("admin_permissions_form.html",
                error=f"El permiso '{name}' ya existe",
                permission=permission,
                mode="edit")
        
        try:
            # Actualizar permiso
            permission.name = name
            permission.description = description
            permission.resource = resource
            permission.action = action
            permission.update()
            
            logger.info(f"Permiso '{name}' actualizado por '{current_user.username}'")
            return redirect(url_for("admin_permissions"))
        
        except Exception as e:
            logger.error(f"Error al actualizar permiso: {e}", exc_info=True)
            return render_template("admin_permissions_form.html",
                error=f"Error al actualizar permiso: {str(e)}",
                permission=permission,
                mode="edit")
    
    return render_template("admin_permissions_form.html",
                         permission=permission,
                         mode="edit")


@app.route("/admin/permissions/<int:permission_id>/delete", methods=["POST"])
@permission_required("access_admin_users")
def admin_permissions_delete(permission_id: int):
    """Eliminar permiso."""
    from ynk_modelo.database import Permission
    
    permission = Permission.get_by_id(permission_id)
    if not permission:
        return {"error": "Permiso no encontrado"}, 404
    
    try:
        permission_name = permission.name
        permission.delete()
        logger.info(f"Permiso '{permission_name}' eliminado por '{current_user.username}'")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error al eliminar permiso: {e}", exc_info=True)
        return {"error": str(e)}, 500


# ============================================================================
# INICIALIZACIÓN DEL SERVIDOR
# ============================================================================


def run_server(host: str = "0.0.0.0", port: int = PORT) -> None:
    """Inicia el servidor Flask."""
    logger.info("=" * 70)
    logger.info("YNK Modelo - Servidor Flask con Autenticación")
    logger.info("=" * 70)
    logger.info(f"Ambiente: {'PRODUCCIÓN' if IS_PRODUCTION else 'LOCAL'}")
    logger.info(f"Auto-verificación: {'ACTIVADA' if IS_PRODUCTION else 'DESACTIVADA'}")
    logger.info(f"Servidor: http://{host}:{port}")
    logger.info("-" * 70)
    logger.info("Páginas disponibles:")
    logger.info(f"  • http://localhost:{port}/login")
    logger.info(f"  • http://localhost:{port}/EERR_por_tienda.html")
    logger.info(f"  • http://localhost:{port}/Simulador_EERR.html")
    logger.info("-" * 70)
    logger.info("Endpoints API:")
    logger.info(f"  • http://localhost:{port}/api/check   - Verificar y regenerar")
    logger.info(f"  • http://localhost:{port}/api/status  - Estado del sistema")
    logger.info("=" * 70)
    logger.info("✓ Autenticación activada - Se requiere login para acceder")
    logger.info("")

    app.run(host=host, port=port, debug=False)


def main() -> None:
    """Entry point del comando ynk-server-auth."""
    parser = argparse.ArgumentParser(description="Servidor Flask con autenticación")
    parser.add_argument("--host", default="0.0.0.0", help="Host del servidor")
    parser.add_argument("--port", type=int, default=PORT, help="Puerto del servidor")

    args = parser.parse_args()
    run_server(args.host, args.port)


if __name__ == "__main__":
    main()
