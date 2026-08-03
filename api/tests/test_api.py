import json
import http.client
import threading
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import uvicorn


def start_test_server(port=8999):
    config = uvicorn.Config("api.app:app", host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(30):
        if server.started:
            break
        time.sleep(0.1)
    return server


def request(method, path, body=None, token=None, port=8999):
    conn = http.client.HTTPConnection("127.0.0.1", port)
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body_json = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    conn.request(method, path, body_json, headers)
    resp = conn.getresponse()
    data = resp.read().decode("utf-8")
    conn.close()
    return resp.status, json.loads(data) if data else {}


def main():
    test_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "test_temp_blog.db")
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
    os.environ["DB_PATH"] = test_db_path
    
    from api.database.connection import init_db, get_db, close_db
    from api.utils.helpers import hash_password
    init_db(test_db_path)

    # POST /api/users exige rol administrador: se siembra uno directo en la DB temporal.
    conn = get_db(test_db_path)
    try:
        conn.execute(
            "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol, activo) VALUES (?, ?, ?, 'administrador', 1)",
            ("ADM001", "Administradora", hash_password("SecurePass123")),
        )
        conn.commit()
    finally:
        close_db(conn)

    server = start_test_server()
    try:
        # Login administrador (necesario para crear usuarios)
        status, login_admin = request("POST", "/api/auth/login", {"codigo": "ADM001", "password": "SecurePass123"})
        assert status == 200, login_admin
        token_admin = login_admin["token"]

        # Crear usuario docente
        status, docente = request("POST", "/api/users", {
            "codigo": "DOC001",
            "nombre_visible": "Profesora",
            "password": "SecurePass123",
            "rol": "docente",
        }, token=token_admin)
        assert status == 200, docente
        docente_id = docente["id"]

        # Login docente
        status, login_docente = request("POST", "/api/auth/login", {"codigo": "DOC001", "password": "SecurePass123"})
        assert status == 200, login_docente
        token_docente = login_docente["token"]

        # Crear curso
        status, curso = request("POST", "/api/courses", {"nombre": "5A", "grado": 5, "anio_escolar": 2026}, token=token_docente)
        assert status == 200, curso
        curso_id = curso["id"]

        # Crear categorias
        status, cat = request("POST", "/api/categories", {"nombre": "La pubertad", "area": "pubertad", "descripcion": "Cambios del cuerpo"}, token=token_docente)
        assert status == 200, cat
        categoria_id = cat["id"]

        # Crear usuario estudiante
        status, estudiante = request("POST", "/api/users", {
            "codigo": "EST001",
            "nombre_visible": "Estudiante",
            "password": "SecurePass123",
            "rol": "estudiante",
        }, token=token_admin)
        assert status == 200, estudiante
        estudiante_id = estudiante["id"]

        # Inscribir estudiante
        status, insc = request("POST", "/api/users/enroll", {"usuario_id": estudiante_id, "curso_id": curso_id, "rol_en_curso": "estudiante"}, token=token_docente)
        assert status == 200, insc

        # Login estudiante
        status, login = request("POST", "/api/auth/login", {"codigo": "EST001", "password": "SecurePass123"})
        assert status == 200, login
        token = login["token"]

        # Crear actividad
        status, actividad = request("POST", "/api/activities", {
            "titulo": "Quiz pubertad",
            "area": "pubertad",
            "categoria_id": categoria_id,
            "tipo": "quiz",
            "dificultad": "basica",
            "creado_por": docente_id,
        }, token=token_docente)
        assert status == 200, actividad
        actividad_id = actividad["id"]

        # Crear pregunta
        status, pregunta = request("POST", "/api/questions", {
            "actividad_id": actividad_id,
            "orden": 1,
            "tipo": "opcion_multiple",
            "enunciado": "Cual de estos es un cambio de la pubertad?",
            "opciones": json.dumps(["Crecimiento", "Dormir mas", "Comer menos"]),
            "respuesta_correcta": "Crecimiento",
            "explicacion": "Durante la pubertad el cuerpo crece.",
        }, token=token_docente)
        assert status == 200, pregunta
        pregunta_id = pregunta["id"]

        # Iniciar intento
        status, intento = request("POST", "/api/attempts", {"actividad_id": actividad_id}, token=token)
        assert status == 200, intento
        intento_id = intento["id"]

        # Enviar respuestas
        status, resultado = request("POST", f"/api/attempts/{intento_id}", {
            "respuestas": [
                {"pregunta_id": pregunta_id, "respuesta": "Crecimiento", "correcta": 1, "puntaje_obtenido": 1}
            ]
        }, token=token)
        assert status == 200, resultado
        assert resultado["intento"]["puntaje"] == 1

        # Progreso
        status, progreso = request("GET", "/api/progress", token=token)
        assert status == 200, progreso

        # Crear publicacion
        status, pub = request("POST", "/api/publications", {
            "titulo": "Cambios en la pubertad",
            "contenido": "Texto educativo",
            "categoria_id": categoria_id,
        }, token=token)
        assert status == 200, pub

        # Moderar publicacion
        status, mod = request("POST", f"/api/publications/{pub['id']}/moderate", {
            "docente_id": docente_id,
            "decision": "aprobar",
            "estado_nuevo": "aprobada",
        }, token=token_docente)
        assert status == 200, mod

        print("Pruebas API: OK")
    finally:
        server.should_exit = True
        if os.path.exists(test_db_path):
            try:
                os.remove(test_db_path)
            except Exception:
                pass


if __name__ == "__main__":
    main()
