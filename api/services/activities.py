import json
from datetime import datetime, timedelta, timezone

from api.config.settings import ATTEMPT_ABANDON_AFTER_MINUTES
from api.database.connection import get_db, close_db, list_to_dicts
from api.models import Actividad, Pregunta, Recurso
from api.utils.helpers import now_utc, calcular_intento, sql_like_term


def crear_actividad(actividad: Actividad) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO actividades (titulo, descripcion, instrucciones, area, categoria_id,
                                     tipo, dificultad, tiempo_limite_segundos, intentos_maximos,
                                     creado_por, activa)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                actividad.titulo,
                actividad.descripcion,
                actividad.instrucciones,
                actividad.area,
                actividad.categoria_id,
                actividad.tipo,
                actividad.dificultad,
                actividad.tiempo_limite_segundos,
                actividad.intentos_maximos,
                actividad.creado_por,
                actividad.activa,
            ),
        )
        conn.commit()
        return obtener_actividad_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def listar_actividades(area: str = None, dificultad: str = None, activas: bool = True, creado_por: int = None, q: str = None, viewer_id: int = None, is_admin: bool = False) -> list:
    conn = get_db()
    try:
        query = """
            SELECT a.*, c.nombre as categoria_nombre,
                   COUNT(DISTINCT p.id) + COUNT(DISTINCT qi.id) as preguntas_count,
                   COUNT(DISTINCT CASE WHEN qi.tipo IN ('single_choice','multiple_choice','true_false') THEN qi.id END) AS live_questions_count,
                   CASE WHEN q.id IS NULL THEN 0 ELSE 1 END as quiz_unificado,
                   q.version_actual as quiz_version,
                   q.estado as quiz_estado,
                   q.privado as quiz_privado,
                   q.configuracion as quiz_configuracion,
                   (SELECT qm.url FROM quiz_media_assets qm
                    WHERE qm.quiz_id = q.id AND qm.tipo = 'image'
                    ORDER BY CASE WHEN qm.item_id IS NULL THEN 0 ELSE 1 END, qm.id
                    LIMIT 1) as quiz_imagen
            FROM actividades a
            LEFT JOIN categorias c ON c.id = a.categoria_id
            LEFT JOIN preguntas p ON p.actividad_id = a.id
            LEFT JOIN quizzes q ON q.actividad_id = a.id
            LEFT JOIN quiz_items qi ON qi.quiz_id = q.id
        """
        condiciones = []
        params = []
        if activas:
            condiciones.append("a.activa = 1")
        if area:
            condiciones.append("a.area = ?")
            params.append(area)
        if dificultad:
            condiciones.append("a.dificultad = ?")
            params.append(dificultad)
        if creado_por is not None:
            condiciones.append("a.creado_por = ?")
            params.append(creado_por)
        if q:
            condiciones.append("(a.titulo LIKE ? ESCAPE '\\' OR a.descripcion LIKE ? ESCAPE '\\')")
            termino = sql_like_term(q)
            params.extend([termino, termino])
        if not is_admin:
            if viewer_id is not None:
                condiciones.append("(q.privado IS NULL OR q.privado = 0 OR q.creado_por = ?)")
                params.append(viewer_id)
            else:
                condiciones.append("(q.privado IS NULL OR q.privado = 0)")
        if condiciones:
            query += " WHERE " + " AND ".join(condiciones)
        query += " GROUP BY a.id"
        cursor = conn.execute(query + " ORDER BY a.area, a.dificultad, a.titulo", params)
        activities = list_to_dicts(cursor.fetchall())
        for activity in activities:
            try:
                config = json.loads(activity.pop("quiz_configuracion") or "{}")
            except (TypeError, json.JSONDecodeError):
                config = {}
            activity["quiz_config"] = config
            feed_card = config.get("feed_card") if isinstance(config, dict) else {}
            activity["imagen_portada"] = (
                (feed_card or {}).get("cover_url")
                or (feed_card or {}).get("imagen")
                or activity.pop("quiz_imagen", None)
            )
        return activities
    finally:
        close_db(conn)


