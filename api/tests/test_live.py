import json
import ssl
import http.client

BASE = ("localhost", 8000)


def req(method, path, body=None, token=None):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    conn = http.client.HTTPSConnection(*BASE, context=ctx)
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    conn.request(method, path, payload, headers)
    resp = conn.getresponse()
    data = resp.read().decode("utf-8")
    conn.close()
    return resp.status, json.loads(data) if data else {}


def check(name, status, expected=200):
    ok = status == expected
    print(f"[{'OK' if ok else 'FAIL'}] {name} ({status})")
    return ok


def main():
    # 1. Crear docente
    s, d = req("POST", "/api/users", {
        "codigo": "DOC001", "nombre_visible": "Profesora Marta",
        "password": "SecurePass123",
        "rol": "docente"})
    check("Crear docente", s)
    docente_id = d.get("id")

    # 2. Login docente
    s, ld = req("POST", "/api/auth/login", {"codigo": "DOC001", "password": "SecurePass123"})
    check("Login docente", s)
    token_d = ld.get("token")

    # 3. Crear curso
    s, c = req("POST", "/api/courses", {"nombre": "Quinto A", "grado": 5, "anio_escolar": 2026}, token=token_d)
    check("Crear curso", s)
    curso_id = c.get("id")

    # 4. Crear categorias
    cats = [
        ("Conociendo mi cuerpo", "cuerpo_humano"),
        ("La pubertad", "pubertad"),
        ("Fecundacion", "fecundacion"),
    ]
    cat_ids = {}
    for nombre, area in cats:
        s, cat = req("POST", "/api/categories", {"nombre": nombre, "area": area}, token=token_d)
        check(f"Crear categoria {nombre}", s)
        cat_ids[area] = cat.get("id")

    # 5. Crear estudiante
    s, e = req("POST", "/api/users", {
        "codigo": "EST001", "nombre_visible": "Sofia Herrera",
        "password": "SecurePass123",
        "rol": "estudiante"})
    check("Crear estudiante", s)
    est_id = e.get("id")

    # 6. Inscribir
    s, _ = req("POST", "/api/users/enroll",
               {"usuario_id": est_id, "curso_id": curso_id, "rol_en_curso": "estudiante"}, token=token_d)
    check("Inscribir estudiante", s)

    # 7. Login estudiante
    s, le = req("POST", "/api/auth/login", {"codigo": "EST001", "password": "SecurePass123"})
    check("Login estudiante", s)
    token_e = le.get("token")

    # 8. Crear actividad
    s, a = req("POST", "/api/activities", {
        "titulo": "Quiz: Cambios de la pubertad",
        "descripcion": "Identifica los cambios normales de la pubertad",
        "instrucciones": "Lee cada pregunta y elige la respuesta",
        "area": "pubertad", "categoria_id": cat_ids["pubertad"],
        "tipo": "quiz", "dificultad": "basica", "intentos_maximos": 3,
        "creado_por": docente_id}, token=token_d)
    check("Crear actividad", s)
    act_id = a.get("id")

    # 9. Crear preguntas
    preguntas = [
        (1, "opcion_multiple", "¿Cual es un cambio comun de la pubertad?",
         json.dumps(["Crecer de estatura", "Perder la memoria", "No dormir nunca"], ensure_ascii=False),
         "Crecer de estatura", "Es normal crecer rapido durante la pubertad."),
        (2, "verdadero_falso", "Las hormonas son mensajeros quimicos del cuerpo.",
         json.dumps(["Verdadero", "Falso"]), "Verdadero", "Las hormonas indican al cuerpo como crecer."),
    ]
    q_ids = []
    for orden, tipo, enunciado, opciones, resp, expl in preguntas:
        s, q = req("POST", "/api/questions", {
            "actividad_id": act_id, "orden": orden, "tipo": tipo, "enunciado": enunciado,
            "opciones": opciones, "respuesta_correcta": resp, "explicacion": expl}, token=token_d)
        check(f"Crear pregunta {orden}", s)
        q_ids.append(q.get("id"))

    # 10. Iniciar intento
    s, it = req("POST", "/api/attempts", {"actividad_id": act_id}, token=token_e)
    check("Iniciar intento", s)
    intento_id = it.get("id")

    # 11. Enviar respuestas
    s, res = req("POST", f"/api/attempts/{intento_id}", {"respuestas": [
        {"pregunta_id": q_ids[0], "respuesta": "Crecer de estatura"},
        {"pregunta_id": q_ids[1], "respuesta": "Verdadero"},
    ]}, token=token_e)
    check("Enviar respuestas", s)
    print("   puntaje:", res.get("intento", {}).get("puntaje"), "/", res.get("intento", {}).get("puntaje_maximo"),
          "porcentaje:", res.get("intento", {}).get("porcentaje"))

    # 12. Progreso
    s, prog = req("GET", "/api/progress", token=token_e)
    check("Progreso estudiante", s)
    print("   progreso:", prog)

    # 13. Crear publicacion
    s, pub = req("POST", "/api/publications", {
        "titulo": "Que es la pubertad",
        "contenido": "<p>La pubertad es una etapa natural del crecimiento.</p>",
        "categoria_id": cat_ids["pubertad"]}, token=token_e)
    check("Crear publicacion", s)
    pub_id = pub.get("id")

    # 14. Moderar publicacion
    s, mod = req("POST", f"/api/publications/{pub_id}/moderate", {
        "docente_id": docente_id, "decision": "aprobar", "estado_nuevo": "aprobada"}, token=token_d)
    check("Moderar publicacion", s)

    # 15. Listar publicaciones aprobadas
    s, pubs = req("GET", "/api/publications")
    check("Listar publicaciones aprobadas", s)
    print("   total:", len(pubs))

    # 16. Login con datos incorrectos
    s, _ = req("POST", "/api/auth/login", {"codigo": "EST001", "password": "incorrecta"})
    check("Login incorrecto rechazado", s, expected=401)

    # 17. Verificar hash bcrypt (no SHA256)
    import sqlite3
    conn = sqlite3.connect("blog.db")
    row = conn.execute("SELECT password_hash FROM usuarios WHERE codigo = ?", ("EST001",)).fetchone()
    conn.close()
    check("Password hash usa bcrypt", 1 if row and row[0].startswith("$2") else 0, expected=1)

    print("\nFlujo completo de prueba finalizado")


if __name__ == "__main__":
    main()
