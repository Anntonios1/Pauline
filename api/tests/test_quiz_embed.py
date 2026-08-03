"""Bloque 'wordwall': un bloque info con un iframe embebido.

No hay tipo de bloque nuevo en el motor — el frontend lo manda como 'info'
con la URL en config.wordwall_url (ver TeacherCreatorPage.jsx: serializeItem).
Lo único que valida el backend es que esa URL apunte a wordwall.net por
https: sin eso, cualquier docente (o una llamada directa a la API que se
salte la validación del frontend) podría fijar cualquier src de iframe que
ven los estudiantes.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.routes.quizzes import create_quiz
from api.services.sessions import crear_sesion


class _Handler:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}"}
        self.client_address = ("127.0.0.1", 0)


class QuizEmbedTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "quiz-embed-tests.db")
        init_db(os.environ["DB_PATH"])
        conn = get_db()
        try:
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('EMB_DOC', 'Docente Embed', 'unused', 'docente')"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()
        self.doc_token = "embed-doc-token"
        crear_sesion(self.docente_id, self.doc_token)

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def _payload(self, wordwall_url):
        return {
            "titulo": "Repaso con Wordwall",
            "area": "pubertad",
            "dificultad": "media",
            "intentos_maximos": 2,
            "items": [
                {
                    "id": "block-question",
                    "tipo": "true_false",
                    "enunciado": "La pubertad es una etapa del desarrollo.",
                    "respuesta_correcta": "true",
                    "puntos": 1,
                    "tiempo_segundos": 0,
                    "media": [],
                },
                {
                    "id": "block-wordwall",
                    "tipo": "info",
                    "enunciado": "Juego de repaso",
                    "contenido": "",
                    "media": [],
                    "config": {"wordwall_url": wordwall_url},
                },
            ],
        }

    def test_url_de_wordwall_valida_se_acepta(self):
        result = create_quiz(
            _Handler(self.doc_token), {}, {},
            self._payload("https://wordwall.net/es/embed/abc123"),
        )
        self.assertIsInstance(result, tuple)
        created, status = result
        self.assertEqual(status, 201)
        wordwall_item = next(item for item in created["items"] if item["type"] == "info")
        self.assertEqual(wordwall_item["config"]["wordwall_url"], "https://wordwall.net/es/embed/abc123")

    def test_subdominio_de_wordwall_se_acepta(self):
        result = create_quiz(
            _Handler(self.doc_token), {}, {},
            self._payload("https://sub.wordwall.net/es/embed/abc123"),
        )
        self.assertIsInstance(result, tuple)
        self.assertEqual(result[1], 201)

    def test_dominio_ajeno_se_rechaza(self):
        result = create_quiz(
            _Handler(self.doc_token), {}, {},
            self._payload("https://evil.example.com/embed/abc123"),
        )
        self.assertIsInstance(result, tuple)
        self.assertEqual(result[1], 400)

    def test_wordwall_por_http_se_rechaza(self):
        """https obligatorio: http permitiría contenido mixto y facilita suplantación."""
        result = create_quiz(
            _Handler(self.doc_token), {}, {},
            self._payload("http://wordwall.net/es/embed/abc123"),
        )
        self.assertIsInstance(result, tuple)
        self.assertEqual(result[1], 400)

    def test_dominio_parecido_no_cuela(self):
        """'wordwall.net.evil.com' no debe colarse por un match de substring débil."""
        result = create_quiz(
            _Handler(self.doc_token), {}, {},
            self._payload("https://wordwall.net.evil.com/embed/abc123"),
        )
        self.assertIsInstance(result, tuple)
        self.assertEqual(result[1], 400)

    def test_bloque_info_sin_wordwall_url_sigue_funcionando(self):
        """No debe romper el bloque 'info' normal (sin iframe) que ya existía."""
        payload = self._payload("https://wordwall.net/es/embed/abc123")
        payload["items"][1]["config"] = {}
        payload["items"][1]["contenido"] = "Texto informativo normal, sin juego."
        result = create_quiz(_Handler(self.doc_token), {}, {}, payload)
        self.assertIsInstance(result, tuple)
        self.assertEqual(result[1], 201)


if __name__ == "__main__":
    unittest.main()
