"""Motor de datos para investigación (proyecto de grado).

Todos los exports de este módulo identifican estudiantes por un pseudónimo
estable (tabla `pseudonimos_investigacion`), nunca por su nombre_visible ni
su código de acceso real — así el dataset puede cruzarse (mismo pseudónimo
= mismo estudiante en todas las tablas) sin exponer identidad directamente.
La única función que revela el mapeo pseudónimo -> identidad real es
listar_pseudonimos(), pensada para un endpoint aparte y más restringido que
el resto (ver routes/research.py).

Se excluye deliberadamente el texto libre (contenido de publicaciones y
comentarios): el propósito es analizar patrones de desempeño y
participación, no el contenido en sí, que además podría ser identificable
por estilo de escritura tratándose de menores.
"""

import secrets
import sqlite3

from api.database.connection import get_db, close_db, list_to_dicts


def _generar_codigo() -> str:
    return f"SUJ-{secrets.token_hex(4).upper()}"


def obtener_o_crear_pseudonimo(usuario_id: int, conn=None) -> str:
    propio = conn is None
    conn = conn or get_db()
    try:
        row = conn.execute(
            "SELECT codigo FROM pseudonimos_investigacion WHERE usuario_id = ?", (usuario_id,)
        ).fetchone()
        if row:
            return row["codigo"]
        for _ in range(5):
            codigo = _generar_codigo()
            try:
                conn.execute(
                    "INSERT INTO pseudonimos_investigacion (usuario_id, codigo) VALUES (?, ?)",
                    (usuario_id, codigo),
                )
                if propio:
                    conn.commit()
                return codigo
            except sqlite3.IntegrityError:
                continue
        raise RuntimeError("No se pudo generar un pseudonimo unico")
    finally:
        if propio:
            close_db(conn)


def _asegurar_pseudonimos_estudiantes(conn) -> dict:
    """Garantiza que todo estudiante (activo o no) tenga pseudónimo asignado
    y devuelve el mapeo {usuario_id: codigo} para usar en memoria al armar
    cada export, sin repetir una consulta por fila."""
    ids = [r[0] for r in conn.execute("SELECT id FROM usuarios WHERE rol = 'estudiante'").fetchall()]
    mapeo = {}
    for usuario_id in ids:
        mapeo[usuario_id] = obtener_o_crear_pseudonimo(usuario_id, conn=conn)
    conn.commit()
    return mapeo


def listar_pseudonimos() -> list:
    """Mapeo pseudónimo -> identidad real. Sensible: solo para el endpoint
    administrativo dedicado, nunca mezclado con los exports anonimizados."""
    conn = get_db()
    try:
        mapeo = _asegurar_pseudonimos_estudiantes(conn)
        rows = list_to_dicts(
            conn.execute(
                "SELECT id, codigo, nombre_visible, activo, fecha_creacion FROM usuarios WHERE rol = 'estudiante' ORDER BY nombre_visible"
            ).fetchall()
        )
        for r in rows:
            r["pseudonimo"] = mapeo[r["id"]]
        return rows
    finally:
        close_db(conn)


def exportar_intentos() -> list:
    conn = get_db()
    try:
        mapeo = _asegurar_pseudonimos_estudiantes(conn)
        rows = list_to_dicts(
            conn.execute(
                """
                SELECT
                    i.estudiante_id, i.actividad_id, a.titulo AS actividad_titulo,
                    a.area, a.dificultad, a.tipo AS actividad_tipo,
                    i.numero_intento, i.estado, i.puntaje, i.puntaje_maximo,
                    i.porcentaje, i.respuestas_correctas,
                    i.iniciado_en, i.finalizado_en, i.duracion_segundos
                FROM intentos i
                JOIN actividades a ON a.id = i.actividad_id
                JOIN usuarios u ON u.id = i.estudiante_id
                WHERE u.rol = 'estudiante'
                ORDER BY i.estudiante_id, i.iniciado_en
                """
            ).fetchall()
        )
        for r in rows:
            r["pseudonimo"] = mapeo[r.pop("estudiante_id")]
        return rows
    finally:
        close_db(conn)


def exportar_respuestas() -> list:
    """Une respuestas del motor legacy (respuestas_intento/preguntas) y del
    motor unificado (quiz_respuestas_intento/quiz_items) en una sola forma."""
    conn = get_db()
    try:
        mapeo = _asegurar_pseudonimos_estudiantes(conn)
        rows = list_to_dicts(
            conn.execute(
                """
                SELECT i.estudiante_id, i.actividad_id, ri.intento_id, 'legacy' AS motor,
                       ri.pregunta_id AS item_id, p.tipo AS item_tipo,
                       ri.respuesta, ri.correcta, ri.puntaje_obtenido,
                       NULL AS tiempo_ms, ri.fecha
                FROM respuestas_intento ri
                JOIN intentos i ON i.id = ri.intento_id
                JOIN preguntas p ON p.id = ri.pregunta_id
                JOIN usuarios u ON u.id = i.estudiante_id
                WHERE u.rol = 'estudiante'

                UNION ALL

                SELECT i.estudiante_id, i.actividad_id, qri.intento_id, 'unificado' AS motor,
                       qri.quiz_item_id AS item_id, qi.tipo AS item_tipo,
                       qri.respuesta, qri.correcta, qri.puntaje_obtenido,
                       qri.tiempo_ms, qri.fecha
                FROM quiz_respuestas_intento qri
                JOIN intentos i ON i.id = qri.intento_id
                JOIN quiz_items qi ON qi.id = qri.quiz_item_id
                JOIN usuarios u ON u.id = i.estudiante_id
                WHERE u.rol = 'estudiante'

                ORDER BY estudiante_id, intento_id, item_id
                """
            ).fetchall()
        )
        for r in rows:
            r["pseudonimo"] = mapeo[r.pop("estudiante_id")]
        return rows
    finally:
        close_db(conn)


