/* Market stalls: sell your things from a stall in a town where you own a house, even while you're away.
   Each listing is its own record ("stalls", id sellerId-…). What you list leaves your pack at once (held by
   the stall, like a trade offer). A buyer marks it sold with Store.change, so two buyers can't get the same
   thing; your game collects the gold (minus the market fee) the next time it's open. [OURS] */
const MARKET = (() => {
  const MAX_LISTINGS = 8, FEE = 0.05, MAX_PRICE = 100000;
  const itemName = (r) => NAMES.improved((D.ITEMS[r.item]?.name || r.item), r) + (r.nm ? ` “${r.nm}”` : "");
  const suggest = (r) => Math.max(1, Math.round((D.ITEMS[r.item]?.value || 1) * r.qty * 1.2));
  const hallShop = (s, town) => typeof HALLS !== "undefined" && HALLS.shopOpen(s, town);
  const capFor = (s) => (typeof HALLS !== "undefined" ? HALLS.shopCap(s) : MAX_LISTINGS);
  const mine = (docs, uid) => docs.filter((d) => d.seller === uid && d.status === "open");
  const inTown = (docs, town, uid) => docs.filter((d) => d.town === town && d.status === "open" && d.seller !== uid && d.row && D.ITEMS[d.row.item]);

  /* -> { id, doc, text } or { err } */
  function list(s, rowId, price, docs, t = G.now()) {
    const town = s.location;
    if (!town || !((s.homes || {})[town] || hallShop(s, town))) return { err: "You can only run a stall in a town where you own a house (or a hall with a shop counter)." };
    if (s.trip) return { err: "Stop walking first." };
    if (mine(docs, s.id).length >= capFor(s)) return { err: `Your stall holds ${capFor(s)} things at a time.` };
    const r = G.invRow(s, rowId);
    if (!r || !D.ITEMS[r.item]) return { err: "You don't have that." };
    const n = G.freeQty ? G.freeQty(s, rowId) : r.qty;   // worn gear stays on you; a pair with one worn puts one on the stall
    if (n <= 0) return { err: "Take it off first." };
    if (r.stolen) return { err: "Stolen goods go to a fence, not the market." };
    if (D.ITEMS[r.item].noTrade) return { err: "That's bound to you. It can't be sold." };
    price = Math.floor(+price);
    if (!(price >= 1) || price > MAX_PRICE) return { err: "Set a price between 1 and 100,000 gold." };
    const row = { item: r.item, qty: n, charge: r.charge ?? null, temper: r.temper || 0, tq: r.tq || 0, ...(typeof CRAFTFAIR !== "undefined" ? CRAFTFAIR.pack(r) : {}) };
    G.take(s, rowId, n);
    const id = `${s.id}-${Math.floor(t)}-${Math.floor(Math.random() * 900 + 100)}`;
    const hall = hallShop(s, town);
    return { id, doc: { seller: s.id, sellerName: s.name, town, row, price, status: "open", t, ...(hall ? { hall: true, hallName: s.hall.name } : {}) },
      text: `${itemName(row)}${row.qty > 1 ? ` ×${row.qty}` : ""} is on your stall for ${price} gold.` };
  }
  /* the buyer's side, run inside Store.change. Returns the new doc, or null with a reason in out.err */
  function buy(s, d, out = {}) {
    if (!d || d.status !== "open") { out.err = "Someone bought it first."; return null; }
    if (d.seller === s.id) { out.err = "That's your own stall."; return null; }
    if (s.location !== d.town) { out.err = `You have to be in ${d.town}.`; return null; }
    if (s.gold < d.price) { out.err = `It costs ${d.price} gold. You have ${s.gold}.`; return null; }
    s.gold -= d.price;
    const id = G.give(s, d.row.item, d.row.qty, d.row.charge); const r = G.invRow(s, id);
    if (r && d.row.temper) Object.assign(r, { temper: d.row.temper, tq: d.row.tq });
    if (typeof CRAFTFAIR !== "undefined") CRAFTFAIR.carry(s, id, d.row, d.row.qty);
    out.text = `You buy ${itemName(d.row)}${d.row.qty > 1 ? ` ×${d.row.qty}` : ""} from ${d.sellerName}'s stall for ${d.price} gold.`;
    return { ...d, status: "sold", buyer: s.id, buyerName: s.name, soldAt: G.now() };
  }
  /* the seller's game: take the money for sold things, or the goods back for withdrawn ones */
  function settle(s, d) {
    if (d.seller !== s.id) return null;
    if (d.status === "sold") { const fee = d.hall && typeof HALLS !== "undefined" ? HALLS.HALL_FEE : FEE, net = Math.floor(d.price * (1 - fee)); s.gold += net; return ` ${d.buyerName} bought your ${itemName(d.row)} for ${d.price} gold${d.hall ? " at your hall counter" : ""}. You get ${net} after the market fee.`; }
    if (d.status === "withdrawn") { const id = G.give(s, d.row.item, d.row.qty, d.row.charge); const r = G.invRow(s, id); if (r && d.row.temper) Object.assign(r, { temper: d.row.temper, tq: d.row.tq }); if (typeof CRAFTFAIR !== "undefined") CRAFTFAIR.carry(s, id, d.row, d.row.qty); return `${itemName(d.row)} is back in your pack.`; }
    return null;
  }
  return { MAX_LISTINGS, FEE, capFor, hallShop, suggest, mine, inTown, list, buy, settle, itemName };
})();
