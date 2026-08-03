"""Sembrado de actividades y preguntas de ejemplo.

Ejecuta:  python -m api.database.seed_activities
(o:        python api/database/seed_activities.py)

Es idempotente: si una actividad o pregunta ya existe (mismo titulo,
o mismo (actividad_id, orden)) no la vuelve a crear. Sirve para tener
contenido variado con el que probar el flujo de actividades y los logros.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, close_db

DOCENTE_ID = 1  # Maestra Marta Lopez (rol docente)

# ---------------------------------------------------------------------
# Preguntas para actividades ya existentes (id 1..4 en la BD)
# ---------------------------------------------------------------------
EXTRA_PREGUNTAS_EXISTENTES = {
    # Quiz: Cambios de la pubertad (pubertad)
    1: [
        {
            "orden": 3,
            "tipo": "opcion_multiple",
            "enunciado": "¿Cuál glándula del cerebro inicia muchos cambios de la pubertad?",
            "opciones": ["Hipófisis", "Corazón", "Pulmón"],
            "respuesta_correcta": "Hipófisis",
            "explicacion": "La hipófisis libera hormonas que inician la pubertad.",
            "puntaje": 1,
        },
    ],
    # Verdadero o falso: Órganos reproductores (sistema reproductor femenino)
    2: [
        {
            "orden": 1,
            "tipo": "verdadero_falso",
            "enunciado": "Los ovarios producen óvulos y hormonas.",
            "opciones": ["Verdadero", "Falso"],
            "respuesta_correcta": "Verdadero",
            "explicacion": "Los ovarios producen los óvulos y hormonas femeninas.",
            "puntaje": 1,
        },
        {
            "orden": 2,
            "tipo": "verdadero_falso",
            "enunciado": "El útero es el órgano donde puede desarrollarse un bebé.",
            "opciones": ["Verdadero", "Falso"],
            "respuesta_correcta": "Verdadero",
            "explicacion": "El útero es un órgano muscular que protege al bebé durante el embarazo.",
            "puntaje": 1,
        },
        {
            "orden": 3,
            "tipo": "verdadero_falso",
            "enunciado": "Las trompas de Falopio producen espermatozoides.",
            "opciones": ["Verdadero", "Falso"],
            "respuesta_correcta": "Falso",
            "explicacion": "Los espermatozoides los producen los testículos. Las trompas transportan el óvulo.",
            "puntaje": 1,
        },
    ],
    # La fecundación paso a paso (fecundacion)
    3: [
        {
            "orden": 1,
            "tipo": "opcion_multiple",
            "enunciado": "¿Dónde ocurre habitualmente la fecundación?",
            "opciones": ["En la trompa de Falopio", "En el útero", "En el ovario"],
            "respuesta_correcta": "En la trompa de Falopio",
            "explicacion": "El óvulo y el espermatozoide se encuentran en la trompa de Falopio.",
            "puntaje": 1,
        },
        {
            "orden": 2,
            "tipo": "opcion_multiple",
            "enunciado": "¿Qué célula masculina fecunda al óvulo?",
            "opciones": ["Espermatozoide", "Neurona", "Glóbulo rojo"],
            "respuesta_correcta": "Espermatozoide",
            "explicacion": "El espermatozoide es la célula reproductora masculina.",
            "puntaje": 1,
        },
        {
            "orden": 3,
            "tipo": "opcion_multiple",
            "enunciado": "Tras la fecundación, ¿dónde se implanta el óvulo fecundado?",
            "opciones": ["En el útero", "En el ovario", "En la trompa"],
            "respuesta_correcta": "En el útero",
            "explicacion": "El óvulo fecundado viaja al útero y se implanta allí para desarrollarse.",
            "puntaje": 1,
        },
    ],
    # Autocuidado y límites personales (autocuidado, reflexión)
    4: [
        {
            "orden": 1,
            "tipo": "respuesta_corta",
            "enunciado": "Escribe una acción que te ayude a cuidar tu cuerpo.",
            "opciones": None,
            "respuesta_correcta": "",
            "explicacion": "Cuidar el cuerpo incluye higiene, alimentación, descanso y pedir ayuda cuando la necesitas.",
            "puntaje": 1,
        },
        {
            "orden": 2,
            "tipo": "respuesta_corta",
            "enunciado": "Menciona una persona de confianza a quien pedir ayuda si te sientes incómodo.",
            "opciones": None,
            "respuesta_correcta": "",
            "explicacion": "Hablar con un familiar, docente o adulto de confianza es una buena forma de pedir ayuda.",
            "puntaje": 1,
        },
    ],
}

# ---------------------------------------------------------------------
# Nuevas actividades (con sus preguntas)
#   Nuevas formas de crear y usar actividades: quiz, verdadero_falso,
#   completar, ordenar... distribuidas en distintas áreas.
# ---------------------------------------------------------------------
NUEVAS_ACTIVIDADES = [
    {
        "titulo": "Quiz: Mi cuerpo",
        "descripcion": "Pon a prueba lo que sabes sobre el cuerpo humano y sus órganos.",
        "instrucciones": "Lee cada pregunta y elige la respuesta correcta.",
        "area": "cuerpo_humano",
        "categoria_id": 1,
        "tipo": "quiz",
        "dificultad": "basica",
        "intentos_maximos": 3,
        "preguntas": [
            {
                "orden": 1,
                "tipo": "opcion_multiple",
                "enunciado": "¿Cuál es el órgano que bombea la sangre?",
                "opciones": ["Corazón", "Estómago", "Hígado"],
                "respuesta_correcta": "Corazón",
                "explicacion": "El corazón bombea la sangre por todo el cuerpo.",
                "puntaje": 1,
            },
            {
                "orden": 2,
                "tipo": "opcion_multiple",
                "enunciado": "¿Qué órganos usamos para respirar?",
                "opciones": ["Pulmones", "Riñones", "Páncreas"],
                "respuesta_correcta": "Pulmones",
                "explicacion": "Los pulmones permiten el intercambio de oxígeno y dióxido de carbono.",
                "puntaje": 1,
            },
            {
                "orden": 3,
                "tipo": "opcion_multiple",
                "enunciado": "El cerebro forma parte del...",
                "opciones": ["Sistema nervioso", "Sistema digestivo", "Sistema reproductor"],
                "respuesta_correcta": "Sistema nervioso",
                "explicacion": "El cerebro controla el cuerpo y forma parte del sistema nervioso.",
                "puntaje": 1,
            },
        ],
    },
    {
        "titulo": "Verdadero o falso: Sistema reproductor masculino",
        "descripcion": "Evalúa si cada afirmación sobre el sistema reproductor masculino es verdadera o falsa.",
        "instrucciones": "Selecciona Verdadero o Falso en cada afirmación.",
        "area": "sistema_reproductor_masculino",
        "categoria_id": 4,
        "tipo": "verdadero_falso",
        "dificultad": "media",
        "intentos_maximos": 3,
        "preguntas": [
            {
                "orden": 1,
                "tipo": "verdadero_falso",
                "enunciado": "Los testículos producen espermatozoides.",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": "Verdadero",
                "explicacion": "Los testículos producen los espermatozoides y hormonas masculinas.",
                "puntaje": 1,
            },
            {
                "orden": 2,
                "tipo": "verdadero_falso",
                "enunciado": "La próstata es parte del sistema reproductor masculino.",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": "Verdadero",
                "explicacion": "La próstata produce parte del líquido seminal.",
                "puntaje": 1,
            },
            {
                "orden": 3,
                "tipo": "verdadero_falso",
                "enunciado": "Los ovarios pertenecen al sistema reproductor masculino.",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": "Falso",
                "explicacion": "Los ovarios pertenecen al sistema reproductor femenino.",
                "puntaje": 1,
            },
        ],
    },
    {
        "titulo": "Completar: Células reproductoras",
        "descripcion": "Completa cada frase con la célula reproductora correcta.",
        "instrucciones": "Elige la opción que completa correctamente cada frase.",
        "area": "celulas_reproductoras",
        "categoria_id": 5,
        "tipo": "completar",
        "dificultad": "media",
        "intentos_maximos": 3,
        "preguntas": [
            {
                "orden": 1,
                "tipo": "opcion_multiple",
                "enunciado": "La célula reproductora femenina se llama ____.",
                "opciones": ["Óvulo", "Espermatozoide", "Neurona"],
                "respuesta_correcta": "Óvulo",
                "explicacion": "El óvulo es la célula reproductora femenina.",
                "puntaje": 1,
            },
            {
                "orden": 2,
                "tipo": "opcion_multiple",
                "enunciado": "La célula reproductora masculina se llama ____.",
                "opciones": ["Espermatozoide", "Óvulo", "Bacteria"],
                "respuesta_correcta": "Espermatozoide",
                "explicacion": "El espermatozoide es la célula reproductora masculina.",
                "puntaje": 1,
            },
            {
                "orden": 3,
                "tipo": "opcion_multiple",
                "enunciado": "Las células reproductoras también se llaman células ____.",
                "opciones": ["Sexuales", "Musculares", "Nerviosas"],
                "respuesta_correcta": "Sexuales",
                "explicacion": "Óvulo y espermatozoide son las células sexuales o reproductoras.",
                "puntaje": 1,
            },
        ],
    },
    {
        "titulo": "Ordena: Embarazo y nacimiento",
        "descripcion": "Sigue la secuencia del embarazo y el nacimiento paso a paso.",
        "instrucciones": "Elige el siguiente paso correcto en cada etapa.",
        "area": "embarazo",
        "categoria_id": 6,
        "tipo": "ordenar",
        "dificultad": "avanzada",
        "intentos_maximos": 2,
        "preguntas": [
            {
                "orden": 1,
                "tipo": "opcion_multiple",
                "enunciado": "Tras la fecundación, ¿cuál es el siguiente paso?",
                "opciones": ["El óvulo fecundado viaja al útero", "El bebé nace", "La madre amamanta"],
                "respuesta_correcta": "El óvulo fecundado viaja al útero",
                "explicacion": "El óvulo fecundado viaja hasta el útero para implantarse.",
                "puntaje": 1,
            },
            {
                "orden": 2,
                "tipo": "opcion_multiple",
                "enunciado": "¿Cuánto dura aproximadamente un embarazo?",
                "opciones": ["9 meses", "1 mes", "3 años"],
                "respuesta_correcta": "9 meses",
                "explicacion": "Un embarazo dura alrededor de 9 meses.",
                "puntaje": 1,
            },
            {
                "orden": 3,
                "tipo": "opcion_multiple",
                "enunciado": "Al final del embarazo ocurre el...",
                "opciones": ["Nacimiento", "Fecundación", "Apareamiento"],
                "respuesta_correcta": "Nacimiento",
                "explicacion": "El nacimiento es el momento en que el bebé sale del útero.",
                "puntaje": 1,
            },
        ],
    },
    {
        "titulo": "Quiz: Preguntas frecuentes",
        "descripcion": "Responde dudas comunes sobre el cuerpo y la pubertad.",
        "instrucciones": "Elige la respuesta que consideres correcta.",
        "area": "preguntas_frecuentes",
        "categoria_id": 8,
        "tipo": "quiz",
        "dificultad": "basica",
        "intentos_maximos": 3,
        "preguntas": [
            {
                "orden": 1,
                "tipo": "opcion_multiple",
                "enunciado": "¿Es normal tener dudas sobre el cuerpo?",
                "opciones": ["Sí, todos las tenemos", "No, nadie las tiene", "Solo los adultos"],
                "respuesta_correcta": "Sí, todos las tenemos",
                "explicacion": "Es natural tener dudas; lo importante es resolverlas con fuentes confiables.",
                "puntaje": 1,
            },
            {
                "orden": 2,
                "tipo": "opcion_multiple",
                "enunciado": "¿A quién puedes preguntar tus dudas?",
                "opciones": ["A un docente o familiar de confianza", "A cualquier desconocido", "A nadie"],
                "respuesta_correcta": "A un docente o familiar de confianza",
                "explicacion": "Busca siempre a un adulto de confianza para tus dudas.",
                "puntaje": 1,
            },
            {
                "orden": 3,
                "tipo": "opcion_multiple",
                "enunciado": "La pubertad suele comenzar entre los...",
                "opciones": ["8 y 14 años", "30 y 40 años", "0 y 2 años"],
                "respuesta_correcta": "8 y 14 años",
                "explicacion": "La pubertad comienza generalmente entre los 8 y 14 años.",
                "puntaje": 1,
            },
        ],
    },
    {
        "titulo": "Verdadero o falso: El nacimiento",
        "descripcion": "Identifica si cada afirmación sobre el nacimiento es verdadera o falsa.",
        "instrucciones": "Selecciona Verdadero o Falso.",
        "area": "nacimiento",
        "categoria_id": 6,
        "tipo": "verdadero_falso",
        "dificultad": "media",
        "intentos_maximos": 3,
        "preguntas": [
            {
                "orden": 1,
                "tipo": "verdadero_falso",
                "enunciado": "El útero protege al bebé durante el embarazo.",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": "Verdadero",
                "explicacion": "El útero es el órgano que protege y alberga al bebé.",
                "puntaje": 1,
            },
            {
                "orden": 2,
                "tipo": "verdadero_falso",
                "enunciado": "La placenta pasa nutrientes y oxígeno al bebé.",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": "Verdadero",
                "explicacion": "La placenta aporta nutrientes y oxígeno al bebé.",
                "puntaje": 1,
            },
            {
                "orden": 3,
                "tipo": "verdadero_falso",
                "enunciado": "El bebé respira aire dentro del útero.",
                "opciones": ["Verdadero", "Falso"],
                "respuesta_correcta": "Falso",
                "explicacion": "Dentro del útero el bebé recibe oxígeno a través de la placenta.",
                "puntaje": 1,
            },
        ],
    },
]


def _existe_actividad(conn, titulo):
    row = conn.execute("SELECT id FROM actividades WHERE titulo = ?", (titulo,)).fetchone()
    return row["id"] if row else None


def _existe_pregunta(conn, actividad_id, orden):
    row = conn.execute(
        "SELECT id FROM preguntas WHERE actividad_id = ? AND orden = ?",
        (actividad_id, orden),
    ).fetchone()
    return row is not None


def _insertar_pregunta(conn, actividad_id, p):
    if _existe_pregunta(conn, actividad_id, p["orden"]):
        return False
    opciones = p.get("opciones")
    opciones_json = json.dumps(opciones, ensure_ascii=False) if opciones is not None else None
    conn.execute(
        """
        INSERT INTO preguntas (actividad_id, orden, tipo, enunciado, opciones, respuesta_correcta,
                               explicacion, imagen_url, puntaje, obligatoria)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)
        """,
        (
            actividad_id,
            p["orden"],
            p["tipo"],
            p["enunciado"],
            opciones_json,
            p["respuesta_correcta"],
            p.get("explicacion"),
            p.get("puntaje", 1),
        ),
    )
    return True


NUEVAS_CATEGORIAS = [
    {
        "nombre": "Embarazo",
        "slug": "embarazo",
        "descripcion": "Cómo crece y se desarrolla el bebé durante el embarazo.",
        "area": "embarazo",
    },
    {
        "nombre": "Nacimiento",
        "slug": "nacimiento",
        "descripcion": "El momento en que nace el bebé y cómo ocurre el parto.",
        "area": "nacimiento",
    },
]


def _existe_categoria(conn, area):
    row = conn.execute("SELECT id FROM categorias WHERE area = ?", (area,)).fetchone()
    return row is not None


def _asegurar_categorias(conn):
    nuevas = 0
    for cat in NUEVAS_CATEGORIAS:
        if _existe_categoria(conn, cat["area"]):
            continue
        conn.execute(
            """
            INSERT INTO categorias (nombre, slug, descripcion, area, activa)
            VALUES (?, ?, ?, ?, 1)
            """,
            (cat["nombre"], cat["slug"], cat["descripcion"], cat["area"]),
        )
        nuevas += 1
    return nuevas


def main():
    conn = get_db()
    creadas = 0
    preguntas_added = 0
    cat_creadas = 0
    try:
        # 0) Categorias que falten para areas usadas
        cat_creadas = _asegurar_categorias(conn)

        # 1) Preguntas extra para actividades existentes
        for actividad_id, preguntas in EXTRA_PREGUNTAS_EXISTENTES.items():
            existe = conn.execute(
                "SELECT id FROM actividades WHERE id = ?", (actividad_id,)
            ).fetchone()
            if not existe:
                continue
            for p in preguntas:
                if _insertar_pregunta(conn, actividad_id, p):
                    preguntas_added += 1

        # 2) Nuevas actividades
        for act in NUEVAS_ACTIVIDADES:
            aid = _existe_actividad(conn, act["titulo"])
            if not aid:
                cursor = conn.execute(
                    """
                    INSERT INTO actividades (titulo, descripcion, instrucciones, area, categoria_id,
                                            tipo, dificultad, intentos_maximos, creado_por, activa)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    """,
                    (
                        act["titulo"],
                        act.get("descripcion"),
                        act.get("instrucciones"),
                        act["area"],
                        act.get("categoria_id"),
                        act["tipo"],
                        act["dificultad"],
                        act.get("intentos_maximos", 1),
                        DOCENTE_ID,
                    ),
                )
                aid = cursor.lastrowid
                creadas += 1
            for p in act["preguntas"]:
                if _insertar_pregunta(conn, aid, p):
                    preguntas_added += 1

        conn.commit()
    finally:
        close_db(conn)

    print(f"Categorias nuevas: {cat_creadas}")
    print(f"Actividades nuevas: {creadas}")
    print(f"Preguntas insertadas: {preguntas_added}")
    print("Sembrado de actividades completado.")


if __name__ == "__main__":
    main()