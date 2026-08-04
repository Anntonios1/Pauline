-- ============================================================
-- schema.sql
-- Blog educativo grado quinto: Reproduccion humana
-- Motor: SQLite 3
--
-- Uso:
--   sqlite3 blog.db < schema.sql
--   (o en Python: conn.executescript(open('schema.sql').read()))
--
-- IMPORTANTE sobre concurrencia:
--   journal_mode=WAL se guarda PERMANENTEMENTE en el archivo .db,
--   con correr este script una vez alcanza.
--   busy_timeout y foreign_keys NO se guardan en el archivo: cada
--   conexion nueva que abra tu aplicacion tiene que volver a ejecutar
--   esos dos PRAGMA al conectarse.
--
-- Todas las fechas se guardan en UTC con formato ISO-8601.
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ------------------------------------------------------------
-- CURSOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cursos (
    id                INTEGER PRIMARY KEY,
    nombre            TEXT NOT NULL,
    grado             INTEGER NOT NULL CHECK (grado BETWEEN 1 AND 11),
    jornada           TEXT,
    anio_escolar      INTEGER CHECK (anio_escolar IS NULL OR anio_escolar BETWEEN 2000 AND 2100),
    activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    fecha_creacion    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (nombre, grado, anio_escolar)
);

CREATE INDEX IF NOT EXISTS idx_cursos_grado  ON cursos(grado);
CREATE INDEX IF NOT EXISTS idx_cursos_activo ON cursos(activo);

-- ------------------------------------------------------------
-- USUARIOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id                INTEGER PRIMARY KEY,
    codigo            TEXT NOT NULL COLLATE NOCASE UNIQUE,
    correo            TEXT COLLATE NOCASE UNIQUE,
    nombre_visible    TEXT NOT NULL,
    password_hash     TEXT NOT NULL,
    imagen_perfil     TEXT,
    rol               TEXT NOT NULL CHECK (rol IN ('estudiante','docente','administrador')),
    activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    ultimo_acceso     TEXT,
    fecha_creacion    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol    ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- ------------------------------------------------------------
-- INSCRIPCIONES
-- Relaciona usuarios con uno o varios cursos y conserva historico.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inscripciones (
    usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    curso_id         INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    rol_en_curso     TEXT NOT NULL CHECK (rol_en_curso IN ('estudiante','docente')),
    activo           INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    fecha_inicio     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_fin        TEXT,
    PRIMARY KEY (usuario_id, curso_id, rol_en_curso),
    CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_inscripciones_curso   ON inscripciones(curso_id, activo);
CREATE INDEX IF NOT EXISTS idx_inscripciones_usuario ON inscripciones(usuario_id, activo);

-- ------------------------------------------------------------
-- SESIONES
-- token_hash: SHA-256 del token para busqueda.
-- token_cifrado: token cifrado con AES-256-GCM para poder invalidarlo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones (
    id             INTEGER PRIMARY KEY,
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash     TEXT NOT NULL UNIQUE,
    token_cifrado  TEXT NOT NULL,
    creada_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    expira_en      TEXT NOT NULL,
    cerrada_en     TEXT,
    ip             TEXT,
    user_agent     TEXT,
    activa         INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0,1)),
    CHECK (expira_en >= creada_en),
    CHECK (cerrada_en IS NULL OR cerrada_en >= creada_en)
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id, activa);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira  ON sesiones(expira_en, activa);

-- ------------------------------------------------------------
-- CATEGORIAS
-- Las categorias ahora corresponden a modulos del tema.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id                  INTEGER PRIMARY KEY,
    nombre              TEXT NOT NULL,
    slug                TEXT NOT NULL COLLATE NOCASE UNIQUE,
    descripcion         TEXT,
    area                TEXT NOT NULL CHECK (area IN (
                         'cuerpo_humano',
                         'pubertad',
                         'sistema_reproductor_femenino',
                         'sistema_reproductor_masculino',
                         'celulas_reproductoras',
                         'fecundacion',
                         'embarazo',
                         'nacimiento',
                         'autocuidado',
                         'preguntas_frecuentes')),
    activa              INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0,1)),
    fecha_creacion      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (nombre, area)
);

