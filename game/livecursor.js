/* Live cursor [OURS]: while someone watches another player's mini-game, they see that player's pointer
   (mouse or finger) as a small arrow with the player's name, always visible, gliding smoothly.

   API (one shared instance; the screens call mount once):
     LIVECURSOR.mount({ Store, uid(), name() })   wire it to the party sync channel (ui.js does this)
     const stop = LIVECURSOR.send(el, ch)        stream MY pointer over element `el` on channel `ch` (any string,
                                                 e.g. "dg-" + game id). Returns stop(). Call stop when the game closes.
     const off  = LIVECURSOR.attach(el, ch, name) show the pointer streamed on `ch` over MY copy of the element.
                                                 `name` labels it (the sender's own name is used when it's known).
                                                 Returns off(); off() removes the cursor.
   How it travels: positions are normalised to the element (0..1 across, 0..1 down; a little outside is fine, so a
   finger on a button under the picture still shows under the picture), sampled up to 12 times a second and written to
   the shared "lcur" collection, one small record per player ("lc-" + uid) holding the latest few samples. Watchers
   place those samples on their own clock, stay ~0.2 s behind and slide between them, so the arrow moves smoothly
   even when updates arrive in bursts. When the pointer rests, the arrow rests where it was (it never disappears
   while you watch). Each stream carries an id (sid): when the player reloads or reconnects mid-game, watchers start
   the new stream fresh instead of waiting for the old clock to catch up. A watcher who reconnects reads the stored
   record and picks the arrow up again straight away.
   Pure bits for tests: LIVECURSOR.make({ Store, uid, name, now }) gives a separate instance (several "phones" in one
   node process); inst.feed(x, y, down) pushes a normalised sample, inst.flush() sends now, inst.track(ch).at(t)
   reads the smoothed position a watcher would draw. */
