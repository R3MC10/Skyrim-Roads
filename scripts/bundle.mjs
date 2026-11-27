// Faster start for the app: joins the game's ~520 scripts into a couple of minified bundles (www/game.bundle*.js),
// in the same order as the <script> tags in index.html, and minifies the big <style> block. [OURS]
//
// Joining classic scripts keeps their meaning, with two details handled here:
//  1. Top-level `const`/`let`/`class` of a later file would be in their "not yet defined" zone for the whole bundle,
//     so code like `typeof I18N_FOES !== "undefined"` in an earlier file would throw instead of giving "undefined".
//     They're turned into `var` (same global, undefined until set), except names the browser's window already has
//     (`name`, `status`, `top`...), where `var` would change the page itself; those stay as they are.
//  2. A script that throws while loading would stop the rest of its bundle, not only itself. So www keeps the
//     original files too, and if a bundle throws before the page has loaded, it reloads once with ?nobundle=1 and
//     loads the files one by one, exactly like before.
// esbuild never renames top-level names of a script, so the globals other files use keep their names.
//
// game/ is untouched (the web version and development keep the separate files); only www/ (the phone and PC apps)
// gets the bundles. Turn it off with NOBUNDLE=1 npm run build.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import * as acorn from "acorn";

const WINDOW = new Set(JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "windowprops.json"), "utf8")));

/** top-level const/let/class -> var (see 1. above); returns the new source */
export function hoistable(code, file = "") {
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", allowHashBang: true }); }
  catch (e) { throw new Error(`bundle: ${file} doesn't parse: ${e.message}`); }
  const edits = [];   // [start, end, text]
  const names = (pat, out) => {
    if (!pat) return out;
    if (pat.type === "Identifier") out.push(pat.name);
    else if (pat.type === "ObjectPattern") pat.properties.forEach((p) => names(p.type === "RestElement" ? p.argument : p.value, out));
    else if (pat.type === "ArrayPattern") pat.elements.forEach((p) => names(p && p.type === "RestElement" ? p.argument : p, out));
    else if (pat.type === "AssignmentPattern") names(pat.left, out);
    else if (pat.type === "RestElement") names(pat.argument, out);
    return out;
  };
  for (const st of ast.body) {
    if (st.type === "VariableDeclaration" && (st.kind === "const" || st.kind === "let")) {
      const ns = st.declarations.flatMap((d) => names(d.id, []));
      if (ns.some((n) => WINDOW.has(n))) continue;
      edits.push([st.start, st.start + st.kind.length, "var"]);
    } else if (st.type === "ClassDeclaration" && st.id && !WINDOW.has(st.id.name)) {
      edits.push([st.start, st.start, `var ${st.id.name} = `], [st.end, st.end, ";"]);
    }
  }
  edits.sort((a, b) => b[0] - a[0]);
  for (const [s, e, t] of edits) code = code.slice(0, s) + t + code.slice(e);
  return code;
}

export function bundle(www, html) {
  // runs of <script src> tags next to each other become one bundle each (the head ones and the body ones)
  const tagRe = /<script src="([^"]+)"><\/script>/g, runs = [];
  let last = -1;
  for (const m of html.matchAll(tagRe)) {
    const src = m[1];
    if (src === "app.js" || !fs.existsSync(path.join(www, src))) { last = -1; continue; }   // app.js: Android glue, stays separate
    const gap = last < 0 ? "x" : html.slice(last, m.index);
    if (gap.trim() !== "" || !runs.length) runs.push({ files: [], start: m.index, end: 0 });
    const r = runs[runs.length - 1]; r.files.push(src); r.end = m.index + m[0].length; last = r.end;
  }
  let t0 = Date.now(), before = 0, after = 0;
  runs.forEach((r, i) => {
    r.name = i ? `game.bundle${i}.js` : "game.bundle.js";
    let out = "";
    for (const f of r.files) {
      const code = fs.readFileSync(path.join(www, f), "utf8");
      before += code.length;
      let min;
      try { min = esbuild.transformSync(hoistable(code, f), { loader: "js", minify: true, target: "es2020", charset: "utf8", legalComments: "none" }).code; }
      catch (e) { throw new Error(`bundle: ${f}: ${e.message}`); }
      out += `/*${f}*/\n${min}\n;`;
    }
    after += out.length;
    fs.writeFileSync(path.join(www, r.name), out);
  });
  const all = runs.flatMap((r) => r.files);
  // replace each run with a loader: the bundle, or (after a failed bundle) the original files one by one
  const guard = `<script>(function(){window.__bundle=!/[?&]nobundle=1/.test(location.search);if(!window.__bundle)return;` +
    `window.addEventListener("load",function(){window.__booted=1});` +
    `window.addEventListener("error",function(e){if(window.__booted||!e||!/game\\.bundle\\d*\\.js/.test(e.filename||""))return;` +
    `try{if(sessionStorage.getItem("rotn_nobundle"))return;sessionStorage.setItem("rotn_nobundle","1")}catch(x){return}` +
    `var q=location.search?location.search+"&nobundle=1":"?nobundle=1";location.replace(location.pathname+q+location.hash)},true)})()</script>`;
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i];
    const tag = `<script>(function(){if(window.__bundle)document.write('<script src="${r.name}"><\\/script>');` +
      `else{var L=${JSON.stringify(r.files)};for(var i=0;i<L.length;i++)document.write('<script src="'+L[i]+'"><\\/script>')}})()</script>`;
    html = html.slice(0, r.start) + (i === 0 ? guard + "\n" : "") + tag + html.slice(r.end);
  }
  // the big style block: minify (keeps the rules, drops comments and spaces)
  html = html.replace(/<style>([\s\S]*?)<\/style>/g, (all, css) => {
    if (css.length < 20000) return all;
    try { return "<style>" + esbuild.transformSync(css, { loader: "css", minify: true, target: "chrome90", logLevel: "silent" }).code + "</style>"; }
    catch (e) { return all; }
  });
  console.log(`bundle: ${all.length} scripts in ${runs.length} bundles, ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB in ${Date.now() - t0} ms`);
  return html;
}
