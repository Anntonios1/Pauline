import re
from api.models import Recurso
from api.services.resources import (
    crear_recurso, listar_recursos, obtener_recurso_por_id, actualizar_recurso,
    aprobar_recurso, rechazar_recurso, eliminar_recurso, listar_recursos_publicacion,
    agregar_recurso_publicacion, listar_recursos_actividad, agregar_recurso_actividad
)
from api.routes.auth import get_user_from_token, require_role
from api.utils.upload import save_quiz_media, serialize_upload_asset, UploadError


def create_resource(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    for campo in ("titulo", "tipo", "archivo_o_url"):
        if not body.get(campo):
            return {"error": f"Campo requerido: {campo}"}, 400
    recurso = Recurso(
        titulo=body["titulo"],
        descripcion=body.get("descripcion"),
        tipo=body["tipo"],
        archivo_o_url=body["archivo_o_url"],
        mime_type=body.get("mime_type"),
        tamano_bytes=body.get("tamano_bytes"),
        area=body.get("area"),
        categoria_id=body.get("categoria_id"),
        fuente=body.get("fuente"),
        licencia=body.get("licencia"),
        subido_por=usuario["id"],
    )
    created = crear_recurso(recurso)
    # El material subido directamente por un docente ya está curado para su clase.
    if usuario["rol"] in ("docente", "administrador"):
        return aprobar_recurso(created["id"], usuario["id"])
    return created


def list_resources(handler, params, query, body):
    area = query.get("area")
    tipo = query.get("tipo")
    estado = query.get("estado", "aprobado")
    activos = query.get("activos", "true").lower() == "true"
    subido_por = query.get("subido_por")
    try:
        subido_por = int(subido_por) if subido_por not in (None, "") else None
    except ValueError:
        return {"error": "subido_por debe ser un entero"}, 400
    # La cola de recursos sin aprobar solo la ve el staff, o el propio autor.
    if estado != "aprobado":
        usuario = get_user_from_token(handler)
        es_staff = bool(usuario) and usuario["rol"] in ("docente", "administrador")
        es_propio_autor = bool(usuario) and subido_por is not None and subido_por == usuario["id"]
        if not es_staff and not es_propio_autor:
            return {"error": "No tienes permiso para listar recursos en este estado"}, 403
    q = (query.get("q") or query.get("search") or "").strip()[:200] or None
    return listar_recursos(area=area, tipo=tipo, estado=estado, activos=activos, subido_por=subido_por, q=q)


def upload_resource_media(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    file_info = body.get("file") or body.get("archivo")
    if not isinstance(file_info, dict):
        return {"error": "Debe enviar un archivo en el campo 'file'"}, 400
    try:
        asset = save_quiz_media(
            file_info.get("data"), file_info.get("mime_type"), file_info.get("filename")
        )
        return serialize_upload_asset(asset), 201
    except UploadError as exc:
        return {"error": str(exc)}, 400


def get_resource(handler, params, query, body):
    recurso_id = int(params["id"])
    return obtener_recurso_por_id(recurso_id) or ({"error": "Recurso no encontrado"}, 404)


def update_resource(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    recurso_id = int(params["id"])
    recurso = obtener_recurso_por_id(recurso_id)
    if not recurso:
        return {"error": "Recurso no encontrado"}, 404
    # Only the uploader or a docente/admin can update
    if usuario["rol"] == "estudiante" and recurso.get("subido_por") != usuario["id"]:
        return {"error": "No tienes permiso para editar este recurso"}, 403
    # La aprobación es un flujo aparte: un estudiante no se autoaprueba el recurso.
    if usuario["rol"] == "estudiante":
        for campo in ("estado_aprobacion", "aprobado_por", "fecha_aprobacion"):
            body.pop(campo, None)
    return actualizar_recurso(recurso_id, body) or ({"error": "Recurso no encontrado"}, 404)


def approve_resource(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    recurso_id = int(params["id"])
    # Use the authenticated user's id, not body.docente_id (prevents privilege escalation)
    return aprobar_recurso(recurso_id, usuario["id"])


def reject_resource(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    recurso_id = int(params["id"])
    if not obtener_recurso_por_id(recurso_id):
        return {"error": "Recurso no encontrado"}, 404
    return rechazar_recurso(recurso_id, usuario["id"])


def delete_resource(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    recurso_id = int(params["id"])
    eliminar_recurso(recurso_id)
    return {"message": "Recurso desactivado"}


def _leer_recurso_id(body):
    """Devuelve (recurso_id, None) o (None, respuesta_de_error)."""
    if not body.get("recurso_id"):
        return None, ({"error": "Campo requerido: recurso_id"}, 400)
    try:
        recurso_id = int(body["recurso_id"])
    except (TypeError, ValueError):
        return None, ({"error": "recurso_id debe ser un entero"}, 400)
    if not obtener_recurso_por_id(recurso_id):
        return None, ({"error": "Recurso no encontrado"}, 404)
    return recurso_id, None


def add_resource_to_publication(handler, params, query, body):
    _, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    recurso_id, error = _leer_recurso_id(body)
    if error:
        return error
    publicacion_id = int(params["id"])
    agregar_recurso_publicacion(publicacion_id, recurso_id, body.get("orden", 1))
    return {"message": "Recurso agregado a publicacion"}


def add_resource_to_activity(handler, params, query, body):
    _, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    recurso_id, error = _leer_recurso_id(body)
    if error:
        return error
    actividad_id = int(params["id"])
    agregar_recurso_actividad(actividad_id, recurso_id, body.get("orden", 1))
    return {"message": "Recurso agregado a actividad"}


def get_publication_resources(handler, params, query, body):
    publicacion_id = int(params["id"])
    return listar_recursos_publicacion(publicacion_id)


def get_activity_resources(handler, params, query, body):
    actividad_id = int(params["id"])
    return listar_recursos_actividad(actividad_id)


routes = [
    (re.compile(r"^/api/resource-media$"), ["POST"], upload_resource_media),
    (re.compile(r"^/api/resources$"), ["POST"], create_resource),
    (re.compile(r"^/api/resources$"), ["GET"], list_resources),
    (re.compile(r"^/api/resources/(?P<id>\d+)$"), ["GET"], get_resource),
    (re.compile(r"^/api/resources/(?P<id>\d+)$"), ["PUT", "PATCH"], update_resource),
    (re.compile(r"^/api/resources/(?P<id>\d+)/approve$"), ["POST"], approve_resource),
    (re.compile(r"^/api/resources/(?P<id>\d+)/reject$"), ["POST"], reject_resource),
    (re.compile(r"^/api/resources/(?P<id>\d+)$"), ["DELETE"], delete_resource),
    (re.compile(r"^/api/publications/(?P<id>\d+)/resources$"), ["POST"], add_resource_to_publication),
    (re.compile(r"^/api/publications/(?P<id>\d+)/resources$"), ["GET"], get_publication_resources),
    (re.compile(r"^/api/activities/(?P<id>\d+)/resources$"), ["POST"], add_resource_to_activity),
    (re.compile(r"^/api/activities/(?P<id>\d+)/resources$"), ["GET"], get_activity_resources),
]
