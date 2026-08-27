"""Persistencia, validación y calificación del motor unificado de quizzes."""

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urlparse

from api.config.settings import ALLOWED_AREAS, ALLOWED_DIFICULTADES
from api.database.connection import close_db, get_db
from api.utils.helpers import now_utc


ITEM_TYPES = {
    "single_choice",
    "multiple_choice",
    "true_false",
    "short_text",
    "flashcard",
    "info",
}
ITEM_TYPE_ALIASES = {
    "opcion_multiple": "single_choice",
    "seleccion_unica": "single_choice",
    "seleccion_multiple": "multiple_choice",
    "verdadero_falso": "true_false",
    "respuesta_corta": "short_text",
    "ficha": "flashcard",
    "contenido": "info",
}
QUIZ_STATES = {"borrador", "publicado", "archivado"}
MEDIA_TYPES = {"image", "audio", "video", "file"}

# Plataformas cuyo iframe de incrustación es de confianza. Se les concede
# `allow-same-origin` en el reproductor; el resto de dominios no.
TRUSTED_EMBED_HOSTS = {
    "wordwall.net", "youtube.com", "youtube-nocookie.com", "youtu.be",
    "vimeo.com", "player.vimeo.com", "drive.google.com",
}
VIDEO_FILE_EXTENSIONS = (".mp4", ".webm", ".ogg", ".ogv", ".m4v", ".mov")


def _embed_kind(url: str) -> str:
    """Clasifica un enlace para decidir CÓMO se incrusta, no SI se incrusta.

    Tres capas, de menos a más riesgo:
      - "video": apunta a un archivo de video. Se pinta con <video src>, que no
        ejecuta código del tercero: cualquier dominio es seguro aquí.
      - "trusted": plataforma conocida, iframe con su URL oficial de embed.
      - "external": cualquier otra página. Se incrusta en un iframe sin
        `allow-same-origin`, para que no pueda leer la sesión ni suplantar la
        app — esto es contenido que ven menores y el enlace lo pega un humano.
    """
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    ruta = parsed.path.lower()
    if ruta.endswith(VIDEO_FILE_EXTENSIONS):
        return "video"
    if host in TRUSTED_EMBED_HOSTS or any(host.endswith(f".{h}") for h in TRUSTED_EMBED_HOSTS):
        return "trusted"
    return "external"


def _validate_embed_url(url: str, field: str) -> str:
    """Exige https. El esquema es lo único innegociable: sin él el contenido
    viaja en claro y puede ser alterado en tránsito antes de llegar al aula."""
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise QuizValidationError(f"{field} debe ser un enlace https completo")
    return url


class QuizValidationError(ValueError):
    pass


def _first(data: dict, *keys: str, default=None):
    for key in keys:
        if key in data:
            return data[key]
    return default


def _json_load(value: Any, default=None):
    if value is None:
        return default
    if isinstance(value, (dict, list, bool, int, float)):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _bounded_text(value: Any, field: str, *, required=False, maximum=10000) -> Optional[str]:
    if value is None:
        if required:
            raise QuizValidationError(f"Campo requerido: {field}")
        return None
    if not isinstance(value, str):
        raise QuizValidationError(f"{field} debe ser texto")
    value = value.strip()
    if required and not value:
        raise QuizValidationError(f"Campo requerido: {field}")
    if len(value) > maximum:
        raise QuizValidationError(f"{field} excede {maximum} caracteres")
    return value


def _positive_int(value: Any, field: str, *, minimum=1, maximum=86400, nullable=False):
    if value is None and nullable:
        return None
    if isinstance(value, bool):
        raise QuizValidationError(f"{field} debe ser un entero")
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise QuizValidationError(f"{field} debe ser un entero")
    if number < minimum or number > maximum:
        raise QuizValidationError(f"{field} debe estar entre {minimum} y {maximum}")
    return number


def _score(value: Any, field="puntaje") -> float:
    if isinstance(value, bool):
        raise QuizValidationError(f"{field} debe ser numérico")
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise QuizValidationError(f"{field} debe ser numérico")
    if result < 0 or result > 1000:
        raise QuizValidationError(f"{field} debe estar entre 0 y 1000")
    return result


def _infer_media_type(url: str, mime_type: Optional[str] = None) -> str:
    mime = (mime_type or "").lower()
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("audio/"):
        return "audio"
    ext = os.path.splitext(url.split("?", 1)[0])[1].lower()
    if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return "image"
    if ext in {".mp3", ".wav", ".ogg", ".m4a"}:
        return "audio"
    if ext in {".mp4", ".webm"}:
        return "video"
    return "file"


