/* Comprobación del import/export de quizzes.
 *
 * Ejecuta:  node frontend/src/utils/quizJson.test.mjs
 *
 * No hay runner de tests en el frontend; esto es un script con asserts, que es
 * lo mínimo que falla si el mapeo se rompe. Lo que se comprueba es la ida y
 * vuelta: si exportar e importar no da lo mismo, un docente pierde trabajo sin
 * que nada avise.
 */

import assert from 'node:assert/strict'
import { quizToJson, quizFromJson } from './quizJson.js'

let pasadas = 0
function prueba(nombre, fn) {
  fn()
  pasadas += 1
  console.log(`  ok  ${nombre}`)
}

const formBase = {
  titulo: 'La pubertad',
  descripcion: 'Cambios del cuerpo',
  instrucciones: 'Lee con calma',
  area: 'pubertad',
  categoria_id: '7',
  dificultad: 'media',
  intentos_maximos: 3,
  config: {
    barajar_preguntas: true, barajar_opciones: false, mostrar_feedback: true,
    mostrar_progreso: true, tiempo_global_segundos: 300, aprobado_porcentaje: 70,
    tema: 'violeta', sonido: false, celebracion: true,
  },
}

const itemsBase = [
  {
    id: 'a', tipo: 'single_choice', enunciado: '¿Qué glándula inicia la pubertad?',
    contenido: '', explicacion: 'Es la hipófisis.', puntos: 2, tiempo_segundos: 45,
    config: {}, media: [],
    opciones: [
      { id: 'o1', texto: 'Hipófisis', correcta: true, media: [] },
      { id: 'o2', texto: 'Corazón', correcta: false, media: [] },
    ],
    respuesta_correcta: '',
  },
  {
    id: 'b', tipo: 'true_false', enunciado: 'Todos crecen a la misma edad.',
    contenido: '', explicacion: 'Cada cuerpo lleva su ritmo.', puntos: 1, tiempo_segundos: 30,
    config: {}, media: [], opciones: [], respuesta_correcta: 'false',
  },
  {
    id: 'c', tipo: 'flashcard', enunciado: 'Hormonas',
    contenido: 'Mensajeros químicos que viajan por la sangre.',
    explicacion: '', puntos: 0, tiempo_segundos: 0,
    config: {}, media: [], opciones: [], respuesta_correcta: '',
  },
  {
    id: 'd', tipo: 'wordwall', enunciado: 'Juego de repaso', contenido: '',
    explicacion: '', puntos: 0, tiempo_segundos: 0,
    config: { wordwall_url: 'https://wordwall.net/es/embed/abc123' },
    media: [], opciones: [], respuesta_correcta: '',
  },
]

prueba('ida y vuelta conserva la cabecera del quiz', () => {
  const { form } = quizFromJson(JSON.stringify(quizToJson(formBase, itemsBase)))
  assert.equal(form.titulo, 'La pubertad')
  assert.equal(form.area, 'pubertad')
  assert.equal(form.dificultad, 'media')
  assert.equal(form.intentos_maximos, 3)
  assert.equal(form.config.tema, 'violeta')
  assert.equal(form.config.aprobado_porcentaje, 70)
  assert.equal(form.config.sonido, false)
  assert.equal(form.config.barajar_preguntas, true)
})

prueba('ida y vuelta conserva cada bloque y su respuesta', () => {
  const { items } = quizFromJson(JSON.stringify(quizToJson(formBase, itemsBase)))
  assert.equal(items.length, 4)

  const [unica, vf, ficha, juego] = items
  assert.equal(unica.tipo, 'single_choice')
  assert.equal(unica.enunciado, '¿Qué glándula inicia la pubertad?')
  assert.equal(unica.puntos, 2)
  assert.equal(unica.opciones.length, 2)
  assert.equal(unica.opciones[0].texto, 'Hipófisis')
  assert.equal(unica.opciones[0].correcta, true, 'se pierde cuál opción era la correcta')
  assert.equal(unica.opciones[1].correcta, false)

  assert.equal(vf.respuesta_correcta, 'false', 'un verdadero/falso importado debe conservar su valor')
  assert.equal(ficha.contenido, 'Mensajeros químicos que viajan por la sangre.', 'el reverso de la ficha se pierde')

  // wordwall viaja como info+config; al importar debe volver a ser wordwall.
  assert.equal(juego.tipo, 'wordwall')
  assert.equal(juego.config.wordwall_url, 'https://wordwall.net/es/embed/abc123')
})

prueba('un wordwall guardado como info vuelve a ser wordwall', () => {
  const { items } = quizFromJson({
    titulo: 'x', items: [{ tipo: 'info', enunciado: 'Juego', config: { wordwall_url: 'https://wordwall.net/es/embed/z' } }],
  })
  assert.equal(items[0].tipo, 'wordwall')
})

prueba('la categoria no se importa: su id no es portable entre instalaciones', () => {
  const { form } = quizFromJson(JSON.stringify(quizToJson(formBase, itemsBase)))
  assert.equal(form.categoria_id, '')
})

prueba('conserva la config de modos que el editor todavia no sabe editar', () => {
  const { items } = quizFromJson({
    titulo: 'x',
    items: [{
      tipo: 'short_text', enunciado: 'Ordena las etapas.',
      respuesta_correcta: 'Niñez | Pubertad',
      config: { modo: 'ordenar', piezas: ['Niñez', 'Pubertad'] },
    }],
  })
  assert.equal(items[0].config.modo, 'ordenar')
  assert.deepEqual(items[0].config.piezas, ['Niñez', 'Pubertad'])
})

prueba('short_text con lista de respuestas toma la primera sin romperse', () => {
  const { items } = quizFromJson({
    titulo: 'x',
    items: [{ tipo: 'short_text', enunciado: '¿Cómo se llama?', respuesta_correcta: ['pubertad', 'la pubertad'] }],
  })
  assert.equal(items[0].respuesta_correcta, 'pubertad')
})

prueba('rechaza entradas invalidas con un mensaje entendible', () => {
  assert.throws(() => quizFromJson('{ esto no es json'), /JSON válido/)
  assert.throws(() => quizFromJson('[]'), /objeto con los datos/)
  assert.throws(() => quizFromJson('{"titulo":"x"}'), /Falta la lista "items"/)
  assert.throws(() => quizFromJson('{"titulo":"x","items":[]}'), /ningún bloque/)
  assert.throws(() => quizFromJson({ items: [{ tipo: 'telepatia' }] }), /Bloque 1.*desconocido/)
  assert.throws(() => quizFromJson({ items: ['no soy un objeto'] }), /Bloque 1.*objeto/)
})

prueba('nunca deja campos undefined que romperian el editor', () => {
  const { items } = quizFromJson({ titulo: 'x', items: [{ tipo: 'single_choice' }] })
  const item = items[0]
  for (const campo of ['id', 'tipo', 'enunciado', 'contenido', 'opciones',
    'respuesta_correcta', 'explicacion', 'puntos', 'tiempo_segundos', 'media', 'config']) {
    assert.notEqual(item[campo], undefined, `el editor recibiria ${campo} undefined`)
  }
  assert.ok(Array.isArray(item.opciones))
  assert.ok(Array.isArray(item.media))
})

prueba('cada bloque importado recibe un id propio', () => {
  const { items } = quizFromJson({
    titulo: 'x',
    items: [{ tipo: 'info', contenido: 'a' }, { tipo: 'info', contenido: 'b' }],
  })
  assert.notEqual(items[0].id, items[1].id, 'ids repetidos rompen el key de React')
})

console.log(`\n${pasadas} pruebas OK`)
