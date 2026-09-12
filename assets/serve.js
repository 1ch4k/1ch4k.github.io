#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 *  serve.js — a tiny local preview server that behaves like GitHub
 *  Pages: it serves the static files, serves index.html for a folder,
 *  and returns 404.html (with a 404 status) for anything missing.
 *
 *  Run:  node assets/serve.js         (then open http://localhost:8000)
 *        node assets/serve.js 3000    (to use a different port)
 *
 *  Python's http.server does NOT use your 404.html — this does.
 * ------------------------------------------------------------------ */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.argv[2]) || 8000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

// keep the request inside ROOT (no path traversal)
function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const full = path.normalize(path.join(ROOT, clean));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/html; charset=utf-8" });
  res.end(body);
}

function notFound(res) {
  const file = path.join(ROOT, "404.html");
  if (fs.existsSync(file)) send(res, 404, fs.readFileSync(file), TYPES[".html"]);
  else send(res, 404, "<h1>404 Not found</h1>");
}

const server = http.createServer((req, res) => {
  let full = resolve(req.url);
  if (!full) return notFound(res);

  // a directory → serve its index.html
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    full = path.join(full, "index.html");
  }

  if (fs.existsSync(full) && fs.statSync(full).isFile()) {
    const type = TYPES[path.extname(full).toLowerCase()] || "application/octet-stream";
    return send(res, 200, fs.readFileSync(full), type);
  }
  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT}`);
  console.log(`→ http://localhost:${PORT}   (Ctrl+C to stop)`);
});
