"""
FastAPI app — reemplaza el servidor http.server anterior.
Todos los route handlers existentes (routes/*.py) se reutilizan sin cambios
gracias al shim RequestAdapter que adapta fastapi.Request a la interfaz
que los handlers esperan.
"""
import asyncio
import os
import sys
import re
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from api.routes import routes_registry
from api.database.connection import init_db
from api.services.sessions import limpiar_sesiones_expiradas
from api.utils.upload import serve_upload
from api.websocket.room_manager import room_manager


# ── Shim de compatibilidad ─────────────────────────────────────────────────────
class RequestAdapter:
    """Adapta fastapi.Request a la interfaz que los handlers existentes usan."""

    def __init__(self, request: Request, body_bytes: bytes = b""):
        self._request = request
        self._body_bytes = body_bytes

    @property
    def headers(self):
        return self._request.headers

    @property
    def client_address(self):
        host = self._request.client.host if self._request.client else "127.0.0.1"
        return (host, 0)


# ── App FastAPI ────────────────────────────────────────────────────────────────
app = FastAPI(title="Plataforma EdTech API", version="2.0.0")


@app.on_event("startup")
def apply_database_migrations():
    """Inicializa o amplía la BD existente sin borrar información."""
    init_db()


async def _limpiar_sesiones_periodicamente():
    """limpiar_sesiones_expiradas() existía pero nada la invocaba: las
    sesiones vencidas se acumulaban para siempre en la tabla `sesiones`."""
    while True:
        try:
            limpiar_sesiones_expiradas()
        except Exception:
            import traceback
            traceback.print_exc()
        await asyncio.sleep(3600)


@app.on_event("startup")
async def start_session_cleanup():
    asyncio.create_task(_limpiar_sesiones_periodicamente())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


def make_response(result, extra_headers: dict = None) -> JSONResponse:
    if result is None:
        data, status = {"message": "Operacion exitosa"}, 200
    elif isinstance(result, tuple):
        data, status = result[0], result[1]
    else:
        data, status = result, 200
    headers = {**SECURITY_HEADERS, **(extra_headers or {})}
    return JSONResponse(content=json.loads(json.dumps(data, default=str)), status_code=status, headers=headers)


async def dispatch(request: Request) -> Response:
    path = request.url.path
    method = request.method.upper()

    # Servir archivos subidos
    if path.startswith("/uploads/"):
        data, mime = serve_upload(path)
        if data is None:
            return JSONResponse({"error": "Archivo no encontrado"}, status_code=404)
        return Response(content=data, media_type=mime)

    # Leer body
    body_bytes = b""
    body = {}
    if method in ("POST", "PUT", "PATCH"):
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            body_bytes = await request.body()
            if body_bytes:
                try:
                    body = json.loads(body_bytes.decode("utf-8"))
                except json.JSONDecodeError:
                    return JSONResponse({"error": "Cuerpo de la peticion invalido"}, status_code=400)
        elif "multipart/form-data" in content_type:
            # Parsear multipart a la forma que esperan los handlers:
            #   archivo -> {"filename": ..., "mime_type": ..., "data": <bytes>}
            #   texto   -> string
            try:
                form = await request.form()
            except Exception:
                return JSONResponse({"error": "Multipart invalido"}, status_code=400)
            for key, value in form.multi_items():
                if hasattr(value, "read"):
                    data = await value.read()
                    body[key] = {
                        "filename": value.filename,
                        "mime_type": value.content_type,
                        "data": data,
                    }
                else:
                    body[key] = value

    # Query params (valores simples — primera ocurrencia)
    query = dict(request.query_params)

    handler_adapter = RequestAdapter(request, body_bytes)

    for pattern, methods, handler_fn in routes_registry:
        match = pattern.match(path)
        if match and method in methods:
            try:
                params = match.groupdict()
                result = handler_fn(handler_adapter, params, query, body)
                # Caso especial: un handler puede devolver un Response ya armado
                # (p.ej. el export CSV), que no debe pasar por el envoltorio JSON,
                # pero igual debe llevar los mismos headers de seguridad.
                if isinstance(result, Response):
                    for k, v in SECURITY_HEADERS.items():
                        result.headers.setdefault(k, v)
                    return result
                return make_response(result)
            except Exception:
                # El detalle queda en el log del servidor: devolverlo al cliente
                # expondría rutas de archivos y errores de SQLite.
                import traceback
                traceback.print_exc()
                return JSONResponse(
                    {"error": "Error interno del servidor"}, status_code=500
                )

    return JSONResponse({"error": "Ruta no encontrada"}, status_code=404)


# ── Rutas dinámicas — capturan todo /api/* ─────────────────────────────────────
@app.api_route("/api/{rest_of_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def api_router(request: Request, rest_of_path: str):
    if request.method == "OPTIONS":
        return Response(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        })
    return await dispatch(request)


@app.get("/uploads/{rest_of_path:path}")
async def uploads_router(request: Request, rest_of_path: str):
    return await dispatch(request)


# ── WebSocket — Salas de juego ─────────────────────────────────────────────────
@app.websocket("/ws/room/{room_code}")
async def websocket_room(websocket: WebSocket, room_code: str):
    """
    Protocolo de mensajes:
      → JOIN   { "event": "join", "token": "...", "nombre": "..." }
      → ANSWER { "event": "answer", "question_idx": 0, "option": 2, "time_ms": 4200 }
      → START  { "event": "start" }  (solo docente)
      → NEXT   { "event": "next" }   (solo docente)
      ← broadcast: { "event": "...", "data": {...} }
    """
    await room_manager.connect(websocket, room_code)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"event": "error", "data": {"message": "JSON invalido"}})
                continue
            await room_manager.handle_message(websocket, room_code, msg)
    except WebSocketDisconnect:
        await room_manager.disconnect(websocket, room_code)


# ── Healthcheck ────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.app:app", host="0.0.0.0", port=8000, reload=False, log_level="warning")
