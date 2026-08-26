"""Mi Ruta: pasos curados de una ruta de aprendizaje, con desbloqueo
secuencial calculado en el servidor.

No se persiste ningún estado de progreso propio: el estado de cada paso
(LOCKED/AVAILABLE/IN_PROGRESS/COMPLETED) se calcula en memoria a partir de
`intentos` (actividades) y `eventos_aprendizaje` con verbo 'leyo'
(publicaciones), para no duplicar esa información en una tabla paralela.

Criterio de completitud de una actividad: cualquier intento con
`estado='completado'`, sin importar el puntaje (decisión de producto — el
100% queda reservado para logros/gamificación, no para el avance de la
ruta).
"""
from api.database.connection import get_db, close_db, list_to_dicts
from api.utils.helpers import now_utc


def _fetch_modulos(conn, solo_activas=True):
    query = "SELECT id, nombre, slug, area, orden FROM categorias"
    if solo_activas:
        query += " WHERE activa = 1"
    query += " ORDER BY orden, nombre"
    return list_to_dicts(conn.execute(query).fetchall())


def _fetch_pasos(conn, categoria_ids=None, solo_activos=True):
    query = """
        SELECT rp.id, rp.categoria_id, rp.orden, rp.tipo_paso, rp.publicacion_id,
               rp.actividad_id, rp.obligatorio, rp.activo,
               p.titulo AS publicacion_titulo, p.slug AS publicacion_slug,
               a.titulo AS actividad_titulo
        FROM ruta_pasos rp
        LEFT JOIN publicaciones p ON p.id = rp.publicacion_id
        LEFT JOIN actividades a ON a.id = rp.actividad_id
    """
    condiciones = []
    params = []
    if solo_activos:
        condiciones.append("rp.activo = 1")
    if categoria_ids is not None:
        if not categoria_ids:
            return []
        placeholders = ",".join("?" for _ in categoria_ids)
        condiciones.append(f"rp.categoria_id IN ({placeholders})")
        params.extend(categoria_ids)
    if condiciones:
        query += " WHERE " + " AND ".join(condiciones)
    query += " ORDER BY rp.categoria_id, rp.orden"
    filas = list_to_dicts(conn.execute(query, params).fetchall())
    for fila in filas:
        fila["titulo"] = fila.pop("publicacion_titulo") or fila.pop("actividad_titulo")
        fila["obligatorio"] = bool(fila["obligatorio"])
        fila["activo"] = bool(fila["activo"])
    return filas


