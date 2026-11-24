"""Skill-up toasts (skillup.js) in the browser: win a fight that raises two skills and your level, capture the toast
mid-animation (ink on a phone, pixel on PC), check the fight result no longer lists skill-ups and the follower line stays.
   python3 -m http.server 8765 --directory ../game &
   python3 skillup_ui.py 8765            (screenshots go to out_skillup/)"""
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_skillup") + os.sep; os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or next((p for p in ["/usr/bin/google-chrome", r"C:\Program Files\Google\Chrome\Application\chrome.exe"] if os.path.exists(p)), None)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

FIGHT = """(style) => { ART.setStyle(style); document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S = window.__dbg.save(), t = G.now();
  for (const k of Object.keys(S.skills)) if (S.skills[k].lvl < 100) S.skills[k].xp = F.skillXpNeeded(k, S.skills[k].lvl) - 0.01;
  S.charXp = F.charXpNeeded(S.level) - 1;
  G.setHealth(S, G.maxHealth(S));
  const e = G.scaleEnemy({ name: 'Bandit', health: 30, damage: 1, tags: ['humanoid'], level: 1, danger: 'low', gold: [1, 5], text: '' }, 1);
  const f = new G.Fight(S, e, null, t); f.run({ t }); const skills = f.apply(t);
  skills.unshift('💬 Jenassa: "Good fight."');
  window.__dbg.fightResult({ text: 'You defeat the Bandit.', fight: f, gold: 3, loot: [], skills });
  return { won: f.won, skills }; }"""

STATE = """() => { const el = document.getElementById('skillup'), f = el && el.querySelector('.su-fill');
  const r = el ? el.getBoundingClientRect() : null;
  return { on: !!el && el.classList.contains('on'), text: el ? el.innerText : '', m: f ? getComputedStyle(f).transform : '', r: r && [r.left, r.top, r.right, r.bottom],
    modal: document.querySelector('#modal') ? document.querySelector('#modal').innerText : '', q: SKILLUP.queue.map(x => x.kind + ':' + x.name), vw: innerWidth }; }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&p=skup1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ewa"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        ok(await pg.evaluate("typeof SKILLUP !== 'undefined'"), "skillup.js loaded")
        for style, (w, h) in [("ink", (390, 844)), ("pixel", (1920, 1080))]:
            await pg.set_viewport_size({"width": w, "height": h})
            r = await pg.evaluate(FIGHT, style)
            ok(r["won"], f"{style}: fight won")
            await pg.wait_for_timeout(300)
            st = await pg.evaluate(STATE)
            ok(st["on"] and any(w in st["text"].lower() for w in ("increased to", "wzrasta do")), f"{style}: toast showing '{st['text'].strip()}'")
            ok("matrix" in st["m"], f"{style}: bar mid-fill ({st['m']})")
            ok(st["r"] and abs((st["r"][0] + st["r"][2]) / 2 - st["vw"] / 2) < st["vw"] * 0.25, f"{style}: toast roughly centred {st['r']}")
            ok(any(x.startswith("level") for x in st["q"]), f"{style}: level-up banner waits in the queue {st['q']}")
            ok("increased to" not in st["modal"] and "wzrasta do" not in st["modal"] and "Jenassa" in st["modal"], f"{style}: result keeps the follower line, no skill-up text")
            await pg.screenshot(path=OUT + f"toast_{style}_{w}.png")
            # tap to skip until the level-up banner shows
            for _ in range(8):
                if await pg.evaluate("!!(SKILLUP.current && SKILLUP.current.kind === 'level')"): break
                await pg.evaluate("document.getElementById('skillup').click()"); await pg.wait_for_timeout(300)
            await pg.wait_for_timeout(900)
            lv = await pg.evaluate("(() => { const el = document.getElementById('skillup'); return el && el.classList.contains('su-level') ? el.innerText : ''; })()")
            ok(any(w in lv.lower() for w in ("level", "poziom")), f"{style}: Level up banner '{lv.strip()[:60]}'")
            await pg.screenshot(path=OUT + f"level_{style}_{w}.png")
            for _ in range(20):
                if await pg.evaluate("!SKILLUP.current && !SKILLUP.queue.length"): break
                await pg.wait_for_timeout(500)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL ({len(fails)})")
asyncio.run(main())
