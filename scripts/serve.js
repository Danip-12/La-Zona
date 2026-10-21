#!/usr/bin/env node
/* Servidor estático sin dependencias para desarrollo y e2e.
 * Uso: node scripts/serve.js [puerto] [directorio]   (por defecto 8080 y la raíz del proyecto) */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[3] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(root, path.normalize(p));
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
      if (!(await stat(file)).isFile()) throw new Error('nf');
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
      res.end(await readFile(file));
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = createServer();
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Prueba: npm run serve -- ${port + 1}` : e.message);
    process.exit(1);
  });
  server.listen(port, () => console.log(`LA ZONA en http://localhost:${port}  (raíz: ${root})`));
}
