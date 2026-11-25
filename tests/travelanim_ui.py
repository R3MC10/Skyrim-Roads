"""Travel strip motion (travelart.js + the horse and walk cycles in figart.js), phone 390x844 and PC 1440x900, ?assets.
Plays the live strip (you on a horse with Jenassa on foot, you on foot, you riding alone, a party) and saves a frame strip
(12 pictures ~100 ms apart) per case, then checks:
  - every hoof and foot touches the ground line in every step of the walk, horse-walk and gallop cycles (FIGART.contact);
  - a planted hoof moves back exactly as far as the ground scrolls (no sliding), and the rider's hips stay on the saddle;
  - in the live strip everyone in the front row stands on the same feet line, the horses walk when anyone is on foot,
    and name tags sit above the heads without touching each other;
  - Reduce motion: the strip doesn't move.
Run: node tests/serve.js 8790  →  py tests/travelanim_ui.py 8790   (pictures in tests/out_travelanim)"""
import asyncio, base64, io, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8790"
OUT = os.environ.get("OUT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_travelanim")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
fails = []
def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: fails.append(msg)

JEN = "{name:'Jenassa',look:PARTY.followerLook('jenassa'),follower:true}"
CASES = {
    "ride_follower": "{riding:true,horse:'#e8e4dc',company:[" + JEN + "]}",
    "walk_follower": "{riding:false,company:[" + JEN + "]}",
    "ride_alone": "{riding:true,horse:'#e8e4dc',company:[]}",
    "party": "{riding:true,horse:'#e8e4dc',company:[" + JEN + ",{name:'Kacper',look:{r:'dunmer',id:'k',eq:{chest:'iron_armor'}},riding:true,horse:'#3a2a20',player:true},{name:'Lydia',look:PARTY.followerLook('lydia'),follower:true}]}",
}
PLAY = """async ([hw, extra, reduce])=>{ document.querySelectorAll('#tvhost').forEach(n=>n.remove());
  const host=document.createElement('div'); host.id='tvhost'; host.className='tripvig'; host.style.cssText=`position:fixed;left:8px;top:60px;width:${hw}px;z-index:99999`;
  document.body.appendChild(host);
  const S=window.__dbg.save(), look=HEROART.lookOf(S), sky=SKY.make({tod:'day',season:'winter',weather:'snow',cold:true});
  TRAVELART.mount(host, Object.assign({ground:'Snow',progress:0.4,look,sky,dest:'Winterhold',origin:'Whiterun',reduce}, eval('('+extra+')')));
  await new Promise(r=>setTimeout(r,500));
  const c=host.querySelector('canvas'), pics=[], dbg=[];
  for (let i=0;i<12;i++){ await new Promise(r=>setTimeout(r,100)); pics.push(c.toDataURL('image/png')); dbg.push(TRAVELART.debug()); }
  return {pics, dbg}; }"""
CONTACT = """()=>{ const look={r:'nord',id:'t',eq:{chest:'iron_armor',head:'iron_helmet',shield:'iron_shield',weapon:'iron_sword'}}, out={};
  const N=24, cases=[['walk','foot'],['ride','walk'],['ride',null],['ride','stand']];
  for (const [pose,gait] of cases) { const rows=[];
    for (let f=0;f<N;f++) rows.push(FIGART.contact({look},{pose,frame:f,steps:N,gait:gait==='foot'?undefined:gait||undefined,horse:'#e8e4dc'}));
    out[pose+':'+(gait||'gallop')]=rows; }
  out.stride=FIGART.STRIDE; return out; }"""

