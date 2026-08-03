"""Contenido de quiz para las 10 unidades de la ruta.

Ejecuta:  python api/database/seed_quizzes_unidades.py

Idempotente: si ya existe una actividad con el mismo título, la salta. Pasa
por `crear_quiz()` (no por INSERT directo) para que valide igual que el
creador del docente y para que quede el snapshot de versión.

Modos "ordenar" y "emparejar": viajan como `short_text` con la definición en
`configuracion`, igual que los embeds de Wordwall. `quiz_items.tipo` tiene un
CHECK y en SQLite ampliarlo obliga a reconstruir la tabla — que tiene hijos
con ON DELETE CASCADE. No vale la pena: el JSON de configuracion ya está
pensado para esto.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.database.connection import get_db, close_db
from api.services.quizzes import crear_quiz

DOCENTE_ID = 1


def orden(*piezas):
    """Bloque de ordenar. `piezas` va en el orden correcto."""
    return {
        "tipo": "short_text",
        "config": {"modo": "ordenar", "piezas": list(piezas)},
        "respuesta_correcta": " | ".join(piezas),
    }


def emparejar(*pares):
    """Bloque de emparejar. Cada par es (término, definición).

    La cadena canónica va ordenada alfabéticamente para que el orden en que el
    estudiante empareje no cambie el resultado; el frontend hace lo mismo con
    Array.sort() sobre las mismas cadenas.
    """
    return {
        "tipo": "short_text",
        "config": {"modo": "emparejar", "pares": [list(p) for p in pares]},
        "respuesta_correcta": " | ".join(sorted(f"{a} = {b}" for a, b in pares)),
    }


def opciones(*textos_correcta):
    """(texto, es_correcta) -> lista de opciones con id estable."""
    return [
        {"id": f"op{i + 1}", "texto": texto, "correcta": correcta, "media": []}
        for i, (texto, correcta) in enumerate(textos_correcta)
    ]


UNIDADES = [
    # ---------------------------------------------------------------- 1
    {
        "titulo": "Mi cuerpo por dentro y por fuera",
        "area": "cuerpo_humano",
        "categoria": "cuerpo_humano",
        "descripcion": "Reconoce los sistemas del cuerpo humano y lo que hace cada uno.",
        "dificultad": "basica",
        "items": [
            {"tipo": "info", "titulo": "Antes de empezar",
             "contenido": "Tu cuerpo es un equipo: cada sistema tiene una tarea y todos "
                          "trabajan juntos. En esta unidad vas a reconocer los principales "
                          "y a entender por qué cuidarlos es cuidarte a ti."},
            {"tipo": "single_choice",
             "enunciado": "¿Qué es un sistema del cuerpo humano?",
             "opciones": opciones(
                 ("Un conjunto de órganos que trabajan juntos en una misma tarea", True),
                 ("Un solo órgano que funciona por su cuenta", False),
                 ("Un hueso muy grande del cuerpo", False)),
             "explicacion": "Un sistema es un grupo de órganos que se reparten una misma función, "
                            "como el sistema digestivo o el respiratorio."},
            dict(emparejar(
                ("Corazón", "Bombea la sangre por todo el cuerpo"),
                ("Pulmones", "Toman el oxígeno del aire"),
                ("Estómago", "Ayuda a digerir los alimentos"),
                ("Cerebro", "Coordina lo que sentimos y hacemos")),
                enunciado="Empareja cada órgano con lo que hace.",
                explicacion="Cada órgano cumple una función distinta, pero ninguno trabaja solo."),
            {"tipo": "true_false",
             "enunciado": "Los huesos solo sirven para sostener el cuerpo.",
             "opciones": opciones(("Verdadero", False), ("Falso", True)),
             "explicacion": "Además de sostenernos, los huesos protegen órganos (el cráneo protege "
                            "el cerebro) y dentro de ellos se produce la sangre."},
            {"tipo": "flashcard",
             "enunciado": "Sistema circulatorio",
             "respuesta_correcta": "Formado por el corazón y los vasos sanguíneos. Lleva oxígeno "
                                   "y alimento a todas las células del cuerpo."},
            {"tipo": "multiple_choice",
             "enunciado": "¿Cuáles de estos hábitos ayudan a cuidar tu cuerpo? Marca todos los que apliquen.",
             "opciones": opciones(
                 ("Dormir suficiente cada noche", True),
                 ("Lavarse las manos antes de comer", True),
                 ("Tomar agua durante el día", True),
                 ("Saltarse el desayuno todos los días", False)),
             "explicacion": "Dormir, la higiene y la alimentación son la base: sin ellos el cuerpo "
                            "no se recupera bien."},
        ],
    },
    # ---------------------------------------------------------------- 2
    {
        "titulo": "La pubertad paso a paso",
        "area": "pubertad",
        "categoria": "pubertad",
        "descripcion": "Qué es la pubertad, qué cambia y por qué cada persona lleva su propio ritmo.",
        "dificultad": "media",
        "items": [
            {"tipo": "info", "titulo": "La pubertad no es una carrera",
             "contenido": "La pubertad es la etapa en la que el cuerpo empieza a cambiar para "
                          "convertirse en adulto. Empieza a distintas edades en cada persona, y "
                          "eso es completamente normal: no se llega ni tarde ni temprano."},
            {"tipo": "single_choice",
             "enunciado": "¿Qué órgano da la señal para que empiece la pubertad?",
             "opciones": opciones(
                 ("La hipófisis, una glándula del cerebro", True),
                 ("El corazón", False),
                 ("El estómago", False)),
             "explicacion": "La hipófisis libera hormonas que avisan al resto del cuerpo de que "
                            "empieza esta etapa."},
            dict(orden("Niñez", "Pubertad", "Adolescencia", "Adultez"),
                 enunciado="Ordena las etapas de la vida, de la más temprana a la más tardía.",
                 explicacion="La pubertad es el inicio de los cambios; la adolescencia es la etapa "
                             "más larga que viene después."),
            {"tipo": "multiple_choice",
             "enunciado": "¿Qué cambios pueden aparecer en la pubertad? Marca todos los que apliquen.",
             "opciones": opciones(
                 ("Crecer más rápido de estatura", True),
                 ("Aparición de vello corporal", True),
                 ("Cambios de ánimo más frecuentes", True),
                 ("Perder la capacidad de aprender", False)),
             "explicacion": "Cambia el cuerpo y también cómo te sientes. Nada de eso afecta tu "
                            "capacidad de aprender."},
            {"tipo": "flashcard",
             "enunciado": "Hormonas",
             "respuesta_correcta": "Mensajeros químicos que viajan por la sangre y le dan "
                                   "instrucciones al cuerpo. Son las que dirigen los cambios de la pubertad."},
            {"tipo": "true_false",
             "enunciado": "Si un compañero empieza la pubertad antes que yo, significa que algo anda mal conmigo.",
             "opciones": opciones(("Verdadero", False), ("Falso", True)),
             "explicacion": "Cada cuerpo tiene su propio calendario. Empezar antes o después es "
                            "normal y no es señal de ningún problema."},
            {"tipo": "short_text",
             "enunciado": "¿Cómo se llama la etapa de la vida en la que el cuerpo empieza a cambiar "
                          "para convertirse en adulto?",
             "respuesta_correcta": ["pubertad", "la pubertad"],
             "explicacion": "La pubertad es el inicio de esos cambios."},
        ],
    },
    # ---------------------------------------------------------------- 3
    {
        "titulo": "El sistema reproductor femenino por dentro",
        "area": "sistema_reproductor_femenino",
        "categoria": "sistema_reproductor_femenino",
        "descripcion": "Órganos del sistema reproductor femenino y la función de cada uno.",
        "dificultad": "media",
        "items": [
            {"tipo": "info", "titulo": "Nombrar bien es cuidarse mejor",
             "contenido": "Conocer el nombre correcto de cada parte del cuerpo ayuda a cuidarse, "
                          "a explicar lo que se siente en una consulta médica y a pedir ayuda con "
                          "claridad si algo no está bien."},
            dict(emparejar(
                ("Ovarios", "Guardan y liberan los óvulos"),
                ("Trompas uterinas", "Camino que recorre el óvulo hacia el útero"),
                ("Útero", "Órgano donde crece el bebé durante el embarazo"),
                ("Vagina", "Conducto que comunica el útero con el exterior")),
                enunciado="Empareja cada órgano con su función.",
                explicacion="Cada parte cumple un papel distinto dentro del mismo proceso."),
            {"tipo": "single_choice",
             "enunciado": "¿Dónde se forman los óvulos?",
             "opciones": opciones(
                 ("En los ovarios", True),
                 ("En el útero", False),
                 ("En la vagina", False)),
             "explicacion": "Los ovarios guardan los óvulos desde antes de nacer y liberan uno "
                            "aproximadamente cada mes a partir de la pubertad."},
            {"tipo": "flashcard",
             "enunciado": "Menstruación",
             "respuesta_correcta": "Cuando el óvulo no es fecundado, el útero elimina la capa que "
                                   "había preparado y sale por la vagina. Ocurre más o menos una vez al mes."},
            {"tipo": "true_false",
             "enunciado": "La menstruación es una enfermedad.",
             "opciones": opciones(("Verdadero", False), ("Falso", True)),
             "explicacion": "Es un proceso natural y sano del cuerpo, no una enfermedad. Si causa "
                            "mucho dolor, sí conviene consultar."},
            {"tipo": "single_choice",
             "enunciado": "¿Cada cuánto ocurre aproximadamente el ciclo menstrual?",
             "opciones": opciones(
                 ("Alrededor de una vez al mes", True),
                 ("Una vez al año", False),
                 ("Todos los días", False)),
             "explicacion": "Suele durar cerca de 28 días, aunque varía de una persona a otra."},
        ],
    },
    # ---------------------------------------------------------------- 4
    {
        "titulo": "El sistema reproductor masculino por dentro",
        "area": "sistema_reproductor_masculino",
        "categoria": "sistema_reproductor_masculino",
        "descripcion": "Órganos del sistema reproductor masculino y la función de cada uno.",
        "dificultad": "media",
        "items": [
            {"tipo": "info", "titulo": "Nombrar bien es cuidarse mejor",
             "contenido": "Igual que en la unidad anterior, usar los nombres correctos no da pena: "
                          "es la manera de entender tu cuerpo y de explicarle a un adulto de "
                          "confianza o a un médico lo que necesitas."},
            dict(emparejar(
                ("Testículos", "Producen los espermatozoides"),
                ("Conductos deferentes", "Transportan los espermatozoides"),
                ("Escroto", "Bolsa de piel que protege los testículos"),
                ("Pene", "Órgano externo del sistema reproductor masculino")),
                enunciado="Empareja cada órgano con su función.",
                explicacion="Todos participan en la producción y el transporte de los espermatozoides."),
            {"tipo": "single_choice",
             "enunciado": "¿Dónde se producen los espermatozoides?",
             "opciones": opciones(
                 ("En los testículos", True),
                 ("En el estómago", False),
                 ("En los pulmones", False)),
             "explicacion": "Los testículos empiezan a producir espermatozoides durante la pubertad."},
            {"tipo": "flashcard",
             "enunciado": "Espermatozoide",
             "respuesta_correcta": "Es la célula reproductora masculina. Tiene una cola que le "
                                   "permite moverse para llegar hasta el óvulo."},
            {"tipo": "true_false",
             "enunciado": "Los testículos empiezan a producir espermatozoides desde el nacimiento.",
             "opciones": opciones(("Verdadero", False), ("Falso", True)),
             "explicacion": "Empiezan a producirlos en la pubertad, no antes."},
        ],
    },
    # ---------------------------------------------------------------- 5
    {
        "titulo": "Óvulo y espermatozoide: las células de la vida",
        "area": "celulas_reproductoras",
        "categoria": "celulas_reproductoras",
        "descripcion": "Diferencias y parecidos entre las dos células reproductoras.",
        "dificultad": "media",
        "items": [
            {"tipo": "info", "titulo": "Dos células, una nueva vida",
             "contenido": "Para que se forme una nueva vida hacen falta dos células muy distintas "
                          "entre sí: el óvulo y el espermatozoide. Cada una aporta la mitad de la "
                          "información del futuro bebé."},
            dict(emparejar(
                ("Óvulo", "Célula reproductora femenina, la más grande del cuerpo"),
                ("Espermatozoide", "Célula reproductora masculina, se mueve con su cola"),
                ("Cigoto", "Célula única que se forma al unirse las dos anteriores")),
                enunciado="Empareja cada célula con su descripción.",
                explicacion="El cigoto es la primera célula del nuevo ser: ya tiene información de ambos."),
            {"tipo": "single_choice",
             "enunciado": "¿Cuál de las dos células reproductoras es capaz de desplazarse por sí misma?",
             "opciones": opciones(
                 ("El espermatozoide, gracias a su cola", True),
                 ("El óvulo, gracias a su tamaño", False),
                 ("Ninguna de las dos se mueve", False)),
             "explicacion": "El óvulo es transportado por las trompas; el espermatozoide nada usando su cola."},
            {"tipo": "flashcard",
             "enunciado": "Cigoto",
             "respuesta_correcta": "Es la primera célula de un nuevo ser vivo, formada cuando el "
                                   "espermatozoide y el óvulo se unen en la fecundación."},
            {"tipo": "true_false",
             "enunciado": "El óvulo y el espermatozoide aportan cada uno la mitad de la información del bebé.",
             "opciones": opciones(("Verdadero", True), ("Falso", False)),
             "explicacion": "Por eso un bebé se parece a ambos progenitores."},
        ],
    },
    # ---------------------------------------------------------------- 6
    {
        "titulo": "De la fecundación al nacimiento",
        "area": "fecundacion",
        "categoria": "fecundacion",
        "descripcion": "El recorrido completo, paso a paso, desde la fecundación.",
        "dificultad": "media",
        "items": [
            {"tipo": "info", "titulo": "Un proceso ordenado",
             "contenido": "Desde que el óvulo es fecundado hasta que nace un bebé pasan unos nueve "
                          "meses, y cada etapa ocurre en un orden concreto."},
            dict(orden("Fecundación del óvulo", "Formación del cigoto", "Etapa de embrión",
                       "Etapa de feto", "Nacimiento"),
                 enunciado="Ordena las etapas desde la fecundación hasta el nacimiento.",
                 explicacion="Primero se forma el cigoto, que se convierte en embrión y luego en "
                             "feto, hasta el nacimiento."),
            {"tipo": "single_choice",
             "enunciado": "¿Qué es la fecundación?",
             "opciones": opciones(
                 ("La unión del óvulo y el espermatozoide", True),
                 ("El momento del nacimiento del bebé", False),
                 ("El crecimiento de los huesos", False)),
             "explicacion": "De esa unión nace la primera célula del nuevo ser: el cigoto."},
            {"tipo": "single_choice",
             "enunciado": "¿Dónde ocurre normalmente la fecundación?",
             "opciones": opciones(
                 ("En las trompas uterinas", True),
                 ("En el corazón", False),
                 ("En los pulmones", False)),
             "explicacion": "El encuentro suele ocurrir en las trompas; después el cigoto baja hasta el útero."},
            {"tipo": "flashcard",
             "enunciado": "Embrión",
             "respuesta_correcta": "Nombre que recibe el nuevo ser durante sus primeras semanas de "
                                   "desarrollo, antes de llamarse feto."},
            {"tipo": "true_false",
             "enunciado": "Un embarazo dura aproximadamente nueve meses.",
             "opciones": opciones(("Verdadero", True), ("Falso", False)),
             "explicacion": "Alrededor de 40 semanas, que son unos nueve meses."},
        ],
    },
    # ---------------------------------------------------------------- 7
    {
        "titulo": "Mi cuerpo, mis límites",
        "area": "autocuidado",
        "categoria": "autocuidado",
        "descripcion": "Límites personales, secretos que no se guardan y a quién pedir ayuda.",
        "dificultad": "basica",
        "items": [
            {"tipo": "info", "titulo": "Tu cuerpo te pertenece",
             "contenido": "Nadie tiene derecho a tocar tu cuerpo si tú no quieres, y tú tampoco "
                          "debes tocar el de otra persona sin su permiso. Decir «no» está bien, "
                          "incluso con personas conocidas o de la familia."},
            {"tipo": "single_choice",
             "enunciado": "Un adulto te pide que guardes un secreto sobre tu cuerpo y te dice que "
                          "no se lo cuentes a nadie. ¿Qué haces?",
             "opciones": opciones(
                 ("Se lo cuento a un adulto de confianza, aunque me hayan pedido no hacerlo", True),
                 ("Lo guardo, porque prometí no contarlo", False),
                 ("No hago nada y espero a ver qué pasa", False)),
             "explicacion": "Un secreto que te hace sentir mal, confundido o asustado siempre se "
                            "cuenta. Las promesas no obligan cuando alguien te está haciendo daño."},
            {"tipo": "multiple_choice",
             "enunciado": "¿A quiénes puedes acudir si algo te hace sentir incómodo o inseguro? "
                          "Marca todos los que apliquen.",
             "opciones": opciones(
                 ("A mamá, papá o quien me cuida", True),
                 ("A una profesora o profesor del colegio", True),
                 ("A la orientadora escolar", True),
                 ("A nadie, es mejor callarlo", False)),
             "explicacion": "Siempre hay más de una puerta. Si el primer adulto no te escucha, "
                            "busca a otro hasta que alguien te ayude."},
            dict(emparejar(
                ("Secreto que sí se guarda", "El regalo sorpresa de un cumpleaños"),
                ("Secreto que NO se guarda", "Algo que me hace sentir incómodo o asustado"),
                ("Límite personal", "Decidir quién puede acercarse o tocarme"),
                ("Adulto de confianza", "Alguien que me escucha y me ayuda de verdad")),
                enunciado="Empareja cada idea con su ejemplo.",
                explicacion="La diferencia está en cómo te hace sentir: si te pesa, no es un "
                            "secreto que debas cargar solo."),
            {"tipo": "true_false",
             "enunciado": "Si ya dije que sí a un juego, no puedo cambiar de opinión después.",
             "opciones": opciones(("Verdadero", False), ("Falso", True)),
             "explicacion": "Puedes cambiar de opinión en cualquier momento. Un «no» vale siempre, "
                            "aunque antes hubieras dicho que sí."},
            {"tipo": "flashcard",
             "enunciado": "Partes íntimas",
             "respuesta_correcta": "Son las que cubre el traje de baño. Nadie debe verlas ni "
                                   "tocarlas sin motivo, salvo un médico acompañado de tu familia, "
                                   "o quien te cuida si necesitas ayuda de aseo."},
            {"tipo": "true_false",
             "enunciado": "Si algo malo me pasa, la culpa es mía por no haberlo evitado.",
             "opciones": opciones(("Verdadero", False), ("Falso", True)),
             "explicacion": "Nunca es culpa del niño o la niña. La responsabilidad es siempre de "
                            "quien hace daño. Contarlo es lo valiente y lo correcto."},
        ],
    },
    # ---------------------------------------------------------------- 8
    {
        "titulo": "Preguntas frecuentes: mitos y verdades",
        "area": "preguntas_frecuentes",
        "categoria": "preguntas_frecuentes",
        "descripcion": "Respuestas claras a las dudas que más se repiten en clase.",
        "dificultad": "basica",
        "items": [
            {"tipo": "info", "titulo": "Preguntar no da pena",
             "contenido": "Todas las dudas de esta unidad son reales y muy comunes. Preguntar es "
                          "la forma correcta de aprender: lo raro sería no tener preguntas."},
            {"tipo": "true_false",
             "enunciado": "Todas las personas empiezan la pubertad exactamente a la misma edad.",
             "opciones": opciones(("Verdadero", False), ("Falso", True)),
             "explicacion": "Puede empezar en un rango de varios años. Todas esas edades son normales."},
            {"tipo": "true_false",
             "enunciado": "Hablar de estos temas con un adulto de confianza es algo bueno.",
             "opciones": opciones(("Verdadero", True), ("Falso", False)),
             "explicacion": "Es la mejor forma de resolver dudas con información correcta."},
            {"tipo": "single_choice",
             "enunciado": "Si encuentro en internet una información que me confunde sobre mi cuerpo, "
                          "¿qué es lo mejor que puedo hacer?",
             "opciones": opciones(
                 ("Consultarla con un adulto de confianza o con mi profe", True),
                 ("Creerla sin más, porque estaba en internet", False),
                 ("Reenviarla a mis compañeros para ver qué opinan", False)),
             "explicacion": "En internet hay mucha información falsa. Un adulto de confianza te "
                            "ayuda a distinguir qué es cierto."},
            {"tipo": "true_false",
             "enunciado": "Sentir vergüenza al hablar de estos temas significa que algo malo pasa conmigo.",
             "opciones": opciones(("Verdadero", False), ("Falso", True)),
             "explicacion": "Sentir un poco de pudor es normal. Con información y confianza, esa "
                            "incomodidad va bajando."},
            {"tipo": "flashcard",
             "enunciado": "¿Por qué se estudia este tema en el colegio?",
             "respuesta_correcta": "Porque conocer tu cuerpo te ayuda a cuidarlo, a respetar el de "
                                   "los demás y a pedir ayuda a tiempo si algo no está bien."},
        ],
    },
    # ---------------------------------------------------------------- 9
    {
        "titulo": "Nueve meses: el embarazo",
        "area": "embarazo",
        "categoria": "embarazo",
        "descripcion": "Cómo crece el bebé durante el embarazo y qué necesita para estar sano.",
        "dificultad": "media",
        "items": [
            {"tipo": "info", "titulo": "Creciendo en el útero",
             "contenido": "Durante el embarazo el bebé crece dentro del útero, protegido y "
                          "alimentado por el cuerpo de la madre. Dura alrededor de nueve meses, "
                          "que se agrupan en tres trimestres."},
            dict(orden("Primer trimestre", "Segundo trimestre", "Tercer trimestre"),
                 enunciado="Ordena las etapas del embarazo.",
                 explicacion="Cada trimestre dura unos tres meses y en cada uno el bebé cambia mucho."),
            dict(emparejar(
                ("Placenta", "Lleva alimento y oxígeno de la madre al bebé"),
                ("Cordón umbilical", "Une al bebé con la placenta"),
                ("Líquido amniótico", "Amortigua y protege al bebé de los golpes"),
                ("Útero", "Órgano donde el bebé crece durante los nueve meses")),
                enunciado="Empareja cada estructura con su función durante el embarazo.",
                explicacion="Todas juntas forman el ambiente que protege y alimenta al bebé."),
            {"tipo": "single_choice",
             "enunciado": "¿Cuánto dura aproximadamente un embarazo?",
             "opciones": opciones(
                 ("Unos nueve meses", True),
                 ("Unas tres semanas", False),
                 ("Unos dos años", False)),
             "explicacion": "Cerca de 40 semanas desde la fecundación hasta el nacimiento."},
            {"tipo": "multiple_choice",
             "enunciado": "¿Qué ayuda a que un embarazo sea saludable? Marca todos los que apliquen.",
             "opciones": opciones(
                 ("Ir a los controles médicos", True),
                 ("Alimentarse bien", True),
                 ("Descansar lo suficiente", True),
                 ("Fumar o consumir alcohol", False)),
             "explicacion": "Los controles médicos permiten detectar a tiempo cualquier dificultad."},
            {"tipo": "flashcard",
             "enunciado": "Placenta",
             "respuesta_correcta": "Órgano que se forma durante el embarazo y conecta a la madre "
                                   "con el bebé para pasarle oxígeno y alimento."},
        ],
    },
    # ---------------------------------------------------------------- 10
    {
        "titulo": "El nacimiento: llegar al mundo",
        "area": "nacimiento",
        "categoria": "nacimiento",
        "descripcion": "Qué ocurre en el parto y los primeros cuidados del recién nacido.",
        "dificultad": "media",
        "items": [
            {"tipo": "info", "titulo": "El final de un viaje de nueve meses",
             "contenido": "El nacimiento es el momento en que el bebé sale del útero y empieza a "
                          "respirar por sí mismo. Es un proceso que atiende personal de salud para "
                          "cuidar a la madre y al bebé."},
            dict(orden("Comienzan las contracciones", "El bebé sale al exterior",
                       "Se corta el cordón umbilical", "El bebé respira por primera vez"),
                 enunciado="Ordena los momentos del nacimiento.",
                 explicacion="Al cortar el cordón, el bebé deja de recibir oxígeno por la placenta "
                             "y empieza a usar sus pulmones."),
            {"tipo": "single_choice",
             "enunciado": "¿Qué es lo primero que hace un bebé al nacer?",
             "opciones": opciones(
                 ("Respirar por sus propios pulmones", True),
                 ("Caminar", False),
                 ("Hablar", False)),
             "explicacion": "Hasta ese momento recibía el oxígeno a través del cordón umbilical."},
            {"tipo": "true_false",
             "enunciado": "Todos los bebés nacen exactamente de la misma manera.",
             "opciones": opciones(("Verdadero", False), ("Falso", True)),
             "explicacion": "Hay distintas formas de nacer, como el parto natural o la cesárea. El "
                            "equipo médico decide cuál es la más segura en cada caso."},
            {"tipo": "flashcard",
             "enunciado": "Cordón umbilical",
             "respuesta_correcta": "Es el conducto que une al bebé con la placenta durante el "
                                   "embarazo. Al nacer se corta, y ahí queda el ombligo."},
            {"tipo": "multiple_choice",
             "enunciado": "¿Qué necesita un recién nacido? Marca todos los que apliquen.",
             "opciones": opciones(
                 ("Alimento", True),
                 ("Calor y contacto", True),
                 ("Cuidados de higiene", True),
                 ("Quedarse solo mucho tiempo", False)),
             "explicacion": "Un recién nacido depende por completo de los adultos que lo cuidan."},
        ],
    },
]


def _categoria_ids(conn):
    return {row["area"]: row["id"] for row in conn.execute("SELECT id, area FROM categorias")}


def _titulos_existentes(conn):
    return {row["titulo"] for row in conn.execute("SELECT titulo FROM actividades")}


def main():
    conn = get_db()
    try:
        categorias = _categoria_ids(conn)
        existentes = _titulos_existentes(conn)
    finally:
        close_db(conn)

    creados, saltados = 0, 0
    for unidad in UNIDADES:
        if unidad["titulo"] in existentes:
            print(f"  = ya existe, se salta: {unidad['titulo']}")
            saltados += 1
            continue
        categoria_id = categorias.get(unidad["categoria"])
        if categoria_id is None:
            print(f"  ! sin categoria para el area {unidad['categoria']}, se salta")
            saltados += 1
            continue
        payload = {
            "titulo": unidad["titulo"],
            "descripcion": unidad["descripcion"],
            "area": unidad["area"],
            "categoria_id": categoria_id,
            "dificultad": unidad["dificultad"],
            "estado": "publicado",
            "intentos_maximos": 3,
            "config": {"barajar_opciones": True, "aprobado_porcentaje": 60},
            "items": unidad["items"],
        }
        quiz = crear_quiz(payload, DOCENTE_ID)
        print(f"  + [{quiz['id']:>3}] {unidad['titulo']}  ({len(unidad['items'])} bloques)")
        creados += 1

    print(f"\nListo: {creados} quizzes creados, {saltados} saltados.")


if __name__ == "__main__":
    main()
