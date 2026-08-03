"""Descarga parcial (HTTP Range) de /uploads y clasificación de embeds.

El seek de <video> en el navegador depende de que el servidor responda 206 a
peticiones Range: sin eso, arrastrar la barra de progreso no funciona y el
archivo entero se carga en memoria por cada petición. Aquí se fija ese contrato
y la clasificación de enlaces que decide cómo se incrusta cada uno.
"""

import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.services.quizzes import QuizValidationError, _embed_kind, _validate_embed_url
from api.utils import upload as upload_module
from api.utils.upload import _parse_range


class ParseRangeTests(unittest.TestCase):
    """`bytes=inicio-fin` en todas sus formas; None = servir entero."""

    def test_rango_normal(self):
        self.assertEqual(_parse_range("bytes=0-99", 1000), (0, 99))
        self.assertEqual(_parse_range("bytes=500-999", 1000), (500, 999))

    def test_sin_fin_llega_al_final(self):
        self.assertEqual(_parse_range("bytes=900-", 1000), (900, 999))

    def test_sufijo_devuelve_los_ultimos_bytes(self):
        self.assertEqual(_parse_range("bytes=-100", 1000), (900, 999))
        # Un sufijo mayor que el archivo se recorta al archivo completo.
        self.assertEqual(_parse_range("bytes=-5000", 1000), (0, 999))

    def test_fin_se_recorta_al_tamano(self):
        self.assertEqual(_parse_range("bytes=0-99999", 1000), (0, 999))

    def test_entradas_invalidas_sirven_el_archivo_entero(self):
        for header in (
            None, "", "bytes=abc-def", "items=0-99", "bytes=0-99,200-299",
            "bytes=500-100",   # inicio > fin
            "bytes=1000-1500",  # empieza fuera del archivo
            "bytes=0",          # sin guion
        ):
            self.assertIsNone(_parse_range(header, 1000), header)

    def test_archivo_vacio(self):
        self.assertIsNone(_parse_range("bytes=0-10", 0))


class OpenUploadStreamTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.contenido = bytes(range(256)) * 40  # 10240 bytes
        with open(os.path.join(self.tempdir.name, "clip.mp4"), "wb") as f:
            f.write(self.contenido)
        # UPLOAD_DIR no es configurable por entorno: hay que parchearlo.
        patcher = patch.object(upload_module, "UPLOAD_DIR", self.tempdir.name)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _leer(self, range_header=None):
        resultado = upload_module.open_upload_stream("/uploads/clip.mp4", range_header)
        self.assertIsNotNone(resultado)
        bloques, mime, size, inicio, fin = resultado
        return b"".join(bloques), mime, size, inicio, fin

    def test_sin_range_devuelve_todo(self):
        data, mime, size, inicio, fin = self._leer()
        self.assertEqual(data, self.contenido)
        self.assertEqual((mime, size, inicio, fin), ("video/mp4", 10240, 0, 10239))

    def test_range_devuelve_exactamente_ese_tramo(self):
        data, _, size, inicio, fin = self._leer("bytes=100-199")
        self.assertEqual(data, self.contenido[100:200])
        self.assertEqual((len(data), size, inicio, fin), (100, 10240, 100, 199))

    def test_tramo_mayor_que_un_bloque(self):
        # Cruza el límite de CHUNK_SIZE para comprobar que no se pierde nada.
        data, _, _, _, _ = self._leer(f"bytes=0-{upload_module.CHUNK_SIZE + 500}")
        self.assertEqual(data, self.contenido)  # el archivo es menor: se recorta

    def test_archivo_inexistente(self):
        self.assertIsNone(upload_module.open_upload_stream("/uploads/nope.mp4"))

    def test_no_escapa_del_directorio(self):
        self.assertIsNone(upload_module.open_upload_stream("/uploads/../../secreto.txt"))


class EmbedClassificationTests(unittest.TestCase):
    def test_archivo_de_video_de_cualquier_dominio(self):
        for url in (
            "https://cdn.cualquiera.com/clase.mp4",
            "https://ejemplo.org/a/b/video.webm",
            "https://x.io/v.mp4?token=abc",
        ):
            self.assertEqual(_embed_kind(url), "video", url)

    def test_plataformas_conocidas(self):
        for url in (
            "https://wordwall.net/embed/123",
            "https://www.youtube.com/embed/abc",
            "https://player.vimeo.com/video/9",
        ):
            self.assertEqual(_embed_kind(url), "trusted", url)

    def test_cualquier_otra_pagina_es_externa(self):
        self.assertEqual(_embed_kind("https://sitio-random.com/juego"), "external")

    def test_un_dominio_que_solo_termina_parecido_no_es_de_confianza(self):
        # "malwordwall.net" no debe colarse como "wordwall.net".
        self.assertEqual(_embed_kind("https://malwordwall.net/x"), "external")

    def test_https_obligatorio(self):
        with self.assertRaises(QuizValidationError):
            _validate_embed_url("http://wordwall.net/embed/1", "campo")
        with self.assertRaises(QuizValidationError):
            _validate_embed_url("javascript:alert(1)", "campo")
        self.assertEqual(
            _validate_embed_url("https://wordwall.net/embed/1", "campo"),
            "https://wordwall.net/embed/1",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
