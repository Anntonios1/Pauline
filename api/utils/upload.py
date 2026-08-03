import json
import os
import uuid
from io import BytesIO

from PIL import Image

from api.config.settings import (
    UPLOAD_DIR,
    MAX_UPLOAD_SIZE_BYTES,
    ALLOWED_IMAGE_TYPES,
    MAX_QUIZ_MEDIA_SIZE_BYTES,
    ALLOWED_QUIZ_MEDIA_TYPES,
)


class UploadError(Exception):
    pass


def _ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def _validate_image(file_bytes: bytes, mime_type: str) -> tuple:
    if mime_type not in ALLOWED_IMAGE_TYPES:
        raise UploadError(f"Tipo de imagen no permitido: {mime_type}. Usa: {', '.join(ALLOWED_IMAGE_TYPES.keys())}")

    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise UploadError(f"Archivo demasiado grande. Maximo: {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB")

    img_type = _detect_image_type(file_bytes)
    if img_type not in ("jpeg", "png", "webp"):
        raise UploadError("El contenido no corresponde a una imagen valida")

    return img_type


def _detect_image_type(file_bytes: bytes) -> str:
    """Detecta el formato real de la imagen por su firma usando Pillow."""
    try:
        with Image.open(BytesIO(file_bytes)) as img:
            return (img.format or "").lower()
    except Exception:
        return ""


def _compress_image(file_bytes: bytes, mime_type: str, max_width: int, quality: int) -> tuple:
    """Redimensiona/recomprime una imagen validada. Devuelve (bytes, extension)."""
    try:
        img = Image.open(BytesIO(file_bytes))
        img = img.convert("RGB")

        # Redimensionar si excede el ancho maximo
        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

        ext = ALLOWED_IMAGE_TYPES[mime_type]
        buffer = BytesIO()
        if ext == ".png":
            img.save(buffer, "PNG", optimize=True)
        elif ext == ".webp":
            img.save(buffer, "WEBP", quality=quality, method=6)
        else:
            img.save(buffer, "JPEG", quality=quality, optimize=True)
        return buffer.getvalue(), ext
    except UploadError:
        raise
    except Exception as e:
        raise UploadError(f"Error al procesar la imagen: {str(e)}")


def compress_and_save_image(file_bytes: bytes, mime_type: str, max_width: int = 1200, quality: int = 85) -> str:
    """Comprime una imagen y la guarda en UPLOAD_DIR. Devuelve la ruta relativa."""
    _ensure_upload_dir()
    _validate_image(file_bytes, mime_type)
    compressed, ext = _compress_image(file_bytes, mime_type, max_width, quality)
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(compressed)
    return f"/uploads/{filename}"


# ---------------------------------------------------------------------------
# Fotos de perfil: se guardan cifradas en disco (AES-256-GCM) para que una
# fuga del directorio de uploads o de un backup no exponga las fotos de
# estudiantes y docentes en claro. Se descifran al vuelo al servirlas.
# ---------------------------------------------------------------------------
AVATAR_EXTENSION = ".avatarenc"
_AVATAR_AAD = b"avatar-perfil"


def encrypt_and_save_avatar(file_bytes: bytes, mime_type: str, max_width: int = 400, quality: int = 80) -> str:
    """Comprime, cifra y guarda una foto de perfil. Devuelve la ruta relativa."""
    from api.utils.helpers import encrypt_bytes

    _ensure_upload_dir()
    _validate_image(file_bytes, mime_type)
    compressed, ext = _compress_image(file_bytes, mime_type, max_width, quality)

    header = json.dumps({"mime": mime_type, "ext": ext}).encode("utf-8")
    envelope = len(header).to_bytes(2, "big") + header + compressed
    ciphertext = encrypt_bytes(envelope, aad=_AVATAR_AAD)

    filename = f"{uuid.uuid4().hex}{AVATAR_EXTENSION}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(ciphertext)
    return f"/uploads/{filename}"


def decrypt_avatar(file_bytes: bytes) -> tuple:
    """Descifra una foto de perfil guardada con encrypt_and_save_avatar.

    Devuelve (bytes, mime_type) o (None, None) si el blob no es válido —
    nunca lanza, porque serve_upload debe poder responder 404 sin más.
    """
    from api.utils.helpers import decrypt_bytes

    envelope = decrypt_bytes(file_bytes, aad=_AVATAR_AAD)
    if envelope is None or len(envelope) < 2:
        return None, None
    try:
        header_len = int.from_bytes(envelope[:2], "big")
        header = json.loads(envelope[2:2 + header_len].decode("utf-8"))
        image_bytes = envelope[2 + header_len:]
        return image_bytes, header["mime"]
    except Exception:
        return None, None


