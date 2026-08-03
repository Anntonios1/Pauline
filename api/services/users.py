from api.database.connection import get_db, close_db, list_to_dicts
from api.models import Usuario, Inscripcion
from api.utils.helpers import now_utc


def _user_select_public() -> str:
    return """
        SELECT id, codigo, correo, nombre_visible, imagen_perfil, rol, activo,
               ultimo_acceso, fecha_creacion
        FROM usuarios
    """


def crear_usuario(usuario: Usuario) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO usuarios (codigo, correo, nombre_visible, imagen_perfil, password_hash, rol, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                usuario.codigo,
                usuario.correo,
                usuario.nombre_visible,
                usuario.imagen_perfil,
                usuario.password_hash,
                usuario.rol,
                usuario.activo,
            ),
        )
        conn.commit()
        return obtener_usuario_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def listar_usuarios(rol: str = None, activos: bool = True) -> list:
    conn = get_db()
    try:
        query = _user_select_public()
        condiciones = []
        params = []
        if activos:
            condiciones.append("activo = 1")
        if rol:
            condiciones.append("rol = ?")
            params.append(rol)
        if condiciones:
            query += " WHERE " + " AND ".join(condiciones)
        cursor = conn.execute(query + " ORDER BY nombre_visible", params)
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def obtener_usuario_por_id(usuario_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            _user_select_public() + " WHERE id = ?",
            (usuario_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def obtener_usuario_por_codigo(codigo: str) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT id, codigo, correo, nombre_visible, imagen_perfil, rol, activo,
                   ultimo_acceso, password_hash, fecha_creacion
            FROM usuarios
            WHERE codigo = ?
            """,
            (codigo,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def actualizar_usuario(usuario_id: int, datos: dict) -> dict:
    conn = get_db()
    try:
        campos = []
        valores = []
        for campo in ["codigo", "correo", "nombre_visible", "imagen_perfil", "password_hash", "rol", "activo", "ultimo_acceso"]:
            if campo in datos:
                campos.append(f"{campo} = ?")
                valores.append(datos[campo])
        if not campos:
            return obtener_usuario_por_id(usuario_id)
        campos.append("fecha_actualizacion = ?")
        valores.append(now_utc())
        valores.append(usuario_id)
        conn.execute(f"UPDATE usuarios SET {', '.join(campos)} WHERE id = ?", valores)
        conn.commit()
        return obtener_usuario_por_id(usuario_id)
    finally:
        close_db(conn)


def inscribir_usuario(inscripcion: Inscripcion) -> dict:
    conn = get_db()
    try:
        conn.execute(
            """
            INSERT INTO inscripciones (usuario_id, curso_id, rol_en_curso, activo, fecha_inicio)
            VALUES (?, ?, ?, ?, ?)
            """,
            (inscripcion.usuario_id, inscripcion.curso_id, inscripcion.rol_en_curso, inscripcion.activo, inscripcion.fecha_inicio or now_utc()),
        )
        conn.commit()
        return {"usuario_id": inscripcion.usuario_id, "curso_id": inscripcion.curso_id, "rol_en_curso": inscripcion.rol_en_curso}
    finally:
        close_db(conn)


def listar_cursos_usuario(usuario_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT c.*, i.rol_en_curso, i.activo as inscripcion_activa
            FROM cursos c
            JOIN inscripciones i ON i.curso_id = c.id
            WHERE i.usuario_id = ?
            ORDER BY c.nombre
            """,
            (usuario_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def listar_estudiantes_curso(curso_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT u.id, u.codigo, u.nombre_visible, u.correo, u.imagen_perfil
            FROM usuarios u
            JOIN inscripciones i ON i.usuario_id = u.id
            WHERE i.curso_id = ? AND i.rol_en_curso = 'estudiante' AND i.activo = 1 AND u.activo = 1
            ORDER BY u.nombre_visible
            """,
            (curso_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def registrar_acceso(usuario_id: int) -> None:
    actualizar_usuario(usuario_id, {"ultimo_acceso": now_utc()})
