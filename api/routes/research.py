"""Exports para el motor de datos de investigación (proyecto de grado).

Los cinco exports bajo /api/research/export/*.csv están pseudonimizados
(columna `pseudonimo`, nunca nombre_visible ni codigo real) y accesibles
para docente/administrador, igual que el resto de /api/stats. El mapeo
pseudónimo -> identidad real vive en un endpoint aparte, deliberadamente
restringido a administrador, para que nunca se mezcle sin querer con los
datasets que se comparten para análisis.
"""

import csv
import io
import re

from fastapi.responses import Response

from api.routes.auth import require_role
from api.services.research import (
    exportar_eventos, exportar_intentos, exportar_participacion,
    exportar_respuestas, exportar_resumen, listar_pseudonimos,
)


def _csv_response(rows: list, columnas: list, filename: str) -> Response:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columnas, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    contenido = ("﻿" + buffer.getvalue()).encode("utf-8")
    return Response(
        content=contenido,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def export_intentos(handler, params, query, body):
    _, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    columnas = [
        "pseudonimo", "actividad_id", "actividad_titulo", "area", "dificultad",
        "actividad_tipo", "numero_intento", "estado", "puntaje", "puntaje_maximo",
        "porcentaje", "respuestas_correctas", "iniciado_en", "finalizado_en",
        "duracion_segundos",
    ]
    return _csv_response(exportar_intentos(), columnas, "investigacion-intentos.csv")


def export_respuestas(handler, params, query, body):
    _, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    columnas = [
        "pseudonimo", "actividad_id", "intento_id", "motor", "item_id", "item_tipo",
        "respuesta", "correcta", "puntaje_obtenido", "tiempo_ms", "fecha",
    ]
    return _csv_response(exportar_respuestas(), columnas, "investigacion-respuestas.csv")


def export_eventos(handler, params, query, body):
    _, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    columnas = ["pseudonimo", "verbo", "objeto_tipo", "objeto_id", "resultado", "contexto", "fecha"]
    return _csv_response(exportar_eventos(), columnas, "investigacion-eventos.csv")


def export_participacion(handler, params, query, body):
    _, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    columnas = ["pseudonimo", "tipo", "item_id", "referencia_id", "estado", "fecha_creacion", "fecha_resultado"]
    return _csv_response(exportar_participacion(), columnas, "investigacion-participacion.csv")


def export_resumen(handler, params, query, body):
    _, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    columnas = [
        "pseudonimo", "cuenta_creada", "ultimo_acceso", "actividades_completadas",
        "total_intentos", "promedio_porcentaje", "mejor_porcentaje", "tiempo_total_segundos",
        "mejor_area", "peor_area", "publicaciones_creadas", "publicaciones_aprobadas",
        "comentarios_creados", "comentarios_aprobados", "eventos_total", "logros_desbloqueados",
    ]
    return _csv_response(exportar_resumen(), columnas, "investigacion-resumen.csv")


def get_pseudonimos(handler, params, query, body):
    """Mapeo sensible pseudónimo -> identidad real. Solo administrador."""
    _, error = require_role(handler, ["administrador"])
    if error:
        return error
    return listar_pseudonimos()


routes = [
    (re.compile(r"^/api/research/export/intentos\.csv$"), ["GET"], export_intentos),
    (re.compile(r"^/api/research/export/respuestas\.csv$"), ["GET"], export_respuestas),
    (re.compile(r"^/api/research/export/eventos\.csv$"), ["GET"], export_eventos),
    (re.compile(r"^/api/research/export/participacion\.csv$"), ["GET"], export_participacion),
    (re.compile(r"^/api/research/export/resumen\.csv$"), ["GET"], export_resumen),
    (re.compile(r"^/api/research/pseudonimos$"), ["GET"], get_pseudonimos),
]
