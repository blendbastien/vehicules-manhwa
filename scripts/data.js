/* Véhicules Manhwa — données : emplacements, tailles, milieux, caractéristiques, paliers narratifs, profils de véhicules,
 * reconnaissance des pièces et calcul des caractéristiques effectives. Aucune dépendance à Foundry ici (testable sous Node). */
import { CATALOGUE_PARTS, PART_BY_NAME } from "./parts-data.js";

export const MOD = "vehicules-manhwa";
export const TYPE = `${MOD}.vehicle`;
export const CAT = "last-horizon-catalogue";

export const SLOTS = {
  hull:       { name: "Coque",          icon: "fa-shield-halved",   color: "#a9c1dc" },
  propulsion: { name: "Propulsion",     icon: "fa-wind",            color: "#38d6ff" },
  steering:   { name: "Direction",      icon: "fa-dharmachakra",    color: "#ffd166" },
  wheels:     { name: "Roues & train",  icon: "fa-circle-dot",      color: "#d6a77a" },
  weapons:    { name: "Armement",       icon: "fa-crosshairs",      color: "#ff5f6d" },
  defense:    { name: "Défense",        icon: "fa-shield",          color: "#8c9bff" },
  cargo:      { name: "Soute",          icon: "fa-boxes-stacked",   color: "#f5a35c" },
  comfort:    { name: "Confort",        icon: "fa-couch",           color: "#ff8ad8" },
  special:    { name: "Spécial",        icon: "fa-star",            color: "#b7ff6a" }
};
export const SLOT_KEYS = Object.keys(SLOTS);

export const ENVS = {
  sea:   { name: "Naval",     icon: "fa-anchor",        color: "#34c6ff" },
  land:  { name: "Terrestre", icon: "fa-road",          color: "#e0a75a" },
  air:   { name: "Aérien",    icon: "fa-feather-pointed", color: "#9fe7ff" },
  space: { name: "Spatial",   icon: "fa-user-astronaut", color: "#c58bff" }
};

export const SIZES = {
  xs: { name: "Minuscule", order: 0 },
  s:  { name: "Petit",     order: 1 },
  m:  { name: "Moyen",     order: 2 },
  l:  { name: "Grand",     order: 3 },
  xl: { name: "Colossal",  order: 4 }
};
/* emplacements par défaut selon la taille (modifiables dans les réglages du module, puis par véhicule, puis par les pièces) */
export const DEFAULT_SIZE_SLOTS = {
  xs: { hull: 1, propulsion: 1, steering: 1, wheels: 1, weapons: 0, defense: 0, cargo: 1, comfort: 0, special: 1 },
  s:  { hull: 1, propulsion: 1, steering: 1, wheels: 1, weapons: 1, defense: 1, cargo: 1, comfort: 1, special: 1 },
  m:  { hull: 2, propulsion: 2, steering: 1, wheels: 1, weapons: 3, defense: 2, cargo: 2, comfort: 2, special: 1 },
  l:  { hull: 3, propulsion: 3, steering: 1, wheels: 1, weapons: 8, defense: 3, cargo: 3, comfort: 3, special: 2 },
  xl: { hull: 4, propulsion: 4, steering: 2, wheels: 1, weapons: 16, defense: 4, cargo: 4, comfort: 4, special: 3 }
};

