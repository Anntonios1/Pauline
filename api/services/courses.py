from api.database.connection import get_db, close_db, list_to_dicts
from api.models import Curso
from api.utils.helpers import now_utc


def crear_curso(curso: Curso) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO cursos (nombre, grado, jornada, anio_escolar, activo)
            VALUES (?, ?, ?, ?, ?)
            """,
            (curso.nombre, curso.grado, curso.jornada, curso.anio_escolar, curso.activo),
        )
        conn.commit()
        return obtener_curso_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def listar_cursos(activos: bool = True) -> list:
    conn = get_db()
    try:
        query = "SELECT * FROM cursos"
        params = ()
        if activos:
            query += " WHERE activo = 1"
        cursor = conn.execute(query + " ORDER BY grado, nombre", params)
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def obtener_curso_por_id(curso_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM cursos WHERE id = ?", (curso_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def actualizar_curso(curso_id: int, datos: dict) -> dict:
    conn = get_db()
    try:
        campos = []
        valores = []
        for campo in ["nombre", "grado", "jornada", "anio_escolar", "activo"]:
            if campo in datos:
                campos.append(f"{campo} = ?")
                valores.append(datos[campo])
        if not campos:
            return obtener_curso_por_id(curso_id)
        campos.append("fecha_actualizacion = ?")
        valores.append(now_utc())
        valores.append(curso_id)
        conn.execute(f"UPDATE cursos SET {', '.join(campos)} WHERE id = ?", valores)
        conn.commit()
        return obtener_curso_por_id(curso_id)
    finally:
        close_db(conn)


def eliminar_curso(curso_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute("UPDATE cursos SET activo = 0, fecha_actualizacion = ? WHERE id = ?", (now_utc(), curso_id))
        conn.commit()
        return True
    finally:
        close_db(conn)
