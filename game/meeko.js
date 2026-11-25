/* Meeko comes back (meeko.js). [OURS]
   Meeko, the stray dog, is the only follower with no home town (encounters.js adds him with home = null), so every way a
   follower leaves you lost him for good: Dismiss said "Meeko heads home" (there is no home), a walk-out at 0 loyalty
   waits for a rehire in their town (he has none), and the road event that brings him is once only.
   Now:
   - Dismissing him: he trots off and finds you again on the road (a road event, "Meeko finds you").
   - Walking out at 0 loyalty: same rule as everyone else, he won't come back for three days; after that he can find you.
   - Moving into your homestead is untouched (he lives there and you fetch him there).
   - Old saves that lost him (he followed you once, he isn't with you or at your homestead) get the same road event,
     plus one journal line saying so. Nothing is forced on you: when he finds you, you choose to take him or not.
   The event only shows while you travel without a pet. Since pets.js he is a pet (s.pet), so he never blocks a follower. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
const MEEKO = (() => {
  const ID = "meeko", DAY = 2 * 3600;                 // one in-game day = 2 real hours
  const REJOIN_AFTER = (typeof BONDS !== "undefined" && BONDS.REJOIN_AFTER) || 3 * DAY, WAVE_WAIT = DAY, WEIGHT = 20;   // the same three days as anyone who walked out (followerbonds.js)
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const flags = (s) => (s.encFlags = s.encFlags || {});
  const known = () => typeof TOWNS !== "undefined" && !!TOWNS.FOLLOWERS?.[ID];
  const atHome = (s) => { try { return typeof HSROOMS !== "undefined" && HSROOMS.livesAt ? !!HSROOMS.livesAt(s, ID) : false; } catch (e) { return false; } };
  const leftAt = (s) => s?.folData?.[ID]?.bond?.leftAt || 0;

  const TXT = {
    dismiss: "Meeko trots off down the road, tail up. He'll find you again when you travel without a pet.",
    title: "Meeko finds you",
    text: "A familiar bark. Meeko comes bounding down the road, muddy and very pleased with himself, and drops a stick at your feet.",
    take: " \"Good boy. Come on, then.\" (take him along)",
    wave: "Not now, boy",
    took: "Meeko falls in beside you again as if he'd never been gone.",
    waved: "Meeko sniffs your hand, wags his tail and trots off. He'll be around.",
    busy: "You already have a pet with you. Meeko trots off again.",
    lost: "Meeko got lost on the roads a while back. He's still out there looking for you: travel without a pet and he'll find you.",
    tab: "Meeko is out on the roads looking for you. Travel without a pet and he'll find you.",
    sulk: "Meeko is still sulking somewhere out on the roads. Give him a few days.",
  };
  Object.assign(I18N_EXTRA.words, {
    [TXT.dismiss]: "Meeko odbiega drogą z zadartym ogonem. Znajdzie cię znowu, gdy będziesz podróżować bez zwierzaka.",
    [TXT.title]: "Meeko cię znajduje",
    [TXT.text]: "Znajome szczeknięcie. Meeko pędzi drogą, ubłocony i bardzo z siebie zadowolony, i kładzie ci patyk pod nogami.",
    [TXT.take]: " „Dobry piesek. No chodź”. (weź go ze sobą)",
    [TXT.wave]: "Nie teraz, piesku",
    [TXT.took]: "Meeko znowu idzie przy twojej nodze, jakby nigdy nie zniknął.",
    [TXT.waved]: "Meeko obwąchuje ci dłoń, macha ogonem i odbiega. Będzie gdzieś w pobliżu.",
    [TXT.busy]: "Masz już ze sobą zwierzaka. Meeko znowu odbiega.",
    [TXT.lost]: "Meeko jakiś czas temu zgubił się na drogach. Wciąż cię szuka: podróżuj bez zwierzaka, a cię znajdzie.",
    [TXT.tab]: "Meeko jest gdzieś na drogach i cię szuka. Podróżuj bez zwierzaka, a cię znajdzie.",
    [TXT.sulk]: "Meeko wciąż się gdzieś dąsa na drogach. Daj mu kilka dni.",
    // the patch note (b224)
    "Meeko comes back": "Meeko wraca",
    "Meeko the stray dog has no home town, so once he left you (Dismiss, or walking off when he got fed up) he was gone for good. Now he finds you again on the road.":
      "Bezpański pies Meeko nie ma rodzinnego miasta, więc gdy raz cię opuścił (Odpraw albo odejście, gdy miał dość), znikał na zawsze. Teraz znowu znajdzie cię na drodze.",
    "Lost him already? He's out there looking for you. Travel without a follower and he'll come bounding up, with his old level and gear. Your journal and the Follower tab say so.":
      "Już go zgubiłeś? On wciąż cię szuka. Podróżuj bez towarzysza, a przybiegnie do ciebie, z dawnym poziomem i ekwipunkiem. Mówi o tym dziennik i zakładka Towarzysz.",
    "If he walked off because he was unhappy, give him three days first, like any other follower.":
      "Jeśli odszedł, bo był niezadowolony, daj mu najpierw trzy dni, jak każdemu innemu towarzyszowi.",
    "In fights Meeko is a dog again, not a person with his name. A friend's Meeko too.":
      "W walce Meeko znowu jest psem, a nie człowiekiem z jego imieniem. Meeko znajomego też.",
  });

  /* where Meeko is: "with" you, at your "home"stead, "sulking" (walked out under three days ago), "away" (can find you), "never" met */
  function where(s, t = now()) {
    if (!s) return "never";
    if (s.pet?.id === ID || s.follower?.id === ID) return "with";   // a pet now (pets.js); old saves had him as the follower
    if (atHome(s)) return "home";
    if (!s.folData?.[ID] && !flags(s).meekoAway) return "never";
    const l = leftAt(s);
    if (l && t - l < REJOIN_AFTER) return "sulking";
    return "away";
  }
  const canFind = (s, t = now()) => known() && !s.pet && where(s, t) === "away" && !((flags(s).meekoNext || 0) > t);

  /* he comes back: same bond and gear as before; a walk-out is forgiven up to 30 loyalty (like rehiring anyone else) */
  function rejoin(s, t = now()) {
    if (s.pet) return { text: TXT.busy };
    s.pet = { id: ID, hp: typeof PETS !== "undefined" ? PETS.maxHp(s, ID) : TOWNS.followerMax(s, ID), ts: t };   // he's a pet (pets.js): your follower stays
    const f = typeof BONDS !== "undefined" ? BONDS.bond(s, ID) : typeof FOL2 !== "undefined" ? FOL2.st(s, ID) : null;
    if (f) { if (f.bond) delete f.bond.leftAt; f.loyal = Math.max(typeof f.loyal === "number" ? f.loyal : 50, 30); }
    if (typeof BONDS !== "undefined" && BONDS.snap) s.bondSnap = BONDS.snap(s);   // he reacts to what you do from now on, not to everything since he left
    const fl = flags(s); delete fl.meekoAway; delete fl.meekoNext; fl.dog = true;
    return { text: TXT.took };
  }

  // ---- the road event (encounters.js runs it like its own)
  const EVENT = {
    id: "dogback", title: TXT.title, weight: WEIGHT,
    when: (s) => canFind(s),
    make: () => ({ text: TXT.text }),
    choices: () => [["take", TXT.take], ["wave", TXT.wave]],
    take: (s) => rejoin(s),
    wave: (s) => { flags(s).meekoNext = now() + WAVE_WAIT; return { text: TXT.waved }; },
  };

  /* he was dismissed from the pet slot: he trots off and finds you again on the road */
  function sentAway(s) {
    const fl = flags(s); fl.meekoAway = { t: now(), why: "dismiss" }; fl.meekoRecov = 1; delete fl.meekoNext;
    return TXT.dismiss;
  }
  /* one line for the empty Pet section of the Follower tab */
  function tabLine(s) { const w = known() && !s?.pet ? where(s) : ""; return w === "away" ? TXT.tab : w === "sulking" ? TXT.sulk : ""; }

  /* old saves: he followed you once (his follower data is there), he isn't with you or at home, and he didn't just walk out:
     tell the player once that he's out there. The road event does the rest. */
  function recover(s, t = now()) {
    if (!s || !known()) return "";
    const fl = flags(s);
    const w = where(s, t);
    if (fl.meekoRecov || w === "never") return "";
    fl.meekoRecov = 1;
    if (w !== "away" || fl.meekoAway || leftAt(s)) return "";   // with you, at home, already on his way, or he walked out (after three days he can still find you)
    fl.meekoAway = { t, why: "lost" };
    if (Array.isArray(s.journal)) { s.journal.unshift({ t, text: TXT.lost }); s.journal = s.journal.slice(0, 60); }
    return TXT.lost;
  }

  let installed = false;
  function install() {
    if (installed) return; installed = true;
    if (typeof ENC !== "undefined" && ENC.L && ENC.byId && !ENC.byId[EVENT.id]) { ENC.L.push(EVENT); ENC.byId[EVENT.id] = EVENT; }
    if (typeof BONDS !== "undefined" && BONDS.DEEDS) BONDS.DEEDS["dogback:take"] = ["kind", "nature"];
    if (typeof TOWNS !== "undefined" && TOWNS.dismiss) {
      const d0 = TOWNS.dismiss;
      TOWNS.dismiss = function (s, ...rest) {
        const was = s?.follower?.id, msg = d0.call(this, s, ...rest);
        if (was !== ID || s.follower) return msg;
        const fl = flags(s); fl.meekoAway = { t: now(), why: "dismiss" }; fl.meekoRecov = 1; delete fl.meekoNext;
        return TXT.dismiss;
      };
    }
    if (typeof G !== "undefined" && G.migrate) { const m0 = G.migrate; G.migrate = (s, ...a) => { const r = m0(s, ...a); try { recover(r || s); } catch (e) { /* never block a load */ } return r; }; }
  }
  install();
  return { ID, REJOIN_AFTER, WAVE_WAIT, WEIGHT, TXT, EVENT, where, canFind, rejoin, sentAway, recover, tabLine, install };
})();
if (typeof module !== "undefined") module.exports = MEEKO;
