"""Shared helper for screen tests: open a road encounter and press Fight, waiting for real state instead of fixed pauses.

    from roadfight import open_fight
    ok_ = await open_fight(pg, START)          # START: a JS function that sets up the hero and calls window.__dbg.openEvent()
    ok_ = await open_fight(pg, START, arg)     # START takes one argument

Why: a window can land on top of the encounter between "the event opens" and "the test clicks Fight" (a quest note,
the courier's letter). The helper re-opens the encounter while the trip is still waiting on it, presses Fight
in the page (no Playwright actionability wait that can time out), and returns once TB.open and TB.session are up.
Returns True when the fight screen is open."""

FIGHT_BTN = "#modal [data-act=ev][data-c=fight]"
FIGHT_UP = "() => !!(window.TB && TB.open && TB.session && document.querySelector('#tbf'))"


async def open_fight(pg, start_js, arg=None, timeout_ms=20000):
    if arg is None: await pg.evaluate(start_js)
    else: await pg.evaluate(start_js, arg)
    waited, last_click = 0, -10000
    while waited < timeout_ms:
        may_click = waited - last_click >= 2000   # one press, then give the game time to open the fight before pressing again
        state = await pg.evaluate("""(mayClick) => {
          if (window.TB && TB.open && TB.session && document.querySelector('#tbf')) return 'fight';
          const b = document.querySelector('%s');
          if (b) { if (!mayClick) return 'waiting'; b.click(); return 'clicked'; }
          const s = window.__dbg && window.__dbg.save();
          if (mayClick && s && s.trip && s.trip.status === 'event' && s.trip.event && !document.querySelector('#tbf')) {   // something replaced the encounter window: bring it back
            document.querySelectorAll('#modal').forEach((m) => m.remove()); window.__dbg.openEvent(); return 'reopened'; }
          return 'waiting'; }""" % FIGHT_BTN, may_click)
        if state == "fight": break
        if state == "clicked": last_click = waited
        await pg.wait_for_timeout(150); waited += 150
    try:
        await pg.wait_for_function(FIGHT_UP, timeout=max(1000, timeout_ms - waited))
    except Exception:
        return False
    return True


async def wait_my_turn(pg, timeout_ms=15000):
    """wait until the hero can act (the Attack move is on the bar)"""
    try:
        await pg.wait_for_function("() => !!document.querySelector('#tbf [data-tba=attack]')", timeout=timeout_ms)
        return True
    except Exception:
        return False
