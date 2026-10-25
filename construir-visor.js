import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

const orden = [
  "LEEME.md",
  "00-mapa-del-roadmap.md",
  "00-metodo-sin-ia.md",
  "00-indice-de-sintomas.md",
  "01-html.md",
  "02-css-y-tailwind.md",
  "03-javascript.md",
  "04-npm.md",
  "05-git-y-github.md",
  "06-react.md",
  "07-nodejs.md",
  "08-postgresql.md",
  "09-api-rest.md",
  "10-jwt.md",
  "11-redis.md",
  "12-app-completa.md",
  "13-linux.md",
  "14-aws-basico.md",
  "15-despliegue.md",
  "16-monitoreo.md",
  "17-github-actions.md",
  "18-ansible-y-terraform.md",
  "19-depuracion.md",
  "20-seguridad-minima.md",
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function resolveHref(url) {
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith("#")) return url;
  const [file, hash] = url.split("#");
  if (hash) return `#${hash}`;
  if (file.endsWith(".md")) return `#doc-${file.slice(0, -3)}`;
  return url;
}

function inline(raw) {
  const slots = [];
  let text = raw.replaceAll(/`([^`]+)`/g, (_, code) => {
    slots.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${slots.length - 1}\u0000`;
  });
  text = escapeHtml(text);
  text = text.replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const href = resolveHref(url.replaceAll("&amp;", "&").replaceAll("&quot;", '"'));
    const external = href.startsWith("http");
    const attrs = external ? ' rel="noreferrer"' : "";
    return `<a href="${escapeHtml(href)}"${attrs}>${label}</a>`;
  });
  text = text.replaceAll(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replaceAll(/\u0000(\d+)\u0000/g, (_, index) => slots[Number(index)]);
  return text;
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderMarkdown(markdown, docId) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const out = [];
  let i = 0;

  function flushParagraph(buffer) {
    if (buffer.length === 0) return;
    out.push(`<p>${inline(buffer.join(" "))}</p>`);
    buffer.length = 0;
  }

  const paragraph = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      flushParagraph(paragraph);
      const lang = line.slice(3).trim();
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      const className = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${className}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    const anchor = line.match(/^<a id="([a-z0-9-]+)"><\/a>$/);
    if (anchor) {
      flushParagraph(paragraph);
      out.push(`<a id="${anchor[1]}"></a>`);
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4}) (.+)$/);
    if (heading) {
      flushParagraph(paragraph);
      const level = heading[1].length;
      const id = `${docId}-${slug(heading[2])}`;
      out.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (line.trim() === "") {
      flushParagraph(paragraph);
      i += 1;
      continue;
    }

    if (line.startsWith("|")) {
      flushParagraph(paragraph);
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i]);
        i += 1;
      }
      const parsed = rows
        .filter((row) => !/^\|\s*-+/.test(row.replaceAll("|", "|").trim()) || !row.includes("---"))
        .filter((row) => !/^\|?\s*:?-{3,}/.test(row))
        .map((row) =>
          row
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim()),
        );
      const cleaned = [];
      for (const row of rows) {
        if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(row)) continue;
        cleaned.push(
          row
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim()),
        );
      }
      if (cleaned.length > 0) {
        const [head, ...body] = cleaned;
        const headHtml = head.map((cell) => `<th>${inline(cell)}</th>`).join("");
        const bodyHtml = body
          .map((cells) => `<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
          .join("");
        out.push(
          `<div class="tabla"><table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
        );
      }
      void parsed;
      continue;
    }

    if (/^[-*] /.test(line)) {
      flushParagraph(paragraph);
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      out.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      flushParagraph(paragraph);
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i += 1;
      }
      out.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }

  flushParagraph(paragraph);
  return out.join("\n");
}

const articulos = [];

