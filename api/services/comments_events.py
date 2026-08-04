from api.database.connection import get_db, close_db, list_to_dicts
from api.models import Comentario, EventoAprendizaje, Auditoria
from api.services.notifications import crear_notificacion
from api.utils.helpers import now_utc
from api.websocket.feed_manager import feed_manager


def crear_comentario(comentario: Comentario) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO comentarios (publicacion_id, autor_id, comentario_padre_id, contenido, estado)
            VALUES (?, ?, ?, ?, ?)
            """,
            (comentario.publicacion_id, comentario.autor_id, comentario.comentario_padre_id,
             comentario.contenido, comentario.estado),
        )
        conn.commit()
        creado = obtener_comentario_por_id(cursor.lastrowid)
        # Un comentario de estudiante nace 'pendiente' y no se ve hasta que lo
        # aprueben: solo se avisa de los que ya son visibles (los del docente).
        if creado and creado["estado"] == "aprobado":
            feed_manager.publicar("comentario_nuevo", {"publicacion_id": creado["publicacion_id"]})
        return creado
    finally:
        close_db(conn)


def obtener_comentario_por_id(comentario_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM comentarios WHERE id = ?", (comentario_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def listar_comentarios_por_estado(estado: str = "pendiente") -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT c.*, u.nombre_visible as autor_nombre, p.titulo as publicacion_titulo
            FROM comentarios c
            LEFT JOIN usuarios u ON u.id = c.autor_id
            JOIN publicaciones p ON p.id = c.publicacion_id
            WHERE c.estado = ?
            ORDER BY c.fecha DESC
            """,
            (estado,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def moderar_comentario(comentario_id: int, estado: str, moderado_por: int) -> dict:
    conn = get_db()
    try:
        conn.execute(
            "UPDATE comentarios SET estado = ?, moderado_por = ?, fecha_moderacion = ?, fecha_actualizacion = ? WHERE id = ?",
            (estado, moderado_por, now_utc(), now_utc(), comentario_id),
        )
        conn.commit()
        actualizado = obtener_comentario_por_id(comentario_id)
        publicacion = conn.execute(
            "SELECT slug, titulo FROM publicaciones WHERE id = ?", (actualizado["publicacion_id"],)
        ).fetchone()
        crear_notificacion(
            actualizado["autor_id"],
            f"comentario_{estado}",
            "Tu comentario fue publicado" if estado == "aprobado" else "Tu comentario fue rechazado",
            cuerpo=f'En "{publicacion["titulo"]}"' if publicacion else None,
            enlace=f"/lecturas/{publicacion['slug']}" if publicacion and estado == "aprobado" else None,
        )
        if estado == "aprobado":
            feed_manager.publicar("comentario_nuevo", {"publicacion_id": actualizado["publicacion_id"]})
        return actualizado
    finally:
        close_db(conn)


def eliminar_comentario(comentario_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute("DELETE FROM comentarios WHERE id = ?", (comentario_id,))
        conn.commit()
        return True
    finally:
        close_db(conn)


def registrar_evento(evento: EventoAprendizaje) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO eventos_aprendizaje (evento_id, actor_id, sesion_id, verbo, objeto_tipo, objeto_id, resultado, contexto)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (evento.evento_id, evento.actor_id, evento.sesion_id, evento.verbo,
             evento.objeto_tipo, evento.objeto_id, evento.resultado, evento.contexto),
        )
        conn.commit()
        return obtener_evento_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def obtener_evento_por_id(evento_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM eventos_aprendizaje WHERE id = ?", (evento_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def listar_eventos(actor_id: int = None, objeto_tipo: str = None, objeto_id: int = None) -> list:
    conn = get_db()
    try:
        query = "SELECT * FROM eventos_aprendizaje"
        condiciones = []
        params = []
        if actor_id:
            condiciones.append("actor_id = ?")
            params.append(actor_id)
        if objeto_tipo:
            condiciones.append("objeto_tipo = ?")
            params.append(objeto_tipo)
        if objeto_id:
            condiciones.append("objeto_id = ?")
            params.append(objeto_id)
        if condiciones:
            query += " WHERE " + " AND ".join(condiciones)
        cursor = conn.execute(query + " ORDER BY fecha DESC", params)
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def registrar_auditoria(auditoria: Auditoria) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, elemento_afectado,
                                   datos_anteriores, datos_nuevos, ip, user_agent, solicitud_id, descripcion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (auditoria.usuario_id, auditoria.accion, auditoria.entidad, auditoria.entidad_id,
             auditoria.elemento_afectado, auditoria.datos_anteriores, auditoria.datos_nuevos,
             auditoria.ip, auditoria.user_agent, auditoria.solicitud_id, auditoria.descripcion),
        )
        conn.commit()
        return obtener_auditoria_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def obtener_auditoria_por_id(auditoria_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM auditoria WHERE id = ?", (auditoria_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def listar_auditoria(entidad: str = None, usuario_id: int = None) -> list:
    conn = get_db()
    try:
        query = "SELECT * FROM auditoria"
        condiciones = []
        params = []
        if entidad:
            condiciones.append("entidad = ?")
            params.append(entidad)
        if usuario_id:
            condiciones.append("usuario_id = ?")
            params.append(usuario_id)
        if condiciones:
            query += " WHERE " + " AND ".join(condiciones)
        cursor = conn.execute(query + " ORDER BY fecha DESC LIMIT 500", params)
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)
