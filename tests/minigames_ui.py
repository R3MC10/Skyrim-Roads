"""Unique fight minigames [mgunique] (mg_games.js) in the browser at phone size. Usage: python minigames_ui.py PORT — prints RESULT OK.
Opens every registered game (each weapon type, its power version, every move and spell school), takes a screenshot of
each mid-game in tests/mg/, plays it with touch-like input and checks it ends with a grade and no page errors.
Then plays a few on perfect timing (Space at the right moment) to check that a good player really gets Perfect,
and checks Settings → Simple turns every game back into the one-tap bar."""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8894"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mg") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

# id, g (what kindFor would give), how to play it: tap / hold / swipe / drag / taps
GAMES = [
    ("dagger", {"kind": "strike"}, "taps"), ("dagger", {"kind": "power"}, "taps"),
    ("sword", {"kind": "strike"}, "swipe"), ("sword", {"kind": "power"}, "swipe"),
    ("axe", {"kind": "strike"}, "hold"), ("axe", {"kind": "power"}, "hold"),
    ("mace", {"kind": "strike"}, "tap"), ("mace", {"kind": "power"}, "tap"),
    ("greatsword", {"kind": "strike"}, "hold2"), ("greatsword", {"kind": "power"}, "hold2"),
    ("battleaxe", {"kind": "strike"}, "hold"), ("battleaxe", {"kind": "power"}, "hold"),
    ("warhammer", {"kind": "strike"}, "tap"), ("warhammer", {"kind": "power"}, "tap"),
    ("spear", {"kind": "strike"}, "flick"), ("spear", {"kind": "power"}, "flick"),
    ("bow", {"kind": "aim"}, "hold"), ("bow", {"kind": "aim", "hard": True}, "hold"),
    ("crossbow", {"kind": "aim"}, "tap"), ("crossbow", {"kind": "aim", "hard": True}, "tap"),
    ("fist", {"kind": "strike"}, "taps"), ("fist", {"kind": "power"}, "taps"),
    ("dual", {"kind": "strike"}, "taps"), ("dual", {"kind": "power"}, "taps"),
    ("guard", {"kind": "parry", "foe": "arrow"}, "tap"), ("guard", {"kind": "parry", "foe": "claw"}, "tap"),
    ("guard", {"kind": "parry", "foe": "spell"}, "tap"), ("guard", {"kind": "parry", "foe": "blade"}, "tap"),
    ("bash", {"kind": "parry", "shove": True}, "swipe"),
    ("shout", {"kind": "shout", "words": 1}, "hold"), ("shout", {"kind": "shout", "words": 3}, "hold"),
    ("sneak", {"kind": "strike"}, "taps"),
    ("destruction-fire", {"kind": "rune", "school": "Destruction"}, "taps"),
    ("destruction-frost", {"kind": "rune", "school": "Destruction"}, "drag"),
    ("destruction-shock", {"kind": "rune", "school": "Destruction"}, "taps"),
    ("restoration", {"kind": "rune", "school": "Restoration"}, "taps"),
    ("restoration-ally", {"kind": "rune", "school": "Restoration"}, "drag"),
    ("alteration", {"kind": "rune", "school": "Alteration"}, "taps"),
    ("conjuration", {"kind": "rune", "school": "Conjuration"}, "taps"),
    ("illusion", {"kind": "rune", "school": "Illusion"}, "taps"),
    ("mysticism", {"kind": "rune", "school": "Mysticism"}, "taps"),
    ("dualcast", {"kind": "rune", "school": "Destruction", "dual": True}, "taps"),
    ("staff", {"kind": "rune", "school": "Conjuration", "staff": True}, "taps"),
]

OPEN = """([id, g]) => { document.querySelectorAll('.tbtime').forEach(e => e.remove());
  g = Object.assign({ id, label: id }, g); window.__mgp = [];
  const o = { icon: '', label: id.replace(/-/g, ' '), onProgress: (p) => window.__mgp.push(p) };
  const K = MINIGAME.KIT, R = MINIGAME.REG, w = 1;
  const run = g.dual && R.dualcast ? R.dualcast : R[id];
  const pr = run ? run(document.body, g, o, w, K) : g.kind === 'rune' ? K.rune(document.body, g, o, w) : g.kind === 'aim' ? K.aim(document.body, g, o, w) : K.bar(document.body, g, o, w);
  window.__mgr = null; window.__mgt0 = performance.now(); pr.then((r) => { window.__mgr = r; }); return !!run; }"""

async def play(pg, how):
    el = await pg.query_selector(".tbtime svg")
    box = await el.bounding_box() if el else {"x": 100, "y": 300, "width": 200, "height": 200}
    X = lambda u: box["x"] + box["width"] * u / 100
    Y = lambda u: box["y"] + box["height"] * u / 100
    async def done(): return await pg.evaluate("!!window.__mgr")
    for _ in range(30):
        if await done(): return
        if how == "tap":
            await pg.mouse.move(X(50), Y(50)); await pg.mouse.down(); await pg.mouse.up(); await pg.wait_for_timeout(200)
        elif how == "taps":
            for (x, y) in [(50, 84), (34, 58), (56, 46), (42, 26), (58, 12), (30, 30), (70, 30), (50, 75), (70, 25), (86, 55), (64, 78), (28, 50), (72, 50), (50, 14), (80, 74), (20, 40), (80, 40), (20, 74)]:
                if await done(): return
                await pg.mouse.move(X(x), Y(y)); await pg.mouse.down(); await pg.mouse.up(); await pg.wait_for_timeout(110)
        elif how in ("hold", "hold2"):
            await pg.mouse.move(X(50), Y(50)); await pg.mouse.down(); await pg.wait_for_timeout(600); await pg.mouse.up(); await pg.wait_for_timeout(300)
        elif how == "swipe":
            await pg.mouse.move(X(20), Y(70)); await pg.mouse.down(); await pg.mouse.move(X(50), Y(20), steps=5); await pg.mouse.move(X(85), Y(72), steps=5); await pg.wait_for_timeout(600); await pg.mouse.up(); await pg.wait_for_timeout(200)
        elif how == "flick":
            await pg.mouse.move(X(50), Y(80)); await pg.mouse.down(); await pg.mouse.move(X(50), Y(40), steps=4); await pg.mouse.up(); await pg.wait_for_timeout(200)
        elif how == "drag":
            await pg.mouse.move(X(16), Y(60)); await pg.mouse.down()
            for i in range(14): await pg.mouse.move(X(16 + i * 5), Y(60 - i * 1.5), steps=2); await pg.wait_for_timeout(60)
            await pg.mouse.up(); await pg.wait_for_timeout(200)

