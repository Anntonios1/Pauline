from api.database.connection import get_db, close_db, list_to_dicts
from api.models import Recurso
from api.utils.helpers import now_utc, sql_like_term


def crear_recurso(recurso: Recurso) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO recursos (titulo, descripcion, tipo, archivo_o_url, mime_type, tamano_bytes,
                                  area, categoria_id, fuente, licencia, subido_por)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                recurso.titulo,
                recurso.descripcion,
                recurso.tipo,
                recurso.archivo_o_url,
                recurso.mime_type,
                recurso.tamano_bytes,
                recurso.area,
                recurso.categoria_id,
                recurso.fuente,
                recurso.licencia,
                recurso.subido_por,
            ),
        )
        conn.commit()
        return obtener_recurso_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def listar_recursos(area: str = None, tipo: str = None, estado: str = "aprobado", activos: bool = True, subido_por: int = None, q: str = None) -> list:
    conn = get_db()
    try:
        query = "SELECT * FROM recursos"
        condiciones = []
        params = []
        if activos:
            condiciones.append("activo = 1")
        if estado:
            condiciones.append("estado_aprobacion = ?")
            params.append(estado)
        if area:
            condiciones.append("area = ?")
            params.append(area)
        if tipo:
            condiciones.append("tipo = ?")
            params.append(tipo)
        if subido_por is not None:
            condiciones.append("subido_por = ?")
            params.append(subido_por)
        if q:
            condiciones.append("(titulo LIKE ? ESCAPE '\\' OR descripcion LIKE ? ESCAPE '\\')")
            termino = sql_like_term(q)
            params.extend([termino, termino])
        if condiciones:
            query += " WHERE " + " AND ".join(condiciones)
        cursor = conn.execute(query + " ORDER BY titulo", params)
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def obtener_recurso_por_id(recurso_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM recursos WHERE id = ?", (recurso_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def actualizar_recurso(recurso_id: int, datos: dict) -> dict:
    conn = get_db()
    try:
        campos = []
        valores = []
        for campo in ["titulo", "descripcion", "tipo", "archivo_o_url", "mime_type", "tamano_bytes",
                      "area", "categoria_id", "fuente", "licencia", "estado_aprobacion",
                      "subido_por", "aprobado_por", "fecha_aprobacion", "activo"]:
            if campo in datos:
                campos.append(f"{campo} = ?")
                valores.append(datos[campo])
        if not campos:
            return obtener_recurso_por_id(recurso_id)
        campos.append("fecha_actualizacion = ?")
        valores.append(now_utc())
        valores.append(recurso_id)
        conn.execute(f"UPDATE recursos SET {', '.join(campos)} WHERE id = ?", valores)
        conn.commit()
        return obtener_recurso_por_id(recurso_id)
    finally:
        close_db(conn)


def aprobar_recurso(recurso_id: int, docente_id: int) -> dict:
    return actualizar_recurso(recurso_id, {
        "estado_aprobacion": "aprobado",
        "aprobado_por": docente_id,
        "fecha_aprobacion": now_utc(),
    })


def rechazar_recurso(recurso_id: int, docente_id: int) -> dict:
    return actualizar_recurso(recurso_id, {
        "estado_aprobacion": "rechazado",
        "aprobado_por": docente_id,
        "fecha_aprobacion": now_utc(),
    })


def eliminar_recurso(recurso_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute("UPDATE recursos SET activo = 0, fecha_actualizacion = ? WHERE id = ?", (now_utc(), recurso_id))
        conn.commit()
        return True
    finally:
        close_db(conn)


def listar_recursos_publicacion(publicacion_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT r.*, pr.orden
            FROM recursos r
            JOIN publicacion_recursos pr ON pr.recurso_id = r.id
            WHERE pr.publicacion_id = ?
            ORDER BY pr.orden
            """,
            (publicacion_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def agregar_recurso_publicacion(publicacion_id: int, recurso_id: int, orden: int = 1) -> None:
    conn = get_db()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO publicacion_recursos (publicacion_id, recurso_id, orden) VALUES (?, ?, ?)",
            (publicacion_id, recurso_id, orden),
        )
        conn.commit()
    finally:
        close_db(conn)


def listar_recursos_actividad(actividad_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT r.*, ar.orden
            FROM recursos r
            JOIN actividad_recursos ar ON ar.recurso_id = r.id
            WHERE ar.actividad_id = ?
            ORDER BY ar.orden
            """,
            (actividad_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def agregar_recurso_actividad(actividad_id: int, recurso_id: int, orden: int = 1) -> None:
    conn = get_db()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO actividad_recursos (actividad_id, recurso_id, orden) VALUES (?, ?, ?)",
            (actividad_id, recurso_id, orden),
        )
        conn.commit()
    finally:
        close_db(conn)