def _normalize_media(raw_media: Any, field: str = "media") -> list:
    if raw_media in (None, ""):
        return []
    values = raw_media if isinstance(raw_media, list) else [raw_media]
    if len(values) > 20:
        raise QuizValidationError(f"{field} admite máximo 20 archivos")
    result = []
    for index, raw in enumerate(values, 1):
        raw = {"url": raw} if isinstance(raw, str) else raw
        if not isinstance(raw, dict):
            raise QuizValidationError(f"{field}[{index}] debe ser un objeto")
        url = _bounded_text(_first(raw, "url", "src"), f"{field}[{index}].url", required=True, maximum=2048)
        if not (url.startswith("/uploads/") or url.startswith("https://") or url.startswith("http://")):
            raise QuizValidationError(f"{field}[{index}].url debe ser una URL http(s) o /uploads/")
        mime = _first(raw, "mime_type", "mimeType")
        media_type = _first(raw, "type", "tipo") or _infer_media_type(url, mime)
        if media_type not in MEDIA_TYPES:
            raise QuizValidationError(f"Tipo de medio inválido: {media_type}")
        config = _first(raw, "config", "configuracion", default={})
        if not isinstance(config, dict):
            raise QuizValidationError(f"{field}[{index}].config debe ser un objeto")
        size = _first(raw, "size", "tamano_bytes")
        if size is not None:
            size = _positive_int(size, f"{field}[{index}].size", minimum=0, maximum=100 * 1024 * 1024)
        result.append({
            "type": media_type,
            "url": url,
            "filename": _bounded_text(_first(raw, "filename", "nombre_archivo", "nombre"), f"{field}[{index}].filename", maximum=255),
            "mime_type": _bounded_text(mime, f"{field}[{index}].mime_type", maximum=150),
            "size": size,
            "alt_text": _bounded_text(_first(raw, "alt_text", "texto_alternativo", "alt"), f"{field}[{index}].alt_text", maximum=500),
            "config": config,
        })
    return result


def _normalize_answer_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value).strip()


def _normalize_options(raw_options: Any, item_type: str, field: str) -> list:
    if item_type == "true_false" and not raw_options:
        raw_options = [
            {"text": "Verdadero", "value": "true"},
            {"text": "Falso", "value": "false"},
        ]
    if not isinstance(raw_options, list):
        raise QuizValidationError(f"{field}.options debe ser una lista")
    if not 2 <= len(raw_options) <= 20:
        raise QuizValidationError(f"{field}.options debe tener entre 2 y 20 opciones")

    result = []
    seen = set()
    for index, raw in enumerate(raw_options, 1):
        raw = {"text": raw, "value": raw} if isinstance(raw, (str, int, float, bool)) else raw
        if not isinstance(raw, dict):
            raise QuizValidationError(f"{field}.options[{index}] debe ser texto u objeto")
        text = _bounded_text(_first(raw, "text", "texto", "label"), f"{field}.options[{index}].text", required=True, maximum=1000)
        value = _normalize_answer_value(_first(raw, "value", "valor", "id", default=text))
        if not value:
            raise QuizValidationError(f"{field}.options[{index}].value no puede estar vacío")
        key = value.casefold()
        if key in seen:
            raise QuizValidationError(f"{field}.options contiene valores duplicados")
        seen.add(key)
        result.append({
            "text": text,
            "value": value,
            "correct": bool(_first(raw, "correct", "correcta", "es_correcta", "is_correct", default=False)),
            "feedback": _bounded_text(_first(raw, "feedback", "retroalimentacion"), f"{field}.options[{index}].feedback", maximum=2000),
            "config": _first(raw, "config", "configuracion", default={}),
            "media": _normalize_media(_first(raw, "media", "medios"), f"{field}.options[{index}].media"),
        })
        if not isinstance(result[-1]["config"], dict):
            raise QuizValidationError(f"{field}.options[{index}].config debe ser un objeto")
    return result


def _resolve_option_value(value: Any, options: list, field: str) -> str:
    normalized = _normalize_answer_value(value)
    for option in options:
        if normalized.casefold() in {option["value"].casefold(), option["text"].casefold()}:
            return option["value"]
    raise QuizValidationError(f"{field} no coincide con una opción")


