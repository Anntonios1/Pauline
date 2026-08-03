import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(BASE_DIR), "blog.db"))
SCHEMA_PATH = os.path.join(os.path.dirname(BASE_DIR), "schema.sql")

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-cambiar-en-produccion")
TOKEN_EXPIRES_HOURS = int(os.environ.get("TOKEN_EXPIRES_HOURS", "24"))

# Un intento que sigue 'iniciado' pasado este tiempo se considera abandonado.
ATTEMPT_ABANDON_AFTER_MINUTES = int(os.environ.get("ATTEMPT_ABANDON_AFTER_MINUTES", "120"))

# Directorio para archivos subidos
UPLOAD_DIR = os.path.join(os.path.dirname(BASE_DIR), "uploads")
MAX_UPLOAD_SIZE_BYTES = int(os.environ.get("MAX_UPLOAD_SIZE_BYTES", str(5 * 1024 * 1024)))  # 5 MB
MAX_QUIZ_MEDIA_SIZE_BYTES = int(os.environ.get("MAX_QUIZ_MEDIA_SIZE_BYTES", str(20 * 1024 * 1024)))
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
ALLOWED_QUIZ_MEDIA_TYPES = {
    **ALLOWED_IMAGE_TYPES,
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

# Rate limiting (aumentado para pruebas locales)
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "300"))
RATE_LIMIT_MAX_ATTEMPTS = int(os.environ.get("RATE_LIMIT_MAX_ATTEMPTS", "30"))
RATE_LIMIT_BLOCK_SECONDS = int(os.environ.get("RATE_LIMIT_BLOCK_SECONDS", "60"))

ALLOWED_AREAS = [
    "cuerpo_humano",
    "pubertad",
    "sistema_reproductor_femenino",
    "sistema_reproductor_masculino",
    "celulas_reproductoras",
    "fecundacion",
    "embarazo",
    "nacimiento",
    "autocuidado",
    "preguntas_frecuentes",
]

ALLOWED_ESTADOS_PUBLICACION = [
    "borrador",
    "enviada",
    "en_revision",
    "requiere_cambios",
    "aprobada",
    "rechazada",
    "archivada",
]
ALLOWED_DIFICULTADES = ["basica", "media", "avanzada"]
ALLOWED_DECISIONES_MODERACION = ["aprobar", "corregir", "rechazar"]

# Personalización visual de una publicación (columna publicaciones.estilo_visual).
# Los valores deben coincidir con las clases .pub-a-* / .pub-p-* del monolito CSS
# en frontend/src/styles/index.css (sección 08).
ALLOWED_PUB_ACENTOS = [
    "turquesa", "violeta", "azul", "coral", "ambar", "esmeralda", "rosa", "indigo",
]
ALLOWED_PUB_PATRONES = ["liso", "puntos", "rejilla", "ondas", "rayos", "confeti"]
