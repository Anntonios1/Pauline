"""
Room Manager — WebSocket en tiempo real para salas de juego.

Protocolo de mensajes (cliente → servidor):
  { "event": "join",   "token": "<bearer>", "nombre": "..." }
  { "event": "start" }                  # solo docente/admin
  { "event": "answer", "question_idx": 0, "option": 2, "time_ms": 4200 }
  { "event": "next" }                   # solo docente/admin
  { "event": "end" }                    # solo docente/admin

Protocolo de mensajes (servidor → cliente):
  { "event": "room_state",   "data": { players, status, room } }
  { "event": "player_joined","data": { nombre, total_players } }
  { "event": "game_start",   "data": { question: {...}, index: 0, total: N } }
  { "event": "answer_result","data": { correct, explanation, scores: [...] } }
  { "event": "question",     "data": { question: {...}, index: N, total: N } }
  { "event": "game_over",    "data": { leaderboard: [...] } }
  { "event": "error",        "data": { message } }
"""
import asyncio
import json
from dataclasses import dataclass, field
from typing import Optional
from fastapi import WebSocket

from api.database.connection import get_db, close_db
from api.services.achievements import evaluar_logros, otorgar_logro


@dataclass
class PlayerState:
    nombre: str
    usuario_id: Optional[int]
    es_docente: bool
    websocket: WebSocket
    puntaje: int = 0
    respuestas: list = field(default_factory=list)  # [{qidx, option, correct, pts}]


@dataclass
class RoomState:
    room_code: str
    actividad_id: int
    docente_id: int
    status: str = "waiting"          # waiting | playing | finished
    question_idx: int = 0
    questions: list = field(default_factory=list)
    mode: str = "quiz_race"
    results_revealed: bool = False
    players: dict = field(default_factory=dict)  # ws → PlayerState


def _load_questions(actividad_id: int) -> list:
    conn = get_db()
    try:
        unified = conn.execute("""
            SELECT qi.id, qi.orden, qi.tipo, qi.enunciado, qi.explicacion,
                   qi.puntaje, qi.tiempo_limite_segundos,
                   (SELECT qm.url FROM quiz_media_assets qm
                    WHERE qm.item_id = qi.id AND qm.tipo = 'image'
                    ORDER BY qm.id LIMIT 1) AS imagen_url
            FROM quiz_items qi
            JOIN quizzes q ON q.id = qi.quiz_id
            WHERE q.actividad_id = ? AND qi.tipo IN ('single_choice','multiple_choice','true_false')
            ORDER BY qi.orden
        """, (actividad_id,)).fetchall()
        if unified:
            questions = []
            for row in unified:
                options = conn.execute("""
                    SELECT texto, valor, es_correcta
                    FROM quiz_opciones WHERE item_id = ? ORDER BY orden
                """, (row["id"],)).fetchall()
                correct_options = [option["texto"] for option in options if option["es_correcta"]]
                correct = correct_options if row["tipo"] == "multiple_choice" else (correct_options[0] if correct_options else "")
                questions.append({
                    "id": row["id"], "orden": row["orden"], "tipo": row["tipo"],
                    "enunciado": row["enunciado"],
                    "opciones": [option["texto"] for option in options],
                    "respuesta_correcta": correct, "explicacion": row["explicacion"],
                    "puntaje": row["puntaje"],
                    "tiempo_segundos": row["tiempo_limite_segundos"] or 20,
                    "imagen_url": row["imagen_url"],
                })
            return questions

        cursor = conn.execute(
            """SELECT id, orden, tipo, enunciado, opciones, respuesta_correcta, explicacion, puntaje
               FROM preguntas WHERE actividad_id = ? ORDER BY orden""",
            (actividad_id,),
        )
        rows = cursor.fetchall()
        questions = []
        for r in rows:
            questions.append({
                "id": r["id"],
                "orden": r["orden"],
                "tipo": r["tipo"],
                "enunciado": r["enunciado"],
                "opciones": json.loads(r["opciones"]) if r["opciones"] else [],
                "respuesta_correcta": r["respuesta_correcta"],
                "explicacion": r["explicacion"],
                "puntaje": r["puntaje"],
            })
        return questions
    finally:
        close_db(conn)


