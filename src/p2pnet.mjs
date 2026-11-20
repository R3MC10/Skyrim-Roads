// Phone-to-phone transport. Phones meet through public Nostr relays (no account, no server of ours),
// then talk directly over WebRTC.
// Relay mesh ("scale"): each player connects straight to a handful of others (up to 6) and passes messages on
// for everyone else, so two players who can't reach each other directly still hear each other through the
// players in between. Exposed as window.P2PNET so the game code stays plain JS.
import { joinRoom, scale } from "trystero";

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
};
