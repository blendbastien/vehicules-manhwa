/* Véhicules Manhwa 2.0 — « Logement » : registre des biens hors fiche (maison, appartement, logement provisoire,
 * stockage, barque…) et des véhicules. Simple comme un document : une page par bien, des pièces qu'on crée et qu'on
 * aménage (lignes de texte tapées + Entrée, ou vrais objets déposés), un plan par étage où l'on dessine les pièces et
 * place les meubles, et une navigation à gauche (arborescence + recherche) pour ne jamais avoir à faire défiler. */
import { MOD } from "./data.js";
import { esc, withLock, actorLock, gmDo, onGm, myCharacters, vehicles, isVehicle, moveItem, qtyOf, usersOwning, log, cargoItems } from "./core.js";
import { ENVS } from "./data.js";
import { putInService, newVehicle, Garage } from "./garage.js";

const { ApplicationV2, DialogV2 } = foundry.applications.api;
export const PTYPE = `${MOD}.property`;
export const isProperty = a => a?.type === PTYPE;
const fa = i => `<i class="fa-solid ${i}"></i>`;
const rid = () => foundry.utils.randomID(8);
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const COLS = 24, ROWS = 14;

export const KINDS = {
  house: { n: "Maison", i: "fa-house", c: "#3ccbff" }, flat: { n: "Appartement", i: "fa-building", c: "#7c8cff" }, temp: { n: "Logement provisoire", i: "fa-campground", c: "#ffb070" },
  land: { n: "Terrain", i: "fa-mountain-sun", c: "#8bd450" }, base: { n: "Base / QG", i: "fa-chess-rook", c: "#ff5d6c" }, storage: { n: "Stockage", i: "fa-warehouse", c: "#c9a96a" },
  boat: { n: "Embarcation légère", i: "fa-sailboat", c: "#2fd8ff" }, misc: { n: "Divers", i: "fa-box", c: "#b48cff" }
};
export const STATUS = { owned: { n: "Acheté", c: "#4ade80" }, rented: { n: "Loué", c: "#38bdf8" }, temp: { n: "Provisoire", c: "#ffb070" }, lent: { n: "Prêté", c: "#c084fc" }, squat: { n: "Occupé sans titre", c: "#f87171" } };
export const ROOMK = {
  entree: { n: "Entrée", i: "fa-door-open", c: "#8fb8ff" }, salon: { n: "Salon", i: "fa-couch", c: "#3ccbff" }, cuisine: { n: "Cuisine", i: "fa-utensils", c: "#ffb070" },
  chambre: { n: "Chambre", i: "fa-bed", c: "#c084fc" }, sdb: { n: "Salle d'eau", i: "fa-bath", c: "#22d3ee" }, bureau: { n: "Bureau", i: "fa-book-open", c: "#a3e635" },
  atelier: { n: "Atelier", i: "fa-hammer", c: "#f59e0b" }, stock: { n: "Réserve", i: "fa-box-archive", c: "#94a3b8" }, jardin: { n: "Extérieur", i: "fa-tree", c: "#4ade80" },
  garage: { n: "Garage", i: "fa-warehouse", c: "#64748b" }, pont: { n: "Pont", i: "fa-anchor", c: "#38bdf8" }, cale: { n: "Cale / coffre", i: "fa-boxes-stacked", c: "#a78bfa" },
  couloir: { n: "Couloir", i: "fa-arrows-left-right", c: "#64748b" }, poste: { n: "Poste de pilotage", i: "fa-gauge-high", c: "#5eead4" }, cabine: { n: "Cabine / quartiers", i: "fa-person-shelter", c: "#f0abfc" },
  moteur: { n: "Machines", i: "fa-gears", c: "#fb923c" }, arme: { n: "Armement", i: "fa-crosshairs", c: "#f87171" }, autre: { n: "Autre", i: "fa-square", c: "#7dd3fc" }
};
const RM = (name, kind, x, y, w, h, floor = "f0") => ({ id: rid(), name, kind, floor, x, y, w, h, notes: "", lines: [] });
const F0 = () => [{ id: "f0", name: "Rez-de-chaussée" }];
/* 2.3 — taille du plan par étage, formes de pièces, coque */
const MAXD = 400, CELL = 28;
export const PLAN_PRESETS = { "Logements": [["Tente / chambre", 16, 10], ["Studio", 20, 12], ["Appartement", 24, 14], ["Maison", 32, 18], ["Grande maison", 40, 24], ["Manoir", 56, 32], ["Base / QG", 64, 36], ["Terrain", 80, 48], ["Domaine", 120, 70]],
  "Véhicules": [["Moto / barque", 12, 6], ["Voiture", 16, 8], ["Camion", 24, 10], ["Bateau", 32, 14], ["Navire", 56, 22], ["Navette", 30, 16], ["Vaisseau", 64, 30], ["Croiseur", 120, 48], ["Station", 160, 90]] };
const KIND_DIM = { temp: [16, 10], flat: [24, 14], house: [32, 18], base: [64, 36], storage: [40, 24], land: [80, 48], boat: [20, 10], misc: [24, 14] };
const VSIZE_DIM = { xs: [12, 6], s: [16, 8], m: [32, 14], l: [56, 22], xl: [120, 48] };
const baseDim = a => isVehicle(a) ? (VSIZE_DIM[a.system.size] || [24, 14]) : (KIND_DIM[a.system.kind] || [24, 14]);
const clampD = v => Math.max(4, Math.min(MAXD, Math.round(+v || 0)));
const dimOf = f => ({ cols: clampD(f?.cols || 24), rows: clampD(f?.rows || 14) });
const snap = v => Math.round(v * 2) / 2;
const bboxOf = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(.5, Math.max(...xs) - x), h: Math.max(.5, Math.max(...ys) - y) }; };
/* étendue occupée sur un étage : le plan ne peut pas être réduit sous les pièces ni sous la coque */
const usedExt = (s, fid) => { let c = 4, r = 4; for (const x of s.rooms || []) if ((x.floor || "f0") === fid) { c = Math.max(c, Math.ceil(x.x + x.w)); r = Math.max(r, Math.ceil(x.y + x.h)); }
  const f = (s.floors || []).find(z => z.id === fid); for (const q of f?.shell || []) { c = Math.max(c, Math.ceil(q[0])); r = Math.max(r, Math.ceil(q[1])); } return { cols: c, rows: r }; };
export const SHAPES = { rect: ["Rectangle", "fa-square"], round: ["Arrondi", "fa-square-full"], ellipse: ["Ellipse", "fa-circle"], poly: ["Forme libre", "fa-draw-polygon"] };
export const TEMPLATES = {
  vide: { n: "Vide (je crée les pièces moi-même)", make: () => ({ floors: F0(), rooms: [] }) },
  studio: { n: "Studio", make: () => ({ floors: F0(), rooms: [RM("Pièce principale", "salon", 4, 2, 11, 9), RM("Coin cuisine", "cuisine", 15, 2, 5, 5), RM("Salle d'eau", "sdb", 15, 7, 5, 4)] }) },
  maison: { n: "Maison", make: () => ({ floors: [{ id: "f0", name: "Rez-de-chaussée" }, { id: "f1", name: "Étage" }], rooms: [RM("Entrée", "entree", 2, 5, 4, 4), RM("Salon", "salon", 6, 2, 9, 7), RM("Cuisine", "cuisine", 15, 2, 7, 6), RM("Salle d'eau", "sdb", 15, 8, 4, 4), RM("Chambre", "chambre", 4, 2, 8, 7, "f1"), RM("Chambre d'ami", "chambre", 12, 2, 7, 7, "f1"), RM("Jardin", "jardin", 6, 9, 9, 4)] }) },
  appartement: { n: "Appartement", make: () => ({ floors: F0(), rooms: [RM("Entrée", "entree", 3, 5, 3, 3), RM("Séjour", "salon", 6, 2, 9, 7), RM("Cuisine", "cuisine", 15, 2, 5, 5), RM("Chambre", "chambre", 15, 7, 6, 5), RM("Salle de bain", "sdb", 6, 9, 5, 3)] }) },
  barque: { n: "Barque / petit bateau", make: () => ({ floors: F0(), rooms: [RM("Pont", "pont", 5, 4, 12, 5), RM("Coffre", "cale", 17, 5, 3, 3)] }) },
  tente: { n: "Tente / campement", make: () => ({ floors: F0(), rooms: [RM("Tente", "chambre", 8, 4, 7, 6), RM("Feu de camp", "jardin", 15, 6, 4, 4)] }) },
  entrepot: { n: "Entrepôt / stockage", make: () => ({ floors: F0(), rooms: [RM("Allée A", "stock", 3, 2, 18, 4), RM("Allée B", "stock", 3, 7, 18, 4)] }) },
  base: { n: "Base / QG", make: () => ({ floors: F0(), rooms: [RM("Salle commune", "salon", 7, 3, 10, 7), RM("Armurerie", "atelier", 2, 3, 5, 5), RM("Dortoir", "chambre", 17, 3, 5, 7), RM("Réserve", "stock", 2, 8, 5, 4)] }) }
};
/* zones de départ d'un véhicule, selon son milieu */
const VTEMPLATES = {
  land: () => [RM("Poste de conduite", "poste", 4, 3, 6, 6), RM("Habitacle", "cabine", 10, 3, 7, 6), RM("Coffre", "cale", 17, 3, 4, 6)],
  sea: () => [RM("Pont", "pont", 3, 2, 14, 5), RM("Barre", "poste", 17, 2, 4, 5), RM("Cabine", "cabine", 3, 7, 7, 5), RM("Cale", "cale", 10, 7, 11, 5)],
  air: () => [RM("Poste de pilotage", "poste", 2, 4, 5, 6), RM("Cabine", "cabine", 7, 4, 8, 6), RM("Soute", "cale", 15, 4, 5, 6), RM("Machines", "moteur", 20, 5, 3, 4)],
  space: () => [RM("Poste de pilotage", "poste", 2, 4, 5, 6), RM("Quartiers", "cabine", 7, 2, 7, 5), RM("Armement", "arme", 7, 7, 7, 5), RM("Soute", "cale", 14, 3, 6, 8), RM("Machines", "moteur", 20, 4, 3, 6)]
};
/* silhouettes de départ (coque) selon le milieu, sur une grille 24 × 14 */
const VSHELL = {
  land: [[3, 2.5], [18, 2.5], [21.5, 3.5], [22.5, 6], [21.5, 9.5], [3, 9.5], [2, 8], [2, 4]],
  sea: [[2, 1], [17, 1], [21, 3], [23.5, 7], [21, 11], [17, 13], [2, 13], [1, 10], [1, 4]],
  air: [[1, 6], [2, 4], [14, 3.5], [16.5, 0.5], [18.5, 0.5], [18.5, 3.5], [23, 4], [23.5, 7], [23, 10], [18.5, 10.5], [18.5, 13.5], [16.5, 13.5], [14, 10.5], [2, 10], [1, 8]],
  space: [[1, 7], [3, 3], [7, 1.5], [14, 1.5], [20, 2.5], [23.5, 5], [23.5, 9], [20, 11.5], [14, 12.5], [7, 12.5], [3, 11]]
};
/* montant court : 1 250 → 1,25 k ; 3 400 000 → 3,4 M */
const fmtShort = v => { const n = Number(String(v ?? "").replace(/[\s ]/g, "").replace(",", ".")); if (!String(v ?? "").trim() || !Number.isFinite(n)) return ""; const a = Math.abs(n);
  const f = (x, u) => `${(Math.round(x * 100) / 100).toLocaleString("fr-FR")} ${u}`; return a >= 1e9 ? f(n / 1e9, "Md") : a >= 1e6 ? f(n / 1e6, "M") : a >= 1e4 ? f(n / 1e3, "k") : n.toLocaleString("fr-FR"); };
/* icône d'un meuble ou d'un objet d'après son nom */
const FURN = [[/\blits?\b|matelas|couchette|hamac/, "fa-bed"], [/canap|sofa|banquette|divan/, "fa-couch"], [/chaise|tabouret|fauteuil|si[eè]ge/, "fa-chair"], [/table|bureau|comptoir|[ée]tabli/, "fa-table-cells-large"],
  [/armoire|placard|commode|penderie|buffet/, "fa-door-closed"], [/coffre|caisse|malle|bo[iî]te|carton/, "fa-box"], [/lampe|lanterne|bougie|lustre|lumi/, "fa-lightbulb"], [/tapis/, "fa-rug"],
  [/plante|fleur|pot\b|arbre/, "fa-seedling"], [/chemin[ée]e|po[eê]le|four|brasero|feu/, "fa-fire"], [/baignoire|bain/, "fa-bath"], [/douche/, "fa-shower"], [/frigo|r[ée]frig|glaci/, "fa-snowflake"],
  [/livre|biblioth|[ée]tag[eè]re|grimoire/, "fa-book"], [/t[ée]l[ée]|[ée]cran|tv\b/, "fa-tv"], [/ordi|terminal|console/, "fa-computer"], [/miroir/, "fa-circle-half-stroke"], [/rame|aviron/, "fa-water"],
  [/voile|m[aâ]t/, "fa-wind"], [/filet|canne|p[eê]che/, "fa-fish"], [/[ée]p[ée]e|lame|hache|arme|fusil|arc\b/, "fa-khanda"], [/outil|marteau|cl[ée]\b|scie/, "fa-screwdriver-wrench"], [/vaisselle|assiette|casserole|marmite/, "fa-utensils"],
  [/v[eê]tement|habit|manteau|robe/, "fa-shirt"], [/argent|or\b|bourse|tr[ée]sor/, "fa-coins"], [/potion|fiole|alambic/, "fa-flask"]];
export const furnIcon = t => { const s = norm(t); for (const [re, i] of FURN) if (re.test(s)) return i; return "fa-circle-dot"; };
/* « Canapé ×2 », « 2 chaises », « chaise x3 » → { t, q } */
function parseLine(raw) { let t = String(raw || "").trim(), q = 1; let m = t.match(/^(.*?)[\s]*[×x\*]\s*(\d+)$/i); if (m && m[1]) { t = m[1].trim(); q = +m[2]; } else if ((m = t.match(/^(\d+)\s+(.+)$/))) { q = +m[1]; t = m[2].trim(); } t = t.charAt(0).toUpperCase() + t.slice(1); return { t, q: Math.max(1, q || 1) }; }

/* ── données ── */
export const properties = () => game.actors.filter(isProperty);
const visible = a => game.user.isGM || a.testUserPermission(game.user, "LIMITED");
const parties = () => { try { return globalThis.MANHWA?.parties?.() || []; } catch (e) { return []; } };
const partyOf = id => parties().find(p => p.id === id);
const actorOf = uuid => { try { return fromUuidSync(uuid); } catch (e) { return null; } };
const roomOf = (s, id) => (s.rooms || []).find(r => r.id === id);
/* 2.4.0 : ordre d'empilement des formes sur le plan (une forme peut passer par-dessus une autre, ou derrière) */
const zSorted = L => L.map((r, i) => [r, Number(r.z) || 0, i]).sort((x, y) => x[1] - y[1] || x[2] - y[2]).map(x => x[0]);
const zRank = (L, r) => zSorted(L).indexOf(r);
const ZBTNS = id => [["top", "fa-angles-up", "Tout devant (premier plan)"], ["up", "fa-angle-up", "Un cran devant"], ["down", "fa-angle-down", "Un cran derrière"], ["bottom", "fa-angles-down", "Tout derrière (arrière-plan)"]].map(([k, i, n]) => `<a class="lg-x lg-z" data-act="zord" data-z="${k}" data-room="${id}" data-tooltip="${n}"><i class="fa-solid ${i}"></i></a>`).join("");
const linesOf = (s, id) => id === "_g" ? (s.general ||= []) : (roomOf(s, id)?.lines || null);
const roomItems = (a, id) => (isVehicle(a) ? cargoItems(a) : [...a.items]).filter(i => (i.flags?.[MOD]?.room || "_g") === id);
function holderLabel(h) { if (h.k === "party") return partyOf(h.id)?.name || h.name || "Groupe"; return actorOf(h.id)?.name || h.name || "Personnage"; }
/* utilisateurs qui ont la main sur un bien : gestionnaire + joueurs des personnages détenteurs + joueurs des groupes détenteurs */
function editorsOf(holders, owner) {
  const ids = new Set(owner ? [owner] : []);
  for (const h of holders || []) { const actors = h.k === "party" ? (partyOf(h.id)?.members || []).map(m => actorOf(m.uuid)).filter(Boolean) : [actorOf(h.id)].filter(Boolean); for (const a of actors) for (const u of usersOwning(a)) ids.add(u.id); }
  return [...ids];
}
/** lit, modifie et réécrit le système d'un bien sous verrou ; fn(s) renvoie la mise à jour (ou false) */
async function mut(a, fn) { return actorLock(a, async () => { a = game.actors.get(a.id) || a; const s = foundry.utils.deepClone(a.system.toObject()); const upd = fn(s); if (upd === false || !upd) return null; return a.update(upd); }); }
const rl = s => ({ "system.rooms": s.rooms, "system.general": s.general });

