from api.database.connection import get_db, close_db, list_to_dicts
from api.services.activities import marcar_intentos_abandonados


def get_estadisticas_generales() -> dict:
    conn = get_db()
    try:
        stats = {}
        for tabla in ["usuarios", "cursos", "categorias", "publicaciones", "actividades", "preguntas", "intentos", "recursos", "comentarios"]:
            cursor = conn.execute(f"SELECT count(*) FROM {tabla}")
            stats[tabla] = cursor.fetchone()[0]
        return stats
    finally:
        close_db(conn)


def get_resumen_estudiantes() -> dict:
    """Resumen general de metricas de estudiantes para el panel admin."""
    marcar_intentos_abandonados()
    conn = get_db()
    try:
        total = conn.execute(
            "SELECT count(*) FROM usuarios WHERE rol = 'estudiante' AND activo = 1"
        ).fetchone()[0]

        activos_7d = conn.execute(
            """SELECT count(*) FROM usuarios
               WHERE rol = 'estudiante' AND activo = 1
               AND ultimo_acceso >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')"""
        ).fetchone()[0]

        nuevos_30d = conn.execute(
            """SELECT count(*) FROM usuarios
               WHERE rol = 'estudiante' AND activo = 1
               AND fecha_creacion >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')"""
        ).fetchone()[0]

        row = conn.execute(
            """SELECT count(*) as total_intentos,
                      round(avg(CASE WHEN estado = 'completado' THEN porcentaje END), 1) as promedio_general,
                      sum(CASE WHEN estado = 'completado' THEN 1 ELSE 0 END) as completados,
                      sum(CASE WHEN estado = 'abandonado' THEN 1 ELSE 0 END) as abandonados
               FROM intentos"""
        ).fetchone()

        publicaciones_pendientes = conn.execute(
            "SELECT count(*) FROM publicaciones WHERE estado IN ('enviada', 'en_revision')"
        ).fetchone()[0]

        return {
            "total_estudiantes": total,
            "activos_7d": activos_7d,
            "nuevos_30d": nuevos_30d,
            "total_intentos": row[0] or 0,
            "promedio_general": row[1] or 0,
            "intentos_completados": row[2] or 0,
            "intentos_abandonados": row[3] or 0,
            "publicaciones_pendientes": publicaciones_pendientes,
        }
    finally:
        close_db(conn)


