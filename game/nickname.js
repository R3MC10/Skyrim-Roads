/* nickname.js: every hero needs a real name. A blank name or the default "Dovahkiin" isn't allowed:
   new characters must type one, and old saves still called Dovahkiin are asked for one before they can play. */
const NICK = (() => {
  const BANNED = /^(dovah?kh?iin+|dragonborn|player|hero|name|test)$/i;
  function problem(name) {
    const n = String(name || "").trim();
    if (n.length < 2) return "Pick a nickname (at least 2 letters).";
    if (BANNED.test(n.replace(/\s+/g, ""))) return `"${n}" is taken by half of Skyrim. Pick your own nickname.`;
    return "";
  }
  const needs = (s) => !!s && !!problem(s.name);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* blocking box: no close button, Esc/back do nothing until a good name is saved */
  function prompt(s, done) {
    if (typeof document === "undefined" || !needs(s) || document.getElementById("nickbox")) return;
    const box = document.createElement("div"); box.id = "nickbox"; box.className = "nickbox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = `<div class="nickin"><h2>Choose a nickname</h2>
      <p class="sub">Too many heroes are walking around as <b>${esc(s.name || "Dovahkiin")}</b>. Pick a name so your friends can tell you apart.</p>
      <input id="nickname" maxlength="24" autocomplete="off" placeholder="Your nickname">
      <p class="nickerr" id="nickerr"></p>
      <button class="btn pri" id="nickok" style="width:100%">Save and play</button></div>`;
    document.body.appendChild(box);
    const inp = box.querySelector("#nickname"), err = box.querySelector("#nickerr");
    const save = () => {
      const n = inp.value.trim().slice(0, 24), p = problem(n);
      if (p) { err.textContent = p; inp.focus(); return; }
      s.name = n; box.remove(); if (done) done(n);
    };
    box.querySelector("#nickok").onclick = save;
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); e.stopPropagation(); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); } }, true);
    setTimeout(() => inp.focus(), 50);
  }
  return { problem, needs, prompt };
})();
