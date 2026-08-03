import re
from api.models import Auditoria
from api.services.comments_events import registrar_auditoria, listar_auditoria
from api.routes.auth import require_role, get_user_from_token


def create_audit_entry(handler, params, query, body):
    usuario = get_user_from_token(handler)
    if not usuario:
        return {"error": "Autenticacion requerida"}, 401
    if not body.get("accion"):
        return {"error": "Campo requerido: accion"}, 400
    auditoria = Auditoria(
        usuario_id=usuario["id"],
        accion=body["accion"],
        entidad=body.get("entidad"),
        entidad_id=body.get("entidad_id"),
        elemento_afectado=body.get("elemento_afectado"),
        datos_anteriores=body.get("datos_anteriores"),
        datos_nuevos=body.get("datos_nuevos"),
        ip=body.get("ip") or handler.client_address[0],
        user_agent=body.get("user_agent") or handler.headers.get("User-Agent"),
        solicitud_id=body.get("solicitud_id"),
        descripcion=body.get("descripcion"),
    )
    return registrar_auditoria(auditoria)


def list_audit_entries(handler, params, query, body):
    usuario, error = require_role(handler, ["administrador", "docente"])
    if error:
        return error
    entidad = query.get("entidad")
    usuario_id = query.get("usuario_id")
    if usuario_id:
        usuario_id = int(usuario_id)
    return listar_auditoria(entidad=entidad, usuario_id=usuario_id)


routes = [
    (re.compile(r"^/api/audit$"), ["POST"], create_audit_entry),
    (re.compile(r"^/api/audit$"), ["GET"], list_audit_entries),
]