def get_detalle_estudiantes() -> list:
    """Detalle por estudiante: rendimiento, actividad y ultimo acceso."""
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT
                u.id,
                u.nombre_visible,
                u.codigo,
                u.ultimo_acceso,
                u.fecha_creacion,
                count(DISTINCT CASE WHEN i.estado = 'completado' THEN i.actividad_id END) as actividades_completadas,
                count(i.id) as total_intentos,
                round(avg(CASE WHEN i.estado = 'completado' THEN i.porcentaje END), 1) as promedio_porcentaje,
                max(CASE WHEN i.estado = 'completado' THEN i.porcentaje END) as mejor_porcentaje,
                coalesce(sum(i.duracion_segundos), 0) as tiempo_total_segundos,
                (SELECT count(*) FROM comentarios c WHERE c.autor_id = u.id) as comentarios_count
            FROM usuarios u
            LEFT JOIN intentos i ON i.estudiante_id = u.id
            WHERE u.rol = 'estudiante' AND u.activo = 1
            GROUP BY u.id
            ORDER BY promedio_porcentaje DESC, u.nombre_visible
            """
        )
        estudiantes = list_to_dicts(cursor.fetchall())

        # Calcular mejor y peor area por estudiante
        for est in estudiantes:
            areas = conn.execute(
                """
                SELECT a.area, round(avg(i.porcentaje), 1) as promedio
                FROM intentos i
                JOIN actividades a ON a.id = i.actividad_id
                WHERE i.estudiante_id = ? AND i.estado = 'completado'
                GROUP BY a.area
                ORDER BY promedio DESC
                """,
                (est["id"],),
            ).fetchall()
            if areas:
                est["mejor_area"] = areas[0]["area"]
                est["peor_area"] = areas[-1]["area"]
            else:
                est["mejor_area"] = None
                est["peor_area"] = None

        return estudiantes
    finally:
        close_db(conn)


def get_rendimiento_por_area() -> list:
    """Promedio de rendimiento por area de conocimiento."""
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT
                a.area,
                round(avg(CASE WHEN i.estado = 'completado' THEN i.porcentaje END), 1) as promedio,
                count(i.id) as total_intentos,
                count(DISTINCT i.estudiante_id) as estudiantes_unicos,
                sum(CASE WHEN i.estado = 'completado' THEN 1 ELSE 0 END) as completados
            FROM actividades a
            JOIN intentos i ON i.actividad_id = a.id
            WHERE a.activa = 1
            GROUP BY a.area
            ORDER BY promedio DESC
            """
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def get_actividad_diaria(dias: int = 30) -> list:
    """Intentos y estudiantes activos por dia (ultimos N dias)."""
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT
                date(fecha) as fecha,
                count(*) as total_intentos,
                count(DISTINCT estudiante_id) as estudiantes_activos
            FROM intentos
            WHERE fecha >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)
            GROUP BY date(fecha)
            ORDER BY fecha
            """,
            (f"-{dias} days",),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def get_top_estudiantes(limit: int = 5) -> list:
    """Mejores estudiantes por promedio (minimo 2 intentos completados)."""
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT
                u.id,
                u.nombre_visible,
                count(CASE WHEN i.estado = 'completado' THEN 1 END) as intentos_completados,
                round(avg(CASE WHEN i.estado = 'completado' THEN i.porcentaje END), 1) as promedio
            FROM usuarios u
            JOIN intentos i ON i.estudiante_id = u.id
            WHERE u.rol = 'estudiante' AND u.activo = 1
            GROUP BY u.id
            HAVING intentos_completados >= 2
            ORDER BY promedio DESC
            LIMIT ?
            """,
            (limit,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def get_estudiantes_en_riesgo() -> list:
    """Estudiantes con bajo rendimiento o inactivos."""
    conn = get_db()
    try:
        # Bajo rendimiento: promedio < 50% con al menos 2 intentos
        bajo_rendimiento = conn.execute(
            """
            SELECT
                u.id,
                u.nombre_visible,
                u.ultimo_acceso,
                round(avg(CASE WHEN i.estado = 'completado' THEN i.porcentaje END), 1) as promedio,
                count(CASE WHEN i.estado = 'completado' THEN 1 END) as intentos_completados,
                'bajo_rendimiento' as motivo
            FROM usuarios u
            JOIN intentos i ON i.estudiante_id = u.id
            WHERE u.rol = 'estudiante' AND u.activo = 1
            GROUP BY u.id
            HAVING intentos_completados >= 2 AND promedio < 50
            """
        ).fetchall()

        # Inactivos: sin acceso en 14+ dias (o nunca)
        inactivos = conn.execute(
            """
            SELECT
                u.id,
                u.nombre_visible,
                u.ultimo_acceso,
                NULL as promedio,
                0 as intentos_completados,
                'inactivo' as motivo
            FROM usuarios u
            WHERE u.rol = 'estudiante' AND u.activo = 1
            AND (u.ultimo_acceso IS NULL
                 OR u.ultimo_acceso < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-14 days'))
            AND u.id NOT IN (
                SELECT estudiante_id FROM intentos
                WHERE estado = 'completado'
                GROUP BY estudiante_id
                HAVING count(*) >= 2 AND avg(porcentaje) < 50
            )
            """
        ).fetchall()

        resultados = [dict(r) for r in bajo_rendimiento] + [dict(r) for r in inactivos]
        return resultados
    finally:
        close_db(conn)


def get_estadisticas_actividades() -> list:
    """Estadisticas por actividad: intentos, promedio, abandonos, duracion."""
    marcar_intentos_abandonados()
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT
                a.id,
                a.titulo,
                a.area,
                a.dificultad,
                count(i.id) as total_intentos,
                round(avg(CASE WHEN i.estado = 'completado' THEN i.porcentaje END), 1) as promedio_porcentaje,
                count(DISTINCT i.estudiante_id) as estudiantes_unicos,
                sum(CASE WHEN i.estado = 'abandonado' THEN 1 ELSE 0 END) as abandonados,
                round(avg(CASE WHEN i.estado = 'completado' THEN i.duracion_segundos END)) as duracion_promedio_seg
            FROM actividades a
            LEFT JOIN intentos i ON i.actividad_id = a.id
            WHERE a.activa = 1
            GROUP BY a.id
            ORDER BY total_intentos DESC
            """
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def get_resumen_completo() -> dict:
    """Endpoint combinado: resumen + areas + top + riesgo + timeline."""
    return {
        "resumen": get_resumen_estudiantes(),
        "generales": get_estadisticas_generales(),
        "rendimiento_por_area": get_rendimiento_por_area(),
        "top_estudiantes": get_top_estudiantes(),
        "estudiantes_en_riesgo": get_estudiantes_en_riesgo(),
        "actividad_diaria": get_actividad_diaria(14),
    }
