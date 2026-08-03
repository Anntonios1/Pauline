import re
from api.models import Usuario, Inscripcion
from api.services.users import (
    crear_usuario, listar_usuarios, obtener_usuario_por_id, actualizar_usuario,
    inscribir_usuario, listar_cursos_usuario, listar_estudiantes_curso
)
from api.routes.auth import require_role, require_auth, get_user_from_token
from api.services.sessions import cerrar_sesiones_usuario
from api.utils.helpers import hash_password, verify_password, generar_password_temporal
from api.utils.upload import encrypt_and_save_avatar, UploadError


def validate_usuario(body):
    required = ["codigo", "nombre_visible", "password", "rol"]
    for field in required:
        if field not in body:
            return f"Campo requerido: {field}", None
    if body["rol"] not in ["estudiante", "docente", "administrador"]:
        return "Rol invalido", None
    if len(body.get("password", "")) < 8:
        return "La contraseña debe tener al menos 8 caracteres", None
    return None, body


def create_user(handler, params, query, body):
    # Solo un administrador crea cuentas: la ruta nunca es pública.
    _, auth_error = require_role(handler, ["administrador"])
    if auth_error:
        return auth_error
    error, data = validate_usuario(body)
    if error:
        return {"error": error}, 400
    usuario = Usuario(
        codigo=body["codigo"],
        correo=body.get("correo"),
        nombre_visible=body["nombre_visible"],
        password_hash=hash_password(body["password"]),
        rol=body["rol"],
        activo=body.get("activo", 1),
    )
    try:
        return crear_usuario(usuario)
    except Exception as e:
        return {"error": str(e)}, 400


def list_users(handler, params, query, body):
    sesion, error = require_auth(handler)
    if error:
        return error
    rol = query.get("rol")
    activos = query.get("activos", "true").lower() == "true"
    return listar_usuarios(rol=rol, activos=activos)


def get_user(handler, params, query, body):
    _, error = require_auth(handler)
    if error:
        return error
    usuario_id = int(params["id"])
    return obtener_usuario_por_id(usuario_id) or ({"error": "Usuario no encontrado"}, 404)


# Campos que una persona puede cambiarse a sí misma. `rol`, `activo` y `codigo`
# quedan fuera a propósito: actualizar_usuario los acepta, así que pasar el body
# sin filtrar permitiría auto-ascenderse a administrador.
CAMPOS_PROPIOS_EDITABLES = ("nombre_visible", "correo", "imagen_perfil")


def update_user(handler, params, query, body):
    solicitante = get_user_from_token(handler)
    if not solicitante:
        return {"error": "Autenticacion requerida"}, 401
    usuario_id = int(params["id"])
    # Only admins can update other users; others can only update themselves
    if solicitante["rol"] != "administrador" and solicitante["id"] != usuario_id:
        return {"error": "No tienes permiso para modificar este usuario"}, 403
    if solicitante["rol"] == "administrador":
        datos = dict(body)
    else:
        # Sin privilegios solo se editan los campos propios: nada de rol, codigo
        # ni activo, que actualizar_usuario aceptaría sin rechistar.
        datos = {campo: body[campo] for campo in CAMPOS_PROPIOS_EDITABLES if campo in body}
        if "password" in body:
            datos["password"] = body["password"]
    if "password" in datos:
        if len(datos["password"]) < 8:
            return {"error": "La contraseña debe tener al menos 8 caracteres"}, 400
        datos["password_hash"] = hash_password(datos.pop("password"))
    return actualizar_usuario(usuario_id, datos) or ({"error": "Usuario no encontrado"}, 404)


