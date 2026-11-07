#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 *  generate.js — the whole build.  Run:  node assets/generate.js
 *
 *  For every posts/<slug>.md it:
 *    1. figures out the LAST-MODIFIED date and bakes it into the file's
 *       front matter as `updated:` — so the date travels WITH the file
 *       to any server, git or not.
 *    2. renders the Markdown to a full, standalone HTML page at
 *       posts/<slug>/index.html  (clean URL: /posts/<slug>/).
 *    3. adds a Copy button to every code block.
 *  Finally it writes the post list into index.html between the
 *  <!--POSTS:START--> / <!--POSTS:END--> markers.
 *
 *  Everything is pre-rendered, so the site needs no fetch, no CDN and
 *  no posts.json — it works on GitHub Pages, any static server, or even
 *  straight off disk.
 * ------------------------------------------------------------------ */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { marked } = require(path.join(__dirname, "marked.min.js"));

const ROOT = path.join(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "posts");
const INDEX = path.join(ROOT, "index.html");

/* ---- date: last time I modified the file, portable ------------------- */
function lastModified(file, meta) {
  // 1) uncommitted edits → use the file's own mtime (the real edit time)
  // 2) committed & clean  → use the last git commit date
  // 3) no git             → keep a value already baked in the file
  // 4) nothing else       → fall back to mtime
  try {
    const dirty = execFileSync("git", ["status", "--porcelain", "--", file], {
      cwd: ROOT, stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
    if (!dirty) {
      const iso = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], {
        cwd: ROOT, stdio: ["ignore", "pipe", "ignore"],
      }).toString().trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
    }
    return fs.statSync(file).mtime.toISOString().slice(0, 10);
  } catch (e) {
    if (meta.updated) return meta.updated;            // preserve baked date
    return fs.statSync(file).mtime.toISOString().slice(0, 10);
  }
}

/* ---- front matter ---------------------------------------------------- */
function parseFrontMatter(md) {
  const meta = {};
  let body = md;
  if (md.startsWith("---")) {
    const end = md.indexOf("\n---", 3);
    if (end !== -1) {
      md.slice(3, end).split("\n").forEach((line) => {
        const m = line.match(/^\s*([\w-]+)\s*:\s*(.*)\s*$/);
        if (m) meta[m[1].toLowerCase()] = m[2].replace(/^["']|["']$/g, "");
      });
      body = md.slice(md.indexOf("\n", end + 1) + 1);
    }
  }
  return { meta, body };
}

// Write `updated: <date>` back into the file's front matter (idempotent).
function bakeUpdated(file, raw, meta, date) {
  if (meta.updated === date) return;                  // already correct
  let out;
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    let fm = raw.slice(3, end);
    if (/^\s*updated\s*:/m.test(fm)) {
      fm = fm.replace(/^\s*updated\s*:.*$/m, `updated: ${date}`);
    } else {
      fm = fm.replace(/\s*$/, "") + `\nupdated: ${date}\n`;
      out = "---" + fm.replace(/\n$/, "") + raw.slice(end);
      fs.writeFileSync(file, out);
      return;
    }
    out = "---" + fm + raw.slice(end);
  } else {
    out = `---\nupdated: ${date}\n---\n\n` + raw;
  }
  fs.writeFileSync(file, out);
}

/* ---- small helpers --------------------------------------------------- */
function firstHeading(body) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}
function firstParagraph(body) {
  const text = body
    .replace(/^#.*$/gm, "").replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_`>[\]()!]/g, "").replace(/\s+/g, " ").trim();
  const p = text.split(". ")[0] || text;
  return p.length > 140 ? p.slice(0, 137) + "…" : p;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ---- Markdown → HTML, with copy buttons on code blocks --------------- */
const renderer = new marked.Renderer();
renderer.code = function (code, lang) {
  const cls = lang ? ` class="language-${esc(lang)}"` : "";
  return `<div class="code-block"><button class="copy-btn" type="button" aria-label="Copy code">Copy</button>` +
         `<pre><code${cls}>${esc(code)}</code></pre></div>\n`;
};
// Raw HTML in a post is shown as text, never executed (payloads stay inert).
renderer.html = function (html) {
  return esc(html);
};

// Only http(s), mailto and relative links; javascript:, data:, etc. are dropped.
function safeUrl(href, allowMailto) {
  const url = String(href || "").replace(/[\u0000-\u0020\u007f]/g, "");
  const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!scheme) return url;
  const s = scheme[1].toLowerCase();
  if (s === "http" || s === "https" || (allowMailto && s === "mailto")) return url;
  return null;
}
renderer.link = function (href, title, text) {
  const url = safeUrl(href, true);
  if (url === null) return text;
  const external = /^https?:/i.test(url);
  return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ""}` +
         `${external ? ' rel="noopener noreferrer"' : ""}>${text}</a>`;
};
renderer.image = function (href, title, text) {
  const url = safeUrl(href, false);
  if (url === null) return esc(text);
  return `<img src="${esc(url)}" alt="${esc(text)}"${title ? ` title="${esc(title)}"` : ""} loading="lazy" referrerpolicy="no-referrer" />`;
};

marked.setOptions({ renderer });

/* ---- page shell for a single post ------------------------------------ */
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; " +
            "font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; " +
            "form-action 'none'; object-src 'none'";

function postPage(post, htmlBody) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="${CSP}" />
  <meta name="referrer" content="no-referrer" />
  <title>${esc(post.title)} · ich4k</title>
  <meta name="description" content="${esc(post.description)}" />
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="../../assets/style.css" />
  <script src="../../assets/theme.js"></script>
</head>
<body>
  <header class="site">
    <nav class="nav">
      <a class="brand" href="../../index.html"><span class="dot"></span>ich4k</a>
      <a class="link" href="../../index.html">Blog</a>
      <a class="link" href="../../about.html">About</a>
      <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">☾</button>
    </nav>
  </header>

  <main class="wrap">
    <article>
      <div class="post-meta">Last updated ${esc(fmtDate(post.updated))}</div>
      <h1>${esc(post.title)}</h1>
      ${htmlBody}
      <a class="back" href="../../index.html">← All posts</a>
    </article>
  </main>

  <footer class="site">
    <div class="wrap">
      <span>© ${new Date().getFullYear()} ich4k</span>
      <a href="https://github.com/1ch4k" target="_blank" rel="noopener noreferrer">GitHub</a>
    </div>
  </footer>

  <script src="../../assets/app.js"></script>
</body>
</html>
`;
}

