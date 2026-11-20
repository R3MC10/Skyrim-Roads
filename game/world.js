/* The world of Skyrim, laid out roughly like the real game (our own drawing, not Bethesda's map).
   Coordinates are 0..1 across and down the map (the map is 10:7). */
const WORLD = {
  // north coast, west → east (land is below this line)
  coast: [[0, 0.245], [0.05, 0.225], [0.09, 0.2], [0.12, 0.185], [0.155, 0.165], [0.185, 0.14], [0.205, 0.15], [0.215, 0.168],
    [0.226, 0.192], [0.24, 0.205], [0.255, 0.19], [0.27, 0.165], [0.3, 0.155], [0.33, 0.17], [0.36, 0.155], [0.4, 0.135],
    [0.44, 0.11], [0.47, 0.108], [0.5, 0.112], [0.535, 0.098], [0.57, 0.11], [0.61, 0.09], [0.65, 0.096], [0.69, 0.08],
    [0.72, 0.088], [0.745, 0.098], [0.775, 0.088], [0.795, 0.12], [0.806, 0.165], [0.818, 0.13], [0.85, 0.118],
    [0.88, 0.125], [0.91, 0.15], [0.95, 0.14], [1, 0.16]],
  floes: [[0.71, 0.045, 0.03, 0.012], [0.78, 0.055, 0.025, 0.01], [0.86, 0.07, 0.035, 0.013], [0.93, 0.08, 0.02, 0.01], [0.64, 0.05, 0.02, 0.008]],
  // mountain ranges: line, half-width, height (1 = impassable border peaks)
  ranges: [
    { pts: [[0.015, 0.22], [0.02, 0.6], [0.02, 0.97]], w: 0.036, h: 1.1 },                       // Druadach (High Rock border)
    { pts: [[0.03, 0.975], [0.5, 0.98], [0.97, 0.975]], w: 0.04, h: 1.1 },                     // Jerall (Cyrodiil border)
    { pts: [[0.985, 0.17], [0.985, 0.6], [0.985, 0.97]], w: 0.032, h: 1.1 },                    // Velothi (Morrowind border)
    { pts: [[0.09, 0.3], [0.135, 0.44], [0.115, 0.6], [0.165, 0.72], [0.235, 0.8]], w: 0.04, h: 0.68 },  // the Reach
    { pts: [[0.51, 0.71], [0.56, 0.645], [0.585, 0.615], [0.625, 0.6], [0.67, 0.625]], w: 0.055, h: 1.0 }, // Throat of the World
    { pts: [[0.355, 0.37], [0.41, 0.335]], w: 0.03, h: 0.45 },
    { pts: [[0.52, 0.22], [0.58, 0.27], [0.64, 0.245], [0.68, 0.3]], w: 0.04, h: 0.62 },        // the Pale
    { pts: [[0.67, 0.565], [0.74, 0.6], [0.8, 0.585], [0.88, 0.605], [0.94, 0.57]], w: 0.026, h: 0.56 },  // Eastmarch–Rift
    { pts: [[0.255, 0.66], [0.29, 0.76], [0.27, 0.9]], w: 0.032, h: 0.55 },                     // Falkreath–Reach
    { pts: [[0.69, 0.185], [0.76, 0.225], [0.845, 0.245]], w: 0.03, h: 0.55 },                  // Winterhold
    { pts: [[0.31, 0.345], [0.335, 0.4]], w: 0.025, h: 0.42 },                                  // Labyrinthian
    { pts: [[0.185, 0.245], [0.245, 0.265]], w: 0.02, h: 0.35 },
    { pts: [[0.6, 0.83], [0.66, 0.9]], w: 0.03, h: 0.5 },
  ],
  rivers: [
    { name: "Karth River", pts: [[0.065, 0.51], [0.1, 0.435], [0.14, 0.36], [0.17, 0.29], [0.2, 0.235], [0.228, 0.198]] },
    { name: "White River", pts: [[0.495, 0.645], [0.52, 0.575], [0.57, 0.515], [0.63, 0.472], [0.69, 0.423], [0.74, 0.37], [0.778, 0.3], [0.8, 0.22], [0.806, 0.17]] },
    { name: "Hjaal River", pts: [[0.36, 0.36], [0.335, 0.31], [0.315, 0.255], [0.31, 0.175]] },
    { name: "Treva River", pts: [[0.835, 0.755], [0.8, 0.665], [0.755, 0.585], [0.705, 0.52], [0.66, 0.482]] },
    { name: "Yorgrim River", pts: [[0.69, 0.33], [0.72, 0.24], [0.715, 0.13]] },
  ],
  lakes: [[0.425, 0.73, 0.048, 0.022], [0.832, 0.792, 0.04, 0.024], [0.7, 0.795, 0.016, 0.011],
    [0.29, 0.215, 0.012, 0.007], [0.265, 0.235, 0.008, 0.005], [0.75, 0.44, 0.008, 0.006], [0.71, 0.405, 0.006, 0.005]],
  // regions: [cx, cy, rx, ry, type] — later entries win where they overlap
  regions: [
    [0.47, 0.47, 0.17, 0.12, "tundra"], [0.2, 0.29, 0.09, 0.06, "forest"], [0.55, 0.55, 0.08, 0.05, "forest"],
    [0.13, 0.56, 0.13, 0.24, "rocky"], [0.29, 0.235, 0.085, 0.06, "marsh"], [0.73, 0.43, 0.075, 0.065, "volcanic"],
    [0.38, 0.83, 0.16, 0.11, "pine"], [0.52, 0.8, 0.1, 0.07, "pine"], [0.82, 0.77, 0.14, 0.14, "autumn"],
    [0.68, 0.72, 0.06, 0.06, "autumn"],
  ],
  snowLine: 0.29,                     // north of this is snow, except marsh and forest
  holds: {                            // label position, region seed, tint
    "Haafingar": [[0.15, 0.2], [0.16, 0.21], [120, 140, 190]],
    "Hjaalmarch": [[0.3, 0.3], [0.3, 0.25], [110, 150, 120]],
    "The Pale": [[0.56, 0.2], [0.55, 0.21], [170, 175, 200]],
    "Winterhold": [[0.79, 0.17], [0.76, 0.16], [150, 190, 215]],
    "Eastmarch": [[0.8, 0.43], [0.77, 0.42], [200, 120, 90]],
    "Whiterun": [[0.45, 0.44], [0.44, 0.5], [215, 185, 95]],
    "The Reach": [[0.1, 0.62], [0.12, 0.55], [190, 110, 120]],
    "Falkreath": [[0.36, 0.92], [0.38, 0.83], [95, 150, 95]],
    "The Rift": [[0.76, 0.89], [0.8, 0.76], [215, 150, 70]],
  },
  beyond: [["HIGH ROCK", 0.03, 0.45, -90], ["HAMMERFELL", 0.07, 0.94, 0], ["CYRODIIL", 0.5, 0.985, 0], ["MORROWIND", 0.975, 0.5, 90]],
  /* places: name → [x, y, kind]. kinds: city town farm fort dungeon camp lair stone shrine landmark */
  places: {
    "Solitude": [0.213, 0.183, "city"], "Markarth": [0.065, 0.505, "city"], "Whiterun": [0.48, 0.485, "city"],
    "Windhelm": [0.787, 0.305, "city"], "Riften": [0.873, 0.822, "city"],
    "Dawnstar": [0.49, 0.128, "town"], "Winterhold": [0.738, 0.118, "town"], "Morthal": [0.305, 0.27, "town"],
    "Falkreath": [0.37, 0.845, "town"], "Riverwood": [0.496, 0.633, "town"], "Helgen": [0.555, 0.765, "town"],
    "Ivarstead": [0.665, 0.66, "town"], "Rorikstead": [0.283, 0.505, "town"], "Dragon Bridge": [0.163, 0.255, "town"],
    "Karthwasten": [0.128, 0.42, "town"], "Kynesgrove": [0.73, 0.376, "town"], "Shor's Stone": [0.858, 0.69, "town"],
    "Darkwater Crossing": [0.742, 0.548, "town"], "Old Hroldan": [0.2, 0.552, "town"], "Soljund's Sinkhole": [0.14, 0.66, "town"],
    "Stonehills": [0.24, 0.345, "town"], "Half-Moon Mill": [0.405, 0.762, "farm"], "Katla's Farm": [0.2, 0.208, "farm"],
    "Mixwater Mill": [0.775, 0.475, "farm"], "Loreius Farm": [0.512, 0.405, "farm"], "Heartwood Mill": [0.8, 0.83, "farm"],
    "Fort Greymoor": [0.39, 0.53, "fort"], "Fort Dunstad": [0.505, 0.24, "fort"], "Fort Neugrad": [0.31, 0.885, "fort"],
    "Fort Hraggstad": [0.11, 0.225, "fort"], "Fort Amol": [0.7, 0.455, "fort"], "Fort Dawnguard": [0.948, 0.72, "fort"],
    "Fort Sungard": [0.175, 0.48, "fort"], "Fort Kastav": [0.66, 0.205, "fort"], "Fort Snowhawk": [0.295, 0.215, "fort"],
    "Fort Greenwall": [0.915, 0.655, "fort"], "Valtheim Towers": [0.622, 0.472, "fort"], "Western Watchtower": [0.447, 0.497, "fort"],
    "Northwatch Keep": [0.1, 0.18, "fort"],
    "Bleak Falls Barrow": [0.452, 0.585, "dungeon"], "Embershard Mine": [0.47, 0.672, "dungeon"], "Labyrinthian": [0.345, 0.372, "dungeon"],
    "Ustengrav": [0.36, 0.215, "dungeon"], "Saarthal": [0.705, 0.148, "dungeon"], "Ysgramor's Tomb": [0.705, 0.085, "dungeon"],
    "Nightcaller Temple": [0.535, 0.172, "dungeon"], "Forelhost": [0.8, 0.625, "dungeon"], "Shroud Hearth Barrow": [0.652, 0.672, "dungeon"],
    "Volunruud": [0.665, 0.37, "dungeon"], "Yngol Barrow": [0.795, 0.255, "dungeon"], "Ragnvald": [0.2, 0.465, "dungeon"],
    "Dead Men's Respite": [0.275, 0.365, "dungeon"], "Wolfskull Cave": [0.235, 0.16, "dungeon"], "Swindler's Den": [0.392, 0.468, "dungeon"],
    "Bloodlet Throne": [0.29, 0.775, "dungeon"], "Blind Cliff Cave": [0.18, 0.625, "dungeon"], "Deepwood Redoubt": [0.15, 0.355, "dungeon"],
    "Hag's End": [0.095, 0.69, "dungeon"], "Folgunthur": [0.255, 0.18, "dungeon"], "Mzulft": [0.785, 0.43, "dungeon"],
    "Raldbthar": [0.845, 0.365, "dungeon"], "Alftand": [0.665, 0.255, "dungeon"], "Lost Valley Redoubt": [0.16, 0.51, "dungeon"],
    "Broken Fang Cave": [0.418, 0.365, "dungeon"], "Pinewatch": [0.565, 0.805, "dungeon"], "Hillgrund's Tomb": [0.155, 0.77, "dungeon"],
    "Halted Stream Camp": [0.43, 0.42, "camp"], "Silent Moons Camp": [0.375, 0.405, "camp"], "Bleakwind Basin": [0.43, 0.455, "camp"],
    "Secunda's Kiss": [0.615, 0.325, "camp"], "Sleeping Tree Camp": [0.325, 0.435, "camp"], "Bilegulch Mine": [0.21, 0.6, "camp"],
    "Bonestrewn Crest": [0.33, 0.69, "lair"], "Mount Anthor": [0.47, 0.29, "lair"], "Lost Tongue Overlook": [0.825, 0.55, "lair"],
    "Shearpoint": [0.66, 0.235, "lair"], "Bleakcoast Cave": [0.6, 0.11, "dungeon"],
    "Guardian Stones": [0.535, 0.665, "stone"], "The Lover Stone": [0.08, 0.585, "stone"], "The Serpent Stone": [0.785, 0.065, "stone"],
    "The Steed Stone": [0.155, 0.19, "stone"], "The Lord Stone": [0.25, 0.262, "stone"], "The Apprentice Stone": [0.335, 0.205, "stone"],
    "The Atronach Stone": [0.825, 0.405, "stone"], "The Ritual Stone": [0.55, 0.44, "stone"], "The Shadow Stone": [0.84, 0.885, "stone"],
    "The Lady Stone": [0.43, 0.728, "stone"], "The Tower Stone": [0.565, 0.185, "stone"],
    "Shrine of Azura": [0.832, 0.232, "shrine"], "Shrine of Talos": [0.605, 0.85, "shrine"], "Shrine of Mehrunes Dagon": [0.2, 0.39, "shrine"],
    "High Hrothgar": [0.585, 0.615, "landmark"], "Sky Haven Temple": [0.105, 0.34, "landmark"], "Eldergleam Sanctuary": [0.735, 0.49, "landmark"],
    "The Midden": [0.75, 0.13, "landmark"],
  },
  /* roads: chains of place names and bend points */
  roads: [
    ["Solitude", [0.195, 0.222], "Dragon Bridge"],
    ["Dragon Bridge", [0.15, 0.31], [0.14, 0.37], "Karthwasten", [0.1, 0.46], "Markarth"],
    ["Dragon Bridge", [0.21, 0.272], [0.26, 0.28], "Morthal"],
    ["Morthal", [0.335, 0.33], "Stonehills"],
    ["Morthal", [0.335, 0.33], [0.37, 0.395], [0.42, 0.44], "Whiterun"],
    ["Markarth", [0.12, 0.53], "Old Hroldan", [0.25, 0.53], "Rorikstead", [0.34, 0.512], [0.41, 0.5], "Whiterun"],
    ["Whiterun", [0.488, 0.55], "Riverwood", [0.53, 0.7], "Helgen"],
    ["Riverwood", [0.465, 0.69], [0.42, 0.78], "Falkreath"],
    ["Falkreath", [0.45, 0.8], [0.51, 0.785], "Helgen"],
    ["Whiterun", [0.55, 0.47], "Valtheim Towers", [0.68, 0.425], "Kynesgrove", [0.765, 0.34], "Windhelm"],
    ["Windhelm", [0.765, 0.25], [0.745, 0.18], "Winterhold"],
    ["Windhelm", [0.792, 0.4], "Mixwater Mill", "Darkwater Crossing", [0.805, 0.62], "Shor's Stone", [0.87, 0.75], "Riften"],
    ["Helgen", [0.6, 0.745], [0.64, 0.695], "Ivarstead", [0.7, 0.73], [0.77, 0.8], "Riften"],
    ["Ivarstead", [0.63, 0.64], "High Hrothgar"],
    ["Whiterun", [0.505, 0.4], [0.505, 0.31], "Fort Dunstad", [0.495, 0.18], "Dawnstar"],
    ["Ivarstead", [0.705, 0.6], "Darkwater Crossing"],
    ["Markarth", [0.1, 0.6], "Soljund's Sinkhole"],
    ["Riften", [0.83, 0.84], "Heartwood Mill"],
  ],
};
if (typeof module !== "undefined") module.exports = WORLD;
