/* A bard's song: write one short line about a deed at any inn (once per in-game day). Other players like the lines
   they enjoy, and each in-game week the best-liked lines become the "Song of the North" that bards sing at every inn.
   Records: "verses" (one per player per in-game day, id uid-day) and "verselikes" (one per voter per verse, so a like
   can't be counted twice). Pure logic here; ui.js draws it. [OURS] */
const BARDS = (() => {
  const MAX_LEN = 90, MIN_LEN = 6, MAX_PENDING = 2, SONG_LINES = 6, MIN_LIKES = 2, REWARD_GOLD = 100, TITLE = "Sung in the halls";
  // a short, generic block list (whole words); anything matching is refused rather than shown
  const BLOCK = ["fuck", "shit", "cunt", "bitch", "nigger", "nigga", "faggot", "fag", "retard", "whore", "slut", "rape", "kike", "spic", "chink", "tranny", "nazi", "hitler", "kys"];
  const blockRe = new RegExp(`(^|[^a-z])(${BLOCK.join("|")})(s|es|ed|ing)?([^a-z]|$)`, "i");
  const urlRe = /(https?:\/\/\S+|www\.\S+|\b[\w-]+\.(com|net|org|io|gg|ru|pl|de|xyz|me|tv|app|link|ly)\b\S*)/gi;

  /* -> { text } or { err } */
  function clean(raw) {
    let t = String(raw || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(urlRe, "").replace(/\s+/g, " ").trim();
    if (t.length > MAX_LEN) t = t.slice(0, MAX_LEN).replace(/\s+\S*$/, "") + "…";
    if (t.length < MIN_LEN) return { err: "Write a few more words." };
    const plain = t.toLowerCase().replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5\$/g, "s").replace(/[*_.-]/g, "");
    if (blockRe.test(t) || blockRe.test(plain)) return { err: "The bard won't sing that. Try other words." };
    return { text: t };
  }

  // in-game days and weeks (1 in-game day = 2 real hours)
  const day = (t = G.now()) => G.clock(t).day;
  const week = (t = G.now()) => Math.floor((day(t) - 1) / 7);
  const weekOf = (v) => Math.floor((v.day - 1) / 7);
  const DAY_SECONDS = 24 * 3600 / G.GAME_SPEED;

  /* suggestions from what you've really done (newest first) */
  function deeds(s) {
    const out = [], name = s.name;
    const cleared = Object.entries(s.cleared || {}).sort((a, b) => b[1] - a[1])[0];
    if ((s.dragons || 0) > 0) out.push(["dragon", `${name} faced the dragon and drank its soul, and the sky grew quiet.`]);
    if (cleared) out.push(["dungeon", `Into ${cleared[0]} went ${name}, and out came only ${name}.`]);
    if (s.arena?.wins) out.push(["arena", `In Windhelm's ring ${name} stood when the dust had settled.`]);
    if (s.cvDone || s.caravanDone) out.push(["caravan", `${name} guarded the wagons, and not one bale was lost.`]);
    if (s.homes && Object.keys(s.homes).length) out.push(["home", `${name} keeps a hearth in ${Object.keys(s.homes)[0]}, and the door is always open.`]);
    if ((s.level || 1) >= 10) out.push(["level", `${name} walked the roads of the North and grew strong as the mountains.`]);
    out.push(["road", `${name} took the long road north, with snow on the boots and a song in the heart.`]);
    return out.slice(0, 4);
  }

  const mine = (docs, uid) => docs.filter((v) => v.uid === uid);
  /* write today's verse -> { id, doc, text } or { err } */
  function write(s, raw, deedTag, docs, t = G.now()) {
    if (!s.location || !TOWNS.INNS[s.location]) return { err: "Verses are written at an inn, over a mug of mead." };
    const d = day(t), id = `${s.id}-${d}`;
    if (docs.some((v) => v.id === id)) return { err: "You've written your verse for today. Come back tomorrow." };
    const pending = mine(docs, s.id).filter((v) => weekOf(v) === week(t)).length;
    if (pending >= MAX_PENDING) return { err: `You have ${MAX_PENDING} verses waiting for this week's song already.` };
    const c = clean(raw); if (c.err) return c;
    return { id, doc: { uid: s.id, name: s.name, text: c.text, deedTag: deedTag || "", town: s.location, day: d, t }, text: `You write your verse and hand it to the bard: “${c.text}”` };
  }

  // ---- likes: one record per voter per verse
  const likeId = (verseId, voter) => `${verseId}|${voter}`;
  function like(s, verse, likes) {
    if (!verse) return { err: "That verse is gone." };
    if (verse.uid === s.id) return { err: "You can't cheer for your own verse." };
    const id = likeId(verse.id, s.id);
    if (likes.some((l) => l.id === id)) return { err: "You've cheered for that one already." };
    return { id, doc: { verseId: verse.id, voter: s.id, t: G.now() } };
  }
  function counts(likes) {
    const c = {}, seen = new Set();
    for (const l of likes) { if (!l?.verseId || !l.voter) continue; const k = l.verseId + "|" + l.voter; if (seen.has(k)) continue; seen.add(k); c[l.verseId] = (c[l.verseId] || 0) + 1; }
    return c;
  }
  const liked = (likes, verseId, uid) => likes.some((l) => l.verseId === verseId && l.voter === uid);

  /* the song for an in-game week: deterministic for the same records (likes desc, then oldest, then id) */
  function songFor(w, verses, likes, muted = []) {
    const c = counts(likes);
    const pool = verses.filter((v) => weekOf(v) === w && !muted.includes(v.uid))
      .map((v) => ({ ...v, likes: c[v.id] || 0 }))
      .sort((a, b) => b.likes - a.likes || a.t - b.t || (a.id < b.id ? -1 : 1));
    const loved = pool.filter((v) => v.likes >= MIN_LIKES);
    const lines = (loved.length >= 4 ? loved : pool).slice(0, SONG_LINES);
    return { week: w, lines, final: false };
  }
  /* what the bards sing now: last week's finished song, or this week's song so far if last week was quiet */
  function current(verses, likes, muted = [], t = G.now()) {
    const w = week(t), last = songFor(w - 1, verses, likes, muted);
    if (last.lines.length) return { ...last, final: true };
    const now = songFor(w, verses, likes, muted);
    return { ...now, final: false };
  }
  /* authors of a finished song get paid once for that week */
  function reward(s, song) {
    if (!song?.final || !song.lines.some((v) => v.uid === s.id)) return null;
    s.songsRewarded = s.songsRewarded || [];
    if (s.songsRewarded.includes(song.week)) return null;
    s.songsRewarded = [...s.songsRewarded, song.week].slice(-20);
    s.gold += REWARD_GOLD;
    let text = ` The bards sing your verse in every inn this week. The innkeepers send you ${REWARD_GOLD} gold.`;
    if (!(s.titles || []).includes(TITLE)) { s.titles = [...(s.titles || []), TITLE]; text += ` People call you ${TITLE}.`; }
    return text;
  }
  const weekName = (w) => `the week of Day ${w * 7 + 1}`;
  return { MAX_LEN, MAX_PENDING, MIN_LIKES, REWARD_GOLD, TITLE, DAY_SECONDS, clean, day, week, weekOf, deeds, write, like, likeId, counts, liked, songFor, current, reward, weekName, mine };
})();
