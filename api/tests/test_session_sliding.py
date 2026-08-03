"""Sesión deslizante: una persona activa no debe caerse a media clase.

Antes, expira_en se fijaba una sola vez al login y nunca se tocaba de nuevo;
al cumplirse las 24h el token moría sin aviso aunque la persona siguiera
usando la app. Ahora obtener_sesion_por_token() renueva la ventana cuando ya
pasó la mitad. También cubre que TOKEN_EXPIRES_HOURS deje de ser un valor
muerto (token_expires_at() lo ignoraba con un default hardcodeado a 24).
"""

import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, init_db
from api.services.sessions import crear_sesion, obtener_sesion_por_token
from api.utils.helpers import token_expires_at


def _fmt(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


class SlidingSessionTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.tempdir.name, "sliding-session-tests.db")
        init_db(os.environ["DB_PATH"])
        conn = get_db()
        try:
            self.usuario_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('SLIDE_EST', 'Estudiante Sliding', 'unused', 'estudiante')"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()

    def tearDown(self):
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.tempdir.cleanup()

    def _forzar_expira_en(self, sesion_id, expira_en):
        # La tabla exige expira_en >= creada_en; para simular una sesión vieja
        # hay que retrasar también creada_en, si no el UPDATE viola el CHECK.
        conn = get_db()
        try:
            creada_en = _fmt(datetime.fromisoformat(expira_en.replace("Z", "+00:00")) - timedelta(days=1))
            conn.execute(
                "UPDATE sesiones SET creada_en = ?, expira_en = ? WHERE id = ?",
                (creada_en, expira_en, sesion_id),
            )
            conn.commit()
        finally:
            conn.close()

    def test_token_expires_at_respeta_settings_no_hardcodea_24(self):
        # Antes: token_expires_at() ignoraba el argumento faltante y siempre
        # sumaba 24h fijas sin importar TOKEN_EXPIRES_HOURS.
        antes = datetime.now(timezone.utc)
        resultado = datetime.fromisoformat(token_expires_at(hours=2).replace("Z", "+00:00"))
        delta = resultado - antes
        self.assertLess(abs(delta - timedelta(hours=2)), timedelta(seconds=5))

    def test_sesion_a_punto_de_expirar_se_renueva(self):
        token = "sliding-token-a-punto-de-vencer"
        sesion = crear_sesion(self.usuario_id, token)
        # Simula que ya pasó más de la mitad de la ventana (queda menos de 12h de 24h).
        casi_vencida = _fmt(datetime.now(timezone.utc) + timedelta(hours=1))
        self._forzar_expira_en(sesion["id"], casi_vencida)

        renovada = obtener_sesion_por_token(token)
        self.assertIsNotNone(renovada)
        nueva_expiracion = datetime.fromisoformat(renovada["expira_en"].replace("Z", "+00:00"))
        # Debe haberse extendido bastante más allá de la 1h que le quedaba.
        self.assertGreater(nueva_expiracion, datetime.now(timezone.utc) + timedelta(hours=12))

    def test_sesion_recien_creada_no_se_reescribe_en_cada_peticion(self):
        token = "sliding-token-recien-creado"
        sesion = crear_sesion(self.usuario_id, token)
        expira_original = sesion["expira_en"]

        obtener_sesion_por_token(token)  # primera lectura, de sobra le queda toda la ventana

        conn = get_db()
        try:
            row = conn.execute("SELECT expira_en FROM sesiones WHERE id = ?", (sesion["id"],)).fetchone()
        finally:
            conn.close()
        self.assertEqual(row["expira_en"], expira_original)

    def test_sesion_vencida_no_se_recupera(self):
        token = "sliding-token-ya-vencido"
        sesion = crear_sesion(self.usuario_id, token)
        vencida = _fmt(datetime.now(timezone.utc) - timedelta(minutes=5))
        self._forzar_expira_en(sesion["id"], vencida)
        self.assertIsNone(obtener_sesion_por_token(token))


if __name__ == "__main__":
    unittest.main()
