# Auditoría de contradicciones — AulaRed 5

Documento de trabajo. Localiza 25 contradicciones reales: sitios donde dos partes del
sistema afirman cosas incompatibles — el backend devuelve una forma y el frontend espera
otra, la documentación describe un comportamiento que el código no tiene, la configuración
declara reglas que nadie aplica, o dos pantallas calculan lo mismo de forma distinta.

Fuentes revisadas: backend completo (`api/`), esquema (`schema.sql`), frontend completo
(`frontend/src/`) y lanzador (`start-debug.bat`).

---

## A. Contradicciones que rompen funcionalidad (4)

### A1 — Subir un archivo a la Biblioteca docente falla siempre

`POST /api/resource-media` (`api/routes/resources.py:52`) devuelve el dict de
`save_quiz_media` tal cual: claves `type`, `url`, `filename`. Pero
`TeacherResourcesPage.jsx:33` lee `uploaded.tipo` → `undefined` → `createResource` viaja
sin `tipo` → el backend responde 400 «Campo requerido: tipo».

El endpoint hermano `/api/quiz-media` (`api/routes/quizzes.py:154-159`) sí añade
`tipo`/`nombre`/`archivo_o_url`. Dos endpoints de subida con contratos distintos.

### A2 — El QR de sala no es escaneable en la práctica

Tres contradicciones apiladas:

- `api/routes/rooms.py:9` y `:152` documentan «imagen QR (PNG)» y
  `<img src='/api/rooms/{code}/qr'>`, pero el handler devuelve JSON con base64
  (`:186-193`). El frontend usa el JSON — la doc miente.
- `qrcode` no está en `api/requirements.txt`. Si falta, el `except ImportError` (`:181`)
  devuelve JSON sin `qr_base64` y `GameRoomPage.jsx:101-113` se queda en «Cargando QR…»
  para siempre, sin error visible.
- La URL del QR se arma con la IP LAN (`rooms.py:176`, `http://{ip}:5173`), pero
  `start-debug.bat:118,127` arranca backend y frontend con `--host 127.0.0.1`,
  contradiciendo `vite.config.js:42` (`host: '0.0.0.0'`). Ningún celular puede abrir esa
  URL.

### A3 — Tres estados distintos significan «la sala arrancó»

`schema.sql:506` permite `esperando | activa | en_curso | finalizada`. `create_room`
escribe `esperando`; `POST /api/rooms/{code}/start` escribe `activa` (`rooms.py:213`); el
WebSocket al iniciar escribe `en_curso` (`room_manager.py:293`). El frontend nunca llama a
`/start` (usa `startGame` por WS), así que `activa` no se escribe jamás y el endpoint REST
es código muerto. Además el WS solo rechaza salas `finalizada` (`room_manager.py:230`): un
estudiante entra a una sala que el docente no ha habilitado.

### A4 — `imghdr` desaparece en Python 3.13

`api/utils/upload.py:3` importa `imghdr`, eliminado de la stdlib en 3.13. Toda subida de
imagen (avatar, portada, medios de quiz) revienta al actualizar Python.

---

## B. Contradicciones de seguridad y permisos (4)

### B1 — `POST /api/users` no pide autenticación

`api/routes/users.py:24` `create_user` no llama a `require_role`. Cualquiera puede crear
una cuenta con `rol: "administrador"`. Contradice al resto de la app (todo lo demás está
protegido) y que `/login` sea la única ruta pública del frontend.

### B2 — Un estudiante puede autopublicar saltándose la moderación

`api/routes/publications.py:25`:

```python
estado = "aprobada" if is_teacher and requested_state in {"aprobada","publicada"} else requested_state
```

Si un estudiante manda `estado:"aprobada"`, el `else` lo deja pasar tal cual y queda
aprobada sin revisión. `update_publication` sí protege el campo (`:87`), pero `create` no.

Bonus: `"publicada"` no existe en el CHECK de `schema.sql:154` → si alguien lo envía, el
INSERT falla con un 400 genérico.

### B3 — La cola de moderación es pública

`list_publications` (`publications.py:45`) no comprueba sesión ni rol.
`GET /api/publications?estado=enviada` devuelve los borradores de todos los estudiantes a
cualquiera, autenticado o no. `DataContext.jsx:36` además los descarga para estudiantes.

### B4 — logout no cierra la sesión en el servidor

`AuthContext.jsx:31` solo borra `localStorage`. `api.js:32` `logout()` existe pero nadie lo
llama: `cerrar_sesion` nunca se ejecuta y el token sigue válido 24 h.

---

## C. Flujos incompletos (2)

