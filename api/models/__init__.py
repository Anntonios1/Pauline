from dataclasses import dataclass
from typing import Optional


@dataclass
class Usuario:
    id: Optional[int] = None
    codigo: str = ""
    correo: Optional[str] = None
    nombre_visible: str = ""
    password_hash: str = ""
    imagen_perfil: Optional[str] = None
    rol: str = "estudiante"
    activo: int = 1
    ultimo_acceso: Optional[str] = None
    fecha_creacion: Optional[str] = None
    fecha_actualizacion: Optional[str] = None


@dataclass
class Curso:
    id: Optional[int] = None
    nombre: str = ""
    grado: int = 5
    jornada: Optional[str] = None
    anio_escolar: int = 2026
    activo: int = 1
    fecha_creacion: Optional[str] = None
    fecha_actualizacion: Optional[str] = None


@dataclass
class Categoria:
    id: Optional[int] = None
    nombre: str = ""
    slug: str = ""
    descripcion: Optional[str] = None
    area: str = ""
    activa: int = 1
    fecha_creacion: Optional[str] = None
    fecha_actualizacion: Optional[str] = None


@dataclass
class Publicacion:
    id: Optional[int] = None
    autor_id: int = 0
    titulo: str = ""
    slug: str = ""
    resumen: Optional[str] = None
    contenido: str = ""
    imagen_portada: Optional[str] = None
    categoria_id: Optional[int] = None
    estado: str = "borrador"
    visibilidad: str = "publica"
    fecha_creacion: Optional[str] = None
    fecha_actualizacion: Optional[str] = None
    fecha_publicacion: Optional[str] = None
    publicado_por: Optional[int] = None
    moderador_id: Optional[int] = None
    eliminado_en: Optional[str] = None
    # JSON con el acento y el patrón de portada elegidos por el autor.
    estilo_visual: str = "{}"


@dataclass
class Actividad:
    id: Optional[int] = None
    titulo: str = ""
    descripcion: Optional[str] = None
    instrucciones: Optional[str] = None
    area: str = ""
    categoria_id: Optional[int] = None
    tipo: str = ""
    dificultad: str = "basica"
    tiempo_limite_segundos: Optional[int] = None
    intentos_maximos: int = 1
    creado_por: Optional[int] = None
    activa: int = 1
    fecha_creacion: Optional[str] = None
    fecha_actualizacion: Optional[str] = None


@dataclass
class Pregunta:
    id: Optional[int] = None
    actividad_id: int = 0
    orden: int = 1
    tipo: str = "opcion_multiple"
    enunciado: str = ""
    opciones: Optional[str] = None
    respuesta_correcta: str = ""
    explicacion: Optional[str] = None
    imagen_url: Optional[str] = None
    puntaje: int = 1
    obligatoria: int = 1


@dataclass
class Recurso:
    id: Optional[int] = None
    titulo: str = ""
    descripcion: Optional[str] = None
    tipo: str = ""
    archivo_o_url: str = ""
    mime_type: Optional[str] = None
    tamano_bytes: Optional[int] = None
    area: Optional[str] = None
    categoria_id: Optional[int] = None
    fuente: Optional[str] = None
    licencia: Optional[str] = None
    estado_aprobacion: str = "pendiente"
    subido_por: Optional[int] = None
    aprobado_por: Optional[int] = None
    fecha_aprobacion: Optional[str] = None
    activo: int = 1
    fecha_creacion: Optional[str] = None
    fecha_actualizacion: Optional[str] = None


@dataclass
class Comentario:
    id: Optional[int] = None
    publicacion_id: int = 0
    autor_id: Optional[int] = None
    comentario_padre_id: Optional[int] = None
    contenido: str = ""
    estado: str = "pendiente"
    moderado_por: Optional[int] = None
    fecha_moderacion: Optional[str] = None
    fecha: Optional[str] = None
    fecha_actualizacion: Optional[str] = None


@dataclass
class EventoAprendizaje:
    id: Optional[int] = None
    evento_id: Optional[str] = None
    actor_id: int = 0
    sesion_id: Optional[int] = None
    verbo: str = ""
    objeto_tipo: str = ""
    objeto_id: int = 0
    resultado: Optional[str] = None
    contexto: Optional[str] = None
    fecha: Optional[str] = None


@dataclass
class Auditoria:
    id: Optional[int] = None
    usuario_id: Optional[int] = None
    accion: str = ""
    entidad: Optional[str] = None
    entidad_id: Optional[int] = None
    elemento_afectado: Optional[str] = None
    datos_anteriores: Optional[str] = None
    datos_nuevos: Optional[str] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    solicitud_id: Optional[str] = None
    fecha: Optional[str] = None
    descripcion: Optional[str] = None


@dataclass
class Inscripcion:
    usuario_id: int = 0
    curso_id: int = 0
    rol_en_curso: str = "estudiante"
    activo: int = 1
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None


@dataclass
class Moderacion:
    id: Optional[int] = None
    publicacion_id: int = 0
    docente_id: int = 0
    estado_anterior: str = ""
    decision: str = ""
    estado_nuevo: str = ""
    observacion: Optional[str] = None
    fecha: Optional[str] = None


__all__ = [
    "Usuario", "Curso", "Categoria", "Publicacion", "Actividad", "Pregunta",
    "Recurso", "Comentario", "EventoAprendizaje", "Auditoria", "Inscripcion",
    "Moderacion",
]
