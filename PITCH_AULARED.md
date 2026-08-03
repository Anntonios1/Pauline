# Pitch de AulaRed 5

**Corte del producto: 2 de agosto de 2026**

## Pitch de 60 segundos

AulaRed 5 es una plataforma educativa digital para transformar el aprendizaje en una
experiencia activa, segura y medible. Integra contenidos, publicaciones, actividades,
quizzes interactivos, recursos multimedia y juegos en vivo dentro de un mismo entorno.

El estudiante puede explorar temas, seguir su ruta de aprendizaje, resolver actividades,
recibir retroalimentación, ganar logros y participar en salas de juego con su clase. El
docente puede crear contenido, diseñar quizzes, administrar recursos, moderar publicaciones,
comentarios y materiales, programar eventos y consultar el progreso del grupo.

La plataforma ya cuenta con control por roles, sesiones seguras, validación de archivos,
moderación, trazabilidad, estadísticas, persistencia de datos y comunicación en tiempo real.
No es solamente un blog: es un ecosistema EdTech que conecta aprendizaje, participación y
gestión docente.

## Problema

En muchos entornos escolares, el contenido, las actividades, la evaluación y la gestión del
grupo están separados en herramientas distintas. Esto dificulta la participación del
estudiante, aumenta el trabajo del docente y deja poca visibilidad sobre el progreso real.

## Solución implementada

- **Experiencia del estudiante:** feed educativo, exploración por áreas, lecturas,
  publicaciones, comentarios moderados, recursos, progreso, perfil, logros y ruta de
  aprendizaje.
- **Creación docente:** publicaciones, actividades, quizzes interactivos, preguntas,
  bloques informativos, flashcards y contenido multimedia.
- **Evaluación:** intentos, respuestas, puntajes, porcentaje, duración, límite de intentos,
  progreso y detección de intentos abandonados.
- **Motor de quizzes unificado:** opciones simples y múltiples, verdadero/falso, texto corto,
  información, flashcards, medios por pregunta/opción y versiones históricas.
- **Aprendizaje en vivo:** salas de juego con WebSocket, ingreso por código/QR, ranking,
  puntuación por velocidad, resultados por pregunta y sesión final persistida.
- **Gestión docente:** dashboard, estadísticas, moderación de publicaciones/comentarios/
  recursos, agenda de eventos y administración de cursos y usuarios.
- **Persistencia y trazabilidad:** eventos de aprendizaje, sesiones, auditoría, historial de
  moderaciones y resultados de partidas.

## Tecnologías

- **Frontend:** React 18, Vite 5, Tailwind CSS, React Router, Lucide React y dnd-kit.
- **Backend:** Python, FastAPI y Uvicorn.
- **Tiempo real:** WebSocket para salas de juego y comunicación de eventos.
- **Base de datos:** SQLite con claves foráneas, índices, restricciones `CHECK`, triggers y
  modo WAL para mejorar la concurrencia.
- **Archivos:** Pillow para imágenes y validación de firma para audio, video, PDF, TXT y DOCX.
- **API:** endpoints REST organizados por rutas y servicios, con compatibilidad para contenidos
  legacy y el motor unificado de quizzes.

## Seguridad implementada

- Contraseñas protegidas con **bcrypt**.
- Sesiones persistentes con expiración configurable, hash SHA-256 del token y token cifrado
  con AES-256-GCM.
- Cierre de sesión e invalidación de tokens en servidor.
- Control de acceso por roles: estudiante, docente y administrador.
- Verificación de propiedad: un estudiante no puede modificar intentos o publicaciones de
  otra persona.
- Moderación separada del flujo de publicación: los estudiantes no pueden autoaprobarse.
- Protección contra escalamiento de privilegios y creación no autorizada de usuarios.
- Rate limiting para intentos de inicio de sesión.
- Límites de tamaño, tipos permitidos, validación de contenido real y nombres aleatorios para
  archivos subidos.
- Headers de seguridad activos: `X-Content-Type-Options`, `X-Frame-Options` y
  `Referrer-Policy`.
- Reglas de base de datos para impedir roles inválidos, intentos con usuarios no estudiantes
  e inscripciones inconsistentes.

## Normas y criterios aplicados

- **Mínimo privilegio:** cada operación sensible exige autenticación y rol.
- **Separación de responsabilidades:** rutas, servicios, modelos, base de datos y frontend
  están desacoplados por módulos.
- **Moderación responsable:** el contenido generado por estudiantes pasa por revisión docente.
- **Integridad de datos:** claves foráneas, estados controlados, JSON validado, timestamps en
  UTC e historial de versiones.
- **Trazabilidad:** moderaciones, sesiones, eventos de aprendizaje y auditoría dejan registro.
- **Protección de datos:** las respuestas de usuarios no exponen `password_hash` ni claves
  evaluables de los quizzes al estudiante.
- **Accesibilidad y seguridad de contenido:** se contemplan textos alternativos para medios,
  estados de carga/error y separación clara entre contenido oficial y contenido creado por
  estudiantes.

## Métodos de trabajo

- Desarrollo incremental por fases: funcionalidad, seguridad, flujos/datos y limpieza.
- Arquitectura modular con API REST y WebSocket donde se necesita interacción inmediata.
- Migraciones idempotentes: actualizar la base existente sin borrar información.
- Versionado de quizzes para que un intento conserve la versión con la que fue iniciado.
- Validación automática de contratos creador → jugador → intento.
- Pruebas de integración de API, permisos, ownership, límites de intentos, moderación y
  migraciones.
- Verificación de frontend mediante compilación de producción.
- Auditoría de contradicciones entre backend, frontend, esquema y documentación.

## Diferencial

AulaRed combina tres capas que normalmente están separadas:

1. **Aprender:** contenidos, lecturas, actividades y ruta personalizada.
2. **Participar:** publicaciones, comentarios, logros y juegos colaborativos.
3. **Gestionar:** creación docente, moderación, estadísticas, cursos y trazabilidad.

El resultado es una experiencia educativa más cercana para el estudiante y más controlable
para el docente, con información suficiente para tomar decisiones sobre el aprendizaje.

## Estado actual y siguiente nivel

La base funcional está implementada y cuenta con pruebas automatizadas de API, seguridad y
quizzes unificados. La verificación local de esta sesión quedó pendiente porque el entorno no
expone Python y el build de Vite fue bloqueado por permisos del sistema.

Antes de producción se recomienda cerrar:

- activar HTTPS real en el arranque y usar certificados gestionados;
- restringir CORS a los dominios autorizados;
- centralizar todas las constantes de validación;
- completar la escritura automática de auditoría en operaciones críticas;
- ejecutar la batería completa en un entorno con Python y Node habilitados;
- validar responsive y accesibilidad en dispositivos reales.

## Cierre

**AulaRed 5 convierte una clase en una comunidad de aprendizaje digital: segura para
participar, potente para enseñar y medible para mejorar.**
