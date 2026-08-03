"""
Auditoría extendida de seguridad y casos de borde — v2
Corre contra una DB temporal aislada, no toca blog.db.
"""
import json
import http.client
import threading
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import uvicorn

def start_test_server(port=8997):
    config = uvicorn.Config("api.app:app", host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    time.sleep(0.8)
    return server


def req(method, path, body=None, token=None, port=8997):
    conn = http.client.HTTPConnection("127.0.0.1", port)
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    conn.request(method, path, payload, headers)
    resp = conn.getresponse()
    data = resp.read().decode("utf-8")
    conn.close()
    return resp.status, json.loads(data) if data else {}


PASS = 0
FAIL = 0

def check(name, condition, actual_status=None, expected=None, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  [PASS] {name}")
    else:
        FAIL += 1
        msg = f"  [FAIL] {name}"
        if actual_status is not None and expected is not None:
            msg += f"  → esperado {expected}, obtenido {actual_status}"
        if detail:
            msg += f"  | {detail}"
        print(msg)


def main():
    test_db = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "test_audit_v2_temp.db"
    )
    if os.path.exists(test_db):
        os.remove(test_db)
    os.environ["DB_PATH"] = test_db

    from api.database.connection import init_db, get_db, close_db
    from api.utils.helpers import hash_password
    init_db(test_db)

    # POST /api/users exige rol administrador: se siembra uno directo en la DB temporal.
    conn = get_db(test_db)
    try:
        conn.execute(
            "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol, activo) VALUES (?, ?, ?, 'administrador', 1)",
            ("ADMV2", "Admin Auditoria", hash_password("SecurePass123")),
        )
        conn.commit()
    finally:
        close_db(conn)

    server = start_test_server()
    try:
        # ── Creación de usuarios ───────────────────────────────────────────────
        print("\n[1] Creación de usuarios")
        _, la = req("POST", "/api/auth/login", {"codigo": "ADMV2", "password": "SecurePass123"})
        tok_admin = la.get("token")

        # La ruta debe rechazar creación sin token o sin rol administrador.
        s, _ = req("POST", "/api/users", {"codigo": "NOAUTH", "nombre_visible": "X", "password": "SecurePass123", "rol": "administrador"})
        check("Crear usuario sin token → 401/403", s in (401, 403), s, "401/403")

        s, doc = req("POST", "/api/users", {"codigo": "DOCV2", "nombre_visible": "Profe Ana", "password": "SecurePass123", "rol": "docente"}, token=tok_admin)
        check("Crear docente", s == 200, s, 200)
        _, ld = req("POST", "/api/auth/login", {"codigo": "DOCV2", "password": "SecurePass123"})
        tok_doc = ld.get("token")

        s, est1 = req("POST", "/api/users", {"codigo": "ESTV2A", "nombre_visible": "Mario", "password": "SecurePass123", "rol": "estudiante"}, token=tok_admin)
        check("Crear estudiante A", s == 200, s, 200)
        _, le1 = req("POST", "/api/auth/login", {"codigo": "ESTV2A", "password": "SecurePass123"})
        tok_e1 = le1.get("token")

        s, est2 = req("POST", "/api/users", {"codigo": "ESTV2B", "nombre_visible": "Laura", "password": "SecurePass123", "rol": "estudiante"}, token=tok_admin)
        check("Crear estudiante B", s == 200, s, 200)
        _, le2 = req("POST", "/api/auth/login", {"codigo": "ESTV2B", "password": "SecurePass123"})
        tok_e2 = le2.get("token")

        # ── Validación de login incorrecto ─────────────────────────────────────
        print("\n[2] Autenticación")
        s, _ = req("POST", "/api/auth/login", {"codigo": "ESTV2A", "password": "wrongpass"})
        check("Login incorrecto → 401", s == 401, s, 401)

        s, _ = req("POST", "/api/auth/login", {})
        check("Login sin campos → 400", s == 400, s, 400)

        # ── Slug con acentos ───────────────────────────────────────────────────
        print("\n[3] Generación de slug con tildes")
        s, cat_acc = req("POST", "/api/categories",
                         {"nombre": "Fecundación y Gestación", "area": "fecundacion"}, token=tok_doc)
        check("Crear categoría con tildes", s == 200, s, 200)
        if s == 200:
            slug = cat_acc.get("slug", "")
            no_accents = all(c not in slug for c in "áéíóúñüÁÉÍÓÚÑÜ")
            has_dashes = "-" in slug
            check("Slug sin tildes ni caracteres especiales",
                  no_accents and has_dashes,
                  detail=f"slug={slug}")

        # ── Protección CRUD categorías ─────────────────────────────────────────
        print("\n[4] Seguridad — Categorías")
        s, cat = req("POST", "/api/categories", {"nombre": "Autocuidado", "area": "autocuidado"}, token=tok_doc)
        check("Docente crea categoría", s == 200, s, 200)
        cat_id = cat.get("id")

        s, _ = req("PUT", f"/api/categories/{cat_id}", {"nombre": "Hackeado"})
        check("PUT categoría sin auth → 401", s == 401, s, 401)

        s, _ = req("PUT", f"/api/categories/{cat_id}", {"nombre": "Hackeado"}, token=tok_e1)
        check("PUT categoría con token estudiante → 403", s == 403, s, 403)

        s, _ = req("PUT", f"/api/categories/{cat_id}", {"nombre": "Actualizado OK"}, token=tok_doc)
        check("PUT categoría con docente → 200", s == 200, s, 200)

        s, _ = req("POST", "/api/categories", {})  # sin token
        check("POST categoría sin auth → 401", s == 401, s, 401)

        # ── Protección CRUD cursos ─────────────────────────────────────────────
        print("\n[5] Seguridad — Cursos")
        s, curso = req("POST", "/api/courses", {"nombre": "5A", "grado": 5, "anio_escolar": 2026}, token=tok_doc)
        check("Docente crea curso", s == 200, s, 200)
        curso_id = curso.get("id")

        s, _ = req("PUT", f"/api/courses/{curso_id}", {"nombre": "Hackeado"})
        check("PUT curso sin auth → 401", s == 401, s, 401)

        s, _ = req("PUT", f"/api/courses/{curso_id}", {"nombre": "Hackeado"}, token=tok_e1)
        check("PUT curso con estudiante → 403", s == 403, s, 403)

        # ── Protección CRUD actividades ────────────────────────────────────────
        print("\n[6] Seguridad — Actividades")
        s, act = req("POST", "/api/activities", {
            "titulo": "Quiz Autocuidado", "area": "autocuidado",
            "tipo": "quiz", "dificultad": "basica"
        }, token=tok_doc)
        check("Docente crea actividad", s == 200, s, 200)
        act_id = act.get("id")

        s, _ = req("PATCH", f"/api/activities/{act_id}", {"titulo": "Hackeado"})
        check("PATCH actividad sin auth → 401", s == 401, s, 401)

        s, _ = req("PATCH", f"/api/activities/{act_id}", {"titulo": "Hackeado"}, token=tok_e1)
        check("PATCH actividad con estudiante → 403", s == 403, s, 403)

        s, _ = req("DELETE", f"/api/activities/{act_id}", token=tok_e1)
        check("DELETE actividad con estudiante → 403", s == 403, s, 403)

        # ── Payload vacío → 400, no 500 ───────────────────────────────────────
        print("\n[7] Validación de campos requeridos (sin 500)")
        s, r = req("POST", "/api/publications", {}, token=tok_e1)
        check("POST publicación vacía → 400", s == 400, s, 400, r)

        s, r = req("POST", "/api/activities", {}, token=tok_doc)
        check("POST actividad vacía → 400", s == 400, s, 400, r)

        s, r = req("POST", "/api/questions", {}, token=tok_doc)
        check("POST pregunta vacía → 400", s == 400, s, 400, r)

        s, r = req("POST", "/api/resources", {}, token=tok_doc)
        check("POST recurso vacío → 400", s == 400, s, 400, r)

        s, r = req("POST", "/api/attempts", {}, token=tok_e1)
        check("POST intento sin actividad_id → 400", s == 400, s, 400, r)

        # ── Ownership de intentos ──────────────────────────────────────────────
        print("\n[8] Aislamiento de intentos (ownership)")
        s, q = req("POST", "/api/questions", {
            "actividad_id": act_id, "orden": 1, "tipo": "verdadero_falso",
            "enunciado": "¿El agua es vital?",
            "opciones": json.dumps(["Verdadero", "Falso"]),
            "respuesta_correcta": "Verdadero"
        }, token=tok_doc)
        check("Docente crea pregunta", s == 200, s, 200)
        q_id = q.get("id")

        s, intento = req("POST", "/api/attempts", {"actividad_id": act_id}, token=tok_e1)
        check("Estudiante A inicia intento", s == 200, s, 200)
        intento_id = intento.get("id")

        s, r = req("POST", f"/api/attempts/{intento_id}",
                   {"respuestas": [{"pregunta_id": q_id, "respuesta": "Verdadero"}]},
                   token=tok_e2)
        check("Estudiante B NO puede responder intento de A → 403", s == 403, s, 403, r)

        s, r = req("POST", f"/api/attempts/{intento_id}",
                   {"respuestas": [{"pregunta_id": q_id, "respuesta": "Verdadero"}]},
                   token=tok_e1)
        check("Estudiante A responde su propio intento → 200", s == 200, s, 200)

        # Intentar responder de nuevo (ya completado)
        s, r = req("POST", f"/api/attempts/{intento_id}",
                   {"respuestas": [{"pregunta_id": q_id, "respuesta": "Verdadero"}]},
                   token=tok_e1)
        check("Re-submit de intento completado → 400", s == 400, s, 400, r)

        # ── intentos_maximos ──────────────────────────────────────────────────
        print("\n[9] Límite de intentos (intentos_maximos)")
        s, act2 = req("POST", "/api/activities", {
            "titulo": "Quiz 1 intento", "area": "autocuidado",
            "tipo": "quiz", "dificultad": "basica", "intentos_maximos": 1
        }, token=tok_doc)
        check("Crear actividad con intentos_maximos=1", s == 200, s, 200)
        act2_id = act2.get("id")

        s, q2 = req("POST", "/api/questions", {
            "actividad_id": act2_id, "orden": 1, "tipo": "verdadero_falso",
            "enunciado": "¿El sol sale por el este?",
            "opciones": json.dumps(["Verdadero", "Falso"]),
            "respuesta_correcta": "Verdadero"
        }, token=tok_doc)
        q2_id = q2.get("id")

        s, it2 = req("POST", "/api/attempts", {"actividad_id": act2_id}, token=tok_e1)
        check("Primer intento → 200", s == 200, s, 200)
        req("POST", f"/api/attempts/{it2['id']}",
            {"respuestas": [{"pregunta_id": q2_id, "respuesta": "Verdadero"}]}, token=tok_e1)

        s, r = req("POST", "/api/attempts", {"actividad_id": act2_id}, token=tok_e1)
        check("Segundo intento cuando intentos_maximos=1 → 400", s == 400, s, 400, r)

        # ── Protección de publicaciones ────────────────────────────────────────
        print("\n[10] Seguridad — Publicaciones")
        s, pub = req("POST", "/api/publications",
                     {"titulo": "Mi vida en la pubertad", "contenido": "Reflexiones..."}, token=tok_e1)
        check("Estudiante A crea publicación → 200", s == 200, s, 200)
        pub_id = pub.get("id")

        s, _ = req("PUT", f"/api/publications/{pub_id}", {"titulo": "Hackeado"})
        check("PUT publicación sin auth → 401", s == 401, s, 401)

        s, _ = req("PUT", f"/api/publications/{pub_id}", {"titulo": "Hackeado por B"}, token=tok_e2)
        check("PUT publicación de A por estudiante B → 403", s == 403, s, 403)

        s, _ = req("PUT", f"/api/publications/{pub_id}", {"titulo": "Actualizado por autor"}, token=tok_e1)
        check("PUT publicación del propio autor → 200", s == 200, s, 200)

        # Estudiante no puede cambiar estado directamente
        s, r = req("PUT", f"/api/publications/{pub_id}", {"estado": "aprobada"}, token=tok_e1)
        check("Estudiante intenta cambiar estado directamente → ignorado (200, estado intacto)",
              s == 200 and r.get("estado") != "aprobada", detail=f"estado={r.get('estado')}")

        # ── Escalada de roles ─────────────────────────────────────────────────
        print("\n[11] Escalada de roles")
        s, r = req("PUT", f"/api/users/{est1['id']}", {"rol": "administrador"}, token=tok_e1)
        check("Estudiante NO puede cambiar su propio rol → ignorado (200, rol intacto)",
              s == 200 and r.get("rol") == "estudiante", detail=f"rol={r.get('rol')}")

        # ── /api/users no filtra password_hash ────────────────────────────────
        print("\n[12] Protección de datos sensibles")
        s, usuarios = req("GET", "/api/users", token=tok_doc)
        if isinstance(usuarios, list) and len(usuarios) > 0:
            has_hash = any("password_hash" in u for u in usuarios)
            check("GET /api/users no expone password_hash", not has_hash,
                  detail="password_hash encontrado en respuesta" if has_hash else "")
        else:
            check("GET /api/users lista usuarios", s == 200, s, 200)

        s, user_detail = req("GET", f"/api/users/{est1['id']}", token=tok_doc)
        check("GET /api/users/:id no expone password_hash",
              "password_hash" not in user_detail, detail=str(user_detail.keys()))

        # ── Eventos sin autenticación ─────────────────────────────────────────
        print("\n[13] Seguridad — Eventos")
        s, _ = req("POST", "/api/events", {"verbo": "accessed", "objeto_tipo": "actividad", "objeto_id": 1})
        check("POST /api/events sin auth → 401", s == 401, s, 401)

        s, _ = req("POST", "/api/events", {"verbo": "accessed"}, token=tok_e1)
        check("POST /api/events faltan campos → 400", s == 400, s, 400)

        # ── Progreso ──────────────────────────────────────────────────────────
        print("\n[14] Progreso del estudiante")
        s, prog = req("GET", "/api/progress", token=tok_e1)
        check("GET /api/progress → 200 con lista", s == 200 and isinstance(prog, list), s, 200)
        if isinstance(prog, list) and len(prog) > 0:
            check("Progreso incluye campo porcentaje", "mejor_porcentaje" in prog[0],
                  detail=str(list(prog[0].keys())))

    finally:
        server.should_exit = True
        if os.path.exists(test_db):
            try:
                os.remove(test_db)
            except Exception:
                pass

    print(f"\n{'='*55}")
    print(f"  TOTAL: {PASS + FAIL} pruebas   ✅ {PASS} PASS   ❌ {FAIL} FAIL")
    print(f"{'='*55}\n")
    if FAIL > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