def _normalize_item(raw: Any, index: int) -> dict:
    field = f"items[{index}]"
    if not isinstance(raw, dict):
        raise QuizValidationError(f"{field} debe ser un objeto")
    item_type = _first(raw, "type", "tipo", default="single_choice")
    item_type = ITEM_TYPE_ALIASES.get(item_type, item_type)
    if item_type not in ITEM_TYPES:
        raise QuizValidationError(f"{field}.type inválido: {item_type}")
    config = _first(raw, "config", "configuracion", default={})
    if not isinstance(config, dict):
        raise QuizValidationError(f"{field}.config debe ser un objeto")
    config = dict(config)
    if item_type == "info":
        title = _bounded_text(_first(raw, "enunciado", "title", "titulo"), f"{field}.title", maximum=500)
        content = _bounded_text(_first(raw, "content", "contenido"), f"{field}.content", maximum=20000)
        if title:
            config.setdefault("title", title)
        # `wordwall_url` es el nombre histórico; `embed_url` es el general. Se
        # aceptan los dos y se guardan los dos, para no romper los quizzes ya
        # creados ni el frontend que todavía lee el nombre viejo.
        embed_raw = config.get("embed_url") or config.get("wordwall_url")
        if embed_raw:
            campo = f"{field}.config.embed_url"
            embed_url = _validate_embed_url(
                _bounded_text(embed_raw, campo, required=True, maximum=2048), campo
            )
            config["embed_url"] = embed_url
            config["wordwall_url"] = embed_url
            # La capa la decide el servidor: el frontend solo la obedece.
            config["embed_kind"] = _embed_kind(embed_url)
        prompt_source = content or title
        if not prompt_source and (_first(raw, "media", "medios") or embed_raw):
            prompt_source = title or "Juego interactivo"
        prompt = _bounded_text(prompt_source, f"{field}.content", required=True, maximum=20000)
    else:
        prompt = _bounded_text(
            _first(raw, "prompt", "enunciado", "content", "contenido"),
            f"{field}.prompt",
            required=True,
            maximum=20000,
        )
    explanation = _bounded_text(
        _first(raw, "explanation", "explicacion"),
        f"{field}.explanation",
        maximum=10000,
    )
    points = _score(_first(raw, "score", "puntaje", "puntos", default=0 if item_type == "info" else 1), f"{field}.score")
    if item_type == "info" and points != 0:
        raise QuizValidationError(f"{field}.score debe ser 0 para bloques info")
    time_limit = _first(raw, "time_limit_seconds", "tiempo_limite_segundos", "tiempo_segundos")
    if time_limit in (0, "0", ""):
        time_limit = None
    if time_limit is not None:
        time_limit = _positive_int(time_limit, f"{field}.time_limit_seconds", maximum=3600)

    options = []
    correct_answer = _first(raw, "correct_answer", "respuesta_correcta", "answer", "respuesta")
    if item_type in {"single_choice", "multiple_choice", "true_false"}:
        options = _normalize_options(_first(raw, "options", "opciones"), item_type, field)
        flagged = [option["value"] for option in options if option["correct"]]
        supplied = []
        if correct_answer is not None:
            supplied_raw = correct_answer if isinstance(correct_answer, list) else [correct_answer]
            supplied = [_resolve_option_value(value, options, f"{field}.correct_answer") for value in supplied_raw]
        correct_values = list(dict.fromkeys(flagged or supplied))
        if item_type in {"single_choice", "true_false"} and len(correct_values) != 1:
            raise QuizValidationError(f"{field} requiere exactamente una opción correcta")
        if item_type == "multiple_choice" and not correct_values:
            raise QuizValidationError(f"{field} requiere al menos una opción correcta")
        correct_answer = correct_values if item_type == "multiple_choice" else correct_values[0]
        for option in options:
            option["correct"] = option["value"] in correct_values
    elif item_type == "short_text":
        if not isinstance(correct_answer, (str, list)) or not correct_answer:
            raise QuizValidationError(f"{field}.correct_answer es requerido")
        answers = correct_answer if isinstance(correct_answer, list) else [correct_answer]
        answers = [_bounded_text(answer, f"{field}.correct_answer", required=True, maximum=2000) for answer in answers]
        correct_answer = answers if len(answers) > 1 else answers[0]
    elif item_type == "flashcard":
        correct_answer = _bounded_text(correct_answer, f"{field}.correct_answer", required=True, maximum=10000)
    else:
        correct_answer = None

    return {
        "client_id": _first(raw, "id", "client_id"),
        "order": index,
        "type": item_type,
        "prompt": prompt,
        "correct_answer": correct_answer,
        "explanation": explanation,
        "config": config,
        "score": points,
        "time_limit_seconds": time_limit,
        "required": 1 if bool(_first(raw, "required", "obligatoria", default=True)) else 0,
        "options": options,
        "media": _normalize_media(_first(raw, "media", "medios"), f"{field}.media"),
    }


def normalize_quiz_payload(payload: Any, *, creating: bool) -> dict:
    if not isinstance(payload, dict):
        raise QuizValidationError("El cuerpo del quiz debe ser un objeto JSON")
    result = {}

    aliases = {
        "titulo": ("titulo", "title"),
        "descripcion": ("descripcion", "description"),
        "instrucciones": ("instrucciones", "instructions"),
        "area": ("area",),
        "categoria_id": ("categoria_id", "category_id"),
        "dificultad": ("dificultad", "difficulty"),
        "tiempo_limite_segundos": ("tiempo_limite_segundos", "time_limit_seconds"),
        "intentos_maximos": ("intentos_maximos", "max_attempts"),
    }
    for canonical, keys in aliases.items():
        if any(key in payload for key in keys):
            result[canonical] = _first(payload, *keys)

    if creating or "titulo" in result:
        result["titulo"] = _bounded_text(result.get("titulo"), "titulo", required=True, maximum=200)
    if "descripcion" in result:
        result["descripcion"] = _bounded_text(result["descripcion"], "descripcion", maximum=5000)
    if "instrucciones" in result:
        result["instrucciones"] = _bounded_text(result["instrucciones"], "instrucciones", maximum=10000)
    if creating or "area" in result:
        if result.get("area") not in ALLOWED_AREAS:
            raise QuizValidationError("Area inválida")
    if "categoria_id" in result and result["categoria_id"] is not None:
        result["categoria_id"] = _positive_int(result["categoria_id"], "categoria_id", maximum=2_000_000_000)
    if creating and "dificultad" not in result:
        result["dificultad"] = "basica"
    if "dificultad" in result and result["dificultad"] not in ALLOWED_DIFICULTADES:
        raise QuizValidationError("Dificultad inválida")
    if "tiempo_limite_segundos" in result and result["tiempo_limite_segundos"] is not None:
        result["tiempo_limite_segundos"] = _positive_int(result["tiempo_limite_segundos"], "tiempo_limite_segundos")
    if creating and "intentos_maximos" not in result:
        result["intentos_maximos"] = 1
    if "intentos_maximos" in result:
        result["intentos_maximos"] = _positive_int(result["intentos_maximos"], "intentos_maximos", maximum=50)

    if creating or any(key in payload for key in ("config", "configuracion", "quiz_config")):
        config = _first(payload, "config", "configuracion", "quiz_config", default={})
        if not isinstance(config, dict):
            raise QuizValidationError("config debe ser un objeto")
        result["config"] = config

    if creating or any(key in payload for key in ("status", "estado")):
        state = _first(payload, "status", "estado", default="publicado")
        if state not in QUIZ_STATES:
            raise QuizValidationError("estado debe ser borrador, publicado o archivado")
        result["estado"] = state

    if creating or any(key in payload for key in ("privado", "is_private", "private")):
        result["privado"] = 1 if bool(_first(payload, "privado", "is_private", "private", default=False)) else 0

    if creating or any(key in payload for key in ("items", "preguntas")):
        raw_items = _first(payload, "items", "preguntas", default=[])
        if not isinstance(raw_items, list):
            raise QuizValidationError("items debe ser una lista")
        if len(raw_items) > 200:
            raise QuizValidationError("Un quiz admite máximo 200 bloques")
        result["items"] = [_normalize_item(item, index) for index, item in enumerate(raw_items, 1)]

    if creating or any(key in payload for key in ("media", "medios")):
        result["media"] = _normalize_media(_first(payload, "media", "medios"), "media")
    return result


