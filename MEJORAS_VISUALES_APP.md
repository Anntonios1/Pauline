# Propuesta de mejoras visuales para AulaRed 5

> Auditoría visual y guía de evolución de interfaz  
> Fecha: 1 de agosto de 2026  
> Alcance revisado: aplicación React en móvil y escritorio, navegación de estudiante, feed, Explorar, Mi ruta, Perfil, creación de publicaciones y estructura del panel docente.

## 1. Resumen ejecutivo

AulaRed 5 ya tiene una base visual reconocible y apropiada para un producto educativo: una paleta turquesa amable, tipografía redondeada, tarjetas consistentes, navegación móvil clara y una buena separación cromática entre estudiante y docente. La interfaz se siente funcional y cercana.

El principal salto de calidad no requiere rehacer la aplicación. Conviene concentrarse en cinco frentes:

1. **Fortalecer la jerarquía visual.** Hoy casi todo vive dentro de tarjetas blancas con borde y sombra similares. Esto hace que encabezados, contenido, acciones y estados compitan por atención.
2. **Mejorar legibilidad y accesibilidad.** Hay abundancia de textos de 10–12 px y varias combinaciones de color que no alcanzan contraste AA para texto normal.
3. **Unificar navegación e iconografía.** Móvil y escritorio no siempre presentan las mismas secciones; además se mezclan iconos Lucide con emojis dependientes del sistema.
4. **Pulir el comportamiento responsive.** Los carruseles y filtros muestran barras de desplazamiento nativas, algunas etiquetas quedan cortadas y ciertas acciones compiten con la barra inferior.
5. **Dar identidad educativa al contenido.** La interfaz es limpia, pero todavía genérica. Las categorías, retos, logros y unidades pueden expresar mejor la temática de ciencias, autocuidado y aprendizaje seguro.

### Prioridad recomendada

| Prioridad | Objetivo | Resultado esperado |
|---|---|---|
| P0 | Legibilidad, contraste, overflow y estados | Interfaz más clara, accesible y estable en móvil |
| P1 | Jerarquía, navegación y componentes principales | Experiencia consistente y con mejor sensación de producto |
| P2 | Identidad visual, ilustración y microinteracciones | Mayor recordación, motivación y personalidad educativa |

---

## 2. Lo que ya funciona bien

- **Identidad cromática reconocible.** El turquesa diferencia a AulaRed y comunica calma, salud y aprendizaje.
- **Tipografía adecuada al público.** Nunito es amigable, legible y menos rígida que una tipografía corporativa tradicional.
- **Componentes reutilizables.** Ya existen botones, tarjetas, badges, barras de progreso, estados vacíos y layouts compartidos.
- **Navegación móvil familiar.** La barra inferior de cinco acciones es fácil de comprender y el botón central de creación tiene buena prominencia.
- **Separación de roles.** Estudiante usa turquesa y docente/administrador usa violeta o azul oscuro, lo que ayuda a entender el contexto.
- **Buen uso de espacios en las pantallas centrales.** Explorar, Mi ruta y Crear funcionan bien con un ancho reducido y tarjetas de lectura rápida.
- **Tono cercano.** Saludos, retos, logros y lenguaje cotidiano reducen la sensación de una plataforma escolar rígida.

Estas fortalezas deberían conservarse. La mejora propuesta busca ordenar y refinar el lenguaje actual, no sustituirlo por uno completamente distinto.

---

## 3. Hallazgos principales

## 3.1 Jerarquía visual demasiado uniforme — P0

### Qué ocurre

Gran parte de la aplicación usa la misma fórmula: fondo blanco, borde gris claro, radio de 16 px y sombra pequeña. Esto aparece en publicaciones, filtros, bloques de progreso, accesos rápidos, categorías, unidades, logros y paneles laterales.

### Efecto

- El usuario tarda más en identificar qué es contenido, qué es navegación y qué es una acción.
- Las pantallas largas se perciben como una sucesión de cajas similares.
- Las llamadas a la acción pierden fuerza porque compiten con demasiados contenedores.
- En escritorio, las tres columnas tienen un peso visual parecido incluso cuando la columna central debería dominar.

### Mejora propuesta

Definir tres niveles de superficie:

