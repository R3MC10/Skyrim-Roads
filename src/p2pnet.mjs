// Phone-to-phone transport. Phones meet through public Nostr relays (no account, no server of ours),
// then talk directly over WebRTC. Exposed as window.P2PNET so the game code stays plain JS.
import { joinRoom } from "trystero";

window.P2PNET = {
  name: "nostr",
  join(world, handlers) {
    const room = joinRoom({ appId: "roads-of-the-north-v1", password: "rotn:" + world }, "world-" + world);
    const msg = room.makeAction("w");
    room.onPeerJoin(({ peerId }) => handlers.onJoin(peerId));
    room.onPeerLeave(({ peerId }) => handlers.onLeave(peerId));
    msg.onMessage((data, ctx) => handlers.onMessage(data, ctx.peerId));
    room.onError?.((e) => handlers.onError?.(e.code));
    return {
      send: (data, peer) => msg.send(data, peer ? { target: peer } : undefined).catch(() => {}),
      leave: () => room.leave(),
    };
  },
};
