"""Canal de avisos en vivo del feed: /ws/feed.

Es un canal APARTE del de las salas de juego (`room_manager.py`, /ws/room/{code}).
Aquel tiene estado por sala, turnos y puntajes; este no tiene estado ninguno: es
una lista de clientes conectados a los que se les avisa que algo cambio.

Diseño: **el socket avisa, no reparte contenido.**

Los mensajes llevan solo lo que ya es publico (un id, un conteo) y el cliente
reacciona pidiendo los datos por REST con su propio token. Eso evita tener que
autenticar este canal y, sobre todo, evita empujarle a alguien un borrador, algo
en moderacion o una publicacion privada: los permisos se siguen resolviendo en un
unico sitio, las rutas REST que ya los aplican. Si algun dia hiciera falta mandar
contenido por aqui, habria que autenticar la conexion primero.

Protocolo (servidor → cliente), sin mensajes en sentido contrario:
    { "event": "publicacion_aprobada", "data": {"id": 12, "slug": "..."} }
    { "event": "publicacion_actualizada", "data": {"id": 12} }
    { "event": "comentario_nuevo", "data": {"publicacion_id": 12} }
    { "event": "reaccion", "data": {"publicacion_id": 12, "reacciones": {...}} }
"""

import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class FeedManager:
    def __init__(self):
        self._clientes: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clientes.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._clientes.discard(websocket)

    @property
    def total_conectados(self) -> int:
        return len(self._clientes)

    def publicar(self, evento: str, datos: dict) -> None:
        """Emite un aviso desde codigo SINCRONO (los handlers REST lo son).

        Los handlers corren dentro del event loop, asi que basta con agendar la
        corrutina. Si no hay loop —los tests llaman a los handlers directamente,
        sin servidor— no se emite nada y no pasa nada: el aviso es un extra, y
        romper una peticion REST porque nadie estaba escuchando seria peor.
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        loop.create_task(self.broadcast(evento, datos))

    async def broadcast(self, evento: str, datos: dict) -> None:
        if not self._clientes:
            return
        mensaje = {"event": evento, "data": datos}
        # Se itera sobre una copia: un envio fallido modifica el conjunto.
        for cliente in list(self._clientes):
            try:
                await cliente.send_json(mensaje)
            except Exception:
                # El cliente se fue sin cerrar limpiamente; se descarta y ya.
                self._clientes.discard(cliente)


feed_manager = FeedManager()
