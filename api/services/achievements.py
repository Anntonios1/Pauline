from api.config.settings import ALLOWED_AREAS
from api.database.connection import close_db, get_db, list_to_dicts
from api.services.notifications import crear_notificacion


def otorgar_logro(usuario_id: int, clave: str, conn=None) -> bool:
    """Otorga un logro puntual (p.ej. speed_demon) sin recalcular el resto. True si es nuevo."""
    propio = conn is None
    conn = conn or get_db()
    try:
        row = conn.execute("SELECT id FROM achievements WHERE clave = ?", (clave,)).fetchone()
        if not row:
            return False
        cursor = conn.execute(
            "INSERT OR IGNORE INTO user_achievements (usuario_id, achievement_id) VALUES (?, ?)",
            (usuario_id, row["id"]),
        )
        if propio:
            conn.commit()
        return cursor.rowcount > 0
    finally:
        if propio:
            close_db(conn)


def _calcular_condiciones(usuario_id: int, conn) -> dict:
    """Todas las condiciones evaluables desde datos persistidos (todo salvo speed_demon,
    que depende de un time_ms que solo existe en memoria durante la partida en vivo)."""
    progreso = list_to_dicts(
        conn.execute(
            """
            SELECT a.id, a.area, max(i.porcentaje) as mejor_porcentaje
            FROM actividades a
            JOIN intentos i ON i.actividad_id = a.id
                           AND i.estudiante_id = ? AND i.estado = 'completado'
            WHERE a.activa = 1
            GROUP BY a.id
            """,
            (usuario_id,),
        ).fetchall()
    )
    total_activas = conn.execute("SELECT count(*) FROM actividades WHERE activa = 1").fetchone()[0]
    areas_totales = dict(
        conn.execute("SELECT area, count(*) FROM actividades WHERE activa = 1 GROUP BY area").fetchall()
    )
    reintento = (
        conn.execute(
            """SELECT 1 FROM intentos WHERE estudiante_id = ?
               GROUP BY actividad_id HAVING count(*) >= 2 LIMIT 1""",
            (usuario_id,),
        ).fetchone()
        is not None
    )
    madrugador = (
        conn.execute(
            """SELECT 1 FROM intentos
               WHERE estudiante_id = ? AND estado = 'completado'
                 AND CAST(strftime('%H', finalizado_en) AS INTEGER) < 8
               LIMIT 1""",
            (usuario_id,),
        ).fetchone()
        is not None
    )

    completadas = len(progreso)
    areas_con_intento = {p["area"] for p in progreso}
    perfectas_por_area = {}
    for p in progreso:
        if p["mejor_porcentaje"] == 100:
            perfectas_por_area[p["area"]] = perfectas_por_area.get(p["area"], 0) + 1
    total_perfectas = sum(perfectas_por_area.values())

    area_completa = any(
        total > 0 and perfectas_por_area.get(area, 0) == total for area, total in areas_totales.items()
    )
    areas_con_contenido = [a for a in ALLOWED_AREAS if areas_totales.get(a, 0) > 0]
    all_areas = bool(areas_con_contenido) and all(
        perfectas_por_area.get(a, 0) >= 1 for a in areas_con_contenido
    )

    pub_aprobadas = conn.execute(
        "SELECT count(*) FROM publicaciones WHERE autor_id = ? AND estado = 'aprobada'", (usuario_id,)
    ).fetchone()[0]

    comentarios_en_ajenas = conn.execute(
        """SELECT count(DISTINCT c.publicacion_id) FROM comentarios c
           JOIN publicaciones p ON p.id = c.publicacion_id
           WHERE c.autor_id = ? AND c.estado = 'aprobado' AND p.autor_id != c.autor_id""",
        (usuario_id,),
    ).fetchone()[0]

    recursos_aprobados = conn.execute(
        "SELECT count(*) FROM recursos WHERE subido_por = ? AND estado_aprobacion = 'aprobado'",
        (usuario_id,),
    ).fetchone()[0]

    quiz_arena = (
        conn.execute(
            """SELECT 1 FROM game_sessions gs, json_each(gs.resultados_json) je
               WHERE gs.resultados_json IS NOT NULL
                 AND json_extract(je.value, '$.usuario_id') = ? LIMIT 1""",
            (usuario_id,),
        ).fetchone()
        is not None
    )
    top_3_room = (
        conn.execute(
            """SELECT 1 FROM game_sessions gs, json_each(gs.resultados_json) je
               WHERE gs.resultados_json IS NOT NULL
                 AND json_extract(je.value, '$.usuario_id') = ? AND je.key < 3 LIMIT 1""",
            (usuario_id,),
        ).fetchone()
        is not None
    )

    return {
        "first_attempt": completadas >= 1,
        "first_perfect": total_perfectas >= 1,
        "streak_3": completadas >= 3,
        "streak_5": completadas >= 5,
        "streak_7": completadas >= 7,
        "ten_activities": completadas >= 10,
        "veinte_actividades": completadas >= 20,
        "all_areas": all_areas,
        "area_completa": area_completa,
        "polimata_areas": len(areas_con_intento) >= 5,
        "ruta_completa": total_activas > 0 and total_perfectas == total_activas,
        "reintento": reintento,
        "madrugador": madrugador,
        "primera_publicacion": pub_aprobadas >= 1,
        "tres_publicaciones": pub_aprobadas >= 3,
        "comentarista": comentarios_en_ajenas >= 5,
        "investigador_recursos": recursos_aprobados >= 3,
        "quiz_arena": quiz_arena,
        "top_3_room": top_3_room,
    }


def evaluar_logros(usuario_id: int) -> list:
    """Recalcula todas las condiciones persistentes y otorga lo que falte. Devuelve las claves nuevas."""
    conn = get_db()
    try:
        condiciones = _calcular_condiciones(usuario_id, conn)
        nuevos = [
            clave for clave, cumple in condiciones.items() if cumple and otorgar_logro(usuario_id, clave, conn)
        ]
        conn.commit()
        for clave in nuevos:
            logro = conn.execute("SELECT nombre, icono FROM achievements WHERE clave = ?", (clave,)).fetchone()
            if logro:
                crear_notificacion(
                    usuario_id, "logro_desbloqueado",
                    f"{logro['icono']} ¡Nuevo logro: {logro['nombre']}!",
                    enlace="/perfil",
                )
        return nuevos
    finally:
        close_db(conn)


def obtener_logros_usuario(usuario_id: int) -> list:
    conn = get_db()
    try:
        rows = conn.execute(
            """
            SELECT a.id, a.clave, a.nombre, a.descripcion, a.icono, a.puntos_bonus, ua.obtenido_en
            FROM achievements a
            LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.usuario_id = ?
            ORDER BY a.id
            """,
            (usuario_id,),
        ).fetchall()
        logros = list_to_dicts(rows)
        for logro in logros:
            logro["obtenido"] = logro["obtenido_en"] is not None
        return logros
    finally:
        close_db(conn)
