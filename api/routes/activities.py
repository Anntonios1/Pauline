import re
from api.models import Actividad
from api.services.activities import (
    crear_actividad, listar_actividades, obtener_actividad_por_id,
    actualizar_actividad, eliminar_actividad, buscar_actividades_por_area,
    listar_recursos_actividad, listar_preguntas_por_actividad
)
from api.routes.auth import get_user_from_token, require_role


def validate_area(area):
    from api.config.settings import ALLOWED_AREAS
    return area in ALLOWED_AREAS


def create_activity(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    for campo in ("titulo", "area", "tipo"):
        if not body.get(campo):
            return {"error": f"Campo requerido: {campo}"}, 400
    if not validate_area(body.get("area")):
        return {"error": "Area invalida"}, 400
    actividad = Actividad(
        titulo=body["titulo"],
        descripcion=body.get("descripcion"),
        instrucciones=body.get("instrucciones"),
        area=body["area"],
        categoria_id=body.get("categoria_id"),
        tipo=body["tipo"],
        dificultad=body.get("dificultad", "basica"),
        tiempo_limite_segundos=body.get("tiempo_limite_segundos"),
        intentos_maximos=body.get("intentos_maximos", 1),
        creado_por=usuario["id"],
    )
    return crear_actividad(actividad)


def list_activities(handler, params, query, body):
    area = query.get("area")
    dificultad = query.get("dificultad")
    activas = query.get("activas", "true").lower() == "true"
    creador_id = query.get("creador_id") or query.get("creado_por")
    try:
        creador_id = int(creador_id) if creador_id not in (None, "") else None
    except ValueError:
        return {"error": "creador_id debe ser un entero"}, 400
    q = (query.get("q") or query.get("search") or "").strip()[:200] or None
    usuario = get_user_from_token(handler)
    return listar_actividades(
        area=area, dificultad=dificultad, activas=activas, creado_por=creador_id, q=q,
        viewer_id=usuario["id"] if usuario else None,
        is_admin=bool(usuario and usuario["rol"] == "administrador"),
    )


def get_activity(handler, params, query, body):
    actividad_id = int(params["id"])
    actividad = obtener_actividad_por_id(actividad_id)
    if not actividad:
        return {"error": "Actividad no encontrada"}, 404
    from api.routes.questions import puede_ver_respuestas, sin_respuestas
    preguntas_legacy = listar_preguntas_por_actividad(actividad_id)
    if not puede_ver_respuestas(get_user_from_token(handler)):
        preguntas_legacy = [sin_respuestas(p) for p in preguntas_legacy]
    actividad["preguntas"] = preguntas_legacy
    actividad["recursos"] = listar_recursos_actividad(actividad_id)
    # El motor nuevo convive con preguntas legacy durante la migración.
    from api.services.quizzes import obtener_quiz_meta, obtener_quiz_por_actividad
    meta = obtener_quiz_meta(actividad_id)
    if meta:
        user = get_user_from_token(handler)
        can_manage = bool(user) and (
            user["rol"] == "administrador" or meta["creado_por"] == user["id"]
        )
        if (meta["estado"] != "publicado" or not meta["activa"] or meta.get("privado")) and not can_manage:
            return {"error": "Actividad no encontrada o todavía no publicada"}, 404
        quiz = obtener_quiz_por_actividad(actividad_id, include_answers=can_manage)
        actividad["quiz"] = quiz
        actividad["quiz_config"] = quiz["quiz_config"]
        actividad["quiz_version"] = quiz["quiz_version"]
        actividad["items"] = quiz["items"]
        actividad["preguntas"] = quiz["items"]
    return actividad


def update_activity(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    actividad_id = int(params["id"])
    actividad = obtener_actividad_por_id(actividad_id)
    if not actividad:
        return {"error": "Actividad no encontrada"}, 404
    # Contenido de ruta (con categoria_id) es editable por cualquier docente,
    # no solo por quien lo creó originalmente.
    es_ruta = actividad.get("categoria_id") is not None
    if (
        usuario["rol"] != "administrador"
        and actividad.get("creado_por") != usuario["id"]
        and not es_ruta
    ):
        return {"error": "No tienes permiso para editar esta actividad"}, 403
    safe_body = dict(body)
    safe_body.pop("creado_por", None)
    from api.services.quizzes import QuizValidationError, actualizar_quiz as actualizar_quiz_unificado, obtener_quiz_meta
    if obtener_quiz_meta(actividad_id):
        try:
            return actualizar_quiz_unificado(actividad_id, safe_body, usuario["id"])
        except QuizValidationError as exc:
            return {"error": str(exc)}, 400
    return actualizar_actividad(actividad_id, safe_body)


def delete_activity(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    actividad_id = int(params["id"])
    actividad = obtener_actividad_por_id(actividad_id)
    if not actividad:
        return {"error": "Actividad no encontrada"}, 404
    es_ruta = actividad.get("categoria_id") is not None
    if (
        usuario["rol"] != "administrador"
        and actividad.get("creado_por") != usuario["id"]
        and not es_ruta
    ):
        return {"error": "No tienes permiso para eliminar esta actividad"}, 403
    from api.services.quizzes import archivar_quiz, obtener_quiz_meta
    if obtener_quiz_meta(actividad_id):
        archivar_quiz(actividad_id, usuario["id"])
        return {"message": "Quiz archivado"}
    eliminar_actividad(actividad_id)
    return {"message": "Actividad desactivada"}


def get_activities_by_area(handler, params, query, body):
    area = params["area"]
    return buscar_actividades_por_area(area)


def get_learning_path(handler, params, query, body):
    from api.services.activities import obtener_ruta_aprendizaje
    return obtener_ruta_aprendizaje()


routes = [
    (re.compile(r"^/api/activities$"), ["POST"], create_activity),
    (re.compile(r"^/api/activities$"), ["GET"], list_activities),
    (re.compile(r"^/api/learning-path$"), ["GET"], get_learning_path),
    (re.compile(r"^/api/activities/(?P<id>\d+)$"), ["GET"], get_activity),
    (re.compile(r"^/api/activities/(?P<id>\d+)$"), ["PUT", "PATCH"], update_activity),
    (re.compile(r"^/api/activities/(?P<id>\d+)$"), ["DELETE"], delete_activity),
    (re.compile(r"^/api/activities/area/(?P<area>[\w_]+)$"), ["GET"], get_activities_by_area),
]