for (const nombre of orden) {
  const markdown = await readFile(join(dir, nombre), "utf8");
  const titulo = markdown.match(/^# (.+)$/m)?.[1] ?? nombre;
  const docId = `doc-${nombre.slice(0, -3)}`;
  articulos.push({
    nombre,
    titulo,
    docId,
    html: renderMarkdown(markdown, docId),
  });
}

const nav = articulos
  .map(
    (articulo) =>
      `<a href="#${articulo.docId}">${escapeHtml(articulo.titulo)}</a>`,
  )
  .join("");

const main = articulos
  .map(
    (articulo) =>
      `<article id="${articulo.docId}" data-file="${escapeHtml(articulo.nombre)}">\n${articulo.html}\n</article>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Biblioteca de contingencia full stack</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      line-height: 1.55;
      color: #1c1917;
      background: #f6f4ef;
    }
    header.barra {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      gap: 0.75rem;
      align-items: center;
      padding: 0.75rem 1rem;
      background: #1c1917;
      color: #fafaf9;
    }
    header.barra p { margin: 0; font-size: 0.95rem; }
    header.barra input {
      margin-left: auto;
      width: min(28rem, 55vw);
      padding: 0.45rem 0.7rem;
      border: 0;
      border-radius: 0.4rem;
      font: inherit;
    }
    .marco { display: grid; grid-template-columns: 16rem 1fr; }
    nav {
      position: sticky;
      top: 3.4rem;
      align-self: start;
      max-height: calc(100vh - 3.4rem);
      overflow: auto;
      padding: 0.75rem;
      background: #ebe6dc;
    }
    nav a {
      display: block;
      margin: 0.15rem 0;
      padding: 0.28rem 0.4rem;
      color: inherit;
      text-decoration: none;
      border-radius: 0.3rem;
    }
    nav a:hover, nav a:focus { background: #ddd6c8; }
    main { padding: 1.25rem 1.5rem 4rem; max-width: 52rem; }
    article { padding-bottom: 2rem; border-bottom: 1px solid #e4ded2; margin-bottom: 2rem; }
    article[hidden] { display: none; }
    h1 { font-size: 1.7rem; line-height: 1.2; margin: 0 0 0.8rem; }
    h2 { font-size: 1.25rem; margin: 1.6rem 0 0.5rem; }
    h3 { font-size: 1.05rem; margin: 1.2rem 0 0.4rem; }
    a { color: #1d4ed8; }
    code { font-family: ui-monospace, Consolas, monospace; font-size: 0.92em; background: #efeae1; padding: 0.05rem 0.25rem; border-radius: 0.2rem; }
    pre { overflow: auto; padding: 0.8rem 1rem; background: #292524; color: #fafaf9; border-radius: 0.5rem; }
    pre code { background: transparent; color: inherit; padding: 0; }
    .tabla { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; margin: 0.8rem 0; font-size: 0.95rem; }
    th, td { border: 1px solid #d6d3d1; padding: 0.4rem 0.55rem; vertical-align: top; text-align: left; }
    th { background: #ebe6dc; }
    #vacio { display: none; padding: 1rem; background: #fff; border-radius: 0.5rem; }
    #estado { font-size: 0.85rem; color: #44403c; }
    @media (max-width: 800px) {
      .marco { grid-template-columns: 1fr; }
      nav { position: static; max-height: none; }
      header.barra { flex-wrap: wrap; }
      header.barra input { width: 100%; margin-left: 0; }
    }
  </style>
</head>
<body>
  <header class="barra">
    <p>Biblioteca full stack</p>
    <input id="buscar" type="search" placeholder="Buscar un error, un comando o un tema" autocomplete="off">
  </header>
  <div class="marco">
    <nav id="indice">${nav}</nav>
    <main>
      <p id="estado"></p>
      <p id="vacio">Nada coincide con esa búsqueda. Prueba con el texto literal del error.</p>
      ${main}
    </main>
  </div>
  <script>
    const buscar = document.querySelector("#buscar");
    const articulos = [...document.querySelectorAll("article")];
    const enlaces = [...document.querySelectorAll("#indice a")];
    const vacio = document.querySelector("#vacio");
    const estado = document.querySelector("#estado");

    function normalizar(valor) {
      return valor.toLowerCase().normalize("NFD").replace(/\\p{Diacritic}/gu, "");
    }

    function aplicar() {
      const q = normalizar(buscar.value.trim());
      let visibles = 0;
      for (const articulo of articulos) {
        const coincide = q === "" || normalizar(articulo.innerText).includes(q);
        articulo.hidden = !coincide;
        if (coincide) visibles += 1;
      }
      for (const enlace of enlaces) {
        const articulo = document.querySelector(enlace.getAttribute("href"));
        enlace.hidden = Boolean(articulo && articulo.hidden);
      }
      vacio.style.display = visibles === 0 ? "block" : "none";
      estado.textContent = q === "" ? "" : visibles + " temas coinciden";
    }

    buscar.addEventListener("input", aplicar);
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && document.activeElement !== buscar) {
        event.preventDefault();
        buscar.focus();
      }
    });
  </script>
</body>
</html>
`;

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const vistos = new Set();
const duplicados = [];
for (const id of ids) {
  if (vistos.has(id)) duplicados.push(id);
  vistos.add(id);
}
if (duplicados.length > 0) {
  throw new Error(`Ids duplicados: ${[...new Set(duplicados)].join(", ")}`);
}

const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
const rotos = [...new Set(hrefs.filter((href) => !vistos.has(href)))];
if (rotos.length > 0) {
  throw new Error(`Anclas sin destino: ${rotos.join(", ")}`);
}

await writeFile(join(dir, "abrir.html"), html, "utf8");
console.log(`abrir.html escrito: ${articulos.length} temas, ${ids.length} anclas, ${html.length} bytes`);
