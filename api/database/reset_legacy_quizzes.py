"""Respalda y sustituye los quizzes legacy por contenido del motor unificado.

Uso:
    python -m api.database.reset_legacy_quizzes

Solo elimina actividades que no tienen fila en ``quizzes``. Conserva usuarios,
cursos, publicaciones, recursos y archivos subidos. Antes de cambiar datos crea
una copia recuperable de blog.db dentro de backups/.
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime

from api.config.settings import DB_PATH
from api.database.connection import close_db, get_db
from api.services.quizzes import crear_quiz


DOCENTE_ID = 1


def _category_ids(conn: sqlite3.Connection) -> dict[str, int]:
    return {
        row["area"]: row["id"]
        for row in conn.execute("SELECT id, area FROM categorias WHERE activa = 1")
    }


def _option(text: str, correct: bool = False, *, media=None) -> dict:
    option = {"text": text, "value": text, "correct": correct}
    if media:
        option["media"] = media
    return option


def _seed_quizzes(category_ids: dict[str, int]) -> list[dict]:
    cover_by_area = {
        "cuerpo_humano": "/activity-covers/cuerpo.svg",
        "pubertad": "/activity-covers/pubertad.svg",
        "celulas_reproductoras": "/activity-covers/celulas.svg",
        "fecundacion": "/activity-covers/embarazo.svg",
        "autocuidado": "/activity-covers/autocuidado.svg",
    }
    def quiz(title, area, description, items, *, difficulty="basica", attempts=3, icon="🧩", gradient="from-teal-500 to-cyan-600"):
        return {
            "titulo": title,
            "descripcion": description,
            "instrucciones": "Lee cada bloque con calma y responde usando lo que aprendiste.",
            "area": area,
            "categoria_id": category_ids.get(area),
            "dificultad": difficulty,
            "intentos_maximos": attempts,
            "estado": "publicado",
            "config": {
                "barajar_preguntas": False,
                "barajar_opciones": True,
                "mostrar_feedback": True,
                "mostrar_progreso": True,
                "tiempo_global_segundos": 0,
                "aprobado_porcentaje": 60,
                "feed_card": {"icon": icon, "gradient": gradient, "subtitle": "Quiz interactivo creado por tu docente", "cover_url": cover_by_area.get(area)},
            },
            "items": items,
        }

    return [
        quiz(
            "Explora tu cuerpo",
            "cuerpo_humano",
            "Reconoce órganos, sistemas y formas de cuidar tu cuerpo.",
            [
                {"tipo": "info", "enunciado": "Antes de empezar", "contenido": "Tu cuerpo tiene muchos sistemas que trabajan juntos. Conocerlos te ayuda a cuidarte.", "puntaje": 0},
                {"tipo": "single_choice", "enunciado": "¿Qué órgano bombea la sangre por el cuerpo?", "opciones": [_option("Corazón", True), _option("Pulmón"), _option("Estómago")], "explicacion": "El corazón impulsa la sangre hacia todo el cuerpo.", "puntaje": 1},
                {"tipo": "flashcard", "enunciado": "Sistema respiratorio", "respuesta_correcta": "Está formado por órganos como los pulmones y permite obtener oxígeno.", "puntaje": 0},
                {"tipo": "true_false", "enunciado": "Los pulmones participan en la respiración.", "respuesta_correcta": "true", "explicacion": "Los pulmones intercambian oxígeno y dióxido de carbono.", "puntaje": 1},
            ],
            icon="🫁", gradient="from-sky-500 to-cyan-600",
        ),
        quiz(
            "Cambios de la pubertad",
            "pubertad",
            "Comprende la pubertad como una etapa natural de cambios físicos y emocionales.",
            [
                {"tipo": "info", "enunciado": "Una etapa natural", "contenido": "Cada persona vive la pubertad a su propio ritmo. Tener dudas es normal.", "puntaje": 0},
                {"tipo": "multiple_choice", "enunciado": "¿Cuáles son formas sanas de resolver dudas sobre la pubertad?", "opciones": [_option("Hablar con un adulto de confianza", True), _option("Consultar una fuente educativa confiable", True), _option("Creer cualquier publicación de internet")], "explicacion": "Las dudas se resuelven con adultos de confianza y fuentes seguras.", "puntaje": 2},
                {"tipo": "true_false", "enunciado": "Todas las personas cambian exactamente al mismo tiempo durante la pubertad.", "respuesta_correcta": "false", "explicacion": "Los cambios aparecen en distintos momentos y ritmos.", "puntaje": 1},
            ],
            icon="🌱", gradient="from-violet-500 to-fuchsia-600",
        ),
        quiz(
            "Células reproductoras",
            "celulas_reproductoras",
            "Diferencia las células reproductoras y su función básica.",
            [
                {"tipo": "flashcard", "enunciado": "Óvulo", "respuesta_correcta": "Es la célula reproductora femenina.", "puntaje": 0},
                {"tipo": "single_choice", "enunciado": "¿Cómo se llama la célula reproductora masculina?", "opciones": [_option("Espermatozoide", True), _option("Neurona"), _option("Glóbulo rojo")], "explicacion": "El espermatozoide es la célula reproductora masculina.", "puntaje": 1},
                {"tipo": "short_text", "enunciado": "Escribe el nombre de la célula reproductora femenina.", "respuesta_correcta": ["óvulo", "ovulo"], "explicacion": "La respuesta correcta es óvulo.", "puntaje": 1},
            ],
            difficulty="media", icon="🔬", gradient="from-emerald-500 to-teal-600",
        ),
        quiz(
            "Fecundación y embarazo",
            "fecundacion",
            "Relaciona conceptos básicos de la fecundación y el desarrollo durante el embarazo.",
            [
                {"tipo": "info", "enunciado": "Secuencia de desarrollo", "contenido": "La fecundación ocurre cuando se unen un óvulo y un espermatozoide. Después, el desarrollo continúa en el útero.", "puntaje": 0},
                {"tipo": "single_choice", "enunciado": "¿En qué órgano se desarrolla el bebé durante el embarazo?", "opciones": [_option("Útero", True), _option("Pulmón"), _option("Riñón")], "explicacion": "El útero protege y permite el desarrollo durante el embarazo.", "puntaje": 1},
                {"tipo": "true_false", "enunciado": "Un embarazo dura aproximadamente nueve meses.", "respuesta_correcta": "true", "explicacion": "De forma aproximada, dura nueve meses.", "puntaje": 1},
            ],
            difficulty="media", attempts=2, icon="🧡", gradient="from-orange-500 to-rose-500",
        ),
        quiz(
            "Autocuidado y límites personales",
            "autocuidado",
            "Practica decisiones de autocuidado, respeto y búsqueda de ayuda.",
            [
                {"tipo": "info", "enunciado": "Tu bienestar importa", "contenido": "Puedes poner límites, pedir ayuda y hablar con un adulto de confianza cuando algo te incomoda.", "puntaje": 0},
                {"tipo": "multiple_choice", "enunciado": "¿Qué acciones ayudan a cuidar tu bienestar?", "opciones": [_option("Decir no cuando algo me incomoda", True), _option("Pedir ayuda a un adulto de confianza", True), _option("Guardar silencio por miedo")], "explicacion": "Poner límites y pedir ayuda son decisiones seguras y valiosas.", "puntaje": 2},
                {"tipo": "short_text", "enunciado": "Escribe una palabra clave para recordar a quién pedir ayuda.", "respuesta_correcta": ["docente", "familia", "adulto", "adulto de confianza"], "explicacion": "Puedes hablar con un docente, familiar u otro adulto de confianza.", "puntaje": 1},
            ],
            icon="💚", gradient="from-green-500 to-emerald-600",
        ),
    ]


def backup_database() -> str:
    backup_dir = os.path.join(os.path.dirname(DB_PATH), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"blog_before_unified_quiz_reset_{stamp}.db")
    source = sqlite3.connect(DB_PATH)
    target = sqlite3.connect(backup_path)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()
    return backup_path


def reset_legacy_quizzes() -> dict:
    backup_path = backup_database()
    conn = get_db()
    try:
        legacy_ids = [row["id"] for row in conn.execute("""
            SELECT a.id
            FROM actividades a
            LEFT JOIN quizzes q ON q.actividad_id = a.id
            WHERE q.id IS NULL
        """).fetchall()]
        if legacy_ids:
            placeholders = ",".join("?" for _ in legacy_ids)
            conn.execute("BEGIN IMMEDIATE")
            conn.execute(f"DELETE FROM respuestas_intento WHERE intento_id IN (SELECT id FROM intentos WHERE actividad_id IN ({placeholders}))", legacy_ids)
            conn.execute(f"DELETE FROM quiz_respuestas_intento WHERE intento_id IN (SELECT id FROM intentos WHERE actividad_id IN ({placeholders}))", legacy_ids)
            conn.execute(f"DELETE FROM quiz_attempt_events WHERE intento_id IN (SELECT id FROM intentos WHERE actividad_id IN ({placeholders}))", legacy_ids)
            conn.execute(f"DELETE FROM game_sessions WHERE actividad_id IN ({placeholders})", legacy_ids)
            conn.execute(f"DELETE FROM rooms WHERE actividad_id IN ({placeholders})", legacy_ids)
            conn.execute(f"DELETE FROM intentos WHERE actividad_id IN ({placeholders})", legacy_ids)
            conn.execute(f"DELETE FROM actividad_recursos WHERE actividad_id IN ({placeholders})", legacy_ids)
            conn.execute(f"DELETE FROM preguntas WHERE actividad_id IN ({placeholders})", legacy_ids)
            conn.execute(f"DELETE FROM actividades WHERE id IN ({placeholders})", legacy_ids)
            conn.commit()
        categories = _category_ids(conn)
    finally:
        close_db(conn)

    created = [crear_quiz(payload, DOCENTE_ID) for payload in _seed_quizzes(categories)]
    return {
        "backup": backup_path,
        "legacy_activities_removed": len(legacy_ids),
        "unified_quizzes_created": len(created),
        "activities": [{"id": row["actividad_id"], "title": row["titulo"]} for row in created],
    }


if __name__ == "__main__":
    print(reset_legacy_quizzes())