def obtener_ruta_estudiante(estudiante_id: int) -> list:
    conn = get_db()
    try:
        modulos = _fetch_modulos(conn, solo_activas=True)
        categoria_ids = [m["id"] for m in modulos]
        pasos = _fetch_pasos(conn, categoria_ids=categoria_ids, solo_activos=True)
        if not pasos:
            return [{**m, "progreso": {"completados": 0, "total": 0}, "pasos": []} for m in modulos]

        # Secuencia global ordenada por (orden del módulo, orden del paso) —
        # _fetch_pasos ordena por categoria_id, que no necesariamente coincide
        # con categorias.orden.
        orden_modulo = {m["id"]: m["orden"] for m in modulos}
        pasos.sort(key=lambda p: (orden_modulo.get(p["categoria_id"], 0), p["orden"]))

        publicacion_ids = [p["publicacion_id"] for p in pasos if p["tipo_paso"] == "publicacion"]
        actividad_ids = [p["actividad_id"] for p in pasos if p["tipo_paso"] == "actividad"]

        leidas = set()
        if publicacion_ids:
            placeholders = ",".join("?" for _ in publicacion_ids)
            filas = conn.execute(
                f"""
                SELECT DISTINCT objeto_id FROM eventos_aprendizaje
                WHERE actor_id = ? AND objeto_tipo = 'publicacion' AND verbo = 'leyo'
                AND objeto_id IN ({placeholders})
                """,
                [estudiante_id, *publicacion_ids],
            ).fetchall()
            leidas = {row[0] for row in filas}

        estados_intento = {}
        if actividad_ids:
            placeholders = ",".join("?" for _ in actividad_ids)
            filas = conn.execute(
                f"""
                SELECT actividad_id, estado FROM intentos
                WHERE estudiante_id = ? AND actividad_id IN ({placeholders})
                """,
                [estudiante_id, *actividad_ids],
            ).fetchall()
            for actividad_id, estado in filas:
                actual = estados_intento.get(actividad_id)
                if estado == "completado" or actual == "completado":
                    estados_intento[actividad_id] = "completado"
                elif estado == "iniciado":
                    estados_intento[actividad_id] = "iniciado"

        def paso_completado(paso):
            if paso["tipo_paso"] == "publicacion":
                return paso["publicacion_id"] in leidas
            return estados_intento.get(paso["actividad_id"]) == "completado"

        def paso_en_progreso(paso):
            return paso["tipo_paso"] == "actividad" and estados_intento.get(paso["actividad_id"]) == "iniciado"

        # Punto de corte: posición (en la secuencia global) del primer paso
        # OBLIGATORIO no completado. Todo lo posterior a ese punto queda
        # LOCKED. Los pasos opcionales no participan en el cálculo del corte
        # (no bloquean el avance), pero sí quedan LOCKED si están más allá
        # del corte, y AVAILABLE si están antes (aunque no completados).
        posicion_corte = len(pasos)
        for idx, paso in enumerate(pasos):
            if paso["obligatorio"] and not paso_completado(paso):
                posicion_corte = idx
                break

        for idx, paso in enumerate(pasos):
            if paso_completado(paso):
                paso["estado"] = "COMPLETED"
            elif idx <= posicion_corte:
                paso["estado"] = "IN_PROGRESS" if paso_en_progreso(paso) else "AVAILABLE"
            else:
                paso["estado"] = "LOCKED"

        por_categoria = {}
        for paso in pasos:
            por_categoria.setdefault(paso["categoria_id"], []).append(paso)

        resultado = []
        for modulo in modulos:
            pasos_modulo = por_categoria.get(modulo["id"], [])
            completados = sum(1 for p in pasos_modulo if p["estado"] == "COMPLETED")
            resultado.append({
                **modulo,
                "progreso": {"completados": completados, "total": len(pasos_modulo)},
                "pasos": pasos_modulo,
            })
        return resultado
    finally:
        close_db(conn)


def listar_pasos_ruta(categoria_id: int = None) -> list:
    """Para el panel docente: sin cálculo de progreso, incluye pasos inactivos."""
    conn = get_db()
    try:
        categoria_ids = [categoria_id] if categoria_id is not None else None
        return _fetch_pasos(conn, categoria_ids=categoria_ids, solo_activos=False)
    finally:
        close_db(conn)


class RutaPasoValidationError(Exception):
    pass


def _validar_contenido(conn, tipo_paso, publicacion_id, actividad_id, categoria_id):
    if tipo_paso == "publicacion":
        if not publicacion_id or actividad_id:
            raise RutaPasoValidationError("Un paso de tipo publicacion requiere publicacion_id y no actividad_id")
        row = conn.execute("SELECT categoria_id FROM publicaciones WHERE id = ?", (publicacion_id,)).fetchone()
        if not row:
            raise RutaPasoValidationError("publicacion_id no existe")
    elif tipo_paso == "actividad":
        if not actividad_id or publicacion_id:
            raise RutaPasoValidationError("Un paso de tipo actividad requiere actividad_id y no publicacion_id")
        row = conn.execute("SELECT categoria_id FROM actividades WHERE id = ?", (actividad_id,)).fetchone()
        if not row:
            raise RutaPasoValidationError("actividad_id no existe")
    else:
        raise RutaPasoValidationError("tipo_paso debe ser 'publicacion' o 'actividad'")


