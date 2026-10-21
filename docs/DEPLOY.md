# Despliegue y empaquetado

## 1. Web estática (sin build)
Sube **el contenido de la carpeta** (`index.html`, `app.js`, `manifest.json`, `sw.js`, `css/`, `js/theme-boot.js`, `icons/`, `legal/`) a cualquier hosting estático. Requisitos: **HTTPS** (o `localhost`) para el service worker.

| Hosting | Pasos |
|---|---|
| Netlify | Arrastra la carpeta a *app.netlify.com/drop* |
| GitHub Pages | Ya incluido: `.github/workflows/deploy.yml` (ver README → *Publicar en GitHub Pages*) |
| Cloudflare Pages / Vercel | Apunta al repositorio, sin comando de build, directorio de salida `/` |
| Servidor propio | Sirve la carpeta con tipos MIME correctos (`.js` → `text/javascript`, `.webmanifest` → `application/manifest+json`) |

Si la app vive en una subruta (`midominio.com/zona/`), todo funciona porque las rutas son relativas.

## 2. Build de producción (opcional)
```bash
npm run build      # genera dist/ y sella la versión de caché del service worker con un hash
```
Despliega `dist/`. Si despliegas sin build, **incrementa `VERSION` en `sw.js`** en cada release: es lo que invalida la caché y dispara el aviso "Hay una versión nueva".

Cabeceras recomendadas (mejoran Lighthouse y seguridad):
```
Cache-Control: no-cache            (sw.js e index.html)
Cache-Control: public, max-age=31536000, immutable   (solo si añades hashes a los nombres de archivo)
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
La CSP ya va en `<meta>`; si tu hosting permite cabeceras, repítela allí.

## 3. Verificación tras desplegar
1. Abre la URL en Chrome → DevTools → *Application* → *Manifest*: sin errores, iconos 192/512/maskable.
2. *Service Workers*: activado. Activa *Offline* y recarga: debe cargar y poder jugarse.
3. *Lighthouse* (móvil, modo incógnito): objetivo ≥ 95 en Rendimiento, Accesibilidad, Buenas prácticas, SEO y PWA.
4. En Android (Chrome) aparece "Instalar app"; en iOS (Safari) *Compartir → Añadir a pantalla de inicio*.

## 4. App nativa con Capacitor (App Store y Google Play)
Capacitor envuelve la misma web; **la lógica no cambia**.

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/ios @capacitor/android
npm run build
npx cap init "LA ZONA" com.tuempresa.lazona --web-dir=dist
npx cap add ios && npx cap add android
npx cap sync
npx cap open ios        # Xcode
npx cap open android    # Android Studio
```
`capacitor.config.json` mínimo:
```json
{ "appId": "com.tuempresa.lazona", "appName": "LA ZONA", "webDir": "dist",
  "ios": { "contentInset": "always" }, "android": { "allowMixedContent": false } }
```
Notas:
- **Iconos y splash:** `npm i -D @capacitor/assets` y `npx capacitor-assets generate --iconBackgroundColor '#0D1226'` partiendo de `icons/store-1024.png` (sustituir por el arte final).
- **Orientación:** bloquea vertical en Xcode (*Deployment Info*) y en `AndroidManifest.xml` (`android:screenOrientation="portrait"`).
- **Compras:** instala un plugin (RevenueCat `@revenuecat/purchases-capacitor` o `cordova-plugin-purchase`), crea los productos `premium_packs` y `remove_ads` (compra única) y registra el proveedor:
  ```js
  entitlements.setProvider({ purchase: async (id) => ({ ok: true }), restore: async () => ({ ok: true, owned: [] }) });
  ```
  Después pon `MONETIZATION_ENABLED = true`.
- **Service worker:** en Capacitor los archivos ya son locales; el SW es inofensivo y puede mantenerse.
- **Ficha y revisión:** ver `docs/STORE.md` (clasificación por edad, etiquetas de privacidad).

## 5. Lista de comprobación de lanzamiento
- [ ] Sustituir iconos por arte final y volver a generar (`npm run icons` si sigues usando el script)
- [ ] Rellenar datos reales en `legal/privacy.html` y `legal/terms.html`, y revisión legal
- [ ] Subir `VERSION` del SW (o usar `npm run build`)
- [ ] `npm run test:all` en verde
- [ ] Lighthouse ≥ 95 sobre el despliegue real
- [ ] Probar en un móvil real: vertical y horizontal, sonido tras el primer toque, instalación y modo avión
