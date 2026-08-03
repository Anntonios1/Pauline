import csv
import io
import re

from fastapi.responses import Response

from api.services.stats import (
    get_resumen_completo, get_detalle_estudiantes,
    get_actividad_diaria, get_estadisticas_actividades
)
from api.routes.auth import require_role

EXPORT_COLUMNAS = [
    "id", "nombre_visible", "codigo", "ultimo_acceso", "fecha_creacion",
    "actividades_completadas", "total_intentos", "promedio_porcentaje",
    "mejor_porcentaje", "tiempo_total_segundos", "comentarios_count",
    "mejor_area", "peor_area",
]


def stats_overview(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    return get_resumen_completo()


def stats_students(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    return get_detalle_estudiantes()


def stats_timeline(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    try:
        dias = int(query.get("dias", 30))
        if dias < 1 or dias > 365:
            return {"error": "Parametro dias debe estar entre 1 y 365"}, 400
    except (ValueError, TypeError):
        return {"error": "Parametro dias invalido"}, 400
    return get_actividad_diaria(dias)


def stats_activities(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    return get_estadisticas_actividades()


def stats_export(handler, params, query, body):
    """Exporta el detalle de estudiantes como CSV. Devuelve un Response crudo
    (no un dict) porque el archivo debe descargarse tal cual, sin el
    envoltorio JSON que aplica make_response() al resto de las rutas."""
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    estudiantes = get_detalle_estudiantes()
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=EXPORT_COLUMNAS, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(estudiantes)
    # BOM para que Excel detecte UTF-8 al abrir el archivo directamente.
    contenido = ("﻿" + buffer.getvalue()).encode("utf-8")
    return Response(
        content=contenido,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="progreso-estudiantes.csv"'},
    )


routes = [
    (re.compile(r"^/api/stats/overview$"), ["GET"], stats_overview),
    (re.compile(r"^/api/stats/students$"), ["GET"], stats_students),
    (re.compile(r"^/api/stats/timeline$"), ["GET"], stats_timeline),
    (re.compile(r"^/api/stats/activities$"), ["GET"], stats_activities),
    (re.compile(r"^/api/stats/export$"), ["GET"], stats_export),
]
