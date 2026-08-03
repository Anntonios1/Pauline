import re
from api.models import Pregunta
from api.services.activities import (
    crear_pregunta, listar_preguntas_por_actividad, obtener_pregunta_por_id,
    actualizar_pregunta, eliminar_pregunta
)
from api.routes.auth import require_role, get_user_from_token


# La clave de una pregunta legacy solo la ve quien la administra: devolverla al
# estudiante equivale a publicar el solucionario antes del intento.
CAMPOS_SOLO_STAFF = ("respuesta_correcta", "explicacion")


def puede_ver_respuestas(usuario) -> bool:
    return bool(usuario) and usuario["rol"] in ("docente", "administrador")


def sin_respuestas(pregunta: dict) -> dict:
    return {k: v for k, v in pregunta.items() if k not in CAMPOS_SOLO_STAFF}


def validate_question(body):
    if body.get("tipo") in ("opcion_multiple", "verdadero_falso") and not body.get("opciones"):
        return "Las preguntas de opcion multiple y verdadero/falso requieren opciones"
    return None


def create_question(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    for campo in ("actividad_id", "orden", "enunciado", "respuesta_correcta"):
        if campo not in body or body[campo] is None:
            return {"error": f"Campo requerido: {campo}"}, 400
    validation = validate_question(body)
    if validation:
        return {"error": validation}, 400
    pregunta = Pregunta(
        actividad_id=body["actividad_id"],
        orden=body["orden"],
        tipo=body.get("tipo", "opcion_multiple"),
        enunciado=body["enunciado"],
        opciones=body.get("opciones"),
        respuesta_correcta=body["respuesta_correcta"],
        explicacion=body.get("explicacion"),
        imagen_url=body.get("imagen_url"),
        puntaje=body.get("puntaje", 1),
        obligatoria=body.get("obligatoria", 1),
    )
    return crear_pregunta(pregunta)


def list_questions(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    actividad_id = int(params["id"])
    preguntas = listar_preguntas_por_actividad(actividad_id)
    if puede_ver_respuestas(usuario):
        return preguntas
    return [sin_respuestas(p) for p in preguntas]


def get_question(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    pregunta_id = int(params["id"])
    pregunta = obtener_pregunta_por_id(pregunta_id)
    if not pregunta:
        return {"error": "Pregunta no encontrada"}, 404
    return pregunta if puede_ver_respuestas(usuario) else sin_respuestas(pregunta)


def update_question(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    pregunta_id = int(params["id"])
    return actualizar_pregunta(pregunta_id, body) or ({"error": "Pregunta no encontrada"}, 404)


def delete_question(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    pregunta_id = int(params["id"])
    eliminar_pregunta(pregunta_id)
    return {"message": "Pregunta eliminada"}


routes = [
    (re.compile(r"^/api/questions$"), ["POST"], create_question),
    (re.compile(r"^/api/activities/(?P<id>\d+)/questions$"), ["GET"], list_questions),
    (re.compile(r"^/api/questions/(?P<id>\d+)$"), ["GET"], get_question),
    (re.compile(r"^/api/questions/(?P<id>\d+)$"), ["PUT", "PATCH"], update_question),
    (re.compile(r"^/api/questions/(?P<id>\d+)$"), ["DELETE"], delete_question),
]
