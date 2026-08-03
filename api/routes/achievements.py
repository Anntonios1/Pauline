import re

from api.routes.auth import get_user_from_token
from api.services.achievements import evaluar_logros, obtener_logros_usuario


def get_my_achievements(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    evaluar_logros(usuario["id"])
    return obtener_logros_usuario(usuario["id"])


routes = [
    (re.compile(r"^/api/logros$"), ["GET"], get_my_achievements),
]
