"""Foto de perfil: docentes y estudiantes pueden subirla, y se guarda cifrada.

Verifica el flujo completo: subida -> archivo en disco no es una imagen válida
(está cifrado) -> servirla la descifra y devuelve bytes/mime correctos -> un
archivo corrupto no rompe el servidor, solo responde 404.
"""

import os
import sys
import tempfile
import unittest
from io import BytesIO
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from PIL import Image

from api.database.connection import get_db, init_db
from api.routes.users import upload_avatar
from api.services.sessions import crear_sesion
from api.services.users import obtener_usuario_por_id
from api.utils.helpers import decrypt_bytes, encrypt_bytes
from api.utils.upload import AVATAR_EXTENSION, decrypt_avatar, serve_upload


class _Handler:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}"}
        self.client_address = ("127.0.0.1", 0)


def _fake_jpeg_bytes(color=(200, 50, 50), size=(300, 300)):
    buffer = BytesIO()
    Image.new("RGB", size, color).save(buffer, "JPEG")
    return buffer.getvalue()


class AvatarEncryptionTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = os.environ.get("DB_PATH")
        self.db_tempdir = tempfile.TemporaryDirectory()
        os.environ["DB_PATH"] = os.path.join(self.db_tempdir.name, "avatar-tests.db")
        init_db(os.environ["DB_PATH"])

        # Aísla los archivos subidos del uploads/ real del repo.
        self.upload_tempdir = tempfile.TemporaryDirectory()
        self.upload_dir_patcher = patch("api.utils.upload.UPLOAD_DIR", self.upload_tempdir.name)
        self.upload_dir_patcher.start()

        conn = get_db()
        try:
            self.docente_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('AV_DOC', 'Docente Avatar', 'unused', 'docente')"
            ).lastrowid
            self.student_id = conn.execute(
                "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol)"
                " VALUES ('AV_EST', 'Estudiante Avatar', 'unused', 'estudiante')"
            ).lastrowid
            conn.commit()
        finally:
            conn.close()
        self.doc_token = "avatar-doc-token"
        self.student_token = "avatar-student-token"
        crear_sesion(self.docente_id, self.doc_token)
        crear_sesion(self.student_id, self.student_token)

    def tearDown(self):
        self.upload_dir_patcher.stop()
        self.upload_tempdir.cleanup()
        if self.previous_db is None:
            os.environ.pop("DB_PATH", None)
        else:
            os.environ["DB_PATH"] = self.previous_db
        self.db_tempdir.cleanup()

    def _subir_avatar(self, token, usuario_id):
        resultado = upload_avatar(
            _Handler(token), {}, {},
            {"avatar": {"data": _fake_jpeg_bytes(), "mime_type": "image/jpeg", "filename": "foto.jpg"}},
        )
        self.assertIn("imagen_perfil", resultado)
        path = resultado["imagen_perfil"]
        self.assertTrue(path.startswith("/uploads/"))
        self.assertTrue(path.endswith(AVATAR_EXTENSION))
        # Se persiste en el usuario, no solo en la respuesta.
        self.assertEqual(obtener_usuario_por_id(usuario_id)["imagen_perfil"], path)
        return path

    def test_docente_puede_subir_foto_de_perfil(self):
        self._subir_avatar(self.doc_token, self.docente_id)

    def test_estudiante_puede_subir_foto_de_perfil(self):
        self._subir_avatar(self.student_token, self.student_id)

    def test_archivo_en_disco_no_es_una_imagen_legible(self):
        """El punto central del pedido: la foto está cifrada, no en claro."""
        path = self._subir_avatar(self.student_token, self.student_id)
        filename = path.rsplit("/", 1)[-1]
        filepath = os.path.join(self.upload_tempdir.name, filename)
        with open(filepath, "rb") as f:
            raw_bytes = f.read()
        # Ni PIL puede abrirlo, ni la firma JPEG (FF D8) aparece al inicio.
        with self.assertRaises(Exception):
            Image.open(BytesIO(raw_bytes)).load()
        self.assertFalse(raw_bytes.startswith(b"\xff\xd8"))

    def test_servir_la_foto_la_descifra_correctamente(self):
        path = self._subir_avatar(self.doc_token, self.docente_id)
        data, mime = serve_upload(path)
        self.assertEqual(mime, "image/jpeg")
        # Los bytes devueltos sí son una imagen JPEG válida y decodificable.
        img = Image.open(BytesIO(data))
        img.load()
        self.assertEqual(img.format, "JPEG")

    def test_archivo_avatar_corrupto_devuelve_404_no_500(self):
        path = self._subir_avatar(self.student_token, self.student_id)
        filename = path.rsplit("/", 1)[-1]
        filepath = os.path.join(self.upload_tempdir.name, filename)
        with open(filepath, "r+b") as f:
            f.seek(0)
            f.write(b"\x00" * 20)  # Corrompe el nonce/ciphertext.
        data, mime = serve_upload(path)
        self.assertIsNone(data)
        self.assertIsNone(mime)

    def test_decrypt_avatar_con_blob_invalido_no_lanza(self):
        data, mime = decrypt_avatar(b"esto-no-es-un-blob-cifrado-valido")
        self.assertIsNone(data)
        self.assertIsNone(mime)

    def test_aad_separa_el_contexto_de_cifrado(self):
        """encrypt_bytes/decrypt_bytes: un blob cifrado con un aad no descifra con otro."""
        blob = encrypt_bytes(b"contenido secreto", aad=b"avatar-perfil")
        self.assertEqual(decrypt_bytes(blob, aad=b"avatar-perfil"), b"contenido secreto")
        self.assertIsNone(decrypt_bytes(blob, aad=b"otro-contexto"))

    def test_sin_token_no_se_puede_subir_avatar(self):
        resultado = upload_avatar(
            _Handler(""), {}, {},
            {"avatar": {"data": _fake_jpeg_bytes(), "mime_type": "image/jpeg", "filename": "foto.jpg"}},
        )
        self.assertEqual(resultado[1], 401)

    def test_tipo_no_permitido_es_rechazado(self):
        resultado = upload_avatar(
            _Handler(self.student_token), {}, {},
            {"avatar": {"data": b"no soy una imagen", "mime_type": "image/gif", "filename": "foto.gif"}},
        )
        self.assertEqual(resultado[1], 400)


if __name__ == "__main__":
    unittest.main()