CREATE INDEX IF NOT EXISTS idx_categorias_area   ON categorias(area, activa);
CREATE INDEX IF NOT EXISTS idx_categorias_activa ON categorias(activa);

-- ------------------------------------------------------------
-- ETIQUETAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etiquetas (
    id             INTEGER PRIMARY KEY,
    nombre         TEXT NOT NULL COLLATE NOCASE UNIQUE,
    slug           TEXT NOT NULL COLLATE NOCASE UNIQUE,
    fecha_creacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ------------------------------------------------------------
-- PUBLICACIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publicaciones (
    id                  INTEGER PRIMARY KEY,
    autor_id            INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    titulo              TEXT NOT NULL,
    slug                TEXT NOT NULL COLLATE NOCASE UNIQUE,
    resumen             TEXT,
    contenido           TEXT NOT NULL,
    imagen_portada      TEXT,
    categoria_id        INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    estado              TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN
                         ('borrador','enviada','en_revision','requiere_cambios',
                          'aprobada','rechazada','archivada')),
    visibilidad         TEXT NOT NULL DEFAULT 'publica' CHECK (visibilidad IN ('publica','curso','privada')),
    fecha_creacion      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_publicacion   TEXT,
    publicado_por       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    moderador_id        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    eliminado_en        TEXT,
    -- Personalización visual del autor: {"acento": "...", "patron": "..."}.
    -- JSON para poder añadir opciones sin otra migración.
    estilo_visual       TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_publicaciones_estado      ON publicaciones(estado, fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_publicaciones_autor       ON publicaciones(autor_id);
CREATE INDEX IF NOT EXISTS idx_publicaciones_categoria   ON publicaciones(categoria_id);
CREATE INDEX IF NOT EXISTS idx_publicaciones_visibilidad ON publicaciones(visibilidad, fecha_publicacion);

-- ------------------------------------------------------------
-- ETIQUETAS DE PUBLICACIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publicacion_etiquetas (
    publicacion_id INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
    etiqueta_id    INTEGER NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
    PRIMARY KEY (publicacion_id, etiqueta_id)
);

CREATE INDEX IF NOT EXISTS idx_publicacion_etiquetas_etiqueta
    ON publicacion_etiquetas(etiqueta_id);

-- ------------------------------------------------------------
-- MODERACIONES
-- Conserva el historial completo de revisiones.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moderaciones (
    id               INTEGER PRIMARY KEY,
    publicacion_id   INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
    docente_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    estado_anterior  TEXT NOT NULL CHECK (estado_anterior IN
                       ('borrador','enviada','en_revision','requiere_cambios',
                        'aprobada','rechazada','archivada')),
    decision         TEXT NOT NULL CHECK (decision IN ('aprobar','corregir','rechazar')),
    estado_nuevo     TEXT NOT NULL CHECK (estado_nuevo IN
                       ('borrador','enviada','en_revision','requiere_cambios',
                        'aprobada','rechazada','archivada')),
    observacion      TEXT,
    fecha            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK ((decision = 'aprobar'  AND estado_nuevo = 'aprobada') OR
           (decision = 'corregir' AND estado_nuevo = 'requiere_cambios') OR
           (decision = 'rechazar' AND estado_nuevo = 'rechazada'))
);

CREATE INDEX IF NOT EXISTS idx_moderaciones_publicacion
    ON moderaciones(publicacion_id, fecha);
CREATE INDEX IF NOT EXISTS idx_moderaciones_docente ON moderaciones(docente_id);

-- ------------------------------------------------------------
-- COMENTARIOS
-- comentario_padre_id permite respuestas a otros comentarios.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comentarios (
    id                   INTEGER PRIMARY KEY,
    publicacion_id       INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
    autor_id             INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    comentario_padre_id  INTEGER REFERENCES comentarios(id) ON DELETE SET NULL,
    contenido            TEXT NOT NULL,
    estado               TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN
                         ('pendiente','aprobado','rechazado')),
    moderado_por         INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_moderacion     TEXT,
    fecha                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (comentario_padre_id IS NULL OR comentario_padre_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_comentarios_publicacion
    ON comentarios(publicacion_id, estado, fecha);
CREATE INDEX IF NOT EXISTS idx_comentarios_padre ON comentarios(comentario_padre_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_autor ON comentarios(autor_id);

-- Reacciones a una publicacion. La clave primaria compuesta es lo que impide
-- que la misma persona sume dos veces la misma reaccion: la restriccion vive en
-- la base, no en el codigo que la llama.
CREATE TABLE IF NOT EXISTS publicacion_reacciones (
    publicacion_id  INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL CHECK (tipo IN
                    ('entendi','sorpresa','duda','practicar')),
    fecha           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (publicacion_id, usuario_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_reacciones_publicacion
    ON publicacion_reacciones(publicacion_id, tipo);

-- ------------------------------------------------------------
-- ACTIVIDADES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actividades (
    id                    INTEGER PRIMARY KEY,
    titulo                TEXT NOT NULL,
    descripcion           TEXT,
    instrucciones         TEXT,
    area                  TEXT NOT NULL CHECK (area IN (
                            'cuerpo_humano',
                            'pubertad',
                            'sistema_reproductor_femenino',
                            'sistema_reproductor_masculino',
                            'celulas_reproductoras',
                            'fecundacion',
                            'embarazo',
                            'nacimiento',
                            'autocuidado',
                            'preguntas_frecuentes')),
    categoria_id          INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    tipo                  TEXT NOT NULL,
    dificultad            TEXT NOT NULL CHECK (dificultad IN ('basica','media','avanzada')),
    tiempo_limite_segundos INTEGER CHECK (tiempo_limite_segundos IS NULL OR tiempo_limite_segundos > 0),
    intentos_maximos      INTEGER NOT NULL DEFAULT 1 CHECK (intentos_maximos > 0),
    creado_por            INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    activa                INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0,1)),
    fecha_creacion        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_actividades_area      ON actividades(area, activa);
CREATE INDEX IF NOT EXISTS idx_actividades_categoria ON actividades(categoria_id);
CREATE INDEX IF NOT EXISTS idx_actividades_creador   ON actividades(creado_por);

-- ------------------------------------------------------------
-- PREGUNTAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preguntas (
    id                  INTEGER PRIMARY KEY,
    actividad_id        INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
    orden               INTEGER NOT NULL CHECK (orden > 0),
    tipo                TEXT NOT NULL DEFAULT 'opcion_multiple' CHECK
                        (tipo IN ('opcion_multiple','verdadero_falso','respuesta_corta')),
    enunciado           TEXT NOT NULL,
    opciones            TEXT,
    respuesta_correcta  TEXT NOT NULL,
    explicacion         TEXT,
    imagen_url          TEXT,
    puntaje             INTEGER NOT NULL DEFAULT 1 CHECK (puntaje >= 0),
    obligatoria         INTEGER NOT NULL DEFAULT 1 CHECK (obligatoria IN (0,1)),
    CHECK (opciones IS NULL OR json_valid(opciones)),
    CHECK ((tipo IN ('opcion_multiple','verdadero_falso') AND opciones IS NOT NULL) OR
           tipo = 'respuesta_corta'),
    UNIQUE (actividad_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_preguntas_actividad ON preguntas(actividad_id, orden);
CREATE INDEX IF NOT EXISTS idx_preguntas_tipo      ON preguntas(tipo);

-- ------------------------------------------------------------
-- INTENTOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intentos (
    id                    INTEGER PRIMARY KEY,
    estudiante_id         INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    actividad_id          INTEGER NOT NULL REFERENCES actividades(id) ON DELETE RESTRICT,
    quiz_version          INTEGER,
    estado                TEXT NOT NULL DEFAULT 'iniciado' CHECK
                          (estado IN ('iniciado','completado','abandonado','calificado')),
    puntaje               REAL NOT NULL DEFAULT 0 CHECK (puntaje >= 0),
    puntaje_maximo        REAL NOT NULL DEFAULT 0 CHECK (puntaje_maximo >= 0),
    porcentaje            REAL NOT NULL DEFAULT 0 CHECK (porcentaje BETWEEN 0 AND 100),
    respuestas_correctas  INTEGER NOT NULL DEFAULT 0 CHECK (respuestas_correctas >= 0),
    fecha                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    iniciado_en           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    finalizado_en         TEXT,
    duracion_segundos     INTEGER CHECK (duracion_segundos IS NULL OR duracion_segundos >= 0),
    numero_intento        INTEGER NOT NULL DEFAULT 1 CHECK (numero_intento > 0),
    CHECK (finalizado_en IS NULL OR finalizado_en >= iniciado_en),
    UNIQUE (estudiante_id, actividad_id, numero_intento)
);

CREATE INDEX IF NOT EXISTS idx_intentos_estudiante ON intentos(estudiante_id, fecha);
CREATE INDEX IF NOT EXISTS idx_intentos_actividad  ON intentos(actividad_id, estado);
CREATE INDEX IF NOT EXISTS idx_intentos_estado     ON intentos(estado);

-- ------------------------------------------------------------
-- RESPUESTAS DE CADA INTENTO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS respuestas_intento (
    id                 INTEGER PRIMARY KEY,
    intento_id         INTEGER NOT NULL REFERENCES intentos(id) ON DELETE CASCADE,
    pregunta_id        INTEGER NOT NULL REFERENCES preguntas(id) ON DELETE RESTRICT,
    respuesta           TEXT,
    correcta            INTEGER CHECK (correcta IN (0,1)),
    puntaje_obtenido    REAL NOT NULL DEFAULT 0 CHECK (puntaje_obtenido >= 0),
    fecha               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (intento_id, pregunta_id)
);

CREATE INDEX IF NOT EXISTS idx_respuestas_intento  ON respuestas_intento(intento_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_pregunta ON respuestas_intento(pregunta_id);

-- ------------------------------------------------------------
-- RECURSOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recursos (
    id                  INTEGER PRIMARY KEY,
    titulo              TEXT NOT NULL,
    descripcion         TEXT,
    tipo                TEXT NOT NULL,
    archivo_o_url       TEXT NOT NULL,
    mime_type           TEXT,
    tamano_bytes        INTEGER CHECK (tamano_bytes IS NULL OR tamano_bytes >= 0),
    area                TEXT CHECK (area IN (
                          'cuerpo_humano',
                          'pubertad',
                          'sistema_reproductor_femenino',
                          'sistema_reproductor_masculino',
                          'celulas_reproductoras',
                          'fecundacion',
                          'embarazo',
                          'nacimiento',
                          'autocuidado',
                          'preguntas_frecuentes')),
    categoria_id        INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    fuente              TEXT,
    licencia            TEXT,
    estado_aprobacion   TEXT NOT NULL DEFAULT 'pendiente' CHECK
                        (estado_aprobacion IN ('pendiente','aprobado','rechazado')),
    subido_por          INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    aprobado_por        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_aprobacion    TEXT,
    activo              INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    fecha_creacion      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_recursos_estado ON recursos(estado_aprobacion, activo);
CREATE INDEX IF NOT EXISTS idx_recursos_area   ON recursos(area, activo);
CREATE INDEX IF NOT EXISTS idx_recursos_autor  ON recursos(subido_por);

-- ------------------------------------------------------------
-- RECURSOS DE PUBLICACIONES Y ACTIVIDADES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publicacion_recursos (
    publicacion_id INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
    recurso_id     INTEGER NOT NULL REFERENCES recursos(id) ON DELETE RESTRICT,
    orden          INTEGER NOT NULL DEFAULT 1 CHECK (orden > 0),
    PRIMARY KEY (publicacion_id, recurso_id)
);

CREATE TABLE IF NOT EXISTS actividad_recursos (
    actividad_id INTEGER NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
    recurso_id   INTEGER NOT NULL REFERENCES recursos(id) ON DELETE RESTRICT,
    orden        INTEGER NOT NULL DEFAULT 1 CHECK (orden > 0),
    PRIMARY KEY (actividad_id, recurso_id)
);

CREATE INDEX IF NOT EXISTS idx_publicacion_recursos_recurso
    ON publicacion_recursos(recurso_id);
CREATE INDEX IF NOT EXISTS idx_actividad_recursos_recurso
    ON actividad_recursos(recurso_id);

-- ------------------------------------------------------------
-- EVENTOS_APRENDIZAJE
-- Log granular estilo xAPI: actor - verbo - objeto - resultado.
-- resultado y contexto se almacenan como JSON.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos_aprendizaje (
    id            INTEGER PRIMARY KEY,
    evento_id     TEXT UNIQUE,
    actor_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    sesion_id     INTEGER REFERENCES sesiones(id) ON DELETE SET NULL,
    verbo         TEXT NOT NULL,
    objeto_tipo   TEXT NOT NULL,
    objeto_id     INTEGER NOT NULL,
    resultado     TEXT,
    contexto      TEXT,
    fecha         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (resultado IS NULL OR json_valid(resultado)),
    CHECK (contexto IS NULL OR json_valid(contexto))
);

CREATE INDEX IF NOT EXISTS idx_eventos_actor  ON eventos_aprendizaje(actor_id, fecha);
CREATE INDEX IF NOT EXISTS idx_eventos_sesion ON eventos_aprendizaje(sesion_id);
CREATE INDEX IF NOT EXISTS idx_eventos_objeto ON eventos_aprendizaje(objeto_tipo, objeto_id, fecha);

-- Agenda visible de la clase. No confundir con eventos_aprendizaje, que es telemetría.
CREATE TABLE IF NOT EXISTS eventos_clase (
    id               INTEGER PRIMARY KEY,
    titulo           TEXT NOT NULL,
    descripcion      TEXT,
    tipo             TEXT NOT NULL DEFAULT 'clase' CHECK (tipo IN ('clase','entrega','encuentro','recordatorio')),
    fecha_inicio     TEXT NOT NULL,
    fecha_fin        TEXT,
    lugar            TEXT,
    color            TEXT NOT NULL DEFAULT 'teal',
    etiqueta         TEXT,
    actividad_id     INTEGER REFERENCES actividades(id) ON DELETE SET NULL,
    creado_por       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    activo           INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    fecha_creacion   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_eventos_clase_fecha ON eventos_clase(activo, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_eventos_clase_creador ON eventos_clase(creado_por);

-- ------------------------------------------------------------
-- AUDITORIA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
    id                 INTEGER PRIMARY KEY,
    usuario_id         INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    accion             TEXT NOT NULL,
    entidad            TEXT,
    entidad_id         INTEGER,
    elemento_afectado  TEXT,
    datos_anteriores   TEXT,
    datos_nuevos       TEXT,
    ip                 TEXT,
    user_agent         TEXT,
    solicitud_id       TEXT,
    fecha              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    descripcion        TEXT,
    CHECK (datos_anteriores IS NULL OR json_valid(datos_anteriores)),
    CHECK (datos_nuevos IS NULL OR json_valid(datos_nuevos))
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id, fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id, fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria(accion, fecha);

-- ------------------------------------------------------------
-- REGLAS DE ROLES
-- SQLite no valida roles mediante FOREIGN KEY, por eso se usan
-- triggers para las operaciones sensibles.
-- ------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_moderaciones_docente
BEFORE INSERT ON moderaciones
FOR EACH ROW
WHEN (SELECT rol FROM usuarios WHERE id = NEW.docente_id) NOT IN ('docente','administrador')
BEGIN
    SELECT RAISE(ABORT, 'El moderador debe ser docente o administrador');
END;

CREATE TRIGGER IF NOT EXISTS trg_intentos_estudiante
BEFORE INSERT ON intentos
FOR EACH ROW
WHEN (SELECT rol FROM usuarios WHERE id = NEW.estudiante_id) <> 'estudiante'
BEGIN
    SELECT RAISE(ABORT, 'El usuario del intento debe ser estudiante');
END;

CREATE TRIGGER IF NOT EXISTS trg_inscripciones_rol
BEFORE INSERT ON inscripciones
FOR EACH ROW
WHEN (SELECT rol FROM usuarios WHERE id = NEW.usuario_id) <> NEW.rol_en_curso
BEGIN
    SELECT RAISE(ABORT, 'El rol de la inscripcion no coincide con el rol del usuario');
END;

-- ============================================================
-- GAME ENGINE — SALAS, SESIONES Y LOGROS
-- ============================================================

-- ------------------------------------------------------------
-- ROOMS — Salas de juego creadas por docentes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id              TEXT PRIMARY KEY,                        -- "X7K2M9" (6 chars, uppercase)
    docente_id      INTEGER NOT NULL REFERENCES usuarios(id),
    actividad_id    INTEGER NOT NULL REFERENCES actividades(id),
    estado          TEXT NOT NULL DEFAULT 'esperando'        -- esperando | en_curso | finalizada
                    CHECK (estado IN ('esperando','en_curso','finalizada')),
    max_jugadores   INTEGER NOT NULL DEFAULT 30,
    modo            TEXT NOT NULL DEFAULT 'quiz_race' CHECK (modo IN ('quiz_race','speed','classic')),
    configuracion   TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(configuracion)),
    creada_en       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    iniciada_en     TEXT,
    finalizada_en   TEXT
);

CREATE INDEX IF NOT EXISTS idx_rooms_docente  ON rooms(docente_id);
CREATE INDEX IF NOT EXISTS idx_rooms_estado   ON rooms(estado);

-- ------------------------------------------------------------
-- GAME SESSIONS — Resultados de partidas jugadas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id         TEXT REFERENCES rooms(id),
    actividad_id    INTEGER REFERENCES actividades(id),
    resultados_json TEXT,                                    -- JSON con leaderboard final
    fecha           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_act  ON game_sessions(actividad_id);

-- ------------------------------------------------------------
-- ACHIEVEMENTS — Catálogo de logros
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    clave       TEXT NOT NULL UNIQUE,                        -- "first_perfect", "streak_5", etc.
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    icono       TEXT,                                        -- emoji o nombre de icono
    puntos_bonus INTEGER NOT NULL DEFAULT 0
);

-- Logros predefinidos
INSERT OR IGNORE INTO achievements (clave, nombre, descripcion, icono, puntos_bonus) VALUES
('first_attempt',    'Primer intento',        'Completaste tu primera actividad',        '🎯', 10),
('first_perfect',    'Perfección',            'Obtuviste 100% en una actividad',         '⭐', 50),
('streak_3',         'En racha ×3',           'Completaste 3 actividades consecutivas',  '🔥', 20),
('streak_5',         'En racha ×5',           'Completaste 5 actividades consecutivas',  '🔥', 40),
('speed_demon',      'Rayo',                  'Respondiste en menos de 2 segundos',      '⚡', 15),
('top_3_room',       'Podio',                 'Terminaste entre los 3 primeros en una sala', '🏆', 30),
('all_areas',        'Explorador completo',   'Completaste actividades de todas las áreas', '🌍', 60),
('ten_activities',   '¡10 actividades!',      'Completaste 10 actividades',              '📚', 25);

-- Ampliación a 20 logros. INSERT OR IGNORE hace que migrate_db() los aplique
-- también sobre una blog.db ya existente, sin necesitar una migración aparte.
INSERT OR IGNORE INTO achievements (clave, nombre, descripcion, icono, puntos_bonus) VALUES
('streak_7',              'En racha ×7',          'Completaste 7 actividades',                              '🔥', 60),
('primera_publicacion',   'Primera publicación',  'Tu primera publicación fue aprobada',                    '✍️', 25),
('tres_publicaciones',    'Autor constante',      'Tienes 3 publicaciones aprobadas',                       '📚', 45),
('reintento',             'Persistente',          'Reintentaste una actividad varias veces',                '🔄', 10),
('area_completa',         'Especialista de área', 'Completaste al 100% todas las actividades de un área',   '🎓', 35),
('polimata_areas',        'Polímata',             'Completaste actividades de 5 áreas distintas',           '🧩', 60),
('quiz_arena',            'Competidor',           'Participaste en una sala de Quiz Arena Live',            '🎮', 20),
('ruta_completa',         'Ruta completa',        'Completaste al 100% todas las actividades de la plataforma', '🗺️', 80),
('veinte_actividades',    '¡20 actividades!',     'Completaste 20 actividades',                             '📈', 50),
('comentarista',          'Participativo',        'Comentaste en 5 publicaciones de compañeros',            '💬', 15),
('madrugador',            'Madrugador',           'Completaste una actividad antes de las 8am',             '🌅', 10),
('investigador_recursos', 'Investigador',         'Compartiste 3 recursos aprobados con tus compañeros',    '🔍', 15);

-- ------------------------------------------------------------
-- USER ACHIEVEMENTS — Logros obtenidos por usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_achievements (
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    achievement_id  INTEGER NOT NULL REFERENCES achievements(id),
    obtenido_en     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (usuario_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(usuario_id);

-- ============================================================
-- MOTOR UNIFICADO DE QUIZZES INTERACTIVOS
--
-- Un quiz sigue siendo una actividad para conservar rutas, progreso e
-- intentos. Estas tablas agregan bloques ricos, opciones/medios y un
-- historial inmutable de versiones sin modificar las preguntas legacy.
-- ============================================================

CREATE TABLE IF NOT EXISTS quizzes (
    id                  INTEGER PRIMARY KEY,
    actividad_id        INTEGER NOT NULL UNIQUE REFERENCES actividades(id) ON DELETE CASCADE,
    version_actual      INTEGER NOT NULL DEFAULT 1 CHECK (version_actual > 0),
    estado              TEXT NOT NULL DEFAULT 'borrador'
                        CHECK (estado IN ('borrador','publicado','archivado')),
    privado             INTEGER NOT NULL DEFAULT 0 CHECK (privado IN (0,1)),
    configuracion       TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(configuracion)),
    creado_por          INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_creacion      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_quizzes_creador ON quizzes(creado_por, estado);
CREATE INDEX IF NOT EXISTS idx_quizzes_estado  ON quizzes(estado, fecha_actualizacion);

CREATE TABLE IF NOT EXISTS quiz_items (
    id                       INTEGER PRIMARY KEY,
    quiz_id                  INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    orden                    INTEGER NOT NULL CHECK (orden > 0),
    tipo                     TEXT NOT NULL CHECK (tipo IN (
                             'single_choice','multiple_choice','true_false',
                             'short_text','flashcard','info')),
    enunciado                TEXT NOT NULL,
    respuesta_correcta       TEXT CHECK (respuesta_correcta IS NULL OR json_valid(respuesta_correcta)),
    explicacion              TEXT,
    configuracion            TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(configuracion)),
    puntaje                  REAL NOT NULL DEFAULT 1 CHECK (puntaje >= 0),
    tiempo_limite_segundos   INTEGER CHECK (tiempo_limite_segundos IS NULL OR tiempo_limite_segundos > 0),
    obligatoria              INTEGER NOT NULL DEFAULT 1 CHECK (obligatoria IN (0,1)),
    fecha_creacion           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    fecha_actualizacion      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (quiz_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_quiz_items_quiz ON quiz_items(quiz_id, orden);
CREATE INDEX IF NOT EXISTS idx_quiz_items_tipo ON quiz_items(tipo);

CREATE TABLE IF NOT EXISTS quiz_opciones (
    id              INTEGER PRIMARY KEY,
    item_id         INTEGER NOT NULL REFERENCES quiz_items(id) ON DELETE CASCADE,
    orden           INTEGER NOT NULL CHECK (orden > 0),
    texto           TEXT NOT NULL,
    valor           TEXT NOT NULL,
    es_correcta     INTEGER NOT NULL DEFAULT 0 CHECK (es_correcta IN (0,1)),
    feedback        TEXT,
    configuracion   TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(configuracion)),
    UNIQUE (item_id, orden),
    UNIQUE (item_id, valor)
);

CREATE INDEX IF NOT EXISTS idx_quiz_opciones_item ON quiz_opciones(item_id, orden);

CREATE TABLE IF NOT EXISTS quiz_media_assets (
    id              INTEGER PRIMARY KEY,
    quiz_id         INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    item_id         INTEGER REFERENCES quiz_items(id) ON DELETE CASCADE,
    opcion_id       INTEGER REFERENCES quiz_opciones(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL CHECK (tipo IN ('image','audio','video','file')),
    url             TEXT NOT NULL,
    nombre_archivo  TEXT,
    mime_type       TEXT,
    tamano_bytes    INTEGER CHECK (tamano_bytes IS NULL OR tamano_bytes >= 0),
    texto_alternativo TEXT,
    configuracion   TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(configuracion)),
    creado_por      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_creacion  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (opcion_id IS NULL OR item_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_quiz_media_quiz   ON quiz_media_assets(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_media_item   ON quiz_media_assets(item_id);
CREATE INDEX IF NOT EXISTS idx_quiz_media_opcion ON quiz_media_assets(opcion_id);

CREATE TABLE IF NOT EXISTS quiz_versions (
    id              INTEGER PRIMARY KEY,
    quiz_id         INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    numero          INTEGER NOT NULL CHECK (numero > 0),
    snapshot        TEXT NOT NULL CHECK (json_valid(snapshot)),
    creado_por      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_creacion  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (quiz_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_quiz_versions_quiz ON quiz_versions(quiz_id, numero DESC);

CREATE TABLE IF NOT EXISTS quiz_respuestas_intento (
    id                 INTEGER PRIMARY KEY,
    intento_id         INTEGER NOT NULL REFERENCES intentos(id) ON DELETE CASCADE,
    quiz_item_id       INTEGER NOT NULL,
    respuesta          TEXT CHECK (respuesta IS NULL OR json_valid(respuesta)),
    correcta           INTEGER CHECK (correcta IN (0,1)),
    puntaje_obtenido   REAL NOT NULL DEFAULT 0 CHECK (puntaje_obtenido >= 0),
    tiempo_ms          INTEGER CHECK (tiempo_ms IS NULL OR tiempo_ms >= 0),
    fecha              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (intento_id, quiz_item_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_respuestas_intento
    ON quiz_respuestas_intento(intento_id);

CREATE TABLE IF NOT EXISTS quiz_attempt_events (
    id              INTEGER PRIMARY KEY,
    intento_id      INTEGER NOT NULL REFERENCES intentos(id) ON DELETE CASCADE,
    quiz_item_id    INTEGER,
    tipo            TEXT NOT NULL,
    datos           TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(datos)),
    fecha           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempt_events_intento
    ON quiz_attempt_events(intento_id, fecha);

-- ============================================================
-- NOTIFICACIONES
--
-- Antes la campana de la TopBar recalculaba "pendientes/aprobadas" en cada
-- carga a partir de datos vivos: no había historial ni "marcar como leído"
-- real. Esta tabla persiste cada notificación una vez, por usuario.
-- ============================================================

CREATE TABLE IF NOT EXISTS notificaciones (
    id              INTEGER PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL,
    titulo          TEXT NOT NULL,
    cuerpo          TEXT,
    enlace          TEXT,
    leida           INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0,1)),
    fecha_creacion  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
    ON notificaciones(usuario_id, leida, fecha_creacion DESC);

-- ============================================================
-- SEUDÓNIMOS DE INVESTIGACIÓN
--
-- Código estable no derivado del nombre/código real, para exportar datos de
-- interacción y desempeño sin identificar a los estudiantes (proyecto de
-- grado). El mapeo código↔identidad se consulta aparte, nunca junto al
-- dataset exportado.
-- ============================================================

CREATE TABLE IF NOT EXISTS pseudonimos_investigacion (
    usuario_id      INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo          TEXT NOT NULL UNIQUE,
    creado_en       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
