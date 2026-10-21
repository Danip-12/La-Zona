#!/usr/bin/env node
/* Empaqueta js/main.js (y todos sus módulos) en app.js, un script CLÁSICO sin import/export.
 * Por qué: los navegadores bloquean los módulos ES en file://, así que index.html solo se puede
 * abrir con doble clic si carga un script normal. app.js SE VERSIONA en git (no hace falta npm
 * para abrir el juego). Si cambias algo en js/, ejecuta: npm run bundle */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const options = {
  entryPoints: [path.join(root, 'js/main.js')],
  outfile: path.join(root, 'app.js'),
  bundle: true,
  format: 'iife',
  target: 'es2020',
  banner: { js: '/* GENERADO por scripts/bundle.js a partir de js/ — no editar a mano. */' },
  logLevel: 'info',
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await build(options);
}
