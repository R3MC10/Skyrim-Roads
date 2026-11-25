/* Game data - generated from the Python prototype, then extended. World geography lives in world.js. */
const D = {
 "SKILL_GROUPS": {
  "Warrior": [
   "One-Handed",
   "Two-Handed",
   "Archery",
   "Blocking",
   "Heavy Armor",
   "Light Armor",
   "Medium Armor",
   "Spear",
   "Hand-to-Hand",
   "Unarmored"
  ],
  "Mage": [
   "Destruction",
   "Restoration",
   "Alteration",
   "Conjuration",
   "Illusion",
   "Mysticism"
  ],
  "Thief": [
   "Sneak",
   "Lockpicking",
   "Pickpocket"
  ],
  "Movement": [
   "Athletics",
   "Acrobatics"
  ],
  "Social": [
   "Mercantile",
   "Speechcraft",
   "Etiquette",
   "Streetwise"
  ],
  "Crafting": [
   "Smithing",
   "Enchanting",
   "Alchemy"
  ]
 },
 "ALL_SKILLS": [
  "One-Handed",
  "Two-Handed",
  "Archery",
  "Blocking",
  "Heavy Armor",
  "Light Armor",
  "Medium Armor",
  "Spear",
  "Hand-to-Hand",
  "Unarmored",
  "Destruction",
  "Restoration",
  "Alteration",
  "Conjuration",
  "Illusion",
  "Mysticism",
  "Sneak",
  "Lockpicking",
  "Pickpocket",
  "Athletics",
  "Acrobatics",
  "Mercantile",
  "Speechcraft",
  "Etiquette",
  "Streetwise",
  "Smithing",
  "Enchanting",
  "Alchemy"
 ],
 "BASE_SKILL": 15,
 "RACES": {
  "nord": {
   "name": "Nord",
   "skills": [
    "Two-Handed",
    "Blocking",
    "One-Handed",
    "Smithing",
    "Light Armor",
    "Speech"
   ],
   "power": "Battle Cry",
   "magicka": 100,
   "desc": "Tall, fair-haired children of Skyrim, hardened by its cold and its wars. 50% frost resistance."
  },
  "imperial": {
   "name": "Imperial",
   "skills": [
    "Restoration",
    "Blocking",
    "Heavy Armor",
    "One-Handed",
    "Destruction",
    "Enchanting"
   ],
   "power": "Voice of the Emperor",
   "magicka": 100,
   "desc": "Disciplined citizens of Cyrodiil, skilled diplomats and traders."
  },
  "breton": {
   "name": "Breton",
   "skills": [
    "Conjuration",
    "Alteration",
    "Illusion",
    "Restoration",
    "Alchemy",
    "Speech"
   ],
   "power": "Dragonskin",
   "magicka": 100,
   "desc": "Gifted in the arcane, with 25% resistance to magic."
  },
  "redguard": {
   "name": "Redguard",
   "skills": [
    "One-Handed",
    "Archery",
    "Blocking",
    "Smithing",
    "Alteration",
    "Destruction"
   ],
   "power": "Adrenaline Rush",
   "magicka": 100,
   "desc": "The most naturally talented warriors in Tamriel. 50% poison resistance."
  },
  "altmer": {
   "name": "Altmer",
   "skills": [
    "Illusion",
    "Alteration",
    "Conjuration",
    "Destruction",
    "Enchanting",
    "Restoration"
   ],
   "power": "Highborn",
   "magicka": 150,
   "desc": "High Elves of the Summerset Isles, born with 50 extra magicka."
  },
  "bosmer": {
   "name": "Bosmer",
   "skills": [
    "Archery",
    "Alchemy",
    "Light Armor",
    "Lockpicking",
    "Pickpocket",
    "Sneak"
   ],
   "power": "Command Animal",
   "magicka": 100,
   "desc": "Wood Elves of Valenwood, the best archers in Tamriel. 50% disease and poison resistance."
  },
  "dunmer": {
   "name": "Dunmer",
   "skills": [
    "Destruction",
    "Alteration",
    "Illusion",
    "Alchemy",
    "Light Armor",
    "Sneak"
   ],
   "power": "Ancestor's Wrath",
   "magicka": 100,
   "desc": "Dark Elves of Morrowind, strong in both sword and spell. 50% fire resistance."
  },
  "orc": {
   "name": "Orc",
   "skills": [
    "Heavy Armor",
    "Blocking",
    "One-Handed",
    "Smithing",
    "Two-Handed",
    "Enchanting"
   ],
   "power": "Berserker Rage",
   "magicka": 100,
   "desc": "Fierce warriors and armorers from the Wrothgarian Mountains."
  },
  "khajiit": {
   "name": "Khajiit",
   "skills": [
    "Sneak",
    "Archery",
    "One-Handed",
    "Alchemy",
    "Lockpicking",
    "Pickpocket"
   ],
   "power": "Night Eye",
   "magicka": 100,
   "desc": "Agile cat-folk of Elsweyr, natural thieves. Their claws do 12 unarmed damage."
  },
  "argonian": {
   "name": "Argonian",
   "skills": [
    "Lockpicking",
    "Alteration",
    "Restoration",
    "Light Armor",
    "Pickpocket",
    "Sneak"
   ],
   "power": "Histskin",
   "magicka": 100,
   "desc": "Reptilian folk of Black Marsh, at home in water. 50% disease resistance."
  }
 },
 "START_LOCATION": "Riverwood",
 "START_DISCOVERED": [
  "Riverwood",
  "Helgen",
  "Whiterun",
  "Bleak Falls Barrow",
  "Guardian Stones",
  "Embershard Mine"
 ],
 "START_GOLD": 100,
 "ENCOUNTERS": [
  {
   "name": "Skeever",
   "danger": "low",
   "level": 2,
   "tags": [
    "beast"
   ],
   "health": 15,
   "damage": 3,
   "gold": [
    0,
    3
   ],
   "holds": null,
   "text": "A diseased skeever scurries out of the grass."
  },
  {
   "name": "Mudcrab",
   "danger": "low",
   "level": 2,
   "tags": [
    "beast"
   ],
   "health": 20,
   "damage": 4,
   "gold": [
    0,
    0
   ],
   "holds": [
    "Haafingar",
    "Hjaalmarch",
    "The Pale",
    "Winterhold",
    "Whiterun",
    "Falkreath",
    "The Rift"
   ],
   "text": "A mudcrab clacks its claws at you from the riverbank.",
   "terrain": [
    "River (ford)",
    "Bridge",
    "Marsh",
    "Lake"
   ]
  },
  {
   "name": "Lone wolf",
   "danger": "low",
   "level": 4,
   "tags": [
    "beast"
   ],
   "health": 28,
   "damage": 5,
   "gold": [
    0,
    0
   ],
   "holds": null,
   "text": "A lone wolf stalks you for a while, then lunges."
  },
  {
   "name": "Hidden satchel",
   "danger": "low",
   "kind": "event",
   "gold": [
    5,
    25
   ],
   "holds": null,
   "text": "You find a satchel hidden under a rock beside the road."
  },
  {
   "name": "Courier",
   "danger": "low",
   "kind": "event",
   "gold": [
    0,
    0
   ],
   "holds": null,
   "text": "A courier hurries past. \"Not for you, friend.\""
  },
  {
   "name": "Traveling bard",
   "danger": "low",
   "kind": "event",
   "gold": [
    0,
    0
   ],
   "holds": null,
   "text": "A wandering bard tips his hat and starts a song about Ragnar the Red. You walk faster."
  },
  {
   "name": "Wolf pack",
   "danger": "medium",
   "level": 6,
   "tags": [
    "beast"
   ],
   "health": 75,
   "damage": 14,
   "gold": [
    0,
    0
   ],
   "holds": null,
   "text": "Three wolves burst out of the tundra grass. Their leader is unusually large.",
   "terrain": [
    "Forest",
    "Pine forest",
    "Snow",
    "Tundra",
    "Grassland",
    "Autumn forest"
   ]
  },
  {
   "name": "Bandit outlaw",
   "danger": "medium",
   "level": 6,
   "tags": [
    "humanoid"
   ],
   "health": 65,
   "damage": 14,
   "gold": [
    10,
    40
   ],
   "holds": null,
   "text": "\"Your money or your life!\" A bandit blocks the road, axe in hand."
  },
  {
   "name": "Sabre cat",
   "danger": "medium",
   "level": 10,
   "tags": [
    "beast"
   ],
   "health": 75,
   "damage": 15,
   "gold": [
    0,
    0
   ],
   "holds": [
    "Whiterun",
    "The Pale",
    "Eastmarch",
    "Winterhold",
    "The Reach"
   ],
   "text": "A sabre cat drops from the rocks above you.",
   "terrain": [
    "Tundra",
    "Snow",
    "Mountains",
    "Grassland",
    "Rocky hills"
   ]
  },
  {
   "name": "Black bear",
   "danger": "medium",
   "level": 8,
   "tags": [
    "beast"
   ],
   "health": 85,
   "damage": 15,
   "gold": [
    0,
    0
   ],
   "holds": [
    "Falkreath",
    "The Rift",
    "Hjaalmarch",
    "The Reach"
   ],
   "text": "A bear rises on its hind legs and roars.",
   "terrain": [
    "Forest",
    "Pine forest",
    "Autumn forest"
   ]
  },
  {
   "name": "Frostbite spider",
   "danger": "medium",
   "level": 6,
   "tags": [
    "beast"
   ],
   "health": 70,
   "damage": 15,
   "gold": [
    0,
    5
   ],
   "holds": null,
   "text": "Webs stretch across the road. Something large moves in them.",
   "terrain": [
    "Forest",
    "Pine forest",
    "Autumn forest",
    "Marsh"
   ]
  },
  {
   "name": "Forsworn ambush",
   "danger": "medium",
   "level": 8,
   "tags": [
    "humanoid"
   ],
   "health": 75,
   "damage": 14,
   "gold": [
    5,
    30
   ],
   "holds": [
    "The Reach"
   ],
   "text": "Forsworn warriors in antlered masks rise from behind the rocks.",
   "terrain": [
    "Rocky hills",
    "Mountains",
    "Grassland"
   ]
  },
  {
   "name": "Draugr",
   "danger": "medium",
   "level": 8,
   "tags": [
    "undead"
   ],
   "health": 70,
   "damage": 13,
   "gold": [
    5,
    25
   ],
   "holds": null,
   "night": true,
   "text": "A Draugr shambles out of the dark, eyes glowing blue."
  },
  {
   "name": "Skeleton",
   "danger": "low",
   "level": 3,
   "tags": [
    "undead"
   ],
   "health": 25,
   "damage": 5,
   "gold": [
    0,
    8
   ],
   "holds": null,
   "night": true,
   "text": "Bones rattle in the moonlight. A skeleton rises from the roadside."
  },
  {
   "name": "Vampire",
   "danger": "high",
   "level": 12,
   "tags": [
    "undead",
    "humanoid",
    "elite"
   ],
   "health": 110,
   "damage": 16,
   "gold": [
    30,
    90
   ],
   "holds": null,
   "night": true,
   "text": "A pale figure steps onto the road. \"A late traveller... how convenient.\""
  },
  {
   "name": "Frost troll",
   "danger": "high",
   "level": 14,
   "tags": [
    "beast",
    "big",
    "troll"
   ],
   "health": 100,
   "damage": 17,
   "gold": [
    0,
    0
   ],
   "holds": [
    "The Pale",
    "Winterhold",
    "Eastmarch",
    "Haafingar"
   ],
   "text": "A frost troll lumbers out of the snow, three eyes fixed on you.",
   "terrain": [
    "Snow",
    "Mountains",
    "High peaks"
   ]
  },
  {
   "name": "Thalmor patrol",
   "danger": "high",
   "level": 12,
   "tags": [
    "humanoid",
    "elite"
   ],
   "health": 100,
   "damage": 16,
   "gold": [
    40,
    120
   ],
   "holds": null,
   "text": "A Thalmor Justiciar and two soldiers stop you. \"Show us your papers, Talos worshipper.\""
  },
  {
   "name": "Giant",
   "danger": "high",
   "level": 32,
   "tags": [
    "humanoid",
    "big",
    "elite"
   ],
   "health": 170,
   "damage": 28,
   "gold": [
    20,
    80
   ],
   "holds": [
    "Whiterun",
    "The Pale",
    "Eastmarch",
    "The Reach"
   ],
   "text": "You wander too close to a giant's camp. The giant raises its club.",
   "terrain": [
    "Tundra",
    "Grassland"
   ]
  },
  {
   "name": "Dragon",
   "danger": "high",
   "level": 40,
   "tags": [
    "big",
    "dragon",
    "elite"
   ],
   "health": 380,
   "damage": 38,
   "gold": [
    150,
    400
   ],
   "holds": null,
   "rare": true,
   "text": "A roar splits the sky. A dragon circles once and lands in front of you."
  }
 ],
 "DANGER_WEIGHTS": {
  "low": 52,
  "medium": 39,
  "high": 9
 },
 "NIGHT_ENCOUNTER_MULT": 1.5,
 "NIGHT_HIGH_MULT": 1.8,
 "ENEMY_HEALTH_MULT": 1.0,
 "ENEMY_DAMAGE_MULT": 1.0,
 "ENEMY_CATCHUP_HP": 0.07,
 "ENEMY_CATCHUP_DMG": 0.045,
 "ENEMY_CATCHUP_ELITE": 0.55,
 "ENEMY_CATCHUP_MAX": 24,
 "ENEMY_CATCHUP_GRACE": 6,
 "ENEMY_HP_CURVE": 0.0025,
 "QUEST_LEVEL_OVER": 6,
 "QUEST_LEVEL_FOLLOW": 0.5,
 "QUEST_LEVEL_SPAN": 10,
 "QUEST_HP_CURVE": 0,
 "SCALE_LEVEL_CAP": 60,
 "ITEMS": {
  "iron_dagger": {
   "name": "Iron Dagger",
   "slot": "weapon",
   "hands": 1,
   "skill": "One-Handed",
   "damage": 4,
   "weight": 2,
   "value": 10
  },
  "iron_sword": {
   "name": "Iron Sword",
   "slot": "weapon",
   "hands": 1,
   "skill": "One-Handed",
   "damage": 7,
   "weight": 9,
   "value": 25
  },
  "iron_war_axe": {
   "name": "Iron War Axe",
   "slot": "weapon",
   "hands": 1,
   "skill": "One-Handed",
   "damage": 8,
   "weight": 11,
   "value": 30
  },
  "steel_sword": {
   "name": "Steel Sword",
   "slot": "weapon",
   "hands": 1,
   "skill": "One-Handed",
   "damage": 8,
   "weight": 10,
   "value": 45
  },
  "steel_mace": {
   "name": "Steel Mace",
   "slot": "weapon",
   "hands": 1,
   "skill": "One-Handed",
   "damage": 10,
   "weight": 14,
   "value": 65
  },
  "elven_sword": {
   "name": "Elven Sword",
   "slot": "weapon",
   "hands": 1,
   "skill": "One-Handed",
   "damage": 11,
   "weight": 13,
   "value": 235
  },
  "iron_greatsword": {
   "name": "Iron Greatsword",
   "slot": "weapon",
   "hands": 2,
   "skill": "Two-Handed",
   "damage": 15,
   "weight": 16,
   "value": 50
  },
  "steel_battleaxe": {
   "name": "Steel Battleaxe",
   "slot": "weapon",
   "hands": 2,
   "skill": "Two-Handed",
   "damage": 18,
   "weight": 21,
   "value": 100
  },
  "iron_spear": {
   "name": "Iron Spear",
   "slot": "weapon",
   "hands": 2,
   "skill": "Spear",
   "damage": 13,
   "weight": 14,
   "value": 40
  },
  "steel_spear": {
   "name": "Steel Spear",
   "slot": "weapon",
   "hands": 2,
   "skill": "Spear",
   "damage": 16,
   "weight": 16,
   "value": 85
  },
  "hunting_bow": {
   "name": "Hunting Bow",
   "slot": "weapon",
   "hands": 2,
   "skill": "Archery",
   "damage": 7,
   "weight": 7,
   "value": 50
  },
  "long_bow": {
   "name": "Long Bow",
   "slot": "weapon",
   "hands": 2,
   "skill": "Archery",
   "damage": 6,
   "weight": 5,
   "value": 30
  },
  "elven_bow": {
   "name": "Elven Bow",
   "slot": "weapon",
   "hands": 2,
   "skill": "Archery",
   "damage": 13,
   "weight": 12,
   "value": 470
  },
  "iron_sword_flames": {
   "name": "Iron Sword of Flames",
   "slot": "weapon",
   "hands": 1,
   "skill": "One-Handed",
   "damage": 7,
   "weight": 9,
   "value": 140,
   "enchant": {
    "effect": "fire",
    "magnitude": 10,
    "max_magnitude": 30,
    "base_cost": 11,
    "capacity": 1000
   }
  },
  "steel_sword_frost": {
   "name": "Steel Sword of Frost",
   "slot": "weapon",
   "hands": 1,
   "skill": "One-Handed",
   "damage": 8,
   "weight": 10,
   "value": 200,
   "enchant": {
    "effect": "frost",
    "magnitude": 10,
    "max_magnitude": 30,
    "base_cost": 12,
    "capacity": 1000
   }
  },
  "hunting_bow_shocks": {
   "name": "Hunting Bow of Shocks",
   "slot": "weapon",
   "hands": 2,
   "skill": "Archery",
   "damage": 7,
   "weight": 7,
   "value": 210,
   "enchant": {
    "effect": "shock",
    "magnitude": 10,
    "max_magnitude": 30,
    "base_cost": 14,
    "capacity": 1000
   }
  },
  "steel_axe_absorb": {
   "name": "Steel War Axe of Absorption",
   "slot": "weapon",
   "hands": 1,
   "skill": "One-Handed",
   "damage": 9,
   "weight": 12,
   "value": 380,
   "enchant": {
    "effect": "absorb",
    "magnitude": 8,
    "max_magnitude": 25,
    "base_cost": 31,
    "capacity": 1000
   }
  },
  "hide_shield": {
   "name": "Hide Shield",
   "slot": "shield",
   "type": "light",
   "armor": 15,
   "weight": 4,
   "value": 25
  },
  "iron_shield": {
   "name": "Iron Shield",
   "slot": "shield",
   "type": "heavy",
   "armor": 20,
   "weight": 12,
   "value": 60
  },
  "steel_shield": {
   "name": "Steel Shield",
   "slot": "shield",
   "type": "heavy",
   "armor": 24,
   "weight": 12,
   "value": 150
  },
  "hide_helmet": {
   "name": "Hide Helmet",
   "slot": "head",
   "type": "light",
   "armor": 10,
   "weight": 2,
   "value": 25
  },
  "hide_armor": {
   "name": "Hide Armor",
   "slot": "chest",
   "type": "light",
   "armor": 20,
   "weight": 5,
   "value": 50
  },
  "hide_bracers": {
   "name": "Hide Bracers",
   "slot": "hands",
   "type": "light",
   "armor": 5,
   "weight": 1,
   "value": 10
  },
  "hide_boots": {
   "name": "Hide Boots",
   "slot": "feet",
   "type": "light",
   "armor": 5,
   "weight": 1,
   "value": 10
  },
  "leather_helmet": {
   "name": "Leather Helmet",
   "slot": "head",
   "type": "light",
   "armor": 12,
   "weight": 2,
   "value": 60
  },
  "leather_armor": {
   "name": "Leather Armor",
   "slot": "chest",
   "type": "light",
   "armor": 26,
   "weight": 6,
   "value": 125
  },
  "leather_bracers": {
   "name": "Leather Bracers",
   "slot": "hands",
   "type": "light",
   "armor": 7,
   "weight": 2,
   "value": 25
  },
  "leather_boots": {
   "name": "Leather Boots",
   "slot": "feet",
   "type": "light",
   "armor": 7,
   "weight": 2,
   "value": 25
  },
  "chainmail_coif": {
   "name": "Chainmail Coif",
   "slot": "head",
   "type": "medium",
   "armor": 14,
   "weight": 4,
   "value": 70
  },
  "chainmail": {
   "name": "Chainmail Hauberk",
   "slot": "chest",
   "type": "medium",
   "armor": 28,
   "weight": 18,
   "value": 150
  },
  "chainmail_gloves": {
   "name": "Chainmail Gloves",
   "slot": "hands",
   "type": "medium",
   "armor": 9,
   "weight": 3,
   "value": 35
  },
  "chainmail_boots": {
   "name": "Chainmail Boots",
   "slot": "feet",
   "type": "medium",
   "armor": 9,
   "weight": 5,
   "value": 35
  },
  "iron_helmet": {
   "name": "Iron Helmet",
   "slot": "head",
   "type": "heavy",
   "armor": 15,
   "weight": 5,
   "value": 60
  },
  "iron_armor": {
   "name": "Iron Armor",
   "slot": "chest",
   "type": "heavy",
   "armor": 25,
   "weight": 30,
   "value": 125
  },
  "iron_gauntlets": {
   "name": "Iron Gauntlets",
   "slot": "hands",
   "type": "heavy",
   "armor": 10,
   "weight": 5,
   "value": 25
  },
  "iron_boots": {
   "name": "Iron Boots",
   "slot": "feet",
   "type": "heavy",
   "armor": 10,
   "weight": 6,
   "value": 25
  },
  "steel_helmet": {
   "name": "Steel Helmet",
   "slot": "head",
   "type": "heavy",
   "armor": 17,
   "weight": 5,
   "value": 125
  },
  "steel_armor": {
   "name": "Steel Armor",
   "slot": "chest",
   "type": "heavy",
   "armor": 31,
   "weight": 35,
   "value": 275
  },
  "steel_gauntlets": {
   "name": "Steel Gauntlets",
   "slot": "hands",
   "type": "heavy",
   "armor": 12,
   "weight": 4,
   "value": 55
  },
  "steel_boots": {
   "name": "Steel Boots",
   "slot": "feet",
   "type": "heavy",
   "armor": 12,
   "weight": 8,
   "value": 55
  },
  "mage_robes": {
   "name": "Novice Robes",
   "slot": "chest",
   "type": "cloth",
   "armor": 0,
   "weight": 1,
   "value": 30,
   "magicka_regen": 0.5
  },
  "potion_health_minor": {
   "name": "Potion of Minor Healing",
   "slot": "potion",
   "restore": [
    "health",
    25
   ],
   "weight": 0.5,
   "value": 17
  },
  "potion_health": {
   "name": "Potion of Healing",
   "slot": "potion",
   "restore": [
    "health",
    50
   ],
   "weight": 0.5,
   "value": 36
  },
  "potion_magicka": {
   "name": "Potion of Magicka",
   "slot": "potion",
   "restore": [
    "magicka",
    50
   ],
   "weight": 0.5,
   "value": 40
  },
  "potion_stamina": {
   "name": "Potion of Stamina",
   "slot": "potion",
   "restore": [
    "stamina",
    50
   ],
   "weight": 0.5,
   "value": 40
  },
  "scroll_fireball": {
   "name": "Scroll of Fireball",
   "slot": "scroll",
   "spell": "fireball",
   "weight": 0.5,
   "value": 130
  },
  "scroll_healing": {
   "name": "Scroll of Fast Healing",
   "slot": "scroll",
   "spell": "fast_healing",
   "weight": 0.5,
   "value": 90
  },
  "scroll_oakflesh": {
   "name": "Scroll of Oakflesh",
   "slot": "scroll",
   "spell": "oakflesh",
   "weight": 0.5,
   "value": 50
  },
  "soul_gem_common": {
   "name": "Common Soul Gem (filled)",
   "slot": "soulgem",
   "charge": 1000,
   "weight": 0.5,
   "value": 150
  },
  "soul_gem_greater": {
   "name": "Greater Soul Gem (filled)",
   "slot": "soulgem",
   "charge": 2000,
   "weight": 1,
   "value": 400
  },
  "tome_frostbite": {
   "name": "Spell Tome: Frostbite",
   "slot": "tome",
   "spell": "frostbite",
   "weight": 1,
   "value": 50
  },
  "tome_sparks": {
   "name": "Spell Tome: Sparks",
   "slot": "tome",
   "spell": "sparks",
   "weight": 1,
   "value": 50
  },
  "tome_firebolt": {
   "name": "Spell Tome: Firebolt",
   "slot": "tome",
   "spell": "firebolt",
   "weight": 1,
   "value": 290
  },
  "tome_ice_spike": {
   "name": "Spell Tome: Ice Spike",
   "slot": "tome",
   "spell": "ice_spike",
   "weight": 1,
   "value": 290
  },
  "tome_lightning": {
   "name": "Spell Tome: Lightning Bolt",
   "slot": "tome",
   "spell": "lightning_bolt",
   "weight": 1,
   "value": 290
  },
  "tome_fast_healing": {
   "name": "Spell Tome: Fast Healing",
   "slot": "tome",
   "spell": "fast_healing",
   "weight": 1,
   "value": 290
  },
  "tome_oakflesh": {
   "name": "Spell Tome: Oakflesh",
   "slot": "tome",
   "spell": "oakflesh",
   "weight": 1,
   "value": 50
  },
  "tome_familiar": {
   "name": "Spell Tome: Conjure Familiar",
   "slot": "tome",
   "spell": "conjure_familiar",
   "weight": 1,
   "value": 50
  },
  "tome_fury": {
   "name": "Spell Tome: Fury",
   "slot": "tome",
   "spell": "fury",
   "weight": 1,
   "value": 50
  },
  "tome_sun_fire": {
   "name": "Spell Tome: Sun Fire",
   "slot": "tome",
   "spell": "sun_fire",
   "weight": 1,
   "value": 80
  },
  "tome_calm": {
   "name": "Spell Tome: Calm",
   "slot": "tome",
   "spell": "calm",
   "weight": 1,
   "value": 290
  }
 },
 "SPELLS": {
  "flames": {
   "name": "Flames",
   "school": "Destruction",
   "cost": 14,
   "xp": 20,
   "kind": "damage",
   "amount": 8,
   "element": "fire"
  },
  "frostbite": {
   "name": "Frostbite",
   "school": "Destruction",
   "cost": 16,
   "xp": 23,
   "kind": "damage",
   "amount": 8,
   "element": "frost"
  },
  "sparks": {
   "name": "Sparks",
   "school": "Destruction",
   "cost": 19,
   "xp": 26,
   "kind": "damage",
   "amount": 8,
   "element": "shock"
  },
  "firebolt": {
   "name": "Firebolt",
   "school": "Destruction",
   "cost": 41,
   "xp": 41,
   "kind": "damage",
   "amount": 25,
   "element": "fire"
  },
  "ice_spike": {
   "name": "Ice Spike",
   "school": "Destruction",
   "cost": 48,
   "xp": 48,
   "kind": "damage",
   "amount": 25,
   "element": "frost"
  },
  "lightning_bolt": {
   "name": "Lightning Bolt",
   "school": "Destruction",
   "cost": 51,
   "xp": 51,
   "kind": "damage",
   "amount": 25,
   "element": "shock"
  },
  "fireball": {
   "name": "Fireball",
   "school": "Destruction",
   "cost": 133,
   "xp": 66,
   "kind": "damage",
   "amount": 40,
   "element": "fire"
  },
  "sun_fire": {
   "name": "Sun Fire",
   "school": "Restoration",
   "cost": 24,
   "xp": 12,
   "kind": "damage",
   "amount": 25,
   "element": "sun"
  },
  "healing": {
   "name": "Healing",
   "school": "Restoration",
   "cost": 12,
   "xp": 0,
   "kind": "heal",
   "amount": 10
  },
  "fast_healing": {
   "name": "Fast Healing",
   "school": "Restoration",
   "cost": 73,
   "xp": 0,
   "kind": "heal",
   "amount": 50
  },
  "oakflesh": {
   "name": "Oakflesh",
   "school": "Alteration",
   "cost": 103,
   "xp": 103,
   "kind": "armor",
   "amount": 40
  },
  "conjure_familiar": {
   "name": "Conjure Familiar",
   "school": "Conjuration",
   "cost": 107,
   "xp": 64,
   "kind": "summon",
   "amount": 6,
   "turns": 60
  },
  "fury": {
   "name": "Fury",
   "school": "Illusion",
   "cost": 67,
   "xp": 20,
   "kind": "calm",
   "max_level": 6,
   "turns": 30
  },
  "calm": {
   "name": "Calm",
   "school": "Illusion",
   "cost": 146,
   "xp": 36,
   "kind": "calm",
   "max_level": 9,
   "turns": 30
  }
 },
 "START_SPELLS": [
  "flames",
  "healing"
 ],
 "START_KIT": [
  [
   "iron_sword",
   1,
   true
  ],
  [
   "hide_armor",
   1,
   true
  ],
  [
   "hide_boots",
   1,
   true
  ],
  [
   "hide_helmet",
   1,
   true
  ],
  [
   "hide_shield",
   1,
   true
  ],
  [
   "potion_health_minor",
   3,
   false
  ]
 ],
 "SHOP_STOCK": {
  "general": [
   "potion_health_minor",
   "potion_health",
   "potion_magicka",
   "potion_stamina",
   "iron_dagger",
   "hunting_bow",
   "long_bow",
   "hide_helmet",
   "hide_armor",
   "hide_bracers",
   "hide_boots",
   "hide_shield"
  ],
  "blacksmith": [
   "iron_sword",
   "iron_war_axe",
   "steel_sword",
   "steel_mace",
   "iron_greatsword",
   "steel_battleaxe",
   "iron_spear",
   "steel_spear",
   "iron_helmet",
   "iron_armor",
   "iron_gauntlets",
   "iron_boots",
   "iron_shield",
   "steel_helmet",
   "steel_armor",
   "steel_gauntlets",
   "steel_boots",
   "steel_shield",
   "leather_helmet",
   "leather_armor",
   "leather_bracers",
   "leather_boots",
   "chainmail_coif",
   "chainmail",
   "chainmail_gloves",
   "chainmail_boots"
  ],
  "wizard": [
   "mage_robes",
   "potion_magicka",
   "scroll_fireball",
   "scroll_healing",
   "scroll_oakflesh",
   "soul_gem_common",
   "soul_gem_greater",
   "tome_frostbite",
   "tome_sparks",
   "tome_firebolt",
   "tome_ice_spike",
   "tome_lightning",
   "tome_fast_healing",
   "tome_oakflesh",
   "tome_familiar",
   "tome_fury",
   "tome_sun_fire",
   "tome_calm"
  ]
 },
 "SHOPS": {
  "Whiterun": [
   "general",
   "blacksmith",
   "wizard",
   "stables"
  ],
  "Solitude": [
   "general",
   "blacksmith",
   "wizard",
   "stables"
  ],
  "Windhelm": [
   "general",
   "blacksmith",
   "wizard",
   "stables"
  ],
  "Markarth": [
   "general",
   "blacksmith",
   "wizard",
   "stables"
  ],
  "Riften": [
   "general",
   "blacksmith",
   "stables"
  ],
  "Winterhold": [
   "general",
   "wizard"
  ],
  "Riverwood": [
   "general",
   "blacksmith"
  ],
  "Falkreath": [
   "general",
   "blacksmith"
  ],
  "Dawnstar": [
   "general",
   "blacksmith"
  ],
  "Morthal": [
   "general",
   "wizard"
  ],
  "Ivarstead": [
   "general"
  ],
  "Rorikstead": [
   "general"
  ],
  "Dragon Bridge": [
   "general"
  ],
  "Kynesgrove": [
   "general"
  ],
  "Old Hroldan": [
   "general"
  ],
  "Karthwasten": [
   "general"
  ],
  "Stonehills": [
   "general"
  ],
  "Darkwater Crossing": [
   "general"
  ],
  "Shor's Stone": [
   "general"
  ],
  "Soljund's Sinkhole": [
   "general"
  ]
 },
 "HORSE_PRICE": 1000,
 "HORSE_SPEED": 1.8,
 "HORSE_CARRY": 100,
 "LOOT": {
  "humanoid": [
   [
    "potion_health_minor",
    0.35
   ],
   [
    "iron_dagger",
    0.15
   ],
   [
    "iron_sword",
    0.12
   ],
   [
    "iron_war_axe",
    0.1
   ],
   [
    "steel_sword",
    0.06
   ],
   [
    "hide_armor",
    0.08
   ],
   [
    "iron_helmet",
    0.06
   ],
   [
    "steel_mace",
    0.04
   ],
   [
    "iron_sword_flames",
    0.03
   ],
   [
    "steel_sword_frost",
    0.02
   ],
   [
    "hunting_bow_shocks",
    0.02
   ],
   [
    "steel_axe_absorb",
    0.01
   ],
   [
    "scroll_fireball",
    0.04
   ]
  ],
  "elite": [
   [
    "potion_health",
    0.5
   ],
   [
    "elven_sword",
    0.15
   ],
   [
    "elven_bow",
    0.1
   ],
   [
    "steel_armor",
    0.12
   ],
   [
    "steel_axe_absorb",
    0.08
   ],
   [
    "soul_gem_common",
    0.2
   ],
   [
    "scroll_fireball",
    0.2
   ]
  ]
 },
 "CONDITIONS": {
  "always": [
   "Always",
   false
  ],
  "hp_below": [
   "My health below",
   true
  ],
  "hp_above": [
   "My health above",
   true
  ],
  "mp_above": [
   "My magicka above",
   true
  ],
  "mp_below": [
   "My magicka below",
   true
  ],
  "sp_above": [
   "My stamina above",
   true
  ],
  "sp_below": [
   "My stamina below",
   true
  ],
  "enemy_hp_below": [
   "Enemy health below",
   true
  ],
  "enemy_hp_above": [
   "Enemy health above",
   true
  ],
  "first_turn": [
   "First turn of the fight",
   false
  ],
  "enemy_undead": [
   "Enemy is undead",
   false
  ],
  "enemy_beast": [
   "Enemy is a beast",
   false
  ],
  "enemy_humanoid": [
   "Enemy is humanoid",
   false
  ],
  "enemy_big": [
   "Enemy is a giant, troll or dragon",
   false
  ],
  "no_summon": [
   "I have no summon",
   false
  ],
  "no_armor_spell": ["No armor spell active", false],
  "turn_at_least": ["Turn number is at least", "turn"],
  "hp_lower_than_enemy": ["My health % is lower than the enemy's", false],
  "enemy_dragon": ["Enemy is a dragon", false],
  "enemy_construct": ["Enemy is a Dwarven machine", false],
  "enemy_tough": ["Enemy is tough (elite or deadly)", false],
  "enemy_boss": ["Fighting a dungeon boss", false],
  "sneak_ready": ["I'm hidden (sneak attack ready)", false],
  "summon_active": ["My summon is fighting", false],
  "follower_fighting": ["My follower is fighting with me", false],
  "follower_down": ["My follower is down", false],
  "mounted": ["I'm on horseback", false]
 },
 "PERCENTS": [
  10,
  25,
  40,
  50,
  60,
  75,
  90
 ],
 "BASIC_ACTIONS": {
  "attack": "Attack with weapon",
  "power_attack": "Power attack (stamina)",
  "block": "Block (10 stamina)"
 },
 "PRESETS": {
  "warrior": {
   "name": "Warrior",
   "rules": [
    {
     "if": "hp_below",
     "pct": 50,
     "do": "potion:health"
    },
    {
     "if": "sp_above",
     "pct": 60,
     "do": "power_attack"
    },
    {
     "if": "always",
     "do": "attack"
    }
   ]
  },
  "mage": {
   "name": "Mage",
   "rules": [
    {
     "if": "hp_below",
     "pct": 40,
     "do": "spell:healing"
    },
    {
     "if": "mp_below",
     "pct": 25,
     "do": "potion:magicka"
    },
    {
     "if": "always",
     "do": "spell:firebolt"
    },
    {
     "if": "always",
     "do": "spell:flames"
    },
    {
     "if": "always",
     "do": "attack"
    }
   ]
  },
  "battlemage": {
   "name": "Battlemage",
   "rules": [
    {
     "if": "hp_below",
     "pct": 45,
     "do": "potion:health"
    },
    {
     "if": "enemy_undead",
     "do": "spell:sun_fire"
    },
    {
     "if": "first_turn",
     "do": "spell:flames"
    },
    {
     "if": "mp_above",
     "pct": 60,
     "do": "spell:flames"
    },
    {
     "if": "always",
     "do": "attack"
    }
   ]
  },
  "thief": {
   "name": "Thief",
   "rules": [
    {
     "if": "hp_below",
     "pct": 60,
     "do": "potion:health"
    },
    {
     "if": "first_turn",
     "do": "power_attack"
    },
    {
     "if": "always",
     "do": "attack"
    }
   ]
  }
 },
 "DEFAULT_PRESET": "warrior",
 "MAX_RULES": 16,
 "TURNS": [2, 3, 4, 5, 6, 8, 10],
 "MAX_LOADOUTS": 5
};
if (typeof module !== 'undefined') module.exports = D;
