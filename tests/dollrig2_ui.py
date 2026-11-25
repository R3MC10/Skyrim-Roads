"""[dollrig2] Hands, grips and layers (dollfront.js, rig.js, gripdata.js): the paper doll face-on and the fight figure.

Paper doll (DOLLFRONT.probe), every weapon class x with / without shield x man / woman x two races:
  1. every gripping fist is within 2 px of its weapon's grip; two-handers have both hands on the grip
  2. the weapon's angle is within 5 degrees of its class preset, a one-hander's head is below the fist; a shield sits in
     front of the torso covering 25-40% of it; a second blade (dual wield) is in the LEFT hand, mirrored
  3. nothing touches the doll frame's edge
Fight figure (PAINTRIG.draw + PAINTRIG.last): idle, attack (swing) and stagger, each with a shield and with dual wield:
  the main weapon in the right fist, the shield / second blade on the left fist (2 px), and the layer order
  left arm < left blade < left fist < body < shield < right arm < weapon < right fist.
Then the Pack tab live on phone and PC: the moving layers mount, they animate, and they don't under reduced motion.
Contact sheets and Pack shots go to $SHOTS (dollrig2_*.png).  Usage: python3 dollrig2_ui.py PORT"""
import asyncio, sys, os, tempfile
from playwright.async_api import async_playwright
_SHOTS = (os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"
os.makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8784"
FAILS = []
def ok(c, msg):
    print(("ok   " if c else "FAIL ") + msg)
    if not c: FAILS.append(msg)

CLASSES = {"sword": "iron_sword", "dagger": "iron_dagger", "axe": "iron_war_axe", "mace": "steel_mace", "greatsword": "iron_greatsword",
           "battleaxe": "steel_battleaxe", "warhammer": "dwarven_warhammer", "bow": "hunting_bow", "crossbow": "crossbow_dwarven",
           "staff": "staff_flames", "spear": "iron_spear"}

DOLL_JS = """async ([classes]) => {
  const looks = [];
  for (const [wk, id] of Object.entries(classes)) { if (!D.ITEMS[id]) continue;
    for (const r of ["nord", "redguard"]) for (const sx of ["m", "f"]) for (const sh of [false, true]) {
      const eq = { weapon: id, chest: sh ? "steel_armor" : "leather_armor", feet: "leather_boots" }; if (sh) { eq.shield = "iron_shield"; eq.head = "iron_helmet"; }
      looks.push({ wk, L: { r, id: "dr2-" + r + sx + wk + sh, sx: sx === "f" ? "f" : undefined, eq, gl: {} }, sh }); } }
  looks.push({ wk: "dual", L: { r: "nord", id: "dr2-dual", eq: { weapon: "iron_sword", offhand: "iron_dagger", chest: "iron_armor" }, gl: {} }, sh: false });
  looks.push({ wk: "dual", L: { r: "imperial", id: "dr2-dualf", sx: "f", eq: { weapon: "steel_mace", offhand: "iron_war_axe", chest: "leather_armor" }, gl: {} }, sh: false });
  for (let t = 0; t < 120 && !looks.every((x) => DOLLFRONT.ok(x.L)); t++) await new Promise((r) => setTimeout(r, 250));
  const out = [];
  document.body.innerHTML = '<div id=sheet style="background:#1b1712;display:flex;flex-wrap:wrap;gap:4px;padding:4px;width:1880px"></div>';
  for (const x of looks) {
    const W = 200, H = 290, c = document.createElement("canvas"); c.width = W; c.height = H; c.style.background = "#3a3128";
    const g = c.getContext("2d"); const drew = DOLLFRONT.paint(g, x.L, W, H);
    g.fillStyle = "#e9dcc0"; g.font = "11px sans-serif"; g.fillText(`${x.L.r} ${x.L.sx || "m"} ${x.wk}${x.sh ? " +shield" : ""}`, 4, 12);
    document.getElementById("sheet").appendChild(c);
    out.push({ wk: x.wk, r: x.L.r, sx: x.L.sx || "m", sh: x.sh, drew, p: DOLLFRONT.probe(x.L, W, H) });
  }
  return out; }"""

FIGHT_JS = """async () => {
  const looks = [{ r: "nord", id: "dr2-fm", eq: { weapon: "steel_sword", chest: "steel_armor", shield: "iron_shield" }, gl: {} },
                 { r: "imperial", id: "dr2-ff", sx: "f", eq: { weapon: "iron_war_axe", chest: "leather_armor", shield: "iron_shield" }, gl: {} }];
  for (let t = 0; t < 120 && !looks.every((L) => PAINTRIG.can(L)); t++) await new Promise((r) => setTimeout(r, 250));
  document.body.innerHTML = '<div id=sheet style="background:#1b1712;display:flex;flex-wrap:wrap;gap:4px;padding:4px;width:1880px"></div>';
  const out = [];
  for (const L of looks) for (const clip of ["idle", "swing", "stagger"]) for (const mode of ["shield", "dual"]) {
    const c = document.createElement("canvas"); c.width = 300; c.height = 300; c.style.background = "#3a3128";
    const g = c.getContext("2d"), who = "dr2-" + L.id + clip + mode;
    g.save(); g.translate(120, 285); g.scale(4, 4);
    const drew = PAINTRIG.draw(g, L, { clip, u: clip === "swing" ? 0.55 : 0.4, shield: mode === "shield", off: mode === "dual" ? "dagger" : null, who });
    g.restore(); g.fillStyle = "#e9dcc0"; g.font = "12px sans-serif"; g.fillText(`${L.r} ${clip} ${mode}`, 4, 14);
    document.getElementById("sheet").appendChild(c);
    out.push({ L: L.r, clip, mode, drew, last: PAINTRIG.last(who) });
  }
  return out; }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        errs = []
        # ---- the contact sheets
        ctx = await b.new_context(viewport={"width": 1900, "height": 1000})
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&assets"); await pg.wait_for_timeout(1500)
        res = await pg.evaluate(DOLL_JS, [CLASSES])
        ok(len(res) >= 80, f"doll: {len(res)} looks drawn")
        for x in res:
            tag, pr = f"doll {x['r']} {x['sx']} {x['wk']}{' +shield' if x['sh'] else ''}", x["p"]
            if not x["drew"] or not pr: ok(False, f"{tag}: drawn"); continue
            errs_h = [h["err"] for h in pr["hands"]]
            ok(all(e <= 2 for e in errs_h), f"{tag}: grip in the fist {errs_h}")
            if pr["hold"] == "rest": ok(len(pr["hands"]) == 2, f"{tag}: both hands on the two-hander")
            if pr.get("preset") is not None: ok(abs(pr["angle"] - pr["preset"]) <= 5, f"{tag}: angle {pr['angle']} vs {pr['preset']}")
            if pr["hold"] == "hang": ok(pr["tipBelow"], f"{tag}: the head hangs below the fist")
            if "shieldCover" in pr: ok(pr["shieldFront"] and 0.25 <= pr["shieldCover"] <= 0.40, f"{tag}: shield in front, covers {pr['shieldCover']}")
            if x["wk"] == "dual":
                o = pr.get("off") or {}
                ok(o.get("side") == "l" and o.get("leftOfBody") and o.get("err", 9) <= 2 and abs(o.get("angle", 0) - o.get("preset", 99)) <= 5 and o.get("tipBelow"), f"{tag}: second blade in the left hand {o}")
                ok(pr["layers"].index("offWeapon") < pr["layers"].index("offFist") < pr["layers"].index("armR"), f"{tag}: off-hand layer group under the main one")
            ok(pr["mainRight"], f"{tag}: the main weapon is in the right hand")
            ok(pr["edgePx"] == 0, f"{tag}: nothing touches the frame ({pr['edgePx']} px)")
        await pg.evaluate("document.documentElement.style.cssText=document.body.style.cssText='overflow:visible;height:auto;position:static'"); await pg.locator("#sheet").screenshot(path=_SHOTS + "dollrig2_sheet_doll.png")
        fr = await pg.evaluate(FIGHT_JS)
        for x in fr:
            tag, L = f"fight {x['L']} {x['clip']} {x['mode']}", x["last"]
            if not x["drew"] or not L: ok(False, f"{tag}: drawn"); continue
            h, o = L["hands"], L["order"]
            d = lambda a, b: ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
            ok("main" in h and d(h["main"]["grip"], h["mainFist"]) <= 2, f"{tag}: weapon grip in the right fist")
            if x["mode"] == "shield": ok("shield" in h and d(h["shield"]["grip"], h["offFist"]) <= 2 and "off" not in h, f"{tag}: shield on the left fist")
            else: ok("off" in h and d(h["off"]["grip"], h["offFist"]) <= 2 and "shield" not in h, f"{tag}: second blade in the left fist")
            want = ["offArm"] + (["offWeapon"] if x["mode"] == "dual" else []) + ["offFist", "legs", "body"] + (["shield"] if x["mode"] == "shield" else []) + ["mainArm", "mainWeapon", "mainFist"]
            ok(o == want, f"{tag}: layer order {o}")
        await pg.locator("#sheet").screenshot(path=_SHOTS + "dollrig2_sheet_fight.png")
        await ctx.close()
        # ---- the Pack tab, live
        for nm, vp, dsf in [("phone", {"width": 390, "height": 844}, 2), ("pc", {"width": 1920, "height": 1080}, 1)]:
            for rm in ["no-preference", "reduce"]:
                ctx = await b.new_context(viewport=vp, device_scale_factor=dsf, reduced_motion=rm)
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://127.0.0.1:{PORT}/index.html?net=bc&notut&assets"); await pg.wait_for_timeout(1500)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.wait_for_timeout(800)
                await pg.fill("#nm", "Dolly"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
                await pg.evaluate("""()=>{const S=window.__dbg.save(); for (const sl of G.SLOTS) G.unequip(S, sl); for (const i of ['steel_mace','steel_armor','steel_helmet','iron_shield','leather_boots','iron_gauntlets']){ G.give(S,i); const r=S.inv.find(x=>x.item===i); G.equip(S, r.id);} }""")
                for _ in range(8):
                    await pg.evaluate("document.querySelectorAll('#modal,.toast').forEach(m=>m.remove())")
                    try:
                        if nm == "pc": await pg.keyboard.press("i")   # the PC bar: I opens Items
                        else: await pg.click("[data-tab=pack]", timeout=2000)
                        await pg.wait_for_selector(".dfront", timeout=2500); break
                    except Exception: await pg.wait_for_timeout(300)
                for _ in range(40):
                    if await pg.evaluate("!!document.querySelector('.dfront.dfon')"): break
                    await pg.wait_for_timeout(250)
                st = await pg.evaluate("""()=>{const e=document.querySelector('.dfront'); if(!e) return null; const up=e.querySelector('.dfg-up');
                  return {on:e.classList.contains('dfon'), run:e.classList.contains('dfrun'), n:e.querySelectorAll('canvas.dfl').length, anim: up?getComputedStyle(up).animationName:null, w:e.getBoundingClientRect().width}}""")
                tag = f"pack {nm} {rm}"
                ok(st and st["on"] and st["n"] == 12, f"{tag}: the moving figure is mounted {st}")
                if rm == "reduce": ok(st and st["anim"] == "none", f"{tag}: no idle under reduced motion")
                else: ok(st and st["run"] and st["anim"] == "dfrise", f"{tag}: the idle plays")
                if rm == "no-preference":
                    await pg.evaluate("document.querySelectorAll('.toast').forEach(m=>m.remove())")
                    await pg.screenshot(path=_SHOTS + f"dollrig2_after_pack_{nm}.png")
                await ctx.close()
        await b.close()
    ok(not errs, f"no page errors {errs[:3]}")
    print("ALL OK" if not FAILS else f"{len(FAILS)} FAILED")
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
