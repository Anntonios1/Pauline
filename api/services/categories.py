from api.database.connection import get_db, close_db, list_to_dicts
from api.models import Categoria
from api.utils.helpers import now_utc


def crear_categoria(categoria: Categoria) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO categorias (nombre, slug, descripcion, area, activa)
            VALUES (?, ?, ?, ?, ?)
            """,
            (categoria.nombre, categoria.slug, categoria.descripcion, categoria.area, categoria.activa),
        )
        conn.commit()
        return obtener_categoria_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def listar_categorias(area: str = None, activas: bool = True) -> list:
    conn = get_db()
    try:
        query = "SELECT * FROM categorias"
        condiciones = []
        params = []
        if activas:
            condiciones.append("activa = 1")
        if area:
            condiciones.append("area = ?")
            params.append(area)
        if condiciones:
            query += " WHERE " + " AND ".join(condiciones)
        cursor = conn.execute(query + " ORDER BY area, nombre", params)
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def obtener_categoria_por_id(categoria_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM categorias WHERE id = ?", (categoria_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def actualizar_categoria(categoria_id: int, datos: dict) -> dict:
    conn = get_db()
    try:
        campos = []
        valores = []
        for campo in ["nombre", "slug", "descripcion", "area", "activa"]:
            if campo in datos:
                campos.append(f"{campo} = ?")
                valores.append(datos[campo])
        if not campos:
            return obtener_categoria_por_id(categoria_id)
        campos.append("fecha_actualizacion = ?")
        valores.append(now_utc())
        valores.append(categoria_id)
        conn.execute(f"UPDATE categorias SET {', '.join(campos)} WHERE id = ?", valores)
        conn.commit()
        return obtener_categoria_por_id(categoria_id)
    finally:
        close_db(conn)


def eliminar_categoria(categoria_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute("UPDATE categorias SET activa = 0, fecha_actualizacion = ? WHERE id = ?", (now_utc(), categoria_id))
        conn.commit()
        return True
    finally:
        close_db(conn)
