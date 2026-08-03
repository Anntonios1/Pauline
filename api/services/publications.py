import json

from api.config.settings import ALLOWED_PUB_ACENTOS, ALLOWED_PUB_PATRONES
from api.database.connection import get_db, close_db, list_to_dicts
from api.models import Publicacion, Moderacion
from api.services.notifications import crear_notificacion
from api.utils.helpers import now_utc, sql_like_term

_DECISION_TITULOS = {
    "aprobar": "¡Tu publicación fue aprobada!",
    "corregir": "Tu publicación necesita cambios",
    "rechazar": "Tu publicación fue rechazada",
}


def normalizar_estilo_visual(valor) -> str:
    """Devuelve un JSON seguro para publicaciones.estilo_visual.

    Acepta dict o cadena JSON y descarta cualquier clave o valor que no esté
    en la lista blanca, de modo que el frontend solo reciba nombres que
    existan como clases en el CSS.
    """
    if isinstance(valor, str):
        try:
            valor = json.loads(valor or "{}")
        except (json.JSONDecodeError, TypeError):
            valor = {}
    if not isinstance(valor, dict):
        valor = {}

    estilo = {}
    acento = valor.get("acento")
    if acento in ALLOWED_PUB_ACENTOS:
        estilo["acento"] = acento
    patron = valor.get("patron")
    if patron in ALLOWED_PUB_PATRONES:
        estilo["patron"] = patron
    return json.dumps(estilo, ensure_ascii=False)