/* caractéristiques ; tiers = seuils (valeur ≥ seuil → palier suivant) et libellés narratifs (un de plus que de seuils) */
export const STATS = {
  hull:       { name: "Coque",            icon: "fa-shield-halved", unit: "",     tiers: [15, 40, 100, 250, 600, 1500, 4000],     labels: ["Fragile", "Légère", "Solide", "Robuste", "Renforcée", "Blindée", "Forteresse", "Titanesque"] },
  armor:      { name: "Armure",           icon: "fa-shield",        unit: "",     tiers: [1, 3, 6, 10, 16, 25, 40],               labels: ["Aucune", "Légère", "Moyenne", "Épaisse", "Lourde", "Blindage", "Rempart", "Inviolable"] },
  speed:      { name: "Vitesse",          icon: "fa-gauge-high",    unit: "km/h", tiers: [3, 8, 20, 50, 120, 350, 1500],          labels: ["Très lente", "Lente", "Allure modeste", "Modérée", "Rapide", "Très rapide", "Fulgurante", "Hyperluminique"] },
  handling:   { name: "Maniabilité",      icon: "fa-dharmachakra",  unit: "",     tiers: [1, 3, 5, 7, 9, 12, 16],                 labels: ["Pataude", "Lourde", "Stable", "Agile", "Vive", "Virtuose", "Instinctive", "Surnaturelle"] },
  firepower:  { name: "Puissance de feu", icon: "fa-crosshairs",    unit: "",     tiers: [1, 5, 12, 25, 50, 100, 250],            labels: ["Désarmé", "Symbolique", "Légère", "Dissuasive", "Redoutable", "Lourde", "Dévastatrice", "Apocalyptique"] },
  cargo:      { name: "Soute",            icon: "fa-boxes-stacked", unit: "kg",   tiers: [30, 150, 500, 2000, 10000, 100000, 1e6], labels: ["Quelques sacs", "Petite charge", "Chargement", "Cale", "Grande cale", "Cargo", "Vrac industriel", "Colossale"] },
  autonomy:   { name: "Autonomie",        icon: "fa-hourglass-half", unit: "h",   tiers: [6, 24, 72, 240, 1000, 5000, 30000],     labels: ["Quelques heures", "Une journée", "Quelques jours", "Une semaine", "Un mois", "Une saison", "Une année", "Illimitée"] },
  comfort:    { name: "Confort",          icon: "fa-couch",         unit: "",     tiers: [1, 2, 4, 6, 9, 13, 18],                 labels: ["Spartiate", "Rudimentaire", "Correct", "Confortable", "Douillet", "Luxueux", "Princier", "Palais"] },
  crew:       { name: "Équipage",         icon: "fa-users",         unit: "",     count: true },
  passengers: { name: "Passagers",        icon: "fa-person",        unit: "",     count: true }
};
export const STAT_KEYS = Object.keys(STATS);
export const BONUS_KEYS = [...STAT_KEYS, "speedPct", "autonomyPct"];
export const HULL_STATES = ["Intacte", "Éraflée", "Endommagée", "Gravement endommagée", "Épave"];

export function tierOf(key, v) { const s = STATS[key]; if (!s?.tiers) return null; let i = 0; while (i < s.tiers.length && v >= s.tiers[i]) i++; return { i, label: s.labels[i], max: s.tiers.length }; }

