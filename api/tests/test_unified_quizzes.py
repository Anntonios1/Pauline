"""Pruebas aisladas del contrato creator -> player -> attempt del motor unificado."""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.routes.quizzes import create_quiz, update_quiz
from api.services.activities import crear_intento, listar_actividades
from api.services.quizzes import (
    actualizar_quiz,
    guardar_respuestas_quiz,
    obtener_quiz_por_actividad,
)
from api.services.sessions import crear_sesion


class _Handler:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}"}
        self.client_address = ("127.0.0.1", 0)


class UnifiedQuizTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tempdir.name, "quiz-tests.db")
        os.environ["DB_PATH"] = self.db_path
        init_db(self.db_path)
        conn = get_db()
        try:
            self.docente_id = conn.execute(
                """
                INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)
                VALUES ('QUIZ_DOC', 'Docente Quiz', 'unused', 'docente')
                """
            ).lastrowid
            self.other_docente_id = conn.execute(
                """
                INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)
                VALUES ('QUIZ_OTHER', 'Otro Docente', 'unused', 'docente')
                """
            ).lastrowid
            self.student_id = conn.execute(
                """
                INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)
                VALUES ('QUIZ_STUDENT', 'Estudiante Quiz', 'unused', 'estudiante')
                """
            ).lastrowid
            conn.commit()
        finally:
            conn.close()
        self.doc_token = "doc-quiz-token"
        self.other_doc_token = "other-doc-quiz-token"
        self.student_token = "student-quiz-token"
        crear_sesion(self.docente_id, self.doc_token)
        crear_sesion(self.other_docente_id, self.other_doc_token)
        crear_sesion(self.student_id, self.student_token)

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def _creator_payload(self):
        return {
            "titulo": "Quiz multimedia de autocuidado",
            "descripcion": "Contrato real del creador docente",
            "area": "autocuidado",
            "dificultad": "media",
            "intentos_maximos": 3,
            "config": {"barajar_opciones": True, "aprobado_porcentaje": 70},
            "items": [
                {
                    "id": "block-single",
                    "tipo": "single_choice",
                    "enunciado": "¿Cuál acción cuida tu cuerpo?",
                    "opciones": [
                        {"id": "option-water", "texto": "Tomar agua", "correcta": True,
                         "media": [{"tipo": "image", "url": "/uploads/water.webp", "nombre": "water.webp"}]},
                        {"id": "option-none", "texto": "No dormir", "correcta": False, "media": []},
                    ],
                    "respuesta_correcta": "option-water",
                    "explicacion": "La hidratación es parte del autocuidado.",
                    "puntos": 2,
                    "tiempo_segundos": 30,
                    "media": [{"tipo": "audio", "url": "/uploads/prompt.mp3", "nombre": "prompt.mp3"}],
                },
                {
                    "id": "block-info",
                    "tipo": "info",
                    "enunciado": "Antes de continuar",
                    "contenido": "Escucha a tu cuerpo y pide ayuda cuando la necesites.",
                    "opciones": [],
                    "respuesta_correcta": None,
                    "puntos": 0,
                    "tiempo_segundos": 0,
                    "media": [],
                },
                {
                    "id": "block-card",
                    "tipo": "flashcard",
                    "enunciado": "Frente de la ficha",
                    "contenido": "Reverso pedagógico visible",
                    "opciones": [],
                    "respuesta_correcta": "Reverso pedagógico visible",
                    "puntos": 0,
                    "tiempo_segundos": 0,
                    "media": [],
                },
            ],
        }

    def test_creator_player_versioned_attempt_flow(self):
        result = create_quiz(_Handler(self.doc_token), {}, {}, self._creator_payload())
        self.assertIsInstance(result, tuple)
        created, status = result
        self.assertEqual(status, 201)
        self.assertEqual(created["estado"], "publicado")
        self.assertEqual(created["actividad_id"], created["id"])
        self.assertEqual(created["version"], 1)
        activity_id = created["id"]
        question_id = created["items"][0]["id"]
        self.assertEqual(created["items"][0]["options"][0]["id"], "option-water")
        self.assertEqual(created["items"][0]["puntos"], 2)
        self.assertEqual(created["items"][1]["prompt"], "Antes de continuar")
        self.assertEqual(created["items"][1]["contenido"], self._creator_payload()["items"][1]["contenido"])

        # El catálogo no lo descarta por tener cero preguntas legacy.
        catalog_item = next(item for item in listar_actividades() if item["id"] == activity_id)
        self.assertEqual(catalog_item["preguntas_count"], 3)
        self.assertEqual(catalog_item["quiz_unificado"], 1)

        # Un estudiante recibe opciones/medios y el reverso de la ficha, no claves evaluables.
        player = obtener_quiz_por_actividad(activity_id, include_answers=False)
        self.assertNotIn("correct_answer", player["items"][0])
        self.assertNotIn("correct", player["items"][0]["options"][0])
        self.assertEqual(player["items"][2]["correct_answer"], "Reverso pedagógico visible")
        self.assertEqual(player["items"][2]["contenido"], "Reverso pedagógico visible")

        attempt = crear_intento(self.student_id, activity_id)
        self.assertEqual(attempt["quiz_version"], 1)

        # El docente cambia la respuesta en v2 después de iniciado el intento.
        updated_payload = self._creator_payload()
        updated_payload["items"][0]["opciones"][0]["correcta"] = False
        updated_payload["items"][0]["opciones"][1]["correcta"] = True
        updated_payload["items"][0]["respuesta_correcta"] = "option-none"
        updated = actualizar_quiz(activity_id, {"items": updated_payload["items"]}, self.docente_id)
        self.assertEqual(updated["version"], 2)

        score = guardar_respuestas_quiz(attempt["id"], [
            {"item_id": question_id, "respuesta": "option-water", "tiempo_ms": 1200}
        ])
        self.assertEqual(score["quiz_version"], 1)
        self.assertEqual(score["intento"]["puntaje"], 2)
        self.assertEqual(score["intento"]["porcentaje"], 100)
        self.assertEqual(len(score["detalle"]), 1)  # info/ficha no cuentan como incorrectas

    def test_roles_and_ownership_are_enforced(self):
        denied = create_quiz(_Handler(self.student_token), {}, {}, self._creator_payload())
        self.assertEqual(denied[1], 403)

        created, _ = create_quiz(_Handler(self.doc_token), {}, {}, self._creator_payload())
        denied_update = update_quiz(
            _Handler(self.other_doc_token), {"id": str(created["id"])}, {}, {"titulo": "No autorizado"}
        )
        self.assertEqual(denied_update[1], 403)

    def test_non_gradable_quiz_completes_at_one_hundred_percent(self):
        payload = self._creator_payload()
        payload["titulo"] = "Recorrido de fichas"
        payload["items"] = payload["items"][1:]
        created, status = create_quiz(_Handler(self.doc_token), {}, {}, payload)
        self.assertEqual(status, 201)
        attempt = crear_intento(self.student_id, created["id"])
        result = guardar_respuestas_quiz(attempt["id"], [])
        self.assertEqual(result["intento"]["puntaje"], 0)
        self.assertEqual(result["intento"]["puntaje_maximo"], 0)
        self.assertEqual(result["intento"]["porcentaje"], 100)
        self.assertEqual(result["detalle"], [])

    def test_schema_migration_is_idempotent(self):
        # Simula exactamente una BD anterior, cuya tabla intentos no tenía la columna.
        conn = get_db()
        try:
            conn.execute("ALTER TABLE intentos DROP COLUMN quiz_version")
            conn.commit()
        finally:
            conn.close()
        init_db(self.db_path)
        init_db(self.db_path)
        conn = get_db()
        try:
            columns = {row[1] for row in conn.execute("PRAGMA table_info(intentos)")}
            self.assertIn("quiz_version", columns)
            self.assertEqual(conn.execute("PRAGMA foreign_key_check").fetchall(), [])
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