def _validate_category(conn: sqlite3.Connection, category_id: Optional[int], area: Optional[str]) -> None:
    if category_id is None:
        return
    row = conn.execute("SELECT area FROM categorias WHERE id = ?", (category_id,)).fetchone()
    if not row:
        raise QuizValidationError("categoria_id no existe")
    if area and row["area"] != area:
        raise QuizValidationError("La categoría no pertenece al área indicada")


def _insert_media(conn, quiz_id, actor_id, media, *, item_id=None, option_id=None):
    ids = []
    for asset in media:
        cursor = conn.execute(
            """
            INSERT INTO quiz_media_assets
                (quiz_id, item_id, opcion_id, tipo, url, nombre_archivo, mime_type,
                 tamano_bytes, texto_alternativo, configuracion, creado_por)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                quiz_id, item_id, option_id, asset["type"], asset["url"],
                asset.get("filename"), asset.get("mime_type"), asset.get("size"),
                asset.get("alt_text"), _json_dump(asset.get("config", {})), actor_id,
            ),
        )
        ids.append(cursor.lastrowid)
    return ids


def _insert_items(conn, quiz_id: int, actor_id: int, items: list) -> None:
    for item in items:
        cursor = conn.execute(
            """
            INSERT INTO quiz_items
                (quiz_id, orden, tipo, enunciado, respuesta_correcta, explicacion,
                 configuracion, puntaje, tiempo_limite_segundos, obligatoria)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                quiz_id, item["order"], item["type"], item["prompt"],
                _json_dump(item["correct_answer"]) if item["correct_answer"] is not None else None,
                item.get("explanation"), _json_dump(item.get("config", {})), item["score"],
                item.get("time_limit_seconds"), item["required"],
            ),
        )
        item_id = cursor.lastrowid
        _insert_media(conn, quiz_id, actor_id, item.get("media", []), item_id=item_id)
        for order, option in enumerate(item.get("options", []), 1):
            option_cursor = conn.execute(
                """
                INSERT INTO quiz_opciones
                    (item_id, orden, texto, valor, es_correcta, feedback, configuracion)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item_id, order, option["text"], option["value"],
                    1 if option["correct"] else 0, option.get("feedback"),
                    _json_dump(option.get("config", {})),
                ),
            )
            _insert_media(
                conn, quiz_id, actor_id, option.get("media", []),
                item_id=item_id, option_id=option_cursor.lastrowid,
            )


def _serialize_media_row(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "type": row["tipo"],
        "tipo": row["tipo"],
        "url": row["url"],
        "filename": row["nombre_archivo"],
        "nombre_archivo": row["nombre_archivo"],
        "mime_type": row["mime_type"],
        "size": row["tamano_bytes"],
        "tamano_bytes": row["tamano_bytes"],
        "alt_text": row["texto_alternativo"],
        "texto_alternativo": row["texto_alternativo"],
        "config": _json_load(row["configuracion"], {}),
    }


def _quiz_from_conn(conn: sqlite3.Connection, activity_id: int, *, include_answers=True) -> Optional[dict]:
    row = conn.execute(
        """
        SELECT a.*, c.nombre AS categoria_nombre,
               q.id AS quiz_id, q.version_actual, q.estado AS quiz_estado, q.privado AS quiz_privado,
               q.configuracion AS quiz_configuracion, q.creado_por AS quiz_creado_por
        FROM actividades a
        JOIN quizzes q ON q.actividad_id = a.id
        LEFT JOIN categorias c ON c.id = a.categoria_id
        WHERE a.id = ?
        """,
        (activity_id,),
    ).fetchone()
    if not row:
        return None
    quiz_id = row["quiz_id"]
    media_rows = conn.execute(
        "SELECT * FROM quiz_media_assets WHERE quiz_id = ? ORDER BY id", (quiz_id,)
    ).fetchall()
    media_by_item = {}
    media_by_option = {}
    quiz_media = []
    for media_row in media_rows:
        data = _serialize_media_row(media_row)
        if media_row["opcion_id"] is not None:
            media_by_option.setdefault(media_row["opcion_id"], []).append(data)
        elif media_row["item_id"] is not None:
            media_by_item.setdefault(media_row["item_id"], []).append(data)
        else:
            quiz_media.append(data)

    items = []
    item_rows = conn.execute(
        "SELECT * FROM quiz_items WHERE quiz_id = ? ORDER BY orden", (quiz_id,)
    ).fetchall()
    for item_row in item_rows:
        options = []
        option_rows = conn.execute(
            "SELECT * FROM quiz_opciones WHERE item_id = ? ORDER BY orden", (item_row["id"],)
        ).fetchall()
        for option_row in option_rows:
            option = {
                "id": option_row["valor"],
                "option_id": option_row["id"],
                "text": option_row["texto"],
                "texto": option_row["texto"],
                "value": option_row["valor"],
                "valor": option_row["valor"],
                "feedback": option_row["feedback"],
                "config": _json_load(option_row["configuracion"], {}),
                "media": media_by_option.get(option_row["id"], []),
            }
            if include_answers:
                option["correct"] = bool(option_row["es_correcta"])
                option["correcta"] = bool(option_row["es_correcta"])
                option["es_correcta"] = option_row["es_correcta"]
            options.append(option)
        answer = _json_load(item_row["respuesta_correcta"])
        item_config = _json_load(item_row["configuracion"], {})
        item = {
            "id": item_row["id"],
            "order": item_row["orden"],
            "orden": item_row["orden"],
            "type": item_row["tipo"],
            "tipo": item_row["tipo"],
            "prompt": item_config.get("title", "") if item_row["tipo"] == "info" else item_row["enunciado"],
            "enunciado": item_config.get("title", "") if item_row["tipo"] == "info" else item_row["enunciado"],
            "content": item_row["enunciado"] if item_row["tipo"] == "info" else (
                answer if item_row["tipo"] == "flashcard" else None
            ),
            "contenido": item_row["enunciado"] if item_row["tipo"] == "info" else (
                answer if item_row["tipo"] == "flashcard" else None
            ),
            "options": options,
            "opciones": options,
            "explanation": item_row["explicacion"],
            "explicacion": item_row["explicacion"],
            "media": media_by_item.get(item_row["id"], []),
            "config": item_config,
            "score": item_row["puntaje"],
            "puntaje": item_row["puntaje"],
            "puntos": item_row["puntaje"],
            "time_limit_seconds": item_row["tiempo_limite_segundos"],
            "tiempo_limite_segundos": item_row["tiempo_limite_segundos"],
            "tiempo_segundos": item_row["tiempo_limite_segundos"],
            "required": bool(item_row["obligatoria"]),
            "obligatoria": item_row["obligatoria"],
        }
        if include_answers or item_row["tipo"] == "flashcard":
            item["correct_answer"] = answer
            item["respuesta_correcta"] = answer
        items.append(item)

    config = _json_load(row["quiz_configuracion"], {})
    return {
        "id": row["id"],
        "actividad_id": row["id"],
        "quiz_id": quiz_id,
        "title": row["titulo"],
        "titulo": row["titulo"],
        "description": row["descripcion"],
        "descripcion": row["descripcion"],
        "instructions": row["instrucciones"],
        "instrucciones": row["instrucciones"],
        "area": row["area"],
        "category_id": row["categoria_id"],
        "categoria_id": row["categoria_id"],
        "categoria_nombre": row["categoria_nombre"],
        "type": "interactive_quiz",
        "tipo": row["tipo"],
        "difficulty": row["dificultad"],
        "dificultad": row["dificultad"],
        "time_limit_seconds": row["tiempo_limite_segundos"],
        "tiempo_limite_segundos": row["tiempo_limite_segundos"],
        "max_attempts": row["intentos_maximos"],
        "intentos_maximos": row["intentos_maximos"],
        "created_by": row["quiz_creado_por"],
        "creado_por": row["quiz_creado_por"],
        "active": bool(row["activa"]),
        "activa": row["activa"],
        "status": row["quiz_estado"],
        "estado": row["quiz_estado"],
        "privado": bool(row["quiz_privado"]),
        "version": row["version_actual"],
        "quiz_version": row["version_actual"],
        "config": config,
        "quiz_config": config,
        "media": quiz_media,
        "items": items,
        "preguntas": items,
        "fecha_creacion": row["fecha_creacion"],
        "fecha_actualizacion": row["fecha_actualizacion"],
    }


def _store_snapshot(conn: sqlite3.Connection, activity_id: int, actor_id: int) -> None:
    quiz = _quiz_from_conn(conn, activity_id, include_answers=True)
    conn.execute(
        "INSERT INTO quiz_versions (quiz_id, numero, snapshot, creado_por) VALUES (?, ?, ?, ?)",
        (quiz["quiz_id"], quiz["version"], _json_dump(quiz), actor_id),
    )


def crear_quiz(payload: dict, actor_id: int) -> dict:
    data = normalize_quiz_payload(payload, creating=True)
    if data["estado"] == "publicado" and not data["items"]:
        raise QuizValidationError("Un quiz publicado debe tener al menos un bloque")
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        _validate_category(conn, data.get("categoria_id"), data["area"])
        cursor = conn.execute(
            """
            INSERT INTO actividades
                (titulo, descripcion, instrucciones, area, categoria_id, tipo, dificultad,
                 tiempo_limite_segundos, intentos_maximos, creado_por, activa, motor_quiz)
            VALUES (?, ?, ?, ?, ?, 'interactive_quiz', ?, ?, ?, ?, ?, 'unificado')
            """,
            (
                data["titulo"], data.get("descripcion"), data.get("instrucciones"), data["area"],
                data.get("categoria_id"), data["dificultad"], data.get("tiempo_limite_segundos"),
                data["intentos_maximos"], actor_id, 1 if data["estado"] == "publicado" else 0,
            ),
        )
        activity_id = cursor.lastrowid
        quiz_cursor = conn.execute(
            """
            INSERT INTO quizzes (actividad_id, version_actual, estado, privado, configuracion, creado_por)
            VALUES (?, 1, ?, ?, ?, ?)
            """,
            (activity_id, data["estado"], data["privado"], _json_dump(data["config"]), actor_id),
        )
        quiz_id = quiz_cursor.lastrowid
        _insert_items(conn, quiz_id, actor_id, data["items"])
        _insert_media(conn, quiz_id, actor_id, data.get("media", []))
        _store_snapshot(conn, activity_id, actor_id)
        result = _quiz_from_conn(conn, activity_id, include_answers=True)
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        close_db(conn)


def obtener_quiz_por_actividad(activity_id: int, *, include_answers=True) -> Optional[dict]:
    conn = get_db()
    try:
        return _quiz_from_conn(conn, activity_id, include_answers=include_answers)
    finally:
        close_db(conn)


def obtener_quiz_meta(activity_id: int) -> Optional[dict]:
    conn = get_db()
    try:
        row = conn.execute(
            """
            SELECT q.*, a.activa, a.categoria_id, a.creado_por AS actividad_creado_por
            FROM quizzes q JOIN actividades a ON a.id = q.actividad_id
            WHERE q.actividad_id = ?
            """,
            (activity_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def listar_quizzes(*, actor_id=None, is_admin=False, state=None, area=None) -> list:
    conn = get_db()
    try:
        sql = """
            SELECT a.id FROM actividades a JOIN quizzes q ON q.actividad_id = a.id
            WHERE 1 = 1
        """
        params = []
        if state:
            if state not in QUIZ_STATES:
                raise QuizValidationError("estado inválido")
            sql += " AND q.estado = ?"
            params.append(state)
        elif not is_admin:
            if actor_id is None:
                sql += " AND q.estado = 'publicado' AND a.activa = 1"
            else:
                sql += " AND ((q.estado = 'publicado' AND a.activa = 1) OR q.creado_por = ?)"
                params.append(actor_id)
        if not is_admin:
            if actor_id is None:
                sql += " AND q.privado = 0"
            else:
                sql += " AND (q.privado = 0 OR q.creado_por = ?)"
                params.append(actor_id)
        if area:
            if area not in ALLOWED_AREAS:
                raise QuizValidationError("Area inválida")
            sql += " AND a.area = ?"
            params.append(area)
        sql += " ORDER BY a.fecha_actualizacion DESC"
        ids = [row[0] for row in conn.execute(sql, params).fetchall()]
        return [_quiz_from_conn(conn, activity_id, include_answers=False) for activity_id in ids]
    finally:
        close_db(conn)


def actualizar_quiz(activity_id: int, payload: dict, actor_id: int) -> Optional[dict]:
    data = normalize_quiz_payload(payload, creating=False)
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        current = conn.execute(
            """
            SELECT q.*, a.area, a.categoria_id FROM quizzes q
            JOIN actividades a ON a.id = q.actividad_id WHERE q.actividad_id = ?
            """,
            (activity_id,),
        ).fetchone()
        if not current:
            conn.rollback()
            return None
        area = data.get("area", current["area"])
        category_id = data.get("categoria_id", current["categoria_id"])
        _validate_category(conn, category_id, area)

        activity_fields = {
            key: data[key] for key in (
                "titulo", "descripcion", "instrucciones", "area", "categoria_id", "dificultad",
                "tiempo_limite_segundos", "intentos_maximos",
            ) if key in data
        }
        if "estado" in data:
            activity_fields["activa"] = 1 if data["estado"] == "publicado" else 0
        if activity_fields:
            activity_fields["fecha_actualizacion"] = now_utc()
            assignments = ", ".join(f"{key} = ?" for key in activity_fields)
            conn.execute(
                f"UPDATE actividades SET {assignments} WHERE id = ?",
                [*activity_fields.values(), activity_id],
            )

        next_version = current["version_actual"] + 1
        state = data.get("estado", current["estado"])
        if state == "publicado":
            count = len(data["items"]) if "items" in data else conn.execute(
                "SELECT COUNT(*) FROM quiz_items WHERE quiz_id = ?", (current["id"],)
            ).fetchone()[0]
            if not count:
                raise QuizValidationError("Un quiz publicado debe tener al menos un bloque")
        config = data.get("config", _json_load(current["configuracion"], {}))
        privado = data.get("privado", current["privado"])
        conn.execute(
            """
            UPDATE quizzes SET version_actual = ?, estado = ?, privado = ?, configuracion = ?,
                               fecha_actualizacion = ? WHERE id = ?
            """,
            (next_version, state, privado, _json_dump(config), now_utc(), current["id"]),
        )
        if "items" in data:
            conn.execute("DELETE FROM quiz_items WHERE quiz_id = ?", (current["id"],))
            _insert_items(conn, current["id"], actor_id, data["items"])
        if "media" in data:
            conn.execute(
                "DELETE FROM quiz_media_assets WHERE quiz_id = ? AND item_id IS NULL",
                (current["id"],),
            )
            _insert_media(conn, current["id"], actor_id, data["media"])
        _store_snapshot(conn, activity_id, actor_id)
        result = _quiz_from_conn(conn, activity_id, include_answers=True)
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        close_db(conn)


def archivar_quiz(activity_id: int, actor_id: int) -> Optional[dict]:
    return actualizar_quiz(activity_id, {"estado": "archivado"}, actor_id)


def adjuntar_media(
    activity_id: int,
    actor_id: int,
    asset: dict,
    *,
    item_id: Optional[int] = None,
    option_id: Optional[int] = None,
) -> Optional[dict]:
    normalized = _normalize_media(asset, "media")
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        quiz = conn.execute(
            "SELECT * FROM quizzes WHERE actividad_id = ?", (activity_id,)
        ).fetchone()
        if not quiz:
            conn.rollback()
            return None
        if option_id is not None and item_id is None:
            option = conn.execute(
                """
                SELECT qo.item_id FROM quiz_opciones qo JOIN quiz_items qi ON qi.id = qo.item_id
                WHERE qo.id = ? AND qi.quiz_id = ?
                """,
                (option_id, quiz["id"]),
            ).fetchone()
            if not option:
                raise QuizValidationError("option_id no pertenece al quiz")
            item_id = option["item_id"]
        if item_id is not None:
            belongs = conn.execute(
                "SELECT 1 FROM quiz_items WHERE id = ? AND quiz_id = ?", (item_id, quiz["id"])
            ).fetchone()
            if not belongs:
                raise QuizValidationError("item_id no pertenece al quiz")
        if option_id is not None:
            belongs = conn.execute(
                "SELECT 1 FROM quiz_opciones WHERE id = ? AND item_id = ?", (option_id, item_id)
            ).fetchone()
            if not belongs:
                raise QuizValidationError("option_id no pertenece al item")
        _insert_media(conn, quiz["id"], actor_id, normalized, item_id=item_id, option_id=option_id)
        conn.execute(
            "UPDATE quizzes SET version_actual = version_actual + 1, fecha_actualizacion = ? WHERE id = ?",
            (now_utc(), quiz["id"]),
        )
        conn.execute(
            "UPDATE actividades SET fecha_actualizacion = ? WHERE id = ?", (now_utc(), activity_id)
        )
        _store_snapshot(conn, activity_id, actor_id)
        result = _quiz_from_conn(conn, activity_id, include_answers=True)
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        close_db(conn)


def _snapshot_for_attempt(conn: sqlite3.Connection, activity_id: int, version: Optional[int]) -> Optional[dict]:
    row = conn.execute(
        """
        SELECT q.id, q.version_actual FROM quizzes q WHERE q.actividad_id = ?
        """,
        (activity_id,),
    ).fetchone()
    if not row:
        return None
    version = version or row["version_actual"]
    snapshot_row = conn.execute(
        "SELECT snapshot FROM quiz_versions WHERE quiz_id = ? AND numero = ?",
        (row["id"], version),
    ).fetchone()
    return _json_load(snapshot_row["snapshot"]) if snapshot_row else None


def _answer_matches(item: dict, answer: Any) -> bool:
    item_type = item["type"]
    expected = item.get("correct_answer")
    if item_type == "multiple_choice":
        given = answer if isinstance(answer, list) else [answer]
        return {_normalize_answer_value(v).casefold() for v in given} == {
            _normalize_answer_value(v).casefold() for v in (expected or [])
        }
    if item_type == "short_text":
        expected_values = expected if isinstance(expected, list) else [expected]
        case_sensitive = bool(item.get("config", {}).get("case_sensitive", False))
        given = _normalize_answer_value(answer).strip()
        if not case_sensitive:
            given = given.casefold()
        for value in expected_values:
            candidate = _normalize_answer_value(value).strip()
            if not case_sensitive:
                candidate = candidate.casefold()
            if given == candidate:
                return True
        return False
    return _normalize_answer_value(answer).casefold() == _normalize_answer_value(expected).casefold()


def guardar_respuestas_quiz(intento_id: int, respuestas: list) -> Optional[dict]:
    if not isinstance(respuestas, list):
        raise QuizValidationError("respuestas debe ser una lista")
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        intento = conn.execute("SELECT * FROM intentos WHERE id = ?", (intento_id,)).fetchone()
        if not intento:
            conn.rollback()
            return None
        snapshot = _snapshot_for_attempt(
            conn, intento["actividad_id"], intento["quiz_version"]
        )
        if not snapshot:
            conn.rollback()
            return None
        submitted = {}
        for index, response in enumerate(respuestas, 1):
            if not isinstance(response, dict):
                raise QuizValidationError(f"respuestas[{index}] debe ser un objeto")
            item_id = _first(response, "item_id", "quiz_item_id", "pregunta_id")
            try:
                item_id = int(item_id)
            except (TypeError, ValueError):
                raise QuizValidationError(f"respuestas[{index}].item_id es requerido")
            if item_id in submitted:
                raise QuizValidationError("No se puede responder dos veces el mismo bloque")
            submitted[item_id] = response

        valid_ids = {item["id"] for item in snapshot.get("items", [])}
        unknown = set(submitted) - valid_ids
        if unknown:
            raise QuizValidationError("Una respuesta no pertenece a esta versión del quiz")

        detail = []
        points = 0.0
        max_points = 0.0
        correct_count = 0
        for item in snapshot.get("items", []):
            if item["type"] in {"info", "flashcard"}:
                continue
            max_points += float(item.get("score", 1) or 0)
            response = submitted.get(item["id"], {})
            answer = _first(response, "answer", "respuesta")
            is_correct = _answer_matches(item, answer) if answer is not None else False
            awarded = float(item.get("score", 1) or 0) if is_correct else 0.0
            if is_correct:
                correct_count += 1
                points += awarded
            time_ms = _first(response, "time_ms", "tiempo_ms")
            if time_ms is not None:
                time_ms = _positive_int(time_ms, "tiempo_ms", minimum=0, maximum=86_400_000)
            conn.execute(
                """
                INSERT INTO quiz_respuestas_intento
                    (intento_id, quiz_item_id, respuesta, correcta, puntaje_obtenido, tiempo_ms)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(intento_id, quiz_item_id) DO UPDATE SET
                    respuesta = excluded.respuesta, correcta = excluded.correcta,
                    puntaje_obtenido = excluded.puntaje_obtenido,
                    tiempo_ms = excluded.tiempo_ms, fecha = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                """,
                (intento_id, item["id"], _json_dump(answer), 1 if is_correct else 0, awarded, time_ms),
            )
            detail.append({
                "item_id": item["id"],
                "quiz_item_id": item["id"],
                "pregunta_id": item["id"],
                "answer": answer,
                "respuesta": answer,
                "correct": is_correct,
                "correcta": 1 if is_correct else 0,
                "score": awarded,
                "puntaje_obtenido": awarded,
                "explanation": item.get("explanation"),
                "explicacion": item.get("explanation"),
            })

        # Un recorrido compuesto solo por fichas/contenido se completa, no se reprueba.
        percentage = round(points / max_points * 100, 2) if max_points else 100.0
        finished_at = now_utc()
        duration = None
        try:
            start = datetime.fromisoformat(intento["iniciado_en"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(finished_at.replace("Z", "+00:00"))
            duration = max(0, int((end - start).total_seconds()))
        except (AttributeError, TypeError, ValueError):
            pass
        conn.execute(
            """
            UPDATE intentos SET estado = 'completado', puntaje = ?, puntaje_maximo = ?,
                porcentaje = ?, respuestas_correctas = ?, finalizado_en = ?, duracion_segundos = ?
            WHERE id = ?
            """,
            (round(points, 2), round(max_points, 2), percentage, correct_count, finished_at, duration, intento_id),
        )
        conn.execute(
            "INSERT INTO quiz_attempt_events (intento_id, tipo, datos) VALUES (?, 'submitted', ?)",
            (intento_id, _json_dump({"percentage": percentage, "answers": len(submitted)})),
        )
        updated = dict(conn.execute("SELECT * FROM intentos WHERE id = ?", (intento_id,)).fetchone())
        conn.commit()
        return {"intento": updated, "detalle": detail, "quiz_version": intento["quiz_version"]}
    except Exception:
        conn.rollback()
        raise
    finally:
        close_db(conn)


def listar_respuestas_quiz(intento_id: int) -> list:
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM quiz_respuestas_intento WHERE intento_id = ? ORDER BY id", (intento_id,)
        ).fetchall()
        return [
            {
                **dict(row),
                "respuesta": _json_load(row["respuesta"]),
                "item_id": row["quiz_item_id"],
            }
            for row in rows
        ]
    finally:
        close_db(conn)


def listar_versiones(activity_id: int) -> list:
    conn = get_db()
    try:
        rows = conn.execute(
            """
            SELECT qv.id, qv.numero, qv.creado_por, qv.fecha_creacion
            FROM quiz_versions qv JOIN quizzes q ON q.id = qv.quiz_id
            WHERE q.actividad_id = ? ORDER BY qv.numero DESC
            """,
            (activity_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        close_db(conn)


def obtener_snapshot(activity_id: int, version: int, *, include_answers=True) -> Optional[dict]:
    conn = get_db()
    try:
        row = conn.execute(
            """
            SELECT qv.snapshot FROM quiz_versions qv
            JOIN quizzes q ON q.id = qv.quiz_id
            WHERE q.actividad_id = ? AND qv.numero = ?
            """,
            (activity_id, version),
        ).fetchone()
        if not row:
            return None
        snapshot = _json_load(row["snapshot"])
        if not include_answers:
            for item in snapshot.get("items", []):
                if item.get("type") != "flashcard":
                    item.pop("correct_answer", None)
                    item.pop("respuesta_correcta", None)
                for option in item.get("options", []):
                    option.pop("correct", None)
                    option.pop("es_correcta", None)
        return snapshot
    finally:
        close_db(conn)
