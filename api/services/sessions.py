from datetime import datetime, timedelta, timezone

from api.config.settings import TOKEN_EXPIRES_HOURS
from api.database.connection import get_db, close_db
from api.utils.helpers import now_utc, hash_token, encrypt_aes, decrypt_aes, token_expires_at


def _debe_renovar(expira_en: str) -> bool:
    """True si a la sesión le queda menos de la mitad de su ventana de vida.

    Sin esto una persona activa toda la clase se cae a mitad de sesión en
    cuanto se cumplen las 24h desde el login, sin aviso. Renovar solo cuando
    ya pasó la mitad evita escribir en la BD en cada petición autenticada.
    """
    try:
        expira = datetime.fromisoformat(expira_en.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return True
    restante = expira - datetime.now(timezone.utc)
    return restante < timedelta(hours=TOKEN_EXPIRES_HOURS / 2)


def _session_from_row(row: dict) -> dict:
    """Descifra el token cifrado de la sesión para devolverlo al cliente."""
    data = dict(row)
    data["token"] = decrypt_aes(data.get("token_cifrado"))
    return data


def crear_sesion(usuario_id: int, token: str, ip: str = None, user_agent: str = None) -> dict:
    conn = get_db()
    try:
        expira = token_expires_at()
        cursor = conn.execute(
            """
            INSERT INTO sesiones (usuario_id, token_hash, token_cifrado, creada_en, expira_en, ip, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (usuario_id, hash_token(token), encrypt_aes(token), now_utc(), expira, ip, user_agent),
        )
        conn.commit()
        return obtener_sesion_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def obtener_sesion_por_id(sesion_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM sesiones WHERE id = ?", (sesion_id,))
        row = cursor.fetchone()
        return _session_from_row(row) if row else None
    finally:
        close_db(conn)


def obtener_sesion_por_token(token: str) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            "SELECT * FROM sesiones WHERE token_hash = ? AND activa = 1 AND expira_en > ?",
            (hash_token(token), now_utc()),
        )
        row = cursor.fetchone()
        if not row:
            return None
        sesion = _session_from_row(row)
        # Sesión deslizante: usar la app sigue extendiendo la ventana, así
        # que una persona activa nunca se cae a media clase.
        if _debe_renovar(sesion["expira_en"]):
            nueva_expiracion = token_expires_at()
            conn.execute("UPDATE sesiones SET expira_en = ? WHERE id = ?", (nueva_expiracion, sesion["id"]))
            conn.commit()
            sesion["expira_en"] = nueva_expiracion
        return sesion
    finally:
        close_db(conn)


def cerrar_sesion(token: str) -> bool:
    conn = get_db()
    try:
        conn.execute(
            "UPDATE sesiones SET activa = 0, cerrada_en = ? WHERE token_hash = ?",
            (now_utc(), hash_token(token)),
        )
        conn.commit()
        return True
    finally:
        close_db(conn)


def cerrar_sesiones_usuario(usuario_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute(
            "UPDATE sesiones SET activa = 0, cerrada_en = ? WHERE usuario_id = ? AND activa = 1",
            (now_utc(), usuario_id),
        )
        conn.commit()
        return True
    finally:
        close_db(conn)


def limpiar_sesiones_expiradas() -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            "UPDATE sesiones SET activa = 0 WHERE activa = 1 AND expira_en <= ?",
            (now_utc(),),
        )
        conn.commit()
        return cursor.rowcount
    finally:
        close_db(conn)
