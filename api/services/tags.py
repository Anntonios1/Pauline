"""Etiquetas libres de publicaciones.

Las tablas `etiquetas` y `publicacion_etiquetas` ya existían en el esquema
pero nadie las usaba. No hay lista cerrada de valores: el docente puede
crear la etiqueta que necesite (la unicidad es por nombre, sin distinguir
mayúsculas). Son ortogonales a `categoria_id`, que sigue siendo el selector
único de módulo/área.
"""
from api.database.connection import get_db, close_db, list_to_dicts
from api.utils.helpers import generate_slug

MAX_NOMBRE = 40


class EtiquetaValidationError(Exception):
    pass


def listar_etiquetas() -> list:
    conn = get_db()
    try:
        return list_to_dicts(conn.execute(
            """
            SELECT e.*, (SELECT COUNT(*) FROM publicacion_etiquetas pe
                         WHERE pe.etiqueta_id = e.id) AS usos
            FROM etiquetas e ORDER BY e.nombre
            """
        ).fetchall())
    finally:
        close_db(conn)


def crear_etiqueta(nombre: str) -> dict:
    nombre = (nombre or "").strip()
    if not nombre:
        raise EtiquetaValidationError("El nombre de la etiqueta es requerido")
    if len(nombre) > MAX_NOMBRE:
        raise EtiquetaValidationError(f"El nombre no puede superar {MAX_NOMBRE} caracteres")
    slug = generate_slug(nombre)
    if not slug:
        raise EtiquetaValidationError("El nombre debe tener al menos una letra o número")
    conn = get_db()
    try:
        # COLLATE NOCASE en la tabla: "Laboratorio" y "laboratorio" son la misma.
        row = conn.execute("SELECT * FROM etiquetas WHERE slug = ?", (slug,)).fetchone()
        if row:
            return dict(row)
        cursor = conn.execute(
            "INSERT INTO etiquetas (nombre, slug) VALUES (?, ?)", (nombre, slug)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM etiquetas WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)
    finally:
        close_db(conn)


def listar_etiquetas_de_publicacion(publicacion_id: int) -> list:
    conn = get_db()
    try:
        return list_to_dicts(conn.execute(
            """
            SELECT e.* FROM etiquetas e
            JOIN publicacion_etiquetas pe ON pe.etiqueta_id = e.id
            WHERE pe.publicacion_id = ? ORDER BY e.nombre
            """,
            (publicacion_id,),
        ).fetchall())
    finally:
        close_db(conn)


def asignar_etiquetas(publicacion_id: int, nombres: list) -> list:
    """Reemplaza el conjunto de etiquetas de una publicación, creando las que
    no existan todavía."""
    if not isinstance(nombres, list):
        raise EtiquetaValidationError("etiquetas debe ser una lista de nombres")
    etiquetas = [crear_etiqueta(n) for n in nombres if str(n or "").strip()]
    conn = get_db()
    try:
        conn.execute("DELETE FROM publicacion_etiquetas WHERE publicacion_id = ?", (publicacion_id,))
        for etiqueta in etiquetas:
            conn.execute(
                "INSERT OR IGNORE INTO publicacion_etiquetas (publicacion_id, etiqueta_id) VALUES (?, ?)",
                (publicacion_id, etiqueta["id"]),
            )
        conn.commit()
        return etiquetas
    finally:
        close_db(conn)


def adjuntar_etiquetas(conn, publicaciones: list) -> None:
    """Agrega `etiquetas` a cada publicación de la lista en una sola consulta,
    igual que `_adjuntar_reacciones` — no una consulta por fila."""
    if not publicaciones:
        return
    ids = [p["id"] for p in publicaciones]
    marcadores = ",".join("?" * len(ids))
    por_publicacion = {}
    for fila in conn.execute(
        f"""
        SELECT pe.publicacion_id, e.id, e.nombre, e.slug
        FROM publicacion_etiquetas pe
        JOIN etiquetas e ON e.id = pe.etiqueta_id
        WHERE pe.publicacion_id IN ({marcadores})
        ORDER BY e.nombre
        """,
        ids,
    ).fetchall():
        por_publicacion.setdefault(fila["publicacion_id"], []).append(
            {"id": fila["id"], "nombre": fila["nombre"], "slug": fila["slug"]}
        )
    for publicacion in publicaciones:
        publicacion["etiquetas"] = por_publicacion.get(publicacion["id"], [])