def exportar_eventos() -> list:
    conn = get_db()
    try:
        mapeo = _asegurar_pseudonimos_estudiantes(conn)
        rows = list_to_dicts(
            conn.execute(
                """
                SELECT e.actor_id AS estudiante_id, e.verbo, e.objeto_tipo, e.objeto_id,
                       e.resultado, e.contexto, e.fecha
                FROM eventos_aprendizaje e
                JOIN usuarios u ON u.id = e.actor_id
                WHERE u.rol = 'estudiante'
                ORDER BY e.actor_id, e.fecha
                """
            ).fetchall()
        )
        for r in rows:
            r["pseudonimo"] = mapeo[r.pop("estudiante_id")]
        return rows
    finally:
        close_db(conn)


def exportar_participacion() -> list:
    """Publicaciones y comentarios creados por estudiantes, con su resultado
    de moderación. No incluye el texto (titulo/contenido): solo la señal
    estructural de participación."""
    conn = get_db()
    try:
        mapeo = _asegurar_pseudonimos_estudiantes(conn)
        rows = list_to_dicts(
            conn.execute(
                """
                SELECT p.autor_id AS estudiante_id, 'publicacion' AS tipo, p.id AS item_id,
                       NULL AS referencia_id, p.estado,
                       p.fecha_creacion, p.fecha_publicacion AS fecha_resultado
                FROM publicaciones p
                JOIN usuarios u ON u.id = p.autor_id
                WHERE u.rol = 'estudiante'

                UNION ALL

                SELECT c.autor_id AS estudiante_id, 'comentario' AS tipo, c.id AS item_id,
                       c.publicacion_id AS referencia_id, c.estado,
                       c.fecha AS fecha_creacion, c.fecha_moderacion AS fecha_resultado
                FROM comentarios c
                JOIN usuarios u ON u.id = c.autor_id
                WHERE u.rol = 'estudiante'

                ORDER BY estudiante_id, fecha_creacion
                """
            ).fetchall()
        )
        for r in rows:
            r["pseudonimo"] = mapeo[r.pop("estudiante_id")]
        return rows
    finally:
        close_db(conn)


def exportar_resumen() -> list:
    """Una fila por estudiante: agregados de desempeño, participación y
    engagement — el punto de partida para cruzar con otras variables."""
    conn = get_db()
    try:
        mapeo = _asegurar_pseudonimos_estudiantes(conn)
        base = list_to_dicts(
            conn.execute(
                """
                SELECT
                    u.id AS estudiante_id, u.fecha_creacion AS cuenta_creada, u.ultimo_acceso,
                    count(DISTINCT CASE WHEN i.estado = 'completado' THEN i.actividad_id END) as actividades_completadas,
                    count(i.id) as total_intentos,
                    round(avg(CASE WHEN i.estado = 'completado' THEN i.porcentaje END), 1) as promedio_porcentaje,
                    max(CASE WHEN i.estado = 'completado' THEN i.porcentaje END) as mejor_porcentaje,
                    coalesce(sum(i.duracion_segundos), 0) as tiempo_total_segundos
                FROM usuarios u
                LEFT JOIN intentos i ON i.estudiante_id = u.id
                WHERE u.rol = 'estudiante'
                GROUP BY u.id
                """
            ).fetchall()
        )
        for est in base:
            uid = est["estudiante_id"]
            areas = conn.execute(
                """
                SELECT a.area, round(avg(i.porcentaje), 1) as promedio
                FROM intentos i
                JOIN actividades a ON a.id = i.actividad_id
                WHERE i.estudiante_id = ? AND i.estado = 'completado'
                GROUP BY a.area
                ORDER BY promedio DESC
                """,
                (uid,),
            ).fetchall()
            est["mejor_area"] = areas[0]["area"] if areas else None
            est["peor_area"] = areas[-1]["area"] if areas else None
            est["publicaciones_creadas"] = conn.execute(
                "SELECT count(*) FROM publicaciones WHERE autor_id = ?", (uid,)
            ).fetchone()[0]
            est["publicaciones_aprobadas"] = conn.execute(
                "SELECT count(*) FROM publicaciones WHERE autor_id = ? AND estado = 'aprobada'", (uid,)
            ).fetchone()[0]
            est["comentarios_creados"] = conn.execute(
                "SELECT count(*) FROM comentarios WHERE autor_id = ?", (uid,)
            ).fetchone()[0]
            est["comentarios_aprobados"] = conn.execute(
                "SELECT count(*) FROM comentarios WHERE autor_id = ? AND estado = 'aprobado'", (uid,)
            ).fetchone()[0]
            est["eventos_total"] = conn.execute(
                "SELECT count(*) FROM eventos_aprendizaje WHERE actor_id = ?", (uid,)
            ).fetchone()[0]
            est["logros_desbloqueados"] = conn.execute(
                "SELECT count(*) FROM user_achievements WHERE usuario_id = ?", (uid,)
            ).fetchone()[0]
            est["pseudonimo"] = mapeo[est.pop("estudiante_id")]
        return base
    finally:
        close_db(conn)
