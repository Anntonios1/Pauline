import re
from api.models import Publicacion, Moderacion
from api.services.publications import (
    crear_publicacion, listar_publicaciones, obtener_publicacion_por_id,
    obtener_publicacion_por_slug, actualizar_publicacion, moderar_publicacion,
    listar_historial_moderacion, listar_comentarios_publicacion, alternar_reaccion
)
from api.config.settings import (
    ALLOWED_ESTADOS_PUBLICACION, ALLOWED_DECISIONES_MODERACION, ALLOWED_REACCIONES
)
from api.utils.helpers import generate_slug
from api.utils.helpers import now_utc
from api.utils.upload import compress_and_save_image, UploadError
from api.routes.auth import get_user_from_token, require_role
from api.websocket.feed_manager import feed_manager
from api.services.achievements import evaluar_logros
from api.services.notifications import crear_notificacion_para_staff


def create_publication(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    # Validate required fields explicitly to return 400 instead of 500 KeyError
    for campo in ("titulo", "contenido"):
        if not body.get(campo):
            return {"error": f"Campo requerido: {campo}"}, 400
    is_teacher = usuario["rol"] in {"docente", "administrador"}
    requested_state = body.get("estado", "borrador")
    # "publicada" era un alias heredado: se normaliza antes de validar contra el CHECK.
    if requested_state == "publicada":
        requested_state = "aprobada"
    if requested_state not in ALLOWED_ESTADOS_PUBLICACION:
        return {"error": f"Estado invalido: {requested_state}"}, 400
    if is_teacher:
        # Las publicaciones de docente son material oficial: se publican de inmediato.
        estado = requested_state
    else:
        # Un estudiante nunca se autoaprueba: como mucho queda enviada a revisión.
        estado = requested_state if requested_state in {"borrador", "enviada"} else "enviada"
    publicacion = Publicacion(
        autor_id=usuario["id"],
        titulo=body["titulo"],
        slug=generate_slug(body["titulo"]),
        resumen=body.get("resumen"),
        contenido=body["contenido"],
        imagen_portada=body.get("imagen_portada"),
        categoria_id=body.get("categoria_id"),
        estado=estado,
        visibilidad=body.get("visibilidad", "publica"),
        fecha_publicacion=now_utc() if estado == "aprobada" else None,
        publicado_por=usuario["id"] if estado == "aprobada" else None,
        estilo_visual=body.get("estilo_visual") or {},
    )
    try:
        creada = crear_publicacion(publicacion)
    except Exception as e:
        return {"error": str(e)}, 400
    if creada["estado"] == "enviada":
        crear_notificacion_para_staff(
            "publicacion_pendiente",
            "Nueva publicación para revisar",
            cuerpo=f'{usuario["nombre_visible"]} envió "{creada["titulo"]}"',
            enlace="/admin/moderar",
        )
    return creada


def list_publications(handler, params, query, body):
    usuario = get_user_from_token(handler)
    estado = query.get("estado", "aprobada")
    area = query.get("area")
    categoria_id = query.get("categoria_id")
    autor_id = query.get("autor_id")
    if categoria_id:
        categoria_id = int(categoria_id)
    if autor_id:
        autor_id = int(autor_id)
    # La cola de moderación no es pública: solo el staff la ve, o el autor viendo
    # exclusivamente sus propias publicaciones.
    if estado != "aprobada":
        es_staff = bool(usuario) and usuario["rol"] in {"docente", "administrador"}
        es_propio_autor = bool(usuario) and autor_id is not None and autor_id == usuario["id"]
        if not es_staff and not es_propio_autor:
            return {"error": "No tienes permiso para listar publicaciones en este estado"}, 403
    q = (query.get("q") or query.get("search") or "").strip()[:200] or None
    return listar_publicaciones(
        estado=estado, area=area, categoria_id=categoria_id, autor_id=autor_id, q=q,
        viewer_id=usuario["id"] if usuario else None,
    )


def _puede_ver_publicacion(handler, pub) -> bool:
    """Un borrador o una publicación en revisión no es contenido público.

    `list_publications` ya lo impide al listar; sin este chequeo el detalle por id
    o por slug seguía sirviendo el mismo material a cualquiera.
    """
    if pub["estado"] == "aprobada":
        return True
    usuario = get_user_from_token(handler)
    if not usuario:
        return False
    return usuario["rol"] in {"docente", "administrador"} or pub["autor_id"] == usuario["id"]


def get_publication(handler, params, query, body):
    publicacion_id = int(params["id"])
    pub = obtener_publicacion_por_id(publicacion_id)
    if not pub:
        return {"error": "Publicacion no encontrada"}, 404
    if not _puede_ver_publicacion(handler, pub):
        return {"error": "Publicacion no encontrada"}, 404
    pub["comentarios"] = listar_comentarios_publicacion(publicacion_id)
    return pub


def get_publication_by_slug(handler, params, query, body):
    slug = params["slug"]
    usuario = get_user_from_token(handler)
    pub = obtener_publicacion_por_slug(slug, viewer_id=usuario["id"] if usuario else None)
    if not pub:
        return {"error": "Publicacion no encontrada"}, 404
    if not _puede_ver_publicacion(handler, pub):
        return {"error": "Publicacion no encontrada"}, 404
    pub["comentarios"] = listar_comentarios_publicacion(pub["id"])
    return pub


def update_publication(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    publicacion_id = int(params["id"])
    pub = obtener_publicacion_por_id(publicacion_id)
    if not pub:
        return {"error": "Publicacion no encontrada"}, 404
    # Only the author or docente/administrador can update
    if usuario["rol"] == "estudiante" and pub["autor_id"] != usuario["id"]:
        return {"error": "No tienes permiso para editar esta publicacion"}, 403
    # Students cannot change estado directly (moderation is a separate flow)
    if usuario["rol"] == "estudiante" and "estado" in body:
        body.pop("estado")
    return actualizar_publicacion(publicacion_id, body) or ({"error": "Publicacion no encontrada"}, 404)


def moderate_publication(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    for campo in ("decision", "estado_nuevo"):
        if not body.get(campo):
            return {"error": f"Campo requerido: {campo}"}, 400
    if body["decision"] not in ALLOWED_DECISIONES_MODERACION:
        return {"error": f"Decision invalida: {body['decision']}"}, 400
    # Sin esto un estado arbitrario llega hasta el CHECK de SQLite y sale como 500.
    if body["estado_nuevo"] not in ALLOWED_ESTADOS_PUBLICACION:
        return {"error": f"Estado invalido: {body['estado_nuevo']}"}, 400
    moderacion = Moderacion(
        publicacion_id=int(params["id"]),
        docente_id=usuario["id"],
        estado_anterior=body.get("estado_anterior", "borrador"),
        decision=body["decision"],
        estado_nuevo=body["estado_nuevo"],
        observacion=body.get("observacion"),
    )
    resultado = moderar_publicacion(moderacion)
    if not resultado:
        return {"error": "Publicacion no encontrada"}, 404
    if resultado["estado"] == "aprobada":
        evaluar_logros(resultado["autor_id"])
    return resultado


def get_moderation_history(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    publicacion_id = int(params["id"])
    pub = obtener_publicacion_por_id(publicacion_id)
    if not pub:
        return {"error": "Publicacion no encontrada"}, 404
    # Las observaciones del docente son para el staff y el autor, no para el resto del curso.
    if usuario["rol"] not in {"docente", "administrador"} and pub["autor_id"] != usuario["id"]:
        return {"error": "No tienes permiso para ver esta moderacion"}, 403
    return listar_historial_moderacion(publicacion_id)


def upload_cover_image(handler, params, query, body):
    """Sube imagen de portada para una publicacion."""
    usuario, error = require_role(handler, ["docente", "administrador", "estudiante"])
    if error:
        return error

    publicacion_id = int(params["id"])
    pub = obtener_publicacion_por_id(publicacion_id)
    if not pub:
        return {"error": "Publicacion no encontrada"}, 404
    if usuario["rol"] == "estudiante" and pub["autor_id"] != usuario["id"]:
        return {"error": "No puedes editar esta publicacion"}, 403

    file_info = body.get("cover")
    if not file_info or not isinstance(file_info, dict):
        return {"error": "Debe enviar un archivo llamado 'cover'"}, 400

    try:
        path = compress_and_save_image(file_info["data"], file_info["mime_type"], max_width=1200, quality=85)
        return actualizar_publicacion(publicacion_id, {"imagen_portada": path})
    except UploadError as e:
        return {"error": str(e)}, 400


def toggle_reaction(handler, params, query, body):
    """Pone o quita una reaccion del usuario en sesion. Idempotente."""
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    publicacion_id = int(params["id"])
    tipo = (body.get("tipo") or body.get("reaccion") or "").strip()
    if tipo not in ALLOWED_REACCIONES:
        return {"error": f"Reaccion invalida. Usa: {', '.join(ALLOWED_REACCIONES)}"}, 400

    pub = obtener_publicacion_por_id(publicacion_id)
    if not pub:
        return {"error": "Publicacion no encontrada"}, 404
    # Solo se reacciona a lo publicado: un borrador ajeno no debe ni confirmarse
    # que existe, y sobre uno propio todavia no hay nada que compartir.
    if pub["estado"] != "aprobada":
        return {"error": "Publicacion no encontrada"}, 404

    resultado = alternar_reaccion(publicacion_id, usuario["id"], tipo)
    # Avisar a las demas pestanas/dispositivos. Solo viajan conteos de algo ya
    # aprobado, nunca contenido ni quien reacciono.
    feed_manager.publicar("reaccion", {
        "publicacion_id": publicacion_id,
        "reacciones": resultado["reacciones"],
    })
    return resultado


routes = [
    (re.compile(r"^/api/publications$"), ["POST"], create_publication),
    (re.compile(r"^/api/publications$"), ["GET"], list_publications),
    (re.compile(r"^/api/publications/(?P<id>\d+)$"), ["GET"], get_publication),
    (re.compile(r"^/api/publications/(?P<id>\d+)$"), ["PUT", "PATCH"], update_publication),
    (re.compile(r"^/api/publications/slug/(?P<slug>[\w-]+)$"), ["GET"], get_publication_by_slug),
    (re.compile(r"^/api/publications/(?P<id>\d+)/cover$"), ["POST"], upload_cover_image),
    (re.compile(r"^/api/publications/(?P<id>\d+)/moderate$"), ["POST"], moderate_publication),
    (re.compile(r"^/api/publications/(?P<id>\d+)/moderation$"), ["GET"], get_moderation_history),
    (re.compile(r"^/api/publications/(?P<id>\d+)/reactions$"), ["POST"], toggle_reaction),
]