/* ── relais MJ : création, suppression, droits recalculés depuis les détenteurs ── */
async function propFolder() {
  return withLock(`folder:${MOD}:prop`, async () => { let f = game.folders.find(x => x.type === "Actor" && x.getFlag(MOD, "props")); if (f) return f;
    return Folder.create({ name: "Logement", type: "Actor", color: "#1a7a5a", flags: { [MOD]: { props: true } } }); });
}
onGm("propCreate", async ({ name, kind, status, template, holders, place, owner: ownerIn }, userId) => {
  const user = game.users.get(userId); holders = (holders || []).filter(h => h && h.id && (h.k === "actor" || h.k === "party"));
  if (!user.isGM) { const mine = new Set(myCharacters(user).map(c => c.uuid)); const myParties = new Set(parties().filter(p => p.members.some(m => mine.has(m.uuid))).map(p => p.id));
    if (holders.some(h => h.k === "actor" ? !mine.has(h.id) : !myParties.has(h.id))) return { ok: false, msg: "Tu ne peux attribuer un bien qu'à tes personnages ou à tes groupes." }; }
  const owner = user.isGM ? (ownerIn || editorsOf(holders, "").find(id => !game.users.get(id)?.isGM) || "") : userId;
  holders = holders.map(h => ({ ...h, name: holderLabel(h) }));
  const T = (TEMPLATES[template] || TEMPLATES.vide).make(); const ownership = { default: 0 }; for (const id of editorsOf(holders, owner)) ownership[id] = 3;
  const folder = await propFolder(); const nm = String(name || "").trim() || KINDS[kind]?.n || "Bien";
  const a = await Actor.create({ name: nm, type: PTYPE, img: "icons/svg/house.svg", folder: folder.id, ownership, system: { kind: KINDS[kind] ? kind : "house", status: STATUS[status] ? status : "owned", owner, holders, place: place || {}, floors: T.floors, rooms: T.rooms, log: [{ t: Date.now(), u: user.name, k: "create", txt: `${nm} enregistré par ${user.name}.` }] } });
  return { ok: true, msg: `${nm} est enregistré.`, value: a.uuid };
});
onGm("propDelete", async ({ uuid }, userId) => {
  const a = await fromUuid(uuid); const u = game.users.get(userId); if (!isProperty(a)) return { ok: false, msg: "Introuvable." };
  if (!u.isGM && a.system.owner !== userId) return { ok: false, msg: "Seul le gestionnaire du bien ou le MJ peut le supprimer." };
  if (a.items.size && !u.isGM) return { ok: false, msg: "Reprends d'abord les objets déposés dans ce bien." };
  const nm = a.name; await a.delete(); return { ok: true, msg: `${nm} retiré du registre.` };
});
onGm("propHolders", async ({ uuid, holders }, userId) => {
  const a = await fromUuid(uuid); const u = game.users.get(userId); if (!isProperty(a)) return { ok: false, msg: "Introuvable." };
  if (!u.isGM && a.system.owner !== userId && !a.testUserPermission(u, "OWNER")) return { ok: false, msg: "Tu n'as pas la main sur ce bien." };
  holders = (holders || []).filter(h => h && h.id).map(h => ({ k: h.k === "party" ? "party" : "actor", id: h.id, name: holderLabel(h) }));
  const upd = { "system.holders": holders }; for (const id of editorsOf(holders, a.system.owner)) if ((a.ownership[id] ?? 0) < 3) upd[`ownership.${id}`] = 3;
  await a.update(upd); await log(a, "access", `Détenteurs : ${holders.map(h => h.name).join(", ") || "aucun"}.`); return { ok: true, msg: "Détenteurs mis à jour." };
});

/* ── lieux de la Carte Stellaire ── */
let PLACES = null;
async function placesIndex() {
  if (PLACES) return PLACES; PLACES = [];
  try { const U = await (await fetch(`modules/carte-stellaire-manhwa/data/universe.json`)).json();
    for (const [gid, g] of Object.entries(U.gal || {})) for (const s of g.systems || []) for (const p of s.planets || []) {
      const add = (body, moon) => { for (const pl of body.places || []) PLACES.push({ label: `${pl.n} — ${body.n}${moon != null ? ` (lune de ${p.n})` : ""} · ${s.n} · ${g.n}`, place: pl.n, gal: gid, sys: s.id, pl: p.id, moon, key: norm(`${pl.n} ${body.n} ${s.n} ${g.n}`) }); };
      add(p, null); (p.moons || []).forEach((m, i) => add(m, i)); }
  } catch (e) { console.warn(MOD, "lieux de la carte indisponibles", e); }
  return PLACES;
}
const csmApi = () => { const m = game.modules.get("carte-stellaire-manhwa"); return m?.active ? m.api : null; };
async function pickPlace(cur) {
  const list = await placesIndex();
  const r = await DialogV2.wait({ window: { title: "Où se trouve ce bien ?", icon: "fa-solid fa-location-dot" }, classes: ["vm-dialog"], position: { width: 620 },
    content: `<div class="vm-dlg lg-pp"><label>Nom libre (affiché)<input name="label" value="${esc(cur?.label || "")}" placeholder="ex. Cabane près du lac, quartier des Docks…"></label>${list.length ? `<label>Ou un lieu de la Carte Stellaire<input class="lg-ppq" placeholder="Chercher un lieu, une planète…" autocomplete="off"></label><div class="lg-ppr"></div><input type="hidden" name="pick" value="">` : `<p class="vm-hint">Carte Stellaire introuvable : seul le nom libre est disponible.</p>`}</div>`,
    render: (ev, dlg) => { const root = dlg.element ?? dlg; const q = root.querySelector(".lg-ppq"), out = root.querySelector(".lg-ppr"), hid = root.querySelector('[name="pick"]'), lab = root.querySelector('[name="label"]'); if (!q) return;
      const draw = () => { const v = norm(q.value).trim(); const res = v.length < 2 ? [] : list.filter(x => x.key.includes(v)).slice(0, 30); out.innerHTML = res.map(x => `<a data-i="${list.indexOf(x)}"${hid.value === String(list.indexOf(x)) ? ' class="on"' : ""}>${fa("fa-location-dot")} ${esc(x.label)}</a>`).join("") || (v.length >= 2 ? `<small>Aucun lieu.</small>` : ""); };
      q.addEventListener("input", draw); out.addEventListener("click", e => { const a = e.target.closest("[data-i]"); if (!a) return; hid.value = a.dataset.i; const x = list[+a.dataset.i]; if (!lab.value.trim() || lab.dataset.auto) { lab.value = x.place; lab.dataset.auto = "1"; } draw(); }); },
    buttons: [{ action: "ok", label: "Valider", icon: "fa-solid fa-check", default: true, callback: (e, b) => { const f = b.form; const i = f.querySelector('[name="pick"]')?.value; const x = i ? list[+i] : null; const label = f.elements.label.value.trim(); return x ? { label: label || x.place, gal: x.gal, sys: x.sys, pl: x.pl, moon: x.moon, place: x.place, full: x.label } : { label }; } }, { action: "clear", label: "Effacer", icon: "fa-solid fa-eraser" }, { action: "no", label: "Annuler" }], rejectClose: false });
  if (r === "clear") return {}; if (!r || r === "no") return null; return r;
}

/* ── dialogues ── */
function holderChoices(selected = []) {
  const sel = new Set(selected.map(h => `${h.k}:${h.id}`)); const gm = game.user.isGM;
  const chars = gm ? game.actors.filter(a => a.type === "character" && a.hasPlayerOwner) : myCharacters();
  const mine = new Set(myCharacters().map(c => c.uuid)); const ps = gm ? parties() : parties().filter(p => p.members.some(m => mine.has(m.uuid)));
  const box = (k, id, name, img) => `<label class="lg-hc"><input type="checkbox" name="h" value="${k}:${esc(id)}" ${sel.has(`${k}:${id}`) ? "checked" : ""}>${img ? `<img src="${esc(img)}">` : fa(k === "party" ? "fa-users" : "fa-user")}<span>${esc(name)}</span></label>`;
  return `<div class="lg-hgrid"><div><h5>${fa("fa-user")} Personnages</h5>${chars.map(c => box("actor", c.uuid, c.name, c.img)).join("") || `<small>Aucun personnage.</small>`}</div><div><h5>${fa("fa-users")} Groupes</h5>${ps.map(p => box("party", p.id, p.name)).join("") || `<small>Aucun groupe.</small>`}</div></div>`;
}
const readHolders = form => [...form.querySelectorAll('input[name="h"]:checked')].map(i => { const [k, ...rest] = i.value.split(":"); return { k, id: rest.join(":") }; });
export async function newProperty(pre = {}) {
  const r = await DialogV2.wait({ window: { title: "Nouveau bien", icon: "fa-solid fa-house-chimney" }, classes: ["vm-dialog"], position: { width: 600 },
    content: `<div class="vm-dlg lg-new"><div class="vm-grid3"><label style="grid-column:1/-1">Nom<input name="name" placeholder="ex. Maison du lac, Chambre à l'auberge, La Barque…" autofocus></label>
      <label>Type<select name="kind">${Object.entries(KINDS).map(([k, x]) => `<option value="${k}" ${k === (pre.kind || "house") ? "selected" : ""}>${x.n}</option>`).join("")}</select></label>
      <label>Statut<select name="status">${Object.entries(STATUS).map(([k, x]) => `<option value="${k}">${x.n}</option>`).join("")}</select></label>
      <label>Pièces de départ<select name="template">${Object.entries(TEMPLATES).map(([k, x]) => `<option value="${k}">${x.n}</option>`).join("")}</select></label></div>
      <h4>${fa("fa-key")} À qui est ce bien ? <small>(un personnage, un groupe, ou les deux)</small></h4>${holderChoices(pre.holders || [])}</div>`,
    render: (ev, dlg) => { const root = dlg.element ?? dlg; const k = root.querySelector('[name="kind"]'), t = root.querySelector('[name="template"]'); const map = { house: "maison", flat: "appartement", temp: "tente", storage: "entrepot", boat: "barque", base: "base", land: "vide", misc: "vide" }; const sync = () => { t.value = map[k.value] || "vide"; }; k.addEventListener("change", sync); sync(); },
    buttons: [{ action: "ok", label: "Créer", icon: "fa-solid fa-check", default: true, callback: (e, b) => { const f = b.form.elements; return { name: f.name.value.trim(), kind: f.kind.value, status: f.status.value, template: f.template.value, holders: readHolders(b.form) }; } }, { action: "no", label: "Annuler" }], rejectClose: false });
  if (!r || r === "no") return null; const uuid = await gmDo("propCreate", r); if (uuid) Logement.open(uuid); return uuid;
}
async function askRoom(cur = {}) {
  const r = await DialogV2.wait({ window: { title: cur.id ? "Pièce" : "Nouvelle pièce", icon: "fa-solid fa-vector-square" }, classes: ["vm-dialog"], position: { width: 420 },
    content: `<div class="vm-dlg vm-grid3"><label style="grid-column:1/-1">Nom<input name="name" value="${esc(cur.name || "")}" placeholder="ex. Chambre, Cellier, Pont avant…" autofocus></label><label style="grid-column:1/-1">Genre<select name="kind">${Object.entries(ROOMK).map(([k, x]) => `<option value="${k}" ${k === (cur.kind || "autre") ? "selected" : ""}>${x.n}</option>`).join("")}</select></label></div>`,
    render: (ev, dlg) => { const root = dlg.element ?? dlg; const n = root.querySelector('[name="name"]'), k = root.querySelector('[name="kind"]'); k.addEventListener("change", () => { if (!n.value.trim() || n.dataset.auto) { n.value = ROOMK[k.value].n; n.dataset.auto = "1"; } }); },
    buttons: [{ action: "ok", label: "Valider", icon: "fa-solid fa-check", default: true, callback: (e, b) => ({ name: b.form.elements.name.value.trim(), kind: b.form.elements.kind.value }) }, { action: "no", label: "Annuler" }], rejectClose: false });
  if (!r || r === "no") return null; if (!r.name) r.name = ROOMK[r.kind]?.n || "Pièce"; return r;
}
async function askText(title, label, value = "") {
  const r = await DialogV2.prompt({ window: { title }, classes: ["vm-dialog"], content: `<div class="vm-dlg"><label>${esc(label)}<input name="v" value="${esc(value)}" autofocus></label></div>`, ok: { label: "Valider", callback: (e, b) => b.form.elements.v.value.trim() }, rejectClose: false });
  return r || null;
}
async function deposit(a, room) {
  const chars = game.user.isGM ? game.actors.filter(x => x.type === "character" && x.hasPlayerOwner) : myCharacters();
  const list = []; for (const c of chars) for (const it of c.items) list.push({ it, c });
  if (!list.length) return ui.notifications.info("Aucun objet sur tes personnages.");
  const r = await DialogV2.wait({ window: { title: "Déposer un objet", icon: "fa-solid fa-box-open" }, classes: ["vm-dialog"], position: { width: 560, height: 560 },
    content: `<div class="vm-dlg"><input class="lg-dq" placeholder="Filtrer…" autocomplete="off"><div class="vm-picks lg-dlist">${list.map((x, i) => `<label class="vm-pick" data-k="${esc(norm(x.it.name + " " + x.c.name))}"><input type="radio" name="pick" value="${i}" ${i ? "" : "checked"}><img src="${esc(x.it.img)}"><span><b>${esc(x.it.name)}</b><small>×${qtyOf(x.it)} · sur ${esc(x.c.name)}</small></span></label>`).join("")}</div><label>Quantité<input type="number" name="qty" min="1" value="1"></label></div>`,
    render: (ev, dlg) => { const root = dlg.element ?? dlg; const q = root.querySelector(".lg-dq"); q?.addEventListener("input", () => { const v = norm(q.value); root.querySelectorAll(".lg-dlist .vm-pick").forEach(l => { l.style.display = !v || l.dataset.k.includes(v) ? "" : "none"; }); }); },
    buttons: [{ action: "ok", label: "Déposer", icon: "fa-solid fa-box-open", default: true, callback: (e, b) => ({ i: +b.form.elements.pick.value, qty: Math.max(1, +b.form.elements.qty.value || 1) }) }, { action: "no", label: "Annuler" }], rejectClose: false });
  if (!r || r === "no") return; const x = list[r.i]; if (!x) return;
  const made = await moveItem(x.it, a, Math.min(r.qty, qtyOf(x.it) || 1), { room }); if (made) await log(a, "deposit", `${x.it.name} ×${Math.min(r.qty, qtyOf(x.it) || 1)} déposé (${roomName(a.system, room)}) par ${game.user.name}.`);
}
const roomName = (s, id) => id === "_g" ? "contenu général" : (roomOf(s, id)?.name || "pièce");
async function takeBack(a, item) {
  const chars = game.user.isGM ? game.actors.filter(x => x.type === "character" && x.hasPlayerOwner) : myCharacters(); if (!chars.length) return ui.notifications.warn("Aucun personnage pour reprendre l'objet.");
  const r = await DialogV2.wait({ window: { title: `Reprendre ${item.name}`, icon: "fa-solid fa-hand-holding" }, classes: ["vm-dialog"], position: { width: 440 },
    content: `<div class="vm-dlg"><label>Sur quel personnage ?<select name="c">${chars.map((c, i) => `<option value="${i}">${esc(c.name)}</option>`).join("")}</select></label><label>Quantité<input type="number" name="qty" min="1" max="${qtyOf(item)}" value="${qtyOf(item)}"></label></div>`,
    buttons: [{ action: "ok", label: "Reprendre", icon: "fa-solid fa-hand-holding", default: true, callback: (e, b) => ({ c: +b.form.elements.c.value, qty: Math.max(1, +b.form.elements.qty.value || 1) }) }, { action: "no", label: "Annuler" }], rejectClose: false });
  if (!r || r === "no") return; const c = chars[r.c]; if (!c) return; const room = item.flags?.[MOD]?.room || "_g";
  await moveItem(item, c, r.qty, { room: null }); await log(a, "withdraw", `${item.name} ×${r.qty} repris (${roomName(a.system, room)}) par ${c.name}.`);
}


