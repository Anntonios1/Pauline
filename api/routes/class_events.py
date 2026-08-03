import re

from api.routes.auth import get_user_from_token, require_role
from api.services.class_events import (
    actualizar_evento_clase,
    crear_evento_clase,
    listar_eventos_clase,
    obtener_evento_clase,
)


def list_class_events(handler, params, query, body):
    user = get_user_from_token(handler)
    if not user:
        return {"error": "Autenticacion requerida"}, 401
    mine = query.get("mine", "false").lower() == "true"
    include_past = query.get("include_past", "false").lower() == "true"
    return listar_eventos_clase(
        creador_id=user["id"] if mine else None,
        incluir_pasados=include_past,
    )


def create_class_event(handler, params, query, body):
    user, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    if not body.get("titulo") or not body.get("fecha_inicio"):
        return {"error": "titulo y fecha_inicio son requeridos"}, 400
    try:
        return crear_evento_clase(body, user["id"]), 201
    except Exception as exc:
        return {"error": str(exc)}, 400


def update_class_event(handler, params, query, body):
    user, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    event = obtener_evento_clase(int(params["id"]))
    if not event:
        return {"error": "Evento no encontrado"}, 404
    if user["rol"] != "administrador" and event["creado_por"] != user["id"]:
        return {"error": "No puedes editar este evento"}, 403
    return actualizar_evento_clase(event["id"], body)


def delete_class_event(handler, params, query, body):
    return update_class_event(handler, params, query, {"activo": 0})


routes = [
    (re.compile(r"^/api/class-events$"), ["GET"], list_class_events),
    (re.compile(r"^/api/class-events$"), ["POST"], create_class_event),
    (re.compile(r"^/api/class-events/(?P<id>\d+)$"), ["PATCH", "PUT"], update_class_event),
    (re.compile(r"^/api/class-events/(?P<id>\d+)$"), ["DELETE"], delete_class_event),
]
