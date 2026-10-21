# Decisiones de diseño y supuestos

## Dirección visual
El producto trata de **medir con precisión**, así que el protagonista es un objeto físico: un dial de radio con aro marfil. Todo lo demás es deliberadamente sobrio.

- **Color:** tinta nocturna `#0D1226`, cara del dial `#1B2350`, aro `#E9EDF7`. Las tres zonas usan un código fijo en ambos temas: coral `#FF5470` (4), ámbar `#FFB627` (3), turquesa `#2DD4BF` (2). Acento de interfaz índigo (`#3B45D6` claro / `#8E95FF` oscuro). Se evitó el crema + terracota y el negro + verde ácido.
- **Paletas de color:** el ajuste `palette` (Ajustes → Aspecto, o el icono de paleta de la pantalla de inicio) cambia el color predominante de toda la app: acento, fondos, superficies, tinta, líneas y cara del dial se derivan del tono (`--h`) de cada paleta, en claro y oscuro. Hay 9: índigo (por defecto), azul, turquesa, verde, naranja, coral, fucsia, violeta y grafito. Las zonas de puntuación (coral/ámbar/turquesa) **no** cambian: son información del juego. Añadir una paleta = id en `js/core/palettes.js` + bloque `[data-palette]` y muestra en `css/styles.css` + nombres en `i18n/` (un test lo verifica).
- **Tipografía:** pila de sistema (Avenir Next / Segoe UI Variable / system-ui). Cero descargas, cero bloqueo, `font-display` no aplica. Títulos en peso 800 con tracking negativo; el nombre de marca va espaciado.
- **No solo color:** cada franja lleva su número (2/3/4) y los marcadores llevan texto (OBJETIVO / TU RESPUESTA) con líneas guía; el rol de cada jugador se escribe ("psíquico", "adivina").
- **Movimiento:** la aguja del adivino tiene inercia (muelle amortiguado en `dial.js`); al revelar hay una coreografía: la aguja del objetivo barre desde la respuesta → caen las franjas → marcadores y etiquetas → acierto (confeti, destello) o fallo (sacudida). Sonido y veredicto se sincronizan con ese momento. Respeta `prefers-reduced-motion` y el ajuste propio (se anulan también los retrasos).

## Arquitectura
| Capa | Responsabilidad | Notas |
|---|---|---|
| `core/` | Reglas: puntuación, zonas, máquina de estados, saneamiento, ajustes | Pura, sin DOM, 100 % testeable |
| `data/` | Packs de categorías | `registerPack()` permite packs descargables o de pago |
| `i18n/` | Textos por idioma | Claves planas, `{param}`, plurales con `Intl.PluralRules`, test de paridad es/en |
| `services/` | Audio, vibración, entitlements, analítica | Todo falla en silencio |
| `ui/` | Vistas y componentes | Sin `innerHTML` (test automático); helper `h()` con nodos de texto |

**Seguridad del dato del psíquico.** En las fases `wait` y `guess` el dial **no crea** los nodos de zona, etiquetas ni pines, y borra la rotación de la aguja del objetivo. No es un `display:none`: no hay nada que inspeccionar ni que un lector de pantalla pueda leer (lo verifica el e2e en cada ronda).

**Navegación.** Cada modal añade una entrada al historial (`pushState`); "atrás" cierra primero el modal. Estando en partida, "atrás" o "volver al menú" piden confirmación solo si ya hay puntos.

**Dial.** SVG con `viewBox` fijo. La zona es una cuña que **no se recorta** en 0 y 100: se recorta con el semicírculo de la cara y el aro + la base se dibujan encima (ruleta física). Las etiquetas numéricas se colocan en el centro de la parte visible de cada franja.

**Entrada.** Pointer events con captura; el valor sale del ángulo del puntero respecto al centro (`getScreenCTM` inverso), por debajo de la horizontal salta al extremo más cercano. La aguja se pinta en `requestAnimationFrame` (una escritura por frame). Teclado: flechas ±1,5, Mayús ×4, Enter fija. `role="slider"` con `aria-valuemin/max/now`.

