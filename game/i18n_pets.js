/* i18n_pets.js: Polish for pet followers (pets.js): the Pet section of the Follower tab, messages, the Pack Leader perk
   and the patch note. Loaded before i18n.js: exact lines go into I18N_EXTRA.words (and I18N_STORY.ex for sentences
   inside longer text), lines with names or numbers into I18N_EXTRA.pat. Lines already translated elsewhere win. */
var I18N_EXTRA = typeof I18N_EXTRA !== "undefined" ? I18N_EXTRA : { words: {}, pat: [] };
(() => {
  const PL = {
    // the Pet section
    "Pet": "Zwierzak", "Dog": "Pies", "No pet with you.": "Nie masz ze sobą zwierzaka.",
    "No follower with you right now.": "Teraz nie masz ze sobą towarzysza.",
    "A pet is an animal that travels with you as well as your follower.": "Zwierzak to zwierzę, które podróżuje z tobą obok towarzysza.",
    "It fights beside you, carries a little and never dies: when a fight goes badly it's knocked down and gets back up after.": "Walczy u twego boku, niesie trochę rzeczy i nigdy nie ginie: gdy walka idzie źle, zostaje powalony, a potem wstaje.",
    "Pets don't wear gear.": "Zwierzaki nie noszą ekwipunku.",
    "Meeko, a stray dog, turns up on the road now and then.": "Meeko, bezpański pies, czasem pojawia się na drodze.",
    "A loyal stray dog you met on the road.": "Wierny bezpański pies spotkany na drodze.", "Bites first, asks later.": "Najpierw gryzie, potem pyta.",
    "Pets don't wear gear: no weapons, armour or outfits, and you can't trade with them.": "Zwierzaki nie noszą ekwipunku: żadnej broni, pancerza ani strojów, i nie można się z nimi wymieniać.",
    "Bond with Meeko": "Więź z Meeko",
    // messages
    "You already have a pet with you.": "Masz już ze sobą zwierzaka.",
    "No pet is with you.": "Nie masz ze sobą zwierzaka.",
    "That's no pet.": "To nie jest zwierzak.",
    "Pets don't wear gear, so what he had went back into your pack.": "Zwierzaki nie noszą ekwipunku, więc to, co miał, wróciło do twojego plecaka.",
    // the perk
    "Pack Leader": "Przewodnik stada",
    "Your pet bites 15/30% harder, shrugs off 10/20% of the blows it takes and has 10/20% more health. When it's knocked down it gets back up with more health after the fight. [OURS]":
      "Twój zwierzak gryzie o 15/30% mocniej, odpiera 10/20% przyjmowanych ciosów i ma o 10/20% więcej zdrowia. Gdy zostanie powalony, po walce wstaje z większym zdrowiem. [OURS]",
    // the patch note
    "Pets: Meeko walks with your follower": "Zwierzaki: Meeko idzie razem z towarzyszem",
    "Meeko is a pet now, not a follower. You can have a follower and a pet with you at the same time.":
      "Meeko jest teraz zwierzakiem, a nie towarzyszem. Możesz mieć ze sobą jednocześnie towarzysza i zwierzaka.",
    "The Follower tab has two parts, Follower and Pet, and each one has its own Dismiss.":
      "Zakładka Towarzysz ma dwie części, Towarzysz i Zwierzak, i każda ma własny przycisk Odpraw.",
    "Pets don't wear gear. If Meeko was holding anything, it's back in your pack. His loyalty, his quest and his Pounce stay.":
      "Zwierzaki nie noszą ekwipunku. Jeśli Meeko coś trzymał, wróciło to do twojego plecaka. Jego lojalność, zadanie i Skok zostają.",
    "In fights Meeko has his own turn and his own health bar next to your follower. He's a bit weaker than a follower, gets knocked down and never dies, and carries a little for you.":
      "W walce Meeko ma własną turę i własny pasek zdrowia obok towarzysza. Jest trochę słabszy od towarzysza, zostaje powalony, nigdy nie ginie i trochę za ciebie niesie.",
    "New Etiquette perk, Pack Leader: your pet bites harder, takes less and gets up stronger.":
      "Nowy atut Etykiety, Przewodnik stada: twój zwierzak gryzie mocniej, mniej obrywa i wstaje silniejszy.",
    "Your party sees your pet and it fights beside them too. Pets never count toward the 8 players.":
      "Twoja drużyna widzi twojego zwierzaka i on też walczy u ich boku. Zwierzaki nigdy nie liczą się do 8 graczy.",
  };
  for (const [k, v] of Object.entries(PL)) if (!(k in I18N_EXTRA.words)) I18N_EXTRA.words[k] = v;
  if (typeof I18N_STORY !== "undefined" && I18N_STORY.ex) for (const [k, v] of Object.entries(PL)) if (!(k in I18N_STORY.ex)) I18N_STORY.ex[k] = v;
  I18N_EXTRA.pat.push(
    [/^(\d+)\/(\d+) health · bites ~(\d+) · carries (\d+) for you · goes down instead of dying$/, (m) => `${m[1]}/${m[2]} zdrowia · gryzie ~${m[3]} · niesie za ciebie ${m[4]} · pada zamiast ginąć`],
    [/^(\d+)\/(\d+) health · Follower tab ›$/, (m) => `${m[1]}/${m[2]} zdrowia · zakładka Towarzysz ›`],
    [/^Bond with (.+)$/, (m) => `Więź z: ${m[1]}`],
    [/^You already have a pet with you \((.+)\)\.$/, (m) => `Masz już ze sobą zwierzaka (${m[1]}).`],
    [/^(.+) is already with you\.$/, (m) => `${m[1]} już jest z tobą.`],
    [/^(.+) trots off\.$/, (m) => `${m[1]} odbiega truchtem.`],
    [/^(.+) is a pet\. Pets don't wear gear\.$/, (m) => `${m[1]} to zwierzak. Zwierzaki nie noszą ekwipunku.`],
    [/^(.+) gets back up after the fight, a bit wobbly\.$/, (m) => `${m[1]} wstaje po walce, trochę chwiejnie.`],
    [/^(.+) bounds out of the house and falls in beside you\.$/, (m) => `${m[1]} wybiega z domu i idzie przy twojej nodze.`],
    [/^(.+) is a pet now and pets don't wear gear, so what he had went back into your pack: (.+)\.$/, (m) => `${m[1]} jest teraz zwierzakiem, a zwierzaki nie noszą ekwipunku, więc to, co miał, wróciło do twojego plecaka: ${m[2]}.`],
  );
})();
