import re
from api.models import Categoria
from api.services.categories import crear_categoria, listar_categorias, obtener_categoria_por_id, actualizar_categoria, eliminar_categoria
from api.utils.helpers import generate_slug
from api.routes.auth import require_role


def validate_area(area):
    from api.config.settings import ALLOWED_AREAS
    return area in ALLOWED_AREAS


def create_category(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    if not validate_area(body.get("area")):
        return {"error": "Area invalida"}, 400
    if not body.get("nombre"):
        return {"error": "Campo requerido: nombre"}, 400
    categoria = Categoria(
        nombre=body["nombre"],
        slug=generate_slug(body["nombre"]),
        descripcion=body.get("descripcion"),
        area=body["area"],
    )
    return crear_categoria(categoria)


def list_categories(handler, params, query, body):
    area = query.get("area")
    activas = query.get("activas", "true").lower() == "true"
    return listar_categorias(area=area, activas=activas)


def get_category(handler, params, query, body):
    categoria_id = int(params["id"])
    return obtener_categoria_por_id(categoria_id) or ({"error": "Categoria no encontrada"}, 404)


def update_category(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    categoria_id = int(params["id"])
    return actualizar_categoria(categoria_id, body) or ({"error": "Categoria no encontrada"}, 404)


def delete_category(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    categoria_id = int(params["id"])
    eliminar_categoria(categoria_id)
    return {"message": "Categoria desactivada"}


routes = [
    (re.compile(r"^/api/categories$"), ["POST"], create_category),
    (re.compile(r"^/api/categories$"), ["GET"], list_categories),
    (re.compile(r"^/api/categories/(?P<id>\d+)$"), ["GET"], get_category),
    (re.compile(r"^/api/categories/(?P<id>\d+)$"), ["PUT", "PATCH"], update_category),
    (re.compile(r"^/api/categories/(?P<id>\d+)$"), ["DELETE"], delete_category),
]