# perfect play with Space at the right moment (ms after start); the windows are wide enough for timer jitter
PERFECT = [
    ("warhammer", {"kind": "strike"}, [("t", 250 + 1050 * (68 / 80) ** 0.5)]),
    ("dagger", {"kind": "strike"}, [("t", 520), ("t", 880)]),
    ("mace", {"kind": "strike"}, [("t", 1100 / 4 + 1100 / 2)]),
    ("battleaxe", {"kind": "strike"}, [("d", 150), ("u", 150 + 800)]),
    ("shout", {"kind": "shout", "words": 3}, [("d", 450), ("u", 450 + 960)]),
]
TIMED = """([steps]) => new Promise((res) => { const t0 = window.__mgt0;
  const fire = (type) => dispatchEvent(new KeyboardEvent(type, { key: ' ', bubbles: true, cancelable: true }));
  for (const [k, at] of steps) { const go = () => { const d = t0 + at - performance.now(); if (d > 2) return setTimeout(go, Math.max(0, d - 2)); if (k === 'd' || k === 't') fire('keydown'); if (k === 'u' || k === 't') fire('keyup'); }; go(); }
  const wait = () => window.__mgr ? res(window.__mgr) : setTimeout(wait, 30); wait(); })"""

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if CHROME and os.path.exists(CHROME) else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "minigame" in m.text else None)
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&games"); await pg.wait_for_timeout(1800)
        ok(await pg.evaluate("typeof MINIGAME !== 'undefined' && !!MINIGAME.REG && Object.keys(MINIGAME.REG).length >= 20"), "the unique games are registered")
        shots = []
        for i, (gid, g, how) in enumerate(GAMES):
            name = gid + ("-power" if g.get("kind") == "power" or g.get("hard") else "") + ("-" + g["foe"] if "foe" in g else "") + ("-%dw" % g["words"] if "words" in g else "")
            await pg.evaluate(OPEN, [gid, g])
            await pg.wait_for_timeout(500 if how not in ("hold", "hold2") else 250)
            if how in ("hold", "hold2"):   # show the wind-up / draw in the picture
                await pg.keyboard.down(" "); await pg.wait_for_timeout(350)
            path = OUT + "%02d-%s.png" % (i, name)
            await pg.screenshot(path=path); shots.append(path)
            if how in ("hold", "hold2"): await pg.keyboard.up(" ")
            await play(pg, how)
            for _ in range(40):
                if await pg.evaluate("!!window.__mgr"): break
                await pg.wait_for_timeout(100)
            r = await pg.evaluate("window.__mgr")
            ok(bool(r) and r.get("cls") in ("perfect", "good", "poor") and isinstance(r.get("mult"), (int, float)), f"{name}: ends with a grade ({r and r.get('label')})")
            el = await pg.evaluate("Date.now()")  # noqa
        for gid, g, steps in PERFECT:
            await pg.evaluate(OPEN, [gid, g])
            r = await pg.evaluate(TIMED, [steps])
            ok(r.get("cls") in ("perfect", "good"), f"{gid}: right on time is a hit ({r.get('label')})")
            ok(r.get("cls") == "perfect", f"{gid}: right on time is Perfect ({r.get('label')})")
        # a tap at a random wrong moment on the warhammer is not Perfect
        await pg.evaluate(OPEN, ["warhammer", {"kind": "strike"}])
        r = await pg.evaluate(TIMED, [[("t", 300)]])
        ok(r.get("cls") == "poor", f"warhammer: tapping way too early is a Miss ({r.get('label')})")
        # Simple mode: every move is the one-tap bar again
        await pg.evaluate("localStorage.setItem('rotn_prefs', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('rotn_prefs')||'{}'), {tbGamesSimple: true})))")
        res = await pg.evaluate("""() => { const f = { wt: 'dagger', s: null, e: { name: 'Bandit' } }; document.querySelectorAll('.tbtime').forEach(e => e.remove());
          try { MINIGAME.play(document.body, f, 'attack', { label: 'x' }); } catch (e) { return 'err ' + e; }
          const el = document.querySelector('.tbtime'); return el ? (el.querySelector('.mg-bar') ? 'bar' : el.className) : 'none'; }""")
        await pg.screenshot(path=OUT + "99-simple.png"); shots.append(OUT + "99-simple.png")
        ok(res == "bar" or res == "none", f"Simple (one tap): the plain bar instead ({res})")
        ok(not errs, "no page errors: " + "; ".join(errs[:3]))
        print("screenshots:", len(shots), "in", OUT)
        await b.close()
    print("RESULT", "OK" if not fails else "FAIL %d" % len(fails))
    sys.exit(1 if fails else 0)

asyncio.run(main())
