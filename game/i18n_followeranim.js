/* i18n_followeranim.js: Polish for the followeranim patch note (allyanim.js: followers play their fight clips).
   Loaded before i18n.js; exact lines go in I18N_EXTRA.words. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
Object.assign(I18N_EXTRA.words, {
  "Followers fight with their whole body":
    "Towarzysze walczą całym ciałem",
  "Followers and party members now really fight in the fight picture: they swing their weapon or draw their bow, cast their spells, raise their shield and flinch when they get hit.":
    "Towarzysze i członkowie drużyny naprawdę walczą na obrazku walki: machają bronią albo napinają łuk, rzucają zaklęcia, podnoszą tarczę i chwieją się, gdy oberwą.",
  "A follower who is knocked down drops to the ground and lies there until someone pulls them back up, and then you see them get back on their feet.":
    "Powalony towarzysz pada na ziemię i leży, dopóki ktoś go nie podniesie, a wtedy widać, jak wstaje.",
  "Summons and other helpers lunge, flinch and fall the same way. Works in both art styles and in the painted battle scenes.":
    "Przyzwane istoty i inni pomocnicy tak samo rzucają się do ataku, chwieją i padają. Działa w obu stylach grafiki i na malowanych scenach bitew.",
});
