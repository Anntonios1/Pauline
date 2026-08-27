"""Pruebas de las piezas de backend nuevas del Sprint 2:

- el flag `actividades.motor_quiz` y la rama que elige `get_activity`,
- las migraciones de `categorias.orden` y `motor_quiz` sobre bases viejas,
- etiquetas libres de publicaciones,
- configuración global del banner del feed.
"""

import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.routes.activities import get_activity
from api.routes.settings import get_feed_banner, update_feed_banner
from api.routes.tags import create_tag, set_publication_tags
from api.services.publications import listar_publicaciones
from api.services.sessions import crear_sesion
from api.services.tags import asignar_etiquetas, crear_etiqueta, listar_etiquetas


class _Handler:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}"}
        self.client_address = ("127.0.0.1", 0)


class _BaseSprint2(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tempdir.name, "sprint2.db")
        os.environ["DB_PATH"] = self.db_path
        init_db(self.db_path)

        conn = get_db()
        try:
            self.admin_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol) "
                "VALUES ('S2_ADMIN', 'Admin', 'unused', 'administrador')"
            ).lastrowid
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol) "
                "VALUES ('S2_DOC', 'Docente', 'unused', 'docente')"
            ).lastrowid
            self.student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol) "
                "VALUES ('S2_EST', 'Estudiante', 'unused', 'estudiante')"
            ).lastrowid
            self.cat_id = conn.execute(
                "INSERT INTO categorias (nombre, slug, area, orden) "
                "VALUES ('Pubertad', 'pubertad', 'pubertad', 1)"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

        self.admin_token = "s2-admin-token"
        self.doc_token = "s2-doc-token"
        self.student_token = "s2-est-token"
        crear_sesion(self.admin_id, self.admin_token)
        crear_sesion(self.docente_id, self.doc_token)
        crear_sesion(self.student_id, self.student_token)

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def _crear_publicacion(self, slug="post-1", titulo="Post 1"):
        conn = get_db()
        try:
            pub_id = conn.execute(
                "INSERT INTO publicaciones (autor_id, titulo, slug, contenido, categoria_id, "
                "estado, visibilidad, fecha_publicacion) "
                "VALUES (?, ?, ?, 'contenido', ?, 'aprobada', 'publica', '2024-01-01')",
                (self.docente_id, titulo, slug, self.cat_id),
            ).lastrowid
            conn.commit()
            return pub_id
        finally:
            conn.close()


class MotorQuizFlagTests(_BaseSprint2):
    def _crear_actividad_legacy(self):
        conn = get_db()
        try:
            act_id = conn.execute(
                "INSERT INTO actividades (titulo, area, categoria_id, tipo, dificultad, activa) "
                "VALUES ('Legacy', 'pubertad', ?, 'quiz', 'basica', 1)",
                (self.cat_id,),
            ).lastrowid
            conn.execute(
                "INSERT INTO preguntas (actividad_id, orden, tipo, enunciado, opciones, "
                "respuesta_correcta, puntaje) "
                "VALUES (?, 1, 'opcion_multiple', '¿Cuál?', ?, 'a', 1)",
                (act_id, json.dumps(["a", "b"])),
            )
            conn.commit()
            return act_id
        finally:
            conn.close()

    def test_una_actividad_nace_legacy_por_defecto(self):
        act_id = self._crear_actividad_legacy()
        conn = get_db()
        try:
            motor = conn.execute(
                "SELECT motor_quiz FROM actividades WHERE id = ?", (act_id,)
            ).fetchone()[0]
        finally:
            conn.close()
        self.assertEqual(motor, "legacy")

    def test_get_activity_de_una_legacy_devuelve_sus_preguntas(self):
        act_id = self._crear_actividad_legacy()
        actividad = get_activity(_Handler(self.student_token), {"id": str(act_id)}, {}, {})
        self.assertEqual(len(actividad["preguntas"]), 1)
        # Sin fila en `quizzes`, nunca debe aparecer la forma del motor unificado.
        self.assertNotIn("quiz", actividad)
        self.assertNotIn("items", actividad)

    def test_un_estudiante_no_ve_la_respuesta_correcta_de_una_legacy(self):
        act_id = self._crear_actividad_legacy()
        actividad = get_activity(_Handler(self.student_token), {"id": str(act_id)}, {}, {})
        self.assertNotIn("respuesta_correcta", actividad["preguntas"][0])

    def test_crear_quiz_marca_la_actividad_como_unificada(self):
        from api.routes.quizzes import create_quiz
        creado = create_quiz(_Handler(self.doc_token), {}, {}, {
            "titulo": "Quiz nuevo", "area": "pubertad", "estado": "borrador",
            "items": [{"type": "true_false", "prompt": "¿Cierto?", "answer": True}],
        })
        actividad_id = creado["actividad_id"] if isinstance(creado, dict) else creado[0]["actividad_id"]
        conn = get_db()
        try:
            motor = conn.execute(
                "SELECT motor_quiz FROM actividades WHERE id = ?", (actividad_id,)
            ).fetchone()[0]
        finally:
            conn.close()
        self.assertEqual(motor, "unificado")

    def test_un_quiz_en_borrador_da_404_al_estudiante(self):
        from api.routes.quizzes import create_quiz
        creado = create_quiz(_Handler(self.doc_token), {}, {}, {
            "titulo": "Borrador", "area": "pubertad", "estado": "borrador",
            "items": [{"type": "true_false", "prompt": "¿Cierto?", "answer": True}],
        })
        actividad_id = creado["actividad_id"] if isinstance(creado, dict) else creado[0]["actividad_id"]
        respuesta = get_activity(_Handler(self.student_token), {"id": str(actividad_id)}, {}, {})
        self.assertEqual(respuesta[1], 404)


class MigracionesTests(unittest.TestCase):
    """Bases creadas antes del Sprint 2 deben migrar sin perder filas."""

    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tempdir.name, "vieja.db")
        repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        esquema_viejo = subprocess.run(
            ["git", "show", "HEAD:schema.sql"], cwd=repo_root,
            capture_output=True, text=True, check=True,
        ).stdout

        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.executescript(esquema_viejo)
        conn.execute(
            "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol) "
            "VALUES ('MIG_DOC', 'Docente', 'x', 'docente')"
        )
        uid = conn.execute("SELECT id FROM usuarios WHERE codigo = 'MIG_DOC'").fetchone()[0]
        conn.execute("INSERT INTO categorias (nombre, slug, area) VALUES ('Uno', 'uno', 'pubertad')")
        conn.execute("INSERT INTO categorias (nombre, slug, area) VALUES ('Dos', 'dos', 'embarazo')")
        conn.execute(
            "INSERT INTO actividades (titulo, area, tipo, dificultad) "
            "VALUES ('Legacy', 'pubertad', 'quiz', 'basica')"
        )
        conn.execute(
            "INSERT INTO actividades (titulo, area, tipo, dificultad) "
            "VALUES ('Unificada', 'pubertad', 'interactive_quiz', 'basica')"
        )
        act_unificada = conn.execute(
            "SELECT id FROM actividades WHERE titulo = 'Unificada'"
        ).fetchone()[0]
        conn.execute(
            "INSERT INTO quizzes (actividad_id, version_actual, estado, configuracion, creado_por) "
            "VALUES (?, 1, 'publicado', '{}', ?)",
            (act_unificada, uid),
        )
        conn.commit()
        conn.close()
        os.environ["DB_PATH"] = self.db_path

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def test_migracion_rellena_orden_y_motor_sin_perder_filas(self):
        init_db(self.db_path)
        conn = get_db()
        try:
            categorias = conn.execute("SELECT id, orden FROM categorias ORDER BY id").fetchall()
            actividades = conn.execute(
                "SELECT titulo, motor_quiz FROM actividades ORDER BY id"
            ).fetchall()
        finally:
            conn.close()
        self.assertEqual([tuple(c) for c in categorias], [(1, 1), (2, 2)])
        self.assertEqual(
            {a["titulo"]: a["motor_quiz"] for a in actividades},
            {"Legacy": "legacy", "Unificada": "unificado"},
        )

    def test_la_migracion_es_idempotente(self):
        init_db(self.db_path)
        init_db(self.db_path)
        conn = get_db()
        try:
            total = conn.execute("SELECT COUNT(*) FROM categorias").fetchone()[0]
        finally:
            conn.close()
        self.assertEqual(total, 2)