### C1 — Los comentarios nunca se ven

Nacen en `estado='pendiente'` (`schema.sql:219`) y `listar_comentarios_publicacion` solo
devuelve `'aprobado'`. Existen `GET /api/comments/pending` y
`POST /api/comments/{id}/moderate`, pero no hay UI ni función en `api.js`. El estudiante
comenta, ve «Comentario enviado para revisión» y su comentario no aparece nunca.

### C2 — Los recursos de estudiantes tampoco

`create_resource` autoaprueba solo si el autor es docente/admin (`resources.py:34`).
Existe `POST /api/resources/{id}/approve` sin UI ni consumidor.

---

## D. Contradicciones de datos y semántica (5)

### D1 — El intento se crea al terminar, no al empezar

`ActivityDetailPage.jsx:219` llama a `createAttempt` dentro de `persistCompletion`, con el
quiz ya terminado. Consecuencias: `iniciado_en ≈ finalizado_en` y `duracion_segundos ≈ 0`
— justo la columna que alimenta «Tiempo» en `AdminDashboard.jsx:331` y
`duracion_promedio_seg` en `services/stats.py:252`. Además `intentos_maximos` se valida
dos veces con reglas distintas (pre-check en el front con `getMyAttempts`, y en
`create_attempt`), y abandonar a mitad no consume intento.

### D2 — `estado='abandonado'` no lo escribe nadie

El KPI «Tasa de abandono» (`AdminDashboard.jsx:104`) y `abandonados` (`stats.py:251`)
siempre dan 0. El estado existe en el CHECK (`schema.sql:301`) y en
`ALLOWED_ESTADOS_INTENTO`, pero ninguna ruta lo asigna.

### D3 — Los logros se calculan distinto en dos pantallas

- `ProfilePage.jsx:60` → `buildLogros(progress, myPublications)`.
- `MyRoutePage.jsx:19` → `buildLogros(progress)`.

Los logros 6 y 9 (publicaciones aprobadas) son inalcanzables en «Mi ruta» y sí obtenibles
en «Perfil». Además `MyRoutePage.jsx:30` marca toda lectura como `estado:'completado'`
sin comprobar nada, así que el «X/Y pasos» de cada unidad es ficticio (y `:34` tiene un
`lecturas.every(l => true)` muerto).

### D4 — Notificación de «requiere cambios» imposible para el estudiante

`TopBar.jsx:63` filtra `publications` por `estado === 'requiere_cambios'`, pero
`publications` viene de `getPublications()` sin parámetros → el backend solo devuelve
`'aprobada'` (`publications.py:46`). Nunca hay coincidencias. Además identifica las
publicaciones propias por `autor_nombre === user.nombre_visible` (`:50`) en vez de por
`autor_id`.

### D5 — CreatePage descarta datos que pide y miente en los textos

- `fuente` y `pregunta` (`CreatePage.jsx:64-65`) se capturan, se muestran en la vista
  previa y nunca se envían.
- Los textos del paso 5 y de confirmación («será enviada al docente para su revisión»,
  «Todavía no será visible para tus compañeros») se muestran también al docente, cuya
  publicación se aprueba al instante (`CreatePage.jsx:133` + `publications.py:25`).
- `CreatePage.jsx:433` busca el emoji en `PROPOSITOS`, no en `PROPOSITOS_DOCENTE` → el
  docente ve el resumen sin emoji.

---

## E. Configuración declarada que nadie aplica (6)

| # | Contradicción | Dónde |
|---|---------------|-------|
| E1 | `TOKEN_EXPIRES_HOURS` nunca se usa: `crear_sesion` llama a `token_expires_at()` y el default está fijo en 24 h | `settings.py:8` vs `helpers.py:175` |
| E2 | `USE_HTTPS` (default `"true"`), `CERT_FILE`, `KEY_FILE` y todo `utils/https.py` (`ensure_certs`) no se invocan en ningún punto. La app siempre arranca en HTTP plano; hay certificados en `api/certs/` que nadie usa, y `LoginPage.jsx:125` dice «Conexión segura con el servidor» | `settings.py:39-42`, `utils/https.py`, `app.py:191` |
| E3 | `ALLOWED_ESTADOS_PUBLICACION`, `ALLOWED_ROLES`, `ALLOWED_VISIBILIDAD`, `ALLOWED_TIPOS_PREGUNTA`, `ALLOWED_ESTADOS_*` no se usan; cada ruta revalida a mano con listas duplicadas | `settings.py:57-73` vs `users.py:17` |
| E4 | `DB_PATH` se importa pero `get_db` recalcula la ruta por su cuenta | `connection.py:5` vs `:9` |
| E5 | `requirements.txt` no incluye `qrcode`, y `start-debug.bat:88` solo verifica `bcrypt`, `fastapi`, `multipart`, `uvicorn` (ni Pillow ni cryptography ni qrcode) | `requirements.txt`, `rooms.py:44` |
| E6 | `vite.config.js` expone `0.0.0.0` pero el lanzador fuerza `127.0.0.1` | `vite.config.js:42` vs `start-debug.bat:127` |