| Nivel | Uso | Tratamiento sugerido |
|---|---|---|
| Base | Fondo de página y agrupaciones | Fondo gris azulado muy suave, sin borde |
| Contenido | Publicaciones, unidades, formularios | Superficie blanca, borde sutil, sombra mínima |
| Destacado | Próximo reto, progreso, acción principal | Fondo de marca o ilustrado, mayor contraste y una sola acción |

No toda sección necesita una tarjeta. Por ejemplo, los títulos de sección, filtros y estadísticas sencillas pueden vivir directamente sobre el fondo de página.

### Criterio de aceptación

En cada viewport debe poder identificarse en menos de tres segundos:

- el título de la pantalla;
- la acción principal;
- el contenido principal;
- el estado actual del usuario.

---

## 3.2 Texto pequeño y densidad excesiva — P0

### Evidencia

Hay muchos usos de `text-[10px]` y `text-xs`, especialmente en navegación, logros, badges, tarjetas de reto, panel docente y metadatos. En una aplicación usada por estudiantes de primaria, 10 px es demasiado pequeño para información relevante.

### Mejora propuesta

Adoptar una escala tipográfica mínima:

| Rol | Móvil | Escritorio | Uso |
|---|---:|---:|---|
| Título de página | 24/30 px | 28/34 px | Encabezado principal |
| Título de sección | 18/24 px | 20/26 px | Retos, unidades, publicaciones |
| Título de tarjeta | 16/22 px | 16/22 px | Categorías, retos, posts |
| Cuerpo | 16/24 px | 16/24 px | Lectura y formularios |
| Texto auxiliar | 14/20 px | 14/20 px | Metadatos y descripciones |
| Microtexto | 12/16 px | 12/16 px | Solo contadores o etiquetas secundarias |

Reglas:

- No utilizar 10 px para texto que el usuario necesite leer.
- Reservar mayúsculas y tracking amplio para rótulos muy cortos.
- Limitar párrafos a 65–75 caracteres por línea en lecturas.
- Aumentar el interlineado antes que reducir la fuente para encajar contenido.

---

## 3.3 Contraste insuficiente en colores actuales — P0

Se calcularon estas relaciones aproximadas sobre blanco:

| Color actual | Contraste sobre blanco | Observación |
|---|---:|---|
| `#0ea5a5` — primario | 3.02:1 | No cumple AA para texto normal |
| `#0d8a8a` — primario oscuro | 4.18:1 | Aún queda por debajo de 4.5:1 |
| `#f97316` — naranja | 2.80:1 | No apto para texto blanco normal |
| `#7c3aed` — docente | 5.70:1 | Correcto para texto normal |
| `#64748b` — texto secundario | 4.76:1 | Correcto sobre blanco |
| `#94a3b8` — texto sutil | 2.56:1 | Solo decorativo o deshabilitado |

### Mejora propuesta

- Usar `#0f766e` como relleno de marca cuando lleve texto blanco.
- Usar `#115e59` para hover o estados presionados.
- Mantener el turquesa actual para fondos claros, bordes, gráficos grandes o decoración.
- Cambiar el naranja de texto/CTA a una variante más oscura, por ejemplo `#c2410c`.
- Sustituir `--ar-subtle` en texto legible por un gris más oscuro; conservarlo solo en elementos deshabilitados o decorativos.
- Validar badges por pares completos de fondo y texto, no solo por el color del texto.

### Regla de diseño

- Texto normal: mínimo **4.5:1**.
- Texto grande, iconos funcionales y bordes de controles: mínimo **3:1**.
- El color nunca debe ser el único indicador de estado.

---

## 3.4 Carruseles y filtros con scrollbars visibles — P0

### Evidencia en móvil

Las filas de retos rápidos, filtros, logros y pestañas muestran la barra de desplazamiento horizontal nativa. Además, el último filtro puede quedar cortado. Esto se observó en Inicio, Explorar, Mi ruta y Perfil.

### Mejora propuesta

- Ocultar visualmente la scrollbar sin impedir el desplazamiento táctil o por teclado.
- Mantener `scroll-snap` en los carruseles de tarjetas.
- Mostrar una porción de la siguiente tarjeta como señal de que existe más contenido.
- Añadir un degradado lateral muy sutil cuando haya elementos fuera del viewport.
- En filtros de cuatro opciones, priorizar una distribución que quepa en 390 px; si no cabe, usar un selector segmentado de dos filas o un botón “Más filtros”.
- Incluir controles anterior/siguiente en escritorio cuando el carrusel tenga más elementos que el espacio disponible.

