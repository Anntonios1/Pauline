"""
API de salas de juego — Docentes crean y habilitan las salas.
Los estudiantes se unen escaneando el QR.

Rutas:
  POST   /api/rooms               → crear sala
  GET    /api/rooms               → listar salas del docente
  GET    /api/rooms/{code}        → estado de una sala
  GET    /api/rooms/{code}/qr     → JSON con qr_base64 (PNG) y join_url
  DELETE /api/rooms/{code}        → cerrar sala

La sala se inicia únicamente por WebSocket (evento "start"): su ciclo de vida es
esperando → en_curso → finalizada. No existe paso REST de habilitación.
"""
import re
import io
import json
import random
import string

from api.routes.auth import require_role
from api.database.connection import get_db, close_db
from api.utils.helpers import now_utc


def _generate_code(length: int = 6) -> str:
    """Genera un código de sala único en mayúsculas."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


def _ensure_unique_code() -> str:
    for _ in range(10):
        code = _generate_code()
        conn = get_db()
        try:
            row = conn.execute("SELECT id FROM rooms WHERE id = ?", (code,)).fetchone()
            if not row:
                return code
        finally:
            close_db(conn)
    return _generate_code(8)


def _generate_qr_png(url: str) -> bytes:
    """Genera un PNG del QR con qrcode."""
    import qrcode
    from PIL import Image
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1e293b", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── Handlers ───────────────────────────────────────────────────────────────────

def create_room(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    actividad_id = body.get("actividad_id")
    if not actividad_id:
        return {"error": "Campo requerido: actividad_id"}, 400
    mode = body.get("modo", "quiz_race")
    if mode not in {"quiz_race", "speed", "classic"}:
        return {"error": "Modo de juego no valido"}, 400

    # Verificar que la actividad existe
    conn = get_db()
    try:
        actividad = conn.execute(
            """SELECT a.id, a.titulo, a.tipo,
                      COUNT(CASE WHEN qi.tipo IN ('single_choice','multiple_choice','true_false') THEN 1 END) AS live_questions
               FROM actividades a
               LEFT JOIN quizzes q ON q.actividad_id = a.id
               LEFT JOIN quiz_items qi ON qi.quiz_id = q.id
               WHERE a.id = ? AND a.activa = 1 GROUP BY a.id""",
            (int(actividad_id),),
        ).fetchone()
        if not actividad:
            return {"error": "Actividad no encontrada o inactiva"}, 404
        if not actividad["live_questions"]:
            return {"error": "Esta actividad necesita preguntas con opciones para jugar en vivo"}, 400

        code = _ensure_unique_code()
        max_jugadores = int(body.get("max_jugadores", 30))
        conn.execute(
            """INSERT INTO rooms (id, docente_id, actividad_id, estado, max_jugadores, modo, configuracion, creada_en)
               VALUES (?, ?, ?, 'esperando', ?, ?, ?, ?)""",
            (code, usuario["id"], int(actividad_id), max_jugadores, mode,
             json.dumps(body.get("configuracion") or {}, ensure_ascii=False), now_utc()),
        )
        conn.commit()
        return {
            "code": code,
            "actividad": dict(actividad),
            "max_jugadores": max_jugadores,
            "estado": "esperando",
            "modo": mode,
            "creada_en": now_utc(),
            "ws_url": f"/ws/room/{code}",
            "join_url": f"/sala/{code}",
        }
    finally:
        close_db(conn)


def list_rooms(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    conn = get_db()
    try:
        rows = conn.execute(
            """SELECT r.*, a.titulo as actividad_titulo
               FROM rooms r
               LEFT JOIN actividades a ON a.id = r.actividad_id
               WHERE r.docente_id = ?
               ORDER BY r.creada_en DESC LIMIT 50""",
            (usuario["id"],),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        close_db(conn)


def get_room(handler, params, query, body):
    code = params["code"]
    conn = get_db()
    try:
        row = conn.execute(
            """SELECT r.*, a.titulo as actividad_titulo,
                      (SELECT count(*) FROM game_sessions gs WHERE gs.room_id = r.id) as sesiones
               FROM rooms r
               LEFT JOIN actividades a ON a.id = r.actividad_id
               WHERE r.id = ?""",
            (code,),
        ).fetchone()
        if not row:
            return {"error": "Sala no encontrada"}, 404
        return dict(row)
    finally:
        close_db(conn)


def get_room_qr(handler, params, query, body):
    """Retorna JSON con el QR en base64 (qr_base64) y la URL de unión (join_url).

    El frontend lo renderiza como <img src={`data:image/png;base64,${qr_base64}`}>.
    """
    code = params["code"]
    conn = get_db()
    try:
        row = conn.execute("SELECT id FROM rooms WHERE id = ?", (code,)).fetchone()
        if not row:
            return {"error": "Sala no encontrada"}, 404
    finally:
        close_db(conn)

    # Detectar IP local del servidor para que los celulares en la misma red Wi-Fi puedan unirse
    import os
    import socket
    def _get_local_ip():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "192.168.0.120"

    local_ip = _get_local_ip()
    host = os.environ.get("HOST_URL", f"http://{local_ip}:5173")
    url = f"{host}/sala/{code}"

    try:
        png_bytes = _generate_qr_png(url)
    except ImportError:
        # qrcode/PIL son dependencias declaradas; si faltan, informar en vez de
        # devolver un JSON sin qr_base64 que deja al frontend cargando forever.
        return {
            "error": "El servidor no puede generar QR: falta la dependencia 'qrcode'. "
                     "Instálala con: pip install -r api/requirements.txt",
            "join_url": url,
            "code": code,
        }, 500

    # FastAPI: devolver bytes directamente no es posible desde un handler estándar.
    # Se codifica en base64 y el frontend lo decodifica.
    import base64
    return {
        "code": code,
        "join_url": url,
        "qr_base64": base64.b64encode(png_bytes).decode("ascii"),
        "qr_mime": "image/png",
    }


def delete_room(handler, params, query, body):
    usuario, error = require_role(handler, ["docente", "administrador"])
    if error:
        return error
    code = params["code"]
    conn = get_db()
    try:
        row = conn.execute("SELECT docente_id FROM rooms WHERE id = ?", (code,)).fetchone()
        if not row:
            return {"error": "Sala no encontrada"}, 404
        if row["docente_id"] != usuario["id"] and usuario["rol"] != "administrador":
            return {"error": "No tienes permiso sobre esta sala"}, 403
        conn.execute("UPDATE rooms SET estado = 'finalizada', finalizada_en = ? WHERE id = ?",
                     (now_utc(), code))
        conn.commit()
        return {"message": "Sala cerrada"}
    finally:
        close_db(conn)


def get_room_results(handler, params, query, body):
    """Resultados de la última sesión jugada en esta sala."""
    code = params["code"]
    conn = get_db()
    try:
        session = conn.execute(
            "SELECT * FROM game_sessions WHERE room_id = ? ORDER BY fecha DESC LIMIT 1",
            (code,),
        ).fetchone()
        if not session:
            return {"error": "Sin resultados aún"}, 404
        s = dict(session)
        s["leaderboard"] = json.loads(s.get("resultados_json") or "[]")
        return s
    finally:
        close_db(conn)


# ── Routing ────────────────────────────────────────────────────────────────────
routes = [
    (re.compile(r"^/api/rooms$"),                              ["POST"],   create_room),
    (re.compile(r"^/api/rooms$"),                              ["GET"],    list_rooms),
    (re.compile(r"^/api/rooms/(?P<code>[A-Z0-9]+)$"),          ["GET"],    get_room),
    (re.compile(r"^/api/rooms/(?P<code>[A-Z0-9]+)/qr$"),       ["GET"],    get_room_qr),
    (re.compile(r"^/api/rooms/(?P<code>[A-Z0-9]+)/results$"),  ["GET"],    get_room_results),
    (re.compile(r"^/api/rooms/(?P<code>[A-Z0-9]+)$"),          ["DELETE"], delete_room),
]
