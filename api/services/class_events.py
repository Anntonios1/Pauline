from api.database.connection import close_db, get_db, list_to_dicts
from api.utils.helpers import now_utc


def listar_eventos_clase(*, creador_id=None, incluir_pasados=False):
    conn = get_db()
    try:
        conditions = ["e.activo = 1"]
        params = []
        if creador_id is not None:
            conditions.append("e.creado_por = ?")
            params.append(creador_id)
        if not incluir_pasados:
            conditions.append("COALESCE(e.fecha_fin, e.fecha_inicio) >= ?")
            params.append(now_utc())
        rows = conn.execute(f"""
            SELECT e.*, u.nombre_visible AS creador_nombre
            FROM eventos_clase e
            LEFT JOIN usuarios u ON u.id = e.creado_por
            WHERE {' AND '.join(conditions)}
            ORDER BY e.fecha_inicio ASC
        """, params).fetchall()
        return list_to_dicts(rows)
    finally:
        close_db(conn)


def obtener_evento_clase(evento_id):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM eventos_clase WHERE id = ?", (evento_id,)).fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def crear_evento_clase(datos, actor_id):
    conn = get_db()
    try:
        cursor = conn.execute("""
            INSERT INTO eventos_clase
                (titulo, descripcion, tipo, fecha_inicio, fecha_fin, lugar, color, etiqueta, actividad_id, creado_por)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datos["titulo"].strip(), datos.get("descripcion"), datos.get("tipo", "clase"),
            datos["fecha_inicio"], datos.get("fecha_fin") or None, datos.get("lugar"),
            datos.get("color", "teal"), (datos.get("etiqueta") or "").strip() or None,
            datos.get("actividad_id") or None, actor_id,
        ))
        conn.commit()
        return obtener_evento_clase(cursor.lastrowid)
    finally:
        close_db(conn)


def actualizar_evento_clase(evento_id, datos):
    allowed = {"titulo", "descripcion", "tipo", "fecha_inicio", "fecha_fin", "lugar", "color", "activo", "actividad_id", "etiqueta"}
    fields, values = [], []
    for field in allowed:
        if field in datos:
            fields.append(f"{field} = ?")
            values.append(datos[field])
    if not fields:
        return obtener_evento_clase(evento_id)
    fields.append("fecha_actualizacion = ?")
    values.extend([now_utc(), evento_id])
    conn = get_db()
    try:
        conn.execute(f"UPDATE eventos_clase SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        return obtener_evento_clase(evento_id)
    finally:
        close_db(conn)
