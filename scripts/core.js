/* Véhicules Manhwa — outils communs : relais MJ (socket), déplacement d'objets, journal, droits, création depuis un objet. */
import { MOD, TYPE, CAT, FAMILIES, familyOf, baseStats, partInfo, DEFAULT_POSTS, SIZES } from "./data.js";

export const esc = s => foundry.utils.escapeHTML(String(s ?? ""));
export const isVehicle = a => a?.type === TYPE;
export const vehicles = () => game.actors.filter(isVehicle);
export const setting = k => game.settings.get(MOD, k);
export const plain = html => { const d = document.createElement("div"); d.innerHTML = String(html || ""); return d.textContent.trim(); };

/* ── personnages du joueur (ceux qu'il possède, hors véhicules) ── */
export function myCharacters(user = game.user) {
  const own = game.actors.filter(a => !isVehicle(a) && a.type !== `${MOD}.property` && a.testUserPermission(user, "OWNER") && (user.isGM ? a.hasPlayerOwner || a.id === user.character?.id : true));
  return own.sort((a, b) => (b.id === user.character?.id) - (a.id === user.character?.id) || a.name.localeCompare(b.name, "fr"));
}
export const usersOwning = a => game.users.filter(u => !u.isGM && a.testUserPermission(u, "OWNER"));

/* ── pièces / soute ── */
export const slotOf = it => it.getFlag?.(MOD, "slot") || it.flags?.[MOD]?.slot || "";
export const installed = actor => actor.items.filter(i => !!slotOf(i));
export const cargoItems = actor => actor.items.filter(i => !slotOf(i));
export function partOfItem(it) {
  const own = it.flags?.[MOD]; if (own?.slot && own.bonus) return { slot: own.slot, env: own.env || [], bonus: own.bonus };
  return partInfo({ name: it.name, flags: it.flags?.[CAT] || {}, category: it.system?.category || "" });
}
export const qtyOf = it => { const q = Number(it.system?.quantity); return Number.isFinite(q) ? q : 1; };
export const isVehicleItem = it => { const f = it.flags?.[CAT] || {}; if (partOfItem(it)) return false; const fam = familyOf({ name: it.name, cat: f.cat || "", sub: f.sub || "", category: it.system?.category || "" }); return !!fam; };

/* verrous par clé partagés avec Manhwa Sheet, le Gacha et le Catalogue (globalThis) : un personnage ou un véhicule n'est touché que par
 * une opération à la fois, tous modules confondus (1.3.0) */
const LOCKS = globalThis.__manhwaLocks ||= new Map();
export function withLock(key, fn) { const prev = LOCKS.get(key) || Promise.resolve(); const run = prev.then(fn); const tail = run.catch(() => {}); LOCKS.set(key, tail); tail.then(() => { if (LOCKS.get(key) === tail) LOCKS.delete(key); }); return run; }
export const actorLock = (actor, fn) => withLock(`actor:${actor?.uuid || actor}`, fn);
/** deux acteurs sous verrou (ordre fixe par uuid : pas d'interblocage) */
export const pairLock = (a, b, fn) => { if (!b || a === b || a?.uuid === b?.uuid) return actorLock(a, fn); const [x, y] = [a, b].sort((p, q) => String(p.uuid).localeCompare(String(q.uuid))); return actorLock(x, () => actorLock(y, fn)); };

/** déplace qty exemplaires d'un objet vers un autre acteur : 1) retrait de la source, 2) copie chez la destination, sous verrou des deux ;
 * si la copie échoue, la source est rendue (jamais de doublon : rien n'est créé avant d'avoir été retiré) */
export async function moveItem(item, dest, qty = 1, flags = {}) {
  const src = item.parent; return pairLock(src, dest, () => moveItemLocked(item, dest, qty, flags));
}
async function moveItemLocked(item, dest, qty, flags) {
  item = item.parent?.items.get(item.id) || item;   /* relu sous verrou */
  const have = qtyOf(item); qty = Math.max(1, Math.min(qty, have || 1)); if (!have) return null;
  const data = item.toObject(); delete data._id; delete data.folder; delete data.sort;
  foundry.utils.setProperty(data, "system.quantity", qty);
  if (data.system && "equipped" in data.system) data.system.equipped = false;
  data.flags = data.flags || {}; data.flags[MOD] = { ...(data.flags[MOD] || {}) }; delete data.flags[MOD].slot; delete data.flags[MOD].bonus;
  Object.assign(data.flags[MOD], flags);
  /* empile dans la soute si un objet identique (même nom, même origine Catalogue) y est déjà */
  const stack = !flags.slot && dest.items.find(i => !slotOf(i) && (i.flags?.[MOD]?.room || "") === (flags.room || "") && i.name === data.name && (i.flags?.[CAT]?.id || "") === (data.flags?.[CAT]?.id || "") && i.type === data.type);
  const back = item.toObject(); const parent = item.parent;
  if (have > qty) await item.update({ "system.quantity": have - qty }); else await item.delete();
  try {
    let created;
    if (stack) { await stack.update({ "system.quantity": qtyOf(stack) + qty }); created = stack; }
    else [created] = await dest.createEmbeddedDocuments("Item", [data]);
    return created;
  } catch (err) {
    console.error(MOD, "transfert interrompu, objet rendu", err);
    try { const it = parent?.items.get(back._id); if (it) await it.update({ "system.quantity": qtyOf(it) + qty }); else await parent.createEmbeddedDocuments("Item", [back], { keepId: true }); } catch (e2) { console.error(MOD, e2); }
    throw err;
  }
}