class EtiquetasTests(_BaseSprint2):
    def test_crear_etiqueta_es_idempotente_sin_distinguir_mayusculas(self):
        primera = crear_etiqueta("Laboratorio")
        segunda = crear_etiqueta("laboratorio")
        self.assertEqual(primera["id"], segunda["id"])
        self.assertEqual(len(listar_etiquetas()), 1)

    def test_asignar_etiquetas_reemplaza_el_conjunto_anterior(self):
        pub_id = self._crear_publicacion()
        asignar_etiquetas(pub_id, ["Laboratorio", "Refuerzo"])
        asignar_etiquetas(pub_id, ["Refuerzo"])
        publicacion = listar_publicaciones()[0]
        self.assertEqual([e["nombre"] for e in publicacion["etiquetas"]], ["Refuerzo"])

    def test_el_feed_devuelve_las_etiquetas_de_cada_publicacion(self):
        pub_id = self._crear_publicacion()
        asignar_etiquetas(pub_id, ["Grupo 10B"])
        publicacion = listar_publicaciones()[0]
        self.assertEqual([e["nombre"] for e in publicacion["etiquetas"]], ["Grupo 10B"])

    def test_una_publicacion_sin_etiquetas_devuelve_lista_vacia(self):
        self._crear_publicacion()
        self.assertEqual(listar_publicaciones()[0]["etiquetas"], [])

    def test_un_estudiante_no_puede_crear_etiquetas_del_catalogo(self):
        respuesta = create_tag(_Handler(self.student_token), {}, {}, {"nombre": "Mia"})
        self.assertEqual(respuesta[1], 403)

    def test_un_estudiante_no_puede_etiquetar_publicaciones_ajenas(self):
        pub_id = self._crear_publicacion()
        respuesta = set_publication_tags(
            _Handler(self.student_token), {"id": str(pub_id)}, {}, {"etiquetas": ["Suya"]}
        )
        self.assertEqual(respuesta[1], 403)

    def test_un_nombre_vacio_es_rechazado(self):
        respuesta = create_tag(_Handler(self.doc_token), {}, {}, {"nombre": "   "})
        self.assertEqual(respuesta[1], 400)


