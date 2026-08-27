import re
from api.services.learning_path import (
    obtener_ruta_estudiante, listar_pasos_ruta, crear_paso_ruta,
    actualizar_paso_ruta, eliminar_paso_ruta, reordenar_pasos,
    obtener_paso_por_id, RutaPasoValidationError,
)
from api.routes.auth import get_user_from_token, require_role


def get_learning_path(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    return obtener_ruta_estudiante(usuario["id"])


def list_route_steps(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    categoria_id = query.get("categoria_id")
    try:
        categoria_id = int(categoria_id) if categoria_id not in (None, "") else None
    except ValueError:
        return {"error": "categoria_id debe ser un entero"}, 400
    return listar_pasos_ruta(categoria_id=categoria_id)


def create_route_step(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    try:
        return crear_paso_ruta(body, usuario["id"])
    except RutaPasoValidationError as exc:
        return {"error": str(exc)}, 400


def update_route_step(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    paso_id = int(params["id"])
    if not obtener_paso_por_id(paso_id):
        return {"error": "Paso no encontrado"}, 404
    try:
        return actualizar_paso_ruta(paso_id, body)
    except RutaPasoValidationError as exc:
        return {"error": str(exc)}, 400


def delete_route_step(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    paso_id = int(params["id"])
    if not obtener_paso_por_id(paso_id):
        return {"error": "Paso no encontrado"}, 404
    eliminar_paso_ruta(paso_id)
    return {"message": "Paso eliminado"}


def reorder_route_steps(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    categoria_id = body.get("categoria_id")
    ordered_ids = body.get("ordered_ids")
    if not categoria_id or not isinstance(ordered_ids, list) or not ordered_ids:
        return {"error": "categoria_id y ordered_ids (lista) son requeridos"}, 400
    try:
        return reordenar_pasos(int(categoria_id), [int(i) for i in ordered_ids])
    except (RutaPasoValidationError, ValueError, TypeError) as exc:
        return {"error": str(exc)}, 400


routes = [
    (re.compile(r"^/api/learning-path$"), ["GET"], get_learning_path),
    (re.compile(r"^/api/route-steps$"), ["GET"], list_route_steps),
    (re.compile(r"^/api/route-steps$"), ["POST"], create_route_step),
    (re.compile(r"^/api/route-steps/reorder$"), ["POST"], reorder_route_steps),
    (re.compile(r"^/api/route-steps/(?P<id>\d+)$"), ["PATCH", "PUT"], update_route_step),
    (re.compile(r"^/api/route-steps/(?P<id>\d+)$"), ["DELETE"], delete_route_step),
]