/* ── journal de bord ── */
export const LOG_ICONS = { install: "fa-screwdriver-wrench", remove: "fa-wrench", deposit: "fa-box-open", withdraw: "fa-hand-holding", hull: "fa-shield-halved", access: "fa-key", crew: "fa-users", info: "fa-feather", create: "fa-anchor" };
export async function log(actor, k, txt) {
  return withLock(`log:${actor.uuid}`, async () => { const list = [{ t: Date.now(), u: game.user.name, k, txt }, ...(actor.system.log || [])].slice(0, 300);
    try { await actor.update({ "system.log": list }, { vmLog: true }); } catch (e) { console.warn(MOD, e); } });
}

/* ── relais MJ ── */
const handlers = {}; const waiting = new Map();
export const onGm = (op, fn) => { handlers[op] = fn; };
const activeGm = () => game.users.activeGM ?? game.users.find(u => u.isGM && u.active);
const SEEN = new Map();
const runGm = (op, data, userId) => withLock(`gm:${MOD}`, () => handlers[op]?.(data, userId));   /* une requête à la fois */
export async function gmDo(op, data = {}) {
  if (game.user.isGM) { const r = await runGm(op, data, game.user.id); if (r && typeof r === "object" && "msg" in r) { if (r.msg) ui.notifications[r.ok !== false ? "info" : "warn"](r.msg); return r.ok === false ? null : (r.value ?? null); } return r ?? null; }
  if (!activeGm()) { ui.notifications.warn("Aucun MJ connecté : cette action passe par le MJ."); return null; }
  const rid = foundry.utils.randomID(); game.socket.emit(`module.${MOD}`, { op, data, from: game.user.id, rid });
  return new Promise(res => { const t = setTimeout(() => { waiting.delete(rid); ui.notifications.warn("Le MJ n'a pas répondu."); res(null); }, 10000); waiting.set(rid, v => { clearTimeout(t); res(v); }); });
}
export function initSocket() {
  game.socket.on(`module.${MOD}`, async m => {
    if (!m) return;
    if (m.op === "reply") { if (m.to === game.user.id) { const f = waiting.get(m.rid); if (f) { waiting.delete(m.rid); if (m.msg) ui.notifications[m.ok ? "info" : "warn"](m.msg); f(m.value ?? null); } } return; }
    if (!game.user.isGM || activeGm()?.id !== game.user.id) return;
    const sender = game.users.get(m.from); if (!sender || sender.isGM || !sender.active) { console.warn(MOD, "requête refusée (expéditeur invalide)", m.op, m.from); return; }   /* un MJ exécute en local : une requête « MJ » venue du réseau est forgée */
    if (m.rid) { const now = Date.now(); for (const [k, t] of SEEN) if (now - t > 60000) SEEN.delete(k); if (SEEN.has(m.rid)) return; SEEN.set(m.rid, now); }
    let value = null, ok = true, msg = "";
    try { const r = await runGm(m.op, m.data || {}, m.from); if (r && typeof r === "object" && "msg" in r) { ok = r.ok !== false; msg = r.msg; value = r.value ?? null; } else value = r ?? null; }
    catch (e) { console.error(MOD, e); ok = false; msg = "Erreur côté MJ : " + e.message; }
    game.socket.emit(`module.${MOD}`, { op: "reply", to: m.from, rid: m.rid, ok, msg, value });
  });
}

/* ── création ── */
export async function vehicleFolder() {
  return withLock(`folder:${MOD}`, async () => {
    let f = game.folders.find(x => x.type === "Actor" && x.getFlag(MOD, "root")); if (f) return f;
    f = game.folders.find(x => x.type === "Actor" && x.name === "Véhicules" && !x.folder);
    if (!f) f = await Folder.create({ name: "Véhicules", type: "Actor", color: "#1a6f9a", flags: { [MOD]: { root: true } } });
    return f; });
}
export function profileFromItem(it) {
  const f = it.flags?.[CAT] || {}; const fam = familyOf({ name: it.name, cat: f.cat || "", sub: f.sub || "", category: it.system?.category || "" }) || "autre";
  const P = FAMILIES[fam] || FAMILIES.autre; const rank = String(f.rang || it.system?.rank || P.ref).toUpperCase();
  const desc = f.desc || plain(it.system?.description);
  return { family: fam, env: P.env, size: P.size, rank, rarity: f.rar || "", catalogueId: f.id || "", origin: f.cat ? `${f.cat}${f.sub ? " › " + f.sub : ""}` : P.name, base: baseStats(fam, rank, desc), description: it.system?.description || "", hull: null, hullStage: 0, showCrew: SIZES[P.size].order >= 2, posts: SIZES[P.size].order >= 2 ? DEFAULT_POSTS[P.env].map(n => ({ id: foundry.utils.randomID(), name: n, uuid: "" })) : [] };
}
export function profileFromFamily(fam, rank) {
  const P = FAMILIES[fam] || FAMILIES.autre; rank = rank || P.ref;
  return { family: fam, env: P.env, size: P.size, rank, rarity: "", catalogueId: "", origin: P.name, base: baseStats(fam, rank, ""), hull: null, hullStage: 0, showCrew: SIZES[P.size].order >= 2, posts: SIZES[P.size].order >= 2 ? DEFAULT_POSTS[P.env].map(n => ({ id: foundry.utils.randomID(), name: n, uuid: "" })) : [] };
}