/* ── 2.5.0 : repère de chaque meuble / objet sur le plan ── */
export const MKS = { none: ["Aucun repère", "fa-eye-slash"], dot: ["Point", "fa-circle-dot"], icon: ["Icône", "fa-icons"], rect: ["Rectangle", "fa-square"], round: ["Arrondi", "fa-square-full"], ellipse: ["Rond", "fa-circle"] };
const isShp = m => m === "rect" || m === "round" || m === "ellipse";
const itF = it => it?.flags?.[MOD] || {};
const mkOfLine = l => MKS[l?.mk] ? l.mk : "icon";
const mkOfItem = it => MKS[itF(it).mk] ? itF(it).mk : "none";
const refOf = el => ({ k: el.dataset.k === "item" ? "item" : "line", id: el.dataset.id, room: el.dataset.room });
const SIDE_KEY = "vm-lg-side";
const sideLoad = () => { try { const v = localStorage.getItem(SIDE_KEY); return ["open", "auto", "closed"].includes(v) ? v : "open"; } catch (e) { return "open"; } };
const sideSave = v => { try { localStorage.setItem(SIDE_KEY, v); } catch (e) {} };

/* ══════════ la fenêtre ══════════ */
export class Logement extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "vm-logement", classes: ["vm-sheet", "vm-logement", "ms-fsable", "ms-fs-band"], window: { title: "Domaine", icon: "fa-solid fa-house-chimney", resizable: true }, position: { width: 1280, height: 820 } };
  static open(sel) { const g = foundry.applications.instances.get("vm-logement") || new Logement(); if (sel) { g.sel = sel; g.flash = null; g.view = "plan"; } g.render({ force: true }); return g; }
  sel = null; q = ""; floor = {}; draw = false; expand = new Set(); flash = null; busy = false; pend = false;
  view = "plan"; sideMode = sideLoad(); ffold = new Set(); rfold = new Set(); ropt = new Set(); vpKeep = {};

  get doc() { const a = this.sel ? actorOf(this.sel) : null; return a && (isProperty(a) || isVehicle(a)) && visible(a) ? a : null; }
  zoom = {}; hl = null;

  async _renderHTML() {
    const gm = game.user.isGM; const a = this.doc; const sm = this.sideMode;
    const fb = (act, icon, tip, c, plus = false) => `<a class="lg-fb" style="--bc:${c}" data-act="${act}" data-tooltip="${tip}">${fa(icon)}${plus ? `<i class="fa-solid fa-plus lg-fbp"></i>` : ""}</a>`;
    const foot = `<div class="lg-foot">${fb("newprop", "fa-house-chimney", "Nouveau bien", "#3ddc84", true)}${fb("service", "fa-anchor", "Mettre un véhicule en service", "#38d6ff")}${gm ? fb("newveh", "fa-sailboat", "Nouveau véhicule (MJ)", "#b46bff", true) + fb("vset", "fa-gear", "Réglages des véhicules", "#9fb0d4") : ""}</div>`;
    const all = [...properties().filter(visible), ...vehicles().filter(visible)];
    const band = `<div class="lg-band">${sm === "closed" ? `<a class="lg-bi open" data-act="side" data-m="open" data-tooltip="Ouvrir la colonne">${fa("fa-angles-right")}</a>` : `<span class="lg-bi hint">${fa("fa-angles-right")}</span>`}
      <div class="lg-blist">${all.map(x => { const V = isVehicle(x); const c = V ? (ENVS[x.system.env] || ENVS.land).color : (KINDS[x.system.kind] || KINDS.misc).c; const i = V ? (ENVS[x.system.env] || ENVS.land).icon : (KINDS[x.system.kind] || KINDS.misc).i;
        return `<a class="lg-bi${this.sel === x.uuid ? " on" : ""}" style="--kc:${c}" data-act="sel" data-uuid="${x.uuid}" data-tooltip="${esc(x.name)}">${fa(i)}</a>`; }).join("")}</div>${foot}</div>`;
    const pins = [["open", "fa-thumbtack", "Épinglée ouverte"], ["auto", "fa-arrow-pointer", "Repliée : s'ouvre au survol"], ["closed", "fa-lock", "Repliée et verrouillée"]].map(([m, i, n]) => `<a class="${sm === m ? "on" : ""}" data-act="side" data-m="${m}" data-tooltip="${n}">${fa(i)}</a>`).join("");
    const side = `<aside class="lg-side"><div class="lg-shd"><b>${fa("fa-house-chimney")} Registre</b><small>${all.length}</small><span class="lg-pins">${pins}</span></div>
      <div class="lg-search">${fa("fa-magnifying-glass")}<input class="lg-q" value="${esc(this.q)}" placeholder="Chercher un meuble, une pièce, un objet…" autocomplete="off"></div><div class="lg-tree">${this.#side()}</div>${foot}</aside>`;
    return `<div class="vm-wrap lg-wrap lg5 side-${sm}"><div class="lg-cols"><div class="lg-sw">${band}${side}</div>
      <main class="lg-main">${a ? this.#page(a) : this.#home()}</main></div></div>`;
  }
  /* ── colonne de gauche : arborescence ou résultats de recherche ── */
  #side() { return this.q.trim().length >= 2 ? this.#results() : this.#tree(); }
  #tree() {
    const gm = game.user.isGM; const props = properties().filter(visible); const vs = vehicles().filter(visible); const shown = new Set();
    const node = a => { shown.add(a.id); const s = a.system, on = this.sel === a.uuid, open = on || this.expand.has(a.uuid); const k = KINDS[s.kind] || KINDS.misc;
      const rooms = (s.rooms || []).slice().sort((x, y) => (x.floor || "").localeCompare(y.floor || "") || (x.y - y.y) || (x.x - y.x));
      return `<div class="lg-n${on ? " on" : ""}" style="--kc:${k.c}"><a class="lg-nh" data-act="sel" data-uuid="${a.uuid}">${fa(k.i)}<span>${esc(a.name)}</span><em style="--sc:${STATUS[s.status]?.c || "#888"}"></em>${rooms.length ? `<i class="lg-tw fa-solid fa-chevron-${open ? "down" : "right"}" data-act="tw" data-uuid="${a.uuid}"></i>` : ""}</a>
        ${open && rooms.length ? `<div class="lg-nr">${rooms.map(r => `<a data-act="jump" data-uuid="${a.uuid}" data-room="${r.id}" style="--rc:${ROOMK[r.kind]?.c || "#7dd3fc"}">${fa(ROOMK[r.kind]?.i || "fa-square")}<span>${esc(r.name)}</span><small>${(r.lines || []).length + roomItems(a, r.id).length || ""}</small></a>`).join("")}</div>` : ""}</div>`; };
    const vnode = v => { shown.add(v.id); const on = this.sel === v.uuid, E = ENVS[v.system.env] || ENVS.land; return `<div class="lg-n${on ? " on" : ""}" style="--kc:${E.color}"><a class="lg-nh" data-act="sel" data-uuid="${v.uuid}">${fa(E.icon)}<span>${esc(v.name)}</span><small>${v.system.owner ? esc(game.users.get(v.system.owner)?.name || "") : ""}</small></a></div>`; };
    const sec = (title, icon, inner, n) => inner ? `<div class="lg-ts"><h4>${fa(icon)} ${title}${n != null ? `<em>${n}</em>` : ""}</h4>${inner}</div>` : "";
    const holds = (k, id) => props.filter(a => (a.system.holders || []).some(h => h.k === k && h.id === id));
    let html = "";
    const chars = gm ? game.actors.filter(c => c.type === "character" && c.hasPlayerOwner) : myCharacters(); const mine = new Set(myCharacters().map(c => c.uuid));
    const ps = gm ? parties() : parties().filter(p => p.members.some(m => mine.has(m.uuid)));
    const grp = (label, icon, list) => list.length ? `<div class="lg-tg"><b>${fa(icon)} ${esc(label)}</b>${list.map(node).join("")}</div>` : "";
    html += sec("Groupes", "fa-users", ps.map(p => grp(p.name, "fa-users", holds("party", p.id))).join(""));
    html += sec(gm ? "Personnages" : "Mes personnages", "fa-user", chars.map(c => grp(c.name, "fa-user", holds("actor", c.uuid))).join(""));
    html += sec("Véhicules", "fa-sailboat", vs.map(vnode).join(""), vs.length || null);
    const rest = props.filter(a => !shown.has(a.id)); html += sec(gm ? "Sans détenteur" : "Autres biens visibles", "fa-box-open", rest.map(node).join(""));
    return html || `<div class="vm-empty">${fa("fa-house-chimney")}Aucun bien pour l'instant.<br>Le bouton vert en bas pour commencer.</div>`;
  }
  #results() {
    const v = norm(this.q).trim(); const out = [];
    for (const a of properties().filter(visible)) { const s = a.system;
      const hit = (txt, extra) => { if (norm(txt).includes(v)) out.push({ a, ...extra, txt }); };
      hit(a.name, { what: "Bien" }); if (s.place?.label) hit(s.place.label, { what: "Lieu", sec: "info" }); if (s.notes) { const i = norm(s.notes).indexOf(v); if (i >= 0) out.push({ a, what: "Notes", sec: "info", txt: s.notes.slice(Math.max(0, i - 20), i + 40) }); }
      for (const r of s.rooms || []) { hit(r.name, { what: "Pièce", room: r.id }); for (const l of r.lines || []) hit(l.t, { what: r.name, room: r.id, line: l.id, q: l.q }); }
      for (const l of s.general || []) hit(l.t, { what: "Hors pièce", room: "_g", line: l.id, q: l.q });
      for (const it of a.items) hit(it.name, { what: roomName(s, it.flags?.[MOD]?.room || "_g"), room: it.flags?.[MOD]?.room || "_g", item: it.id, q: qtyOf(it) });
      for (const u of s.upgrades || []) hit(u.t, { what: "Amélioration", sec: "up" }); }
    for (const veh of vehicles().filter(visible)) { if (norm(veh.name).includes(v)) out.push({ veh, what: "Véhicule", txt: veh.name }); for (const it of veh.items) if (norm(it.name).includes(v)) out.push({ veh, what: `Véhicule · ${veh.name}`, txt: it.name });
      for (const r of veh.system.rooms || []) { if (norm(r.name).includes(v)) out.push({ a: veh, what: "Zone", room: r.id, txt: r.name }); for (const l of r.lines || []) if (norm(l.t).includes(v)) out.push({ a: veh, what: r.name, room: r.id, line: l.id, q: l.q, txt: l.t }); }
      for (const l of veh.system.general || []) if (norm(l.t).includes(v)) out.push({ a: veh, what: "Soute", room: "_g", line: l.id, q: l.q, txt: l.t }); }
    return `<div class="lg-res"><h4>${fa("fa-magnifying-glass")} ${out.length} résultat${out.length > 1 ? "s" : ""}</h4>${out.slice(0, 80).map(r => r.veh ? `<a data-act="veh" data-uuid="${r.veh.uuid}">${fa("fa-sailboat")}<span><b>${esc(r.txt)}</b><small>${esc(r.what)}</small></span></a>`
      : `<a data-act="hit" data-uuid="${r.a.uuid}" data-room="${r.room || ""}" data-line="${r.line || ""}" data-item="${r.item || ""}" data-sec="${r.sec || ""}">${fa(r.line || r.item ? furnIcon(r.txt) : r.room ? "fa-vector-square" : "fa-house")}<span><b>${esc(r.txt)}${r.q > 1 ? ` ×${r.q}` : ""}</b><small>${esc(r.what)} · ${esc(r.a.name)}</small></span></a>`).join("") || `<small class="lg-none">Rien trouvé.</small>`}</div>`;
  }
  /* ── accueil ── */
  #home() {
    const props = properties().filter(visible), vs = vehicles().filter(visible);
    const card = a => { const s = a.system, k = KINDS[s.kind] || KINDS.misc; const n = (s.rooms || []).reduce((t, r) => t + (r.lines || []).length, 0) + (s.general || []).length + a.items.size;
      return `<a class="lg-card" data-act="sel" data-uuid="${a.uuid}" style="--kc:${k.c}"><i class="fa-solid ${k.i} lg-ci"></i><b>${esc(a.name)}</b><small>${esc(k.n)} · <span style="color:${STATUS[s.status]?.c}">${esc(STATUS[s.status]?.n || "")}</span></small><small>${fa("fa-location-dot")} ${esc(s.place?.label || "lieu non précisé")}</small><small>${fa("fa-vector-square")} ${(s.rooms || []).length} pièce${(s.rooms || []).length > 1 ? "s" : ""} · ${n} élément${n > 1 ? "s" : ""}</small><small>${fa("fa-key")} ${esc((s.holders || []).map(holderLabel).join(", ") || "sans détenteur")}</small></a>`; };
    const vcard = v => { const E = ENVS[v.system.env] || ENVS.land; return `<a class="lg-card veh" data-act="sel" data-uuid="${v.uuid}" style="--kc:${E.color}"><img src="${esc(v.img)}"><b>${esc(v.name)}</b><small>${fa(E.icon)} ${esc(E.name)}</small><small>${fa("fa-crown")} ${esc(game.users.get(v.system.owner)?.name || "sans propriétaire")}</small><small>${fa("fa-vector-square")} ${(v.system.rooms || []).length} zone${(v.system.rooms || []).length > 1 ? "s" : ""} · ${cargoItems(v).length} en soute</small></a>`; };
    return `<div class="lg-home"><h2>${fa("fa-house-chimney")} Biens</h2><div class="lg-cards">${props.map(card).join("") || `<div class="vm-empty big">${fa("fa-house-chimney")}Aucun bien enregistré.<br><a class="vm-btn" data-act="newprop">${fa("fa-plus")} Nouveau bien</a></div>`}</div>
      <h2>${fa("fa-sailboat")} Véhicules</h2><div class="lg-cards">${vs.map(vcard).join("") || `<div class="vm-empty">${fa("fa-sailboat")}Aucun véhicule. Achète-en un dans le Catalogue puis « Mettre un véhicule en service ».</div>`}</div></div>`;
  }
  /* ── page d'un bien ou d'un véhicule : barre fine, rail d'icônes, plan, liste des pièces ── */
  #page(a) {
    const V = isVehicle(a), s = a.system, ed = a.isOwner; const views = V ? ["plan", "log"] : ["plan", "info", "up", "log", ...(ed ? ["acc"] : [])];
    if (!views.includes(this.view)) this.view = "plan"; const view = this.view;
    const R = { plan: ["fa-map", V ? "Plan et zones" : "Plan et pièces", "#38d6ff"], info: ["fa-feather", "Infos et notes", "#e2c27a"], up: ["fa-screwdriver-wrench", "Améliorations et travaux", "#ff9a3d"], log: ["fa-scroll", "Journal", "#b48cff"], acc: ["fa-key", "Accès", "#ff5d6c"] };
    const rail = `<nav class="lg-rail">${views.map(v => `<a class="${v === view ? "on" : ""}" data-act="view" data-v="${v}" style="--tc:${R[v][2]}" data-tooltip="${R[v][1]}" data-tooltip-direction="RIGHT">${fa(R[v][0])}</a>`).join("")}
      ${V ? `<span class="lg-rsep"></span><a style="--tc:#7fdcff" data-act="veh" data-uuid="${a.uuid}" data-tooltip="Ouvrir la fiche du véhicule" data-tooltip-direction="RIGHT">${fa("fa-up-right-from-square")}</a>` : ""}</nav>`;
    let body;
    if (view === "plan") body = `<div class="lg-stage">${this.#plan(a, ed)}</div><aside class="lg-list">${this.#list(a, ed)}</aside>`;
    else body = `<div class="lg-view">${view === "info" ? this.#info(a, ed) : view === "up" ? this.#ups(a, ed) : view === "acc" ? this.#acc(a) : this.#log(a)}</div>`;
    return `<div class="lg-page" data-uuid="${a.uuid}">${this.#bar(a, ed)}<div class="lg-body v-${view}">${rail}${body}</div></div>`;
  }
  #bar(a, ed) {
    const s = a.system, ro = ed ? "" : " readonly disabled";
    if (isVehicle(a)) { const E = ENVS[s.env] || ENVS.land; const n = cargoItems(a).length;
      return `<div class="lg-bar" style="--kc:${E.color}"><img class="lg-bimg" src="${esc(a.img)}"><input class="lg-title" data-f="name" value="${esc(a.name)}"${ro}>
        <span class="lg-bp" style="--pc:${E.color}">${fa(E.icon)} ${esc(E.name)}</span><span class="lg-bp">${fa("fa-crown")} ${esc(game.users.get(s.owner)?.name || "sans propriétaire")}</span><span class="lg-bp">${fa("fa-boxes-stacked")} ${n} en soute</span></div>`; }
    const k = KINDS[s.kind] || KINDS.misc, st = STATUS[s.status] || STATUS.owned, P = s.place || {}; const api = csmApi();
    const money = [["price", "fa-coins", "#ffc63d", "Prix d'achat"], ["rent", "fa-repeat", "#38d6ff", "Loyer"], ["due", "fa-hourglass-half", "#ff8a3d", "Échéance"]].filter(([f]) => String(s[f] ?? "").trim())
      .map(([f, i, c, n]) => `<a class="lg-bp" style="--pc:${c}" data-act="view" data-v="info" data-tooltip="${n}">${fa(i)} ${esc(f === "due" ? s[f] : (fmtShort(s[f]) || s[f]))}</a>`).join("");
    return `<div class="lg-bar" style="--kc:${k.c}"><i class="lg-bk fa-solid ${k.i}" data-tooltip="${esc(k.n)}"></i><input class="lg-title" data-f="name" value="${esc(a.name)}"${ro}>
      <a class="lg-bp" style="--pc:${st.c}" data-act="view" data-v="info" data-tooltip="Statut">${esc(st.n)}</a>
      <a class="lg-bp" style="--pc:#ff6b7d" data-act="view" data-v="info" data-tooltip="${esc(P.full || "Lieu")}">${fa("fa-location-dot")} ${esc(P.label || "lieu ?")}</a>${api && P.gal ? `<a class="lg-bp ic" style="--pc:#38d6ff" data-act="where" data-tooltip="Où est-ce ? (Carte Stellaire)">${fa("fa-map-location-dot")}</a>` : ""}
      ${money}<span class="lg-bsp"></span><a class="lg-bp" style="--pc:#ffd36b" data-act="view" data-v="info" data-tooltip="Détenteurs">${fa("fa-key")} ${esc((s.holders || []).map(holderLabel).join(", ") || "sans détenteur")}</a></div>`;
  }
  #info(a, ed) {
    const s = a.system, ro = ed ? "" : " readonly disabled", P = s.place || {}, api = csmApi(), st = STATUS[s.status] || STATUS.owned;
    return `<div class="lg-vcard"><h3>${fa("fa-feather")} Infos et notes</h3><div class="lg-igrid">
      <label>Type<select data-f="system.kind"${ro}>${Object.entries(KINDS).map(([x, v]) => `<option value="${x}" ${x === s.kind ? "selected" : ""}>${v.n}</option>`).join("")}</select></label>
      <label>Statut<select data-f="system.status" class="lg-st" style="--sc:${st.c}"${ro}>${Object.entries(STATUS).map(([x, v]) => `<option value="${x}" ${x === s.status ? "selected" : ""}>${v.n}</option>`).join("")}</select></label>
      ${[["price", "Prix d'achat", "fa-coins", "#ffc63d"], ["rent", "Loyer", "fa-repeat", "#38d6ff"], ["due", "Échéance", "fa-hourglass-half", "#ff8a3d"]].map(([f, n, i, c]) => `<label class="lg-mt${s[f] ? " set" : ""}" style="--mc:${c}"><span>${fa(i)} ${n}${f !== "due" && fmtShort(s[f]) ? `<em>${fmtShort(s[f])}</em>` : ""}</span><input data-f="system.${f}" value="${esc(s[f])}" placeholder="—"${ro}></label>`).join("")}</div>
      <div class="lg-irow"><b>${fa("fa-key")} Détenteurs</b>${(s.holders || []).map(h => `<span class="lg-hchip">${fa(h.k === "party" ? "fa-users" : "fa-user")} ${esc(holderLabel(h))}</span>`).join("") || `<span class="lg-hchip dim">sans détenteur</span>`}${ed ? `<a class="lg-pb" style="--pc:#ffc63d" data-act="holders">${fa("fa-user-pen")} Changer</a>` : ""}</div>
      <div class="lg-irow"><b>${fa("fa-location-dot")} Lieu</b><span class="lg-ipl">${esc(P.label || "non précisé")}${P.full && P.full !== P.label ? `<small>${esc(P.full)}</small>` : ""}</span>${ed ? `<a class="lg-pb" style="--pc:#ff6b7d" data-act="place">${fa("fa-location-pin")} Choisir</a>` : ""}${api && P.gal ? `<a class="lg-pb" style="--pc:#38d6ff" data-act="where">${fa("fa-map-location-dot")} Où est-ce ?</a>` : ""}</div>
      <h4>${fa("fa-pen-nib")} Notes</h4><textarea class="lg-notes" data-f="system.notes" data-focus="notes" placeholder="${ed ? "Écris ici comme dans un document : histoire du lieu, voisins, travaux prévus…" : "Aucune note."}"${ro}>${esc(s.notes)}</textarea></div>`;
  }
  #ups(a, ed) { const s = a.system, ro = ed ? "" : " readonly disabled";
    return `<div class="lg-vcard"><h3>${fa("fa-screwdriver-wrench")} Améliorations et travaux</h3><div class="lg-ups">${(s.upgrades || []).map(u => `<div class="lg-up${u.done ? " done" : ""}" data-up="${u.id}"><input type="checkbox" data-uf="done" ${u.done ? "checked" : ""}${ro}><input class="lg-lt" data-uf="t" value="${esc(u.t)}"${ro}>${ed ? `<a class="lg-x" data-act="udel" data-up="${u.id}">${fa("fa-xmark")}</a>` : ""}</div>`).join("") || (ed ? "" : `<small class="lg-none">Rien de prévu.</small>`)}${ed ? `<input class="lg-add" data-addup="1" data-focus="addup" placeholder="+ Travaux, amélioration prévue… (Entrée)">` : ""}</div></div>`; }
  #log(a) { const s = a.system;
    return `<div class="lg-vcard"><h3>${fa("fa-scroll")} Journal</h3><div class="lg-log">${(s.log || []).slice(0, 80).map(l => `<div><i class="fa-solid ${({ create: "fa-house-chimney", access: "fa-key", deposit: "fa-box-open", withdraw: "fa-hand-holding", room: "fa-vector-square", info: "fa-feather" })[l.k] || "fa-feather"}"></i><span>${esc(l.txt)}</span><small>${new Date(l.t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · ${esc(l.u)}</small></div>`).join("") || `<small class="lg-none">Rien pour l'instant.</small>`}</div></div>`; }
  #acc(a) { const s = a.system; const canMgr = game.user.isGM || s.owner === game.user.id; const users = game.users.filter(u => !u.isGM);
    return `<div class="lg-vcard"><h3>${fa("fa-key")} Accès</h3><div class="lg-acc"><label>Gestionnaire<select data-act-change="owner"${canMgr ? "" : " disabled"}><option value="">— aucun —</option>${users.map(u => `<option value="${u.id}" ${u.id === s.owner ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>
      <table class="vm-table">${users.map(u => { const lv = a.ownership[u.id] ?? a.ownership.default ?? 0; return `<tr><th>${esc(u.name)}</th><td><select data-acc="${u.id}"${canMgr && u.id !== s.owner ? "" : " disabled"}><option value="none" ${lv < 2 ? "selected" : ""}>Aucun accès</option><option value="view" ${lv === 2 ? "selected" : ""}>Peut voir</option><option value="edit" ${lv >= 3 ? "selected" : ""}>Peut modifier</option></select></td></tr>`; }).join("")}</table>
      <p class="vm-hint">Les joueurs des personnages et des groupes détenteurs reçoivent automatiquement « peut modifier ».</p>${canMgr ? `<a class="lg-b sm" style="--bc:#ff5d6c" data-act="delprop">${fa("fa-trash")} Retirer ce bien du registre</a>` : ""}</div></div>`; }
  #curFloor(a) { const floors = a.system.floors?.length ? a.system.floors : F0(); return floors.some(f => f.id === this.floor[a.id]) ? this.floor[a.id] : floors[0].id; }
  /* ── colonne de droite : étages (catégories) → pièces → contenu ── */
  #list(a, ed) {
    const s = a.system, V = isVehicle(a), floors = s.floors?.length ? s.floors : F0(), fid = this.#curFloor(a); const W = V ? "zone" : "pièce";
    const cats = floors.map(f => { const key = `${a.id}:${f.id}`, cur = f.id === fid, open = !this.ffold.has(key); const D = dimOf(f);
      const rooms = (s.rooms || []).filter(r => (r.floor || "f0") === f.id).sort((x, y) => (x.y - y.y) || (x.x - y.x));
      return `<section class="lg-fcat${cur ? " cur" : ""}${open ? "" : " fold"}" data-floor="${f.id}"><header><a class="lg-ftw" data-act="ffold" data-floor="${f.id}">${fa(open ? "fa-chevron-down" : "fa-chevron-right")}</a>
        <a class="lg-fn" data-act="floor" data-floor="${f.id}" data-tooltip="Afficher sur le plan">${fa("fa-layer-group")}<span>${esc(f.name)}</span><small>${D.cols}×${D.rows}</small><em>${rooms.length}</em></a>${ed ? `<a class="lg-x" data-act="renfloor" data-floor="${f.id}" data-tooltip="Renommer">${fa("fa-pen")}</a>` : ""}</header>
        <div class="lg-fbody">${rooms.map(r => this.#room(a, r, ed)).join("") || `<small class="lg-none">Aucune ${W}${ed ? " : dessine-la sur le plan ou « + »" : ""}.</small>`}</div></section>`; }).join("");
    const gopen = !this.ffold.has(`${a.id}:_g`); const gn = (s.general || []).length + roomItems(a, "_g").length;
    const gen = `<section class="lg-fcat gen${gopen ? "" : " fold"}"><header><a class="lg-ftw" data-act="ffold" data-floor="_g">${fa(gopen ? "fa-chevron-down" : "fa-chevron-right")}</a><a class="lg-fn" data-act="ffold" data-floor="_g">${fa(V ? "fa-boxes-stacked" : "fa-box-open")}<span>${V ? "Soute (hors zone)" : "Hors pièce"}</span><em>${gn || ""}</em></a></header>
      <div class="lg-fbody"><div class="lg-room gen" data-room="_g" style="--rc:#ffc63d">${this.#lines(a, "_g", s.general || [], ed)}</div></div></section>`;
    return `<div class="lg-lh"><b>${fa("fa-vector-square")} ${V ? "Niveaux et zones" : "Étages et pièces"}</b>${ed ? `<a class="lg-lb" style="--bc:#3ddc84" data-act="addroom" data-tooltip="Ajouter une ${W} à l'étage affiché">${fa("fa-plus")} ${W}</a><a class="lg-lb" style="--bc:#7fdcff" data-act="addfloor" data-tooltip="Ajouter un ${V ? "niveau" : "étage"}">${fa("fa-layer-group")}${fa("fa-plus")}</a>` : ""}</div>${cats}${gen}`;
  }
  #room(a, r, ed) {
    const K = ROOMK[r.kind] || ROOMK.autre; const ro = ed ? "" : " readonly disabled"; const floors = a.system.floors || []; const n = (r.lines || []).length + roomItems(a, r.id).length; const closed = this.rfold.has(r.id), opt = ed && this.ropt.has(r.id);
    return `<div class="lg-room${this.flash?.room === r.id ? " flash" : ""}${this.hl === r.id ? " hl" : ""}${closed ? " fold" : ""}" data-room="${r.id}" style="--rc:${K.c}"><div class="lg-rh"><a class="lg-rtw" data-act="rfold" data-room="${r.id}">${fa(closed ? "fa-chevron-right" : "fa-chevron-down")}</a><a class="lg-ri" data-act="hlroom" data-room="${r.id}" data-tooltip="Voir sur le plan">${fa(K.i)}</a><input class="lg-rn" data-rf="name" value="${esc(r.name)}"${ro}><em class="lg-rc">${n || ""}</em>
      ${ed ? `<a class="lg-x${opt ? " on" : ""}" data-act="ropt" data-room="${r.id}" data-tooltip="Genre, forme, étage, ordre, supprimer">${fa("fa-sliders")}</a>` : ""}</div>
      ${opt ? `<div class="lg-ropt"><select data-rf="kind">${Object.entries(ROOMK).map(([x, v]) => `<option value="${x}" ${x === r.kind ? "selected" : ""}>${v.n}</option>`).join("")}</select><select data-rf="shape" data-tooltip="Forme sur le plan">${Object.entries(SHAPES).map(([x, v]) => `<option value="${x}" ${x === (r.shape || "rect") ? "selected" : ""}>${v[0]}</option>`).join("")}</select>${floors.length > 1 ? `<select data-rf="floor">${floors.map(f => `<option value="${f.id}" ${f.id === r.floor ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select>` : ""}<span class="lg-zs">${ZBTNS(r.id)}</span><a class="lg-x del" data-act="rdel" data-room="${r.id}" data-tooltip="Supprimer">${fa("fa-trash")}</a></div>` : ""}
      ${closed ? "" : this.#lines(a, r.id, r.lines || [], ed)}</div>`;
  }
  #lines(a, room, lines, ed) {
    const ro = ed ? "" : " readonly disabled"; const items = roomItems(a, room); const onPlan = room !== "_g";
    const mkb = (k, id, mk, ico) => `<a class="lg-mkb m-${mk}" data-act="mkmenu" data-k="${k}" data-id="${id}" data-room="${room}" data-tooltip="Repère sur le plan : ${MKS[mk][0]}">${fa(mk === "icon" ? ico : MKS[mk][1])}</a>`;
    const loc = (k, id, mk, placed) => !onPlan || mk === "none" ? "" : placed ? `<a class="lg-x lg-see" data-act="lsee" data-id="${id}" data-tooltip="Montrer sur le plan">${fa("fa-location-crosshairs")}</a>` : ed ? `<a class="lg-x lg-put" data-act="lput" data-k="${k}" data-id="${id}" data-room="${room}" data-tooltip="Placer au centre de la pièce">${fa("fa-location-dot")}</a>` : "";
    return `<div class="lg-lines" data-room="${room}">${lines.map(l => { const mk = mkOfLine(l), ico = furnIcon(l.t);
        return `<div class="lg-line${this.flash?.line === l.id ? " flash" : ""}" data-line="${l.id}" ${ed ? 'draggable="true"' : ""}>${ed ? `<i class="fa-solid fa-grip-vertical lg-grip"></i>` : ""}${ed && onPlan ? mkb("line", l.id, mk, ico) : `<i class="fa-solid ${ico} lg-li"></i>`}<input class="lg-lt" data-lf="t" value="${esc(l.t)}"${ro}><input class="lg-lq" type="number" min="1" data-lf="q" value="${l.q || 1}" title="Quantité"${ro}>${loc("line", l.id, mk, l.px != null)}${ed ? `<a class="lg-x" data-act="ldel" data-line="${l.id}">${fa("fa-xmark")}</a>` : ""}</div>`; }).join("")}
      ${items.map(it => { const mk = mkOfItem(it); return `<div class="lg-item${this.flash?.item === it.id ? " flash" : ""}" data-item="${it.id}" ${ed ? 'draggable="true"' : ""}><img src="${esc(it.img)}">${ed && onPlan ? mkb("item", it.id, mk, furnIcon(it.name)) : ""}<a class="lg-in" data-act="iopen" data-item="${it.id}">${esc(it.name)}</a><span class="lg-iq">×${qtyOf(it)}</span>${loc("item", it.id, mk, itF(it).px != null)}${ed ? `<a class="lg-x" style="color:#ffb26b" data-act="itake" data-item="${it.id}" data-tooltip="Reprendre sur un personnage">${fa("fa-hand-holding")}</a>` : ""}</div>`; }).join("")}
      ${ed ? `<div class="lg-addrow"><i class="fa-solid fa-plus lg-addi"></i><input class="lg-add" data-add="${room}" data-focus="add-${room}" placeholder="Ajouter (« 2 chaises ») + Entrée"><a class="lg-x lg-dep" data-act="ideposit" data-room="${room}" data-tooltip="Déposer un vrai objet depuis un personnage">${fa("fa-box-open")}</a></div>` : ""}
      ${!lines.length && !items.length && !ed ? `<small class="lg-none">Vide.</small>` : ""}</div>`;
  }
  /* ── plan : barre d'outils verticale + vue ── */
  #plan(a, ed) {
    const s = a.system; const V = isVehicle(a); const floors = s.floors?.length ? s.floors : F0(); const fid = this.#curFloor(a);
    const fl = floors.find(f => f.id === fid) || floors[0]; const { cols, rows } = dimOf(fl); const zk = `${a.id}:${fid}`; const z = this.zoom[zk] || 1;
    const rooms = (s.rooms || []).filter(r => (r.floor || "f0") === fid); const pct = (v, n) => (v / n * 100).toFixed(3) + "%";
    const marks = []; const tray = [];
    const pushMk = (r, k, id, name, q, mk, P, ico) => { if (mk === "none") return; const col = ROOMK[r.kind]?.c || "#7dd3fc";
      if (P.px == null) { tray.push(`<span class="lg-tr" draggable="${ed}" ${ed ? `data-act="trplace"` : ""} data-k="${k}" data-id="${id}" data-room="${r.id}" style="--rc:${col}" data-tooltip="${ed ? "Clic : au centre de la pièce · glisser : où tu veux" : ""}">${fa(ico)} ${esc(name)}<small>${esc(r.name)}</small></span>`); return; }
      const at = `data-k="${k}" data-id="${id}" data-room="${r.id}" data-tooltip="${esc(name)}${q > 1 ? " ×" + q : ""}"`; const pos = `left:${pct(r.x + P.px * r.w, cols)};top:${pct(r.y + P.py * r.h, rows)};--rc:${col}`;
      if (isShp(mk)) marks.push(`<div class="lg-mk shp m-${mk}" ${at} style="${pos};width:${pct(P.sw || 2, cols)};height:${pct(P.sh || 2, rows)}"><i class="fa-solid ${ico}"></i>${ed ? `<i class="lg-mrs"></i>` : ""}</div>`);
      else marks.push(`<i class="lg-mk ${mk === "dot" ? "dot" : `fa-solid ${ico}`}" ${at} style="${pos}"></i>`); };
    for (const r of rooms) { for (const l of r.lines || []) pushMk(r, "line", l.id, l.t, l.q, mkOfLine(l), l, furnIcon(l.t)); for (const it of roomItems(a, r.id)) pushMk(r, "item", it.id, it.name, qtyOf(it), mkOfItem(it), itF(it), furnIcon(it.name)); }
    const W = V ? "zone" : "pièce"; const tool = this.tool || "rect"; const idle = !this.draw && !this.hand && !this.shellEd && !this.sizing;
    const tb = (act, icon, tip, o = {}) => `<a class="lg-tb${o.on ? " on" : ""}${o.dis ? " dis" : ""}" style="--tc:${o.c || "#7fdcff"}" data-act="${act}" ${o.x || ""} data-tooltip="${tip}" data-tooltip-direction="RIGHT">${fa(icon)}</a>`; const sep = `<span class="lg-tsep"></span>`;
    let T = "";
    if (ed) { T += tb("tool", "fa-arrow-pointer", `Sélection : clique une ${W} pour la choisir, glisse-la pour la déplacer, son coin pour l'agrandir`, { on: idle, x: `data-tool="sel"` });
      for (const [k, [n, i]] of Object.entries(SHAPES)) T += tb("tool", i, `Dessiner : ${n}`, { on: this.draw && tool === k, x: `data-tool="${k}"`, c: "#ff4fd8" });
      T += tb("tool", V ? "fa-shuttle-space" : "fa-draw-polygon", V ? "Dessiner la coque" : "Dessiner le contour du lieu", { on: this.draw && tool === "shell", x: `data-tool="shell"`, c: "#5eead4" });
      if (fl.shell?.length) T += tb("shellEd", "fa-bezier-curve", V ? "Modifier la coque" : "Modifier le contour", { on: this.shellEd, c: "#5eead4" }) + tb("shellDel", "fa-eraser", V ? "Effacer la coque" : "Effacer le contour", { c: "#ff5d6c" });
      T += sep; }
    T += tb("hand", "fa-hand", "Main : agripper le plan pour le déplacer (sinon : glisser dans le vide)", { on: this.hand, c: "#ffd36b" });
    T += tb("zoom", "fa-magnifying-glass-plus", "Zoomer (molette sur le plan)", { x: `data-k="${zk}" data-d="1"` }) + `<b class="lg-zl" data-zoomlbl>${Math.round(z * 100)}%</b>` + tb("zoom", "fa-magnifying-glass-minus", "Dézoomer (molette sur le plan)", { x: `data-k="${zk}" data-d="-1"` }) + tb("zfit", "fa-expand", "Tout voir", { x: `data-k="${zk}"` });
    if (ed) { const h = rooms.find(r => r.id === this.hl); T += sep + tb("sizing", "fa-ruler-combined", "Taille du plan", { on: this.sizing, c: "#5eead4" });
      T += tb("zord", "fa-angles-up", h ? `Passer « ${esc(h.name)} » devant` : `Devant : choisis d'abord une ${W}`, { dis: !h, x: h ? `data-z="up" data-room="${h.id}"` : "", c: "#c4a5ff" }) + tb("zord", "fa-angles-down", h ? `Passer « ${esc(h.name)} » derrière` : `Derrière : choisis d'abord une ${W}`, { dis: !h, x: h ? `data-z="down" data-room="${h.id}"` : "", c: "#c4a5ff" }); }
    const fsOn = !!document.fullscreenElement || this._maxed; T += sep + tb("big", fsOn ? "fa-minimize" : "fa-maximize", fsOn ? "Quitter le plein écran (Échap)" : "Plein écran", { c: "#38d6ff", on: fsOn });
    const sizing = ed && this.sizing ? (() => { const B = baseDim(a), U = usedExt(s, fid); return `<div class="lg-sizebar"><b>${fa("fa-ruler-combined")} ${esc(fl.name)}</b><label>Colonnes<input type="number" min="${U.cols}" max="${MAXD}" value="${cols}" data-psz="cols"></label><span>×</span><label>Lignes<input type="number" min="${U.rows}" max="${MAXD}" value="${rows}" data-psz="rows"></label>
      <select data-psz="preset"><option value="">Dimensions de base…</option>${Object.entries(PLAN_PRESETS).map(([g, L]) => `<optgroup label="${g}">${L.map(([n, c, r]) => `<option value="${c}x${r}">${n} — ${c} × ${r}</option>`).join("")}</optgroup>`).join("")}</select>
      <a class="lg-b xs" style="--bc:#b46bff" data-act="szbase" data-c="${B[0]}" data-r="${B[1]}">${fa("fa-wand-magic-sparkles")} Selon le type (${B[0]} × ${B[1]})</a><a class="lg-b xs" style="--bc:#3ddc84" data-act="sizing">${fa("fa-check")} Terminer</a><small>Ou étire le plan par ses poignées. Minimum : ${U.cols} × ${U.rows}.</small></div>`; })() : "";
    const vxs = []; const selPoly = ed && !this.draw ? rooms.find(r => r.id === this.hl && r.shape === "poly" && r.pts?.length >= 3) : null;
    if (selPoly) selPoly.pts.forEach((q, i) => vxs.push(`<i class="lg-vx" data-vx="${selPoly.id}" data-i="${i}" style="left:${pct(q[0], cols)};top:${pct(q[1], rows)};--rc:${ROOMK[selPoly.kind]?.c}"></i>`));
    if (ed && this.shellEd && fl.shell?.length) fl.shell.forEach((q, i) => vxs.push(`<i class="lg-vx sh" data-vx="shell" data-i="${i}" style="left:${pct(q[0], cols)};top:${pct(q[1], rows)}"></i>`));
    const shell = fl.shell?.length >= 3 ? `<svg class="lg-shell" viewBox="0 0 ${cols} ${rows}" preserveAspectRatio="none"><polygon points="${fl.shell.map(q => q.join(",")).join(" ")}"/></svg>` : "";
    const room = r => { const K = ROOMK[r.kind] || ROOMK.autre; const n = (r.lines || []).length + roomItems(a, r.id).length; const shp = r.shape === "poly" && r.pts?.length >= 3 ? "poly" : (SHAPES[r.shape] ? r.shape : "rect"); let clip = "", inner = "";
      if (shp === "poly") { const rel = r.pts.map(q => [(q[0] - r.x) / r.w * 100, (q[1] - r.y) / r.h * 100]); clip = `clip-path:polygon(${rel.map(q => `${q[0].toFixed(2)}% ${q[1].toFixed(2)}%`).join(",")});`; inner = `<svg class="lg-psvg" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${rel.map(q => q.map(v => v.toFixed(2)).join(",")).join(" ")}"/></svg>`; }
      return `<div class="lg-pr shp-${shp}${this.hl === r.id ? " hl" : ""}" data-room="${r.id}"${ed ? "" : ` data-act="jump" data-uuid="${a.uuid}"`} style="left:${pct(r.x, cols)};top:${pct(r.y, rows)};width:${pct(r.w, cols)};height:${pct(r.h, rows)};--rc:${K.c};z-index:${10 + zRank(rooms, r)};${clip}">${inner}<span class="lg-prn">${fa(K.i)} ${esc(r.name)}${n ? `<small>${n}</small>` : ""}</span>${ed && shp !== "poly" ? `<i class="lg-rs"></i>` : ""}</div>`; };
    const empty = !rooms.length && !this.draw && !fl.shell?.length;
    const hint = this.draw ? (tool === "poly" || tool === "shell" ? "Clique les points du contour · clique le premier point (ou Entrée) pour fermer · Retour arrière : dernier point · Échap : annuler" : `Glisse sur la grille pour dessiner une ${W}`) : this.shellEd ? "Glisse les points · double-clic sur un bord : ajouter un point · clic droit : retirer" : this.hand ? "Main : agrippe le plan pour le déplacer" : "";
    return `<div class="lg-tbar">${T}</div><div class="lg-vwrap">${sizing}
      <div class="lg-planvp${this.hand ? " hand" : ""}" data-vp="${zk}"><div class="lg-plan${this.draw ? " drawing" : ""}${ed ? " ed" : ""}${this.sizing ? " sizing" : ""}" data-floor="${fid}" data-cols="${cols}" data-rows="${rows}" style="--cols:${cols};--rows:${rows};--z:${z}">${shell}${rooms.map(room).join("")}${marks.join("")}${vxs.join("")}${ed && this.sizing ? `<i class="lg-sz e" data-sz="e"></i><i class="lg-sz s" data-sz="s"></i><i class="lg-sz se" data-sz="se"></i>` : ""}</div></div>
      <div class="lg-flabel">${fa("fa-layer-group")} ${esc(fl.name)}<small>${cols} × ${rows}</small></div>
      ${empty ? `<div class="lg-planempty">${fa("fa-pen-ruler")} ${V ? "Aucune zone sur ce niveau." : "Aucune pièce à cet étage."}${ed ? `<span>Choisis une forme dans la barre d'outils puis trace sur la grille${V ? `, ou <a class="lg-b xs" style="--bc:#3ddc84" data-act="vtpl">${fa("fa-wand-magic-sparkles")} Zones de départ</a>` : "."}</span>` : ""}</div>` : ""}
      ${hint ? `<div class="lg-hint">${hint}</div>` : ""}
      ${tray.length ? `<div class="lg-tray"><b>${fa("fa-hand-pointer")} À placer</b>${tray.join("")}</div>` : ""}</div>`;
  }

  /* ── affichage : on garde les défilements, le champ actif et le texte en cours ── */
  _replaceHTML(html, content) {
    const q = s => content.querySelector(s); const vp0 = q(".lg-planvp");
    const keep = { list: q(".lg-list")?.scrollTop || 0, side: q(".lg-tree")?.scrollTop || 0, view: q(".lg-view")?.scrollTop || 0, sel: q(".lg-page")?.dataset.uuid };
    if (vp0) this.vpKeep[vp0.dataset.vp] = { l: vp0.scrollLeft, t: vp0.scrollTop };
    const act = document.activeElement; const fk = act && content.contains(act) ? (act.dataset.focus || (act.classList.contains("lg-q") ? "q" : null)) : null; const caret = fk && act.selectionStart != null ? act.selectionStart : null;
    content.querySelector(".lg-mkmenu")?.remove();
    content.innerHTML = html;
    if (keep.sel === this.sel) { const l = q(".lg-list"); if (l) l.scrollTop = keep.list; const v = q(".lg-view"); if (v) v.scrollTop = keep.view; } const s2 = q(".lg-tree"); if (s2) s2.scrollTop = keep.side;
    if (fk) { const el = fk === "q" ? q(".lg-q") : q(`[data-focus="${fk}"]`); if (el) { el.focus({ preventScroll: true }); if (caret != null) try { el.setSelectionRange(caret, caret); } catch (e) {} } }
    const ta = q("textarea.lg-notes"); if (ta) { ta.style.height = "auto"; ta.style.height = Math.max(180, ta.scrollHeight) + "px"; }
    if (this.flash) { const f = this.flash; requestAnimationFrame(() => { const el = content.querySelector(f.line ? `.lg-line[data-line="${f.line}"]` : f.item ? `.lg-item[data-item="${f.item}"]` : f.room ? `.lg-room[data-room="${f.room}"]` : null); el?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }); setTimeout(() => { this.flash = null; content.querySelectorAll(".flash").forEach(e => e.classList.remove("flash")); }, 2200); }
    const after = () => { const vp = q(".lg-planvp[data-vp]"); if (!vp) return; const k = vp.dataset.vp, p = vp.querySelector(".lg-plan");
      if (!this.zoom[k] && p) { this.zoom[k] = this.#fitZ(vp, p); p.style.setProperty("--z", this.zoom[k]); const l = q("[data-zoomlbl]"); if (l) l.textContent = `${Math.round(this.zoom[k] * 100)}%`; }
      else if (this.vpKeep[k]) { vp.scrollLeft = this.vpKeep[k].l; vp.scrollTop = this.vpKeep[k].t; }
      if (this._center) { const c = this._center; this._center = null; requestAnimationFrame(() => this.#centerOn(c)); } };
    const wait = (n = 0) => { const vp = q(".lg-planvp"); if (vp && vp.clientWidth < 80 && n < 20) return setTimeout(() => wait(n + 1), 100); after(); };
    requestAnimationFrame(() => wait());
    if (content.dataset.lgBound) return; content.dataset.lgBound = "1";
    content.addEventListener("click", ev => this.#click(ev)); content.addEventListener("change", ev => this.#change(ev)); content.addEventListener("keydown", ev => this.#key(ev));
    content.addEventListener("input", ev => { if (ev.target.classList.contains("lg-q")) { this.q = ev.target.value; const t = content.querySelector(".lg-tree"); if (t) t.innerHTML = this.#side(); } if (ev.target.classList.contains("lg-notes")) { ev.target.style.height = "auto"; ev.target.style.height = Math.max(180, ev.target.scrollHeight) + "px"; } });
    content.addEventListener("focusout", () => setTimeout(() => { if (this.pend && !content.contains(document.activeElement)) { this.pend = false; this.render(); } }, 60));
    content.addEventListener("dragstart", ev => this.#dragStart(ev)); content.addEventListener("dragover", ev => { const z = ev.target.closest?.(".lg-lines,.lg-room,.lg-plan"); if (z) { ev.preventDefault(); z.classList.add("over"); } });
    content.addEventListener("dragleave", ev => ev.target.closest?.(".over")?.classList.remove("over")); content.addEventListener("drop", ev => this.#drop(ev));
    content.addEventListener("pointerdown", ev => this.#planDown(ev));
    /* surbrillance croisée : survol d'une pièce dans la liste ↔ sur le plan, d'un meuble ↔ son repère */
    const hov = (ev, on) => { const r = ev.target.closest?.(".lg-room[data-room], .lg-pr[data-room], .lg-nr a[data-room]"); if (r) { const id = r.dataset.room; content.querySelectorAll(`.lg-pr[data-room="${id}"], .lg-room[data-room="${id}"]`).forEach(x => x.classList.toggle("hov", on)); }
      const m = ev.target.closest?.(".lg-line[data-line], .lg-item[data-item], .lg-mk[data-id]"); if (m) { const id = m.dataset.line || m.dataset.item || m.dataset.id; content.querySelectorAll(`.lg-mk[data-id="${id}"], .lg-line[data-line="${id}"], .lg-item[data-item="${id}"]`).forEach(x => x.classList.toggle("hov", on)); } };
    content.addEventListener("mouseover", ev => hov(ev, true)); content.addEventListener("mouseout", ev => hov(ev, false));
    content.addEventListener("wheel", ev => { const vp = ev.target.closest?.(".lg-planvp"); if (!vp) return; ev.preventDefault(); const k = vp.dataset.vp; this.#setZoom(k, (this.zoom[k] || 1) * (ev.deltaY < 0 ? 1.15 : .87), { x: ev.clientX, y: ev.clientY }); }, { passive: false });
    content.addEventListener("contextmenu", ev => { const vx = ev.target.closest?.(".lg-vx"); if (!vx) return; ev.preventDefault(); this.#vxDel(vx); });
    content.addEventListener("dblclick", ev => this.#vxAdd(ev));
    this._fsH = () => this.#fsChange(); document.addEventListener("fullscreenchange", this._fsH);
    /* Échap en plein écran : on sort du plein écran sans fermer la fenêtre */
    this._escH = ev => { if (ev.key !== "Escape" || this.pp || !this.rendered) return; if (!document.fullscreenElement && !this._maxed) return; if (this.element?.querySelector(".lg-mkmenu")) return;
      ev.stopPropagation(); ev.preventDefault(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else this.#unmax(); };
    document.addEventListener("keydown", this._escH, true);
  }
  _onClose(options) { super._onClose?.(options); if (this._fsH) document.removeEventListener("fullscreenchange", this._fsH); this._fsH = null; if (this._escH) document.removeEventListener("keydown", this._escH, true); this._escH = null; if (this._fsPrev && document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); this._maxed = false; this.#ppKeys(false); }
  #fitZ(vp, p) { return Math.max(.1, Math.min(2, (vp.clientWidth - 36) / (+p.dataset.cols * CELL), (vp.clientHeight - 36) / (+p.dataset.rows * CELL))); }
  #setZoom(key, z, around = null) { z = Math.max(.1, Math.min(4, Math.round(z * 100) / 100)); const vp = this.element?.querySelector(".lg-planvp"); const p = vp?.querySelector(".lg-plan"); const old = this.zoom[key] || 1; this.zoom[key] = z;
    if (p) { let cx = vp.clientWidth / 2, cy = vp.clientHeight / 2; if (around) { const b = vp.getBoundingClientRect(); cx = around.x - b.left; cy = around.y - b.top; }
      const pb = p.getBoundingClientRect(), vb = vp.getBoundingClientRect(); const px = (vb.left + cx - pb.left) / old, py = (vb.top + cy - pb.top) / old;
      p.style.setProperty("--z", z); const pb2 = p.getBoundingClientRect(); vp.scrollLeft += (pb2.left + px * z) - (vb.left + cx); vp.scrollTop += (pb2.top + py * z) - (vb.top + cy); }
    const l = this.element?.querySelector("[data-zoomlbl]"); if (l) l.textContent = `${Math.round(z * 100)}%`; }
  /* centre la vue du plan sur une pièce ou un repère */
  #centerOn(sel) { const vp = this.element?.querySelector(".lg-planvp"); const t = vp?.querySelector(sel); if (!t) return; const b = t.getBoundingClientRect(), v = vp.getBoundingClientRect();
    vp.scrollTo({ left: vp.scrollLeft + (b.left + b.width / 2) - (v.left + v.width / 2), top: vp.scrollTop + (b.top + b.height / 2) - (v.top + v.height / 2), behavior: "smooth" }); }
  #ping(id) { const m = this.element?.querySelector(`.lg-mk[data-id="${id}"]`); if (!m) return; this.#centerOn(`.lg-mk[data-id="${id}"]`); m.classList.remove("ping"); void m.offsetWidth; m.classList.add("ping"); setTimeout(() => m.classList.remove("ping"), 2600); }
  /* vrai plein écran : toute la page passe en plein écran et la fenêtre la remplit (les dialogues restent visibles) */
  async #toggleFs() { if (document.fullscreenElement) return document.exitFullscreen().catch(() => {}); if (this._maxed) return this.#unmax();
    this._fsPrev = { ...this.position }; try { await document.documentElement.requestFullscreen(); } catch (e) { this._fsPrev = null; this.#max(); } }
  /* repli si le navigateur refuse le plein écran : la fenêtre remplit toute la page (Échap ou le même bouton pour revenir) */
  #max() { this._maxPrev = { ...this.position }; this._maxed = true; this.setPosition({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }); this.element?.classList.add("lg-fs"); for (const k of Object.keys(this.zoom)) delete this.zoom[k]; this.render(); }
  #unmax() { this._maxed = false; this.element?.classList.remove("lg-fs"); this.setPosition(this._maxPrev || {}); this._maxPrev = null; for (const k of Object.keys(this.zoom)) delete this.zoom[k]; this.render(); }
  #fsChange() { if (!this.rendered) return; const on = !!document.fullscreenElement;
    if (on && this._fsPrev) setTimeout(() => { this.setPosition({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }); this.element?.classList.add("lg-fs"); for (const k of Object.keys(this.zoom)) delete this.zoom[k]; this.render(); }, 120);
    else if (!on && this._fsPrev) { const p = this._fsPrev; this._fsPrev = null; this.element?.classList.remove("lg-fs"); this.setPosition(p); for (const k of Object.keys(this.zoom)) delete this.zoom[k]; setTimeout(() => this.render(), 60); } }
  /** rafraîchir sans perdre une saisie en cours */
  refresh() { if (this.busy) { this.pend = true; return; } const el = this.element; const act = document.activeElement; if (el && act && el.contains(act) && /INPUT|TEXTAREA|SELECT/.test(act.tagName) && !act.classList.contains("lg-q") && !act.classList.contains("lg-add")) { this.pend = true; return; } this.render(); }
  /* va à une pièce : bon étage, catégorie ouverte, surlignée, vue centrée */
  #focusRoom(a, roomId, { flash = true } = {}) { const r = roomOf(a?.system || {}, roomId); if (!r) return; const f = r.floor || "f0"; this.floor[a.id] = f; this.ffold.delete(`${a.id}:${f}`); this.rfold.delete(r.id); this.hl = r.id; this.view = "plan"; if (flash) this.flash = { room: r.id }; this._center = `.lg-pr[data-room="${r.id}"]`; }
  /* menu « repère sur le plan » d'un meuble ou d'un objet */
  #mkMenu(btn) {
    const wrap = this.element?.querySelector(".lg-wrap"); if (!wrap) return; const old = wrap.querySelector(".lg-mkmenu"); if (old) { const same = old.dataset.id === btn.dataset.id; old.remove(); if (same) return; }
    const a = this.doc; const ref = refOf(btn); const cur = ref.k === "item" ? mkOfItem(a.items.get(ref.id)) : mkOfLine(linesOf(a.system, ref.room)?.find(l => l.id === ref.id));
    const m = document.createElement("div"); m.className = "lg-mkmenu"; m.dataset.id = ref.id;
    m.innerHTML = `<b>Repère sur le plan</b>${Object.entries(MKS).map(([k, [n, i]]) => `<a data-mk="${k}" class="${k === cur ? "on" : ""}">${fa(i)} ${n}</a>`).join("")}`;
    const b = btn.getBoundingClientRect(), w = wrap.getBoundingClientRect(); m.style.left = `${Math.min(b.left - w.left, w.width - 190)}px`; m.style.top = `${b.bottom - w.top + 4}px`; wrap.appendChild(m);
    if (b.bottom + m.offsetHeight > w.bottom - 6) m.style.top = `${b.top - w.top - m.offsetHeight - 4}px`;
    const close = e => { if (e && m.contains(e.target)) return; m.remove(); document.removeEventListener("pointerdown", close, true); };
    setTimeout(() => document.addEventListener("pointerdown", close, true), 0);
    m.addEventListener("click", async e => { const o = e.target.closest("[data-mk]"); if (!o) return; close(); const k = o.dataset.mk; const P = ref.k === "item" ? itF(a.items.get(ref.id)) : (linesOf(a.system, ref.room)?.find(l => l.id === ref.id) || {});
      const patch = { mk: k }; if (k !== "none" && P.px == null) { patch.px = .5; patch.py = .5; } if (isShp(k) && !P.sw) { patch.sw = 2; patch.sh = 2; } await this.#setMark(a, ref, patch); });
  }
  async #setMark(a, ref, patch) {
    if (ref.k === "item") { const it = a.items.get(ref.id); if (!it) return; const u = {}; for (const [k, v] of Object.entries(patch)) u[`flags.${MOD}.${k}`] = v ?? null; return it.update(u); }
    return mut(a, s => { const l = linesOf(s, ref.room)?.find(x => x.id === ref.id); if (!l) return false; for (const [k, v] of Object.entries(patch)) { if (v == null) delete l[k]; else l[k] = v; } return rl(s); });
  }

  async #click(ev) {
    const el = ev.target.closest("[data-act]"); if (!el) return; const act = el.dataset.act; const a = this.doc;
    switch (act) {
      case "newprop": return newProperty();
      case "service": return putInService();
      case "newveh": return newVehicle();
      case "vset": { const g = Garage.open(); g.view = "settings"; return g.render(); }
      case "side": this.sideMode = el.dataset.m; sideSave(this.sideMode); return this.render();
      case "sel": if (this.sel !== el.dataset.uuid) { this.hl = null; this.view = "plan"; } this.sel = el.dataset.uuid; this.flash = null; this.draw = false; return this.render();
      case "tw": ev.stopPropagation(); { const u = el.dataset.uuid; if (this.expand.has(u)) this.expand.delete(u); else this.expand.add(u); const t = this.element.querySelector(".lg-tree"); if (t) t.innerHTML = this.#side(); } return;
      case "veh": return (await fromUuid(el.dataset.uuid))?.sheet.render(true);
      case "jump": { this.sel = el.dataset.uuid; const d = this.doc; if (d) this.#focusRoom(d, el.dataset.room); return this.render(); }
      case "hit": { this.sel = el.dataset.uuid; const d = this.doc; const sec = el.dataset.sec; if (sec) { this.view = sec; return this.render(); }
        const room = el.dataset.room; if (d && room && room !== "_g") this.#focusRoom(d, room, { flash: false }); else { this.view = "plan"; if (d) this.ffold.delete(`${d.id}:_g`); }
        this.flash = { room: room || null, line: el.dataset.line || null, item: el.dataset.item || null }; if (el.dataset.line || el.dataset.item) setTimeout(() => this.#ping(el.dataset.line || el.dataset.item), 500); return this.render(); }
      case "view": this.view = el.dataset.v; this.draw = false; this.pp = null; return this.render();
      case "ffold": { if (!a) return; const k = `${a.id}:${el.dataset.floor}`; if (this.ffold.has(k)) this.ffold.delete(k); else this.ffold.add(k); return this.render(); }
      case "rfold": { const k = el.dataset.room; if (this.rfold.has(k)) this.rfold.delete(k); else this.rfold.add(k); return this.render(); }
      case "ropt": { const k = el.dataset.room; if (this.ropt.has(k)) this.ropt.delete(k); else this.ropt.add(k); return this.render(); }
      case "big": return this.#toggleFs();
      case "zoom": { const k = el.dataset.k; if (!k) return; this.#setZoom(k, (this.zoom[k] || 1) * (Number(el.dataset.d) > 0 ? 1.25 : .8)); return; }
      case "zfit": { const vp = this.element?.querySelector(".lg-planvp"), p = vp?.querySelector(".lg-plan"); if (!p) return; this.#setZoom(el.dataset.k, this.#fitZ(vp, p)); vp.scrollLeft = 0; vp.scrollTop = 0; return; }
      case "hand": this.hand = !this.hand; this.draw = false; this.pp = null; this.shellEd = false; this.sizing = false; return this.render();
      case "sizing": this.sizing = !this.sizing; this.draw = false; this.pp = null; this.shellEd = false; this.hand = false; return this.render();
      case "tool": { const k = el.dataset.tool; this.pp = null; this.#ppKeys(false); if (k === "sel" || (this.draw && this.tool === k)) { this.draw = false; this.hand = false; this.shellEd = false; this.sizing = false; } else { this.tool = k; this.draw = true; this.hand = false; this.sizing = false; this.shellEd = false; } return this.render(); }
      case "shellEd": this.shellEd = !this.shellEd; this.draw = false; this.pp = null; this.hand = false; return this.render();
      case "hlroom": { if (!a) return; if (this.hl === el.dataset.room) { this.hl = null; return this.render(); } this.#focusRoom(a, el.dataset.room, { flash: false }); return this.render(); }
      case "lsee": return this.#ping(el.dataset.id);
      case "mkmenu": if (a?.isOwner) this.#mkMenu(el); return;
    }
    if (!a) return;
    if (!a.isOwner && !["where", "iopen", "floor", "veh"].includes(act)) return;
    switch (act) {
      case "where": { const P = a.system.place || {}; const api = csmApi(); if (api && P.gal) api.open({ lvl: { k: "surface", gal: P.gal, sys: P.sys, pl: P.pl, ...(P.moon != null ? { moon: P.moon } : {}) } }); return; }
      case "place": { const p = await pickPlace(a.system.place); if (p === null) return; await a.update({ "system.place": { label: "", gal: null, sys: null, pl: null, moon: null, place: null, full: null, ...p } }); return log(a, "info", `Lieu : ${p.label || "non précisé"}.`); }
      case "holders": {
        const r = await DialogV2.wait({ window: { title: "Détenteurs", icon: "fa-solid fa-key" }, classes: ["vm-dialog"], position: { width: 560 }, content: `<div class="vm-dlg">${holderChoices(a.system.holders || [])}</div>`, buttons: [{ action: "ok", label: "Valider", icon: "fa-solid fa-check", default: true, callback: (e, b) => readHolders(b.form) }, { action: "no", label: "Annuler" }], rejectClose: false });
        if (!r || r === "no") return; return gmDo("propHolders", { uuid: a.uuid, holders: r }); }
      case "delprop": { const ok = await DialogV2.confirm({ window: { title: "Retirer ce bien ?" }, classes: ["vm-dialog"], content: `<p>« ${esc(a.name)} » sera supprimé du registre${a.items.size ? ` (${a.items.size} objet${a.items.size > 1 ? "s" : ""} déposé${a.items.size > 1 ? "s" : ""} dedans)` : ""}.</p>` }); if (!ok) return; const r = await gmDo("propDelete", { uuid: a.uuid }); if (r !== null) { this.sel = null; this.render(); } return; }
      case "floor": this.floor[a.id] = el.dataset.floor; this.ffold.delete(`${a.id}:${el.dataset.floor}`); this.hl = null; return this.render();
      case "addfloor": { const V = isVehicle(a); const fl = a.system.floors || []; const cur = fl.find(f => f.id === this.#curFloor(a)) || fl[0]; const D = dimOf(cur), B = baseDim(a);
        const r = await DialogV2.wait({ window: { title: V ? "Nouveau niveau" : "Nouvel étage", icon: "fa-solid fa-layer-group" }, classes: ["vm-dialog"], position: { width: 460 },
          content: `<div class="vm-dlg"><label>Nom<input name="n" value="${V ? `Niveau ${fl.length + 1}` : `Étage ${fl.length}`}" autofocus></label><label class="lg-chk"><input type="radio" name="d" value="same" checked> Même dimension que « ${esc(cur?.name || "l'étage actuel")} » (${D.cols} × ${D.rows})</label><label class="lg-chk"><input type="radio" name="d" value="base"> Dimension de base (${B[0]} × ${B[1]})</label></div>`,
          buttons: [{ action: "ok", label: "Créer", icon: "fa-solid fa-check", default: true, callback: (e, b) => ({ n: b.form.elements.n.value.trim(), d: b.form.elements.d.value }) }, { action: "no", label: "Annuler" }], rejectClose: false });
        if (!r || r === "no" || !r.n) return; const id = rid(); this.floor[a.id] = id; const dim = r.d === "same" ? D : { cols: B[0], rows: B[1] };
        return mut(a, s => { s.floors = (s.floors?.length ? s.floors : F0()); s.floors.push({ id, name: r.n, cols: dim.cols, rows: dim.rows }); return { "system.floors": s.floors }; }); }
      case "szbase": return this.#resizeFloor(a, this.#curFloor(a), +el.dataset.c, +el.dataset.r);
      case "shellDel": { const fid = this.#curFloor(a); this.shellEd = false; return mut(a, s => { const f = (s.floors || []).find(x => x.id === fid); if (!f?.shell) return false; delete f.shell; return { "system.floors": s.floors }; }); }
      case "renfloor": { const f = (a.system.floors || []).find(x => x.id === el.dataset.floor); const n = await askText(isVehicle(a) ? "Renommer le niveau" : "Renommer l'étage", "Nom", f?.name || ""); if (!n) return; return mut(a, s => { s.floors = s.floors?.length ? s.floors : F0(); const x = s.floors.find(y => y.id === el.dataset.floor); if (!x) return false; x.name = n; return { "system.floors": s.floors }; }); }
      case "vtpl": { if (!isVehicle(a)) return; const env = VTEMPLATES[a.system.env] ? a.system.env : "land"; await mut(a, s => { if ((s.rooms || []).length) return false; s.floors = [{ id: "f0", name: "Niveau 1", cols: 24, rows: 14, shell: VSHELL[env] }]; s.rooms = VTEMPLATES[env](); return { "system.floors": s.floors, "system.rooms": s.rooms }; }); delete this.zoom[`${a.id}:f0`]; return log(a, "info", "Zones de départ créées dans Domaine."); }
      case "addroom": { const r = await askRoom(); if (!r) return; const fid = this.#curFloor(a); const spot = freeSpot(a.system.rooms || [], fid, 5, 4, ...Object.values(dimOf((a.system.floors || []).find(f => f.id === fid)))); const room = { id: rid(), name: r.name, kind: r.kind, floor: fid, ...spot, notes: "", lines: [] };
        await mut(a, s => { s.rooms ||= []; if (!s.floors?.length) s.floors = F0(); s.rooms.push(room); return rl(s); }); this.flash = { room: room.id }; this.hl = room.id; return log(a, "room", `${isVehicle(a) ? "Zone" : "Pièce"} ajoutée : ${r.name}.`); }
      case "zord": { const id = el.dataset.room, how = el.dataset.z; if (!id) return; return mut(a, s => { const r = roomOf(s, id); if (!r) return false; const fl = r.floor || "f0"; const L = zSorted((s.rooms || []).filter(x => (x.floor || "f0") === fl)); const i = L.indexOf(r);
        const j = how === "top" ? L.length - 1 : how === "bottom" ? 0 : how === "up" ? Math.min(L.length - 1, i + 1) : Math.max(0, i - 1); if (j === i) return false; L.splice(i, 1); L.splice(j, 0, r); L.forEach((x, k) => { x.z = k; }); return rl(s); }); }
      case "rdel": { const r = roomOf(a.system, el.dataset.room); if (!r) return; const its = roomItems(a, r.id); if ((r.lines || []).length || its.length) { const ok = await DialogV2.confirm({ window: { title: `Supprimer « ${r.name} » ?` }, classes: ["vm-dialog"], content: `<p>Les ${(r.lines || []).length} ligne(s) seront supprimées${its.length ? ` ; les ${its.length} objet(s) déposés passeront hors pièce` : ""}.</p>` }); if (!ok) return; }
        for (const it of its) await it.update({ [`flags.${MOD}.room`]: "_g", [`flags.${MOD}.px`]: null, [`flags.${MOD}.py`]: null }); if (this.hl === r.id) this.hl = null; await mut(a, s => { s.rooms = (s.rooms || []).filter(x => x.id !== r.id); return rl(s); }); return log(a, "room", `Pièce supprimée : ${r.name}.`); }
      case "ldel": { const room = el.closest("[data-room]").dataset.room; const lid = el.dataset.line; return mut(a, s => { const L = linesOf(s, room); if (!L) return false; const i = L.findIndex(l => l.id === lid); if (i < 0) return false; L.splice(i, 1); return rl(s); }); }
      case "lput": case "trplace": { const ref = refOf(el); const cur = ref.k === "item" ? mkOfItem(a.items.get(ref.id)) : mkOfLine(linesOf(a.system, ref.room)?.find(l => l.id === ref.id)); this.flash = ref.k === "item" ? { item: ref.id } : { line: ref.id }; setTimeout(() => this.#ping(ref.id), 400); return this.#setMark(a, ref, { px: .5, py: .5, ...(cur === "none" ? { mk: "icon" } : {}) }); }
      case "udel": return mut(a, s => { s.upgrades = (s.upgrades || []).filter(u => u.id !== el.dataset.up); return { "system.upgrades": s.upgrades }; });
      case "ideposit": return deposit(a, el.dataset.room);
      case "itake": { const it = a.items.get(el.dataset.item); if (it) return takeBack(a, it); return; }
      case "iopen": return a.items.get(el.dataset.item)?.sheet.render(true);
    }
  }
  async #change(ev) {
    const el = ev.target; const a = this.doc; if (!a || !a.isOwner) return;
    if (el.dataset.f) { const f = el.dataset.f; const v = el.value; if (f === "name") return a.update({ name: v.trim() || a.name }); return a.update({ [f]: v }); }
    if (el.dataset.psz) { const fid = this.#curFloor(a); const f = (a.system.floors || []).find(x => x.id === fid); const D = dimOf(f);
      if (el.dataset.psz === "preset") { if (!el.value) return; const [c, r] = el.value.split("x").map(Number); return this.#resizeFloor(a, fid, c, r); }
      return this.#resizeFloor(a, fid, el.dataset.psz === "cols" ? +el.value : D.cols, el.dataset.psz === "rows" ? +el.value : D.rows); }
    if (el.dataset.rf === "shape") { const room = el.closest("[data-room]").dataset.room, v = el.value; return mut(a, s => { const r = roomOf(s, room); if (!r) return false; r.shape = v; if (v === "poly" && !(r.pts?.length >= 3)) r.pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; if (v === "poly") this.hl = r.id; return rl(s); }); }
    if (el.dataset.rf) { const room = el.closest("[data-room]").dataset.room, k = el.dataset.rf, v = el.value; return mut(a, s => { const r = roomOf(s, room); if (!r) return false; r[k] = v;
      if (k === "floor") { const D = dimOf((s.floors || []).find(f => f.id === v)); const sp = freeSpot((s.rooms || []).filter(x => x.id !== r.id), v, Math.min(r.w, D.cols - 1), Math.min(r.h, D.rows - 1), D.cols, D.rows); if (r.pts?.length) r.pts = r.pts.map(q => [sp.x + (q[0] - r.x), sp.y + (q[1] - r.y)]); Object.assign(r, sp); this.floor[a.id] = v; } return rl(s); }); }
    if (el.dataset.lf) { const room = el.closest("[data-room]").dataset.room, lid = el.closest("[data-line]").dataset.line, k = el.dataset.lf; const v = k === "q" ? Math.max(1, +el.value || 1) : el.value.trim(); return mut(a, s => { const L = linesOf(s, room); const l = L?.find(x => x.id === lid); if (!l) return false; if (k === "t" && !v) { L.splice(L.indexOf(l), 1); } else l[k] = v; return rl(s); }); }
    if (el.dataset.uf) { const uid = el.closest("[data-up]").dataset.up, k = el.dataset.uf; return mut(a, s => { const u = (s.upgrades || []).find(x => x.id === uid); if (!u) return false; u[k] = k === "done" ? el.checked : el.value.trim(); return { "system.upgrades": s.upgrades }; }); }
    if (el.dataset.acc) return gmDo("access", { vehicle: a.uuid, target: el.dataset.acc, level: el.value });
    if (el.dataset.actChange === "owner") return gmDo("owner", { vehicle: a.uuid, target: el.value });
  }
  async #key(ev) {
    if (ev.key === "Escape") { const m = this.element?.querySelector(".lg-mkmenu"); if (m) { ev.stopPropagation(); m.remove(); return; } if (this._maxed && !this.pp) { ev.stopPropagation(); return this.#unmax(); } if (document.fullscreenElement && !this.pp) { ev.stopPropagation(); ev.preventDefault(); return document.exitFullscreen().catch(() => {}); } }
    const el = ev.target; if (ev.key !== "Enter" || ev.shiftKey) return; const a = this.doc;
    if (el.classList.contains("lg-add") && a?.isOwner) { ev.preventDefault(); const raw = el.value.trim(); if (!raw) return; el.value = "";
      if (el.dataset.addup) return mut(a, s => { (s.upgrades ||= []).push({ id: rid(), t: raw, done: false }); return { "system.upgrades": s.upgrades }; });
      const room = el.dataset.add; const { t, q } = parseLine(raw); return mut(a, s => { const L = linesOf(s, room); if (!L) return false; L.push({ id: rid(), t, q }); return rl(s); }); }
    if (el.matches("input.lg-lt, input.lg-rn, input.lg-title, .lg-mt input, input.lg-lq")) { ev.preventDefault(); el.blur(); }
  }
  /* ── glisser-déposer : lignes et objets entre pièces, repères sur le plan, objets Foundry déposés ── */
  #dragStart(ev) {
    const tr = ev.target.closest?.(".lg-tr[draggable='true']"); if (tr) { const r = refOf(tr); ev.dataTransfer.setData("text/lg", JSON.stringify(r.k === "item" ? { k: "item", item: r.id } : { k: "line", room: r.room, line: r.id })); ev.dataTransfer.effectAllowed = "move"; return; }
    const line = ev.target.closest?.(".lg-line[draggable]"); const item = ev.target.closest?.(".lg-item[draggable]");
    if (line) { const room = line.closest("[data-room]")?.dataset.room; ev.dataTransfer.setData("text/lg", JSON.stringify({ k: "line", room, line: line.dataset.line })); ev.dataTransfer.effectAllowed = "move"; return; }
    if (item) { const a = this.doc; const it = a?.items.get(item.dataset.item); ev.dataTransfer.setData("text/lg", JSON.stringify({ k: "item", item: item.dataset.item })); if (it) ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: it.uuid })); }
  }
  async #drop(ev) {
    this.element?.querySelectorAll(".over").forEach(e => e.classList.remove("over"));
    const a = this.doc; if (!a) return; const zone = ev.target.closest(".lg-plan, .lg-lines, .lg-room"); if (!zone) return; ev.preventDefault(); if (!a.isOwner) return ui.notifications.warn("Tu n'as pas la main sur ce bien.");
    let lg = null; try { lg = JSON.parse(ev.dataTransfer.getData("text/lg") || "null"); } catch (e) {}
    if (zone.classList.contains("lg-plan")) { if (!lg) return; const g = this.#gridAt(zone, ev.clientX, ev.clientY); return this.#placeMark(a, lg.k === "item" ? { k: "item", id: lg.item } : { k: "line", id: lg.line, room: lg.room }, g, zone.dataset.floor); }
    const room = zone.dataset.room || zone.querySelector("[data-room]")?.dataset.room || zone.closest("[data-room]")?.dataset.room; if (!room) return;
    if (lg?.k === "line") { const before = ev.target.closest(".lg-line")?.dataset.line || null; return mut(a, s => { const A = linesOf(s, lg.room), B = linesOf(s, room); if (!A || !B) return false; const i = A.findIndex(l => l.id === lg.line); if (i < 0) return false; const [l] = A.splice(i, 1); if (lg.room !== room) { delete l.px; delete l.py; } const j = before ? B.findIndex(x => x.id === before) : -1; if (j >= 0) B.splice(j, 0, l); else B.push(l); return rl(s); }); }
    if (lg?.k === "item") { const it = a.items.get(lg.item); if (it && (it.flags?.[MOD]?.room || "_g") !== room) { await it.update({ [`flags.${MOD}.room`]: room, [`flags.${MOD}.px`]: null, [`flags.${MOD}.py`]: null }); return log(a, "info", `${it.name} rangé : ${roomName(a.system, room)}.`); } return; }
    let data; try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; } if (data?.type !== "Item") return; const it = await fromUuid(data.uuid); if (!it || it.parent?.id === a.id) return;
    if (!it.parent) { if (!game.user.isGM) return ui.notifications.warn("Seul le MJ peut ajouter un objet qui n'est sur aucune fiche."); const d = it.toObject(); delete d._id; d.flags = { ...(d.flags || {}), [MOD]: { room } }; await a.createEmbeddedDocuments("Item", [d]); return log(a, "deposit", `${it.name} ajouté (${roomName(a.system, room)}) par le MJ.`); }
    if (!it.parent.isOwner) return ui.notifications.warn("Cet objet n'est pas sur un de tes personnages.");
    const q = qtyOf(it) || 1; await moveItem(it, a, q, { room }); return log(a, "deposit", `${it.name} ×${q} déposé (${roomName(a.system, room)}) par ${game.user.name}.`);
  }
  #gridAt(plan, x, y) { const b = plan.getBoundingClientRect(); const C = +plan.dataset.cols || 24, Rr = +plan.dataset.rows || 14; return { x: Math.max(0, Math.min(C, (x - b.left) / b.width * C)), y: Math.max(0, Math.min(Rr, (y - b.top) / b.height * Rr)) }; }
  /* pose un repère (meuble ou objet) : il rejoint la pièce visible la plus au premier plan sous le curseur */
  async #placeMark(a, ref, g, fid) {
    const target = zSorted((a.system.rooms || []).filter(r => (r.floor || "f0") === fid)).reverse().find(r => g.x >= r.x && g.x <= r.x + r.w && g.y >= r.y && g.y <= r.y + r.h);
    const fx = T => Math.max(.02, Math.min(.98, (g.x - T.x) / T.w)), fy = T => Math.max(.02, Math.min(.98, (g.y - T.y) / T.h));
    if (ref.k === "item") { const it = a.items.get(ref.id); if (!it) return; const P = `flags.${MOD}`;
      if (!target) return it.update({ [`${P}.px`]: null, [`${P}.py`]: null });
      return it.update({ [`${P}.room`]: target.id, [`${P}.px`]: fx(target), [`${P}.py`]: fy(target), ...(mkOfItem(it) === "none" ? { [`${P}.mk`]: "icon" } : {}) }); }
    return mut(a, s => { const A = linesOf(s, ref.room); if (!A) return false; const i = A.findIndex(l => l.id === ref.id); if (i < 0) return false; const l = A[i];
      if (!target) { delete l.px; delete l.py; return rl(s); }
      const T = roomOf(s, target.id); l.px = fx(T); l.py = fy(T); if (mkOfLine(l) === "none") l.mk = "icon"; if (target.id !== ref.room) { A.splice(i, 1); T.lines ||= []; T.lines.push(l); } return rl(s); });
  }
  /* points d'une forme libre ou de la coque */
  async #vxDel(vx) { const a = this.doc; if (!a?.isOwner) return; const i = +vx.dataset.i, who = vx.dataset.vx; const fid = vx.closest(".lg-plan")?.dataset.floor;
    return mut(a, s => { if (who === "shell") { const f = (s.floors || []).find(x => x.id === fid); if (!f?.shell || f.shell.length <= 3) return false; f.shell.splice(i, 1); return { "system.floors": s.floors }; }
      const r = roomOf(s, who); if (!r?.pts || r.pts.length <= 3) return false; r.pts.splice(i, 1); Object.assign(r, bboxOf(r.pts)); return rl(s); }); }
  async #vxAdd(ev) {
    const plan = ev.target.closest?.(".lg-plan.ed"); const a = this.doc; if (!plan || !a?.isOwner || this.draw) return; const g = this.#gridAt(plan, ev.clientX, ev.clientY); const P = [snap(g.x), snap(g.y)]; const fid = plan.dataset.floor;
    const ins = pts => { let best = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const A = pts[i], B = pts[(i + 1) % pts.length]; const dx = B[0] - A[0], dy = B[1] - A[1]; const L = dx * dx + dy * dy || 1; let u = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L; u = Math.max(0, Math.min(1, u)); const d = Math.hypot(A[0] + u * dx - P[0], A[1] + u * dy - P[1]); if (d < bd) { bd = d; best = i; } } pts.splice(best + 1, 0, P); };
    if (this.shellEd) return mut(a, s => { const f = (s.floors || []).find(x => x.id === fid); if (!f?.shell) return false; ins(f.shell); return { "system.floors": s.floors }; });
    const pr = ev.target.closest(".lg-pr.shp-poly"); if (!pr || pr.dataset.room !== this.hl) return; return mut(a, s => { const r = roomOf(s, pr.dataset.room); if (!r?.pts) return false; ins(r.pts); Object.assign(r, bboxOf(r.pts)); return rl(s); });
  }
  /* tracé d'une forme libre / coque : aperçu */
  #ppDraw(plan) { const C = +plan.dataset.cols, Rr = +plan.dataset.rows; let sv = plan.querySelector(".lg-pprev"); if (!sv) { sv = document.createElementNS("http://www.w3.org/2000/svg", "svg"); sv.setAttribute("class", "lg-pprev"); sv.setAttribute("viewBox", `0 0 ${C} ${Rr}`); sv.setAttribute("preserveAspectRatio", "none"); plan.appendChild(sv); }
    const p = this.pp || []; sv.innerHTML = `<polyline points="${p.map(q => q.join(",")).join(" ")}"/>${p.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${i ? .22 : .38}" class="${i ? "" : "first"}"/>`).join("")}`; }
  async #ppFinish(plan) {
    const a = this.doc; const pts = this.pp; this.pp = null; this.#ppKeys(false); if (!a || !pts || pts.length < 3) return this.render(); const fid = plan.dataset.floor; const V = isVehicle(a);
    if (this.tool === "shell") { this.draw = false; await mut(a, s => { if (!s.floors?.length) s.floors = F0(); const f = s.floors.find(x => x.id === fid) || s.floors[0]; f.shell = pts; return { "system.floors": s.floors }; }); return log(a, "room", V ? "Coque dessinée." : "Contour dessiné."); }
    const r = await askRoom(); if (!r) return this.render(); const room = { id: rid(), name: r.name, kind: r.kind, floor: fid, shape: "poly", pts, ...bboxOf(pts), notes: "", lines: [] }; this.draw = false; this.flash = { room: room.id }; this.hl = room.id;
    await mut(a, s => { s.rooms ||= []; if (!s.floors?.length) s.floors = F0(); s.rooms.push(room); return rl(s); }); return log(a, "room", `${V ? "Zone" : "Pièce"} dessinée : ${r.name}.`);
  }
  #ppKeys(on) { if (!on) { if (this._ppk) document.removeEventListener("keydown", this._ppk, true); this._ppk = null; return; } if (this._ppk) return;
    this._ppk = ev => { if (!this.pp) return; const plan = this.element?.querySelector(".lg-plan"); if (!plan) return;
      if (ev.key === "Escape") { ev.stopPropagation(); ev.preventDefault(); this.pp = null; this.#ppKeys(false); plan.querySelector(".lg-pprev")?.remove(); }
      else if (ev.key === "Enter") { ev.preventDefault(); this.#ppFinish(plan); }
      else if (ev.key === "Backspace") { ev.preventDefault(); this.pp.pop(); this.#ppDraw(plan); } };
    document.addEventListener("keydown", this._ppk, true); }
  /* plan : glisser la vue, étirer le plan, déplacer / agrandir / remodeler une pièce, déplacer / agrandir un repère, dessiner */
  #planDown(ev) {
    const vp = ev.target.closest(".lg-planvp"); if (!vp || (ev.button !== 0 && ev.button !== 1)) return; const plan = vp.querySelector(".lg-plan"); if (!plan) return;
    const a = this.doc; const ed = !!a?.isOwner && plan.classList.contains("ed"); const C = +plan.dataset.cols, Rr = +plan.dataset.rows; const fid = plan.dataset.floor;
    const sz = ev.target.closest(".lg-sz"), vx = ev.target.closest(".lg-vx"), mrs = ev.target.closest(".lg-mrs"), mk = ev.target.closest(".lg-mk"), rs = ev.target.closest(".lg-rs"), pr = ev.target.closest(".lg-pr");
    const pct = (v, n) => (v / n * 100) + "%";
    /* 1. glisser la vue : main, bouton du milieu, ou appui dans le vide (hors dessin) */
    if (this.hand || ev.button === 1 || (!sz && !vx && !mk && !pr && !(this.draw && ed))) {
      if (!this.hand && ev.button === 0 && !ed && (pr || mk)) { if (mk && !pr) { const r = refOf(mk); this.flash = r.k === "item" ? { item: r.id } : { line: r.id }; this.rfold.delete(r.room); this.render(); } return; }
      ev.preventDefault(); const sx = ev.clientX, sy = ev.clientY, sl = vp.scrollLeft, st = vp.scrollTop; let moved = false; vp.classList.add("panning");
      const mv = e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; vp.scrollLeft = sl - dx; vp.scrollTop = st - dy; };
      const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); vp.classList.remove("panning"); if (moved) { const stop = c => { c.stopPropagation(); c.preventDefault(); }; vp.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => vp.removeEventListener("click", stop, { capture: true }), 60); } else if (!pr && !mk && this.hl && !this.hand) { this.hl = null; this.render(); } };
      addEventListener("pointermove", mv); addEventListener("pointerup", up); return; }
    if (!ed || ev.button !== 0) return;
    let moved = false; this.busy = true; ev.preventDefault();
    const finish = async fn => { try { await fn(); } finally { this.busy = false; if (this.pend) { this.pend = false; this.render(); } } };
    const drag = (mv, end) => { const up = e => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); finish(() => end(e)); }; addEventListener("pointermove", mv); addEventListener("pointerup", up); };
    /* 2. étirer le plan (mode « Taille du plan ») */
    if (sz) { const b = plan.getBoundingClientRect(), cell = b.width / C, U = usedExt(a.system, fid); let nc = C, nr = Rr;
      const gh = document.createElement("div"); gh.className = "lg-szghost"; gh.style.left = `${plan.offsetLeft}px`; gh.style.top = `${plan.offsetTop}px`; gh.style.width = `${b.width}px`; gh.style.height = `${b.height}px`; gh.innerHTML = `<b>${C} × ${Rr}</b>`; vp.appendChild(gh);
      return drag(e => { if (sz.dataset.sz !== "s") nc = Math.max(U.cols, Math.min(MAXD, Math.round(C + (e.clientX - ev.clientX) / cell))); if (sz.dataset.sz !== "e") nr = Math.max(U.rows, Math.min(MAXD, Math.round(Rr + (e.clientY - ev.clientY) / cell)));
        gh.style.width = `${nc * cell}px`; gh.style.height = `${nr * cell}px`; gh.firstChild.textContent = `${nc} × ${nr}`; vp.scrollLeft = Math.max(vp.scrollLeft, gh.offsetLeft + nc * cell - vp.clientWidth + 30); vp.scrollTop = Math.max(vp.scrollTop, gh.offsetTop + nr * cell - vp.clientHeight + 30); },
        () => { gh.remove(); if (nc === C && nr === Rr) return; return this.#resizeFloor(a, fid, nc, nr); }); }
    /* 3. point d'une forme libre / de la coque */
    if (vx) { const i = +vx.dataset.i, who = vx.dataset.vx; let g = null;
      return drag(e => { moved = true; g = this.#gridAt(plan, e.clientX, e.clientY); g = { x: snap(g.x), y: snap(g.y) }; vx.style.left = pct(g.x, C); vx.style.top = pct(g.y, Rr); },
        () => { if (!moved || !g) return; return mut(a, s => { if (who === "shell") { const f = (s.floors || []).find(x => x.id === fid); if (!f?.shell?.[i]) return false; f.shell[i] = [g.x, g.y]; return { "system.floors": s.floors }; }
          const r = roomOf(s, who); if (!r?.pts?.[i]) return false; r.pts[i] = [g.x, g.y]; Object.assign(r, bboxOf(r.pts)); return rl(s); }); }); }
    const g0 = this.#gridAt(plan, ev.clientX, ev.clientY);
    /* 4. repère en forme : agrandir par son coin (autour de son centre) */
    if (mrs && mk) { const ref = refOf(mk); const b = mk.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, cell = plan.getBoundingClientRect().width / C; let sw = null, sh = null;
      return drag(e => { moved = true; sw = Math.max(.5, snap(2 * Math.abs(e.clientX - cx) / cell)); sh = Math.max(.5, snap(2 * Math.abs(e.clientY - cy) / cell)); mk.style.width = pct(sw, C); mk.style.height = pct(sh, Rr); },
        () => moved && sw ? this.#setMark(a, ref, { sw, sh }) : null); }
    /* 5. repère posé : déplacer (ou clic : le retrouver dans la liste) */
    if (mk) return drag(e => { moved = true; const g = this.#gridAt(plan, e.clientX, e.clientY); mk.style.left = pct(g.x, C); mk.style.top = pct(g.y, Rr); },
      e => { const ref = refOf(mk); if (moved) return this.#placeMark(a, ref, this.#gridAt(plan, e.clientX, e.clientY), fid); this.rfold.delete(ref.room); this.flash = ref.k === "item" ? { item: ref.id } : { line: ref.id }; return this.render(); });
    /* 6. dessin */
    if (this.draw) { const tool = this.tool || "rect";
      if (tool === "poly" || tool === "shell") { this.busy = false; const P = [snap(g0.x), snap(g0.y)]; this.pp ||= []; this.#ppKeys(true);
        if (this.pp.length >= 3 && Math.hypot(P[0] - this.pp[0][0], P[1] - this.pp[0][1]) < .8) return this.#ppFinish(plan);
        const last = this.pp[this.pp.length - 1]; if (!last || last[0] !== P[0] || last[1] !== P[1]) this.pp.push(P); this.#ppDraw(plan); return; }
      const ghost = document.createElement("div"); ghost.className = `lg-pr ghost shp-${tool}`; plan.appendChild(ghost); let rect = null;
      return drag(e => { const g = this.#gridAt(plan, e.clientX, e.clientY); const x0 = Math.floor(Math.min(g0.x, g.x)), y0 = Math.floor(Math.min(g0.y, g.y)), x1 = Math.ceil(Math.max(g0.x, g.x)), y1 = Math.ceil(Math.max(g0.y, g.y)); rect = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }; ghost.style.left = pct(rect.x, C); ghost.style.top = pct(rect.y, Rr); ghost.style.width = pct(rect.w, C); ghost.style.height = pct(rect.h, Rr); },
        async () => { ghost.remove(); if (!rect || rect.w < 1 || rect.h < 1 || rect.w * rect.h < 2) return; const r = await askRoom(); if (!r) return; const room = { id: rid(), name: r.name, kind: r.kind, floor: fid, shape: tool, ...rect, notes: "", lines: [] }; this.draw = false; this.flash = { room: room.id }; this.hl = room.id;
          await mut(a, s => { s.rooms ||= []; if (!s.floors?.length) s.floors = F0(); s.rooms.push(room); return rl(s); }); return log(a, "room", `${isVehicle(a) ? "Zone" : "Pièce"} dessinée : ${r.name}.`); }); }
    /* 7. pièce : déplacer ou agrandir (une forme libre suit, ses points sont décalés / mis à l'échelle) */
    if (pr) { const r = roomOf(a.system, pr.dataset.room); if (!r) { this.busy = false; return; } const o = { x: r.x, y: r.y, w: r.w, h: r.h };
      const marks = [...plan.querySelectorAll(`.lg-mk[data-room="${r.id}"]`)].map(m => { const ref = refOf(m); return { m, P: ref.k === "item" ? itF(a.items.get(ref.id)) : (r.lines || []).find(x => x.id === ref.id) }; });
      return drag(e => { const g = this.#gridAt(plan, e.clientX, e.clientY); const dx = Math.round(g.x - g0.x), dy = Math.round(g.y - g0.y); if (dx || dy) moved = true;
          if (rs) { o.w = Math.max(1, Math.min(C - r.x, r.w + dx)); o.h = Math.max(1, Math.min(Rr - r.y, r.h + dy)); } else { o.x = Math.max(0, Math.min(C - r.w, r.x + dx)); o.y = Math.max(0, Math.min(Rr - r.h, r.y + dy)); }
          pr.style.left = pct(o.x, C); pr.style.top = pct(o.y, Rr); pr.style.width = pct(o.w, C); pr.style.height = pct(o.h, Rr); marks.forEach(({ m, P }) => { if (!P || P.px == null) return; m.style.left = pct(o.x + P.px * o.w, C); m.style.top = pct(o.y + P.py * o.h, Rr); }); },
        () => { if (!moved) { this.flash = { room: r.id }; this.hl = r.id; this.rfold.delete(r.id); this.ffold.delete(`${a.id}:${fid}`); return this.render(); }
          return mut(a, s => { const x = roomOf(s, r.id); if (!x) return false; if (x.pts?.length) x.pts = x.pts.map(q => [o.x + (q[0] - x.x) * (o.w / x.w), o.y + (q[1] - x.y) * (o.h / x.h)]); Object.assign(x, o); return rl(s); }); }); }
    this.busy = false;
  }
  async #resizeFloor(a, fid, c, r) { await mut(a, s => { if (!s.floors?.length) s.floors = F0(); const f = s.floors.find(x => x.id === fid) || s.floors[0]; const U = usedExt(s, f.id); f.cols = Math.max(U.cols, clampD(c)); f.rows = Math.max(U.rows, clampD(r)); return { "system.floors": s.floors }; }); delete this.zoom[`${a.id}:${fid}`]; }
}
/* première place libre sur la grille d'un étage */
function freeSpot(rooms, fid, w = 5, h = 4, COLS = 24, ROWS = 14) {
  const on = rooms.filter(r => (r.floor || "f0") === fid); const hit = (x, y) => on.some(r => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
  for (let y = 1; y + h <= ROWS; y++) for (let x = 1; x + w <= COLS; x++) if (!hit(x, y)) return { x, y, w, h };
  return { x: 1, y: 1, w, h };
}

/* rafraîchissement de la fenêtre quand un bien, un véhicule ou un objet d'un bien change */
let _rt = 0;
const touch = doc => { const a = doc?.documentName === "Item" ? doc.parent : doc; if (!a || !(isProperty(a) || isVehicle(a))) return; clearTimeout(_rt); _rt = setTimeout(() => foundry.applications.instances.get("vm-logement")?.refresh(), 60); };
for (const h of ["createActor", "updateActor", "deleteActor", "createItem", "updateItem", "deleteItem"]) Hooks.on(h, touch);
