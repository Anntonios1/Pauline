import re
from api.models import Curso
from api.services.courses import crear_curso, listar_cursos, obtener_curso_por_id, actualizar_curso, eliminar_curso
from api.routes.auth import require_role


def create_course(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    if not body.get("nombre"):
        return {"error": "Campo requerido: nombre"}, 400
    curso = Curso(
        nombre=body["nombre"],
        grado=body.get("grado", 5),
        jornada=body.get("jornada"),
        anio_escolar=body.get("anio_escolar", 2026),
    )
    return crear_curso(curso)


def list_courses(handler, params, query, body):
    activos = query.get("activos", "true").lower() == "true"
    return listar_cursos(activos=activos)


def get_course(handler, params, query, body):
    curso_id = int(params["id"])
    return obtener_curso_por_id(curso_id) or ({"error": "Curso no encontrado"}, 404)


def update_course(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    curso_id = int(params["id"])
    return actualizar_curso(curso_id, body) or ({"error": "Curso no encontrado"}, 404)


def delete_course(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    curso_id = int(params["id"])
    eliminar_curso(curso_id)
    return {"message": "Curso desactivado"}


routes = [
    (re.compile(r"^/api/courses$"), ["POST"], create_course),
    (re.compile(r"^/api/courses$"), ["GET"], list_courses),
    (re.compile(r"^/api/courses/(?P<id>\d+)$"), ["GET"], get_course),
    (re.compile(r"^/api/courses/(?P<id>\d+)$"), ["PUT", "PATCH"], update_course),
    (re.compile(r"^/api/courses/(?P<id>\d+)$"), ["DELETE"], delete_course),
]
