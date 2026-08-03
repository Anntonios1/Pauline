"""Export CSV de progreso de estudiantes (GET /api/stats/export).

Antes solo existia el panel visual (stats/students); esta ruta expone el
mismo detalle como archivo descargable para un docente que quiera cruzar
los datos fuera de la plataforma. Cubre: solo docente/admin puede
descargarlo, el contenido es CSV valido con las columnas esperadas y trae
los datos del estudiante de prueba.
"""

import csv
import io
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.routes.stats import EXPORT_COLUMNAS, stats_export
from api.services.sessions import crear_sesion


class _Handler:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}
        self.client_address = ("127.0.0.1", 0)


def _status(resultado):
    return resultado[1] if isinstance(resultado, tuple) else 200


class StatsExportTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "stats-export-tests.db")
        init_db(os.environ["DB_PATH"])
        conn = get_db()
        try:
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('EXP_DOC', 'Docente Export', 'unused', 'docente')"
            ).lastrowid
            self.student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('EXP_EST', 'Estudiante Export', 'unused', 'estudiante')"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()
        self.doc_token = "export-doc-token"
        self.student_token = "export-student-token"
        crear_sesion(self.docente_id, self.doc_token)
        crear_sesion(self.student_id, self.student_token)

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def test_docente_descarga_csv_valido(self):
        respuesta = stats_export(_Handler(self.doc_token), {}, {}, {})
        self.assertEqual(respuesta.status_code, 200)
        self.assertIn("text/csv", respuesta.media_type)
        self.assertIn("attachment", respuesta.headers["content-disposition"])

        texto = respuesta.body.decode("utf-8-sig")
        filas = list(csv.DictReader(io.StringIO(texto)))
        self.assertEqual(list(filas[0].keys()), EXPORT_COLUMNAS)
        codigos = [f["codigo"] for f in filas]
        self.assertIn("EXP_EST", codigos)

    def test_estudiante_no_puede_exportar(self):
        respuesta = stats_export(_Handler(self.student_token), {}, {}, {})
        self.assertEqual(_status(respuesta), 403)

    def test_sin_token_401(self):
        respuesta = stats_export(_Handler(""), {}, {}, {})
        self.assertEqual(_status(respuesta), 401)


if __name__ == "__main__":
    unittest.main()
