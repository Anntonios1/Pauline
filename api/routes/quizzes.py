"""Contrato HTTP del creador y reproductor de quizzes unificados."""

import re
import sqlite3

from api.routes.auth import get_user_from_token, require_role
from api.services.quizzes import (
    QuizValidationError,
    actualizar_quiz,
    adjuntar_media,
    archivar_quiz,
    crear_quiz,
    listar_quizzes,
    listar_versiones,
    obtener_quiz_meta,
    obtener_quiz_por_actividad,
    obtener_snapshot,
)
from api.utils.upload import UploadError, save_quiz_media, serialize_upload_asset


def _can_manage(user: dict, quiz_meta: dict) -> bool:
    return bool(user) and (
        user["rol"] == "administrador"
        or quiz_meta.get("creado_por") == user["id"]
        # Contenido de ruta (con categoria_id) es editable por cualquier docente,
        # no solo por quien lo creó originalmente.
        or (user["rol"] == "docente" and quiz_meta.get("categoria_id") is not None)
    )


def _manager(handler, activity_id: int):
    user, error = require_role(handler, ["docente", "administrador"])
    if error:
        return None, None, error
    meta = obtener_quiz_meta(activity_id)
    if not meta:
        return user, None, ({"error": "Quiz no encontrado"}, 404)
    if not _can_manage(user, meta):
        return user, meta, ({"error": "No tienes permiso para editar este quiz"}, 403)
    return user, meta, None


def _service_error(error):
    if isinstance(error, QuizValidationError):
        return {"error": str(error)}, 400
    if isinstance(error, sqlite3.IntegrityError):
        return {"error": f"El quiz viola una restricción de datos: {error}"}, 409
    raise error


def create_quiz(handler, params, query, body):
    user, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    try:
        return crear_quiz(body, user["id"]), 201
    except (QuizValidationError, sqlite3.IntegrityError) as exc:
        return _service_error(exc)


def list_quiz_collection(handler, params, query, body):
    user = get_user_from_token(handler)
    state = query.get("estado") or query.get("status")
    try:
        return listar_quizzes(
            actor_id=user["id"] if user else None,
            is_admin=bool(user and user["rol"] == "administrador"),
            state=state,
            area=query.get("area"),
        )
    except QuizValidationError as exc:
        return _service_error(exc)


def get_quiz(handler, params, query, body):
    activity_id = int(params["id"])
    meta = obtener_quiz_meta(activity_id)
    if not meta:
        return {"error": "Quiz no encontrado"}, 404
    user = get_user_from_token(handler)
    can_manage = _can_manage(user, meta)
    if (meta["estado"] != "publicado" or not meta["activa"] or meta.get("privado")) and not can_manage:
        return {"error": "Quiz no encontrado o todavía no publicado"}, 404
    return obtener_quiz_por_actividad(activity_id, include_answers=can_manage)


def update_quiz(handler, params, query, body):
    activity_id = int(params["id"])
    user, _, error = _manager(handler, activity_id)
    if error:
        return error
    try:
        return actualizar_quiz(activity_id, body, user["id"])
    except (QuizValidationError, sqlite3.IntegrityError) as exc:
        return _service_error(exc)


def publish_quiz(handler, params, query, body):
    activity_id = int(params["id"])
    user, _, error = _manager(handler, activity_id)
    if error:
        return error
    try:
        return actualizar_quiz(activity_id, {"estado": "publicado"}, user["id"])
    except QuizValidationError as exc:
        return _service_error(exc)


def delete_quiz(handler, params, query, body):
    activity_id = int(params["id"])
    user, _, error = _manager(handler, activity_id)
    if error:
        return error
    return archivar_quiz(activity_id, user["id"])


def upload_quiz_media(handler, params, query, body):
    activity_id = int(params["id"])
    user, _, error = _manager(handler, activity_id)
    if error:
        return error
    file_info = body.get("file") or body.get("archivo") or body.get("media")
    if not isinstance(file_info, dict):
        return {"error": "Debe enviar un archivo en el campo 'file'"}, 400
    try:
        item_id = body.get("item_id") or body.get("quiz_item_id")
        option_id = body.get("option_id") or body.get("opcion_id")
        item_id = int(item_id) if item_id not in (None, "") else None
        option_id = int(option_id) if option_id not in (None, "") else None
    except (TypeError, ValueError):
        return {"error": "item_id y option_id deben ser enteros"}, 400
    try:
        asset = save_quiz_media(
            file_info.get("data"), file_info.get("mime_type"), file_info.get("filename")
        )
        asset["alt_text"] = body.get("alt_text") or body.get("texto_alternativo")
        result = adjuntar_media(
            activity_id, user["id"], asset, item_id=item_id, option_id=option_id
        )
        return result, 201
    except (UploadError, QuizValidationError) as exc:
        return {"error": str(exc)}, 400


def upload_pending_quiz_media(handler, params, query, body):
    """Upload previo al POST atómico; la URL se incluye luego en items[].media."""
    _, error = require_role(handler, ["docente", "administrador"])
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


def get_quiz_versions(handler, params, query, body):
    activity_id = int(params["id"])
    _, _, error = _manager(handler, activity_id)
    if error:
        return error
    return listar_versiones(activity_id)


def get_quiz_version(handler, params, query, body):
    activity_id = int(params["id"])
    _, _, error = _manager(handler, activity_id)
    if error:
        return error
    snapshot = obtener_snapshot(activity_id, int(params["version"]), include_answers=True)
    return snapshot or ({"error": "Versión no encontrada"}, 404)


routes = [
    (re.compile(r"^/api/quiz-media$"), ["POST"], upload_pending_quiz_media),
    (re.compile(r"^/api/quizzes$"), ["POST"], create_quiz),
    (re.compile(r"^/api/quizzes$"), ["GET"], list_quiz_collection),
    (re.compile(r"^/api/quizzes/(?P<id>\d+)$"), ["GET"], get_quiz),
    (re.compile(r"^/api/quizzes/(?P<id>\d+)$"), ["PUT", "PATCH"], update_quiz),
    (re.compile(r"^/api/quizzes/(?P<id>\d+)$"), ["DELETE"], delete_quiz),
    (re.compile(r"^/api/quizzes/(?P<id>\d+)/publish$"), ["POST"], publish_quiz),
    (re.compile(r"^/api/quizzes/(?P<id>\d+)/media$"), ["POST"], upload_quiz_media),
    (re.compile(r"^/api/quizzes/(?P<id>\d+)/versions$"), ["GET"], get_quiz_versions),
    (re.compile(r"^/api/quizzes/(?P<id>\d+)/versions/(?P<version>\d+)$"), ["GET"], get_quiz_version),
    (re.compile(r"^/api/activities/(?P<id>\d+)/quiz$"), ["GET"], get_quiz),
    (re.compile(r"^/api/activities/(?P<id>\d+)/quiz$"), ["PUT", "PATCH"], update_quiz),
]