/* ── profils ── base = valeurs typiques au rang de référence ; ord = [coque, armure, vitesse km/h, maniabilité, feu, soute kg, équipage, passagers, autonomie h, confort] */
const P = (name, env, size, ref, icon, st, extra = {}) => ({ name, env, size, ref, icon, base: { hull: st[0], armor: st[1], speed: st[2], handling: st[3], firepower: st[4], cargo: st[5], crew: st[6], passengers: st[7], autonomy: st[8], comfort: st[9] }, ...extra });
export const FAMILIES = {
  radeau:        P("Radeau",                "sea",   "xs", "F", "fa-water",           [10, 0, 3, 1, 0, 150, 1, 2, 24, 0]),
  canot:         P("Barque & canot",        "sea",   "xs", "F", "fa-sailboat",        [20, 0, 5, 3, 0, 200, 1, 2, 12, 0]),
  chaloupe:      P("Chaloupe",              "sea",   "s",  "E", "fa-sailboat",        [40, 1, 6, 3, 0, 1500, 2, 4, 24, 1]),
  galere:        P("Galère",                "sea",   "l",  "C", "fa-ship",            [400, 4, 12, 4, 10, 20000, 60, 20, 96, 1]),
  voilier_petit: P("Petit voilier",         "sea",   "s",  "E", "fa-sailboat",        [50, 1, 11, 5, 0, 600, 1, 3, 96, 1]),
  voilier:       P("Voilier",               "sea",   "m",  "D", "fa-sailboat",        [150, 2, 15, 5, 0, 3000, 2, 6, 240, 3]),
  navire_voile:  P("Navire à voiles",       "sea",   "l",  "C", "fa-ship",            [600, 4, 16, 3, 8, 200000, 20, 12, 720, 2]),
  bateau_moteur: P("Bateau à moteur",       "sea",   "s",  "D", "fa-ship",            [80, 2, 60, 6, 0, 800, 1, 6, 8, 3]),
  navire_moteur: P("Navire à moteur",       "sea",   "l",  "B", "fa-ferry",           [1500, 6, 40, 3, 0, 1000000, 15, 200, 720, 4]),
  sous_marin:    P("Sous-marin",            "sea",   "m",  "B", "fa-water",           [400, 8, 25, 4, 6, 5000, 3, 8, 240, 3]),
  cite_flottante:P("Cité flottante",        "sea",   "xl", "S", "fa-city",            [30000, 30, 8, 0, 100, 5000000, 300, 5000, 100000, 6]),
  charrette:     P("Charrette & carriole",  "land",  "xs", "F", "fa-cart-flatbed",    [20, 0, 6, 2, 0, 300, 1, 1, 10, 0]),
  chariot:       P("Chariot & voiture à cheval", "land", "s", "E", "fa-horse",        [50, 1, 8, 2, 0, 800, 1, 4, 12, 2]),
  char_guerre:   P("Char de guerre",        "land",  "s",  "C", "fa-horse-head",      [120, 4, 25, 4, 10, 200, 2, 2, 10, 1]),
  cycle:         P("Cycle",                 "land",  "xs", "F", "fa-bicycle",         [8, 0, 18, 6, 0, 20, 1, 0, 6, 1]),
  moto:          P("Moto",                  "land",  "xs", "D", "fa-motorcycle",      [30, 1, 120, 8, 0, 20, 1, 1, 4, 1]),
  voiture:       P("Voiture",               "land",  "s",  "D", "fa-car",             [120, 2, 150, 6, 0, 400, 1, 4, 6, 4]),
  utilitaire:    P("Utilitaire & engin",    "land",  "m",  "D", "fa-truck",           [200, 2, 90, 3, 0, 3000, 1, 2, 8, 2]),
  blinde:        P("Blindé",                "land",  "m",  "B", "fa-truck-monster",   [800, 12, 60, 3, 30, 1000, 3, 6, 8, 1]),
  train:         P("Train",                 "land",  "l",  "C", "fa-train",           [1500, 6, 120, 1, 0, 200000, 3, 300, 24, 3]),
  habitat_roulant:P("Habitat roulant",      "land",  "m",  "C", "fa-caravan",         [300, 2, 70, 2, 0, 2000, 1, 6, 48, 6]),
  forteresse_terre:P("Forteresse mobile",   "land",  "xl", "SS","fa-chess-rook",      [20000, 40, 15, 1, 200, 1000000, 200, 1000, 2000, 3]),
  meca:          P("Méca & automate",       "land",  "m",  "B", "fa-robot",           [400, 10, 60, 5, 25, 200, 1, 0, 24, 1]),
  planeur:       P("Planeur",               "air",   "xs", "E", "fa-paper-plane",     [10, 0, 40, 6, 0, 20, 1, 0, 3, 0]),
  ballon:        P("Ballon",                "air",   "s",  "D", "fa-mosque",          [30, 0, 15, 1, 0, 400, 1, 4, 12, 1]),
  dirigeable:    P("Dirigeable",            "air",   "l",  "C", "fa-plane-up",        [400, 2, 80, 2, 4, 20000, 8, 40, 240, 4]),
  aeronef:       P("Aéronef",               "air",   "m",  "B", "fa-plane",           [200, 3, 500, 7, 0, 2000, 2, 8, 6, 3]),
  forteresse_air:P("Forteresse volante",    "air",   "xl", "SS","fa-chess-rook",      [12000, 30, 60, 1, 150, 500000, 300, 1500, 2000, 4]),
  chasseur:      P("Chasseur spatial",      "space", "s",  "A", "fa-jet-fighter",     [300, 8, 30000, 9, 40, 200, 1, 1, 24, 2]),
  navette:       P("Navette",               "space", "m",  "B", "fa-shuttle-space",   [500, 6, 15000, 6, 4, 5000, 2, 10, 240, 4]),
  vaisseau:      P("Vaisseau",              "space", "l",  "A", "fa-rocket",          [3000, 15, 20000, 4, 30, 500000, 20, 60, 4000, 5]),
  croiseur:      P("Croiseur",              "space", "xl", "S", "fa-satellite",       [20000, 40, 18000, 2, 500, 2000000, 500, 200, 20000, 4]),
  station:       P("Station",               "space", "xl", "SS","fa-satellite-dish",  [50000, 40, 0, 0, 100, 5000000, 200, 2000, 1000000, 6]),
  autre:         P("Autre véhicule",        "land",  "s",  "E", "fa-gears",           [50, 1, 20, 3, 0, 300, 1, 2, 24, 1])
};