/* le MJ met en service le véhicule d'un joueur : l'objet quitte son inventaire, la fiche Véhicule apparaît, le joueur en est propriétaire */
onGm("create", async ({ itemUuid, family, name, rank, owner: ownerIn }, userId) => {
  let owner = ownerIn;
  const user = game.users.get(userId); let sys, img = null, nm = name, source = null;
  if (itemUuid) {
    const it = await fromUuid(itemUuid); if (!it?.parent) return { ok: false, msg: "Objet introuvable." };
    if (!it.parent.testUserPermission(user, "OWNER")) return { ok: false, msg: "Tu ne possèdes pas ce personnage." };
    sys = profileFromItem(it); img = it.img; nm = nm || it.name; source = it.toObject();
    if (!owner && user.isGM) owner = game.users.find(u => !u.isGM && it.parent.testUserPermission(u, "OWNER"))?.id || userId;
  } else { if (!user.isGM) return { ok: false, msg: "Seul le MJ crée un véhicule sans objet." }; sys = profileFromFamily(family || "autre", rank); nm = nm || FAMILIES[family]?.name || "Véhicule"; }
  const ownerId = owner || (user.isGM ? "" : userId);
  const ownership = { default: 0 }; if (ownerId) ownership[ownerId] = 3;
  const folder = await vehicleFolder();
  /* sous verrou du personnage : l'objet est relu, la fiche créée d'abord, l'objet retiré ensuite (avant : objet détruit si la création échouait ; deux demandes sur une pile → deux fiches pour un seul objet retiré) */
  const srcActor = itemUuid ? (await fromUuid(itemUuid))?.parent : null;
  const a = await (srcActor ? actorLock(srcActor, () => createVehicle()) : createVehicle());
  if (!a) return { ok: false, msg: "L'objet n'est plus dans l'inventaire." };
  async function createVehicle() {
  let it = null; if (itemUuid) { it = await fromUuid(itemUuid); if (!it?.parent || qtyOf(it) < 1) return null; }
  const made = await Actor.create({ name: nm, type: TYPE, img: img || "icons/svg/anchor.svg", folder: folder.id, ownership, system: { ...sys, owner: ownerId, log: [{ t: Date.now(), u: user.name, k: "create", txt: itemUuid ? `${nm} mis en service par ${user.name}.` : `${nm} créé par le MJ.` }] }, flags: { [MOD]: source ? { source } : {} }, prototypeToken: { name: nm, actorLink: true, texture: { src: img || "icons/svg/anchor.svg" } } });
  if (it) { try { if (qtyOf(it) > 1) await it.update({ "system.quantity": qtyOf(it) - 1 }); else await it.delete(); } catch (err) { console.error(MOD, err); await made.delete(); throw err; } }
  return made; }
  return { ok: true, msg: `${nm} est en service.`, value: a.uuid };
});
/* droits : le propriétaire (ou le MJ) donne « modifier » (OWNER), « voir » (OBSERVER) ou rien */
onGm("access", async ({ vehicle, target, level }, userId) => {
  const v = await fromUuid(vehicle); const u = game.users.get(userId); const t = game.users.get(target);
  if (!v || !t) return { ok: false, msg: "Introuvable." };
  if (!u.isGM && v.system.owner !== userId) return { ok: false, msg: "Seul le propriétaire gère les droits." };
  if (target === v.system.owner && !u.isGM) return { ok: false, msg: "Le propriétaire garde ses droits." };
  const lv = { edit: 3, view: 2, none: 0 }[level] ?? 0;
  await v.update({ [`ownership.${target}`]: lv, "system.log": [{ t: Date.now(), u: u.name, k: "access", txt: `${t.name} : ${{ 3: "peut modifier", 2: "peut voir", 0: "plus d'accès" }[lv]}.` }, ...(v.system.log || [])].slice(0, 300) });
  return { ok: true, msg: `Droits de ${t.name} mis à jour.` };
});
onGm("owner", async ({ vehicle, target }, userId) => {
  const v = await fromUuid(vehicle); const u = game.users.get(userId); if (!v) return { ok: false, msg: "Introuvable." };
  if (!u.isGM && v.system.owner !== userId) return { ok: false, msg: "Seul le propriétaire peut céder le véhicule." };
  const upd = { "system.owner": target || "" }; if (target) upd[`ownership.${target}`] = 3;
  await v.update(upd); return { ok: true, msg: "Propriétaire changé." };
});
