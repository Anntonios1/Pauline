"""Verifica GET /api/stats/export sobre HTTP real (uvicorn), no solo la
llamada directa al handler. stats_export() es la unica ruta que devuelve un
Response crudo en vez de un dict (ver dispatch() en app.py) — esto prueba
que ese bypass realmente entrega un CSV descargable con los headers
correctos a traves de todo el stack ASGI, algo que test_stats_export.py
(que llama al handler directamente) no puede comprobar.
"""

import http.client
import json
import os
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import uvicorn


def start_test_server(port=8998):
    config = uvicorn.Config("api.app:app", host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(30):
        if server.started:
            break
        time.sleep(0.1)
    return server


def main():
    test_db_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "test_temp_stats_export.db",
    )
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
    os.environ["DB_PATH"] = test_db_path

    from api.database.connection import init_db, get_db, close_db
    from api.utils.helpers import hash_password
    init_db(test_db_path)

    conn = get_db(test_db_path)
    try:
        conn.execute(
            "INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol, activo) VALUES (?, ?, ?, 'docente', 1)",
            ("DOCEXP01", "Docente HTTP Export", hash_password("SecurePass123")),
        )
        conn.commit()
    finally:
        close_db(conn)

    server = start_test_server()
    try:
        conn = http.client.HTTPConnection("127.0.0.1", 8998)
        conn.request(
            "POST", "/api/auth/login",
            json.dumps({"codigo": "DOCEXP01", "password": "SecurePass123"}),
            {"Content-Type": "application/json"},
        )
        resp = conn.getresponse()
        assert resp.status == 200, resp.status
        token = json.loads(resp.read().decode("utf-8"))["token"]
        conn.close()

        conn = http.client.HTTPConnection("127.0.0.1", 8998)
        conn.request("GET", "/api/stats/export", headers={"Authorization": f"Bearer {token}"})
        resp = conn.getresponse()
        assert resp.status == 200, resp.status
        content_type = resp.getheader("Content-Type") or ""
        assert "text/csv" in content_type, content_type
        disposition = resp.getheader("Content-Disposition") or ""
        assert "attachment" in disposition and ".csv" in disposition, disposition
        assert resp.getheader("X-Content-Type-Options") == "nosniff"
        body = resp.read().decode("utf-8-sig")
        conn.close()
        assert body.startswith("id,nombre_visible,codigo"), body[:100]

        # Sin token: 401, y sigue siendo JSON (no rompe el flujo normal de errores).
        conn = http.client.HTTPConnection("127.0.0.1", 8998)
        conn.request("GET", "/api/stats/export")
        resp = conn.getresponse()
        assert resp.status == 401, resp.status
        conn.close()

        print("OK: GET /api/stats/export responde CSV real con headers correctos")
    finally:
        server.should_exit = True
        time.sleep(0.3)
        if os.path.exists(test_db_path):
            os.remove(test_db_path)


if __name__ == "__main__":
    main()
