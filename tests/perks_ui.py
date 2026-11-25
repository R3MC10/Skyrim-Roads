"""Bigger perk trees + statuses on screen. Usage: python3 perks_ui.py PORT  — screenshots in tests/perks/, prints RESULT OK."""
import asyncio, sys, os
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8843"
OUT = _SHOTS + "perks/"; os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok  " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=1&fightanim&p=pk1"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate(clear)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=40; for (const k in S.skills) S.skills[k].lvl=75;
          S.perks={armsman:3,fighting_stance:1,critical_charge:1,bladesman:1,dual_flurry:1,novice_destruction:1,apprentice_destruction:1,augmented_flames:1,intense_flames:1,stealth:2,muffled_movement:1}; }""")
        for style in ["ink"]:
            for sk in ["One-Handed", "Destruction", "Sneak", "Unarmored"]:
                await pg.evaluate("TABMENU.closeHub && TABMENU.closeHub(); __ui.go('stars')"); await pg.wait_for_timeout(500); await pg.evaluate(clear)
                await pg.evaluate(f"document.querySelector('#side .tw-card[data-id=\"{sk}\"]')?.click()"); await pg.wait_for_timeout(500); await pg.evaluate(clear)
                n = await pg.evaluate("document.querySelectorAll('#side .tw-big [data-sk-perk]').length")
                ok(n >= 9, f"{style} {sk}: {n} stars drawn")
                # labels must not overlap each other
                over = await pg.evaluate("""()=>{const L=[...document.querySelectorAll('#side .tw-big text.lbl')].map(t=>t.getBoundingClientRect()); let o=0;
                  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j]; if(a.left<b.right-2&&b.left<a.right-2&&a.top<b.bottom-2&&b.top<a.bottom-2)o++;} return o;}""")
                ok(over == 0, f"{style} {sk}: no overlapping labels ({over})")
                el = await pg.query_selector("#side .tw-big")
                if el: await el.screenshot(path=OUT + f"tree_{style}_{sk.replace(' ', '_')}.png")
            # old perk list screen too (Hero → Perks)
            await pg.evaluate("__ui.go('hero')"); await pg.wait_for_timeout(400); await pg.evaluate(clear)
            await pg.evaluate("document.querySelector('[data-act=pskill][data-id=\"Destruction\"]')?.click()"); await pg.wait_for_timeout(500)
            el = await pg.query_selector("#side .skc")
            if el: await el.screenshot(path=OUT + f"hero_tree_{style}.png")
            # a fight with statuses: fire mage vs you, your firebolt on a troll
            r = await pg.evaluate("""()=>{const S=__dbg.save(); S.spells=[...new Set([...(S.spells||[]),'firebolt','flames'])];
              const troll=D.ENCOUNTERS.find(e=>/troll/i.test(e.name)); const f=new G.Fight(S, G.scaleEnemy({...troll}, 20));
              f.rules=[{if:'always',do:'spell:firebolt'}]; f.ai=false; f.mp=9999; f.run({trySneak:false}); f.apply && 0;
              return {has: f.log.some(l=>l.st && l.st.foe && l.st.foe.burn), txt: f.log.map(l=>l.me).join(' ').slice(0,300), f};}""")
            ok(r["has"], f"{style}: burning shows in fight data")
            ok("burns for" in r["txt"], f"{style}: log says the troll burns")
            await pg.evaluate("""()=>{ const S=__dbg.save(); S.spells=[...new Set([...(S.spells||[]),'firebolt'])]; const troll=D.ENCOUNTERS.find(e=>/troll/i.test(e.name));
              const f=new G.Fight(S, G.scaleEnemy({...troll}, 20)); f.rules=[{if:'always',do:'spell:firebolt'}]; f.ai=false; f.mp=9999; f.hp=9999; f.run({trySneak:false});
              document.getElementById('pkbox')?.remove(); const b=document.createElement('div'); b.id='pkbox'; b.style.cssText='position:fixed;left:0;top:0;width:380px;z-index:9999;background:#111;padding:6px';
              document.body.appendChild(b); const d=document.createElement('div'); d.style.width='368px'; d.innerHTML=FIGHTART.placeholder(f, S); b.appendChild(d); FIGHTART.manual(true); }""")
            await pg.wait_for_timeout(300)
            await pg.evaluate("FIGHTART.advance(2600)"); await pg.wait_for_timeout(100)
            box = await pg.query_selector("#pkbox")
            if box: await box.screenshot(path=OUT + f"fight_burn_{style}.png")
            chips = await pg.evaluate("(()=>{ const c=document.querySelector('#pkbox canvas'); return !!c; })()")
            ok(chips, f"{style}: fight scene drawn")
            await pg.evaluate("FIGHTART.manual(false); document.getElementById('pkbox')?.remove()")
            await pg.evaluate(clear)
        ok(not errs, f"no page errors {errs[:3]}")
        # perklayout: every label of every tree, on a phone (390) and a PC (1920): no overlaps, nothing cut short with "…"
        for (w, h) in [(390, 844), (1920, 1080)]:
            c2 = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            q = await c2.new_page(); e2 = []; q.on("pageerror", lambda e: e2.append(str(e)))
            await q.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=1&fightanim&p=pk{w}"); await q.wait_for_timeout(1500)
            await q.click(".press"); await q.click(".mi[data-t=new]"); await q.fill("#nm", "Sigrid"); await q.click("#begin"); await q.wait_for_timeout(1500)
            await q.evaluate(clear)
            await q.evaluate("document.fonts && document.fonts.ready")
            await q.evaluate("""()=>{const S=window.__dbg.save(); S.level=40; for (const k in S.skills) S.skills[k].lvl=75; S.perks={armsman:2};}""")
            trees = await q.evaluate("Object.keys(PERKS.TREES).filter(k=>PERKS.TREES[k].length)")
            bad, dots, seen, onscreen = [], [], 0, 0
            for sk in trees:
                await q.evaluate("TABMENU.closeHub && TABMENU.closeHub(); __ui.go('stars')"); await q.wait_for_timeout(250); await q.evaluate(clear)
                has = await q.evaluate(f"""(()=>{{const c=document.querySelector('#side .tw-card[data-id="{sk}"]'); if(c) c.click(); return !!c;}})()""")
                await q.wait_for_timeout(300); await q.evaluate(clear)
                # a skill with no card here (a follower's tree...) is drawn the same way in a test box
                res = await q.evaluate("""(sk)=>{
                  let box=document.querySelector('#side .tw-big'), tmp=null;
                  if(!box||box.querySelector('svg')?.dataset.sky!==sk){ tmp=document.createElement('div'); tmp.className='skc'; tmp.style.cssText='position:fixed;left:0;top:0;width:'+innerWidth+'px;z-index:99999';
                    tmp.innerHTML=SKYUI.svg(sk, __dbg.save()); document.body.appendChild(tmp); SKYUI.fit(document.body); box=tmp; }
                  const T=[...box.querySelectorAll('text.lbl')], L=T.map(t=>t.getBoundingClientRect()); const pairs=[];
                  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j]; if(a.width&&b.width&&a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)pairs.push(T[i].textContent+' / '+T[j].textContent);}
                  const dots=T.filter(t=>/…|\\.\\.\\./.test(t.textContent)).map(t=>t.textContent), lines=Math.max(0,...T.map(t=>t.querySelectorAll('tspan').length));
                  if(tmp) tmp.remove(); return {n:T.length, pairs, dots, lines, real:!tmp};}""", sk)
                seen += 1; onscreen += 1 if res["real"] else 0
                if res["pairs"]: bad.append(f"{sk}: {res['pairs'][:3]}")
                if res["dots"]: dots.append(f"{sk}: {res['dots'][:3]}")
                if res["lines"] > 2: bad.append(f"{sk}: a label on {res['lines']} lines")
                if w == 390 and sk == "One-Handed":
                    await q.evaluate("document.querySelector('#side .tw-big')?.scrollIntoView({block:'start'})"); await q.wait_for_timeout(200)
                    await q.screenshot(path=OUT + "layout_phone_One-Handed.png")
                if w == 1920 and sk == "One-Handed": await q.screenshot(path=OUT + "layout_pc_One-Handed.png")
            ok(seen == len(trees) and seen > 20, f"{w}px: measured all {seen} trees ({onscreen} on the Skills screen)")
            ok(not bad, f"{w}px: no label overlaps in any tree {bad[:4]}")
            ok(not dots, f"{w}px: no label cut short with … {dots[:4]}")
            # phone: zoomed far out only the perks you can take keep their names; a tap shows the perk in the panel, no floating tip
            if w == 390:
                await q.evaluate("TABMENU.closeHub && TABMENU.closeHub(); __ui.go('stars')"); await q.wait_for_timeout(250); await q.evaluate(clear)
                await q.evaluate("""document.querySelector('#side .tw-card[data-id="One-Handed"]')?.click()"""); await q.wait_for_timeout(300)
                await q.wait_for_selector("#side .tw-big svg[data-sky='One-Handed']", timeout=5000)
                await q.wait_for_timeout(300)
                # perksky: it opens on a perk you can take, the hint sits under the sky, every star is easy to hit
                sky = await q.evaluate("""(()=>{const box=document.querySelector('#side .tw-big'), r=box.getBoundingClientRect();
                  const vis={l:Math.max(r.left,0),t:Math.max(r.top,0),r:Math.min(r.right,innerWidth),b:Math.min(r.bottom,innerHeight)};
                  const can=[...box.querySelectorAll('.st.can circle.core')].map(c=>c.getBoundingClientRect()).filter(c=>c.left>=vis.l&&c.right<=vis.r&&c.top>=vis.t&&c.bottom<=vis.b).length;
                  const h=document.querySelector('.tw-hint2')?.getBoundingClientRect(); const over=h?!(h.bottom<=r.top||h.top>=r.bottom||h.right<=r.left||h.left>=r.right):true;
                  const hs=[...box.querySelectorAll('circle.hit[data-sk-perk]')].map(c=>c.getBoundingClientRect()), small=hs.filter(b=>b.width<44||b.height<44).length;
                  return {can, ncan:box.querySelectorAll('.st.can').length, over, n:hs.length, small, stars:box.querySelectorAll('g.st').length};})()""")
                ok(sky["ncan"] > 0 and sky["can"] > 0, f"phone: a perk you can take is in view when One-Handed opens ({sky['can']}/{sky['ncan']})")
                ok(not sky["over"], "phone: the 'Tap a star' hint sits under the sky, not over it")
                ok(sky["n"] == sky["stars"] and sky["small"] == 0, f"phone: every star has a 44px hit target ({sky['n']} stars, {sky['small']} too small)")
                await q.screenshot(path=OUT + "layout_phone_open.png")
                tips = await q.evaluate("document.querySelectorAll('#side .tw-big [data-tip-k]').length")
                ok(tips == 0, f"phone: no floating tooltips on the stars ({tips})")
                await q.evaluate("SKYUI.setZoom(document.querySelector('#side .tw-big'), 0.6)")
                shown = await q.evaluate("[...document.querySelectorAll('#side .tw-big .st')].filter(g=>getComputedStyle(g.querySelector('text')).display!=='none').every(g=>g.classList.contains('can')||g.classList.contains('sel'))")
                ok(shown, "phone at 0.6x: only perks you can take keep their names")
                await q.evaluate("(()=>{const b=document.querySelector('#side .tw-big'); SKYUI.setZoom(b, 1); b.scrollTop=b.scrollHeight; b.scrollLeft=(b.scrollWidth-b.clientWidth)/2;})()")
                await q.evaluate("document.querySelector('#side .tw-big [data-sk-perk]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))"); await q.wait_for_timeout(400)
                ph = await q.evaluate("(()=>{const d=document.querySelector('.tw-sdet'); if(!d) return 0; return d.getBoundingClientRect().height;})()")
                ok(ph >= 140 and ph <= 190, f"phone: perk details panel at the bottom ({ph:.0f}px)")
                # the whole sky sits above the details panel once you scroll down to it
                gap = await q.evaluate("""(()=>{const box=document.querySelector('#side .tw-big'), pan=document.querySelector('.tw-sdet');
                  let s=box.parentElement; while(s && !(s.scrollHeight>s.clientHeight+2 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s=s.parentElement;
                  (s||document.scrollingElement).scrollBy(0, box.getBoundingClientRect().bottom - pan.getBoundingClientRect().top + 4);
                  return pan.getBoundingClientRect().top - box.getBoundingClientRect().bottom;})()""")
                await q.wait_for_timeout(200)
                top = await q.evaluate("document.querySelector('#side .tw-big').getBoundingClientRect().top")
                ok(gap >= -6 and top >= 0, f"phone: the sky fits above the details panel (gap {gap:.0f}, top {top:.0f})")
                await q.screenshot(path=OUT + "layout_phone_picked.png")
            ok(not e2, f"{w}px: no page errors {e2[:3]}")
            await c2.close()
        await b.close()
    print("RESULT OK" if not fails else f"RESULT FAIL {len(fails)}")
asyncio.run(main())