/* ---- build ----------------------------------------------------------- */
const files = fs.existsSync(POSTS_DIR)
  ? fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"))
  : [];

const posts = files.map((file) => {
  const full = path.join(POSTS_DIR, file);
  const raw = fs.readFileSync(full, "utf8");
  const { meta, body } = parseFrontMatter(raw);
  const slug = file.replace(/\.md$/, "");
  const updated = meta.date || lastModified(full, meta);
  bakeUpdated(full, raw, meta, updated);

  const post = {
    slug,
    title: meta.title || firstHeading(body) || slug,
    description: meta.description || firstParagraph(body),
    updated,
  };

  // strip the leading "# Title" so it isn't duplicated (we render our own h1)
  const bodyNoH1 = body.replace(/^#\s+.+$\n?/m, "");
  const outDir = path.join(POSTS_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), postPage(post, marked.parse(bodyNoH1)));
  return post;
});

// remove stale generated folders (post deleted / renamed)
fs.readdirSync(POSTS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .forEach((d) => {
    if (!posts.some((p) => p.slug === d.name)) {
      fs.rmSync(path.join(POSTS_DIR, d.name), { recursive: true, force: true });
    }
  });

/* ---- inject the list into index.html --------------------------------- */
posts.sort((a, b) => new Date(b.updated) - new Date(a.updated));
const list = posts.map((p) => `        <li>
          <a href="posts/${encodeURIComponent(p.slug)}/">
            <span>
              <span class="title">${esc(p.title)}</span>
              ${p.description ? `<span class="desc">${esc(p.description)}</span>` : ""}
            </span>
            <span class="date">${esc(fmtDate(p.updated))}</span>
          </a>
        </li>`).join("\n");

let html = fs.readFileSync(INDEX, "utf8");
html = html.replace(
  /<!--POSTS:START-->[\s\S]*?<!--POSTS:END-->/,
  `<!--POSTS:START-->\n${list || '        <li class="empty-row"><span class="empty">No posts yet.</span></li>'}\n        <!--POSTS:END-->`
);
fs.writeFileSync(INDEX, html);

console.log(`Built ${posts.length} post(s).`);