def obtener_actividad_por_id(actividad_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT a.*, c.nombre as categoria_nombre
            FROM actividades a
            LEFT JOIN categorias c ON c.id = a.categoria_id
            WHERE a.id = ?
            """,
            (actividad_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def actualizar_actividad(actividad_id: int, datos: dict) -> dict:
    conn = get_db()
    try:
        campos = []
        valores = []
        for campo in ["titulo", "descripcion", "instrucciones", "area", "categoria_id", "tipo",
                      "dificultad", "tiempo_limite_segundos", "intentos_maximos", "creado_por", "activa"]:
            if campo in datos:
                campos.append(f"{campo} = ?")
                valores.append(datos[campo])
        if not campos:
            return obtener_actividad_por_id(actividad_id)
        campos.append("fecha_actualizacion = ?")
        valores.append(now_utc())
        valores.append(actividad_id)
        conn.execute(f"UPDATE actividades SET {', '.join(campos)} WHERE id = ?", valores)
        conn.commit()
        return obtener_actividad_por_id(actividad_id)
    finally:
        close_db(conn)


def eliminar_actividad(actividad_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute("UPDATE actividades SET activa = 0, fecha_actualizacion = ? WHERE id = ?", (now_utc(), actividad_id))
        conn.commit()
        return True
    finally:
        close_db(conn)


def crear_pregunta(pregunta: Pregunta) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            INSERT INTO preguntas (actividad_id, orden, tipo, enunciado, opciones, respuesta_correcta,
                                   explicacion, imagen_url, puntaje, obligatoria)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pregunta.actividad_id,
                pregunta.orden,
                pregunta.tipo,
                pregunta.enunciado,
                pregunta.opciones,
                pregunta.respuesta_correcta,
                pregunta.explicacion,
                pregunta.imagen_url,
                pregunta.puntaje,
                pregunta.obligatoria,
            ),
        )
        conn.commit()
        return obtener_pregunta_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def listar_preguntas_por_actividad(actividad_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            "SELECT * FROM preguntas WHERE actividad_id = ? ORDER BY orden",
            (actividad_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def obtener_pregunta_por_id(pregunta_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM preguntas WHERE id = ?", (pregunta_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def actualizar_pregunta(pregunta_id: int, datos: dict) -> dict:
    conn = get_db()
    try:
        campos = []
        valores = []
        for campo in ["actividad_id", "orden", "tipo", "enunciado", "opciones", "respuesta_correcta",
                      "explicacion", "imagen_url", "puntaje", "obligatoria"]:
            if campo in datos:
                campos.append(f"{campo} = ?")
                valores.append(datos[campo])
        if not campos:
            return obtener_pregunta_por_id(pregunta_id)
        valores.append(pregunta_id)
        conn.execute(f"UPDATE preguntas SET {', '.join(campos)} WHERE id = ?", valores)
        conn.commit()
        return obtener_pregunta_por_id(pregunta_id)
    finally:
        close_db(conn)


def eliminar_pregunta(pregunta_id: int) -> bool:
    conn = get_db()
    try:
        conn.execute("DELETE FROM preguntas WHERE id = ?", (pregunta_id,))
        conn.commit()
        return True
    finally:
        close_db(conn)


def contar_intentos(estudiante_id: int, actividad_id: int) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            "SELECT count(*) FROM intentos WHERE estudiante_id = ? AND actividad_id = ?",
            (estudiante_id, actividad_id),
        )
        return cursor.fetchone()[0]
    finally:
        close_db(conn)


def marcar_intentos_abandonados() -> int:
    """Cierra como 'abandonado' los intentos que siguen 'iniciado' pasado el umbral.

    Sin este barrido nadie escribe nunca 'abandonado' y el KPI de abandono queda en 0.
    """
    limite = (
        datetime.now(timezone.utc) - timedelta(minutes=ATTEMPT_ABANDON_AFTER_MINUTES)
    ).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            UPDATE intentos
               SET estado = 'abandonado', finalizado_en = ?
             WHERE estado = 'iniciado' AND iniciado_en < ?
            """,
            (now_utc(), limite),
        )
        conn.commit()
        return cursor.rowcount
    finally:
        close_db(conn)


