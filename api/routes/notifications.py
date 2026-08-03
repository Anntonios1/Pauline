import re

from api.routes.auth import get_user_from_token
from api.services.notifications import listar_notificaciones, marcar_leida, marcar_todas_leidas


def list_notifications(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    solo_no_leidas = query.get("solo_no_leidas", "false").lower() == "true"
    return listar_notificaciones(usuario["id"], solo_no_leidas=solo_no_leidas)


def mark_notification_read(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    notificacion_id = int(params["id"])
    if not marcar_leida(notificacion_id, usuario["id"]):
        return {"error": "Notificacion no encontrada"}, 404
    return {"message": "Notificacion marcada como leida"}


def mark_all_notifications_read(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    total = marcar_todas_leidas(usuario["id"])
    return {"message": "Notificaciones marcadas como leidas", "total": total}


routes = [
    (re.compile(r"^/api/notifications$"), ["GET"], list_notifications),
    (re.compile(r"^/api/notifications/(?P<id>\d+)/read$"), ["POST"], mark_notification_read),
    (re.compile(r"^/api/notifications/read-all$"), ["POST"], mark_all_notifications_read),
]
