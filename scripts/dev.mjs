// Single-port preview server for the whole project.
//
//   /        -> built user app    (app/dist)
//   /admin/  -> built admin panel (admin/dist)
//   /api/... -> API server        (same process, no extra listener)
//
// Everything is served by this one process and one port, so the preview manager always
// exposes the right port. The app and admin are prebuilt by `npm run build:apps`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_DIR = path.join(ROOT, 'app/dist');
const ADMIN_DIR = path.join(ROOT, 'admin/dist');
const LOCAL_PORT = 5175;

const injected = Number(process.env.PORT);
const ports = [...new Set([LOCAL_PORT, ...(Number.isInteger(injected) && injected > 0 ? [injected] : [])])];

if (!existsSync(path.join(APP_DIR, 'index.html')) || !existsSync(path.join(ADMIN_DIR, 'index.html'))) {
  console.error('Build output is missing. Run `npm run build:apps` first.');
  process.exit(1);
}

// The API exports its http.Server but only starts listening outside tests; forward to it
// directly so it never binds a port of its own.
process.env.NODE_ENV = 'test';
const { server: api } = await import('../server/src/index.ts');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendFile(req, res, file, cache) {
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache, 'Content-Length': statSync(file).size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

/** Serves a built SPA folder; unknown extension-less paths fall back to its index.html. */
function serveSpa(req, res, dir, urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return notFound(res);
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(dir, rel);
  if (!file.startsWith(dir + path.sep)) return notFound(res);
  if (existsSync(file) && statSync(file).isFile()) {
    const cache = file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
    return sendFile(req, res, file, cache);
  }
  if (!path.extname(rel)) return sendFile(req, res, path.join(dir, 'index.html'), 'no-cache');
  return notFound(res);
}

function handler(req, res) {
  const url = req.url ?? '/';
  const pathname = url.split('?')[0];

  if (url === '/api' || url.startsWith('/api/') || url.startsWith('/api?')) {
    api.emit('request', req, res);
    return;
  }

  if (pathname === '/admin') {
    res.writeHead(301, { Location: '/admin/' + url.slice('/admin'.length) });
    return res.end();
  }

  if (pathname.startsWith('/admin/')) {
    return serveSpa(req, res, ADMIN_DIR, pathname.slice('/admin'.length));
  }

  return serveSpa(req, res, APP_DIR, pathname);
}

for (const port of ports) {
  http.createServer(handler).listen(port, '0.0.0.0', () => {
    console.log(`\nUser app:  http://localhost:${port}`);
    console.log(`Admin:     http://localhost:${port}/admin/\n`);
  });
}
