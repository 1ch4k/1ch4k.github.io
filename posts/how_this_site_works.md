---
title: How this site works
description: Why this blog exists and how the whole thing is built and rendered.
updated: 2026-09-12
---

# How this site works

## Why it exists

This is where I keep my notes and reports on offensive security work. I wanted a
place I fully own, with no platform in the middle and no tracking. Something I can
read in one sitting and host for free. So I built the smallest thing that does the
job: plain HTML, CSS and a little JavaScript.

The rule I gave myself was simple. If a feature needs a framework or a build tool
that I cannot explain in a paragraph, it does not go in.

## How writing a post works

I write a Markdown file in the posts folder, for example posts/my_report.md. I can
add a small header at the top if I want a custom title and summary:

```yaml
---
title: My report
description: One line that shows up in the list.
---
```

Then I run one command and the site rebuilds itself.

```bash
node assets/generate.js
```

## How a post becomes a page

The build script reads every Markdown file in the posts folder and turns each one
into a real HTML page. The Markdown is converted to HTML with a small library
called marked, and the result is dropped into a full page template:

```js
const { marked } = require("./marked.min.js");
const html = marked.parse(body);
fs.writeFileSync("posts/" + slug + "/index.html", page(post, html));
```

Because every page is written to disk ahead of time, the browser never has to
fetch or assemble anything. The page just loads. That is why it works on GitHub
Pages, on any other host, or straight off the disk.

## How the date works

Each post carries its own last modified date, written right into the file header
as updated. The build fills it in from git when git is available, and falls back
to the file time otherwise. Since the date lives inside the file, it stays correct
even if I move the whole project somewhere else.

```yaml
---
title: How this site works
updated: 2026-09-12
---
```

## The rest

The home page keeps a list of posts between two markers, and the build rewrites
that list every time. Each code block gets a small Copy button, added during the
build and wired up by a few lines of JavaScript. The theme switch flips between a
light and a dark look and remembers the choice.

That is the whole system. Nothing to update, nothing to break.