def strip(pics, path):
    try:
        from PIL import Image
    except ImportError: return
    ims = [Image.open(io.BytesIO(base64.b64decode(u.split(",")[1]))) for u in pics]
    w, h = ims[0].size; s = Image.new("RGB", (w, h * len(ims)))
    for i, im in enumerate(ims): s.paste(im, (0, i * h))
    s.save(path)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
        for dev, w, h, dsf, hw in (("phone", 390, 844, 3, 370), ("pc", 1440, 900, 1, 760)):
            ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dsf)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=tanim{dev}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Rider"); await pg.click("#begin"); await pg.wait_for_timeout(900)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            if dev == "phone":   # the cycles themselves, once
                C = await pg.evaluate(CONTACT)
                st = C["stride"]
                for key, rows in C.items():
                    if key == "stride": continue
                    low = [r["foot"] for r in rows]
                    if key == "ride:gallop":   # a gallop has its moment in the air: on the ground most of the stride, never through it
                        on = sum(1 for v in low if abs(v) <= 0.45)
                        check(on >= len(low) * 0.8 and max(low) <= 0.45, f"{key}: hooves on the ground {on}/{len(low)} steps, never below it (max {max(low):.2f})")
                    else:
                        check(all(abs(v) <= 0.45 for v in low), f"{key}: a foot or hoof is on the ground in every step (lowest {min(low):.2f}..{max(low):.2f})")
                    if key.startswith("ride"):
                        gap = [abs(r["hip"] - r["seat"]) for r in rows]
                        check(max(gap) <= 2.5, f"{key}: rider's hips stay on the saddle (max gap {max(gap):.2f} units)")
                        gait = key.split(":")[1]; s = st["horse"][gait] if gait in st["horse"] else 0
                        if s:   # planted hooves move back one step's worth of ground: d = stride / N
                            want, worst, lift = s / len(rows), 0, 0
                            for a, b2 in zip(rows, rows[1:]):
                                for leg, (xa, ya) in a["planted"].items():
                                    lift = max(lift, abs(ya))
                                    if leg in b2["planted"]: worst = max(worst, abs((xa - b2["planted"][leg][0]) - want))
                            check(worst <= 0.3, f"{key}: planted hooves move with the ground, no sliding (worst {worst:.2f} units a step)")
                            check(lift <= 0.45, f"{key}: planted hooves stay on the ground (worst {lift:.2f} units)")
            for name, extra in CASES.items():
                R = await pg.evaluate(PLAY, [hw, extra, False])
                strip(R["pics"], os.path.join(OUT, f"{dev}_{name}_strip.png"))
                D = [d for d in R["dbg"] if d]
                check(len(D) == 12, f"{dev} {name}: strip painted 12 pictures")
                moved = len({round(d["dist"], 1) for d in D}) > 6
                check(moved, f"{dev} {name}: the road moves")
                on_foot = "riding:false" in extra or "follower:true" in extra
                check(all((d["gait"] == "walk") == on_foot for d in D), f"{dev} {name}: horses {'walk with the walkers' if on_foot else 'gallop'}")
                feet_ok = all(f["feet"] == d["feet"] for d in D for f in d["figs"] if f["row"] == 0)
                check(feet_ok, f"{dev} {name}: front row all on one feet line")
                tag_ok = True; head_ok = True
                for d in D:
                    T = d["tags"]
                    for i, a in enumerate(T):
                        for b2 in T[i + 1:]:
                            if abs(a["x"] - b2["x"]) < (a["w"] + b2["w"]) / 2 and abs(a["y"] - b2["y"]) < 12: tag_ok = False
                        f = next((f for f in d["figs"] if f["name"] == a["name"]), None)
                        if f:
                            top = d["feet"] - (78 if f["riding"] else 66) * d["U"] * f["sc"]
                            if a["y"] + 6 > top: head_ok = False
                    ys = [(t["name"], round(t["y"], 2)) for t in T]
                    if d is not D[0] and ys != [(t["name"], round(t["y"], 2)) for t in D[0]["tags"]]: tag_ok = False   # no jitter
                check(tag_ok, f"{dev} {name}: name tags don't overlap and don't jump")
                check(head_ok, f"{dev} {name}: name tags sit above the heads")
            # Reduce motion: nothing moves
            R = await pg.evaluate(PLAY, [hw, CASES["ride_follower"], True])
            check(R["pics"][0] == R["pics"][-1], f"{dev}: Reduce motion keeps the strip still")
            check(R["dbg"][0]["gait"] == "stand", f"{dev}: Reduce motion: the horse stands")
            check(not errs, f"{dev}: no page errors {errs[:2]}")
            await ctx.close()
        await b.close()
    print(f"{len(fails)} failures" if fails else "all ok")
    if fails: sys.exit(1)

asyncio.run(main())