def _get_room_from_db(room_code: str) -> Optional[dict]:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM rooms WHERE id = ?", (room_code,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def _get_user_from_token(token: str) -> Optional[dict]:
    from api.services.sessions import obtener_sesion_por_token
    from api.services.users import obtener_usuario_por_id
    sesion = obtener_sesion_por_token(token)
    if not sesion:
        return None
    return obtener_usuario_por_id(sesion["usuario_id"])


def _score_for_answer(question: dict, option: int | str, time_ms: int, mode: str = "quiz_race") -> tuple[bool, int]:
    """Retorna (correct, points). Bonus por velocidad: max 50 pts extra."""
    correct_answer = question["respuesta_correcta"]
    opciones = question.get("opciones", [])
    # Normalizar: la opción puede venir como índice (int) o texto (str)
    if isinstance(option, list):
        answer_text = [opciones[index] for index in option if isinstance(index, int) and 0 <= index < len(opciones)]
    elif isinstance(option, int) and 0 <= option < len(opciones):
        answer_text = opciones[option]
    else:
        answer_text = str(option)
    if isinstance(correct_answer, list):
        normalized_answer = {str(value).strip().lower() for value in (answer_text if isinstance(answer_text, list) else [answer_text])}
        normalized_correct = {str(value).strip().lower() for value in correct_answer}
        is_correct = normalized_answer == normalized_correct
    else:
        is_correct = str(answer_text).strip().lower() == str(correct_answer).strip().lower()
    if not is_correct:
        return False, 0
    limit_ms = max(5000, int(question.get("tiempo_segundos", 20)) * 1000)
    # Bonus: 0-50 pts dependiendo de qué tan rápido respondió (< 5000ms = max bonus)
    speed = max(0.0, 1 - min(max(time_ms, 0), limit_ms) / limit_ms)
    if mode == "classic":
        return True, 1000
    if mode == "speed":
        return True, 250 + int(1250 * speed)
    return True, 500 + int(500 * speed)


def _question_payload(questions: list, idx: int) -> dict:
    """Versión pública de la pregunta (sin respuesta_correcta)."""
    q = questions[idx]
    return {
        "id": q["id"],
        "enunciado": q["enunciado"],
        "opciones": q["opciones"],
        "tipo": q["tipo"],
        "puntaje": q["puntaje"],
        "tiempo_segundos": q.get("tiempo_segundos", 20),
        "imagen_url": q.get("imagen_url"),
        "index": idx,
        "total": len(questions),
    }