def crear_intento(estudiante_id: int, actividad_id: int) -> dict:
    conn = get_db()
    try:
        numero_intento = contar_intentos(estudiante_id, actividad_id) + 1
        quiz_row = conn.execute(
            "SELECT version_actual FROM quizzes WHERE actividad_id = ?", (actividad_id,)
        ).fetchone()
        quiz_version = quiz_row[0] if quiz_row else None
        cursor = conn.execute(
            """
            INSERT INTO intentos
                (estudiante_id, actividad_id, numero_intento, estado, iniciado_en, quiz_version)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (estudiante_id, actividad_id, numero_intento, "iniciado", now_utc(), quiz_version),
        )
        conn.commit()
        return obtener_intento_por_id(cursor.lastrowid)
    finally:
        close_db(conn)


def obtener_intento_por_id(intento_id: int) -> dict:
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM intentos WHERE id = ?", (intento_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        close_db(conn)


def listar_intentos_estudiante(estudiante_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT i.*, a.titulo as actividad_titulo, a.area as actividad_area
            FROM intentos i
            JOIN actividades a ON a.id = i.actividad_id
            WHERE i.estudiante_id = ?
            ORDER BY i.fecha DESC
            """,
            (estudiante_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def listar_intentos_actividad(actividad_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT i.*, u.nombre_visible as estudiante_nombre
            FROM intentos i
            JOIN usuarios u ON u.id = i.estudiante_id
            WHERE i.actividad_id = ?
            ORDER BY i.fecha DESC
            """,
            (actividad_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def guardar_respuestas_intento(intento_id: int, respuestas: list) -> dict:
    conn = get_db()
    try:
        intento = obtener_intento_por_id(intento_id)
        if not intento:
            return None
        preguntas = listar_preguntas_por_actividad(intento["actividad_id"])
        resultado = calcular_intento(preguntas, respuestas)

        detalle_map = {d["pregunta_id"]: d for d in resultado["detalle"]}
        for item in respuestas:
            if item.get("respuesta") is None:
                continue
            d = detalle_map.get(item["pregunta_id"], {})
            correcta = 1 if d.get("correcta") else 0
            puntaje_obtenido = d.get("puntaje_obtenido", 0)
            conn.execute(
                """
                INSERT INTO respuestas_intento (intento_id, pregunta_id, respuesta, correcta, puntaje_obtenido)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(intento_id, pregunta_id) DO UPDATE SET
                    respuesta = excluded.respuesta,
                    correcta = excluded.correcta,
                    puntaje_obtenido = excluded.puntaje_obtenido
                """,
                (intento_id, item["pregunta_id"], item["respuesta"], correcta, puntaje_obtenido),
            )

        finalizado_en = now_utc()
        duracion = None
        if intento.get("iniciado_en"):
            try:
                from datetime import datetime
                inicio = datetime.fromisoformat(intento["iniciado_en"].replace("Z", "+00:00"))
                fin = datetime.fromisoformat(finalizado_en.replace("Z", "+00:00"))
                duracion = int((fin - inicio).total_seconds())
            except Exception:
                duracion = None
        conn.execute(
            """
            UPDATE intentos
            SET estado = ?, puntaje = ?, puntaje_maximo = ?, porcentaje = ?,
                respuestas_correctas = ?, finalizado_en = ?, duracion_segundos = ?
            WHERE id = ?
            """,
            ("completado", resultado["puntaje"], resultado["puntaje_maximo"], resultado["porcentaje"],
             resultado["respuestas_correctas"], finalizado_en, duracion, intento_id),
        )
        conn.commit()
        return {"intento": obtener_intento_por_id(intento_id), "detalle": resultado["detalle"]}
    finally:
        close_db(conn)


def listar_respuestas_intento(intento_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT r.*, p.enunciado, p.respuesta_correcta, p.explicacion
            FROM respuestas_intento r
            JOIN preguntas p ON p.id = r.pregunta_id
            WHERE r.intento_id = ?
            ORDER BY p.orden
            """,
            (intento_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def agregar_recurso_actividad(actividad_id: int, recurso_id: int, orden: int = 1) -> None:
    conn = get_db()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO actividad_recursos (actividad_id, recurso_id, orden) VALUES (?, ?, ?)",
            (actividad_id, recurso_id, orden),
        )
        conn.commit()
    finally:
        close_db(conn)


def listar_recursos_actividad(actividad_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT r.*, ar.orden
            FROM recursos r
            JOIN actividad_recursos ar ON ar.recurso_id = r.id
            WHERE ar.actividad_id = ?
            ORDER BY ar.orden
            """,
            (actividad_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def obtener_progreso_estudiante(estudiante_id: int) -> list:
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT a.id, a.titulo, a.area, a.dificultad,
                   count(i.id) as total_intentos,
                   max(i.porcentaje) as mejor_porcentaje,
                   max(i.puntaje) as mejor_puntaje
            FROM actividades a
            LEFT JOIN intentos i ON i.actividad_id = a.id AND i.estudiante_id = ? AND i.estado = 'completado'
            WHERE a.activa = 1
            GROUP BY a.id
            ORDER BY a.area, a.titulo
            """,
            (estudiante_id,),
        )
        return list_to_dicts(cursor.fetchall())
    finally:
        close_db(conn)


def buscar_actividades_por_area(area: str) -> list:
    return listar_actividades(area=area)
