# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

AulaRed — an educational platform ("Plataforma EdTech") for a course on human reproduction/sexual education. Students consume publications, resources, and quiz-based activities; teachers/admins create and moderate content and run live quiz games. All domain code, comments, and API payloads are in Spanish.

Two independent apps in this repo:
- `api/` — Python FastAPI backend, SQLite storage.
- `frontend/` — React 18 + Vite + Tailwind CSS SPA.

## Commands

### Backend (`api/`)
Run from the **repo root** (the code does `sys.path.insert` assuming root as cwd):
```bash
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload
```
Or directly: `python api/app.py` (no reload, port 8000).

Install deps: `pip install -r api/requirements.txt` — includes `python-multipart`, required by
FastAPI/Starlette to parse `multipart/form-data`. Without it every file upload (avatar, quiz
media, resource media, publication covers) fails at runtime with 400 "Multipart invalido",
silently, because the unit tests call route handlers directly with pre-parsed bodies and never
exercise real HTTP multipart parsing. If uploads break with that error, `pip install python-multipart`
and restart uvicorn.

Tests are plain scripts, not pytest — each spins up its own uvicorn instance on a throwaway port against a temp SQLite DB and exercises the HTTP API with `http.client`, run individually:
```bash
python api/tests/test_api.py
python api/tests/test_unified_quizzes.py
python api/tests/test_extended_audit.py
python api/tests/test_security_regressions.py
python api/tests/test_live.py
```

`test_unified_quizzes.py`, `test_security_regressions.py` y `test_avatar_encryption.py` son
`unittest` (DB temporal por test, llamadas directas a los handlers, sin servidor HTTP); los
demás levantan uvicorn. `test_security_regressions.py` cubre control de acceso: escalada de
rol, solucionario legacy oculto al estudiante, borradores ajenos y endpoints que exigen staff.
`test_avatar_encryption.py` cubre que la foto de perfil (`imagen_perfil`, subida por
`POST /api/users/me/avatar`, cualquier rol) se guarda cifrada en disco con AES-256-GCM
(`api/utils/upload.py: encrypt_and_save_avatar`/`decrypt_avatar`, extensión `.avatarenc`) y se
descifra solo al servirla por `/uploads/`; aísla `UPLOAD_DIR` con `unittest.mock.patch` porque,
a diferencia de `DB_PATH`, no es configurable por variable de entorno.
There is no single-test-function runner — each file's `main()` runs a fixed sequence of assertions end-to-end; read the file to run only part of it.

### Frontend (`frontend/`)
```bash
cd frontend
npm install
npm run dev       # http://localhost:5173, proxies /api, /uploads, /ws to :8000
npm run build
npm run preview
```
No test suite or linter is configured for the frontend.

### Running both together
`start-debug.bat` starts backend (uvicorn, port 8000, debug logging) and frontend (Vite, port 5173) as background processes, reusing them if already running, and writes logs to `logs/backend.log` / `logs/frontend.log`.

## Architecture

### Backend: FastAPI is a thin shim over a pre-existing handler registry
`api/app.py` does **not** define per-route FastAPI endpoints. Instead:
- A single catch-all route (`/api/{rest_of_path:path}`) parses the request into `(handler_adapter, params, query, body)` and dispatches it through `routes_registry` (`api/routes/__init__.py`), a flat list of `(compiled_regex, methods, handler_fn)` tuples aggregated from each `api/routes/*.py` module.
- `RequestAdapter` wraps `fastapi.Request` so route handlers only ever see `.headers` and `.client_address` — this is a compatibility shim left over from a prior `http.server`-based implementation; handler functions are written against that narrower interface, not against FastAPI/Starlette directly.
- Route handler signature is always `handler(handler, params, query, body) -> dict | (dict, status_code)`. Returning a plain dict implies HTTP 200.
- Adding an endpoint means adding a regex/method/function tuple to a routes module's `routes` list (or creating a new module and extending it in `api/routes/__init__.py`), not adding a FastAPI decorator.
- Layering is `routes/*.py` (HTTP concerns, auth/permission checks) → `services/*.py` (business logic, one module per domain entity) → `database/connection.py` (raw `sqlite3`, no ORM). `list_to_dicts` converts a list of `sqlite3.Row` results; for a single row use `dict(row)` directly.
- Auth is a bearer token issued at login and stored server-side in a `sesiones` table (`services/sessions.py`), not JWT. `require_auth(handler)` / `get_user_from_token(handler)` in `routes/auth.py` are the shared guards other route modules import.
- `api/database/connection.py`'s `init_db()` runs on every app startup: it executes `schema.sql` (idempotent `CREATE TABLE IF NOT EXISTS`) then applies hand-written `ALTER TABLE` / table-rebuild migrations (`_ensure_quiz_columns`, `_ensure_quiz_media_video_support`, `_ensure_room_columns`) for schema changes SQLite's `IF NOT EXISTS` can't express. When changing an existing table's shape, add a similar guarded migration function rather than editing `schema.sql`'s `CREATE TABLE` in a way that breaks existing databases — it never drops data.
- `blog.db` (SQLite file, repo root) is the live database; `DB_PATH` env var overrides it (tests point it at a temp file per run). `schema.sql` at repo root is the canonical schema.
- Real-time quiz games run over a WebSocket at `/ws/room/{room_code}`, handled entirely by `api/websocket/room_manager.py` (`RoomManager`/`RoomState`/`PlayerState`) — join/start/answer/next/end message protocol documented in that file's docstring and mirrored in `app.py`'s websocket route docstring. This is unrelated to the REST `routes_registry` dispatch path.
- Config/constants (allowed areas, publication states, difficulties, moderation decisions, upload MIME allow-lists, rate limiting) live in `api/config/settings.py` — check there before hardcoding a valid-values list elsewhere. Only lists with a real reader live there; roles/question-types/attempt-states are validated inline where they're used.
- Quiz content has two generations: legacy `preguntas`/`intentos` tables and a newer unified engine (`quizzes`, `quiz_items`, `quiz_opciones`, `quiz_media_assets`, `quiz_versions`, `quiz_respuestas_intento`) — `database/reset_legacy_quizzes.py` and `services/quizzes.py` relate to the migration between them.

### Frontend: role-based routing over two layouts, contexts for state
- `App.jsx` defines two parallel route trees under one `<Routes>`: student routes at `/` (`StudentLayout`) and teacher/admin routes at `/admin` (`TeacherLayout`), each gated by `ProtectedRoute` (optionally with `allowedRoles`). Many page components (e.g. `PublicationsPage`, `ActivitiesPage`) are reused verbatim under both trees.
- Global state is via React Context, not a store library: `AuthContext` (token + user in `localStorage`, exposes `login`/`logout`/`updateUser`), `DataContext` (categories/publications/activities/resources/progress, plus a moderation queue populated only for `docente`/`administrador` roles), `WebSocketContext` (live game connection).
- All backend calls go through `frontend/src/services/api.js` — a single `fetchWithAuth` wrapper (attaches bearer token from `localStorage`, prefixes `/api`, throws on non-OK responses) with one exported function per endpoint. Add new endpoints here rather than calling `fetch` directly from components.
- The live quiz/game UI is `frontend/src/engines/UnifiedQuiz/` and `frontend/src/engines/GameEngine.jsx`, driven by the `/ws/room/:code` protocol via `WebSocketContext`.
- Dev server (`vite.config.js`) proxies `/api`, `/uploads`, and `/ws` to `http://127.0.0.1:8000` and logs every proxied request/response to the console — the backend must be running for frontend dev to do anything beyond static routing.
