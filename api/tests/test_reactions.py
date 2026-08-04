"""Reacciones a publicaciones: contrato del toggle y aislamiento entre usuarios.

Las reacciones se guardan en `publicacion_reacciones`, con clave primaria
(publicacion_id, usuario_id, tipo): esa restriccion es la que impide contar dos
veces a la misma persona, asi que aqui se comprueba que el comportamiento
observable dependa del estado y no del numero de pulsaciones.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.models import Publicacion
from api.routes.publications import toggle_reaction
from api.services.publications import crear_publicacion, listar_publicaciones
from api.services.sessions import crear_sesion
from api.utils.helpers import hash_password


class _Handler:
    """Lo minimo que los handlers usan del request (ver RequestAdapter)."""

    def __init__(self, token=None):
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}
        self.client_address = ("127.0.0.1", 0)


class ReactionTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "reactions.db")
        init_db(os.environ["DB_PATH"])
        self.addCleanup(self._restore_db)

        self.ana = self._crear_usuario("EST900", "Ana")
        self.beto = self._crear_usuario("EST901", "Beto")
        self.token_ana = crear_sesion(self.ana, "token-de-ana", "127.0.0.1", "test")["token"]
        self.token_beto = crear_sesion(self.beto, "token-de-beto", "127.0.0.1", "test")["token"]

        self.pub_id = crear_publicacion(Publicacion(
            titulo="Publicacion de prueba", slug="publicacion-de-prueba",
            contenido="Contenido", autor_id=self.ana, estado="aprobada",
        ))["id"]

    def _restore_db(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db

    def _crear_usuario(self, codigo, nombre, rol="estudiante"):
        conn = get_db()
        try:
            cursor = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol, activo) "
                "VALUES (?, ?, ?, ?, 1)",
                (codigo, nombre, hash_password("Password123"), rol),
            )
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()

    def _reaccionar(self, token, tipo, pub_id=None):
        return toggle_reaction(
            _Handler(token), {"id": str(pub_id or self.pub_id)}, {}, {"tipo": tipo}
        )

    # ── Comportamiento del toggle ──────────────────────────────────────────

    def test_reaccionar_suma_y_repetir_resta(self):
        primera = self._reaccionar(self.token_ana, "entendi")
        self.assertEqual(primera["reacciones"], {"entendi": 1})
        self.assertEqual(primera["mis_reacciones"], ["entendi"])
        self.assertTrue(primera["activa"])

        segunda = self._reaccionar(self.token_ana, "entendi")
        self.assertEqual(segunda["reacciones"], {})
        self.assertEqual(segunda["mis_reacciones"], [])
        self.assertFalse(segunda["activa"])

    def test_dos_usuarios_distintos_suman_dos(self):
        self._reaccionar(self.token_ana, "duda")
        resultado = self._reaccionar(self.token_beto, "duda")
        self.assertEqual(resultado["reacciones"], {"duda": 2})
        # Beto solo ve la suya en `mis_reacciones`, no la de Ana.
        self.assertEqual(resultado["mis_reacciones"], ["duda"])

    def test_una_persona_puede_marcar_varios_tipos(self):
        self._reaccionar(self.token_ana, "entendi")
        resultado = self._reaccionar(self.token_ana, "practicar")
        self.assertEqual(resultado["reacciones"], {"entendi": 1, "practicar": 1})
        self.assertEqual(sorted(resultado["mis_reacciones"]), ["entendi", "practicar"])

    # ── Validacion y permisos ──────────────────────────────────────────────

    def test_tipo_invalido_se_rechaza(self):
        cuerpo, status = self._reaccionar(self.token_ana, "aplausos")
        self.assertEqual(status, 400)
        self.assertIn("invalida", cuerpo["error"].lower())

    def test_sin_sesion_no_se_puede_reaccionar(self):
        cuerpo, status = toggle_reaction(
            _Handler(), {"id": str(self.pub_id)}, {}, {"tipo": "entendi"}
        )
        self.assertEqual(status, 401)

    def test_publicacion_inexistente(self):
        cuerpo, status = self._reaccionar(self.token_ana, "entendi", pub_id=99999)
        self.assertEqual(status, 404)

    def test_no_se_reacciona_a_algo_sin_aprobar(self):
        borrador = crear_publicacion(Publicacion(
            titulo="Borrador", slug="borrador", contenido="x",
            autor_id=self.ana, estado="enviada",
        ))["id"]
        cuerpo, status = self._reaccionar(self.token_ana, "entendi", pub_id=borrador)
        self.assertEqual(status, 404)

    # ── Como llegan al listado ─────────────────────────────────────────────

    def test_el_listado_trae_conteos_y_solo_mis_reacciones(self):
        self._reaccionar(self.token_ana, "sorpresa")
        self._reaccionar(self.token_beto, "sorpresa")
        self._reaccionar(self.token_beto, "duda")

        vista_ana = listar_publicaciones(viewer_id=self.ana)[0]
        self.assertEqual(vista_ana["reacciones"], {"sorpresa": 2, "duda": 1})
        self.assertEqual(vista_ana["mis_reacciones"], ["sorpresa"])

        vista_beto = listar_publicaciones(viewer_id=self.beto)[0]
        self.assertEqual(vista_beto["reacciones"], {"sorpresa": 2, "duda": 1})
        self.assertEqual(sorted(vista_beto["mis_reacciones"]), ["duda", "sorpresa"])

    def test_sin_sesion_el_listado_trae_conteos_pero_ninguna_propia(self):
        self._reaccionar(self.token_ana, "entendi")
        anonimo = listar_publicaciones(viewer_id=None)[0]
        self.assertEqual(anonimo["reacciones"], {"entendi": 1})
        self.assertEqual(anonimo["mis_reacciones"], [])

    def test_borrar_la_publicacion_arrastra_sus_reacciones(self):
        self._reaccionar(self.token_ana, "entendi")
        conn = get_db()
        try:
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("DELETE FROM publicaciones WHERE id = ?", (self.pub_id,))
            conn.commit()
            resto = conn.execute(
                "SELECT COUNT(*) FROM publicacion_reacciones WHERE publicacion_id = ?",
                (self.pub_id,),
            ).fetchone()[0]
        finally:
            conn.close()
        self.assertEqual(resto, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
