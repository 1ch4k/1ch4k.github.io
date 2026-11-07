#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 *  serve.js — a tiny local preview server that behaves like GitHub
 *  Pages: it serves the static files, serves index.html for a folder,
 *  and returns 404.html (with a 404 status) for anything missing.
 *
 *  Run:  node assets/serve.js         (then open http://localhost:8000)
 *        node assets/serve.js 3000    (to use a different port)
 *
 *  Only listens on 127.0.0.1, never serves dotfiles (.git, ...) and
 *  never serves anything outside the project folder.
 * ------------------------------------------------------------------ */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = fs.realpathSync(path.join(__dirname, ".."));
const PORT = Number(process.argv[2]) || 8000;
const HOST = "127.0.0.1";

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

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; " +
    "font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; " +
    "form-action 'none'; object-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
};

// Map a URL path to a real file inside ROOT, or null.
function resolve(urlPath) {
  let clean;
  try {
    clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  } catch (e) {
    return null;
  }
  if (clean.includes("\0")) return null;
  if (clean.split(/[\\/]/).some((seg) => seg.startsWith("."))) return null;

  let full = path.join(ROOT, path.normalize(clean));
  if (!inRoot(full)) return null;
  try {
    if (fs.statSync(full).isDirectory()) full = path.join(full, "index.html");
    full = fs.realpathSync(full);
    if (!inRoot(full) || !fs.statSync(full).isFile()) return null;
  } catch (e) {
    return null;
  }
  return full;
}

function inRoot(p) {
  return p === ROOT || p.startsWith(ROOT + path.sep);
}

function send(res, status, body, type) {
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": type || "text/html; charset=utf-8" });
  res.end(body);
}

function notFound(res) {
  const file = path.join(ROOT, "404.html");
  if (fs.existsSync(file)) send(res, 404, fs.readFileSync(file), TYPES[".html"]);
  else send(res, 404, "<h1>404 Not found</h1>");
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { ...SECURITY_HEADERS, Allow: "GET, HEAD" });
    return res.end();
  }
  const full = resolve(req.url || "/");
  if (!full) return notFound(res);
  const type = TYPES[path.extname(full).toLowerCase()] || "application/octet-stream";
  send(res, 200, req.method === "HEAD" ? undefined : fs.readFileSync(full), type);
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT}`);
  console.log(`→ http://localhost:${PORT}   (Ctrl+C to stop)`);
});
