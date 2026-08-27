import re
from api.services.tags import (
    listar_etiquetas, crear_etiqueta, listar_etiquetas_de_publicacion,
    asignar_etiquetas, EtiquetaValidationError,
)
from api.services.publications import obtener_publicacion_por_id
from api.routes.auth import get_user_from_token, require_role


def list_tags(handler, params, query, body):
    return listar_etiquetas()


def create_tag(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    try:
        return crear_etiqueta(body.get("nombre"))
    except EtiquetaValidationError as exc:
        return {"error": str(exc)}, 400


def get_publication_tags(handler, params, query, body):
    publicacion_id = int(params["id"])
    if not obtener_publicacion_por_id(publicacion_id):
        return {"error": "Publicacion no encontrada"}, 404
    return listar_etiquetas_de_publicacion(publicacion_id)


def set_publication_tags(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    publicacion_id = int(params["id"])
    publicacion = obtener_publicacion_por_id(publicacion_id)
    if not publicacion:
        return {"error": "Publicacion no encontrada"}, 404
    es_staff = usuario["rol"] in {"docente", "administrador"}
    if not es_staff and publicacion["autor_id"] != usuario["id"]:
        return {"error": "No tienes permiso para etiquetar esta publicacion"}, 403
    try:
        return asignar_etiquetas(publicacion_id, body.get("etiquetas", []))
    except EtiquetaValidationError as exc:
        return {"error": str(exc)}, 400


routes = [
    (re.compile(r"^/api/tags$"), ["GET"], list_tags),
    (re.compile(r"^/api/tags$"), ["POST"], create_tag),
    (re.compile(r"^/api/publications/(?P<id>\d+)/tags$"), ["GET"], get_publication_tags),
    (re.compile(r"^/api/publications/(?P<id>\d+)/tags$"), ["PUT", "POST"], set_publication_tags),
]