class RoomManager:
    def __init__(self):
        self._rooms: dict[str, RoomState] = {}

    async def connect(self, websocket: WebSocket, room_code: str):
        await websocket.accept()
        # Enviar estado inicial de espera (el cliente debe enviar "join" a continuación)
        await websocket.send_json({
            "event": "connected",
            "data": {"room_code": room_code, "message": "Envia tu token para unirte"},
        })

    async def disconnect(self, websocket: WebSocket, room_code: str):
        room = self._rooms.get(room_code)
        if room and websocket in room.players:
            player = room.players.pop(websocket)
            await self._broadcast(room, {
                "event": "player_left",
                "data": {"nombre": player.nombre, "total_players": sum(1 for p in room.players.values() if not p.es_docente)},
            }, exclude=None)

    async def handle_message(self, websocket: WebSocket, room_code: str, msg: dict):
        event = msg.get("event")

        if event == "join":
            await self._handle_join(websocket, room_code, msg)
        elif event == "start":
            await self._handle_start(websocket, room_code)
        elif event == "answer":
            await self._handle_answer(websocket, room_code, msg)
        elif event == "next":
            await self._handle_next(websocket, room_code)
        elif event == "end":
            await self._handle_end(websocket, room_code)
        else:
            await websocket.send_json({"event": "error", "data": {"message": f"Evento desconocido: {event}"}})

    # ── Handlers de eventos ────────────────────────────────────────────────────

    async def _handle_join(self, websocket: WebSocket, room_code: str, msg: dict):
        token = msg.get("token")
        if not token:
            await websocket.send_json({"event": "error", "data": {"message": "Token requerido"}})
            return

        usuario = _get_user_from_token(token)
        if not usuario:
            await websocket.send_json({"event": "error", "data": {"message": "Token invalido"}})
            return

        # Cargar o crear RoomState desde la DB
        if room_code not in self._rooms:
            room_db = _get_room_from_db(room_code)
            if not room_db:
                await websocket.send_json({"event": "error", "data": {"message": "Sala no encontrada"}})
                return
            if room_db["estado"] == "finalizada":
                await websocket.send_json({"event": "error", "data": {"message": "Esta sala ya finalizo"}})
                return
            questions = _load_questions(room_db["actividad_id"])
            self._rooms[room_code] = RoomState(
                room_code=room_code,
                actividad_id=room_db["actividad_id"],
                docente_id=room_db["docente_id"],
                questions=questions,
                mode=room_db.get("modo") or "quiz_race",
            )

        room = self._rooms[room_code]
        es_docente = usuario["rol"] == "administrador" or usuario["id"] == room.docente_id
        nombre = msg.get("nombre") or usuario["nombre_visible"]

        room.players[websocket] = PlayerState(
            nombre=nombre,
            usuario_id=usuario["id"],
            es_docente=es_docente,
            websocket=websocket,
        )

        # Enviar estado actual de la sala al que se unió
        await websocket.send_json({
            "event": "room_state",
            "data": {
                "room_code": room_code,
                "status": room.status,
                "es_docente": es_docente,
                "players": [{"nombre": p.nombre, "puntaje": p.puntaje}
                            for p in room.players.values() if not p.es_docente],
                "total_questions": len(room.questions),
                "mode": room.mode,
                **({"question": _question_payload(room.questions, room.question_idx), "index": room.question_idx}
                   if room.status == "playing" and room.questions else {}),
            },
        })

        # Notificar a todos que alguien se unió
        await self._broadcast(room, {
            "event": "player_joined",
            "data": {"nombre": nombre, "total_players": sum(1 for p in room.players.values() if not p.es_docente)},
        }, exclude=websocket)

    async def _handle_start(self, websocket: WebSocket, room_code: str):
        room = self._rooms.get(room_code)
        if not room:
            return
        player = room.players.get(websocket)
        if not player or not player.es_docente:
            await websocket.send_json({"event": "error", "data": {"message": "Solo el docente puede iniciar"}})
            return
        if room.status != "waiting":
            await websocket.send_json({"event": "error", "data": {"message": "El juego ya inicio"}})
            return
        if not room.questions:
            await websocket.send_json({"event": "error", "data": {"message": "La actividad no tiene preguntas"}})
            return

        room.status = "playing"
        room.question_idx = 0
        # Actualizar DB
        _update_room_status(room_code, "en_curso")

        await self._broadcast(room, {
            "event": "game_start",
            "data": {"question": _question_payload(room.questions, 0), "index": 0, "total": len(room.questions)},
        })

    async def _handle_answer(self, websocket: WebSocket, room_code: str, msg: dict):
        room = self._rooms.get(room_code)
        if not room or room.status != "playing":
            return
        player = room.players.get(websocket)
        if not player or player.es_docente:
            return

        q_idx = msg.get("question_idx", room.question_idx)
        # Ignorar respuestas para preguntas ya pasadas
        if q_idx != room.question_idx:
            return

        option = msg.get("option")
        time_ms = int(msg.get("time_ms", 5000))
        question = room.questions[room.question_idx]

        if any(answer["qidx"] == q_idx for answer in player.respuestas):
            await websocket.send_json({"event": "error", "data": {"message": "Ya respondiste esta pregunta"}})
            return

        is_correct, pts = _score_for_answer(question, option, time_ms, room.mode)
        if is_correct and time_ms < 2000 and player.usuario_id:
            otorgar_logro(player.usuario_id, "speed_demon")
        player.puntaje += pts
        player.respuestas.append({
            "qidx": q_idx,
            "option": option,
            "correct": is_correct,
            "pts": pts,
        })

        # Respuesta individual (privada)
        await websocket.send_json({
            "event": "answer_ack",
            "data": {
                "correct": is_correct,
                "pts_earned": pts,
                "total_score": player.puntaje,
                "correct_answer": question["respuesta_correcta"],
                "explicacion": question.get("explicacion"),
            },
        })

    async def _handle_next(self, websocket: WebSocket, room_code: str):
        room = self._rooms.get(room_code)
        if not room:
            return
        player = room.players.get(websocket)
        if not player or not player.es_docente:
            await websocket.send_json({"event": "error", "data": {"message": "Solo el docente puede avanzar"}})
            return

        if room.results_revealed:
            room.question_idx += 1
            room.results_revealed = False
            if room.question_idx >= len(room.questions):
                await self._handle_end(websocket, room_code)
                return
            await self._broadcast(room, {
                "event": "question",
                "data": {
                    "question": _question_payload(room.questions, room.question_idx),
                    "index": room.question_idx,
                    "total": len(room.questions),
                },
            })
            return

        # Primer toque: revela resultados y ranking. El siguiente avanza.
        leaderboard = _build_leaderboard(room)
        question = room.questions[room.question_idx]
        distribution = [0 for _ in question.get("opciones", [])]
        for participant in room.players.values():
            answer = next((item for item in participant.respuestas if item["qidx"] == room.question_idx), None)
            if answer:
                selected = answer.get("option") if isinstance(answer.get("option"), list) else [answer.get("option")]
                for option_index in selected:
                    if isinstance(option_index, int) and 0 <= option_index < len(distribution):
                        distribution[option_index] += 1
        await self._broadcast(room, {
            "event": "question_results",
            "data": {
                "correct_answer": question["respuesta_correcta"],
                "explicacion": question.get("explicacion"),
                "leaderboard": leaderboard,
                "distribution": distribution,
            },
        })
        room.results_revealed = True

    async def _handle_end(self, websocket: WebSocket, room_code: str):
        room = self._rooms.get(room_code)
        if not room:
            return
        room.status = "finished"
        _update_room_status(room_code, "finalizada")
        leaderboard = _build_leaderboard(room)
        _save_game_session(room, leaderboard)
        for entry in leaderboard:
            if entry.get("usuario_id"):
                evaluar_logros(entry["usuario_id"])
        await self._broadcast(room, {
            "event": "game_over",
            "data": {"leaderboard": leaderboard},
        })
        # Limpiar sala de memoria (la DB persiste los resultados)
        self._rooms.pop(room_code, None)

    async def _broadcast(self, room: RoomState, msg: dict, exclude: WebSocket = None):
        dead = []
        for ws in room.players:
            if ws is exclude:
                continue
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            room.players.pop(ws, None)


