/* ------------------------------------------------------------------ *
 *  app.js — tiny runtime shared by every page.
 *  The pages themselves are pre-rendered by generate.js, so this only
 *  handles: (1) the light/dark theme toggle and (2) the code-copy button.
 * ------------------------------------------------------------------ */

/* ---- Theme toggle ---------------------------------------------------- */
function initTheme() {
  const btn = document.getElementById("theme-toggle");
  let cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const apply = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    if (btn) btn.textContent = t === "dark" ? "☀" : "☾";
  };
  apply(cur);
  if (btn) {
    btn.addEventListener("click", () => {
      cur = cur === "dark" ? "light" : "dark";
      try { localStorage.setItem("theme", cur); } catch (e) {}
      apply(cur);
    });
  }
}

/* ---- Copy buttons on code blocks ------------------------------------- */
function initCopyButtons() {
  document.querySelectorAll(".code-block .copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const code = btn.parentElement.querySelector("code");
      const text = code ? code.innerText : "";
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        // fallback for insecure contexts (e.g. plain http / file://)
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (_) {}
        document.body.removeChild(ta);
      }
      const prev = btn.textContent;
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = prev; btn.classList.remove("copied"); }, 1500);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
  initTheme();
  initCopyButtons();
});