/* catégorie|sous-catégorie du Catalogue → profil ; null = pas un véhicule (montures, créatures, portails, pièces…) */
const CAT_MAP = {
  "Nautique|Rame": "canot", "Nautique|Voile": "voilier", "Nautique|Moteur": "bateau_moteur", "Nautique|Sous-marin": "sous_marin", "Nautique|Vivant": null,
  "Sous-marins|Léger": "sous_marin", "Sous-marins|Lourd": "sous_marin", "Sous-marins|Vivant": null,
  "Terrestre|Monture": null, "Terrestre|Attelage": "chariot", "Terrestre|Cycle": "cycle", "Terrestre|Automobile": "voiture", "Terrestre|Utilitaire": "utilitaire", "Terrestre|Futuriste": "voiture",
  "Terrestre|Citadine": "voiture", "Terrestre|Berline": "voiture", "Terrestre|SUV": "voiture", "Terrestre|Sportive": "voiture", "Terrestre|Limousine": "voiture", "Terrestre|Blindée": "blinde",
  "Blindés|*": "blinde", "Chantier|*": "utilitaire", "Ferroviaire|*": "train", "Motos|*": "moto", "Mécanique|*": "meca",
  "Course|Terrestre": "voiture", "Course|Aérien": "aeronef", "Course|Spatial": "chasseur", "Course|Nautique": "bateau_moteur",
  "Aérien|Planeur": "planeur", "Aérien|Ballon": "ballon", "Aérien|Aéronef": "aeronef", "Aérien|Dirigeable": "dirigeable",
  "Forteresses mobiles|Terrestre": "forteresse_terre", "Forteresses mobiles|Aérien": "forteresse_air", "Forteresses mobiles|Nautique": "cite_flottante",
  "Habitats|Roulant": "habitat_roulant", "Habitats|Volant": "dirigeable", "Habitats|Flottant": "cite_flottante", "Habitats|Spatial": "station", "Habitats|Vivant": null,
  "Vaisseaux|Chasseur": "chasseur", "Vaisseaux|Navette": "navette", "Vaisseaux|Croiseur": "croiseur", "Vaisseaux|Guerre": "croiseur", "Vaisseaux|Station": "station", "Vaisseaux|*": "vaisseau",
  "Montures|*": null, "Montures volantes|*": null, "Portails|*": null, "Modules|*": null, "Carburants|*": null
};
/* affinage par le nom (prioritaire) */
const NAME_RULES = [
  [/radeau/i, "radeau"], [/gal[èe]re/i, "galere"], [/chaloupe|barque de p[êe]che/i, "chaloupe"],
  [/sloop|d[ée]riveur|planche [àa] voile|st-v1/i, "voilier_petit"], [/trois-m[âa]ts|go[ée]lette|navire marchand|cogue|caravelle|galion|voile royale/i, "navire_voile"],
  [/ferry|brise-glace|porte-conteneurs|p[ée]trolier|chalutier|yacht de luxe/i, "navire_moteur"],
  [/char [àa] bras|charrette|carriole/i, "charrette"], [/chariot de guerre|char [àa] faux/i, "char_guerre"]
];
const ITEM_CAT_MAP = { /* repli : catégorie de l'arbre Manhwa Sheet */
  vehicle_nautical_oar: "canot", vehicle_nautical_sail: "voilier", vehicle_nautical_engine: "bateau_moteur", vehicle_nautical_submarine: "sous_marin",
  vehicle_ground_carriage: "chariot", vehicle_ground_bicycle: "cycle", vehicle_ground_armored: "blinde", vehicle_aerial_glider: "planeur", vehicle_aerial_balloon: "ballon",
  vehicle_aerial_aircraft: "aeronef", vehicle_aerial_airship: "dirigeable", vehicle_starships_shuttle: "navette", vehicle_starships_hunter: "chasseur", vehicle_starships_war: "croiseur"
};
const ITEM_CAT_PREFIX = [["vehicle_mounts", null], ["vehicle_flying_mounts", null], ["vehicle_portals", null], ["vehicle_maintenance", null], ["vehicle_modules", null], ["vehicle_fuels", null], ["vehicle_submarines", "sous_marin"], ["vehicle_motorcycles", "moto"], ["vehicle_rail", "train"], ["vehicle_armored", "blinde"], ["vehicle_construction", "utilitaire"], ["vehicle_mechanical", "meca"], ["vehicle_starships", "vaisseau"], ["vehicle_mobile_fortresses", "forteresse_terre"], ["vehicle_habitats", "habitat_roulant"], ["vehicle_ground", "voiture"], ["vehicle_racing", "voiture"], ["vehicle_nautical", "canot"], ["vehicle_aerial", "aeronef"]];

