import re
from api.services.settings import obtener_banner_feed, guardar_banner_feed
from api.utils.upload import compress_and_save_image, UploadError
from api.routes.auth import require_role


def get_feed_banner(handler, params, query, body):
    """Publico: el feed lo pinta para cualquiera que lo abra."""
    return obtener_banner_feed()


def update_feed_banner(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador"])
    if error:
        return error
    datos = {}
    file_info = body.get("banner")
    if file_info and isinstance(file_info, dict):
        try:
            datos["image_url"] = compress_and_save_image(
                file_info["data"], file_info["mime_type"], max_width=1920, quality=82
            )
        except UploadError as exc:
            return {"error": str(exc)}, 400
    if "image_url" in body:
        datos["image_url"] = body["image_url"]
    if "active" in body:
        datos["active"] = body["active"]
    return guardar_banner_feed(datos, usuario["id"])


routes = [
    (re.compile(r"^/api/settings/feed-banner$"), ["GET"], get_feed_banner),
    (re.compile(r"^/api/settings/feed-banner$"), ["PUT", "POST"], update_feed_banner),
]
