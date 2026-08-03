"""Notificaciones persistentes por usuario.

Antes la campana de la TopBar recalculaba "pendientes/aprobadas" desde datos
en vivo en cada carga — no había historial ni "marcar como leído" real. Este
módulo persiste cada notificación una sola vez; ver crear_notificacion() y
sus llamadas en publications.py / comments_events.py / achievements.py.
"""

from api.database.connection import get_db, close_db, list_to_dicts
from api.utils.helpers import now_utc


def crear_notificacion(usuario_id: int, tipo: str, titulo: str, cuerpo: str = None, enlace: str = None) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO notificaciones (usuario_id, tipo, titulo, cuerpo, enlace, fecha_creacion)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (usuario_id, tipo, titulo, cuerpo, enlace, now_utc()),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM notificaciones WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)
    finally:
        close_db(conn)


def crear_notificacion_para_staff(tipo: str, titulo: str, cuerpo: str = None, enlace: str = None) -> None:
    """Una fila por cada docente/admin activo: no hay "audiencia" en el modelo,
    así que notificar a todo el staff es insertar varias notificaciones individuales."""
    conn = get_db()
    try:
        staff_ids = [
            row[0] for row in conn.execute(
                "SELECT id FROM usuarios WHERE rol IN ('docente', 'administrador') AND activo = 1"
            ).fetchall()
        ]
    finally:
        close_db(conn)
    for usuario_id in staff_ids:
        crear_notificacion(usuario_id, tipo, titulo, cuerpo, enlace)


def listar_notificaciones(usuario_id: int, solo_no_leidas: bool = False, limit: int = 50) -> list:
    conn = get_db()
    try:
        query = "SELECT * FROM notificaciones WHERE usuario_id = ?"
        params = [usuario_id]
        if solo_no_leidas:
            query += " AND leida = 0"
        query += " ORDER BY fecha_creacion DESC LIMIT ?"
        params.append(limit)
        cursor = conn.execute(query, params)
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def marcar_leida(notificacion_id: int, usuario_id: int) -> bool:
    """Solo el dueño puede marcarla: filtra por usuario_id además del id."""
    conn = get_db()
    try:
        cursor = conn.execute(
            "UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?",
            (notificacion_id, usuario_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        close_db(conn)


def marcar_todas_leidas(usuario_id: int) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            "UPDATE notificaciones SET leida = 1 WHERE usuario_id = ? AND leida = 0", (usuario_id,)
        )
        conn.commit()
        return cursor.rowcount
    finally:
        close_db(conn)
