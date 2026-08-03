"""Motor de datos de investigación (proyecto de grado): exports pseudonimizados.

Cubre: obtener_o_crear_pseudonimo es estable y único por usuario; cada export
(intentos, respuestas -legacy + unificado-, eventos, participación, resumen)
nunca expone nombre_visible/codigo real, solo el pseudónimo; el mapeo
sensible (/api/research/pseudonimos) es exclusivo de administrador mientras
que los exports son docente+administrador; estudiantes/docentes (no
estudiantes) quedan fuera del dataset pseudonimizado.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.routes.activities import create_activity
from api.routes.attempts import create_attempt, submit_attempt
from api.routes.comments import create_comment, moderate_comment
from api.routes.events import create_event
from api.routes.publications import create_publication, moderate_publication
from api.routes.questions import create_question
from api.routes.quizzes import create_quiz
from api.routes.research import (
    export_eventos, export_intentos, export_participacion,
    export_respuestas, export_resumen, get_pseudonimos,
)
from api.services.activities import crear_intento
from api.services.quizzes import guardar_respuestas_quiz
from api.services.research import (
    exportar_eventos as svc_exportar_eventos,
    exportar_intentos as svc_exportar_intentos,
    exportar_participacion as svc_exportar_participacion,
    exportar_respuestas as svc_exportar_respuestas,
    exportar_resumen as svc_exportar_resumen,
    obtener_o_crear_pseudonimo,
)
from api.services.sessions import crear_sesion

IDENTIFYING_KEYS = {"nombre_visible", "codigo", "estudiante_id", "autor_id", "actor_id"}


class _Handler:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}
        self.client_address = ("127.0.0.1", 0)


def _status(resultado):
    if hasattr(resultado, "status_code"):
        return resultado.status_code
    return resultado[1] if isinstance(resultado, tuple) else 200


class ResearchDataEngineTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "research-tests.db")
        init_db(os.environ["DB_PATH"])
        conn = get_db()
        try:
            self.admin_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('RES_ADMIN', 'Admin Research', 'unused', 'administrador')"
            ).lastrowid
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('RES_DOC', 'Docente Research', 'unused', 'docente')"
            ).lastrowid
            self.est1_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('RES_EST1', 'Estudiante Uno', 'unused', 'estudiante')"
            ).lastrowid
            self.est2_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('RES_EST2', 'Estudiante Dos', 'unused', 'estudiante')"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()
        self.admin_token = "res-admin-token"
        self.doc_token = "res-doc-token"
        self.est1_token = "res-est1-token"
        self.est2_token = "res-est2-token"
        crear_sesion(self.admin_id, self.admin_token)
        crear_sesion(self.docente_id, self.doc_token)
        crear_sesion(self.est1_id, self.est1_token)
        crear_sesion(self.est2_id, self.est2_token)

        # Quiz legacy: est1 responde.
        actividad_legacy = create_activity(_Handler(self.doc_token), {}, {}, {
            "titulo": "Quiz legacy", "area": "autocuidado", "tipo": "quiz",
        })
        pregunta = create_question(_Handler(self.doc_token), {}, {}, {
            "actividad_id": actividad_legacy["id"], "orden": 1, "tipo": "opcion_multiple",
            "enunciado": "¿1+1?", "opciones": '["2","3"]', "respuesta_correcta": "2",
        })
        intento_legacy = create_attempt(_Handler(self.est1_token), {}, {}, {"actividad_id": actividad_legacy["id"]})
        submit_attempt(_Handler(self.est1_token), {"id": str(intento_legacy["id"])}, {}, {
            "respuestas": [{"pregunta_id": pregunta["id"], "respuesta": "2"}],
        })

        # Quiz unificado: est2 responde.
        quiz_payload = {
            "titulo": "Quiz unificado", "area": "autocuidado", "dificultad": "media",
            "items": [{
                "id": "item-1", "tipo": "single_choice", "enunciado": "¿Cuidas tu cuerpo?",
                "opciones": [
                    {"id": "opt-si", "texto": "Si", "correcta": True, "media": []},
                    {"id": "opt-no", "texto": "No", "correcta": False, "media": []},
                ],
                "respuesta_correcta": "opt-si", "puntos": 1, "tiempo_segundos": 0, "media": [],
            }],
        }
        quiz_creado, _ = create_quiz(_Handler(self.doc_token), {}, {}, quiz_payload)
        self.actividad_unificada_id = quiz_creado["id"]
        item_id = quiz_creado["items"][0]["id"]
        intento_unificado = crear_intento(self.est2_id, self.actividad_unificada_id)
        guardar_respuestas_quiz(intento_unificado["id"], [
            {"item_id": item_id, "respuesta": "opt-si", "tiempo_ms": 900}
        ])

        # Publicación de est1, aprobada por el docente.
        pub = create_publication(_Handler(self.est1_token), {}, {}, {
            "titulo": "Mi primer aviso", "contenido": "contenido", "estado": "enviada",
        })
        moderate_publication(_Handler(self.doc_token), {"id": str(pub["id"])}, {}, {
            "decision": "aprobar", "estado_nuevo": "aprobada",
        })

        # Comentario de est2 sobre esa publicación, aprobado.
        comentario = create_comment(_Handler(self.est2_token), {}, {}, {
            "publicacion_id": pub["id"], "contenido": "Muy interesante",
        })
        moderate_comment(_Handler(self.doc_token), {"id": str(comentario["id"])}, {}, {"estado": "aprobado"})

        # Evento de aprendizaje: est1 "leyo" la publicación.
        create_event(_Handler(self.est1_token), {}, {}, {
            "verbo": "leyo", "objeto_tipo": "publicacion", "objeto_id": pub["id"],
        })

        # Publicación propia del docente (no debe aparecer en el dataset de estudiantes).
        create_publication(_Handler(self.doc_token), {}, {}, {
            "titulo": "Aviso oficial", "contenido": "contenido", "estado": "aprobada",
        })

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def _assert_no_identifying_keys(self, rows):
        for row in rows:
            filtrado = IDENTIFYING_KEYS & set(row.keys())
            self.assertEqual(filtrado, set(), f"Claves identificables filtradas: {filtrado}")
            self.assertIn("pseudonimo", row)

    # --- pseudónimos ---

    def test_pseudonimo_es_estable_y_unico(self):
        codigo1 = obtener_o_crear_pseudonimo(self.est1_id)
        codigo1_de_nuevo = obtener_o_crear_pseudonimo(self.est1_id)
        codigo2 = obtener_o_crear_pseudonimo(self.est2_id)
        self.assertEqual(codigo1, codigo1_de_nuevo)
        self.assertNotEqual(codigo1, codigo2)
        self.assertTrue(codigo1.startswith("SUJ-"))

    def test_mapeo_pseudonimos_requiere_administrador(self):
        self.assertEqual(_status(get_pseudonimos(_Handler(self.doc_token), {}, {}, {})), 403)
        self.assertEqual(_status(get_pseudonimos(_Handler(self.est1_token), {}, {}, {})), 403)
        self.assertEqual(_status(get_pseudonimos(_Handler("") , {}, {}, {})), 401)

        mapeo = get_pseudonimos(_Handler(self.admin_token), {}, {}, {})
        self.assertEqual(len(mapeo), 2)
        codigos_reales = {m["codigo"] for m in mapeo}
        self.assertEqual(codigos_reales, {"RES_EST1", "RES_EST2"})
        for m in mapeo:
            self.assertIn("pseudonimo", m)
            self.assertTrue(m["pseudonimo"].startswith("SUJ-"))

    def test_servicio_nunca_deja_el_id_crudo_en_el_dict(self):
        """Defensa en profundidad: el dict que arma el servicio no debe tener
        estudiante_id/actor_id/autor_id, independientemente de qué columnas
        decida exponer luego la capa de rutas al armar el CSV."""
        exports = (
            svc_exportar_intentos(), svc_exportar_respuestas(), svc_exportar_eventos(),
            svc_exportar_participacion(), svc_exportar_resumen(),
        )
        for rows in exports:
            self._assert_no_identifying_keys(rows)

    # --- exports: permisos ---

    def test_exports_requieren_docente_o_administrador(self):
        for handler_fn in (export_intentos, export_respuestas, export_eventos, export_participacion, export_resumen):
            self.assertEqual(_status(handler_fn(_Handler(self.est1_token), {}, {}, {})), 403, handler_fn.__name__)
            self.assertEqual(_status(handler_fn(_Handler(""), {}, {}, {})), 401, handler_fn.__name__)
            self.assertEqual(_status(handler_fn(_Handler(self.doc_token), {}, {}, {})), 200, handler_fn.__name__)

    # --- exports: contenido ---

    def test_export_intentos_incluye_ambos_motores_sin_identidad(self):
        respuesta = export_intentos(_Handler(self.doc_token), {}, {}, {})
        self.assertEqual(respuesta.status_code, 200)
        import csv, io
        filas = list(csv.DictReader(io.StringIO(respuesta.body.decode("utf-8-sig"))))
        self.assertEqual(len(filas), 2)
        self._assert_no_identifying_keys(filas)
        titulos = {f["actividad_titulo"] for f in filas}
        self.assertEqual(titulos, {"Quiz legacy", "Quiz unificado"})

    def test_export_respuestas_une_legacy_y_unificado(self):
        respuesta = export_respuestas(_Handler(self.doc_token), {}, {}, {})
        import csv, io
        filas = list(csv.DictReader(io.StringIO(respuesta.body.decode("utf-8-sig"))))
        self.assertEqual(len(filas), 2)
        self._assert_no_identifying_keys(filas)
        motores = {f["motor"] for f in filas}
        self.assertEqual(motores, {"legacy", "unificado"})

    def test_export_eventos_incluye_evento_registrado(self):
        respuesta = export_eventos(_Handler(self.doc_token), {}, {}, {})
        import csv, io
        filas = list(csv.DictReader(io.StringIO(respuesta.body.decode("utf-8-sig"))))
        self.assertEqual(len(filas), 1)
        self._assert_no_identifying_keys(filas)
        self.assertEqual(filas[0]["verbo"], "leyo")

    def test_export_participacion_excluye_al_docente(self):
        respuesta = export_participacion(_Handler(self.doc_token), {}, {}, {})
        import csv, io
        filas = list(csv.DictReader(io.StringIO(respuesta.body.decode("utf-8-sig"))))
        # 1 publicacion (est1) + 1 comentario (est2); la publicacion del docente queda fuera.
        self.assertEqual(len(filas), 2)
        self._assert_no_identifying_keys(filas)
        tipos = sorted(f["tipo"] for f in filas)
        self.assertEqual(tipos, ["comentario", "publicacion"])
        for f in filas:
            self.assertNotIn("titulo", f)
            self.assertNotIn("contenido", f)

    def test_export_resumen_una_fila_por_estudiante(self):
        respuesta = export_resumen(_Handler(self.doc_token), {}, {}, {})
        import csv, io
        filas = list(csv.DictReader(io.StringIO(respuesta.body.decode("utf-8-sig"))))
        self.assertEqual(len(filas), 2)
        self._assert_no_identifying_keys(filas)
        por_pseudonimo = {f["pseudonimo"]: f for f in filas}
        pseudo_est1 = obtener_o_crear_pseudonimo(self.est1_id)
        self.assertIn(pseudo_est1, por_pseudonimo)
        self.assertEqual(por_pseudonimo[pseudo_est1]["publicaciones_aprobadas"], "1")
        self.assertEqual(por_pseudonimo[pseudo_est1]["actividades_completadas"], "1")


if __name__ == "__main__":
    unittest.main()