def crear_publicacion(publicacion: Publicacion) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO publicaciones (autor_id, titulo, slug, resumen, contenido, imagen_portada,
                                       categoria_id, estado, visibilidad, fecha_publicacion,
                                       publicado_por, moderador_id, estilo_visual)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                publicacion.autor_id,
                publicacion.titulo,
                publicacion.slug,
                publicacion.resumen,
                publicacion.contenido,
                publicacion.imagen_portada,
                publicacion.categoria_id,
                publicacion.estado,
                publicacion.visibilidad,
                publicacion.fecha_publicacion,
                publicacion.publicado_por,
                publicacion.moderador_id,
                normalizar_estilo_visual(publicacion.estilo_visual),
            ),
        )
        conn.commit()
        return obtener_publicacion_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def listar_publicaciones(estado: str = "aprobada", area: str = None, categoria_id: int = None, autor_id: int = None, q: str = None) -> list:
    conn = get_db()
    try:
        query = """
            SELECT p.*, c.nombre as categoria_nombre, c.area as categoria_area,
                   u.nombre_visible as autor_nombre, u.codigo as autor_codigo, u.rol as autor_rol,
                   u.imagen_perfil as autor_imagen,
                   (SELECT COUNT(*) FROM comentarios cm
                    WHERE cm.publicacion_id = p.id AND cm.estado = 'aprobado') AS comentarios_count,
                   (SELECT cm.contenido FROM comentarios cm
                    WHERE cm.publicacion_id = p.id AND cm.estado = 'aprobado'
                    ORDER BY cm.fecha DESC LIMIT 1) AS comentario_destacado,
                   (SELECT cu.nombre_visible FROM comentarios cm
                    JOIN usuarios cu ON cu.id = cm.autor_id
                    WHERE cm.publicacion_id = p.id AND cm.estado = 'aprobado'
                    ORDER BY cm.fecha DESC LIMIT 1) AS comentario_autor
            FROM publicaciones p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN usuarios u ON u.id = p.autor_id
        """
        condiciones = []
        params = []
        if estado:
            condiciones.append("p.estado = ?")
            params.append(estado)
        if area:
            condiciones.append("c.area = ?")
            params.append(area)
        if categoria_id:
            condiciones.append("p.categoria_id = ?")
            params.append(categoria_id)
        if autor_id:
            condiciones.append("p.autor_id = ?")
            params.append(autor_id)
        if q:
            condiciones.append("(p.titulo LIKE ? ESCAPE '\\' OR p.contenido LIKE ? ESCAPE '\\' OR p.resumen LIKE ? ESCAPE '\\')")
            termino = sql_like_term(q)
            params.extend([termino, termino, termino])
        if condiciones:
            query += " WHERE " + " AND ".join(condiciones)
        cursor = conn.execute(query + " ORDER BY p.fecha_publicacion DESC", params)
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def obtener_publicacion_por_id(publicacion_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT p.*, c.nombre as categoria_nombre, c.area as categoria_area,
                   u.nombre_visible as autor_nombre, u.codigo as autor_codigo, u.rol as autor_rol,
                   u.imagen_perfil as autor_imagen
            FROM publicaciones p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN usuarios u ON u.id = p.autor_id
            WHERE p.id = ?
            """,
            (publicacion_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def obtener_publicacion_por_slug(slug: str) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT p.*, c.nombre as categoria_nombre, c.area as categoria_area,
                   u.nombre_visible as autor_nombre, u.codigo as autor_codigo, u.rol as autor_rol,
                   u.imagen_perfil as autor_imagen
            FROM publicaciones p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            LEFT JOIN usuarios u ON u.id = p.autor_id
            WHERE p.slug = ?
            """,
            (slug,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def actualizar_publicacion(publicacion_id: int, datos: dict) -> dict:
    conn = get_db()
    try:
        campos = []
        valores = []
        for campo in ["autor_id", "titulo", "slug", "resumen", "contenido", "imagen_portada",
                      "categoria_id", "estado", "visibilidad", "fecha_publicacion",
                      "publicado_por", "moderador_id", "eliminado_en"]:
            if campo in datos:
                campos.append(f"{campo} = ?")
                valores.append(datos[campo])
        # Se normaliza aparte: nunca se guarda el JSON crudo del cliente.
        if "estilo_visual" in datos:
            campos.append("estilo_visual = ?")
            valores.append(normalizar_estilo_visual(datos["estilo_visual"]))
        if not campos:
            return obtener_publicacion_por_id(publicacion_id)
        campos.append("fecha_actualizacion = ?")
        valores.append(now_utc())
        valores.append(publicacion_id)
        conn.execute(f"UPDATE publicaciones SET {', '.join(campos)} WHERE id = ?", valores)
        conn.commit()
        return obtener_publicacion_por_id(publicacion_id)
    finally:
        close_db(conn)


def moderar_publicacion(moderacion: Moderacion) -> dict:
    conn = get_db()
    try:
        publicacion = obtener_publicacion_por_id(moderacion.publicacion_id)
        if not publicacion:
            return None
        estado_anterior = publicacion["estado"]
        conn.execute(
            """
            INSERT INTO moderaciones (publicacion_id, docente_id, estado_anterior, decision, estado_nuevo, observacion)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (moderacion.publicacion_id, moderacion.docente_id, estado_anterior,
             moderacion.decision, moderacion.estado_nuevo, moderacion.observacion),
        )
        publicado_por = None
        fecha_publicacion = publicacion["fecha_publicacion"]
        if moderacion.estado_nuevo == "aprobada":
            publicado_por = moderacion.docente_id
            if not fecha_publicacion:
                fecha_publicacion = now_utc()
        conn.execute(
            "UPDATE publicaciones SET estado = ?, moderador_id = ?, publicado_por = ?, fecha_publicacion = ?, fecha_actualizacion = ? WHERE id = ?",
            (moderacion.estado_nuevo, moderacion.docente_id, publicado_por, fecha_publicacion, now_utc(), moderacion.publicacion_id),
        )
        conn.commit()
        actualizada = obtener_publicacion_por_id(moderacion.publicacion_id)
        crear_notificacion(
            actualizada["autor_id"],
            f"publicacion_{moderacion.decision}",
            _DECISION_TITULOS.get(moderacion.decision, "Tu publicación fue revisada"),
            cuerpo=moderacion.observacion,
            enlace=f"/lecturas/{actualizada['slug']}" if moderacion.estado_nuevo == "aprobada" else None,
        )
        return actualizada
    finally:
        close_db(conn)


def listar_historial_moderacion(publicacion_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT m.*, u.nombre_visible as docente_nombre
            FROM moderaciones m
            LEFT JOIN usuarios u ON u.id = m.docente_id
            WHERE m.publicacion_id = ?
            ORDER BY m.fecha DESC
            """,
            (publicacion_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def listar_comentarios_publicacion(publicacion_id: int, estado: str = "aprobado") -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT c.*, u.nombre_visible as autor_nombre
            FROM comentarios c
            LEFT JOIN usuarios u ON u.id = c.autor_id
            WHERE c.publicacion_id = ? AND c.estado = ?
            ORDER BY c.fecha ASC
            """,
            (publicacion_id, estado),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)
