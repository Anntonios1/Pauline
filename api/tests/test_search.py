"""Búsqueda ?q= en actividades, recursos y publicaciones.

Cubre que encuentra por título/descripción y que los comodines de LIKE (% y _)
en lo que escribe la persona no se interpretan como patrón — sin el escape,
buscar "50%" te devolvería cualquier cosa, no literalmente "50%".
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.routes.activities import create_activity, list_activities
from api.routes.resources import create_resource, list_resources
from api.services.sessions import crear_sesion


class _Handler:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}"}
        self.client_address = ("127.0.0.1", 0)


class SearchTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "search-tests.db")
        init_db(os.environ["DB_PATH"])
        conn = get_db()
        try:
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('SEARCH_DOC', 'Docente Search', 'unused', 'docente')"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()
        self.doc_token = "search-doc-token"
        crear_sesion(self.docente_id, self.doc_token)

        create_activity(_Handler(self.doc_token), {}, {}, {
            "titulo": "Descuento del 50% en la librería", "area": "autocuidado", "tipo": "lectura",
        })
        create_activity(_Handler(self.doc_token), {}, {}, {
            "titulo": "Ciclo menstrual explicado", "area": "sistema_reproductor_femenino", "tipo": "lectura",
            "descripcion": "Una guía con diagramas paso a paso.",
        })
        create_resource(_Handler(self.doc_token), {}, {}, {
            "titulo": "Video: mi_archivo_2024 sobre pubertad", "tipo": "video", "archivo_o_url": "https://example.com/v",
        })
        create_activity(_Handler(self.doc_token), {}, {}, {
            "titulo": "Autocuidado esencial", "area": "autocuidado", "tipo": "lectura",
        })

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def test_busca_actividad_por_titulo(self):
        result = list_activities(_Handler(self.doc_token), {}, {"q": "menstrual"}, {})
        self.assertEqual(len(result), 1)
        self.assertIn("Ciclo menstrual", result[0]["titulo"])

    def test_busca_actividad_por_descripcion(self):
        result = list_activities(_Handler(self.doc_token), {}, {"q": "diagramas"}, {})
        self.assertEqual(len(result), 1)

    def test_termino_sin_coincidencias(self):
        result = list_activities(_Handler(self.doc_token), {}, {"q": "inexistente-xyz"}, {})
        self.assertEqual(len(result), 0)

    def test_porcentaje_se_busca_literal_no_como_comodin(self):
        # "Autocuidado esencial" NO contiene la subcadena literal "auto%dado".
        # Si '%' se tratara como comodín SQL (sin escapar), el patrón
        # %auto%dado% se leería "contiene 'auto', luego cualquier cosa, luego
        # 'dado'" y SÍ matchearía "autocuidado" por accidente.
        result = list_activities(_Handler(self.doc_token), {}, {"q": "auto%dado"}, {})
        self.assertEqual(len(result), 0, "el '%' del término de búsqueda se está tratando como comodín SQL")

    def test_guion_bajo_se_busca_literal_no_como_comodin(self):
        # Mismo caso con '_': "aut_cuidado" no aparece literal en
        # "Autocuidado esencial". Sin escapar, '_' matchea un solo carácter
        # cualquiera y "aut" + cualquier-caracter + "cuidado" sí matchea
        # "autocuidado" (aut-o-cuidado) por accidente.
        result = list_activities(_Handler(self.doc_token), {}, {"q": "aut_cuidado"}, {})
        self.assertEqual(len(result), 0, "el '_' del término de búsqueda se está tratando como comodín SQL")

        # Y a la inversa: el guion bajo LITERAL de "mi_archivo" sí debe
        # encontrar el recurso (el docente lo sube ya auto-aprobado).
        encontrado = list_resources(_Handler(self.doc_token), {}, {"q": "mi_archivo"}, {})
        self.assertEqual(len(encontrado), 1)


if __name__ == "__main__":
    unittest.main()
