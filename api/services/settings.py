"""Configuración global de la institución (fila única por clave).

El valor es JSON para poder añadir ajustes de apariencia sin una migración
nueva por cada uno. Hoy solo existe 'feed_banner'.
"""
import json

from api.database.connection import get_db, close_db
from api.utils.helpers import now_utc

CLAVE_BANNER = "feed_banner"
BANNER_POR_DEFECTO = {"image_url": None, "active": False}


def obtener_configuracion(clave: str, por_defecto: dict = None) -> dict:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT valor FROM configuracion_global WHERE clave = ?", (clave,)
        ).fetchone()
        if not row:
            return dict(por_defecto or {})
        try:
            return json.loads(row["valor"])
        except (TypeError, json.JSONDecodeError):
            return dict(por_defecto or {})
    finally:
        close_db(conn)


def guardar_configuracion(clave: str, valor: dict, actor_id: int) -> dict:
    conn = get_db()
    try:
        conn.execute(
            """
            INSERT INTO configuracion_global (clave, valor, actualizado_por, fecha_actualizacion)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(clave) DO UPDATE SET
                valor = excluded.valor,
                actualizado_por = excluded.actualizado_por,
                fecha_actualizacion = excluded.fecha_actualizacion
            """,
            (clave, json.dumps(valor), actor_id, now_utc()),
        )
        conn.commit()
        return valor
    finally:
        close_db(conn)


def obtener_banner_feed() -> dict:
    return obtener_configuracion(CLAVE_BANNER, BANNER_POR_DEFECTO)


def guardar_banner_feed(datos: dict, actor_id: int) -> dict:
    actual = obtener_banner_feed()
    valor = {
        "image_url": datos.get("image_url", actual.get("image_url")),
        "active": bool(datos.get("active", actual.get("active", False))),
    }
    return guardar_configuracion(CLAVE_BANNER, valor, actor_id)