---

## F. Código huérfano y enlaces rotos (4)

| # | Contradicción | Dónde |
|---|---------------|-------|
| F1 | `AdminLayout.jsx` no se monta en ningún sitio (`App.jsx` usa `TeacherLayout`) y apunta a `/admin/ruta`, ruta inexistente | `components/layout/AdminLayout.jsx:11` |
| F2 | `HomePage.jsx` y `LearningPathPage.jsx` no están enrutados en `App.jsx` | `pages/home/`, `pages/learning-path/` |
| F3 | El menú lateral del estudiante lleva a `/ayuda` y `/normas`, que no existen → `NotFoundPage` | `SideMenu.jsx:32-33` |
| F4 | Funciones de `api.js` sin consumidor: `logout`, `getLearningPath`, `getQuestions`, `createEvent`, `getStatsTimeline`, `getStatsActivities`. Las tablas `eventos_aprendizaje` y `auditoria` nunca reciben escrituras desde la app, aunque `GET /api/audit` y `GET /api/events` estén expuestos | `services/api.js`, `routes/audit.py` |

Extra menor: `ActivityResultPage.jsx:32,45,48` navega siempre a `/actividades/...` aunque
exista `/admin/actividades/:id/resultado`; y `room_manager.py:11-18` documenta un evento
`answer_result` que el código no emite (emite `answer_ack` y `question_results`).

---

## Decisiones tomadas

### Moderación (C1, C2) — decidido

**UI de aprobación dentro de la pantalla de moderación que ya existe.** Los comentarios y
los recursos pendientes se revisan en `ModerationPage` (`/admin/moderar`), la misma
pestaña donde hoy se moderan las publicaciones, usando los endpoints que ya están
expuestos (`GET /api/comments/pending`, `POST /api/comments/{id}/moderate`,
`POST /api/resources/{id}/approve`). No se crea una pantalla nueva.

Descartadas: autoaprobar comentarios (pierde el filtro previo) y autoaprobar solo recursos.

### Salas (A3) — decidido y aplicado

**Un solo flujo por WebSocket.** Se eliminó `POST /api/rooms/{code}/start` y el estado
`activa`; la sala va `esperando → en_curso → finalizada`.

---

## Plan de reparación

### Fase 0 — Documento ✅

- Creado `CONTRADICCIONES_APP.md` en la raíz con el contenido de esta auditoría.

### Fase 1 — Lo que está roto hoy ✅

- **A1** ✅: extraído `serialize_upload_asset` (`utils/upload.py:147`) y usado tanto en
  `upload_resource_media` (`routes/resources.py:63`) como en el endpoint de quiz. Un solo
  contrato de subida.
- **A2** ✅: `qrcode` añadido a `api/requirements.txt` y al check de `start-debug.bat:88`
  (junto a `PIL` y `cryptography`); el `except ImportError` (`rooms.py:186`) devuelve un
  error explícito y `GameRoomPage.jsx:112-130` muestra la URL de unión en lugar del
  spinner eterno; docstrings de `rooms.py:9,154` corregidos a «JSON con qr_base64»;
  lanzador arranca backend y frontend con `--host 0.0.0.0` (`start-debug.bat:118,127`).
- **A3** ✅: aplicada la opción 1. `POST /api/rooms/{code}/start` eliminado y `activa`
  fuera del CHECK (`schema.sql:507`).
- **A4** ✅: `imghdr` sustituido por detección con Pillow (`utils/upload.py:41,53`).

### Fase 2 — Seguridad ✅

- **B1** ✅: `require_role(handler, ["administrador"])` en `create_user`
  (`routes/users.py:26`).
- **B2** ✅: `create_publication` normaliza `"publicada"` → `"aprobada"`, valida contra
  `ALLOWED_ESTADOS_PUBLICACION` y fuerza a los estudiantes a `borrador`/`enviada`
  (`publications.py:26-35`).
- **B3** ✅: `list_publications` exige rol docente/admin para cualquier estado distinto de
  `aprobada`, salvo que el solicitante consulte su propio `autor_id`
  (`publications.py:67-71`).
