import base64
import hashlib
import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from api.config.settings import SECRET_KEY, TOKEN_EXPIRES_HOURS


# ---------------------------------------------------------------------------
# Clave derivada de SECRET_KEY para AES-256-GCM
# ---------------------------------------------------------------------------
def _get_aes_key() -> bytes:
    """Deriva una clave AES-256 de 32 bytes a partir de SECRET_KEY."""
    return hashlib.sha256(SECRET_KEY.encode("utf-8")).digest()


# ---------------------------------------------------------------------------
# Fechas y utilidades
# ---------------------------------------------------------------------------
def now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def generate_token() -> str:
    """Token seguro de 48 bytes en base64url."""
    return secrets.token_urlsafe(48)


# ---------------------------------------------------------------------------
# Hash de contraseñas con bcrypt
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Genera un hash bcrypt (cost factor 12)."""
    if not password or len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    pw_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(pw_bytes, bcrypt.gensalt(rounds=12))
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verifica una contraseña contra un hash bcrypt."""
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# Sin 0/O/1/l/I: una contraseña temporal se dicta o se escribe a mano en un
# papelito para un estudiante de primaria, y esos caracteres se confunden.
_ALFABETO_PASSWORD_TEMPORAL = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"


def generar_password_temporal(length: int = 10) -> str:
    """Contraseña temporal legible, para que un docente/admin la resetee y se la
    entregue en persona (no hay servicio de correo configurado en este proyecto)."""
    return "".join(secrets.choice(_ALFABETO_PASSWORD_TEMPORAL) for _ in range(length))


# ---------------------------------------------------------------------------
# Hash de tokens para almacenamiento en DB
# ---------------------------------------------------------------------------
def hash_token(token: str) -> str:
    """Hash SHA-256 de un token para búsqueda en DB."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Cifrado AES-256-GCM
# ---------------------------------------------------------------------------
def encrypt_aes(plaintext: str) -> str:
    """Cifra texto con AES-256-GCM. Devuelve base64(nonce + ciphertext + tag)."""
    if not plaintext:
        return ""
    aesgcm = AESGCM(_get_aes_key())
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode("utf-8")


def decrypt_aes(ciphertext_b64: str) -> Optional[str]:
    """Descifra texto cifrado con AES-256-GCM."""
    if not ciphertext_b64:
        return None
    try:
        aesgcm = AESGCM(_get_aes_key())
        combined = base64.b64decode(ciphertext_b64.encode("utf-8"))
        nonce = combined[:12]
        ciphertext = combined[12:]
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")
    except Exception:
        return None


def encrypt_bytes(plaintext: bytes, aad: bytes = b"") -> bytes:
    """Cifra bytes binarios (ej. una foto) con AES-256-GCM.

    `aad` separa el contexto de uso (ej. "avatar") para que un blob cifrado no
    pueda reutilizarse fuera de donde se generó, sin que la clave cambie.
    Devuelve nonce (12 bytes) + ciphertext + tag, listo para escribir a disco.
    """
    aesgcm = AESGCM(_get_aes_key())
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext, aad or None)
    return nonce + ciphertext


def decrypt_bytes(blob: bytes, aad: bytes = b"") -> Optional[bytes]:
    """Descifra un blob generado con encrypt_bytes. None si es inválido o el aad no coincide."""
    if not blob or len(blob) < 13:
        return None
    try:
        aesgcm = AESGCM(_get_aes_key())
        nonce, ciphertext = blob[:12], blob[12:]
        return aesgcm.decrypt(nonce, ciphertext, aad or None)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Validaciones
# ---------------------------------------------------------------------------
def sql_like_term(texto: str) -> str:
    """Prepara un término para `col LIKE ? ESCAPE '\\'`.

    Escapa % y _ (comodines de LIKE) y la propia barra invertida, para que
    buscar "50%" o "mi_archivo" no se interprete como patrón. Sin esto,
    cualquier búsqueda con esos caracteres se comporta de forma sorprendente
    (y en el peor caso, alguien podría forzar un patrón caro con muchos %).
    """
    escapado = texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escapado}%"


def generate_slug(text: str) -> str:
    import unicodedata
    # Normalize unicode: decompose accented chars (á->a, é->e, ñ->n, etc.)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    slug = text.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


# ---------------------------------------------------------------------------
# Lógica de calificación de actividades
# ---------------------------------------------------------------------------
def calcular_intento(preguntas: List[dict], respuestas: List[dict]) -> dict:
    correctas = 0
    puntaje = 0.0
    puntaje_maximo = sum(p.get("puntaje", 1) for p in preguntas)
    respuestas_mapeadas = {r["pregunta_id"]: r["respuesta"] for r in respuestas if r.get("respuesta") is not None}
    detalle = []

    for pregunta in preguntas:
        respuesta = respuestas_mapeadas.get(pregunta["id"])
        es_correcta = respuesta == pregunta["respuesta_correcta"]
        puntaje_pregunta = pregunta.get("puntaje", 1) if es_correcta else 0
        if es_correcta:
            correctas += 1
            puntaje += puntaje_pregunta
        detalle.append({
            "pregunta_id": pregunta["id"],
            "respuesta": respuesta,
            "correcta": 1 if es_correcta else 0,
            "puntaje_obtenido": puntaje_pregunta,
        })

    porcentaje = (puntaje / puntaje_maximo * 100) if puntaje_maximo > 0 else 0
    return {
        "respuestas_correctas": correctas,
        "puntaje": round(puntaje, 2),
        "puntaje_maximo": puntaje_maximo,
        "porcentaje": round(porcentaje, 2),
        "detalle": detalle,
    }


# ---------------------------------------------------------------------------
# Cálculo de expiración
# ---------------------------------------------------------------------------
def token_expires_at(hours: int = None) -> str:
    # El default hardcodeado a 24 ignoraba TOKEN_EXPIRES_HOURS del entorno;
    # esto es lo que crear_sesion() y la renovación deslizante usan en la práctica.
    if hours is None:
        hours = TOKEN_EXPIRES_HOURS
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
