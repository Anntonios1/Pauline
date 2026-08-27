"""Pruebas del desbloqueo secuencial de "Mi Ruta".

El estado de cada paso (LOCKED/AVAILABLE/IN_PROGRESS/COMPLETED) se calcula
en el servidor a partir de `intentos` y `eventos_aprendizaje`; aquí se
verifica esa secuencia, además del CRUD de pasos y sus permisos.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.routes.learning_path import (
    get_learning_path, list_route_steps, create_route_step,
    update_route_step, delete_route_step, reorder_route_steps,
)
from api.services.activities import crear_intento
from api.services.learning_path import crear_paso_ruta, obtener_ruta_estudiante
from api.services.sessions import crear_sesion


class _Handler:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}"}
        self.client_address = ("127.0.0.1", 0)


class LearningPathTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tempdir.name, "ruta-tests.db")
        os.environ["DB_PATH"] = self.db_path
        init_db(self.db_path)

        conn = get_db()
        try:
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol) "
                "VALUES ('RUTA_DOC', 'Docente Ruta', 'unused', 'docente')"
            ).lastrowid
            self.student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol) "
                "VALUES ('RUTA_EST', 'Estudiante Ruta', 'unused', 'estudiante')"
            ).lastrowid

            # Dos módulos con orden explícito: la secuencia cruza de uno a otro.
            self.cat_uno = conn.execute(
                "INSERT INTO categorias (nombre, slug, area, orden) "
                "VALUES ('Modulo Uno', 'modulo-uno', 'pubertad', 1)"
            ).lastrowid
            self.cat_dos = conn.execute(
                "INSERT INTO categorias (nombre, slug, area, orden) "
                "VALUES ('Modulo Dos', 'modulo-dos', 'embarazo', 2)"
            ).lastrowid

            self.pub_id = conn.execute(
                "INSERT INTO publicaciones (autor_id, titulo, slug, contenido, categoria_id, "
                "estado, visibilidad, fecha_publicacion) "
                "VALUES (?, 'Lectura 1', 'lectura-1', 'contenido', ?, 'aprobada', 'publica', '2024-01-01')",
                (self.docente_id, self.cat_uno),
            ).lastrowid
            self.act_id = conn.execute(
                "INSERT INTO actividades (titulo, area, categoria_id, tipo, dificultad, motor_quiz, activa) "
                "VALUES ('Actividad 1', 'pubertad', ?, 'quiz', 'basica', 'unificado', 1)",
                (self.cat_uno,),
            ).lastrowid
            self.act_dos_id = conn.execute(
                "INSERT INTO actividades (titulo, area, categoria_id, tipo, dificultad, motor_quiz, activa) "
                "VALUES ('Actividad 2', 'embarazo', ?, 'quiz', 'basica', 'unificado', 1)",
                (self.cat_dos,),
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

        self.doc_token = "doc-ruta-token"
        self.student_token = "est-ruta-token"
        crear_sesion(self.docente_id, self.doc_token)
        crear_sesion(self.student_id, self.student_token)

        self.paso_lectura = crear_paso_ruta(
            {"categoria_id": self.cat_uno, "tipo_paso": "publicacion", "publicacion_id": self.pub_id},
            self.docente_id,
        )
        self.paso_actividad = crear_paso_ruta(
            {"categoria_id": self.cat_uno, "tipo_paso": "actividad", "actividad_id": self.act_id},
            self.docente_id,
        )
        self.paso_modulo_dos = crear_paso_ruta(
            {"categoria_id": self.cat_dos, "tipo_paso": "actividad", "actividad_id": self.act_dos_id},
            self.docente_id,
        )

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def _estados(self):
        """{id de paso: estado} aplanando todos los módulos."""
        ruta = obtener_ruta_estudiante(self.student_id)
        return {paso["id"]: paso["estado"] for modulo in ruta for paso in modulo["pasos"]}

    def _marcar_leida(self, publicacion_id):
        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO eventos_aprendizaje (actor_id, verbo, objeto_tipo, objeto_id) "
                "VALUES (?, 'leyo', 'publicacion', ?)",
                (self.student_id, publicacion_id),
            )
            conn.commit()
        finally:
            conn.close()

    def _completar_intento(self, intento_id):
        conn = get_db()
        try:
            conn.execute("UPDATE intentos SET estado = 'completado' WHERE id = ?", (intento_id,))
            conn.commit()
        finally:
            conn.close()

    def test_solo_el_primer_paso_esta_disponible_al_empezar(self):
        estados = self._estados()
        self.assertEqual(estados[self.paso_lectura["id"]], "AVAILABLE")
        self.assertEqual(estados[self.paso_actividad["id"]], "LOCKED")
        self.assertEqual(estados[self.paso_modulo_dos["id"]], "LOCKED")

    def test_leer_la_publicacion_desbloquea_el_siguiente_paso(self):
        self._marcar_leida(self.pub_id)
        estados = self._estados()
        self.assertEqual(estados[self.paso_lectura["id"]], "COMPLETED")
        self.assertEqual(estados[self.paso_actividad["id"]], "AVAILABLE")
        self.assertEqual(estados[self.paso_modulo_dos["id"]], "LOCKED")

    def test_un_intento_abierto_marca_el_paso_en_progreso(self):
        self._marcar_leida(self.pub_id)
        crear_intento(self.student_id, self.act_id)
        self.assertEqual(self._estados()[self.paso_actividad["id"]], "IN_PROGRESS")

    def test_completar_desbloquea_incluso_cruzando_de_modulo(self):
        self._marcar_leida(self.pub_id)
        intento = crear_intento(self.student_id, self.act_id)
        self._completar_intento(intento["id"])
        estados = self._estados()
        self.assertEqual(estados[self.paso_actividad["id"]], "COMPLETED")
        self.assertEqual(estados[self.paso_modulo_dos["id"]], "AVAILABLE")

    def test_cualquier_intento_completado_cuenta_sin_importar_el_puntaje(self):
        """Criterio de producto: se avanza al terminar, no al sacar 100%."""
        self._marcar_leida(self.pub_id)
        intento = crear_intento(self.student_id, self.act_id)
        conn = get_db()
        try:
            conn.execute(
                "UPDATE intentos SET estado = 'completado', porcentaje = 20 WHERE id = ?",
                (intento["id"],),
            )
            conn.commit()
        finally:
            conn.close()
        self.assertEqual(self._estados()[self.paso_actividad["id"]], "COMPLETED")

    def test_un_paso_opcional_no_bloquea_el_resto(self):
        update_route_step(
            _Handler(self.doc_token), {"id": str(self.paso_lectura["id"])}, {}, {"obligatorio": False}
        )
        estados = self._estados()
        # La lectura opcional sigue sin completar, pero la actividad ya avanza.
        self.assertEqual(estados[self.paso_lectura["id"]], "AVAILABLE")
        self.assertEqual(estados[self.paso_actividad["id"]], "AVAILABLE")
        self.assertEqual(estados[self.paso_modulo_dos["id"]], "LOCKED")

    def test_el_progreso_por_modulo_cuenta_los_pasos_completados(self):
        self._marcar_leida(self.pub_id)
        ruta = obtener_ruta_estudiante(self.student_id)
        modulo_uno = next(m for m in ruta if m["id"] == self.cat_uno)
        self.assertEqual(modulo_uno["progreso"], {"completados": 1, "total": 2})

    def test_learning_path_exige_autenticacion(self):
        respuesta = get_learning_path(_Handler("token-invalido"), {}, {}, {})
        self.assertEqual(respuesta[1], 401)

    def test_un_estudiante_no_puede_gestionar_pasos(self):
        handler = _Handler(self.student_token)
        self.assertEqual(list_route_steps(handler, {}, {}, {})[1], 403)
        self.assertEqual(create_route_step(handler, {}, {}, {})[1], 403)
        self.assertEqual(
            delete_route_step(handler, {"id": str(self.paso_lectura["id"])}, {}, {})[1], 403
        )

    def test_reordenar_reescribe_el_orden_del_modulo(self):
        handler = _Handler(self.doc_token)
        resultado = reorder_route_steps(handler, {}, {}, {
            "categoria_id": self.cat_uno,
            "ordered_ids": [self.paso_actividad["id"], self.paso_lectura["id"]],
        })
        por_id = {p["id"]: p["orden"] for p in resultado}
        self.assertEqual(por_id[self.paso_actividad["id"]], 1)
        self.assertEqual(por_id[self.paso_lectura["id"]], 2)
        # Y el desbloqueo respeta el orden nuevo: ahora manda la actividad.
        estados = self._estados()
        self.assertEqual(estados[self.paso_actividad["id"]], "AVAILABLE")
        self.assertEqual(estados[self.paso_lectura["id"]], "LOCKED")

    def test_reordenar_rechaza_una_lista_incompleta(self):
        respuesta = reorder_route_steps(_Handler(self.doc_token), {}, {}, {
            "categoria_id": self.cat_uno,
            "ordered_ids": [self.paso_lectura["id"]],
        })
        self.assertEqual(respuesta[1], 400)

    def test_un_paso_inactivo_no_aparece_en_la_ruta_del_estudiante(self):
        update_route_step(
            _Handler(self.doc_token), {"id": str(self.paso_actividad["id"])}, {}, {"activo": False}
        )
        self.assertNotIn(self.paso_actividad["id"], self._estados())

    def test_no_se_puede_agregar_contenido_inexistente(self):
        respuesta = create_route_step(_Handler(self.doc_token), {}, {}, {
            "categoria_id": self.cat_uno, "tipo_paso": "actividad", "actividad_id": 99999,
        })
        self.assertEqual(respuesta[1], 400)


if __name__ == "__main__":
    unittest.main(verbosity=2)