**CSP estricta:** `default-src 'self'`, sin `unsafe-inline`. Por eso el arranque del tema es un script externo síncrono (`theme-boot.js`) y los estilos dinámicos usan CSSOM.

## Supuestos (decisiones no especificadas en el brief)
1. **Multijugador 3–8:** el psíquico rota en orden y adivina el **siguiente** jugador de la lista. Cada uno es psíquico una vez por ciclo. Con 2 jugadores equivale a la regla original.
2. **Equidad de turnos:** con la opción activa, solo se declara ganador cuando `rondas % jugadores == 0` (todos han sido adivinos el mismo número de veces). Desactivada por defecto para respetar la regla del brief.
3. **Empate en el objetivo con 3+ jugadores:** gana solo si el líder es **único**; si hay varios líderes, se sigue jugando.
4. **Dificultad en la ronda en curso:** `w` se fija al empezar cada ronda (`beginRound`); un cambio en Ajustes aplica a la siguiente.
5. **Precisión media:** distancia media (en unidades del dial 0–100) entre respuesta y objetivo; menor es mejor. Mejor ronda: más puntos y, a igualdad, menor distancia.
6. **Categorías propias:** se reutiliza el mismo par en todas las rondas. "Otra categoría" solo existe con packs.
7. **Packs:** gratis = General, Familia, Fiesta (12+) y Deportes. Premium (cuando la monetización esté activa) = Cine y series, Mundo y curiosidades y Adultos 18+. Las categorías se escriben como las diría una persona real (situaciones cotidianas, con humor), no como adjetivos sueltos. El 18+ pide confirmar la edad una vez y es opcional.
8. **Monetización apagada** (`MONETIZATION_ENABLED = false` en `services/monetization.js`): todo está desbloqueado y no se muestra ningún candado. Al activarla hay que conectar un proveedor real con `setProvider` (StoreKit/Play Billing vía Capacitor o RevenueCat). Nunca se piden anuncios fuera de la fase `setup`.
9. **Analítica:** desactivada y sin endpoint. Aunque la activen en Ajustes no se envía nada hasta configurar `ANALYTICS_ENDPOINT`. Solo eventos numéricos; nunca texto libre.
10. **Idioma:** se detecta del dispositivo en la primera ejecución (es por defecto, en como alternativa). Añadir un idioma = un archivo en `js/i18n/` + registrarlo en `index.js` y `LANGS`.
11. **Persistencia:** solo ajustes (y compras) en `localStorage`. Si falla, se cae a memoria y se avisa en Ajustes. Nombres, categoría y marcador nunca se guardan.
12. **Zoom:** no se bloquea el zoom del navegador (WCAG 1.4.4); se evita el zoom accidental con `touch-action: manipulation` y campos de 16 px.
13. **Orientación:** el manifest fija vertical; en navegador, el horizontal funciona con un diseño de dos columnas para alturas bajas.
14. **Iconos:** generados por código (`make-icons.py`) como marca provisional; sustituir por arte final antes de publicar en tiendas.
15. **Textos legales:** son **plantillas**; requieren revisión legal y los datos de la empresa antes de publicar.
16. **Lighthouse ≥ 95:** el diseño lo permite (sin dependencias, sin fuentes remotas, CSP, SW, manifest, contraste AA). No se ejecutó Lighthouse en este entorno; hay que medirlo sobre el despliegue real (ver `docs/DEPLOY.md`).

## Límites conocidos
- La interpretación del "pack de pago" es solo la capa de derechos; no hay pasarela real conectada.
- Las categorías en inglés son adaptaciones de las españolas, no traducciones literales; conviene una revisión nativa.
- El resumen final es un panel superpuesto abierto desde el botón "Ver resumen" de la pantalla de fin.
