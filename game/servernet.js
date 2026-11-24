/* The shared world through our server (phase 2 of server/PLAN.md). [OURS]
   When you're signed in (account.js), store.js uses this instead of the phone-to-phone network: the same messages
   ("hello" with your copy of the world, "put" for one record), carried over one WebSocket to the server, which keeps
   the world, passes messages on and is always there. Other signed-in players show up as peers, exactly like phones did.
   Signed out, or with no server, nothing changes (phone-to-phone as before).
   - Connects with your session and the character you play; the server checks the character is on your account.
   - Drops and comes back by itself (2 s, then up to 30 s between tries); everyone you saw "leaves" until it's back.
   - Another device taking over closes the connection at once (code 4001) and account.js shows the usual notice. */
const SERVERNET = (() => {
  const DOM = typeof document !== "undefined" && typeof location !== "undefined" && typeof WebSocket !== "undefined";
  const on = () => DOM && typeof ACCOUNT !== "undefined" && ACCOUNT.signedIn() && !/[?&]p2p\b/.test(location.search);
  const wsUrl = () => ACCOUNT.server().replace(/^http/, "ws") + "/ws";
  let status = "offline", lastCode = 0;

  /* the transport store.js asks for: join(code, handlers) → { send(data, peer?), leave(), direct() } */
  function join(code, h) {
    let ws = null, closed = false, retry = 2e3, retryT = 0;
    const peers = new Map();   // peer id → uid
    const dropPeers = () => { for (const p of [...peers.keys()]) { peers.delete(p); h.onLeave(String(p)); } };
    function open() {
      if (closed || !ACCOUNT.signedIn()) return;
      status = "connecting";
      try { ws = new WebSocket(wsUrl()); } catch (e) { return later(); }
      ws.onopen = () => { ws.send(JSON.stringify({ k: "auth", token: ACCOUNT.token(), uid: Store.uid })); };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.k === "ready") { status = "connected"; retry = 2e3; }
        else if (m.k === "world") h.onWorld?.(m.world || {});
        else if (m.k === "peers") for (const x of m.list || []) { peers.set(x.peer, x.uid); h.onJoin(String(x.peer)); }
        else if (m.k === "join") { peers.set(m.peer, m.uid); h.onJoin(String(m.peer)); }
        else if (m.k === "leave") { peers.delete(m.peer); h.onLeave(String(m.peer)); }
        else if (m.k === "m") h.onMessage(m.data, String(m.from));
      };
      ws.onclose = (ev) => {
        ws = null; lastCode = ev.code; status = "offline"; dropPeers();
        let why = {}; try { why = JSON.parse(ev.reason || "{}"); } catch { /* plain text */ }
        if (ev.code === 4001 || ev.code === 4401) { if (typeof ACCOUNT !== "undefined") ACCOUNT.lostSession(why.error ? why : { error: ev.code === 4001 ? "session_replaced" : "signed_out" }); return; }
        if (ev.code === 4403 || ev.code === 4400) { status = "refused"; return; }   // not your character: stay off the server world
        later();
      };
      ws.onerror = () => { /* onclose follows */ };
    }
    function later() { if (closed) return; clearTimeout(retryT); retryT = setTimeout(open, retry); retry = Math.min(30e3, retry * 2); }
    open();
    if (typeof addEventListener === "function") addEventListener("online", () => { if (!ws) { retry = 2e3; later(); } });
    return {
      send(data, peer) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ k: "m", data, ...(peer != null ? { to: +peer } : {}) })); },
      leave() { closed = true; clearTimeout(retryT); try { ws?.close(1000); } catch { /* gone */ } dropPeers(); },
      direct: () => peers.size,
    };
  }
  return { name: "server", on, join, get status() { return status; }, get lastCode() { return lastCode; } };
})();
if (typeof module !== "undefined") module.exports = SERVERNET;
