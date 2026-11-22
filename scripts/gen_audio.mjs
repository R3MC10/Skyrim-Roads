// Generates Roads of the North audio with ElevenLabs into game/ and rewrites game/audio.json.
// Usage: node gen_audio.mjs <path to game/> [sfx|music|all]
// Reads ELEVENLABS_API_KEY from the environment only; never prints it. Skips files that already exist.
// SFX: /v1/sound-generation (mp3_22050_32). Music: /v1/music (needs a paid plan; mp3_44100_64, 45 s loops).
import fs from "node:fs"; import path from "node:path";
const GAME = process.argv[2], WHAT = process.argv[3] || "all";
if (!GAME || !fs.existsSync(path.join(GAME, "sound.js"))) { console.error("pass the game/ folder"); process.exit(1); }
if (!process.env.ELEVENLABS_API_KEY) { console.error("ELEVENLABS_API_KEY is not set"); process.exit(1); }
const H = { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" };

const SFX = [   // [file base, prompt, seconds]
  ["click", "soft wooden UI click, medieval game menu, single short tick", 0.5],
  ["page", "turning a page of an old parchment book, quick paper rustle", 0.7],
  ["chat", "soft two-note wooden chime notification, medieval", 0.6],
  ["coin", "a few gold septim coins clinking into a leather purse", 0.8],
  ["potion", "uncorking a glass potion bottle and a quick gulp", 1.0],
  ["equip", "putting on steel armor, metal plates and leather straps rustle", 0.8],
  ["swing", "fast sword swing whoosh through air", 0.5],
  ["swing-2", "heavy two-handed weapon swing whoosh", 0.6],
  ["hit", "sword blade striking a leather armored body, meaty impact", 0.5],
  ["hit-2", "steel weapon hitting flesh through chainmail, short impact", 0.5],
  ["hit-axe", "war axe chopping into a wooden shield and body, heavy thud", 0.6],
  ["hit-mace", "iron mace blunt impact on plate armor, dull clang", 0.6],
  ["hit-bow", "arrow released from a longbow and thudding into a target", 0.8],
  ["clang", "two steel swords clashing, sharp metallic ring", 0.6],
  ["clang-2", "sword blocked by an iron shield, metallic clang", 0.6],
  ["spell", "magic spell cast, shimmering arcane whoosh", 1.0],
  ["spell-fire", "fireball spell cast, roaring flame burst", 1.2],
  ["spell-frost", "frost spell cast, icy crackling shards", 1.2],
  ["spell-shock", "lightning spell cast, electric crackle zap", 1.0],
  ["spell-heal", "healing spell, warm soft shimmering chime", 1.2],
  ["levelup", "fantasy level up, rising choir and soft drum hit, triumphant", 2.0],
  ["quest", "quest updated, short low horn and bell sting, Nordic", 1.5],
  ["arrive", "arriving at a town, distant low horn call", 1.8],
  ["victory", "short victorious brass and drum sting after a battle", 2.0],
  ["death", "you died, low somber drone and dark drum hit", 2.5],
  ["shout", "powerful dragon shout, deep thunderous voice blast with wind", 1.8],
  ["dragon", "huge dragon roar, deep and rough, echoing over mountains", 2.5],
  ["amb-wolf", "distant lone wolf howl at night", 3.0],
  ["amb-owl", "owl hooting in a night forest", 2.0],
  ["amb-thunder", "distant rolling thunder", 4.0],
  ["amb-roar", "far-off dragon roar over a burning town", 3.0],
  ["amb-step-snow", "single footstep crunching in deep snow", 0.5],
  ["amb-step-grass", "single footstep on grass and dirt", 0.5],
  ["amb-step-stone", "single boot footstep on stone", 0.5],
  ["amb-step-marsh", "single footstep squelching in mud", 0.5],
  ["amb-step-hoof", "two horse hooves clopping on a dirt road", 0.6],
];
const NORD = "instrumental, epic Nordic fantasy RPG soundtrack, seamless loop, no vocals lyrics";
const MUSIC = [   // [track, prompt]
  ["title", `${NORD}; grand slow main theme, deep male choir hum, war drums, horns, strings, minor key`],
  ["explore", `${NORD}; calm wandering exploration, soft strings, flute, sparse harp`],
  ["night", `${NORD}; quiet night, soft strings and distant flute, peaceful, sparse`],
  ["town", `${NORD}; cozy medieval town, lute and fiddle, gentle and warm`],
  ["inn", `${NORD}; tavern bard music, lute, hand drum and fiddle, cheerful`],
  ["dungeon", `${NORD}; dark ancient tomb, low drones, eerie, slow and tense`],
  ["combat", `${NORD}; battle, fast war drums, aggressive low strings, brass stabs`],
  ["boss", `${NORD}; epic boss battle, choir, pounding drums, intense brass`],
  ["tundra", `${NORD}; open windy plains, wide strings, soft horn, hopeful`],
  ["pineforest", `${NORD}; misty pine forest, harp, woodwinds, gentle`],
  ["snowfield", `${NORD}; frozen snowy north, cold sparse strings, icy bells, lonely`],
  ["marsh", `${NORD}; foggy marshland, low drones, sparse plucks, mysterious`],
  ["reach", `${NORD}; rugged rocky highlands, tribal drums, low horns, wild`],
  ["rift", `${NORD}; golden autumn forest, warm strings, flute, melancholy`],
  ["hotsprings", `${NORD}; volcanic hot springs tundra, low strings, steamy ambient`],
  ["coast", `${NORD}; cold northern sea coast, swelling strings, distant horn`],
  ["ashlands", `${NORD}; ash-covered island, strange dissonant strings, desolate`],
];

async function post(url, body, file) {
  const r = await fetch(url, { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!r.ok) { const t = (await r.text()).slice(0, 200); return { ok: false, status: r.status, t }; }
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return { ok: true };
}
const missing = [];
if (WHAT !== "music") for (const [name, text, sec] of SFX) {
  const f = path.join(GAME, (name.startsWith("amb-") ? "" : "sfx-") + name + ".mp3");
  if (fs.existsSync(f)) continue;
  const r = await post("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_22050_32", { text, duration_seconds: Math.max(0.5, sec), prompt_influence: 0.5 }, f);
  console.log(path.basename(f), r.ok ? "ok" : `FAILED ${r.status} ${r.t}`); if (!r.ok) { missing.push(path.basename(f)); if (r.status === 401 || r.status === 402) break; }
}
if (WHAT !== "sfx") for (const [name, prompt] of MUSIC) {
  const f = path.join(GAME, `mus-${name}.mp3`);
  if (fs.existsSync(f)) continue;
  const r = await post("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_64", { prompt, music_length_ms: 45000, force_instrumental: true }, f);
  console.log(path.basename(f), r.ok ? "ok" : `FAILED ${r.status} ${r.t}`); if (!r.ok) { missing.push(path.basename(f)); if (r.status === 401 || r.status === 402) break; }
}
const list = fs.readdirSync(GAME).filter((f) => /^(sfx|amb|mus)-[a-z0-9-]+\.(mp3|ogg|m4a)$/.test(f)).sort();
fs.writeFileSync(path.join(GAME, "audio.json"), JSON.stringify(list, null, 0) + "\n");
const bytes = list.reduce((a, f) => a + fs.statSync(path.join(GAME, f)).size, 0);
console.log(`audio.json: ${list.length} files, ${(bytes / 1048576).toFixed(2)} MB. Missing: ${missing.length ? missing.join(", ") : "none"}`);