Ejemplo de utilidad CSS:

```css
.scrollbar-none {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}
```

Debe usarse junto con una señal visual de overflow; ocultar la barra sin señal puede volver invisible el contenido adicional.

---

## 3.5 Iconografía inconsistente y texto cortado por emojis — P0

### Qué ocurre

La interfaz mezcla:

- iconos Lucide;
- emojis del sistema;
- letras dentro de cuadrados;
- símbolos insertados dentro del texto.

En `CreateBox.jsx` se extrae el emoji con `split(' ')[0]` y el texto con `slice(3)`. Un emoji no siempre ocupa la misma cantidad de unidades de texto. El resultado visible puede perder letras; por ejemplo, “Una pregunta” aparece como “na pregunta”.

### Mejora propuesta

Separar siempre icono y contenido:

```js
{
  icon: Lightbulb,
  label: 'Algo que aprendí',
  path: '/crear?tipo=aprendizaje'
}
```

Lineamientos:

- Usar Lucide para navegación, acciones y estados funcionales.
- Usar ilustraciones o emojis solo en contenido expresivo: logros, celebración o categorías infantiles.
- No usar el emoji como parte del string que luego se deba cortar.
- Definir tamaño y contenedor consistente: 20 px para acciones, 24 px para navegación y 32–40 px para elementos ilustrativos.
- Dar `aria-hidden="true"` a iconos decorativos y un nombre accesible a botones de solo icono.

---

## 3.6 Navegación diferente entre móvil y escritorio — P1

### Evidencia

- En móvil aparece “Juegos”, mientras que en la navegación principal de escritorio aparece “Explorar”.
- El escritorio conserva el menú hamburguesa aunque ya tiene una barra lateral permanente.
- La barra superior centra la marca y deja mucho espacio sin uso en escritorio.
- La barra lateral de estudiante declara iconos para varios enlaces, pero no los renderiza; la barra docente sí lo hace.

### Mejora propuesta

Definir una arquitectura principal compartida:

1. Inicio
2. Explorar
3. Crear
4. Mi ruta
5. Perfil

“Juegos”, “Lecturas”, “Actividades” y “Recursos” pueden ser subsecciones visibles dentro de Explorar o accesos secundarios del menú.

En escritorio:

- eliminar el hamburguesa cuando la barra lateral esté visible;
- renderizar icono y etiqueta en todos los enlaces;
- usar la barra superior para título contextual, búsqueda y notificaciones;
- mantener la marca alineada con la columna lateral, no flotando sin relación con la retícula;
- reservar la columna derecha para contenido realmente contextual.

En móvil:

- mantener cinco destinos como máximo;
- dar a cada ítem un área táctil mínima de 44 × 44 px;
- añadir un indicador activo además del color: fondo suave, punto o cápsula;
- calcular el padding inferior con la altura real de la barra más `safe-area-inset-bottom`.

---

## 3.7 Dependencia excesiva de tarjetas y radios grandes — P1

Los radios redondeados aportan cercanía, pero ahora casi todos los elementos son cápsulas o tarjetas. Cuando todo es redondo, nada se siente especialmente importante.

### Sistema sugerido

| Elemento | Radio recomendado |
|---|---:|
| Inputs y botones estándar | 12 px |
| Tarjetas de contenido | 16 px |
| Panel destacado | 20 px |
| Chips y badges | 999 px |
| Modales y panel lateral | 20–24 px |

Reducir también la cantidad de sombras. El borde puede separar la mayoría de tarjetas; la sombra debe señalar elevación real: menú, modal, popover o elemento arrastrable.

---

## 3.8 Estados interactivos incompletos — P1

### Faltantes o inconsistencias

- Varios botones directos no tienen un foco de teclado visible.
- El sistema usa `focus` en algunos componentes, pero no una estrategia global de `focus-visible`.
- Hay animaciones `fade-in`, `scale-in` y escalados al presionar, pero no se contempla `prefers-reduced-motion`.
- Los estados deshabilitados dependen principalmente de opacidad.
- En el wizard, “Continuar” parece una acción disponible aun cuando está deshabilitada y no siempre explica qué falta.

