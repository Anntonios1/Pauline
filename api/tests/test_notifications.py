"""Notificaciones persistentes.

Antes la campana recalculaba todo en vivo cada carga, sin historial ni
"marcar como leído" real. Cubre que se crea una notificación en cada punto
de disparo (moderar publicación/comentario, nueva publicación enviada,
logro desbloqueado) y que solo el dueño puede leerla/marcarla.
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
from api.routes.notifications import list_notifications, mark_all_notifications_read, mark_notification_read
from api.routes.publications import create_publication, moderate_publication
from api.routes.questions import create_question
from api.services.sessions import crear_sesion


class _Handler:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}"}
        self.client_address = ("127.0.0.1", 0)


def _status(resultado):
    return resultado[1] if isinstance(resultado, tuple) else 200


class NotificationTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "notifications-tests.db")
        init_db(os.environ["DB_PATH"])
        conn = get_db()
        try:
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('NOTIF_DOC', 'Docente Notif', 'unused', 'docente')"
            ).lastrowid
            self.student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('NOTIF_EST', 'Estudiante Notif', 'unused', 'estudiante')"
            ).lastrowid
            self.other_student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('NOTIF_EST2', 'Otra Estudiante Notif', 'unused', 'estudiante')"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()
        self.doc_token = "notif-doc-token"
        self.student_token = "notif-student-token"
        self.other_student_token = "notif-other-student-token"
        crear_sesion(self.docente_id, self.doc_token)
        crear_sesion(self.student_id, self.student_token)
        crear_sesion(self.other_student_id, self.other_student_token)

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def _notifs(self, token):
        return list_notifications(_Handler(token), {}, {}, {})

    def test_publicar_enviada_notifica_al_staff_no_al_autor(self):
        antes_doc = len(self._notifs(self.doc_token))
        create_publication(_Handler(self.student_token), {}, {}, {
            "titulo": "Mi aviso", "contenido": "contenido", "estado": "enviada",
        })
        despues_doc = self._notifs(self.doc_token)
        self.assertEqual(len(despues_doc), antes_doc + 1)
        self.assertEqual(despues_doc[0]["tipo"], "publicacion_pendiente")
        # El propio autor no se notifica a sí mismo por enviar su publicación.
        self.assertEqual(len(self._notifs(self.student_token)), 0)

    def test_aprobar_publicacion_notifica_al_autor(self):
        pub = create_publication(_Handler(self.student_token), {}, {}, {
            "titulo": "Aviso a aprobar", "contenido": "contenido", "estado": "enviada",
        })
        moderate_publication(_Handler(self.doc_token), {"id": str(pub["id"])}, {}, {
            "decision": "aprobar", "estado_nuevo": "aprobada", "observacion": "Bien hecho",
        })
        # Aprobar la publicación también puede desbloquear el logro
        # "primera_publicacion" (una segunda notificación) — se filtra por tipo
        # en vez de asumir que es la única.
        notifs = self._notifs(self.student_token)
        de_publicacion = [n for n in notifs if n["tipo"] == "publicacion_aprobar"]
        self.assertEqual(len(de_publicacion), 1)
        self.assertIn("aprobada", de_publicacion[0]["titulo"].lower())
        self.assertIsNotNone(de_publicacion[0]["enlace"])

    def test_rechazar_publicacion_notifica_sin_enlace(self):
        pub = create_publication(_Handler(self.student_token), {}, {}, {
            "titulo": "Aviso a rechazar", "contenido": "contenido", "estado": "enviada",
        })
        moderate_publication(_Handler(self.doc_token), {"id": str(pub["id"])}, {}, {
            "decision": "rechazar", "estado_nuevo": "rechazada", "observacion": "No aplica",
        })
        notifs = self._notifs(self.student_token)
        self.assertEqual(len(notifs), 1)
        self.assertIsNone(notifs[0]["enlace"])

    def test_moderar_comentario_notifica_al_autor_del_comentario(self):
        pub = create_publication(_Handler(self.doc_token), {}, {}, {
            "titulo": "Lectura aprobada", "contenido": "contenido", "estado": "aprobada",
        })
        comentario = create_comment(_Handler(self.student_token), {}, {}, {
            "publicacion_id": pub["id"], "contenido": "Muy interesante",
        })
        moderate_comment(_Handler(self.doc_token), {"id": str(comentario["id"])}, {}, {"estado": "aprobado"})
        notifs = self._notifs(self.student_token)
        self.assertEqual(len(notifs), 1)
        self.assertEqual(notifs[0]["tipo"], "comentario_aprobado")

    def test_logro_desbloqueado_notifica(self):
        actividad = create_activity(_Handler(self.doc_token), {}, {}, {
            "titulo": "Quiz corto", "area": "autocuidado", "tipo": "quiz",
        })
        create_question(_Handler(self.doc_token), {}, {}, {
            "actividad_id": actividad["id"], "orden": 1, "tipo": "opcion_multiple",
            "enunciado": "¿1+1?", "opciones": '["2","3"]', "respuesta_correcta": "2",
        })
        intento = create_attempt(_Handler(self.student_token), {}, {}, {"actividad_id": actividad["id"]})
        submit_attempt(_Handler(self.student_token), {"id": str(intento["id"])}, {}, {
            "respuestas": [{"pregunta_id": 1, "respuesta": "2"}],
        })
        notifs = self._notifs(self.student_token)
        tipos = [n["tipo"] for n in notifs]
        self.assertIn("logro_desbloqueado", tipos)

    def test_marcar_leida_solo_el_dueno(self):
        create_publication(_Handler(self.student_token), {}, {}, {
            "titulo": "Para marcar", "contenido": "contenido", "estado": "enviada",
        })
        notif_id = self._notifs(self.doc_token)[0]["id"]

        # Otro estudiante no puede marcarla (no le pertenece): 404, no se toca.
        ajena = mark_notification_read(_Handler(self.other_student_token), {"id": str(notif_id)}, {}, {})
        self.assertEqual(_status(ajena), 404)
        self.assertFalse(self._notifs(self.doc_token)[0]["leida"])

        propia = mark_notification_read(_Handler(self.doc_token), {"id": str(notif_id)}, {}, {})
        self.assertEqual(_status(propia), 200)
        self.assertTrue(self._notifs(self.doc_token)[0]["leida"])

    def test_marcar_todas_leidas(self):
        for i in range(3):
            create_publication(_Handler(self.student_token), {}, {}, {
                "titulo": f"Aviso {i}", "contenido": "contenido", "estado": "enviada",
            })
        no_leidas_antes = list_notifications(_Handler(self.doc_token), {}, {"solo_no_leidas": "true"}, {})
        self.assertEqual(len(no_leidas_antes), 3)

        mark_all_notifications_read(_Handler(self.doc_token), {}, {}, {})
        no_leidas_despues = list_notifications(_Handler(self.doc_token), {}, {"solo_no_leidas": "true"}, {})
        self.assertEqual(len(no_leidas_despues), 0)

    def test_sin_token_401(self):
        self.assertEqual(_status(list_notifications(_Handler(""), {}, {}, {})), 401)
        self.assertEqual(_status(mark_notification_read(_Handler(""), {"id": "1"}, {}, {})), 401)


if __name__ == "__main__":
    unittest.main()
