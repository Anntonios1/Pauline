"""Regresiones de control de acceso.

Cada prueba fija un agujero real que la API tuvo: escalada de rol desde el propio
perfil, solucionario legacy visible para el estudiante, borradores legibles por
cualquiera y listas de clase sin autenticar.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.routes.activities import create_activity
from api.routes.publications import (
    create_publication,
    get_publication,
    get_moderation_history,
    moderate_publication,
)
from api.routes.questions import create_question, list_questions
from api.routes.resources import add_resource_to_activity
from api.routes.users import get_course_students, update_my_profile, update_user
from api.services.sessions import crear_sesion
from api.services.users import obtener_usuario_por_id


class _Handler:
    """Handler con token; sin argumento representa a un anónimo."""

    def __init__(self, token=None):
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}
        self.client_address = ("127.0.0.1", 0)


def _status(resultado):
    """Los handlers devuelven dict (200) o (dict, status)."""
    return resultado[1] if isinstance(resultado, tuple) else 200


class SecurityRegressionTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "security-tests.db")
        init_db(os.environ["DB_PATH"])
        conn = get_db()
        try:
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('SEC_DOC', 'Docente', 'unused', 'docente')"
            ).lastrowid
            self.student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('SEC_EST', 'Estudiante', 'unused', 'estudiante')"
            ).lastrowid
            self.other_student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('SEC_EST2', 'Otra Estudiante', 'unused', 'estudiante')"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()
        self.doc_token = "sec-doc-token"
        self.student_token = "sec-student-token"
        self.other_student_token = "sec-other-student-token"
        crear_sesion(self.docente_id, self.doc_token)
        crear_sesion(self.student_id, self.student_token)
        crear_sesion(self.other_student_id, self.other_student_token)

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    # ── Escalada de privilegios ────────────────────────────────────────────────
    def test_perfil_propio_no_permite_ascenderse_a_administrador(self):
        update_my_profile(
            _Handler(self.student_token), {}, {},
            {"nombre_visible": "Nuevo nombre", "rol": "administrador", "activo": 0},
        )
        usuario = obtener_usuario_por_id(self.student_id)
        self.assertEqual(usuario["rol"], "estudiante")
        self.assertEqual(usuario["activo"], 1)
        # El campo legítimo sí se aplica.
        self.assertEqual(usuario["nombre_visible"], "Nuevo nombre")

    def test_editar_usuario_propio_no_permite_cambiar_rol_ni_codigo(self):
        update_user(
            _Handler(self.student_token), {"id": str(self.student_id)}, {},
            {"rol": "administrador", "codigo": "SUPLANTADO"},
        )
        usuario = obtener_usuario_por_id(self.student_id)
        self.assertEqual(usuario["rol"], "estudiante")
        self.assertEqual(usuario["codigo"], "SEC_EST")

    # ── Solucionario de quizzes legacy ─────────────────────────────────────────
    def _crear_actividad_con_pregunta(self):
        actividad = create_activity(
            _Handler(self.doc_token), {}, {},
            {"titulo": "Quiz legacy", "area": "pubertad", "tipo": "quiz"},
        )
        actividad_id = actividad["id"]
        create_question(
            _Handler(self.doc_token), {}, {},
            {
                "actividad_id": actividad_id,
                "orden": 1,
                "tipo": "opcion_multiple",
                "enunciado": "¿Cuál es la respuesta?",
                "opciones": '["A", "B"]',
                "respuesta_correcta": "A",
                "explicacion": "Porque sí",
            },
        )
        return actividad_id

    def test_estudiante_no_recibe_la_respuesta_correcta(self):
        actividad_id = self._crear_actividad_con_pregunta()
        preguntas = list_questions(
            _Handler(self.student_token), {"id": str(actividad_id)}, {}, {}
        )
        self.assertEqual(len(preguntas), 1)
        self.assertNotIn("respuesta_correcta", preguntas[0])
        self.assertNotIn("explicacion", preguntas[0])
        # El enunciado y las opciones sí llegan: el quiz se sigue pudiendo jugar.
        self.assertEqual(preguntas[0]["enunciado"], "¿Cuál es la respuesta?")

    def test_docente_si_recibe_la_respuesta_correcta(self):
        actividad_id = self._crear_actividad_con_pregunta()
        preguntas = list_questions(
            _Handler(self.doc_token), {"id": str(actividad_id)}, {}, {}
        )
        self.assertEqual(preguntas[0]["respuesta_correcta"], "A")

    def test_listar_preguntas_sin_token_es_401(self):
        actividad_id = self._crear_actividad_con_pregunta()
        resultado = list_questions(_Handler(), {"id": str(actividad_id)}, {}, {})
        self.assertEqual(_status(resultado), 401)

    # ── Borradores ajenos ──────────────────────────────────────────────────────
    def _crear_borrador(self):
        pub = create_publication(
            _Handler(self.student_token), {}, {},
            {"titulo": "Borrador privado", "contenido": "texto", "estado": "borrador"},
        )
        self.assertEqual(pub["estado"], "borrador")
        return pub["id"]

    def test_borrador_no_es_legible_por_anonimos_ni_por_otro_estudiante(self):
        pub_id = self._crear_borrador()
        params = {"id": str(pub_id)}
        self.assertEqual(_status(get_publication(_Handler(), params, {}, {})), 404)
        self.assertEqual(
            _status(get_publication(_Handler(self.other_student_token), params, {}, {})),
            404,
        )

    def test_borrador_si_es_legible_por_su_autor_y_por_el_staff(self):
        pub_id = self._crear_borrador()
        params = {"id": str(pub_id)}
        self.assertEqual(
            _status(get_publication(_Handler(self.student_token), params, {}, {})), 200
        )
        self.assertEqual(
            _status(get_publication(_Handler(self.doc_token), params, {}, {})), 200
        )

    def test_historial_de_moderacion_no_es_publico(self):
        pub_id = self._crear_borrador()
        params = {"id": str(pub_id)}
        self.assertEqual(_status(get_moderation_history(_Handler(), params, {}, {})), 401)
        self.assertEqual(
            _status(get_moderation_history(_Handler(self.other_student_token), params, {}, {})),
            403,
        )

    def test_moderar_con_estado_invalido_es_400_no_500(self):
        pub_id = self._crear_borrador()
        resultado = moderate_publication(
            _Handler(self.doc_token), {"id": str(pub_id)}, {},
            {"decision": "aprobar", "estado_nuevo": "inventado"},
        )
        self.assertEqual(_status(resultado), 400)

    # ── Endpoints que estaban sin autenticar ───────────────────────────────────
    def test_lista_de_clase_exige_rol_de_staff(self):
        params = {"id": "1"}
        self.assertEqual(_status(get_course_students(_Handler(), params, {}, {})), 401)
        self.assertEqual(
            _status(get_course_students(_Handler(self.student_token), params, {}, {})), 403
        )
        self.assertEqual(
            _status(get_course_students(_Handler(self.doc_token), params, {}, {})), 200
        )

    def test_adjuntar_recurso_exige_rol_de_staff(self):
        params = {"id": "1"}
        body = {"recurso_id": 1}
        self.assertEqual(
            _status(add_resource_to_activity(_Handler(), params, {}, body)), 401
        )
        self.assertEqual(
            _status(add_resource_to_activity(_Handler(self.student_token), params, {}, body)),
            403,
        )

    def test_adjuntar_recurso_sin_id_es_400_no_500(self):
        resultado = add_resource_to_activity(
            _Handler(self.doc_token), {"id": "1"}, {}, {}
        )
        self.assertEqual(_status(resultado), 400)


if __name__ == "__main__":
    unittest.main()