### Mejora propuesta

- Anillo de foco de 2–3 px con separación exterior para todos los controles.
- Estados definidos para `default`, `hover`, `pressed`, `focus-visible`, `disabled`, `loading` y `success`.
- En botones deshabilitados: cambiar fondo, texto y cursor; agregar ayuda contextual cuando sea necesario.
- Desactivar transiciones no esenciales con:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 4. Recomendaciones por pantalla

## 4.1 Inicio / Feed

### Problemas observados

- Los retos rápidos dominan mucho espacio vertical antes del contenido social.
- El bloque “¿Qué aprendiste hoy?” tiene una fila superior que no ocupa de forma natural todo el ancho.
- Los accesos rápidos usan texto muy pequeño.
- Los filtros desbordan horizontalmente y muestran scrollbar.
- El encabezado de una publicación puede saturarse con avatar, autor, metadatos, badge y marcador.
- En móvil las reacciones ocultan el texto y dejan solo emojis; su significado puede no ser evidente.

### Propuesta

- Convertir el bloque de creación en una sola acción compacta y, al tocarla, mostrar las opciones de tipo.
- Mostrar 2.3 tarjetas de reto en móvil para comunicar el desplazamiento, con títulos de máximo dos líneas.
- Añadir estado de progreso dentro de cada reto: “Nuevo”, “En progreso” o “Completado”.
- Hacer que los filtros principales quepan sin scrollbar o mover los secundarios a un menú.
- Simplificar el header de publicaciones: autor y tiempo a la izquierda; tipo en una segunda línea o sobre la imagen.
- Mostrar dos reacciones frecuentes con etiqueta y agrupar las demás en “Más”.
- Reservar una variante visual especial para publicaciones fijadas, avisos y contenido del docente.
- Evitar usar datos estáticos en la columna derecha; “Mi ruta” y “Próximo reto” deben reflejar progreso real.

## 4.2 Explorar

### Problemas observados

- Todas las categorías usan el mismo icono de libro, por lo que el color carga con toda la diferenciación.
- Las descripciones se truncan pronto en una retícula de dos columnas.
- Las pestañas vuelven a desbordar en móvil.
- No hay una respuesta visual clara cuando una búsqueda no encuentra resultados.

### Propuesta

- Diseñar una familia de iconos o miniilustraciones por categoría: autocuidado, células, cuerpo, embarazo, nacimiento y preguntas.
- Usar color por área como acento, no como único identificador.
- En 360 px, considerar una lista de una columna; en 390 px o más, mantener dos columnas.
- Mostrar número de lecturas/actividades dentro de cada tema.
- Añadir chips de búsqueda reciente o temas sugeridos.
- Implementar un estado vacío con mensaje y acción “Limpiar búsqueda”.

## 4.3 Mi ruta

### Problemas observados

- Todas las unidades no completadas se presentan como activas en turquesa.
- Esto reduce la diferencia entre unidad actual y contenido futuro.
- Los logros muestran scrollbar nativa y los bloqueados tienen contraste muy bajo.
- Hay mucha repetición de encabezados turquesa consecutivos.

### Propuesta

Definir cuatro estados explícitos:

| Estado | Apariencia |
|---|---|
| Completado | Verde suave, check y progreso 100 % |
| Actual | Turquesa de marca, CTA “Continuar” y mayor elevación |
| Disponible | Blanco, borde neutro y CTA secundario |
| Bloqueado | Gris legible, candado y requisito para desbloquear |

Solo una unidad debería verse como “actual”. Las demás deben distinguirse como disponibles o bloqueadas según la lógica pedagógica.

También conviene:

- incluir tiempo estimado y cantidad de pasos;
- hacer colapsables las unidades no actuales;
- visualizar una línea de progreso vertical en escritorio;
- convertir el porcentaje superior en una meta concreta, por ejemplo “Te faltan 2 actividades para completar la unidad”.

## 4.4 Perfil

### Problemas observados

- La cabecera usa mucho espacio para un avatar con una sola inicial.
- Rango, progreso y rol compiten dentro del mismo panel.
- Los logros bloqueados pierden demasiada legibilidad.
- La fila de logros también presenta scrollbar nativa.

### Propuesta