def _build_leaderboard(room: RoomState) -> list:
    players = [
        {"nombre": p.nombre, "puntaje": p.puntaje, "usuario_id": p.usuario_id}
        for p in room.players.values()
        if not p.es_docente
    ]
    return sorted(players, key=lambda x: x["puntaje"], reverse=True)


def _update_room_status(room_code: str, status: str):
    from api.utils.helpers import now_utc
    conn = get_db()
    try:
        campo = "iniciada_en" if status == "en_curso" else "finalizada_en" if status == "finalizada" else None
        if campo:
            conn.execute(f"UPDATE rooms SET estado = ?, {campo} = ? WHERE id = ?",
                         (status, now_utc(), room_code))
        else:
            conn.execute("UPDATE rooms SET estado = ? WHERE id = ?", (status, room_code))
        conn.commit()
    finally:
        close_db(conn)


def _save_game_session(room: RoomState, leaderboard: list):
    from api.utils.helpers import now_utc
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO game_sessions (room_id, actividad_id, resultados_json, fecha) VALUES (?, ?, ?, ?)",
            (room.room_code, room.actividad_id, json.dumps(leaderboard, ensure_ascii=False), now_utc()),
        )
        conn.commit()
    finally:
        close_db(conn)


# Instancia global
room_manager = RoomManager()
