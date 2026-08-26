import os
import sqlite3
from typing import Optional

from api.config.settings import SCHEMA_PATH


def get_db(path: Optional[str] = None) -> sqlite3.Connection:
    db_file = path or os.environ.get("DB_PATH") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "blog.db")
    conn = sqlite3.connect(db_file, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def close_db(conn: sqlite3.Connection) -> None:
    if conn:
        conn.close()


def init_db(path: Optional[str] = None) -> None:
    """Aplica el esquema idempotente y las ampliaciones que CREATE TABLE IF NOT
    EXISTS no puede agregar a tablas antiguas. Nunca elimina ni reemplaza datos."""
    conn = get_db(path)
    try:
        with open(SCHEMA_PATH, encoding="utf-8") as f:
            conn.executescript(f.read())
        _ensure_quiz_columns(conn)
        _ensure_quiz_media_video_support(conn)
        _ensure_room_columns(conn)
        _ensure_publication_style_column(conn)
        _ensure_event_columns(conn)
        _ensure_quiz_privacy_column(conn)
        _ensure_categoria_orden_column(conn)
        _ensure_actividad_motor_column(conn)
        conn.commit()
    finally:
        close_db(conn)


def _column_names(conn: sqlite3.Connection, table: str) -> set:
    """Obtiene columnas de una tabla usando un nombre interno conocido."""
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _ensure_quiz_columns(conn: sqlite3.Connection) -> None:
    """ALTERs compatibles con bases creadas antes del motor unificado."""
    if "intentos" in {
        row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    } and "quiz_version" not in _column_names(conn, "intentos"):
        conn.execute("ALTER TABLE intentos ADD COLUMN quiz_version INTEGER")


def _ensure_quiz_media_video_support(conn: sqlite3.Connection) -> None:
    """Amplía el CHECK de medios sin perder los adjuntos existentes."""
    definition = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'quiz_media_assets'"
    ).fetchone()
    if not definition or "'video'" in (definition[0] or ""):
        return
    conn.executescript("""
        CREATE TABLE quiz_media_assets_v2 (
            id INTEGER PRIMARY KEY,
            quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
            item_id INTEGER REFERENCES quiz_items(id) ON DELETE CASCADE,
            opcion_id INTEGER REFERENCES quiz_opciones(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL CHECK (tipo IN ('image','audio','video','file')),
            url TEXT NOT NULL, nombre_archivo TEXT, mime_type TEXT,
            tamano_bytes INTEGER CHECK (tamano_bytes IS NULL OR tamano_bytes >= 0),
            texto_alternativo TEXT,
            configuracion TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(configuracion)),
            creado_por INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
            fecha_creacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            CHECK (opcion_id IS NULL OR item_id IS NOT NULL)
        );
        INSERT INTO quiz_media_assets_v2 SELECT * FROM quiz_media_assets;
        DROP TABLE quiz_media_assets;
        ALTER TABLE quiz_media_assets_v2 RENAME TO quiz_media_assets;
        CREATE INDEX IF NOT EXISTS idx_quiz_media_quiz ON quiz_media_assets(quiz_id);
        CREATE INDEX IF NOT EXISTS idx_quiz_media_item ON quiz_media_assets(item_id);
        CREATE INDEX IF NOT EXISTS idx_quiz_media_opcion ON quiz_media_assets(opcion_id);
    """)


def _ensure_room_columns(conn: sqlite3.Connection) -> None:
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if "rooms" not in tables:
        return
    columns = _column_names(conn, "rooms")
    if "modo" not in columns:
        conn.execute("ALTER TABLE rooms ADD COLUMN modo TEXT NOT NULL DEFAULT 'quiz_race'")
    if "configuracion" not in columns:
        conn.execute("ALTER TABLE rooms ADD COLUMN configuracion TEXT NOT NULL DEFAULT '{}'")


def _ensure_publication_style_column(conn: sqlite3.Connection) -> None:
    """Estilo visual por publicación (acento + patrón de portada).

    Se guarda como JSON en una sola columna para que añadir opciones nuevas
    no exija otra migración.
    """
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if "publicaciones" not in tables:
        return
    if "estilo_visual" not in _column_names(conn, "publicaciones"):
        conn.execute(
            "ALTER TABLE publicaciones ADD COLUMN estilo_visual TEXT NOT NULL DEFAULT '{}'"
        )


def _ensure_event_columns(conn: sqlite3.Connection) -> None:
    """Vincula un evento de agenda a un quiz dinámico (actividades.id)."""
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if "eventos_clase" not in tables:
        return
    if "actividad_id" not in _column_names(conn, "eventos_clase"):
        conn.execute("ALTER TABLE eventos_clase ADD COLUMN actividad_id INTEGER REFERENCES actividades(id) ON DELETE SET NULL")
    if "etiqueta" not in _column_names(conn, "eventos_clase"):
        conn.execute("ALTER TABLE eventos_clase ADD COLUMN etiqueta TEXT")


def _ensure_quiz_privacy_column(conn: sqlite3.Connection) -> None:
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if "quizzes" not in tables:
        return
    if "privado" not in _column_names(conn, "quizzes"):
        conn.execute("ALTER TABLE quizzes ADD COLUMN privado INTEGER NOT NULL DEFAULT 0 CHECK (privado IN (0,1))")


def _ensure_categoria_orden_column(conn: sqlite3.Connection) -> None:
    """Orden de los modulos en "Mi Ruta". No puede llevar un DEFAULT no
    constante en el ALTER, así que se agrega sin default y se rellena aparte
    con un orden determinista (por id ascendente) para bases ya existentes."""
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if "categorias" not in tables:
        return
    if "orden" not in _column_names(conn, "categorias"):
        conn.execute("ALTER TABLE categorias ADD COLUMN orden INTEGER")
        conn.execute("""
            UPDATE categorias SET orden = (
                SELECT COUNT(*) FROM categorias c2 WHERE c2.id <= categorias.id
            ) WHERE orden IS NULL
        """)


def _ensure_actividad_motor_column(conn: sqlite3.Connection) -> None:
    """Marca explícita de qué motor de preguntas usa una actividad, en vez de
    inferirlo por la presencia de una fila en `quizzes` en cada lectura."""
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if "actividades" not in tables:
        return
    if "motor_quiz" not in _column_names(conn, "actividades"):
        conn.execute(
            "ALTER TABLE actividades ADD COLUMN motor_quiz TEXT NOT NULL DEFAULT 'legacy' "
            "CHECK (motor_quiz IN ('legacy','unificado'))"
        )
        if "quizzes" in tables:
            conn.execute(
                "UPDATE actividades SET motor_quiz = 'unificado' "
                "WHERE id IN (SELECT actividad_id FROM quizzes)"
            )


def list_to_dicts(rows: list) -> list:
    return [dict(row) for row in rows]