- Permitir avatar ilustrado o selección de personaje, evitando exigir una foto real a menores.
- Compactar rol, curso y rango en una sola zona de identidad.
- Dar más protagonismo a una meta siguiente: “Siguiente rango en 2 actividades”.
- Mostrar logros en una cuadrícula de 2–3 columnas o un carrusel sin scrollbar visible.
- Mantener título y requisito legibles en logros bloqueados; el estado puede expresarse con candado, no con opacidad extrema.
- Añadir acceso claro a preferencias, accesibilidad y cierre de sesión.

## 4.5 Crear publicación

### Problemas observados

- Conviven la navegación global y una cabecera interna con volver y cerrar.
- Los puntos de progreso no explican el contenido de los cinco pasos.
- Las seis opciones iniciales se ven iguales y producen una retícula larga.
- El CTA inferior deshabilitado conserva demasiado protagonismo.

### Propuesta

- Usar un modo de tarea enfocado: cabecera propia del wizard y barra global simplificada.
- Cambiar los puntos por etiquetas cortas en escritorio: Tipo, Tema, Contenido, Vista previa, Enviar.
- En móvil, mostrar “Paso 1 de 5” junto a una barra continua.
- Hacer el CTA inferior sticky, por encima de la navegación y del safe area.
- Explicar debajo del CTA qué selección falta.
- Dar a cada tipo un icono consistente y una descripción de una línea.
- En la vista previa, usar exactamente el mismo componente visual que aparecerá en el feed.
- Mostrar autosave o estado “Borrador guardado”.

## 4.6 Panel docente y moderación

### Riesgos observados en la implementación

- El dashboard utiliza numerosos textos de 10–12 px.
- Hay tablas y bloques densos que pueden desbordar en móvil.
- Violeta, naranja, rojo, verde y turquesa compiten en estadísticas y alertas.
- La navegación docente sí muestra iconos, a diferencia de la navegación de estudiante.

### Propuesta

- Diseñar el panel para escritorio primero, con una densidad mayor pero legible.
- Reservar el color para significado: violeta = contexto docente; naranja = pendiente; rojo = problema; verde = completado.
- Reemplazar tablas móviles por tarjetas-resumen; no reducir toda la tabla hasta hacerla ilegible.
- Mostrar máximo cuatro KPIs prioritarios y llevar el detalle a vistas secundarias.
- Añadir leyendas, etiquetas y valores directos a gráficos; no depender del color.
- Dar a la moderación un flujo claro: contenido, motivo, acción y confirmación.
- Mantener botones de aprobación y devolución visualmente separados para evitar errores.

## 4.7 Login

### Propuesta

- Mantener el formulario compacto actual, pero reforzar confianza con el nombre de la institución o curso.
- Sustituir el bloque genérico “AR” por una marca o ilustración sencilla y propia.
- Añadir una breve ayuda sobre dónde encontrar el código de estudiante.
- Mostrar errores junto al campo afectado, además del mensaje general.
- Asegurar que el gradiente de fondo no reduzca el contraste del formulario.
- Evitar decorar con información sensible o pedir datos personales innecesarios.

---

## 5. Dirección visual propuesta

## 5.1 Concepto

**“Laboratorio de aprendizaje seguro”**: una interfaz curiosa y cercana, con estructura clara, ilustraciones científicas amables y señales de progreso visibles. Debe sentirse apropiada para quinto grado sin parecer infantil ni clínica.

Palabras guía:

- clara;
- segura;
- curiosa;
- inclusiva;
- respetuosa;
- motivadora.

## 5.2 Paleta funcional

| Token | Propuesta | Uso |
|---|---|---|
| `brand-700` | `#0f766e` | CTA con texto blanco, activo principal |
| `brand-800` | `#115e59` | Hover, pressed, texto de marca |
| `brand-100` | `#ccfbf1` | Fondos seleccionados y ayudas |
| `canvas` | `#f6f8fb` | Fondo de aplicación |
| `surface` | `#ffffff` | Contenido principal |
| `text-strong` | `#172033` | Títulos y texto principal |
| `text-muted` | `#526174` | Metadatos legibles |
| `teacher-700` | `#6d28d9` | Contexto docente |
| `warning-700` | `#a16207` | Advertencias con fondo claro |
| `danger-700` | `#b91c1c` | Errores y acciones destructivas |
| `success-700` | `#15803d` | Completado y aprobado |

