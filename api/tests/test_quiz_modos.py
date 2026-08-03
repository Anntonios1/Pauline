"""Modos de juego "ordenar" y "emparejar".

Viajan como `short_text` con la definición en `configuracion` (mismo truco que
los embeds de Wordwall) para no tener que ampliar el CHECK de
`quiz_items.tipo`, que en SQLite obliga a reconstruir la tabla.

Lo que aquí importa es el contrato de la cadena canónica: el frontend arma la
respuesta uniendo las piezas con " | " (y, en emparejar, ordenando
alfabéticamente los pares "izq = der"). Si el servidor no puntúa exactamente
esa cadena, los dos modos quedan siempre en incorrecto sin que nada falle a la
vista. Estas pruebas fijan ese contrato por ambos lados.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.services.activities import crear_intento
from api.services.quizzes import crear_quiz, guardar_respuestas_quiz, obtener_quiz_por_actividad

PIEZAS = ["Fecundación", "Cigoto", "Embrión", "Feto"]
PARES = [("Ovarios", "Producen óvulos"), ("Útero", "Aloja al bebé"), ("Vagina", "Conducto al exterior")]


def canonical_orden(piezas):
    return " | ".join(piezas)


def canonical_pares(pares):
    return " | ".join(sorted(f"{a} = {b}" for a, b in pares))


class QuizModosTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "modos-tests.db")
        init_db(os.environ["DB_PATH"])
        conn = get_db()
        try:
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('MODO_DOC', 'Docente Modos', 'unused', 'docente')"
            ).lastrowid
            self.student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('MODO_EST', 'Estudiante Modos', 'unused', 'estudiante')"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

        quiz = crear_quiz({
            "titulo": "Quiz de modos", "area": "fecundacion", "dificultad": "media",
            "estado": "publicado", "intentos_maximos": 5,
            "items": [
                {"tipo": "short_text", "enunciado": "Ordena las etapas.",
                 "config": {"modo": "ordenar", "piezas": PIEZAS},
                 "respuesta_correcta": canonical_orden(PIEZAS), "puntos": 1},
                {"tipo": "short_text", "enunciado": "Empareja cada órgano.",
                 "config": {"modo": "emparejar", "pares": [list(p) for p in PARES]},
                 "respuesta_correcta": canonical_pares(PARES), "puntos": 1},
            ],
        }, self.docente_id)
        self.actividad_id = quiz["id"]
        self.item_orden = quiz["items"][0]["id"]
        self.item_pares = quiz["items"][1]["id"]

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def _responder(self, orden_txt, pares_txt):
        intento = crear_intento(self.student_id, self.actividad_id)
        return guardar_respuestas_quiz(intento["id"], [
            {"item_id": self.item_orden, "respuesta": orden_txt},
            {"item_id": self.item_pares, "respuesta": pares_txt},
        ])

    def test_respuestas_canonicas_puntuan_correcto(self):
        score = self._responder(canonical_orden(PIEZAS), canonical_pares(PARES))
        self.assertEqual(score["intento"]["porcentaje"], 100)
        self.assertTrue(all(d["correcta"] for d in score["detalle"]))

    def test_orden_equivocado_puntua_incorrecto(self):
        invertido = canonical_orden(list(reversed(PIEZAS)))
        score = self._responder(invertido, canonical_pares(PARES))
        por_item = {d["item_id"]: d["correcta"] for d in score["detalle"]}
        self.assertFalse(por_item[self.item_orden], "una secuencia invertida no puede dar por buena")
        self.assertTrue(por_item[self.item_pares])

    def test_emparejar_no_depende_del_orden_en_que_se_empareje(self):
        """El estudiante empareja en cualquier orden; la cadena se ordena antes
        de compararla, así que el resultado debe ser el mismo."""
        barajado = canonical_pares(list(reversed(PARES)))
        self.assertEqual(barajado, canonical_pares(PARES))
        score = self._responder(canonical_orden(PIEZAS), barajado)
        self.assertEqual(score["intento"]["porcentaje"], 100)

    def test_emparejamiento_cruzado_puntua_incorrecto(self):
        mal = canonical_pares([("Ovarios", "Aloja al bebé"), ("Útero", "Producen óvulos"),
                               ("Vagina", "Conducto al exterior")])
        score = self._responder(canonical_orden(PIEZAS), mal)
        por_item = {d["item_id"]: d["correcta"] for d in score["detalle"]}
        self.assertFalse(por_item[self.item_pares], "parejas cruzadas no pueden dar por buenas")

    def test_el_estudiante_recibe_la_definicion_pero_no_la_respuesta(self):
        """config debe llegar (sin piezas/pares no hay nada que mostrar), pero
        correct_answer no: es la solución."""
        player = obtener_quiz_por_actividad(self.actividad_id, include_answers=False)
        item = next(i for i in player["items"] if i["config"].get("modo") == "ordenar")
        self.assertEqual(item["config"]["piezas"], PIEZAS)
        self.assertNotIn("correct_answer", item)
        self.assertNotIn("respuesta_correcta", item)

    def test_el_docente_si_recibe_la_respuesta(self):
        editor = obtener_quiz_por_actividad(self.actividad_id, include_answers=True)
        item = next(i for i in editor["items"] if i["config"].get("modo") == "emparejar")
        self.assertEqual(item["correct_answer"], canonical_pares(PARES))


if __name__ == "__main__":
    unittest.main()
