"""HUD tidy (hud2.js): nothing on the always-visible layer overlaps anything else, on phones (360-430 wide) and 1920x1080,
in both art styles. Checks: top bar buttons, compass, objective line, map buttons, the message lane, big banners, the
the bottom bar (labels fit), the bars fading when full, one speech bubble at a time,
the ★ favourites button docked in the top bar, no sideways scrolling.
   node serve.js 8765 &
   python3 hud2_ui.py 8765            (screenshots go to hud2/)"""
import asyncio, sys, os, shutil
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
os.makedirs("hud2", exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
SIZES = [(360, 740), (390, 844), (430, 932), (1920, 1080)]
fails = []
def ok(c, m):
    if not c: fails.append(m); print("FAIL", m)

PROBE = r"""() => {
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (r.width < 2 || r.height < 2 || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return null;
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  const hit = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const q = (s) => document.querySelector(s);
  const out = { pairs: [], tabs: [], top: [] };
  const lane = q('#hudlane'), laneR = lane && lane.textContent.trim() ? R(lane) : null;
  const els = { compass: R(q('#compass')), obj: R(q('#hudobj')), mapbtns: R(q('.mapbtns')), lane: laneR, tabs: R(q('#tabs')), vitals: R(q('#vitals .hbars')) };
  const pb = [...document.querySelectorAll('#pbanners .pban')].map(R).filter(Boolean);
  const pairs = [['compass','mapbtns'],['obj','mapbtns'],['obj','compass'],['lane','mapbtns'],['lane','compass'],['lane','obj'],['lane','tabs']];
  for (const [a, b] of pairs) if (hit(els[a], els[b])) out.pairs.push(a + ' x ' + b);
  for (const p of pb) { for (const k of ['lane','compass','obj','mapbtns','tabs','vitals']) if (hit(p, els[k])) out.pairs.push('banner x ' + k); }
  // bottom-bar labels fit
  for (const l of document.querySelectorAll('#tabs .tab .mn-l')) if (l.scrollWidth > l.clientWidth + 1) out.tabs.push(l.textContent);
  // top bar: buttons don't touch each other and stay on screen
  const tb = [...document.querySelectorAll('.app .top > .iconbtn, .app .top > .lvlb, .app .top > .who')].map((e) => [e.id || e.className, R(e)]).filter(([, r]) => r);
  for (let i = 0; i < tb.length; i++) { if (tb[i][1].right > innerWidth + 1 || tb[i][1].left < -1) out.top.push('off screen ' + tb[i][0]);
    for (let j = i + 1; j < tb.length; j++) if (hit(tb[i][1], tb[j][1])) out.top.push(tb[i][0] + ' x ' + tb[j][0]); }
  out.hscroll = document.documentElement.scrollWidth > innerWidth + 1;
  out.favDocked = !!R(q('.app .top #favTop')) && !R(q('#favBtn'));
  out.fullBars = [...document.querySelectorAll('.hb.full')].map((e) => +getComputedStyle(e).opacity);
  return out;
}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if CHROME else await p.chromium.launch(args=["--no-sandbox"])
        for (w, h) in SIZES:
            for style in ["ink"]:
                tag = f"{w}x{h}_{style}"
                ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=w < 600)
                pg = await ctx.new_page(); errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=hud2{w}{style}"); await pg.wait_for_timeout(1500)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrolfdir"); await pg.click("#begin"); await pg.wait_for_timeout(1600)
                clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
                await pg.evaluate(clear)
                await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Riverwood'; [S.x,S.y]=WORLD.places.Riverwood; S.discovered.push('Bleak Falls Barrow','Whiterun','Riverwood'); G.setHealth(S,30);}")
                await pg.mouse.move(w - 3, h // 2)
                await pg.wait_for_timeout(2200); await pg.evaluate(clear)
                r = await pg.evaluate(PROBE)
                ok(not r["pairs"], f"{tag} idle overlaps {r['pairs']}")
                ok(not r["tabs"], f"{tag} bottom-bar labels spill {r['tabs']}")
                ok(not r["top"], f"{tag} top bar {r['top']}")
                ok(not r["hscroll"], f"{tag} page scrolls sideways")
                ok(r["favDocked"], f"{tag} star docked in the top bar")
                ok(r["fullBars"] and max(r["fullBars"]) < 0.05, f"{tag} full bars faded {r['fullBars']}")
                ok(await pg.evaluate("!!document.querySelector('#hudobj:not(.hide)')"), f"{tag} objective line under the compass")
                await pg.screenshot(path=f"hud2/{tag}_idle.png")
                # busy: messages, a new objective, a skill banner and two speech bubbles at once
                for t in ["You picked up an Iron Sword.", "Smithing increased to 21", "You sell 3 Ruby for 147 gold.", "Achievement unlocked: First steps"]:
                    await pg.evaluate("t=>window.__dbg.toast(t)", t); await pg.wait_for_timeout(120)
                await pg.evaluate("""()=>{ POLISH.banner('objective','Objective','Talk to Farengar in Dragonsreach','');
                  const mk=(id,cls,who,line,life)=>{ document.querySelector('#'+id)?.remove(); const el=document.createElement('div'); el.id=id; el.className=cls;
                    el.innerHTML='<span class="bkt fbt"><b>'+who+'</b><q>'+line+'</q></span>'; document.body.appendChild(el);
                    setTimeout(()=>{ el.classList.add('gone'); setTimeout(()=>el.remove(),700); }, life); };
                  mk('bark','bark','Guard','Let me guess... someone stole your sweetroll?',4800);
                  mk('folbark','folbark','Lydia','I am sworn to carry your burdens.',5200); }""")
                await pg.wait_for_timeout(500)
                ok(await pg.evaluate("!document.querySelector('.pban-objective')"), f"{tag} new objective shows on the line, not as a big banner")
                ok(await pg.evaluate("/Farengar/.test(document.querySelector('#hudobj')?.textContent||'')"), f"{tag} objective flash text")
                say = await pg.evaluate("[...document.querySelectorAll('#hudlane .hl-say > :not(.gone)')].map(e=>e.id)")
                ok(say == ["bark"], f"{tag} one speech bubble at a time {say}")
                ok(await pg.evaluate("!document.querySelector('body > #bark, body > #folbark')"), f"{tag} bubbles live in the lane")
                r = await pg.evaluate(PROBE)
                ok(not r["pairs"], f"{tag} busy overlaps {r['pairs']}")
                await pg.screenshot(path=f"hud2/{tag}_busy.png")
                await pg.wait_for_timeout(5200)
                say2 = await pg.evaluate("[...document.querySelectorAll('#hudlane .hl-say > :not(.gone)')].map(e=>e.id)")
                ok(say2 == ["folbark"], f"{tag} the waiting bubble shows next {say2}")
                # the docked star still opens the favourites wheel
                await pg.evaluate(clear)
                await pg.click("#favTop"); await pg.wait_for_timeout(400)
                ok(await pg.evaluate("!!document.querySelector('#favwheel')"), f"{tag} star opens the favourites wheel")
                ok(not errs, f"{tag} page errors {errs[:2]}")
                print(tag, "checked")
                await ctx.close()
        await b.close()
    print("hud2_ui:", "FAILED " + str(len(fails)) if fails else "all ok")
    if fails: sys.exit(1)
asyncio.run(main())