- **B4** ✅: `AuthContext.logout` llama a `api.logout()` tolerando el fallo de red antes de
  limpiar `localStorage` (`AuthContext.jsx:35`).

### Fase 3 — Flujos y datos ✅

- **C1/C2** ✅: `ModerationPage` reescrito con 3 pestañas (Publicaciones / Comentarios /
  Recursos). Backend: `moderate_comment` valida estado y existencia; nuevo endpoint
  `DELETE /api/comments/{id}`; `list_resources` exige staff para estados ≠ aprobado;
  `update_resource` bloquea autoaprobación de estudiantes; nueva función `rechazar_recurso()`.
  Frontend: `api.js` expone `getPendingComments`, `moderateComment`, `approveResource`,
  `rejectResource`.
- **D1** ✅: `createAttempt` se llama en `handleStart` (inicio real del quiz); se guarda
  `attemptId` en estado y se usa en `persistCompletion`; eliminado el pre-check duplicado
  con `getMyAttempts`; `restart` limpia `attemptId` solo si el intento anterior ya se guardó.
- **D2** ✅: nueva función `marcar_intentos_abandonados()` (barrido perezoso: UPDATE de
  intentos `iniciado` > `ATTEMPT_ABANDON_AFTER_MINUTES` a `abandonado`); se invoca en
  `get_resumen_estudiantes()` y `get_estadisticas_actividades()`.
- **D3** ✅: nuevo hook `useMyPublications.js` (compartido); `MyRoutePage` calcula estado
  de lecturas con `readIds.has(pub.id)` en vez de `'completado'` fijo; `ProfilePage` usa
  el mismo hook → logros idénticos en ambas pantallas.
- **D4** ✅: `TopBar` usa `useMyPublications` (compara por `autor_id`, no por nombre);
  `PublicationDetailPage` registra evento `leyo` al cargar (solo estudiantes);
  `list_events` exige auth y fuerza `actor_id` al propio usuario si es estudiante.
- **D5** ✅: `buildContenido()` anexa `pregunta` y `fuente` al cuerpo; textos de pasos 4/5
  y confirmación condicionados a `isTeacher`; checklist de normas solo visible para
  estudiantes; vista previa muestra la pregunta si existe.

### Fase 4 — Limpieza

- **E1**: `token_expires_at(hours=TOKEN_EXPIRES_HOURS)`.
- **E2**: decidir HTTPS. O se cablea `ensure_certs()` en el arranque y `USE_HTTPS` pasa a
  significar algo, o se borra `utils/https.py`, las claves de `settings.py:38-42` y
  `api/certs/`, y se corrige el texto de `LoginPage.jsx:125`.
- **E3**: usar las listas de `settings.py` en las validaciones de rutas y borrar los
  duplicados.
- **E4**: `get_db` debe usar `DB_PATH` de `settings.py`.
- **F1–F3**: borrar `AdminLayout.jsx`, `HomePage.jsx` y `LearningPathPage.jsx`, o
  enrutarlos; quitar o crear `/ayuda` y `/normas` en `SideMenu.jsx`.
- **F4**: borrar de `api.js` lo que no tiene consumidor, o cablear `createEvent`/audit
  donde corresponda (registrar intentos y moderaciones) para que las tablas dejen de
  estar vacías.
- Corregir el docstring de `room_manager.py:11-18` (`answer_result` → `answer_ack` +
  `question_results`) y el `activityBasePath` de `ActivityResultPage.jsx`.

---

## Verificación

Al terminar cada fase, con `start-debug.bat` levantado:

- **Fase 1**: subir un PDF en `/admin/recursos` y ver que aparece en «Mis recursos»;
  crear una sala desde `/admin/juegos` y comprobar que el QR se renderiza y que su URL
  abre desde otro dispositivo de la red; `python -c "import qrcode, PIL"` sin error.
- **Fase 2**: `curl -X POST /api/users -d '{"rol":"administrador",...}'` sin token →
  401/403; publicar como estudiante con `estado:"aprobada"` → queda `enviada`;
  `GET /api/publications?estado=enviada` sin token → 401/403; tras cerrar sesión,
  reutilizar el token viejo → 401.
- **Fase 3**: iniciar un quiz, esperar un minuto y enviarlo → `duracion_segundos > 0` en
  la tabla `intentos`; comparar la tira de logros de `/perfil` y `/mi-ruta` → idénticas.
- **Fase 4**: `python -m pytest api/tests` (existen `test_api.py`,
  `test_extended_audit.py`, `test_unified_quizzes.py`) y `npm run build` en `frontend/`
  sin errores.
