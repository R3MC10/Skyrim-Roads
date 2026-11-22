// Phone-to-phone transport. Phones meet through public Nostr relays (no account, no server of ours),
// then talk directly over WebRTC.
// Relay mesh ("scale"): each player connects straight to a handful of others (up to 6) and passes messages on
// for everyone else, so two players who can't reach each other directly still hear each other through the
// players in between. Exposed as window.P2PNET so the game code stays plain JS.
// Backup line: some phones (mobile data, strict Wi-Fi) can never open a direct link, and free relay (TURN) servers
// are gone. Every phone can reach the Nostr relays though, so small messages (who's online, where they are, chat)
// also travel as short-lived, encrypted Nostr events. Relays pass these on without storing them.
import { joinRoom, scale, defaultRelayUrls } from "trystero";
import { schnorr } from "@noble/secp256k1";

const enc = new TextEncoder(), dec = new TextDecoder();
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const sha = async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc.encode(s) : s));
const b64 = (b) => { let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// relays that have been steady for us first, then a few random others from trystero's list
const STEADY = ["wss://relay.primal.net", "wss://relay.nostr.net", "wss://relay.snort.social", "wss://nostr.data.haus"];
const KIND = 24242;          // ephemeral range (20000-29999): relays forward but don't keep
const MAX = 48000;           // bytes per event; relays reject big ones
const BATCH_MS = 1500;       // gather messages so we don't flood the relays

function backup(world, onMessage, { relays = 5 } = {}) {
  const { secretKey, publicKey } = schnorr.keygen(), me = hex(publicKey);
  const ready = (async () => {
    const topic = hex(await sha("rotn-backup:" + world));
    const key = await crypto.subtle.importKey("raw", await sha("rotn:" + world), "AES-GCM", false, ["encrypt", "decrypt"]);
    return { topic, key };
  })();
  const pool = [...new Set([...STEADY, ...defaultRelayUrls.slice().sort(() => Math.random() - 0.5)])].slice(0, relays);
  const socks = new Map(), seen = new Set(), seenQ = [], dead = new Set();
  let queue = [], timer = null, closed = false;
  const sub = hex(crypto.getRandomValues(new Uint8Array(8)));
  const spare = () => { const l = defaultRelayUrls.filter((u) => !socks.has(u) && !dead.has(u)); return l[Math.floor(Math.random() * l.length)]; };
  function connect(url, wait = 3000, fails = 0) {
    if (closed || !url) return;
    let ws, opened = false;
    try { ws = new WebSocket(url); } catch { return; }
    socks.set(url, ws);
    ws.onopen = async () => {
      wait = 3000; fails = 0; opened = true;
      const { topic } = await ready;
      ws.send(JSON.stringify(["REQ", sub, { kinds: [KIND], "#x": [topic], since: Math.floor(Date.now() / 1000) - 30 }]));
    };
    ws.onmessage = (e) => { try { got(JSON.parse(e.data)); } catch { /* not for us */ } };
    ws.onclose = () => {
      if (socks.get(url) === ws) socks.delete(url);
      if (closed) return;
      if (!opened && ++fails >= 2) { dead.add(url); return void setTimeout(() => connect(spare()), 1000); }   // this relay is down: try another
      setTimeout(() => connect(url, Math.min(wait * 2, 60000), fails), wait);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* already closed */ } };
  }
  async function got(m) {
    if (!Array.isArray(m) || m[0] !== "EVENT" || m[1] !== sub) return;
    const ev = m[2];
    if (!ev || ev.pubkey === me || seen.has(ev.id)) return;
    seen.add(ev.id); seenQ.push(ev.id); if (seenQ.length > 3000) seen.delete(seenQ.shift());
    const { topic, key } = await ready;
    if (!ev.tags?.some((t) => t[0] === "x" && t[1] === topic)) return;
    try {
      const [iv, body] = String(ev.content).split(".");
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(body));
      const list = JSON.parse(dec.decode(plain));
      (Array.isArray(list) ? list : [list]).forEach((x) => onMessage(x));
    } catch { /* wrong key or broken: ignore */ }
  }
  async function flush() {
    timer = null;
    const batch = queue; queue = [];
    if (!batch.length) return;
    const { topic, key } = await ready;
    // split into events under the size limit
    const parts = []; let cur = [], size = 0;
    for (const x of batch) {
      const n = JSON.stringify(x).length;
      if (n > MAX * 0.6) continue;                       // too big for the backup line; the direct link carries it
      if (size + n > MAX * 0.6 && cur.length) { parts.push(cur); cur = []; size = 0; }
      cur.push(x); size += n;
    }
    if (cur.length) parts.push(cur);
    for (const p of parts) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(p))));
      const ev = { kind: KIND, tags: [["x", topic]], created_at: Math.floor(Date.now() / 1000), content: b64(iv) + "." + b64(body), pubkey: me };
      const id = await sha(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]));
      const msg = JSON.stringify(["EVENT", { ...ev, id: hex(id), sig: hex(await schnorr.signAsync(id, secretKey)) }]);
      socks.forEach((ws) => { if (ws.readyState === 1) try { ws.send(msg); } catch { /* relay gone */ } });
    }
  }
  pool.forEach((u) => connect(u));
  return {
    send(x) { if (closed) return; queue.push(x); if (!timer) timer = setTimeout(flush, BATCH_MS); },
    open: () => [...socks.values()].filter((ws) => ws.readyState === 1).length,
    leave() { closed = true; clearTimeout(timer); socks.forEach((ws) => { try { ws.close(); } catch { /* ignore */ } }); socks.clear(); },
  };
}

window.P2PNET = {
  name: "nostr+mesh",
  join(world, handlers) {
    const room = joinRoom({ appId: "roads-of-the-north-v1", password: "rotn:" + world, use: [scale({ maxDirectPeers: 6 })] }, "world-" + world);
    const msg = room.makeAction("w");
    room.onPeerJoin(({ peerId }) => handlers.onJoin(peerId));
    room.onPeerLeave(({ peerId }) => handlers.onLeave(peerId));
    msg.onMessage((data, ctx) => handlers.onMessage(data, ctx.peerId));
    room.onError?.((e) => handlers.onError?.(e.code));
    return {
      send: (data, peer) => msg.send(data, peer ? { target: peer } : undefined).catch(() => {}),
      leave: () => room.leave(),
      direct: () => { try { return room.getTopology().directPeerIds.length; } catch { return 0; } },
    };
  },
  backup,
};
