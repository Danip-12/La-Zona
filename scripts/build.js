#!/usr/bin/env node
/* Build OPCIONAL para producción: copia la app a dist/ y sella la versión del service worker
 * con un hash del contenido (así cada despliegue invalida la caché anterior).
 * La versión sin build (subir la carpeta tal cual) funciona igual. Uso: npm run build */
import { cp, rm, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const INCLUDE = ['.nojekyll', 'index.html', 'manifest.json', 'sw.js', 'app.js', 'css', 'icons', 'legal'];
const SKIP = new Set(['store-1024.png']); // recurso para tiendas, no hace falta en la web

async function walk(dir) {
  const out = [];
  for (const n of await readdir(dir)) {
    const f = path.join(dir, n);
    (await stat(f)).isDirectory() ? out.push(...await walk(f)) : out.push(f);
  }
  return out;
}

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'js'), { recursive: true });
await cp(path.join(root, 'js/theme-boot.js'), path.join(dist, 'js/theme-boot.js'));
for (const item of INCLUDE) await cp(path.join(root, item), path.join(dist, item), { recursive: true });
for (const f of await walk(dist)) if (SKIP.has(path.basename(f))) await rm(f);

// Hash de todos los archivos (excepto sw.js) → versión de la caché.
const hash = createHash('sha256');
for (const f of (await walk(dist)).filter((x) => !x.endsWith('sw.js')).sort()) hash.update(await readFile(f));
const version = `lazona-${hash.digest('hex').slice(0, 10)}`;
const swPath = path.join(dist, 'sw.js');
const sw = (await readFile(swPath, 'utf8')).replace(/const VERSION = '[^']+'/, `const VERSION = '${version}'`);
await writeFile(swPath, sw);

console.log(`dist/ listo · caché ${version} · ${(await walk(dist)).length} archivos`);
