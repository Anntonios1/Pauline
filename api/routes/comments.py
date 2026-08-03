import re
from api.models import Comentario
from api.services.comments_events import crear_comentario, listar_comentarios_por_estado, moderar_comentario, obtener_comentario_por_id, eliminar_comentario
from api.routes.auth import get_user_from_token, require_role


def create_comment(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    for campo in ("publicacion_id", "contenido"):
        if not body.get(campo):
            return {"error": f"Campo requerido: {campo}"}, 400
    comentario = Comentario(
        publicacion_id=body["publicacion_id"],
        autor_id=usuario["id"],
        comentario_padre_id=body.get("comentario_padre_id"),
        contenido=body["contenido"],
    )
    try:
        return crear_comentario(comentario)
    except Exception as e:
        return {"error": str(e)}, 400


def list_pending_comments(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    return listar_comentarios_por_estado("pendiente")


def moderate_comment(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    comentario_id = int(params["id"])
    estado = body.get("estado")
    if estado not in ("aprobado", "rechazado"):
        return {"error": "Estado invalido: usa 'aprobado' o 'rechazado'"}, 400
    if not obtener_comentario_por_id(comentario_id):
        return {"error": "Comentario no encontrado"}, 404
    return moderar_comentario(comentario_id, estado, usuario["id"])


def delete_comment(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    comentario_id = int(params["id"])
    comment = obtener_comentario_por_id(comentario_id)
    if not comment:
        return {"error": "Comentario no encontrado"}, 404
    eliminar_comentario(comentario_id)
    return {"message": "Comentario eliminado"}


routes = [
    (re.compile(r"^/api/comments$"), ["POST"], create_comment),
    (re.compile(r"^/api/comments/pending$"), ["GET"], list_pending_comments),
    (re.compile(r"^/api/comments/(?P<id>\d+)/moderate$"), ["POST"], moderate_comment),
    (re.compile(r"^/api/comments/(?P<id>\d+)$"), ["DELETE"], delete_comment),
]