def crear_paso_ruta(datos: dict, actor_id: int) -> dict:
    conn = get_db()
    try:
        categoria_id = datos.get("categoria_id")
        tipo_paso = datos.get("tipo_paso")
        publicacion_id = datos.get("publicacion_id")
        actividad_id = datos.get("actividad_id")
        if not categoria_id:
            raise RutaPasoValidationError("categoria_id es requerido")
        if not conn.execute("SELECT 1 FROM categorias WHERE id = ?", (categoria_id,)).fetchone():
            raise RutaPasoValidationError("categoria_id no existe")
        _validar_contenido(conn, tipo_paso, publicacion_id, actividad_id, categoria_id)
        orden = datos.get("orden")
        if orden is None:
            row = conn.execute(
                "SELECT COALESCE(MAX(orden), 0) + 1 FROM ruta_pasos WHERE categoria_id = ?",
                (categoria_id,),
            ).fetchone()
            orden = row[0]
        cursor = conn.execute(
            """
            INSERT INTO ruta_pasos (categoria_id, orden, tipo_paso, publicacion_id, actividad_id,
                                     obligatorio, activo, creado_por)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                categoria_id, orden, tipo_paso, publicacion_id, actividad_id,
                1 if datos.get("obligatorio", True) else 0,
                1 if datos.get("activo", True) else 0,
                actor_id,
            ),
        )
        conn.commit()
        return _obtener_paso_por_id(conn, cursor.lastrowid)
    finally:
        close_db(conn)


def _obtener_paso_por_id(conn, paso_id):
    row = conn.execute("SELECT * FROM ruta_pasos WHERE id = ?", (paso_id,)).fetchone()
    return dict(row) if row else None


def obtener_paso_por_id(paso_id: int) -> dict:
    conn = get_db()
    try:
        return _obtener_paso_por_id(conn, paso_id)
    finally:
        close_db(conn)


def actualizar_paso_ruta(paso_id: int, datos: dict) -> dict:
    conn = get_db()
    try:
        campos = []
        valores = []
        for campo in ["orden", "obligatorio", "activo"]:
            if campo in datos:
                valor = datos[campo]
                if campo in ("obligatorio", "activo"):
                    valor = 1 if valor else 0
                campos.append(f"{campo} = ?")
                valores.append(valor)
        if not campos:
            return _obtener_paso_por_id(conn, paso_id)
        campos.append("fecha_actualizacion = ?")
        valores.append(now_utc())
        valores.append(paso_id)
        conn.execute(f"UPDATE ruta_pasos SET {', '.join(campos)} WHERE id = ?", valores)
        conn.commit()
        return _obtener_paso_por_id(conn, paso_id)
    finally:
        close_db(conn)


def eliminar_paso_ruta(paso_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute("DELETE FROM ruta_pasos WHERE id = ?", (paso_id,))
        conn.commit()
        return True
    finally:
        close_db(conn)


def reordenar_pasos(categoria_id: int, ordered_ids: list) -> list:
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        # Offset temporal para no chocar con la UNIQUE(categoria_id, orden)
        # mientras se reescribe el orden completo del módulo.
        filas = conn.execute(
            "SELECT id FROM ruta_pasos WHERE categoria_id = ?", (categoria_id,)
        ).fetchall()
        ids_existentes = {row[0] for row in filas}
        if set(ordered_ids) != ids_existentes:
            raise RutaPasoValidationError("ordered_ids debe incluir exactamente los pasos del módulo")
        offset = len(ordered_ids) + 1
        for idx, paso_id in enumerate(ordered_ids, start=1):
            conn.execute(
                "UPDATE ruta_pasos SET orden = ? WHERE id = ?", (offset + idx, paso_id)
            )
        for idx, paso_id in enumerate(ordered_ids, start=1):
            conn.execute(
                "UPDATE ruta_pasos SET orden = ?, fecha_actualizacion = ? WHERE id = ?",
                (idx, now_utc(), paso_id),
            )
        conn.commit()
        return _fetch_pasos(conn, categoria_ids=[categoria_id], solo_activos=False)
    finally:
        close_db(conn)