const LIVECURSOR = (() => {
  const HZ = 12, SEND_MS = Math.round(1000 / HZ), DELAY = 200, KEEP = 6;
  const DOM = typeof document !== "undefined";
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r3 = (x) => Math.round(x * 1000) / 1000;
  /* a point on screen → normalised to the element's box */
  const norm = (rect, cx, cy) => [r3(clamp((cx - rect.left) / (rect.width || 1), -0.25, 1.25)), r3(clamp((cy - rect.top) / (rect.height || 1), -0.4, 1.8))];
  /* and back onto another element's box */
  const place = (rect, nx, ny) => [rect.left + nx * rect.width, rect.top + ny * rect.height];

  /* a watcher's copy of one sender's stream: samples mapped onto the watcher's clock, read with a small delay */
  function Track() {
    const pts = [];   // [localMs, x, y, down]
    let off = null, lastT = -1, seq = -1, sid = null;
    return {
      /* pts from the record: [senderMs, x, y, down]; recv: the watcher's clock when it arrived; id: the sender's
         stream id (a new one after the sender reloads or reconnects: their clock and count start over, so do we) */
      push(list, recv, s, id) {
        if (!list?.length) return;
        if (id != null && id !== sid) { sid = id; off = null; lastT = -1; seq = -1; pts.length = 0; }
        if (s != null && s <= seq) return;
        if (s != null) seq = s;
        const last = list[list.length - 1][0];
        const o = recv - last;
        off = off == null ? o : Math.min(off + 3, o);   // smallest delay seen, allowed to creep up when the line gets slower
        for (const p of list) if (p[0] > lastT) { lastT = p[0]; pts.push([p[0] + off, +p[1], +p[2], p[3] ? 1 : 0]); }
        while (pts.length > 64) pts.shift();
      },
      at(now) {
        if (!pts.length) return null;
        const t = now - DELAY;
        if (t <= pts[0][0]) return { x: pts[0][1], y: pts[0][2], down: !!pts[0][3] };
        for (let i = pts.length - 1; i > 0; i--) {
          const a = pts[i - 1], b = pts[i];
          if (t >= a[0] && t <= b[0]) { const k = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 1; return { x: a[1] + (b[1] - a[1]) * k, y: a[2] + (b[2] - a[2]) * k, down: !!(k < 0.5 ? a[3] : b[3]) }; }
        }
        const z = pts[pts.length - 1];
        return { x: z[1], y: z[2], down: !!z[3] };   // resting: stay where it was
      },
      get size() { return pts.length; },
    };
  }

  function make(o = {}) {
    let ctx = { Store: o.Store || null, uid: typeof o.uid === "function" ? o.uid : () => o.uid, name: typeof o.name === "function" ? o.name : () => o.name };
    const now = o.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    const wall = o.wall || (() => Date.now());
    // ---- sending
    let out = null, sids = 0;   // { ch, t0, buf: [], sent: [], seq, timer, el, stopDom }
    function feed(x, y, down) {
      if (!out) return;
      const t = Math.round(now() - out.t0);
      const last = out.buf[out.buf.length - 1] || out.sent[out.sent.length - 1];
      if (last && last[1] === x && last[2] === y && !!last[3] === !!down) return;
      if (out.buf.length && t - out.buf[out.buf.length - 1][0] < SEND_MS / 2) out.buf.pop();   // keep ~2 samples per send at most
      out.buf.push([t, x, y, down ? 1 : 0]);
    }
    function flush() {
      if (!out || !out.buf.length || !ctx.Store?.put) return false;
      out.sent = [...out.sent, ...out.buf].slice(-KEEP); out.buf = [];
      out.seq++;
      try { ctx.Store.put("lcur", "lc-" + ctx.uid(), { ch: out.ch, by: ctx.uid(), name: ctx.name() || "", pts: out.sent, seq: out.seq, sid: out.sid, at: wall() }); } catch (e) { console.warn(e); }
      return true;
    }
    function send(el, ch) {
      stopSend();
      if (!ch) return () => {};
      out = { ch: String(ch), t0: now(), buf: [], sent: [], seq: 0, el, sid: `${Math.round(wall()).toString(36)}${++sids}` };
      const mine = out;
      if (DOM && el && typeof addEventListener === "function") {
        const on = (e) => { if (out !== mine || !el.isConnected) return; const [x, y] = norm(el.getBoundingClientRect(), e.clientX, e.clientY); feed(x, y, e.buttons ? 1 : e.type === "pointerdown"); };
        const up = (e) => { if (out !== mine || !el.isConnected) return; const [x, y] = norm(el.getBoundingClientRect(), e.clientX, e.clientY); feed(x, y, 0); };
        addEventListener("pointermove", on, { capture: true, passive: true });
        addEventListener("pointerdown", on, { capture: true, passive: true });
        addEventListener("pointerup", up, { capture: true, passive: true });
        mine.stopDom = () => { removeEventListener("pointermove", on, true); removeEventListener("pointerdown", on, true); removeEventListener("pointerup", up, true); };
        mine.timer = setInterval(() => { if (out === mine) flush(); }, SEND_MS);
      }
      return () => { if (out === mine) stopSend(); };
    }
    function stopSend() {
      if (!out) return;
      flush();
      clearInterval(out.timer); out.stopDom?.();
      out = null;
    }

    // ---- watching
    const tracks = {};   // ch -> { tr: Track, name }
    const views = new Set();
    function onDocs(docs) {
      const t = now(), me = ctx.uid();
      for (const d of docs || []) {
        if (!d || !d.ch || d.by === me || !Array.isArray(d.pts)) continue;
        if (wall() - (d.at || 0) > 120e3) continue;
        const k = d.ch, T = tracks[k] || (tracks[k] = { tr: Track(), name: d.name || "" });
        if (d.name) T.name = d.name;
        T.tr.push(d.pts, t, d.seq, d.sid);
      }
    }
    const track = (ch) => (tracks[ch] || (tracks[ch] = { tr: Track(), name: "" })).tr;
    function attach(el, ch, name) {
      if (!ch) return () => {};
      const v = { el, ch: String(ch), name: name || "", node: null, raf: 0, sx: null, sy: null };
      views.add(v);
      if (DOM && el) {
        const n = document.createElement("div");
        n.className = "lcur"; n.setAttribute("aria-hidden", "true");
        n.innerHTML = `<svg viewBox="0 0 16 20" width="18" height="22"><path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" /></svg><span class="lcname"></span>`;
        document.body.appendChild(n); v.node = n;
        const loop = () => {
          if (!views.has(v)) return;
          if (!el.isConnected) { off(); return; }
          const T = tracks[v.ch], p = T ? T.tr.at(now()) : null, label = T?.name || v.name || "";
          const lab = n.querySelector(".lcname"); if (lab.textContent !== label) lab.textContent = label;
          const rect = el.getBoundingClientRect();
          const [tx, ty] = place(rect, p ? p.x : 0.5, p ? p.y : 0.5);
          // a touch of easing on top of the interpolation hides tiny jumps
          v.sx = v.sx == null ? tx : v.sx + (tx - v.sx) * 0.5; v.sy = v.sy == null ? ty : v.sy + (ty - v.sy) * 0.5;
          n.style.transform = `translate(${Math.round(v.sx)}px, ${Math.round(v.sy)}px)`;
          n.classList.toggle("down", !!p?.down); n.classList.toggle("wait", !p);
          v.raf = requestAnimationFrame(loop);
        };
        v.raf = requestAnimationFrame(loop);
      }
      function off() { views.delete(v); if (DOM) { cancelAnimationFrame(v.raf); v.node?.remove(); } }
      return off;
    }
    function mount(c) {
      ctx = { Store: c.Store, uid: c.uid || ctx.uid, name: c.name || ctx.name };
      if (c.Store?.watch) c.Store.watch("lcur", onDocs);
    }
    return { HZ, DELAY, norm, place, Track, mount, send, attach, feed, flush, onDocs, track, stop: stopSend,
      get sending() { return out ? out.ch : null; }, get watching() { return views.size; } };
  }

  const one = make();
  return { ...one, make, get sending() { return one.sending; }, get watching() { return one.watching; } };
})();
if (typeof module !== "undefined") module.exports = LIVECURSOR;