Las áreas temáticas pueden mantener colores propios, pero dentro de un sistema: cada área necesita color oscuro de texto, color medio de icono y color claro de fondo.

## 5.3 Espaciado

Usar una escala de 4 px:

- 4 px: separación mínima dentro de badges;
- 8 px: icono + texto;
- 12 px: elementos relacionados;
- 16 px: padding de tarjeta móvil;
- 24 px: separación entre secciones;
- 32 px: encabezados y bloques principales;
- 48 px: separación de grandes zonas en escritorio.

Evitar valores aislados si no responden a una necesidad concreta.

## 5.4 Retícula responsive

| Ancho | Composición |
|---|---|
| 320–479 px | Una columna, padding lateral 12–16 px |
| 480–767 px | Una columna amplia, tarjetas internas de 2 columnas cuando quepan |
| 768–1023 px | Sidebar compacta + contenido; sin columna derecha fija |
| 1024–1279 px | Sidebar + contenido + rail contextual opcional |
| 1280 px o más | Contenedor máximo de 1200–1280 px; no estirar líneas de lectura |

No debe existir overflow horizontal de página en ninguno de estos anchos.

---

## 6. Componentes que conviene consolidar

Crear o completar estas piezas reducirá diferencias entre pantallas:

1. `AppShell`: barra superior, sidebar, bottom nav, safe areas y ancho máximo.
2. `PageHeader`: título, descripción, acción y variante estudiante/docente.
3. `Tabs` o `SegmentedControl`: estado activo, overflow, teclado y contador.
4. `HorizontalScroller`: snap, scrollbar oculta, degradados y controles desktop.
5. `Button`: variantes, tamaños, carga, disabled y focus-visible.
6. `IconButton`: área táctil, tooltip y nombre accesible.
7. `Card`: variantes `plain`, `interactive`, `featured` y `status`.
8. `EmptyState`, `LoadingState` y `ErrorState`: estructura y tono consistentes.
9. `ProgressCard`: porcentaje, meta y siguiente acción.
10. `StatusBadge`: pares de color accesibles y semántica estable.
11. `WizardShell`: pasos, navegación, borrador y CTA sticky.
12. `IllustratedCategory`: icono/ilustración, color y contador de contenido.

Antes de crear más clases específicas por página, estas piezas deberían convertirse en la fuente visual común.

---

## 7. Accesibilidad visual y de interacción

Lista mínima:

- Contraste AA en texto y controles.
- Foco visible en todos los elementos interactivos.
- Área táctil mínima de 44 × 44 px.
- Texto ampliable a 200 % sin pérdida de contenido.
- Zoom y orientación no bloqueados.
- No usar solo color para correcto, error, activo o bloqueado.
- No usar opacidad extrema en información que todavía deba leerse.
- Alternativas textuales para imágenes educativas.
- `aria-current` en navegación y `aria-selected` en tabs.
- Orden de tabulación coherente.
- Animación reducida cuando el sistema lo solicite.
- Mensajes de error junto al control y resumen general cuando corresponda.
- Gráficos del panel docente con etiquetas y valores legibles.
- Revisar el contenido en 320 px, 200 % de zoom y modo de alto contraste.

---

## 8. Quick wins

Cambios de alto impacto y bajo esfuerzo:

1. Corregir el corte de etiquetas de `CreateBox.jsx` separando icono y texto.
2. Ocultar scrollbars horizontales y añadir señal de continuación.
3. Eliminar textos de 10 px que comuniquen información necesaria.
4. Oscurecer el turquesa de botones con texto blanco.
5. Añadir `focus-visible` global a botones, enlaces e inputs.
6. Implementar `prefers-reduced-motion`.
7. Renderizar los iconos declarados en la sidebar de estudiante.
8. Ocultar el hamburguesa en escritorio cuando la sidebar esté presente.
9. Unificar “Explorar” y “Juegos” entre móvil y escritorio.
10. Diferenciar una sola unidad actual en Mi ruta.
11. Ajustar padding inferior móvil para que la barra fija no cubra contenido.
12. Crear un estado vacío con acción para búsquedas y filtros sin resultados.

---

## 9. Plan de implementación sugerido

## Fase 1 — Fundamentos visuales

**Esfuerzo estimado:** 1–2 días.

