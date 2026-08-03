"""Crea 7 estudiantes de ejemplo (EST002-EST008) con credenciales.

Uso:  python -m api.database.seed_students
Idempotente: si un codigo ya existe, no lo vuelve a crear.
Contraseña por defecto para todos: estudiante123  (debe cambiarse al ingresar).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, close_db
from api.utils.helpers import hash_password

DEFAULT_PASSWORD = "estudiante123"

ESTUDIANTES = [
    ("EST002", "Juan Martinez"),
    ("EST003", "Valentina Gomez"),
    ("EST004", "Mateo Rodriguez"),
    ("EST005", "Camila Torres"),
    ("EST006", "Sebastian Lopez"),
    ("EST007", "Isabella Vargas"),
    ("EST008", "Santiago Cruz"),
]


def main():
    creados = 0
    conn = get_db()
    try:
        for codigo, nombre in ESTUDIANTES:
            existe = conn.execute("SELECT id FROM usuarios WHERE codigo = ?", (codigo,)).fetchone()
            if existe:
                continue
            conn.execute(
                """
                INSERT INTO usuarios (codigo, nombre_visible, password_hash, rol, activo)
                VALUES (?, ?, ?, 'estudiante', 1)
                """,
                (codigo, nombre, hash_password(DEFAULT_PASSWORD)),
            )
            creados += 1
        conn.commit()
    finally:
        close_db(conn)

    print(f"Estudiantes creados: {creados}")
    print(f"Total en lista: {len(ESTUDIANTES)}")
    print(f"Contrasena por defecto: {DEFAULT_PASSWORD}")
    print("Codigo\tNombre")
    for codigo, nombre in ESTUDIANTES:
        print(f"{codigo}\t{nombre}")


if __name__ == "__main__":
    main()