class BannerFeedTests(_BaseSprint2):
    def test_sin_configurar_devuelve_el_banner_apagado(self):
        banner = get_feed_banner(_Handler(self.student_token), {}, {}, {})
        self.assertEqual(banner, {"image_url": None, "active": False})

    def test_un_admin_puede_guardar_y_activar_el_banner(self):
        handler = _Handler(self.admin_token)
        update_feed_banner(handler, {}, {}, {"image_url": "/uploads/banner.jpg"})
        actualizado = update_feed_banner(handler, {}, {}, {"active": True})
        self.assertEqual(actualizado, {"image_url": "/uploads/banner.jpg", "active": True})
        # Y queda visible para cualquiera que abra el feed.
        self.assertTrue(get_feed_banner(_Handler(self.student_token), {}, {}, {})["active"])

    def test_activar_no_borra_la_imagen_ya_guardada(self):
        handler = _Handler(self.admin_token)
        update_feed_banner(handler, {}, {}, {"image_url": "/uploads/banner.jpg", "active": True})
        actualizado = update_feed_banner(handler, {}, {}, {"active": False})
        self.assertEqual(actualizado["image_url"], "/uploads/banner.jpg")

    def test_un_docente_no_puede_cambiar_el_banner(self):
        respuesta = update_feed_banner(_Handler(self.doc_token), {}, {}, {"active": True})
        self.assertEqual(respuesta[1], 403)


if __name__ == "__main__":
    unittest.main(verbosity=2)