- actualizar tokens de color y contraste;
- definir escala tipográfica y espaciado;
- agregar focus-visible y reduced motion;
- normalizar radios y sombras;
- crear utilidades de scrollbar/safe area;
- separar iconos y labels en la data de UI.

**Resultado:** mejora transversal sin rediseñar pantallas completas.

## Fase 2 — Navegación y feed

**Esfuerzo estimado:** 3–5 días.

- consolidar `AppShell`;
- unificar destinos móvil/escritorio;
- corregir topbar y sidebar;
- refinar retos, caja de creación, filtros y publicaciones;
- revisar columna derecha con datos reales.

**Resultado:** la pantalla más usada gana claridad y coherencia.

## Fase 3 — Explorar, Mi ruta y Perfil

**Esfuerzo estimado:** 3–5 días.

- crear identidad por categoría;
- mejorar estados de unidad y progreso;
- rediseñar logros bloqueados/obtenidos;
- compactar perfil y destacar la siguiente meta.

**Resultado:** mayor motivación y comprensión del progreso.

## Fase 4 — Creación y estados del sistema

**Esfuerzo estimado:** 3–4 días.

- consolidar `WizardShell`;
- CTA sticky y validación contextual;
- vista previa idéntica al feed;
- estados de guardado, carga, error y éxito.

**Resultado:** menos abandono y menos errores de publicación.

## Fase 5 — Panel docente y juegos

**Esfuerzo estimado:** 5–8 días.

- adaptar dashboards a densidad legible;
- reemplazar tablas móviles por tarjetas;
- normalizar gráficos y colores de estado;
- revisar contraste y responsive de cada motor de juego.

**Resultado:** experiencia profesional para docente sin perder coherencia con el área de estudiante.

---

## 10. Matriz de validación visual

Validar al menos estas combinaciones:

| Ruta | 360×800 | 390×844 | 768×1024 | 1024×768 | 1440×900 |
|---|---:|---:|---:|---:|---:|
| Login | Sí | Sí | — | Sí | Sí |
| Inicio | Sí | Sí | Sí | Sí | Sí |
| Explorar | Sí | Sí | Sí | Sí | Sí |
| Mi ruta | Sí | Sí | Sí | Sí | Sí |
| Perfil | Sí | Sí | Sí | Sí | Sí |
| Crear | Sí | Sí | Sí | Sí | Sí |
| Actividad/juego | Sí | Sí | Sí | Sí | Sí |
| Panel docente | Sí | Sí | Sí | Sí | Sí |
| Moderación | Sí | Sí | Sí | Sí | Sí |

Para cada caso comprobar:

- ausencia de overflow horizontal de página;
- contenido no cubierto por topbar o bottom nav;
- títulos sin cortes accidentales;
- CTA principal visible y comprensible;
- foco de teclado visible;
- contraste correcto;
- estados loading, vacío, error y contenido largo;
- nombres de usuario y títulos largos;
- zoom al 200 %;
- navegación solo con teclado.

---

## 11. Definición de terminado visual

Una pantalla se considera visualmente terminada cuando:

- usa tokens, no colores o sombras aislados sin justificación;
- tiene un único foco principal claro;
- no contiene texto funcional menor de 12 px;
- el cuerpo principal se lee a 16 px;
- cumple contraste AA;
- funciona en 360 px sin overflow de página;
- todos los controles tienen estados hover, pressed, focus, disabled y loading cuando corresponda;
- las áreas táctiles miden al menos 44 × 44 px;
- no depende solo de color o emoji para comunicar significado;
- respeta safe areas y reducción de movimiento;
- incluye estados vacío, error y carga;
- fue comparada visualmente en móvil y escritorio.

---

## 12. Orden concreto recomendado

Si solo se pudiera ejecutar una primera iteración, haría este paquete:

1. contraste y tipografía;
2. corrección de emojis/labels;
3. scroll horizontal sin barra visible;
4. navegación coherente y sidebar con iconos;
5. feed con jerarquía más clara;
6. estados diferenciados de Mi ruta;
7. wizard de creación con CTA y progreso claros;
8. validación responsive y accesible.

Ese conjunto atacaría los problemas más visibles de la app actual sin exigir una reescritura y dejaría preparado un sistema más sólido para mejorar después el panel docente, los juegos y la identidad ilustrada.