def update_my_profile(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    datos = {campo: body[campo] for campo in CAMPOS_PROPIOS_EDITABLES if campo in body}
    if "password" in body:
        if len(body["password"]) < 8:
            return {"error": "La contraseña debe tener al menos 8 caracteres"}, 400
        datos["password_hash"] = hash_password(body["password"])
    return actualizar_usuario(usuario["id"], datos) or ({"error": "Usuario no encontrado"}, 404)


def upload_avatar(handler, params, query, body):
    """Sube imagen de perfil. Acepta 'avatar' en multipart/form-data."""
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401

    file_info = body.get("avatar")
    if not file_info or not isinstance(file_info, dict):
        return {"error": "Debe enviar un archivo llamado 'avatar'"}, 400

    try:
        # Cifrada en disco: la ruta apunta a un archivo .avatarenc que solo
        # serve_upload puede descifrar (ver api/utils/upload.py).
        path = encrypt_and_save_avatar(file_info["data"], file_info["mime_type"], max_width=400, quality=80)
        return actualizar_usuario(usuario["id"], {"imagen_perfil": path})
    except UploadError as e:
        return {"error": str(e)}, 400


def enroll_user(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    for campo in ("usuario_id", "curso_id", "rol_en_curso"):
        if campo not in body:
            return {"error": f"Campo requerido: {campo}"}, 400
    inscripcion = Inscripcion(
        usuario_id=body["usuario_id"],
        curso_id=body["curso_id"],
        rol_en_curso=body["rol_en_curso"],
    )
    try:
        return inscribir_usuario(inscripcion)
    except Exception as e:
        return {"error": str(e)}, 400


def get_user_courses(handler, params, query, body):
    solicitante = get_user_from_token(handler)
    if not solicitante:
        return {"error": "Autenticacion requerida"}, 401
    usuario_id = int(params["id"])
    if solicitante["rol"] == "estudiante" and solicitante["id"] != usuario_id:
        return {"error": "No tienes permiso para ver estos cursos"}, 403
    return listar_cursos_usuario(usuario_id)


def reset_user_password(handler, params, query, body):
    """Reseteo asistido: no hay correo configurado en este proyecto, así que
    el docente/admin genera una contraseña temporal y se la entrega en
    persona. Se devuelve en claro UNA sola vez en esta respuesta — nunca se
    guarda ni se registra en texto plano.
    """
    solicitante, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    usuario_id = int(params["id"])
    objetivo = obtener_usuario_por_id(usuario_id)
    if not objetivo:
        return {"error": "Usuario no encontrado"}, 404
    # Un docente solo puede resetear a sus estudiantes: si pudiera resetear a
    # otro docente o a un admin, sería una vía de escalada de privilegios.
    if solicitante["rol"] != "administrador" and objetivo["rol"] != "estudiante":
        return {"error": "Solo puedes restablecer contraseñas de estudiantes"}, 403

    temporal = generar_password_temporal()
    actualizar_usuario(usuario_id, {"password_hash": hash_password(temporal)})
    # Fuerza a que cualquier sesión abierta con la contraseña vieja se cierre.
    cerrar_sesiones_usuario(usuario_id)
    return {"password_temporal": temporal, "usuario_id": usuario_id, "codigo": objetivo["codigo"]}


def get_course_students(handler, params, query, body):
    # El listado trae codigo y correo de cada estudiante: es una lista de clase,
    # no un recurso público.
    _, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    curso_id = int(params["id"])
    return listar_estudiantes_curso(curso_id)


routes = [
    (re.compile(r"^/api/users$"), ["POST"], create_user),
    (re.compile(r"^/api/users$"), ["GET"], list_users),
    (re.compile(r"^/api/users/me$"), ["PUT", "PATCH"], update_my_profile),
    (re.compile(r"^/api/users/me/avatar$"), ["POST"], upload_avatar),
    (re.compile(r"^/api/users/(?P<id>\d+)$"), ["GET"], get_user),
    (re.compile(r"^/api/users/(?P<id>\d+)$"), ["PUT", "PATCH"], update_user),
    (re.compile(r"^/api/users/(?P<id>\d+)/reset-password$"), ["POST"], reset_user_password),
    (re.compile(r"^/api/users/(?P<id>\d+)/courses$"), ["GET"], get_user_courses),
    (re.compile(r"^/api/users/enroll$"), ["POST"], enroll_user),
    (re.compile(r"^/api/courses/(?P<id>\d+)/students$"), ["GET"], get_course_students),
]