/** famille d'un objet véhicule ; undefined = pas reconnu ; null = exclu (monture, pièce…) */
export function familyOf({ name = "", cat = "", sub = "", category = "" } = {}) {
  if (cat) { const k = CAT_MAP[`${cat}|${sub}`] !== undefined ? CAT_MAP[`${cat}|${sub}`] : CAT_MAP[`${cat}|*`]; if (k === null) return null; for (const [re, f] of NAME_RULES) if (re.test(name)) return f; if (k) return k; }
  if (category) { if (category in ITEM_CAT_MAP) return ITEM_CAT_MAP[category]; for (const [p, f] of ITEM_CAT_PREFIX) if (category.startsWith(p)) { if (f === null) return null; for (const [re, g] of NAME_RULES) if (re.test(name)) return g; return f; } }
  for (const [re, f] of NAME_RULES) if (re.test(name)) return f;
  return undefined;
}

export const RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"];
const rIdx = r => { const i = RANKS.indexOf(String(r || "").toUpperCase()); return i < 0 ? 0 : i; };
/** caractéristiques de base d'un profil, ajustées au rang et à la description (« 60 km/h », « 6 places », « 2 t »…) */
export function baseStats(famKey, rank, desc = "") {
  const f = FAMILIES[famKey] || FAMILIES.autre; const d = rIdx(rank) - rIdx(f.ref); const b = { ...f.base };
  const m = (k, x) => { b[k] = Math.max(0, Math.round(b[k] * Math.pow(x, d))); };
  m("hull", 1.3); m("armor", 1.2); m("firepower", 1.3); m("cargo", 1.2); m("speed", 1.06); m("autonomy", 1.25); m("comfort", 1.15);
  const t = String(desc || "").replace(/ | /g, " ");
  const num = s => Number(String(s).replace(/\s/g, "").replace(",", "."));
  let x;
  if ((x = t.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*km\/h/i))) b.speed = num(x[1]);
  else if ((x = t.match(/(\d[\d\s]*)\s*n[œo]euds?/i))) b.speed = Math.round(num(x[1]) * 1.852);
  else if ((x = t.match(/(\d[\d\s]*)\s*km\/j/i))) b.speed = Math.round(num(x[1]) / 8);
  if ((x = t.match(/(\d[\d\s]*)\s*(?:places|passagers|couchettes|couchages)/i))) b.passengers = num(x[1]);
  if ((x = t.match(/(\d[\d\s]*)\s*(?:rameurs|marins|hommes d'équipage)/i)) || (x = t.match(/[ée]quipage\s*(\d[\d\s]*)/i))) b.crew = num(x[1]);
  if ((x = t.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*t\b/i)) && !/km/.test(x[0])) b.cargo = Math.round(num(x[1]) * 1000);
  else if ((x = t.match(/(\d[\d\s]*)\s*kg/i))) b.cargo = num(x[1]);
  if ((x = t.match(/(\d[\d\s]*)\s*km d'autonomie/i)) && b.speed) b.autonomy = Math.round(num(x[1]) / b.speed);
  return b;
}

/* ── pièces ── */
const SUB_SLOT = { "Propulsion": "propulsion", "Défense": "defense", "Armement": "weapons", "Navigation": "steering", "Confort": "comfort", "Survie": "special", "Utilitaire": "special" };
const R = [1, 2, 4, 8, 16, 32, 64, 128, 256];
/** reconnaît une pièce installable à partir des drapeaux du Catalogue (vp), de la table intégrée, ou par déduction (catégorie, rang, description) */
export function partInfo({ name = "", flags = {}, category = "" } = {}) {
  const c = flags || {};
  if (c.vp?.slot) return { slot: c.vp.slot, env: c.vp.env || [], bonus: { ...(c.vp.bonus || {}) } };
  const known = (c.id && CATALOGUE_PARTS[c.id]) || (PART_BY_NAME[name] && CATALOGUE_PARTS[PART_BY_NAME[name]]);
  if (known) return { slot: known.slot, env: known.env || [], bonus: { ...(known.bonus || {}) } };
  const cat = c.cat || "", sub = c.sub || ""; const isMod = cat === "Modules" || /^vehicle_modules/.test(category); const isPiece = (cat === "Carburants" && sub === "Pièce") || category === "vehicle_fuels_piece";
  if (!isMod && !isPiece) return null;
  const desc = String(c.desc || ""); const r = R[rIdx(c.rang)]; const n = name + " " + desc; let slot, bonus = {};
  const pct = desc.match(/\+\s*(\d+)\s*%/); const mul = desc.match(/[×x]\s*(\d+)/);
  if (isPiece) {
    if (/fers? [àa] cheval/i.test(n)) return null;
    if (/pneu|chambre [àa] air|cha[îi]ne|roue/i.test(n)) slot = "wheels";
    else if (/coque|blindage/i.test(n)) slot = "hull";
    else if (/voile|h[ée]lice|moteur|r[ée]acteur|rotor|c[œo]eur de golem/i.test(n)) slot = "propulsion";
    else if (/pare-brise/i.test(n)) slot = "defense";
    else slot = "special";
  } else {
    slot = SUB_SLOT[sub] || (category.includes("propulsion") ? "propulsion" : category.includes("defense") ? "defense" : category.includes("armament") ? "weapons" : category.includes("navigation") ? "steering" : category.includes("comfort") ? "comfort" : "special");
    if (slot === "defense" && /^(blindage|plaques|pare-buffle|coque)/i.test(name)) slot = "hull";
    if (slot === "special" && /soute|fret|cale|remorque|cargo/i.test(n)) slot = "cargo";
  }
  switch (slot) {
    case "hull": bonus = { hull: 10 * r, armor: Math.ceil(r / 2) }; break;
    case "defense": bonus = { armor: Math.max(1, Math.round(r * 0.75)) }; break;
    case "propulsion": bonus = pct ? { speedPct: Number(pct[1]) } : mul ? { speedPct: (Number(mul[1]) - 1) * 100 } : { speedPct: 5 + 5 * rIdx(c.rang) }; break;
    case "wheels": bonus = { speedPct: 5, handling: 1 }; break;
    case "weapons": bonus = { firepower: 4 * r }; break;
    case "steering": bonus = { handling: 1 + Math.floor(rIdx(c.rang) / 2) }; break;
    case "comfort": bonus = { comfort: 1 + Math.floor(rIdx(c.rang) / 2) }; break;
    case "cargo": bonus = { cargo: 100 * r }; break;
    default: bonus = /batterie|r[ée]serve|recycleur|oxyg[èe]ne|eau/i.test(n) ? { autonomy: 12 * r } : {};
  }
  return { slot, env: [], bonus, guessed: true };
}

/** emplacements par défaut d'une taille (réglage monde facultatif) */
export function sizeSlots(size, custom) { return { ...DEFAULT_SIZE_SLOTS.s, ...(DEFAULT_SIZE_SLOTS[size] || {}), ...((custom || {})[size] || {}) }; }

/** calcule tout : emplacements (base + modif. véhicule + pièces), caractéristiques (base + bonus), détails par caractéristique */
export function compute(sys, parts, customSizeSlots) {
  const base = { ...Object.fromEntries(STAT_KEYS.map(k => [k, 0])), ...(sys.base || {}) };
  const slotsBase = sizeSlots(sys.size, customSizeSlots); const over = sys.slotsOverride || {};
  const has = k => over[k] !== undefined && over[k] !== "" && over[k] !== null && Number.isFinite(Number(over[k]));
  const slots = {}; for (const k of SLOT_KEYS) slots[k] = { base: has(k) ? Number(over[k]) : (k === "wheels" && sys.env && sys.env !== "land" ? 0 : slotsBase[k]), extra: 0, used: 0, parts: [] };
  const add = Object.fromEntries(BONUS_KEYS.map(k => [k, 0])); const from = Object.fromEntries(BONUS_KEYS.map(k => [k, []]));
  for (const p of parts) {
    const b = p.bonus || {}; const sl = slots[p.slot]; if (sl) { sl.used++; sl.parts.push(p); }
    for (const k of BONUS_KEYS) { const v = Number(b[k]) || 0; if (v) { add[k] += v; from[k].push({ name: p.name, v }); } }
    for (const [k, n] of Object.entries(b.slots || {})) if (slots[k]) slots[k].extra += Number(n) || 0;
  }
  for (const k of SLOT_KEYS) slots[k].total = Math.max(0, slots[k].base + slots[k].extra);
  const eff = {}; const detail = {};
  for (const k of STAT_KEYS) {
    let v = (Number(base[k]) || 0) + add[k];
    if (k === "speed" && add.speedPct) v = v * (1 + add.speedPct / 100);
    if (k === "autonomy" && add.autonomyPct) v = v * (1 + add.autonomyPct / 100);
    eff[k] = Math.max(0, Math.round(v));
    detail[k] = { base: Number(base[k]) || 0, add: add[k], pct: k === "speed" ? add.speedPct : k === "autonomy" ? add.autonomyPct : 0, from: [...from[k], ...((k === "speed" ? from.speedPct : k === "autonomy" ? from.autonomyPct : []).map(x => ({ ...x, pct: true })))] };
  }
  return { slots, eff, detail };
}

/* ── formatage ── */
export const fmtN = n => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));
export function fmtStat(k, v) {
  v = Number(v) || 0;
  if (k === "autonomy") { if (v >= 24 * 365 * 2) return `${fmtN(v / (24 * 365))} ans`; if (v >= 24 * 60) return `${fmtN(v / (24 * 30))} mois`; if (v >= 48) return `${fmtN(v / 24)} j`; return `${fmtN(v)} h`; }
  if (k === "cargo") return v >= 10000 ? `${fmtN(v / 1000)} t` : `${fmtN(v)} kg`;
  if (k === "speed") return `${fmtN(v)} km/h`;
  return fmtN(v);
}
export function fmtBonus(b = {}) {
  const out = [];
  for (const k of BONUS_KEYS) { const v = Number(b[k]) || 0; if (!v) continue; const s = v > 0 ? "+" : "−"; const a = Math.abs(v);
    if (k === "speedPct") out.push(`Vitesse ${s}${a} %`); else if (k === "autonomyPct") out.push(`Autonomie ${s}${a} %`);
    else out.push(`${STATS[k].name} ${s}${k === "speed" ? a + " km/h" : k === "autonomy" ? a + " h" : k === "cargo" ? a + " kg" : a}`); }
  for (const [k, n] of Object.entries(b.slots || {})) if (Number(n)) out.push(`${Number(n) > 0 ? "+" : "−"}${Math.abs(n)} empl. ${SLOTS[k]?.name.toLowerCase() || k}`);
  return out;
}

/* postes d'équipage proposés selon le milieu */
export const DEFAULT_POSTS = {
  sea: ["Capitaine", "Barreur", "Vigie", "Canonnier", "Charpentier"],
  land: ["Conducteur", "Garde", "Intendant"],
  air: ["Commandant", "Pilote", "Mécanicien", "Navigateur"],
  space: ["Commandant", "Pilote", "Ingénieur", "Artilleur", "Officier scientifique"]
};
