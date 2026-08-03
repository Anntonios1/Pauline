import re
from api.models import EventoAprendizaje
from api.services.comments_events import registrar_evento, listar_eventos
from api.routes.auth import get_user_from_token


def create_event(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    for campo in ("verbo", "objeto_tipo", "objeto_id"):
        if campo not in body:
            return {"error": f"Campo requerido: {campo}"}, 400
    try:
        objeto_id = int(body["objeto_id"])
    except (TypeError, ValueError):
        return {"error": "objeto_id debe ser un numero"}, 400
    evento = EventoAprendizaje(
        evento_id=body.get("evento_id"),
        actor_id=usuario["id"],
        sesion_id=body.get("sesion_id"),
        verbo=body["verbo"],
        objeto_tipo=body["objeto_tipo"],
        objeto_id=objeto_id,
        resultado=body.get("resultado"),
        contexto=body.get("contexto"),
    )
    return registrar_evento(evento)


def list_events(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    actor_id = query.get("actor_id")
    objeto_tipo = query.get("objeto_tipo")
    objeto_id = query.get("objeto_id")
    if actor_id:
        actor_id = int(actor_id)
    if objeto_id:
        objeto_id = int(objeto_id)
    # El historial ajeno es del staff; el estudiante solo consulta el suyo.
    if usuario["rol"] == "estudiante":
        actor_id = usuario["id"]
    return listar_eventos(actor_id=actor_id, objeto_tipo=objeto_tipo, objeto_id=objeto_id)


routes = [
    (re.compile(r"^/api/events$"), ["POST"], create_event),
    (re.compile(r"^/api/events$"), ["GET"], list_events),
]
