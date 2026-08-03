import re
from api.services.users import obtener_usuario_por_codigo, obtener_usuario_por_id, registrar_acceso
from api.services.sessions import crear_sesion, obtener_sesion_por_token, cerrar_sesion
from api.utils.helpers import verify_password, generate_token
from api.utils.security import login_limiter, get_client_key


def get_auth_token(handler):
    """Funciona con http.server handler y con FastAPI RequestAdapter."""
    auth = handler.headers.get("Authorization") or handler.headers.get("authorization") or ""
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def _get_client_ip(handler):
    """Obtiene IP del cliente de forma compatible con ambos tipos de handler."""
    try:
        return handler.client_address[0]
    except Exception:
        return "127.0.0.1"


def login(handler, params, query, body):
    codigo = body.get("codigo")
    password = body.get("password")
    if not codigo or not password:
        return {"error": "codigo y password son requeridos"}, 400

    # Rate limiting por IP + codigo
    key = get_client_key(handler, codigo)
    if login_limiter.is_blocked(key):
        return {"error": "Demasiados intentos fallidos. Intenta mas tarde."}, 429

    usuario = obtener_usuario_por_codigo(codigo)
    if not usuario:
        login_limiter.record_attempt(key)
        return {"error": "Credenciales invalidas"}, 401
    if not verify_password(password, usuario["password_hash"]):
        login_limiter.record_attempt(key)
        return {"error": "Credenciales invalidas"}, 401

    # Resetear intentos al lograr login
    login_limiter.reset(key)

    registrar_acceso(usuario["id"])
    token = generate_token()
    ip = _get_client_ip(handler)
    user_agent = handler.headers.get("User-Agent") or handler.headers.get("user-agent") or ""
    crear_sesion(usuario["id"], token, ip=ip, user_agent=user_agent)
    return {"token": token, "usuario": {k: v for k, v in usuario.items() if k != "password_hash"}}


def logout(handler, params, query, body):
    token = get_auth_token(handler)
    if token:
        cerrar_sesion(token)
    return {"message": "Sesion cerrada"}


def get_current_user(handler, params, query, body):
    token = get_auth_token(handler)
    if not token:
        return {"error": "Token requerido"}, 401
    sesion = obtener_sesion_por_token(token)
    if not sesion:
        return {"error": "Token invalido o expirado"}, 401
    usuario = obtener_usuario_por_id(sesion["usuario_id"])
    if not usuario:
        return {"error": "Usuario no encontrado"}, 404
    return {"usuario": {k: v for k, v in usuario.items() if k != "password_hash"}}


def require_auth(handler):
    """Requiere autenticacion. Devuelve (sesion, None) o (None, (error, status))."""
    token = get_auth_token(handler)
    if not token:
        return None, ({"error": "Autenticacion requerida"}, 401)
    sesion = obtener_sesion_por_token(token)
    if not sesion:
        return None, ({"error": "Token invalido o expirado"}, 401)
    return sesion, None


routes = [
    (re.compile(r"^/api/auth/login$"), ["POST"], login),
    (re.compile(r"^/api/auth/logout$"), ["POST"], logout),
    (re.compile(r"^/api/auth/me$"), ["GET"], get_current_user),
]


def get_user_from_token(handler):
    token = get_auth_token(handler)
    if not token:
        return None
    sesion = obtener_sesion_por_token(token)
    if not sesion:
        return None
    from api.services.users import obtener_usuario_por_id
    return obtener_usuario_por_id(sesion["usuario_id"])


def require_role(handler, roles):
    usuario = get_user_from_token(handler)
    if not usuario:
        return None, ({"error": "Autenticacion requerida"}, 401)
    if usuario["rol"] not in roles:
        return None, ({"error": "Permisos insuficientes"}, 403)
    return usuario, None
