# LA ZONA

Juego social de adivinar para 2 a 8 jugadores con **un solo móvil**. Un jugador (psíquico) ve una posición secreta en una escala entre dos conceptos opuestos y da una pista en voz alta; el otro (adivino) coloca la aguja. Cuanto más cerca, más puntos.

PWA instalable, 100 % offline, sin cuentas, sin servidor, sin dependencias de ejecución.

## Usar en local

**Haz doble clic en `index.html`.** Funciona directamente desde el explorador de archivos, sin servidor, sin Node y sin internet (probado en Chromium con `file://`).

Detalles útiles:
- Abierto así, el juego va completo, pero **no se instala como PWA ni se cachea offline** (los navegadores solo permiten service workers en `http://localhost` o HTTPS). No hace falta: ya está todo en tu disco.
- Tus ajustes se guardan en el navegador (localStorage). Si abres el archivo desde otra carpeta o navegador, empiezas de cero.
- Para probar la versión PWA completa: `npm start` → http://localhost:8080 (necesita Node 20+).

### Si tocas el código
El código fuente son módulos ES en `js/`, pero `index.html` carga **`app.js`**, un único script generado a partir de ellos (los navegadores bloquean los módulos ES en `file://`). `app.js` va incluido en el repositorio, así que no hace falta compilar para jugar. Cuando edites algo de `js/`:

```bash
npm install        # solo la primera vez (esbuild)
npm run bundle     # regenera app.js
```
`npm test` falla si olvidas regenerarlo.

## Publicar en GitHub Pages

1. Crea un repositorio vacío en GitHub (p. ej. `la-zona`) y, desde esta carpeta:
   ```bash
   git init -b main
   git add .
   git commit -m "LA ZONA"
   git remote add origin https://github.com/TU_USUARIO/la-zona.git
   git push -u origin main
   ```
2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada `git push` a `main` ejecuta `.github/workflows/deploy.yml`: pasa los tests, hace `npm run build` (regenera `app.js` y sella la versión de caché del service worker) y publica `dist/`.
4. Tu juego quedará en `https://TU_USUARIO.github.io/la-zona/`.

Todas las rutas son relativas, así que funciona bajo la subruta `/la-zona/` sin tocar nada.

## Tests

```bash
npm test               # 28 tests unitarios (node:test, sin dependencias)
npm run test:e2e       # partida completa en Chromium + offline (requiere Playwright)
npm run test:all       # ambos
SHOTS_DIR=./capturas npm run test:e2e   # además guarda capturas de pantalla
```

Los unitarios cubren: puntos con las 3 dificultades y límites exactos (d = w, 3w, 5w), extremos 0 y 100, alternancia del psíquico, victoria y empate, equidad de turnos, saneamiento de textos, validación de ajustes corruptos, catálogo de categorías, paridad de traducciones, manifest/service worker/CSP.
El e2e usa Playwright (`npm i -D playwright` o el que ya tengas instalado) y define `CHROMIUM=/ruta/al/chromium` si no usas el de Playwright.

## Estructura

```
index.html · app.js (bundle generado) · manifest.json · sw.js
css/        styles.css (tokens, controles, inicio) · game.css (dial, partida, hojas)
js/
  core/     scoring · sanitize · settings · game      ← lógica pura, sin DOM (testeada)
  data/     packs.js (+ packs-a/b)                    ← 282 categorías, estructura escalable
  i18n/     es · en · index                           ← textos fuera del código
  services/ feedback (audio+vibración) · monetization · analytics
  ui/       dial · home · game-view · modal · settings-panel · tutorial · summary · controls · store · dom · icons
  main.js   arranque y contexto compartido
legal/      privacy.html · terms.html (plantillas)
icons/      iconos PWA (scripts/make-icons.py los regenera)
tests/      *.test.js (unitarios) · e2e/game.e2e.mjs
scripts/    bundle.js · serve.js · build.js · make-icons.py
docs/       DESIGN.md · DEPLOY.md · ROADMAP.md · STORE.md
```

## Documentación

| Documento | Contenido |
|---|---|
| `docs/DESIGN.md` | Decisiones de diseño, arquitectura y **lista de supuestos** |
| `docs/DEPLOY.md` | Despliegue web, instalación PWA, empaquetado con Capacitor (iOS/Android) |
| `docs/ROADMAP.md` | Lanzamiento, precios, packs futuros, métricas |
| `docs/STORE.md` | Textos de ficha de tienda, capturas, clasificación por edad, privacidad |