def _validate_non_image_media(file_bytes: bytes, mime_type: str) -> None:
    """Validación de firma mínima; no confía únicamente en el MIME del navegador."""
    if mime_type == "audio/mpeg":
        valid = file_bytes.startswith(b"ID3") or (
            len(file_bytes) > 1 and file_bytes[0] == 0xFF and file_bytes[1] & 0xE0 == 0xE0
        )
    elif mime_type in ("audio/wav", "audio/x-wav"):
        valid = file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WAVE"
    elif mime_type == "audio/ogg":
        valid = file_bytes.startswith(b"OggS")
    elif mime_type == "audio/mp4":
        valid = len(file_bytes) >= 12 and file_bytes[4:8] == b"ftyp"
    elif mime_type == "video/mp4":
        valid = len(file_bytes) >= 12 and file_bytes[4:8] == b"ftyp"
    elif mime_type == "video/webm":
        valid = file_bytes.startswith(b"\x1a\x45\xdf\xa3")
    elif mime_type == "application/pdf":
        valid = file_bytes.startswith(b"%PDF-")
    elif mime_type == "text/plain":
        try:
            file_bytes.decode("utf-8")
            valid = True
        except UnicodeDecodeError:
            valid = False
    elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        valid = file_bytes.startswith(b"PK\x03\x04")
    else:
        valid = False
    if not valid:
        raise UploadError("El contenido del archivo no coincide con el tipo declarado")


def save_quiz_media(file_bytes: bytes, mime_type: str, original_filename: str = None) -> dict:
    """Guarda una imagen, audio o archivo seguro para un bloque de quiz."""
    if not isinstance(file_bytes, (bytes, bytearray)) or not file_bytes:
        raise UploadError("El archivo está vacío")
    mime_type = (mime_type or "").lower().split(";", 1)[0].strip()
    if mime_type not in ALLOWED_QUIZ_MEDIA_TYPES:
        raise UploadError("Tipo no permitido. Usa imagen, MP3/WAV/OGG/M4A, PDF, TXT o DOCX")
    if len(file_bytes) > MAX_QUIZ_MEDIA_SIZE_BYTES:
        raise UploadError(
            f"Archivo demasiado grande. Máximo: {MAX_QUIZ_MEDIA_SIZE_BYTES // (1024 * 1024)} MB"
        )
    if mime_type in ALLOWED_IMAGE_TYPES:
        path = compress_and_save_image(bytes(file_bytes), mime_type, max_width=1600, quality=88)
        size = os.path.getsize(os.path.join(UPLOAD_DIR, os.path.basename(path)))
        return {
            "type": "image", "url": path, "filename": original_filename,
            "mime_type": mime_type, "size": size,
        }

    _validate_non_image_media(bytes(file_bytes), mime_type)
    _ensure_upload_dir()
    extension = ALLOWED_QUIZ_MEDIA_TYPES[mime_type]
    filename = f"{uuid.uuid4().hex}{extension}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as output:
        output.write(file_bytes)
    return {
        "type": "audio" if mime_type.startswith("audio/") else ("video" if mime_type.startswith("video/") else "file"),
        "url": f"/uploads/{filename}",
        "filename": original_filename,
        "mime_type": mime_type,
        "size": len(file_bytes),
    }


def serialize_upload_asset(asset: dict) -> dict:
    """Contrato canónico de un asset subido: claves en inglés y en español.

    Todos los endpoints de subida (quiz-media, resource-media) deben devolver
    esta misma forma para que el frontend pueda consumir cualquiera de ellos.
    """
    return {
        **asset,
        "tipo": asset["type"],
        "nombre": asset.get("filename"),
        "archivo_o_url": asset["url"],
    }


def serve_upload(path: str) -> tuple:
    """Devuelve (bytes, mime_type) para un archivo de uploads."""
    safe_path = os.path.basename(path)
    filepath = os.path.join(UPLOAD_DIR, safe_path)
    if not os.path.exists(filepath) or not os.path.isfile(filepath):
        return None, None
    with open(filepath, "rb") as f:
        data = f.read()
    ext = os.path.splitext(filepath)[1].lower()
    if ext == AVATAR_EXTENSION:
        # Las fotos de perfil se guardan cifradas; se descifran solo al servirlas.
        return decrypt_avatar(data)
    mime = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".pdf": "application/pdf",
        ".txt": "text/plain; charset=utf-8",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }.get(ext, "application/octet-stream")
    return data, mime
