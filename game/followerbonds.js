/* Followers become people (followerbonds.js). [OURS, after Skyrim's followers and the companion systems of other RPGs]
   - Opinions: each follower likes and dislikes kinds of deeds (helping people, stealing, picking fights, praying...).
     What you choose on the road, crimes, guild work, Daedric deals, the war side, curses: they react, and their loyalty
     (0-100, the "loyal" number followers2.js already kept) goes up or down. Shown as a meter with a mood.
   - They talk: banter on the road, lines in towns, comments when you arrive somewhere and after fights.
   - A personal quest per follower that opens at high loyalty: go somewhere, clear a place, make one last choice.
     The reward is real: a signature move they use once per fight (a hard hit, a volley, a bleed, a heal) and a keepsake.
   - Low loyalty bites: they grumble, fight half-heartedly, refuse orders (gear, style, tactics), and at 0 they leave.
   - Party play: in a party only the leader makes choices, so a member can't settle a personal quest's choice while
     travelling with the party.
   Hooks only, no rewrites: G.eventChoice / G.encounterAction / G.advance, FOL2.gain / ally / act / turn, FAI.turn,
   TOWNS.hire, IMM.tick are wrapped here. Followers are never killed by anything in this file. */
const BONDS = (() => {
  const DAY = 2 * 3600, HOUR = DAY / 24;              // one in-game day = 2 real hours
  const TALK_EVERY = 4 * HOUR, GIFT_EVERY = DAY, GIFT_COST = 100;
  const QUEST_AT = 80, QUEST_AT_PERK = 65;           // loyalty needed to open a personal quest
  const REJOIN_AFTER = 3 * DAY;                      // a follower who walked out won't come back for three days
  const ROAD_EVERY = 75, TOWN_EVERY = 150;           // real seconds between chances to talk on the road / in town
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const pnum = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) || 0 : 0);
  const nameOf = (id) => (typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS[id]?.[0]) || id;
  const first = (id) => nameOf(id).split(" ")[0];
  const isDog = (id) => typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS[id]?.[6] === "dog";
  /* Polish: the words live in i18n_bonds.js (I18N_STORY.ex). T translates one string; F fills a "{0}…{1}" template
     after translating it, so names and places slot into the Polish sentence. English stays English. */
  const T = (x) => { if (x == null || x === "") return x; try { if (typeof I18N !== "undefined" && I18N.lang() === "pl") { const r = I18N.tr(String(x)); if (r != null) return r; } } catch (e) { /* keep English */ } return x; };
  const F = (tpl, ...a) => T(tpl).replace(/\{(\d)\}/g, (m, i) => (a[+i] ?? ""));
  const show = (who, line, dog) => (dog ? `${who} ${T(line)}` : `${who}: "${T(line)}"`);

  // ---- what kinds of deeds there are (plain words for the "what they think" list)
  const TAGS = {
    kind: ["", "Helping people"], cruel: ["", "Cruelty"], theft: ["", "Stealing"], brave: ["", "Picking big fights"],
    careful: ["", "Playing it safe"], pious: ["", "Praying and the gods"], magic: ["", "Magic and books"], daedra: ["", "Deals with Daedra"],
    law: ["", "Paying what's owed"], crime: ["", "Breaking the law"], killer: ["", "Murder for hire"], empire: ["", "Helping the Empire"],
    storm: ["", "Helping the Stormcloaks"], beast: ["", "Vampires and werewolves"], greed: ["", "Grabbing loot"], nature: ["", "Hunting and the wild"],
  };

  /* ---- who they are. likes/hates: tag -> weight (1-2). yes/no: what they say when they approve/disapprove.
     road/town: things they say on the road and in town. q: their personal quest
     [title, the ask, go to, why there, clear, what's there, ending, choices [label, loyalty, reply], move, keepsake id] */
  const P = {
    lydia: { likes: { brave: 2, kind: 1, law: 2 }, hates: { theft: 2, crime: 2, cruel: 2, killer: 2, beast: 1 },
      yes: ["Well done, my Thane.", "That was honourable.", "I'd follow you anywhere for that."], no: ["My Thane... was that wise?", "I don't like this.", "That's beneath you."],
      road: ["I am sworn to carry your burdens. All of them, apparently.", "Keep your eyes on the treeline. Bandits love this stretch.", "My feet are fine. My patience is another matter.", "Whiterun's walls look small from up here."],
      town: ["Watch your purse in the market.", "If you need anything carried, I'm right here. As always."],
      q: ["The Housecarl's Oath", "Before I swore to you, I had a shield-brother. He died in Dustman's Cairn and the draugr kept his shield. I want it back.", "Whiterun", "she wants to tell his mother first", "Dustman's Cairn", "his shield is somewhere in the dark",
        "Lydia lifts the dented shield and wipes the frost off his name. \"He'd have liked you.\"", [["Hang it in Dragonsreach", 5, "\"Where everyone can see it. Good.\""], ["Tell her to carry it", 10, "\"...Thank you, my Thane. I won't let it fall again.\""]],
        { name: "Sworn Shield", type: "guard", val: 0.2, desc: "steps in front of you: you get back a fifth of your health and she hits back" }, "bond_lydia"] },
    jenassa: { likes: { brave: 1, cruel: 1, killer: 2, greed: 1 }, hates: { pious: 1, careful: 1, law: 1 },
      yes: ["Ooh. I like your style.", "Now that was fun.", "Blood and coin. My favourite things."], no: ["Boring.", "Really? You're going soft on me.", "I was promised a bit more mayhem."],
      road: ["Do you ever wonder what it feels like, the last breath? No? Just me?", "I could shoot a rabbit from here. Want to see?", "These roads are too quiet. Let's fix that.", "My last employer was dull. Don't be dull."],
      town: ["So many pockets, so little time. Kidding. Mostly.", "The guards are watching me. Flattering."],
      q: ["An Unpaid Contract", "A client in Falkreath hired me, then ran off to Pinewatch without paying. I'd love to... remind him.", "Falkreath", "she wants to ask around about him", "Pinewatch", "he's hiding behind a bandit crew",
        "Jenassa finds the client cowering in the vault. She smiles very slowly.", [["Let her settle it her way", 8, "\"Oh, you're wonderful.\""], ["Just take the gold he owes", 2, "\"Fine. Coin's coin. Spoilsport.\""]],
        { name: "Poisoned Arrow", type: "bleed", val: 0.7, desc: "a poisoned arrow that keeps hurting for three turns" }, "bond_jenassa"] },
    belrand: { likes: { magic: 1, brave: 1, greed: 1 }, hates: { daedra: 1, cruel: 1 },
      yes: ["Nicely done.", "That's the job done right.", "I can work with that."], no: ["Hm. Not how I'd have done it.", "That leaves a bad taste.", "Let's not make a habit of that."],
      road: ["A blade in one hand, a spell in the other. Never needed a shield.", "Solitude pays well, but the view out here is better.", "If you see a mage, let me handle it. Professional courtesy."],
      town: ["I could use a drink. Purely for my health.", "Good town. Expensive armour, though."],
      q: ["The Spell That Got Away", "My old teacher hid her spellbook in Brinewater Grotto before the smugglers moved in. It should be mine.", "Solitude", "he wants to see his teacher's grave", "Brinewater Grotto", "the smugglers sit on her book",
        "Belrand opens the salt-stained book. \"Fire along the blade. So that's how she did it.\"", [["Let him keep the book", 6, "\"I owe you for this.\""], ["Sell it to the College", -2, "\"...Right. Gold. Of course.\""]],
        { name: "Flame Edge", type: "strike", val: 1.7, desc: "a burning slash at 1.7 times his normal hit" }, "bond_belrand"] },
    marcurio: { likes: { magic: 2, greed: 2, careful: 1 }, hates: { pious: 1, law: 1 },
      yes: ["Clever. I approve.", "Finally, someone who thinks.", "Profitable AND smart. Marvellous."], no: ["That was... less than brilliant.", "I'm being paid for this, right?", "Even a Nord would've done better."],
      road: ["Did you know lightning goes for the tallest thing around? Stay low, Nord.", "I'm not lost. I'm taking the scenic route.", "If I'd stayed at the College, I'd be bored and rich. Now I'm just rich. Ish."],
      town: ["The inn's mead is watered down. I can taste the water.", "Shall we find something to sell? I have expensive tastes."],
      q: ["Marcurio's Bet", "I bet a smug Altmer in Windhelm that I could bring back a Dwemer focus from Mzulft. It's a lot of gold. Help me win it.", "Windhelm", "he wants to tell the Altmer the bet is on", "Mzulft", "the Dwemer focus sits deep inside",
        "Marcurio cradles the humming crystal. \"Oh, he is going to HATE this.\"", [["Split the winnings with him", 8, "\"Fair and square. I like you.\""], ["Let him keep it all", 4, "\"Generous. Suspicious, but generous.\""]],
        { name: "Chain Lightning", type: "volley", val: 3, desc: "three quick bolts of lightning" }, "bond_marcurio"] },
    vorstag: { likes: { greed: 2, brave: 1 }, hates: { kind: 1, magic: 1 },
      yes: ["Good. That pays.", "Now we're talking.", "Ha! Fine work."], no: ["What a waste.", "Not paid enough for this.", "We left gold on the table."],
      road: ["Markarth's got the best silver and the worst people.", "Keep walking. Talk costs breath.", "I've had worse jobs. Not many."],
      town: ["Find me a job with a fat purse and I'm happy.", "Let's not stay long."],
      q: ["Debts in Markarth", "The Forsworn took my brother's cart and everything on it. They're holed up in Deepwood Redoubt.", "Markarth", "he wants to see who's buying stolen silver", "Deepwood Redoubt", "the Forsworn hold the cart",
        "Vorstag finds his brother's ledger among the Forsworn loot. \"Every coin's still here. Huh.\"", [["Give it all back to his brother", 4, "\"...You're soft. But thanks.\""], ["Split it with Vorstag", 10, "\"Now that's a partner.\""]],
        { name: "Cleave", type: "strike", val: 1.8, desc: "a huge overhead axe blow at 1.8 times his hit" }, "bond_vorstag"] },
    stenvar: { likes: { brave: 2, greed: 1 }, hates: { careful: 2, magic: 1 },
      yes: ["Ha! That's how it's done.", "Good fight.", "You've got a spine. I like that."], no: ["You ran? Really?", "Cowardice doesn't suit you.", "We should've fought."],
      road: ["I don't ask questions. I swing.", "Windhelm's cold. This is colder.", "Bring on the next bandit. I'm getting rusty."],
      town: ["A tavern. Finally.", "Too many people. Not enough fights."],
      q: ["Old Scars", "There's a skooma den in Cragslane Cavern. They took my sister. I never went back. Now I will.", "Windhelm", "he wants to buy a better whetstone", "Cragslane Cavern", "the dealers and their wolves",
        "Stenvar stands among the broken cages, quiet for once. \"She'd have laughed at me. Took me long enough.\"", [["Let him say goodbye alone", 8, "\"...Thanks.\""], ["Burn the den down", 5, "\"Aye. Burn it.\""]],
        { name: "Sweeping Blow", type: "strike", val: 2, desc: "a wide swing at twice his hit" }, "bond_stenvar"] },
    erik: { likes: { brave: 2, kind: 1, nature: 1 }, hates: { cruel: 2, killer: 2 },
      yes: ["That was amazing!", "Just like in the stories!", "Wait till my pa hears about this!"], no: ["Oh. Um. Is that what heroes do?", "I didn't think we'd do... that.", "That felt wrong."],
      road: ["Is that a dragon? No, a hawk. Still!", "I've never been this far from Rorikstead.", "Do you think they'll write songs about us?", "My feet hurt. Worth it!"],
      town: ["Everything is so big here!", "Can we see the market? Please?"],
      q: ["Erik's First Real Adventure", "Back home there's a den of swindlers bothering the farms. Pa says it's nothing. I want to prove I'm a slayer.", "Rorikstead", "he wants to tell his pa", "Swindler's Den", "the swindlers wait inside",
        "Erik stands over the last swindler, shaking. \"I did it. I actually did it!\"", [["Tell him he's a real slayer", 10, "\"You mean it?! Thank you!\""], ["Tell him not to get cocky", 3, "\"Right. Yes. Humble. Got it.\""]],
        { name: "Farmhand's Fury", type: "strike", val: 1.6, desc: "a wild swing at 1.6 times his hit" }, "bond_erik"] },
    faendal: { likes: { nature: 2, kind: 1, careful: 1 }, hates: { cruel: 2, crime: 1 },
      yes: ["Well done, friend.", "Kindly done.", "The woods would approve."], no: ["That wasn't right.", "Hmm. I'll remember that.", "Not my way."],
      road: ["Hear that? Elk, maybe three of them.", "Good wood in these trees. Good bows.", "Walk softer. The forest is listening."],
      town: ["Too much stone. I miss the trees.", "Riverwood is better. Quieter."],
      q: ["The Mill's Trouble", "Bandits in Embershard Mine raid the Riverwood mill. Camilla's brother is worried sick. Let's end it.", "Riverwood", "he wants to warn the mill", "Embershard Mine", "the bandits in the mine",
        "Faendal unstrings his bow. \"Riverwood can sleep tonight.\"", [["Let him take the credit", 8, "\"Ha! You're a true friend.\""], ["Tell Camilla it was you", -2, "\"...Of course. Your story.\""]],
        { name: "Hunter's Volley", type: "volley", val: 3, desc: "three arrows in a row" }, "bond_faendal"] },
    uthgerd: { likes: { brave: 2, storm: 1 }, hates: { careful: 2, magic: 1 },
      yes: ["Ha! Now that's a fight!", "You've got some fist in you.", "Good. Strong."], no: ["Running? Pathetic.", "I didn't come along to hide.", "Weak."],
      road: ["The Companions wouldn't take me. Their loss.", "Fancy an arm-wrestle at the next inn?", "I'd fight a giant for fun. Have done."],
      town: ["Let's find someone to punch. Kidding. Unless?", "Mead first. Then business."],
      q: ["Unbroken", "The Companions said I wasn't good enough. I'll clear Silent Moons Camp on my own name and drop the bandit chief's axe on their table.", "Whiterun", "she wants Jorrvaskr to watch", "Silent Moons Camp", "the bandit chief and his crew",
        "Uthgerd hefts the chief's axe. \"Let them laugh at THIS.\"", [["Walk into Jorrvaskr with her", 10, "\"Ha! That's my shield-sister!\""], ["Tell her she doesn't need them", 6, "\"...Aye. Maybe I don't.\""]],
        { name: "Brawler's Charge", type: "strike", val: 1.8, desc: "a shoulder charge at 1.8 times her hit" }, "bond_uthgerd"] },
    mjoll: { likes: { kind: 2, law: 2, brave: 1 }, hates: { theft: 2, crime: 2, killer: 2, cruel: 2, daedra: 1 },
      yes: ["That's the spirit!", "Riften could use more people like you.", "Good. Honest work."], no: ["I can't believe you'd do that.", "That's what's wrong with this country.", "You're better than that."],
      road: ["Riften's rotten, but it's worth saving.", "I lost a sword once. Grimsever. Still miss her.", "Every bandit we stop is a farm that keeps its harvest."],
      town: ["Watch for the Guild. They're everywhere.", "A good town. Mostly."],
      q: ["Grimsever", "My sword is still in Mzinchaleft, where I nearly died. It's time I took her back.", "Riften", "she wants to tell Aerin where she's going", "Mzinchaleft", "Falmer and the old ruin",
        "Mjoll lifts Grimsever from the bones. \"Hello, old friend.\"", [["She keeps Grimsever", 10, "\"I won't forget this. Ever.\""], ["Ask to borrow it sometime", 4, "\"...We'll see.\""]],
        { name: "Lioness Strike", type: "strike", val: 1.8, desc: "a lunge at 1.8 times her hit" }, "bond_mjoll"] },
    aela: { likes: { nature: 2, brave: 2, beast: 2 }, hates: { careful: 1, law: 1 },
      yes: ["Good hunt.", "The blood sings tonight.", "That's how a Companion does it."], no: ["You hesitated.", "The pack would laugh at that.", "Weak prey, weak choice."],
      road: ["Smell that? Wolves. Old trail.", "The hunt is all that's real. Everything else is talk.", "Stay downwind."],
      town: ["Towns. Too many walls.", "Let's not linger."],
      q: ["The Hunt for the Silver Hand", "Silver Hand werewolf-hunters hide in Driftshade Refuge. They killed my shield-sister. They won't see me coming.", "Whiterun", "she wants to tell Skjor", "Driftshade Refuge", "the Silver Hand",
        "Aela wipes her blade on a silver-trimmed cloak. \"For Skjor. For all of us.\"", [["Howl with her", 10, "\"You're one of us now.\""], ["Burn their silver", 6, "\"Good. Nothing left for them.\""]],
        { name: "Hunter's Mark", type: "bleed", val: 0.8, desc: "a cruel shot that keeps bleeding for three turns" }, "bond_aela"] },
    farkas: { likes: { kind: 2, brave: 1, beast: 1 }, hates: { cruel: 2, magic: 1 },
      yes: ["That was good.", "I like that.", "You're nice."], no: ["Why'd you do that?", "That wasn't nice.", "I don't like it."],
      road: ["I don't like spiders. Don't tell anyone.", "Vilkas says I think with my sword. That's fine. It's a good sword.", "Are we there yet? No? Okay."],
      town: ["Want to get food? I want food.", "People keep staring. I'm big. I know."],
      q: ["Farkas and the Fangs", "Vampires in Broken Fang Cave hurt a farmer I knew. I want to help. You think smart, I'll hit things.", "Whiterun", "he wants to tell the farmer's widow", "Broken Fang Cave", "the vampires in the cave",
        "Farkas stands in the sunlight outside the cave, blinking. \"That was good. We helped.\"", [["Tell him he's a good man", 10, "\"...Yeah? Thanks.\""], ["Buy him a big dinner", 6, "\"Food! Yes!\""]],
        { name: "Mammoth Swing", type: "strike", val: 2, desc: "a swing like a mammoth's tusk, twice his hit" }, "bond_farkas"] },
    vilkas: { likes: { brave: 2, law: 1 }, hates: { magic: 1, careful: 1, beast: 1 },
      yes: ["Acceptable.", "Good. You fight with honour.", "That will do."], no: ["Shameful.", "Ysgramor would spit.", "Not worthy of a Companion."],
      road: ["My brother's simple. I'm not. Remember that.", "Honour is a blade you keep sharp yourself.", "Keep your guard up."],
      town: ["Let's be quick.", "Good forges here."],
      q: ["A Sharper Edge", "There's an old Nord tomb, Hillgrund's Tomb. The blade of a Harbinger lies inside. A greatsword worthy of me.", "Windhelm", "he wants to read the old histories", "Hillgrund's Tomb", "the draugr guarding the blade",
        "Vilkas tests the ancient edge against his thumb. \"Still sharp after all these years.\"", [["Let him keep the blade", 10, "\"I'll honour it.\""], ["Give it to Jorrvaskr", 4, "\"...Wise. Perhaps.\""]],
        { name: "Harbinger's Cut", type: "strike", val: 1.9, desc: "a perfect cut at 1.9 times his hit" }, "bond_vilkas"] },
    jzargo: { likes: { magic: 2, greed: 1, brave: 1 }, hates: { careful: 1, pious: 1 },
      yes: ["J'zargo approves!", "Ha! Very clever!", "J'zargo could not have done it better. Well, maybe."], no: ["J'zargo is unimpressed.", "That was not the way of a great mage.", "Hmph."],
      road: ["J'zargo will be Arch-Mage one day. You will see.", "Snow gets in J'zargo's fur. Most unpleasant.", "J'zargo has invented a new scroll. It only explodes a little."],
      town: ["J'zargo wants sweetrolls.", "These people do not know a great mage walks among them."],
      q: ["J'zargo's Scrolls", "J'zargo has made flame cloak scrolls. They need testing. On undead. In Ironbind Barrow. For science!", "Winterhold", "he wants to fetch his scrolls", "Ironbind Barrow", "the draugr, J'zargo's test subjects",
        "J'zargo singes his whiskers and laughs. \"They work! Mostly! J'zargo is a genius!\"", [["Agree he's a genius", 10, "\"Finally, someone sees it!\""], ["Point out the singed whiskers", 2, "\"...J'zargo meant to do that.\""]],
        { name: "Flame Cloak", type: "bleed", val: 0.8, desc: "wraps the foe in flames that burn for three turns" }, "bond_jzargo"] },
    brelyna: { likes: { magic: 2, kind: 1, careful: 1 }, hates: { cruel: 2, killer: 1 },
      yes: ["Oh, that was kind.", "Well done.", "I'll write home about that."], no: ["Oh, dear.", "My mother wouldn't approve.", "I'm not sure about that."],
      road: ["I'm so sorry about the... incident. You know the one.", "Telvanni blood, but I'm not like them. Mostly.", "Conjuring is easy. Unconjuring is the tricky part."],
      town: ["Do you think they sell soul gems here?", "Everyone's so loud."],
      q: ["Brelyna's Mishap", "A necromancer in Hob's Fall Cave stole the binding stone I need to fix my... mistakes. Would you help?", "Winterhold", "she wants to read up first", "Hob's Fall Cave", "the necromancer and his dead",
        "Brelyna holds the binding stone, relieved. \"No more surprise atronachs. Hopefully.\"", [["Help her practise", 8, "\"You're very patient. Thank you.\""], ["Tell her to keep it safe", 5, "\"I will. Promise.\""]],
        { name: "Mending Ward", type: "heal", val: 0.25, desc: "heals you for a quarter of your health" }, "bond_brelyna"] },
    onmund: { likes: { magic: 2, kind: 1 }, hates: { cruel: 1, careful: 1 },
      yes: ["Well met!", "That's how it's done.", "Nice work."], no: ["Hm. Not sure about that.", "My family would frown.", "That's not right."],
      road: ["My family thinks Nords shouldn't do magic. They're wrong.", "Frost is easy. Fire, I'm still working on.", "Nice to get out of the College."],
      town: ["Let's find a library.", "Cold here. Feels like home."],
      q: ["The Family Circlet", "I traded my family's circlet for a book. The book was rubbish. The circlet's now with a necromancer in Yngvild.", "Dawnstar", "he wants to ask the Jarl's wizard", "Yngvild", "the necromancer's ghosts",
        "Onmund turns the old silver circlet in his hands. \"My father wore this. Thank you.\"", [["Let him keep it", 10, "\"I won't trade it away again.\""], ["Suggest he sells it", -3, "\"...No. Never.\""]],
        { name: "Ice Spike", type: "strike", val: 1.7, desc: "a spike of ice at 1.7 times his hit" }, "bond_onmund"] },
    benor: { likes: { brave: 2, law: 1 }, hates: { careful: 1, magic: 1, theft: 1 },
      yes: ["Good fight!", "That's the spirit.", "You're tougher than you look."], no: ["Bah.", "Thought you had more steel.", "Not impressed."],
      road: ["Morthal's swamp is no place for a fight. This is better.", "Keep your shield up. Always.", "I miss my old post. Not much."],
      town: ["Let's have a drink.", "Guards here look soft."],
      q: ["Morthal's Shame", "Vampires in Movarth's Lair have been taking Morthal folk. The guard won't go. I will.", "Morthal", "he wants to tell the Jarl", "Movarth's Lair", "Movarth and his vampires",
        "Benor stands in the dawn light. \"Morthal sleeps safe tonight.\"", [["Give him the credit", 10, "\"Thanks, friend.\""], ["Claim the Jarl's reward", 3, "\"...Fair enough.\""]],
        { name: "Guard's Bash", type: "strike", val: 1.6, desc: "a shield bash at 1.6 times his hit" }, "bond_benor"] },
    annekke: { likes: { nature: 1, greed: 1, kind: 1 }, hates: { cruel: 2 },
      yes: ["Ha! Nice one.", "Good work!", "That's the way."], no: ["Hmm. Not great.", "That's not how we do it at the Crossing.", "Bit rough."],
      road: ["There's ore in these hills. I can smell it.", "Darkwater Crossing's small, but it's mine.", "Mind your step. Loose rock."],
      town: ["Anyone buying ore?", "Let's get supplies and go."],
      q: ["Crag-Jumper's Claim", "A Falmer tunnel in Darkwater Pass broke into my husband's mine. I want it sealed.", "Darkwater Crossing", "she wants to tell Verner", "Darkwater Pass", "the Falmer in the pass",
        "Annekke kicks the last rock into the tunnel. \"Sealed. Verner owes us a drink.\"", [["Share the ore she finds", 8, "\"Fair partner!\""], ["Let her keep it all", 5, "\"Kind of you.\""]],
        { name: "Prospector's Volley", type: "volley", val: 2, desc: "two quick arrows" }, "bond_annekke"] },
    borgakh: { likes: { brave: 2, greed: 1 }, hates: { careful: 2, cruel: 1 },
      yes: ["Strong. Good.", "Malacath would approve.", "That is the Orc way."], no: ["Weak.", "Bah.", "My father would laugh at you."],
      road: ["Mor Khazgur is behind me. Good.", "The road is better than a stronghold wife's life.", "I hit things. I like hitting things."],
      town: ["Humans everywhere. Ugh.", "Find me a good smith."],
      q: ["The Steel Heart", "Hagravens in Hag Rock Redoubt cursed my mother. I'll show my father who has a steel heart.", "Markarth", "she wants to buy silver", "Hag Rock Redoubt", "the hagravens and the Forsworn",
        "Borgakh drops the hagraven's feathers. \"My father will hear of this.\"", [["Send word to her father", 8, "\"Ha! Let him choke on it.\""], ["Tell her she owes him nothing", 10, "\"...You understand.\""]],
        { name: "Orc Fury", type: "strike", val: 2, desc: "a berserk blow at twice her hit" }, "bond_borgakh"] },
    teldryn: { likes: { greed: 2, brave: 1, magic: 1 }, hates: { pious: 1, law: 1, kind: 1 },
      yes: ["Not bad.", "I've seen worse. Much worse.", "Good."], no: ["Hm.", "Really.", "I'm still getting paid, right?"],
      road: ["I'm the best sword on Solstheim. Skyrim too, probably.", "Morrowind was hotter. Better ash.", "Keep moving. I'm not carrying you."],
      town: ["Find a drink. Find a job. In that order.", "I'm not here for the scenery."],
      q: ["Sero's Price", "Someone in Haemar's Shame is selling my name to vampire hunters. I'd like a word.", "Falkreath", "he wants to find the seller", "Haemar's Shame", "the vampires and their seller",
        "Teldryn sheathes his blade. \"Business concluded.\"", [["Let him take the bounty", 8, "\"Now that's a fair deal.\""], ["Split it", 4, "\"Fine. Fine.\""]],
        { name: "Firebrand", type: "strike", val: 1.7, desc: "a fiery cut at 1.7 times his hit" }, "bond_teldryn"] },
    meeko: { likes: { kind: 2, nature: 1 }, hates: { cruel: 2 },
      yes: ["*wags his tail*", "*barks happily*", "*licks your hand*"], no: ["*whines*", "*flattens his ears*", "*looks away*"],
      road: ["*sniffs a rabbit hole*", "*trots ahead, tail up*", "*brings you a stick*", "*growls at a bush*"],
      town: ["*eyes the butcher*", "*sits and waits for scraps*"],
      q: ["Meeko's Old Home", "Meeko keeps tugging north, toward the shack where you found him. Something there still matters to him.", "Meeko's Shack", "he wants to see his old home", "Lost Echo Cave", "the trail his old master left",
        "Meeko lies down beside an old satchel and sighs. Then he looks up at you, tail thumping.", [["Give him a big hug", 10, "*happy wriggling*"], ["Give him a bone", 6, "*crunch crunch*"]],
        { name: "Pounce", type: "bleed", val: 0.8, desc: "a savage bite that keeps bleeding for three turns" }, "bond_meeko"] },
  };
  // anyone not listed (a new follower added later) gets one from their fighting style
  const BY_ARCH = { warrior: "lydia", twohand: "stenvar", archer: "faendal", spellsword: "belrand", thief: "jenassa", mage: "marcurio", conjurer: "brelyna", healer: "brelyna" };
  const pers = (id) => P[id] || P[BY_ARCH[typeof FOL2 !== "undefined" ? FOL2.archOf(id) : "warrior"]] || P.lydia;
  const questOf = (id) => P[id]?.q || null;

  // ---- keepsakes: a unique piece of gear from each personal quest ([OURS] sized like good mid-game gear)
  const KEEP = {
    bond_lydia: { name: "Lydia's Oath-Shield", slot: "shield", type: "heavy", armor: 28, weight: 12, value: 600, aenchant: { key: "max:health", mag: 30, name: "Fortify Health" } },
    bond_jenassa: { name: "Jenassa's Black Bow", slot: "weapon", hands: 2, skill: "Archery", damage: 15, weight: 11, value: 650 },
    bond_belrand: { name: "Belrand's Spellblade", slot: "weapon", hands: 1, skill: "One-Handed", damage: 12, weight: 11, value: 600 },
    bond_marcurio: { name: "Marcurio's Lucky Hood", slot: "head", type: "light", armor: 8, weight: 2, value: 600, aenchant: { key: "spell:Destruction", mag: 15, name: "Fortify Destruction" } },
    bond_vorstag: { name: "Vorstag's Silver Axe", slot: "weapon", hands: 1, skill: "One-Handed", damage: 13, weight: 13, value: 600 },
    bond_stenvar: { name: "Stenvar's Greatsword", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 20, weight: 20, value: 650 },
    bond_erik: { name: "Erik's Father's Axe", slot: "weapon", hands: 1, skill: "One-Handed", damage: 12, weight: 12, value: 500 },
    bond_faendal: { name: "Faendal's Yew Bow", slot: "weapon", hands: 2, skill: "Archery", damage: 14, weight: 10, value: 600 },
    bond_uthgerd: { name: "Uthgerd's Brawling Gauntlets", slot: "hands", type: "heavy", armor: 15, weight: 5, value: 600, aenchant: { key: "dmg:Two-Handed", mag: 15, name: "Fortify Two-Handed" } },
    bond_mjoll: { name: "Mjoll's Steel Cuirass", slot: "chest", type: "heavy", armor: 34, weight: 30, value: 650, aenchant: { key: "max:health", mag: 25, name: "Fortify Health" } },
    bond_aela: { name: "Aela's Huntress Boots", slot: "feet", type: "light", armor: 9, weight: 2, value: 600, aenchant: { key: "skill:Sneak", mag: 15, name: "Fortify Sneak" } },
    bond_farkas: { name: "Farkas's Wolf Gauntlets", slot: "hands", type: "heavy", armor: 14, weight: 5, value: 550, aenchant: { key: "dmg:Two-Handed", mag: 12, name: "Fortify Two-Handed" } },
    bond_vilkas: { name: "Harbinger's Greatsword", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 21, weight: 20, value: 700 },
    bond_jzargo: { name: "J'zargo's Singed Hood", slot: "head", type: "light", armor: 6, weight: 2, value: 600, aenchant: { key: "max:magicka", mag: 35, name: "Fortify Magicka" } },
    bond_brelyna: { name: "Brelyna's Warding Robes", slot: "chest", type: "light", armor: 12, weight: 2, value: 600, aenchant: { key: "spell:Restoration", mag: 15, name: "Fortify Restoration" } },
    bond_onmund: { name: "Onmund's Family Circlet", slot: "head", type: "light", armor: 6, weight: 2, value: 600, aenchant: { key: "max:magicka", mag: 30, name: "Fortify Magicka" } },
    bond_benor: { name: "Benor's Guard Shield", slot: "shield", type: "heavy", armor: 26, weight: 12, value: 550, aenchant: { key: "max:stamina", mag: 30, name: "Fortify Stamina" } },
    bond_annekke: { name: "Annekke's Mining Boots", slot: "feet", type: "light", armor: 8, weight: 3, value: 500, aenchant: { key: "carry", mag: 40, name: "Fortify Carry Weight" } },
    bond_borgakh: { name: "Borgakh's Orcish Axe", slot: "weapon", hands: 1, skill: "One-Handed", damage: 13, weight: 13, value: 600 },
    bond_teldryn: { name: "Teldryn's Chitin Helm", slot: "head", type: "light", armor: 12, weight: 2, value: 600, aenchant: { key: "dmg:One-Handed", mag: 12, name: "Fortify One-Handed" } },
    bond_meeko: { name: "Old Master's Hunting Boots", slot: "feet", type: "light", armor: 8, weight: 2, value: 450, aenchant: { key: "skill:Sneak", mag: 12, name: "Fortify Sneak" } },
  };
  if (typeof D !== "undefined") for (const [k, v] of Object.entries(KEEP)) if (!D.ITEMS[k]) D.ITEMS[k] = { ...v, noTrade: true, desc: "A keepsake from a follower's personal quest." };

  // ---- what each road choice says about you: "event:choice" -> tags (weight 1 unless given)
  const DEEDS = {
    "herbs:gather": ["nature"], "chest:pick": ["greed"], "injured:potion": ["kind"], "injured:spell": ["kind", "magic"], "injured:leave": ["cruel"],
    "toll:pay": ["law"], "toll:around": ["careful"], "book:read": ["magic"], "sleeper:steal": ["theft"], "sleeper:ambush": ["cruel", "cruel"], "sleeper:leave": ["kind"],
    "shrine:pray": ["pious"], "climb:climb": ["brave"], "camp:search": ["greed"],
    "thalmor:fight": ["brave", "kind"], "thalmor:bribe": ["kind"], "thalmor:leave": ["careful"], "vigilant:hunt": ["pious", "brave"], "vigilant:bless": ["pious"],
    "hunters:fire": ["nature"], "hunters:tips": ["nature"], "giant:leave": ["careful"], "giant:steal": ["theft"], "giant:fight": ["brave", "brave"],
    "dragonfly:hide": ["careful"], "dragonfly:fight": ["brave", "brave"], "banditToll:pay": ["careful"], "banditToll:sneak": ["careful"], "banditToll:fight": ["brave"],
    "escort:fight": ["brave"], "wizard:fight": ["brave"], "wizard:banish": ["magic"], "wizard:leave": ["careful"], "necro:sneak": ["careful"], "necro:fight": ["brave", "pious"], "necro:leave": ["careful"],
    "pilgrims:feed": ["kind"], "pilgrims:escort": ["kind", "pious"], "dog:take": ["kind", "nature"], "dog:feed": ["kind"], "dog:leave": ["cruel"],
    "thugs:pay": ["careful", "law"], "thugs:fight": ["brave"], "assassin:flee": ["careful"], "assassin:fight": ["brave"], "hagraven:fight": ["brave"], "hagraven:leave": ["careful"],
    "wildhorse:calm": ["nature"], "cart:search": ["greed"], "wreck:pick": ["greed"], "herbpatch:gather": ["nature"], "riekraid:help": ["kind", "brave"], "riekraid:leave": ["careful"],
    "nightvamp:fight": ["brave"], "nightvamp:flee": ["careful"], "wisp:fight": ["brave"], "wisp:leave": ["careful"], "lost:help": ["kind"], "lost:walk": ["kind", "kind"], "lost:leave": ["cruel"],
    "stranger:listen": ["daedra"],
  };
  /* big guild / story / curse changes, spotted by comparing your save before and after (so nothing else needs a hook) */
  const QUEST_TAGS = [[/^thieves/, ["theft", "crime"]], [/^brotherhood/, ["killer", "cruel"]], [/^dae_/, ["daedra"]], [/^cw_imperial/, ["empire"]], [/^cw_storm/, ["storm"]],
    [/^companions/, ["brave"]], [/^college/, ["magic"]]];

  // ---- the stored bond of one follower (inside FOL2's per-follower data, so it travels with them)
  function bond(s, id = s.follower?.id) {
    if (!id) return null;
    const f = typeof FOL2 !== "undefined" ? FOL2.st(s, id) : ((s.folData = s.folData || {})[id] = s.folData[id] || { loyal: 50 });
    if (!f) return null;
    if (typeof f.loyal !== "number") f.loyal = 50;
    f.bond = f.bond || { log: [], talkAt: 0, giftAt: 0, q: null, sig: false, seen: {} };
    return f;
  }
  const loyalty = (s, id) => { const f = bond(s, id); return f ? clamp(Math.round(f.loyal), 0, 100) : 0; };
  const MOODS = [[90, "Devoted", "Fights 10% harder for you. Would follow you into Oblivion."], [70, "Loyal", "Happy to be at your side."], [45, "Content", "Fine with how things are going."],
    [25, "Uneasy", "Starting to doubt you. Grumbles on the road."], [1, "Resentful", "Fights 15% softer and may refuse your orders. At 0 they leave."], [-1, "Gone", "They've had enough."]];
  const mood = (v) => MOODS.find(([at]) => v >= at) || MOODS[MOODS.length - 1];
  const moodMult = (v) => (v >= 90 ? 1.1 : v < 25 ? 0.85 : 1);
  const questNeed = (s) => (pnum(s, "folquest") > 0 ? QUEST_AT_PERK : QUEST_AT);

  // ---- saying things: the bond log, the journal and (on a phone) a little speech bubble with their face
  let lastBubble = 0;
  function say(s, line, opts = {}) {
    const id = s.follower?.id; if (!id || !line) return "";
    const f = bond(s, id), who = first(id), dog = isDog(id), en = dog ? line.replace(/^\*|\*$/g, "") : line, text = show(who, en, dog);
    f.bond.log.unshift({ t: now(), text: dog ? `${who} ${en}` : `${who}: "${en}"`, w: who, l: en, dog, k: opts.k || "say" }); f.bond.log = f.bond.log.slice(0, 12);
    if (opts.note !== false && typeof G !== "undefined") { if (s.trip?.log && opts.trip) { s.trip.log.unshift(" " + text); s.trip.log = s.trip.log.slice(0, 8); } G.note(s, " " + text); }
    if (opts.bubble !== false) bubble(id, text, opts.mood);
    return text;
  }
  function bubble(id, text, tone) {
    if (typeof document === "undefined" || !document.body) return;
    const t = Date.now(); if (t - lastBubble < 6000 && tone !== "force") return;
    lastBubble = t;
    document.querySelector("#folbark")?.remove();
    const el = document.createElement("div"); el.id = "folbark"; el.className = "folbark" + (tone === "up" ? " up" : tone === "down" ? " down" : ""); el.setAttribute("aria-live", "polite");
    const face = typeof NPCART !== "undefined" ? NPCART.follower(id, 34) : "";
    const e = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    el.innerHTML = `<span class="fbp">${face}</span><span class="fbt"><b>${e(nameOf(id))}${tone === "up" ? " ▲" : tone === "down" ? " ▼" : ""}</b><q>${e(text.replace(/^[^:]+: /, "").replace(/^"|"$/g, ""))}</q></span>`;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add("gone"); setTimeout(() => el.remove(), 700); }, 5200);
  }

  // ---- reacting to what you did. tags: list of tag names (repeats count double). Returns the line said, or "".
  function react(s, tags, why = "") {
    const id = s.follower?.id; if (!id || !tags?.length) return "";
    const f = bond(s, id), p = pers(id);
    let d = 0;
    for (const t of tags) d += (p.likes[t] || 0) - (p.hates[t] || 0);
    if (!d) return "";
    d = d > 0 ? d * 2 * (1 + Math.min(1, pnum(s, "folbond"))) : d * 2 * (1 - Math.min(0.75, pnum(s, "folgrudge")));
    return shift(s, d, d > 0 ? pick(p.yes) : pick(p.no), why);
  }
  /* move loyalty by d and say something; handles the warnings and walking out */
  function shift(s, d, line, why = "") {
    const id = s.follower?.id; if (!id) return "";
    const f = bond(s, id), before = f.loyal;
    f.loyal = clamp(f.loyal + d, 0, 100);
    const ch = Math.round(f.loyal) - Math.round(before);
    let text = say(s, line, { k: d > 0 ? "up" : "down", mood: d > 0 ? "up" : "down", trip: true });
    if (why) f.bond.log[0].why = why;
    if (ch) f.bond.log[0].d = ch;
    if (d < 0 && f.loyal > 0 && f.loyal < 15 && before >= 15) text += " " + say(s, isDog(id) ? "*growls softly at you*" : "Keep this up and I'm gone.", { k: "warn", bubble: false });
    if (f.loyal <= 0) text += " " + leave(s);
    return text;
  }
  function leave(s) {
    const id = s.follower?.id; if (!id) return "";
    const f = bond(s, id), n = nameOf(id);
    f.bond.leftAt = now(); f.loyal = 0;
    if (f.bond.q && !f.bond.q.done) f.bond.q = null;   // the quest is dropped; it can be picked up again later
    s.follower = null;
    const msg = isDog(id) ? F("{0} slinks off into the trees and doesn't come back.", n) : F("{0} has had enough of you and walks off. (\"Find someone else to drag around.\")", n);
    if (typeof G !== "undefined") G.note(s, " " + msg);
    if (typeof document !== "undefined" && document.body) bubble(id, msg, "force");
    return msg;
  }

  // ---- spot big changes in your save (crimes, guild steps, curses, dragons) and react to them
  function snap(s) {
    const q = {};
    for (const [k, v] of Object.entries(s.quests || {})) q[k] = (v?.stage || 0) + (v?.done ? 100 : 0);
    return { b: Object.values(s.bounty || {}).reduce((a, x) => a + x, 0), m: !!s.murdered, v: !!s.vampire, w: !!s.werewolf, dr: s.dragons || 0, q };
  }
  function observe(s) {
    if (!s) return "";
    const cur = snap(s), old = s.bondSnap;
    s.bondSnap = cur;
    if (!old || !s.follower) return "";
    const tags = [];
    if (cur.b > old.b) tags.push("crime", "crime");
    if (cur.m && !old.m) tags.push("killer", "cruel");
    if ((cur.v && !old.v) || (cur.w && !old.w)) tags.push("beast", "beast");
    if (cur.dr > old.dr) tags.push("brave", "brave");
    for (const [k, v] of Object.entries(cur.q)) if (v > (old.q[k] || 0)) for (const [re, t] of QUEST_TAGS) if (re.test(k)) tags.push(...t);
    const out = tags.length ? react(s, tags, "what you've been up to") : "";
    questTick(s);
    return out;
  }

  // ---- the personal quest: stage 0 go, 1 clear, 2 choose, done
  function questState(s, id = s.follower?.id) {
    const f = bond(s, id), q = questOf(id); if (!f || !q) return { k: "none" };
    const b = f.bond;
    if (b.q?.done) return { k: "done", q, b };
    if (b.q) return { k: ["go", "clear", "choose"][b.q.stage] || "go", q, b };
    return { k: f.loyal >= questNeed(s) ? "open" : "locked", q, b, need: questNeed(s) };
  }
  function questStart(s) {
    const id = s.follower?.id, st = questState(s);
    if (st.k === "locked") return F("{0} isn't ready to ask you for something that personal. Loyalty {1} needed.", first(id), st.need);
    if (st.k !== "open") return "";
    st.b.q = { stage: 0, t: now() };
    say(s, st.q[1], { k: "quest", bubble: false });
    if (typeof G !== "undefined") G.note(s, " " + F("New quest: {0} ({1}). Go to {2}.", T(st.q[0]), nameOf(id), st.q[2]));
    questTick(s);
    return " " + F("{0}: go to {1} — {2}.", T(st.q[0]), st.q[2], T(st.q[3]));
  }
  function questTick(s) {
    const id = s.follower?.id, st = questState(s); if (!["go", "clear"].includes(st.k)) return "";
    const q = st.b.q;
    if (q.stage === 0 && s.location === st.q[2]) {
      q.stage = 1; q.t = now();
      if (typeof G !== "undefined") G.note(s, " " + F("{0}: now clear {1} ({2}).", T(st.q[0]), st.q[4], T(st.q[5])));
      say(s, isDog(id) ? "*sniffs the air and tugs toward the hills*" : F("Right. {0} next. Let's go.", st.q[4]), { k: "quest" });
    }
    if (q.stage === 1 && (s.cleared || {})[st.q[4]] >= q.t) {
      q.stage = 2;
      if (typeof G !== "undefined") G.note(s, " " + F("{0}: done. Talk to {1} (Character → Follower → Bond) to finish it.", T(st.q[0]), first(id)));
    }
    return "";
  }
  const canChoose = (s) => typeof PARTYPLAY === "undefined" || PARTYPLAY.role(s) !== "member";
  function questChoose(s, i) {
    const id = s.follower?.id, st = questState(s); if (st.k !== "choose") return "";
    if (!canChoose(s)) return T("In a party only the leader makes choices. Finish this when you lead the party or travel on your own.");
    const c = st.q[7][i]; if (!c) return "";
    st.b.q.done = true; st.b.q.choice = i; st.b.sig = true;
    const f = bond(s, id); f.loyal = clamp(f.loyal + c[1], 0, 100);
    const kid = st.q[9]; let got = "";
    if (kid && typeof D !== "undefined" && D.ITEMS[kid] && typeof G !== "undefined") { G.give(s, kid); got = " " + F("You get {0}.", T(D.ITEMS[kid].name)); }
    say(s, c[2], { k: "quest", mood: "up" });
    if (typeof G !== "undefined") G.note(s, " " + F("{0} done. New move for {1}: {2}.", T(st.q[0]), first(id), T(st.q[8].name)) + got);
    return `${T(st.q[6])} ${T(c[2])} ` + F("New signature move for {0}: {1} ({2}, once per fight).", first(id), T(st.q[8].name), T(st.q[8].desc)) + got;
  }

  // ---- talking and gifts (the Bond tab buttons)
  const GREET = { city: ["Big city. Stay close.", "Keep your hand on your purse."], town: ["Small place. Friendly enough.", "Let's see what they've got."], dungeon: ["I hate places like this.", "Stay sharp. Something's down there.", "Smells like old death."],
    fort: ["Old stones, new trouble.", "Watch the battlements."], lair: ["Dragon country. Eyes up.", "Bones everywhere. Not good."], shrine: ["Quiet here. Holy, maybe.", "Feels like someone's watching."],
    stone: ["These old stones hum, don't they?", "Pick a sign, any sign."], camp: ["Someone's camp. Careful.", "Tents and trouble."], farm: ["Honest work, farming. Not for me.", "Smells like hay and cows."], landmark: ["Huh. Worth the walk.", "Never been here before."] };
  const PLACE_LINES = {
    Whiterun: ["Whiterun. Dragonsreach always looks bigger than you remember.", "The Bannered Mare's mead is the best in the hold."], Solitude: ["Solitude. Mind the Thalmor.", "The Blue Palace. Fancy."],
    Markarth: ["Markarth. Everyone here's watching everyone.", "Stone city. Stone faces."], Windhelm: ["Windhelm. Colder than a draugr's handshake.", "Ulfric's city. Keep your opinions quiet."],
    Riften: ["Riften. Count your coins twice.", "Smells like fish and lies."], Winterhold: ["Half the town fell into the sea. The College didn't. Suspicious.", "Winterhold. Cold and bitter, like the locals."],
    Riverwood: ["Riverwood. Nice and quiet.", "The mill's busy today."], Falkreath: ["Falkreath. More graves than houses.", "Gloomy place."], Dawnstar: ["Dawnstar. Everyone here has nightmares.", "Smell the sea."],
    Morthal: ["Morthal. Fog and secrets.", "Swamp town. Keep your boots dry."], "High Hrothgar": ["Seven thousand steps. My legs hate you.", "The Greybeards. Say nothing loud."],
  };
  const DOG_GREET = ["*sniffs everything*", "*wags his tail at a stranger*", "*barks once*"];
  const homeOf = (id) => (typeof TOWNS !== "undefined" ? TOWNS.FOLLOWERS[id]?.[1] : null);
  function placeLine(s, place, id = s.follower?.id) {
    if (!id || !place) return "";
    if (isDog(id)) return pick(DOG_GREET);
    if (homeOf(id) === place) return pick(["Home. Smells the same.", "Back where we met. Feels like years ago.", "Home sweet home. Sort of."]);
    const kind = typeof WORLD !== "undefined" ? WORLD.places[place]?.[2] : null;
    const pool = [...(PLACE_LINES[place] || []), ...(PLACE_LINES[place] ? [] : GREET[kind] || []), ...(kind === "city" || kind === "town" ? pers(id).town : [])];
    return pool.length ? pick(pool) : "";
  }
  function talk(s, t = now()) {
    const id = s.follower?.id; if (!id) return T("No one is following you.");
    const f = bond(s, id), b = f.bond;
    if (t - (b.talkAt || 0) < TALK_EVERY) return F("{0} has nothing new to say yet. Try again in a few hours.", first(id));
    b.talkAt = t;
    const st = questState(s);
    let line;
    if (st.k === "open") line = isDog(id) ? "*nudges your hand and looks north*" : "There's something I've been meaning to ask you. When you have time.";
    else if (f.loyal < 25) line = pick(isDog(id) ? ["*turns his back on you*"] : ["What do you want?", "Not now.", "Talk's cheap. So's your judgement lately."]);
    else line = pick([...pers(id).road, ...(s.location ? [placeLine(s, s.location, id)].filter(Boolean) : [])]);
    const gain = f.loyal < 25 ? 1 : 2 * (1 + Math.min(1, pnum(s, "foltalk")));
    return shift(s, gain, line, "a chat");
  }
  function gift(s, t = now()) {
    const id = s.follower?.id; if (!id) return T("No one is following you.");
    const f = bond(s, id), b = f.bond;
    if (t - (b.giftAt || 0) < GIFT_EVERY) return F("You already gave {0} something today.", first(id));
    if (s.gold < GIFT_COST) return F("A gift costs {0} gold.", GIFT_COST);
    s.gold -= GIFT_COST; b.giftAt = t;
    const likesGold = (pers(id).likes.greed || 0) > 0;
    return shift(s, likesGold ? 6 : 4, isDog(id) ? "*devours a whole ham*" : likesGold ? "Now that's how you treat a friend." : "For me? You didn't have to.", "a gift");
  }

  // ---- chatter: on the road and in town, now and then
  function roadTick(s, t = now()) {
    const id = s.follower?.id; if (!id || !s.trip || s.trip.status !== "travel") return "";
    const f = bond(s, id), b = f.bond;
    if (!b.roadAt) { b.roadAt = t; return ""; }
    if (t - b.roadAt < ROAD_EVERY) return "";
    b.roadAt = t;
    if (Math.random() < 0.4) return "";
    return say(s, chatter(s, id, f), { k: "road", trip: true });
  }
  function townTick(s, t = now()) {
    const id = s.follower?.id; if (!id || s.trip || s.dungeon || !s.location) return "";
    const kind = typeof WORLD !== "undefined" ? WORLD.places[s.location]?.[2] : null; if (!["city", "town"].includes(kind)) return "";
    const f = bond(s, id), b = f.bond;
    if (!b.townAt) { b.townAt = t; return ""; }
    if (t - b.townAt < TOWN_EVERY) return "";
    b.townAt = t;
    if (Math.random() < 0.5) return "";
    return say(s, f.loyal < 25 ? chatter(s, id, f) : pick([...pers(id).town, placeLine(s, s.location, id)].filter(Boolean)), { k: "town" });
  }
  function chatter(s, id, f) {
    if (f.loyal < 25) return isDog(id) ? "*trails behind, head low*" : pick(["I'm only here for the pay.", "Remind me why I'm still following you?", "Don't expect me to bleed for you.", "I've had better employers. And worse. Not many worse."]);
    if (f.loyal < 45 && Math.random() < 0.5) return isDog(id) ? "*whines quietly*" : pick(["Hmm.", "Let's just get there.", "I've been thinking about what you did back there."]);
    const night = typeof G !== "undefined" && G.isNight(now());
    const extra = [];
    if (!isDog(id) && night) extra.push("Dark out. Stay close.", "Can't see a thing. Wonderful.");
    if (!isDog(id) && (s.dragons || 0) > 0) extra.push("People talk about you, you know. The dragon thing.");
    if (!isDog(id) && f.loyal >= 90) extra.push("I'm glad I'm with you. Really.", "Whatever's next, I've got your back.");
    return pick([...pers(id).road, ...extra]);
  }

  // ---- fights: a comment afterwards (the fight result shows it) and the signature move
  function fightLine(s, fight) {
    const id = s.follower?.id; if (!id || !fight) return "";
    const dog = isDog(id), e = fight.e || {}, tags = new Set(fight.tags || e.tags || []), name = e.name || "";
    let line = "";
    if (!fight.won) line = dog ? "*limps over and licks your face*" : pick(["That... could have gone better.", "We'll get them next time.", "Up you get. Slowly."]);
    else if (tags.has("dragon") || /dragon/i.test(name)) line = dog ? "*barks at the sky for a long time*" : pick(["A DRAGON. We killed a dragon!", "I'll be telling that one for years.", "Its bones are still smoking."]);
    else if (fight.followerDown) line = dog ? "*shakes himself off, wobbly*" : pick(["Ow. I'm fine. I'm fine.", "Next time, you take the big one.", "Remind me to duck."]);
    else if (e.boss || tags.has("boss")) line = dog ? "*howls in triumph*" : pick(["That one was tough.", "Not bad. Not bad at all.", "Glad that's over."]);
    else if (/draugr|skeleton|ghost|wraith|lich/i.test(name)) line = dog ? "*growls at the bones*" : pick(["The dead should stay dead.", "I hate draugr.", "Back to sleep, old bones."]);
    else if (fight.hp > 0 && typeof G !== "undefined" && fight.hp < G.maxHealth(s) * 0.25) line = dog ? "*nudges you worriedly*" : pick(["That was close. Too close.", "You're bleeding. A lot.", "Drink something. Please."]);
    else if (Math.random() < 0.35) line = dog ? "*wags proudly*" : pick(["Easy.", "Next.", "Is that all?", "Good fight."]);
    return line;
  }
  function sigOf(s, id = s.follower?.id) { const f = id && bond(s, id); return f?.bond.sig ? questOf(id)?.[8] || null : null; }
  /* once per fight, at the start of their turn: their move. Returns the fight-log text or "". */
  function signature(fight, al) {
    const s = fight?.s; if (!s || !al || al.sigUsed || al.fid !== s.follower?.id || fight.ehp <= 0 || al.down) return "";
    const m = sigOf(s, al.fid); if (!m) return "";
    const boost = 1 + Math.min(0.5, pnum(s, "folsig"));
    const foeMax = fight.e?.health || fight.ehp0 || fight.ehp, cap = Math.max(1, foeMax * 0.25);   // [OURS] never more than a quarter of the foe: no one-shots
    const base = Math.max(1, al.dmg || 5) * boost;
    const mh = typeof G !== "undefined" ? G.maxHealth(s) : 100;
    if (m.type === "heal" || m.type === "guard") { if (fight.hp >= mh * 0.55) return ""; }   // keep it for when you need it
    al.sigUsed = true;
    if (m.type === "strike") { const d = Math.min(cap, base * m.val); fight.ehp -= d; return `${al.name}: ${T(m.name)}! ${Math.round(d)}`; }
    if (m.type === "volley") { let tot = 0; for (let i = 0; i < m.val; i++) tot += base * 0.6 * (0.85 + Math.random() * 0.3); tot = Math.min(cap, tot); fight.ehp -= tot; return `${al.name}: ${T(m.name)}! ` + F("{0} hits, {1}", m.val, Math.round(tot)); }
    if (m.type === "bleed") { const per = Math.min(cap / 3, base * m.val); (fight.bleed = fight.bleed || []).push({ dmg: per, turns: 3 }); return `${al.name}: ${T(m.name)}! ` + F("({0} a turn for 3 turns)", Math.round(per)); }
    if (m.type === "heal" || m.type === "guard") {
      const before = fight.hp; fight.hp = Math.min(mh, fight.hp + mh * m.val * boost);
      let t = `${al.name}: ${T(m.name)}! ` + F("You +{0}", Math.round(fight.hp - before));
      if (m.type === "guard") { const d = Math.min(cap, base); fight.ehp -= d; t += F(", hits back {0}", Math.round(d)); }
      return t;
    }
    return "";
  }

  // ---- low loyalty: refusing orders
  const ORDERS = { arch: "change how they fight", eq: "wear that", eqoff: "wear that", uneq: "take that off", best: "swap their gear", tactic: "change their tactics", spell: "change their spells", teach: "learn that" };
  function refuses(s, op) {
    const id = s.follower?.id; if (!id || !ORDERS[op] || pnum(s, "folobey") > 0) return "";
    const f = bond(s, id); if (f.loyal >= 25) return "";
    if (f.loyal >= 15 && Math.random() < 0.5) return "";
    return say(s, isDog(id) ? "*ignores you*" : pick(["No.", "Do it yourself.", "Why should I listen to you?", "Earn it first."]), { k: "refuse" }) + " " + F("({0} won't {1} while they're this unhappy.)", first(id), T(ORDERS[op]));
  }

  // ---- the Bond tab (follower screen) and the meter under their name
  function meter(s, esc = (x) => x) {
    const id = s.follower?.id; if (!id) return "";
    const v = loyalty(s, id), [, name, what] = mood(v);
    const ticks = [25, 45, 70, 90].map((x) => `<i class="tk" style="left:${x}%"></i>`).join("");
    return `<div class="bondm" title="${esc(T(what))}"><span class="bondl">${esc(T("Loyalty"))} <b>${v}</b> · ${esc(T(name))}</span><div class="bondbar m-${name.toLowerCase()}"><i style="width:${v}%"></i>${ticks}</div></div>`;
  }
  function tab(s, esc = (x) => x) {
    const id = s.follower?.id; if (!id) return "";
    observe(s);
    const f = bond(s, id), p = pers(id), v = loyalty(s, id), [, mname, mwhat] = mood(v), t = now();
    const tagRow = (o, cls) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, w]) => `<span class="bondtag ${cls}">${TAGS[k][0]} ${esc(T(TAGS[k][1]))}${w > 1 ? " ×2" : ""}</span>`).join("");
    const st = questState(s), q = st.q;
    let quest = "";
    if (st.k === "none") quest = `<p class="sub">${esc(T("No personal quest."))}</p>`;
    else if (st.k === "locked") quest = `<div class="item bondq lock"><div class="t"> ${esc(T(q[0]))}<span>${esc(F("{0} will open up at loyalty {1} (now {2}).", first(id), st.need, v))}</span></div></div>`;
    else if (st.k === "open") quest = `<div class="item bondq"><div class="t"> ${esc(T(q[0]))}<span>${esc(F("{0} wants to ask you something.", first(id)))}</span></div><button class="btn sm pri" data-act="fol2" data-op="bond" data-b="qstart">${esc(T("Listen"))}</button></div>`;
    else if (st.k === "go" || st.k === "clear") quest = `<div class="item bondq on"><div class="t"> ${esc(T(q[0]))}<span>${esc(T(q[1]))}</span><span class="bondobj">${st.k === "go" ? `▸ ${esc(T("Go to"))} <b>${esc(q[2])}</b> (${esc(T(q[3]))})` : `✓ ${esc(q[2])} · ▸ ${esc(T("Clear"))} <b>${esc(q[4])}</b> (${esc(T(q[5]))})`}</span></div></div>`;
    else if (st.k === "choose") quest = `<div class="item bondq on"><div class="t"> ${esc(T(q[0]))}<span>${esc(T(q[6]))}</span>${canChoose(s) ? "" : `<span class="bondobj">${esc(T("In a party only the leader makes choices."))}</span>`}</div></div>
      <div class="bondch">${q[7].map((c, i) => `<button class="btn sm ${i ? "" : "pri"}" data-act="fol2" data-op="bond" data-b="qchoose" data-i="${i}" ${canChoose(s) ? "" : "disabled"}>${esc(T(c[0]))}</button>`).join("")}</div>`;
    else quest = `<div class="item bondq done"><div class="t">✓ ${esc(T(q[0]))}<span>${esc(T("Signature move:"))} <b>${esc(T(q[8].name))}</b> — ${esc(T(q[8].desc))}, ${esc(T("once per fight"))}${q[8].type === "heal" || q[8].type === "guard" ? " " + esc(T("(when you're below half health)")) : ""}.</span></div></div>`;
    const talkLeft = Math.max(0, TALK_EVERY - (t - (f.bond.talkAt || 0))), giftLeft = Math.max(0, GIFT_EVERY - (t - (f.bond.giftAt || 0)));
    const mins = (x) => (x > 3600 ? `${Math.ceil(x / 3600)} h` : `${Math.ceil(x / 60)} min`);
    const log = f.bond.log.slice(0, 8).map((l) => `<div class="bondlog ${l.k}">${l.d ? `<b class="num">${l.d > 0 ? "+" : ""}${l.d}</b>` : ""}${esc(l.l != null ? show(l.w, l.l, l.dog) : T(l.text))}${l.why ? ` <span class="sub">(${esc(T(l.why))})</span>` : ""}</div>`).join("") || `<p class="sub">${esc(T("Nothing yet. They'll tell you what they think soon enough."))}</p>`;
    return `<div class="bond">
      ${meter(s, esc)}
      <p class="sub bondmood"><b>${esc(T(mname))}:</b> ${esc(T(mwhat))}</p>
      <div class="chips bondbtns"><button class="btn sm" data-act="fol2" data-op="bond" data-b="talk" ${talkLeft ? "disabled" : ""}> ${esc(T("Talk"))}${talkLeft ? ` (${mins(talkLeft)})` : ""}</button>
        <button class="btn sm" data-act="fol2" data-op="bond" data-b="gift" ${giftLeft || s.gold < GIFT_COST ? "disabled" : ""}> ${esc(F("Gift {0} gold", GIFT_COST))}${giftLeft ? ` (${mins(giftLeft)})` : ""}</button></div>
      <h3>${esc(T("What they think"))}</h3>
      <div class="bondtags"><span class="sub">${esc(T("Likes:"))}</span> ${tagRow(p.likes, "yes")}</div>
      <div class="bondtags"><span class="sub">${esc(T("Dislikes:"))}</span> ${tagRow(p.hates, "no")}</div>
      <h3>${esc(T("Personal quest"))}</h3>${quest}
      <h3>${esc(T("Lately"))}</h3><div class="bondlogs">${log}</div>
      <p class="sub">${esc(T("Your choices on the road, crimes, guild work and big deeds move their loyalty. Talk, gifts and fights won together help. In a party only the leader makes choices; your follower still has an opinion about them."))}</p>
    </div>`;
  }
  function act(s, d) {
    const b = d.b;
    if (b === "talk") return talk(s);
    if (b === "gift") return gift(s);
    if (b === "qstart") return questStart(s);
    if (b === "qchoose") return questChoose(s, +(d.i || 0));
    return "";
  }

  // ---- hooks into the rest of the game
  let installed = false;
  function install() {
    if (installed) return; installed = true;
    if (typeof G !== "undefined") {
      const ec0 = G.eventChoice;
      G.eventChoice = function (s, choice, ...rest) {
        const ev = s?.trip?.event, key = ev ? `${ev.id}:${choice}` : "";
        const r = ec0.call(this, s, choice, ...rest);
        try {
          const tags = DEEDS[key];
          const line = tags && s.follower ? react(s, tags) : "";
          const ob = observe(s);
          const add = [line, ob].filter(Boolean).join(" ");
          if (add && r && typeof r === "object") r.text = [r.text, add].filter(Boolean).join(" ");
        } catch (e) { /* never break a road event */ }
        return r;
      };
      const ea0 = G.encounterAction;
      G.encounterAction = function (s, action, ...rest) {
        const e = s?.trip?.encounter;
        const r = ea0.call(this, s, action, ...rest);
        try {
          let tags = null;
          if (action === "flee" || action === "sneak" || action === "hide") tags = ["careful"];
          else if (action === "fight" && e && (e.danger === "high" || e.boss || (e.tags || []).includes("dragon"))) tags = ["brave"];
          else if (action === "pay" && e?.bountyHold) tags = ["law"];
          const line = tags && s.follower ? react(s, tags) : "";
          const ob = observe(s);
          const add = [line, ob].filter(Boolean).join(" ");
          if (add && r && typeof r === "object") r.text = [r.text, add].filter(Boolean).join(" ");
        } catch (err) { /* never break a fight */ }
        return r;
      };
      const adv0 = G.advance;
      G.advance = function (s, t, ...rest) {
        const out = adv0.call(this, s, t, ...rest);
        try {
          if (s?.follower) {
            if (out?.arrived) { const l = placeLine(s, out.arrived); if (l) say(s, l, { k: "place" }); observe(s); }
            else if (!out?.encounter) roadTick(s, t ?? now());
          }
        } catch (e) { /* never break travel */ }
        return out;
      };
    }
    if (typeof FOL2 !== "undefined") {
      const gain0 = FOL2.gain;
      FOL2.gain = function (s, fight) {
        const msgs = gain0.call(this, s, fight) || [];
        try {
          if (s?.follower && fight) {
            const l = fightLine(s, fight);
            if (l) msgs.push(" " + say(s, l, { k: "fight" }));
            const ob = observe(s); if (ob) msgs.push(" " + ob);
          }
        } catch (e) { /* never break the fight result */ }
        return msgs;
      };
      const ally0 = FOL2.ally;
      FOL2.ally = function (s, hp) {
        const rec = ally0.call(this, s, hp);
        try { if (rec && s?.follower) { const m = moodMult(loyalty(s)); if (m !== 1 && rec.dmg) rec.dmg *= m; rec.mood = m; } } catch (e) { /* keep the record */ }
        return rec;
      };
      const turn0 = FOL2.turn;
      FOL2.turn = function (fight, al) {
        if (al && !al.fai) { const t = signature(fight, al); if (t) { const r = turn0.call(this, fight, al); return ` · ${t}${r || ""}`; } }
        return turn0.call(this, fight, al);
      };
      const act0 = FOL2.act;
      FOL2.act = function (s, d) {
        if (d?.op === "bond") return act(s, d);
        const no = refuses(s, d?.op); if (no) return no;
        return act0.call(this, s, d);
      };
    }
    if (typeof FAI !== "undefined") {
      const fturn0 = FAI.turn;
      FAI.turn = function (sess, fight, al) {
        let t = "";
        try { t = signature(fight, al); } catch (e) { t = ""; }
        if (t && sess) { sess.lines.me.push(t); sess.emit("ally", t, "ally", { name: al.name, dmg: 0, a: "power_attack" }); }
        const r = fturn0.call(this, sess, fight, al);
        return t && !sess ? ` · ${t}${r || ""}` : r;
      };
    }
    if (typeof TOWNS !== "undefined") {
      const hire0 = TOWNS.hire;
      TOWNS.hire = function (s, id, ...rest) {
        const b = s?.folData?.[id]?.bond;
        if (b?.leftAt && now() - b.leftAt < REJOIN_AFTER && !s.follower) return F("{0} won't even look at you. (\"You had your chance.\") Try again in a few days.", nameOf(id));
        const msg = hire0.call(this, s, id, ...rest);
        if (s?.follower?.id === id && b?.leftAt) { const f = bond(s, id); f.loyal = Math.max(f.loyal, 30); delete f.bond.leftAt; }
        if (s?.follower?.id === id) { bond(s, id); if (!s.bondSnap) s.bondSnap = snap(s); }
        return msg;
      };
    }
    if (typeof IMM !== "undefined" && IMM.tick) {
      const tick0 = IMM.tick;
      IMM.tick = function (s, ...rest) { const r = tick0.call(this, s, ...rest); try { if (s?.follower) townTick(s); } catch (e) { /* idle */ } return r; };
    }
  }
  install();
  return { T, F, TAGS, P, KEEP, DEEDS, MOODS, QUEST_AT, QUEST_AT_PERK, TALK_EVERY, GIFT_EVERY, GIFT_COST, REJOIN_AFTER, bond, loyalty, mood, moodMult, pers, questOf, questState, questStart, questTick, questChoose,
    react, shift, leave, observe, snap, say, placeLine, talk, gift, roadTick, townTick, fightLine, sigOf, signature, refuses, meter, tab, act, install, canChoose };
})();
if (typeof module !== "undefined") module.exports = BONDS;
