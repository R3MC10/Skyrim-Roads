/* Clans: a name, a short tag and two banner colours. The founder owns the clan record
   ("clans", id = founder's id) with the invite list; each player writes only their own membership
   ("clanmem", id = their id). Someone counts as a member only if their record points at the clan AND
   the founder invited them (or they're the founder) AND they haven't been sent away. [OURS] */
const CLANS = (() => {
  const COLORS = ["#8c2b22", "#1f4e79", "#2f6b3a", "#6b4a1f", "#4b2a6b", "#1d1d1f", "#c9a75e", "#d9d4c5"];
  const MAX_MEMBERS = 30;
  const clean = (t, n) => String(t || "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  let clans = [], mems = [];
  const set = (c, m) => { if (c) clans = c.filter((x) => x && x.name && x.founder); if (m) mems = m.filter((x) => x && x.clan); };
  const byId = (id) => clans.find((c) => c.id === id) || null;
  function valid(c, uid) { return !!c && (uid === c.founder || ((c.invites || []).includes(uid) && !(c.kicked || []).includes(uid))); }
  /* the clan a player is really in (or null) */
  function of(uid, mine) {
    const rec = uid === mine?.id && mine.clan ? { clan: mine.clan } : mems.find((m) => m.id === uid);
    const c = rec && byId(rec.clan);
    return valid(c, uid) ? c : null;
  }
  const members = (c) => (c ? mems.filter((m) => m.clan === c.id && valid(c, m.id)).map((m) => ({ id: m.id, name: m.name })) : []);
  /* invites waiting for this player */
  const invitesFor = (uid) => clans.filter((c) => (c.invites || []).includes(uid) && !(c.kicked || []).includes(uid));

  /* -> { clan, text } (a record to publish under the founder's id) or { err } */
  function found(s, name, tag, colors) {
    name = clean(name, 24); tag = clean(tag, 12).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (name.length < 3) return { err: "Give your clan a name (3 letters or more)." };
    if (tag.length < 2) return { err: "Pick a tag of 2 to 4 letters, like NORD." };
    if (clans.some((c) => c.id !== s.id && (c.tag === tag || c.name.toLowerCase() === name.toLowerCase()))) return { err: "Another clan already uses that name or tag." };
    const cols = (colors || []).filter((c) => COLORS.includes(c)).slice(0, 2);
    if (cols.length < 2) return { err: "Pick two banner colours." };
    s.clan = s.id;
    return { clan: { name, tag, colors: cols, founder: s.id, founderName: s.name, invites: [], kicked: [], t: G.now() }, text: `The banner of ${name} [${tag}] is raised.` };
  }
  function invite(c, uid) {
    if (members(c).length + (c.invites || []).length >= MAX_MEMBERS * 2) return { err: "That's a lot of invites already." };
    return { clan: { ...c, invites: [...new Set([...(c.invites || []), uid])], kicked: (c.kicked || []).filter((k) => k !== uid) } };
  }
  const kick = (c, uid) => ({ clan: { ...c, kicked: [...new Set([...(c.kicked || []), uid])] } });
  function join(s, c) {
    if (!c || !(c.invites || []).includes(s.id) || (c.kicked || []).includes(s.id)) return { err: "That invitation is gone." };
    if (members(c).length >= MAX_MEMBERS) return { err: `${c.name} is full.` };
    s.clan = c.id;
    return { text: `You swear yourself to ${c.name} [${c.tag}].` };
  }
  function leave(s) { const was = byId(s.clan); s.clan = null; return was ? `You leave ${was.name}.` : "You're not in a clan."; }
  /* banners for the map: one per clan per town where a member has a house */
  function banners(homeDocs, mine, mineRec) {
    const out = new Map();
    const homes = mineRec ? [...homeDocs.filter((d) => d.id !== mine?.id), { ...mineRec, id: mine.id }] : homeDocs;   // our own houses: use the freshest copy
    for (const d of homes) {
      const c = of(d.id, mine); if (!c) continue;
      for (const town of d.towns || []) { const k = c.id + "|" + town; if (!out.has(k)) out.set(k, { town, tag: c.tag, colors: c.colors, name: c.name }); }
    }
    return [...out.values()];
  }
  return { COLORS, MAX_MEMBERS, set, byId, of, members, invitesFor, found, invite, kick, join, leave, banners, valid, get all() { return clans; } };
})();
