"""Reseteo de contraseña asistido por docente/admin (sin correo configurado).

Cubre el alcance de permisos (admin resetea a cualquiera, docente solo a
estudiantes), que la contraseña vieja deja de servir, que las sesiones
abiertas se cierran, y que un estudiante no puede resetear nada.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.routes.auth import login
from api.routes.users import reset_user_password
from api.services.sessions import crear_sesion, obtener_sesion_por_token
from api.utils.helpers import hash_password


class _Handler:
    def __init__(self, token=None):
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}
        self.client_address = ("127.0.0.1", 0)


def _status(resultado):
    return resultado[1] if isinstance(resultado, tuple) else 200


class PasswordResetTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "password-reset-tests.db")
        init_db(os.environ["DB_PATH"])
        conn = get_db()
        try:
            self.admin_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('PR_ADMIN', 'Admin PR', ?, 'administrador')", (hash_password("Passw0rd!"),)
            ).lastrowid
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('PR_DOC', 'Docente PR', ?, 'docente')", (hash_password("Passw0rd!"),)
            ).lastrowid
            self.otro_docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('PR_DOC2', 'Otro Docente PR', ?, 'docente')", (hash_password("Passw0rd!"),)
            ).lastrowid
            self.student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('PR_EST', 'Estudiante PR', ?, 'estudiante')", (hash_password("Passw0rd!"),)
            ).lastrowid
            conn.commit()
        finally:
            conn.close()
        self.admin_token = "pr-admin-token"
        self.doc_token = "pr-doc-token"
        self.student_token = "pr-student-token"
        crear_sesion(self.admin_id, self.admin_token)
        crear_sesion(self.docente_id, self.doc_token)
        crear_sesion(self.student_id, self.student_token)

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def test_admin_resetea_a_un_docente(self):
        r = reset_user_password(_Handler(self.admin_token), {"id": str(self.docente_id)}, {}, {})
        self.assertEqual(_status(r), 200)
        temporal = r["password_temporal"]
        self.assertGreaterEqual(len(temporal), 8)

        # La contraseña vieja ya no sirve; la nueva sí.
        vieja = login(_Handler(), {}, {}, {"codigo": "PR_DOC", "password": "Passw0rd!"})
        self.assertEqual(_status(vieja), 401)
        nueva = login(_Handler(), {}, {}, {"codigo": "PR_DOC", "password": temporal})
        self.assertEqual(_status(nueva), 200)

    def test_resetear_cierra_las_sesiones_abiertas(self):
        self.assertIsNotNone(obtener_sesion_por_token(self.doc_token))
        reset_user_password(_Handler(self.admin_token), {"id": str(self.docente_id)}, {}, {})
        self.assertIsNone(obtener_sesion_por_token(self.doc_token))

    def test_docente_resetea_a_un_estudiante(self):
        r = reset_user_password(_Handler(self.doc_token), {"id": str(self.student_id)}, {}, {})
        self.assertEqual(_status(r), 200)

    def test_docente_no_puede_resetear_a_otro_docente(self):
        r = reset_user_password(_Handler(self.doc_token), {"id": str(self.otro_docente_id)}, {}, {})
        self.assertEqual(_status(r), 403)

    def test_docente_no_puede_resetear_al_admin(self):
        r = reset_user_password(_Handler(self.doc_token), {"id": str(self.admin_id)}, {}, {})
        self.assertEqual(_status(r), 403)

    def test_estudiante_no_puede_resetear_nada(self):
        r = reset_user_password(_Handler(self.student_token), {"id": str(self.docente_id)}, {}, {})
        self.assertEqual(_status(r), 403)

    def test_sin_token_401(self):
        r = reset_user_password(_Handler(), {"id": str(self.docente_id)}, {}, {})
        self.assertEqual(_status(r), 401)

    def test_usuario_inexistente_404(self):
        r = reset_user_password(_Handler(self.admin_token), {"id": "999999"}, {}, {})
        self.assertEqual(_status(r), 404)


if __name__ == "__main__":
    unittest.main()
