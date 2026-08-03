import re
from api.services.activities import (
    crear_intento, obtener_intento_por_id, listar_intentos_estudiante,
    listar_intentos_actividad, guardar_respuestas_intento, listar_respuestas_intento,
    obtener_progreso_estudiante
)
from api.routes.auth import get_user_from_token, require_role
from api.services.achievements import evaluar_logros


def create_attempt(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    if usuario["rol"] != "estudiante":
        return {"error": "Solo los estudiantes pueden iniciar intentos"}, 403
    if not body.get("actividad_id"):
        return {"error": "Campo requerido: actividad_id"}, 400
    actividad_id = int(body["actividad_id"])
    # Check intentos_maximos before creating
    from api.services.activities import obtener_actividad_por_id, contar_intentos
    actividad = obtener_actividad_por_id(actividad_id)
    if not actividad:
        return {"error": "Actividad no encontrada"}, 404
    if not actividad.get("activa"):
        return {"error": "Actividad no disponible"}, 400
    from api.services.quizzes import obtener_quiz_meta
    quiz_meta = obtener_quiz_meta(actividad_id)
    if quiz_meta and quiz_meta["estado"] != "publicado":
        return {"error": "Este quiz todavía no está publicado"}, 400
    num_intentos = contar_intentos(usuario["id"], actividad_id)
    if num_intentos >= actividad.get("intentos_maximos", 1):
        return {"error": f"Has alcanzado el maximo de intentos ({actividad['intentos_maximos']}) para esta actividad"}, 400
    return crear_intento(usuario["id"], actividad_id)


def submit_attempt(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    intento_id = int(params["id"])
    intento = obtener_intento_por_id(intento_id)
    if not intento:
        return {"error": "Intento no encontrado"}, 404
    # Verify ownership: only the student who created the intento can submit it
    if intento["estudiante_id"] != usuario["id"]:
        return {"error": "No tienes permiso para responder este intento"}, 403
    if intento["estado"] != "iniciado":
        return {"error": "Este intento ya fue completado"}, 400
    if "respuestas" not in body:
        return {"error": "Campo requerido: respuestas"}, 400
    respuestas = body.get("respuestas", [])
    if intento.get("quiz_version") is not None:
        from api.services.quizzes import QuizValidationError, guardar_respuestas_quiz
        try:
            resultado = guardar_respuestas_quiz(intento_id, respuestas)
        except QuizValidationError as exc:
            return {"error": str(exc)}, 400
    else:
        if not respuestas:
            return {"error": "respuestas debe ser una lista no vacía"}, 400
        resultado = guardar_respuestas_intento(intento_id, respuestas)
    if not resultado:
        return {"error": "Intento no encontrado"}, 404
    evaluar_logros(usuario["id"])
    return resultado


def get_attempt(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    intento_id = int(params["id"])
    intento = obtener_intento_por_id(intento_id)
    if not intento:
        return {"error": "Intento no encontrado"}, 404
    if usuario["rol"] == "estudiante" and intento["estudiante_id"] != usuario["id"]:
        return {"error": "No tienes permiso para ver este intento"}, 403
    if intento.get("quiz_version") is not None:
        from api.services.quizzes import listar_respuestas_quiz
        intento["respuestas"] = listar_respuestas_quiz(intento_id)
    else:
        intento["respuestas"] = listar_respuestas_intento(intento_id)
    return intento


def list_my_attempts(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    return listar_intentos_estudiante(usuario["id"])


def list_activity_attempts(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    actividad_id = int(params["id"])
    if usuario["rol"] != "administrador":
        from api.services.activities import obtener_actividad_por_id
        actividad = obtener_actividad_por_id(actividad_id)
        if not actividad:
            return {"error": "Actividad no encontrada"}, 404
        if actividad.get("creado_por") != usuario["id"]:
            return {"error": "No tienes permiso para ver estos intentos"}, 403
    return listar_intentos_actividad(actividad_id)


def get_progress(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    return obtener_progreso_estudiante(usuario["id"])


routes = [
    (re.compile(r"^/api/attempts$"), ["POST"], create_attempt),
    (re.compile(r"^/api/attempts$"), ["GET"], list_my_attempts),
    (re.compile(r"^/api/attempts/(?P<id>\d+)$"), ["GET"], get_attempt),
    (re.compile(r"^/api/attempts/(?P<id>\d+)$"), ["POST"], submit_attempt),
    (re.compile(r"^/api/activities/(?P<id>\d+)/attempts$"), ["GET"], list_activity_attempts),
    (re.compile(r"^/api/progress$"), ["GET"], get_progress),
]
