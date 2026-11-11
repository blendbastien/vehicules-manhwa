/* Véhicules Manhwa — fiche du véhicule (ActorSheetV2). */
import { MOD, SLOTS, SLOT_KEYS, ENVS, SIZES, STATS, STAT_KEYS, FAMILIES, RANKS, HULL_STATES, compute, tierOf, fmtBonus, fmtStat, fmtN, sizeSlots, baseStats, DEFAULT_POSTS, BONUS_KEYS } from "./data.js";
import { esc, setting, myCharacters, installed, cargoItems, partOfItem, slotOf, qtyOf, moveItem, log, gmDo, LOG_ICONS, isVehicle, usersOwning, actorLock } from "./core.js";
import { renderSheet } from "./view.js";

const { ActorSheetV2 } = foundry.applications.sheets;
const { DialogV2 } = foundry.applications.api;
const RANK_COL = { F: "#9aa4b8", E: "#7ee08a", D: "#5ab8ff", C: "#b47bff", B: "#ffcf4a", A: "#ff8a3a", S: "#ff4d6d", SS: "#ff3df0", SSS: "#ffffff" };
export const rankColor = r => { try { const c = globalThis.MANHWA?.config?.(); const x = c?.ranks?.find(k => String(k.key).toUpperCase() === String(r).toUpperCase() || String(k.name).toUpperCase() === String(r).toUpperCase()); if (x?.color) return x.color; } catch (e) {} return RANK_COL[String(r).toUpperCase()] || "#9fd8ff"; };
const dlg = (title, content, opts = {}) => DialogV2.wait({ window: { title, icon: opts.icon || "fa-solid fa-gears" }, classes: ["vm-dialog"], position: { width: opts.width || 520 }, content, buttons: opts.buttons || [{ action: "ok", label: opts.ok || "Valider", icon: "fa-solid fa-check", default: true, callback: (ev, btn) => btn.form }, { action: "no", label: "Annuler", icon: "fa-solid fa-xmark" }], rejectClose: false, render: (ev, d) => { try { d.bringToFront?.(); } catch (e) {} opts.render?.(ev, d); } });

export class VehicleSheet extends ActorSheetV2 {
  static DEFAULT_OPTIONS = { classes: ["vm-sheet"], position: { width: 1020, height: 760 }, window: { resizable: true, icon: "fa-solid fa-sailboat" }, form: { submitOnChange: false } };
  tab = "plan";
  get title() { return this.document.name; }

  #vm() {
    const a = this.document, s = a.system, gm = game.user.isGM, mode = setting("mode");
    const parts = installed(a).map(it => { const p = partOfItem(it) || { slot: slotOf(it), bonus: {} }; return { id: it.id, name: it.name, img: it.img, slot: slotOf(it), bonus: it.flags?.[MOD]?.bonus || p.bonus || {}, guessed: !it.flags?.[MOD]?.bonus && p.guessed, desc: (it.flags?.["last-horizon-catalogue"]?.desc) || "" }; });
    const C = compute(s, parts, setting("sizeSlots"));
    const env = { key: s.env, ...(ENVS[s.env] || ENVS.land) }; const fam = FAMILIES[s.family] || FAMILIES.autre;
    const slots = SLOT_KEYS.map(k => ({ key: k, ...SLOTS[k], ...C.slots[k], parts: C.slots[k].parts.map(p => ({ ...p, bonus: fmtBonus(p.bonus) })) })).filter(x => x.key !== "wheels" || s.env === "land" || x.total || x.used);
    const stats = STAT_KEYS.filter(k => k !== "hull").map(k => ({ key: k, ...STATS[k], color: { armor: SLOTS.defense.color, speed: SLOTS.propulsion.color, handling: SLOTS.steering.color, firepower: SLOTS.weapons.color, cargo: SLOTS.cargo.color, autonomy: "#7cf0c8", comfort: SLOTS.comfort.color, crew: "#cfd8f5", passengers: "#cfd8f5" }[k], value: C.eff[k], tier: tierOf(k, C.eff[k]), ...C.detail[k] }));
    stats.unshift({ key: "hull", ...STATS.hull, color: SLOTS.hull.color, value: C.eff.hull, tier: tierOf("hull", C.eff.hull), ...C.detail.hull });
    const hullMax = C.eff.hull; const hullCur = s.hull === null || s.hull === undefined ? hullMax : Math.min(hullMax, Math.max(0, Number(s.hull)));
    const vis = x => x && (gm || x.testUserPermission(game.user, "LIMITED"));
    const vm = {
      tab: this.tab, name: a.name, img: a.img, env, family: s.family, famName: fam.name, famIcon: fam.icon, size: s.size, sizeName: SIZES[s.size]?.name || s.size, rank: s.rank || "F", rarity: s.rarity, origin: s.origin, rankColor: rankColor(s.rank || "F"),
      mode, canEdit: a.isOwner, isGM: gm, pinned: (() => { try { return game.settings.get(MOD, "hudVehicle") === a.uuid; } catch (e) { return false; } })(), ownerName: game.users.get(s.owner)?.name || "",
      hull: { cur: hullCur, max: hullMax, stage: s.hullStage || 0 }, stats, slots,
      cargo: cargoItems(a).map(it => ({ id: it.id, name: it.name, img: it.img, qty: qtyOf(it), part: partOfItem(it)?.slot || "" })),
      cargoCap: fmtStat("cargo", C.eff.cargo),
      docked: (s.docked || []).map(u => fromUuidSync(u)).filter(Boolean).map(v => ({ uuid: v.uuid, name: v.name, img: v.img, size: SIZES[v.system?.size]?.name || "" })),
      showCrew: s.showCrew, crewNeed: C.eff.crew, passengers: C.eff.passengers,
      posts: (s.posts || []).map(p => { const x = p.uuid ? fromUuidSync(p.uuid) : null; return { id: p.id, name: p.name, filled: !!p.uuid, actor: vis(x) ? { name: x.name, img: x.img } : null }; }),
      log: (s.log || []).slice(0, 150).map(l => ({ ...l, icon: LOG_ICONS[l.k] || "fa-feather", when: new Date(l.t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) })),
      access: this.#access(),
      gm: gm ? { families: Object.fromEntries(Object.entries(FAMILIES).map(([k, f]) => [k, `${f.name} (${ENVS[f.env].name.toLowerCase()})`])), envs: Object.fromEntries(Object.entries(ENVS).map(([k, e]) => [k, e.name])), sizes: Object.fromEntries(Object.entries(SIZES).map(([k, z]) => [k, z.name])), ranks: RANKS,
        baseRows: STAT_KEYS.map(k => ({ key: k, name: STATS[k].name, icon: STATS[k].icon, unit: STATS[k].unit, value: Number(s.base?.[k]) || 0 })), slotsOverride: s.slotsOverride || {}, sizeDefault: { ...sizeSlots(s.size, setting("sizeSlots")), ...(s.env !== "land" ? { wheels: 0 } : {}) },
        sizeDefaultTxt: SIZES[s.size]?.name || "" } : null
    };
    return vm;
  }

  #access() {
    const a = this.document, s = a.system; const manage = game.user.isGM || s.owner === game.user.id;
    const lvOf = u => { const l = a.ownership?.[u.id] ?? a.ownership?.default ?? 0; return l >= 3 ? "edit" : l >= 1 ? "view" : "none"; };
    const players = game.users.filter(u => !u.isGM);
    const rows = players.filter(u => lvOf(u) !== "none" || u.id === s.owner).map(u => ({ id: u.id, name: u.name, color: u.color?.css ?? u.color ?? "#8ea0c8", level: lvOf(u), owner: u.id === s.owner, src: u.id === s.owner ? "propriétaire" : "" }));
    const cand = new Map();
    if (manage) {
      const ownerUser = game.users.get(s.owner) || game.user; const mine = game.actors.filter(x => !isVehicle(x) && x.testUserPermission(ownerUser, "OWNER") && x.hasPlayerOwner);
      const addActor = (uuid, src) => { const x = fromUuidSync(uuid); if (!x) return; for (const u of usersOwning(x)) if (u.id !== s.owner && !rows.some(r => r.id === u.id) && !cand.has(u.id)) cand.set(u.id, { id: u.id, name: u.name, color: u.color?.css ?? u.color ?? "#8ea0c8", level: "none", src: `${src} · ${x.name}` }); };
      try { const parties = game.settings.get("manhwa-sheet", "parties")?.list || []; for (const p of parties) if (p.members.some(m => mine.some(c => c.uuid === m.uuid))) for (const m of p.members) addActor(m.uuid, `groupe ${p.name}`); } catch (e) {}
      const walk = l => { for (const n of l || []) { if (n.folder) walk(n.children); else if (n.uuid) addActor(n.uuid, "ami"); } };
      for (const c of mine) walk(c.system?.carnet?.friends);
      if (game.user.isGM) for (const u of players) if (!rows.some(r => r.id === u.id) && !cand.has(u.id)) cand.set(u.id, { id: u.id, name: u.name, color: u.color?.css ?? u.color ?? "#8ea0c8", level: "none", src: "joueur" });
    }
    return { manage, rows, candidates: [...cand.values()], users: players.map(u => ({ id: u.id, name: u.name })), ownerId: s.owner };
  }

  async _renderHTML() { return renderSheet(this.#vm()); }
  _replaceHTML(html, content) {
    const y = content.querySelector(".vm-body")?.scrollTop || 0; content.innerHTML = html; const b = content.querySelector(".vm-body"); if (b) b.scrollTop = y; globalThis.MANHWA?.pickers?.bind(content);
    if (!content.dataset.vmBound) { content.dataset.vmBound = "1"; content.addEventListener("click", ev => this.#click(ev)); content.addEventListener("change", ev => this.#change(ev)); content.addEventListener("dragover", ev => ev.preventDefault()); content.addEventListener("drop", ev => this.#drop(ev)); }
  }

  /* ── clics ── */
  async #click(ev) {
    const el = ev.target.closest("[data-vm]"); if (!el) return; const act = el.dataset.vm; const a = this.document; const id = el.closest("[data-id]")?.dataset.id;
    switch (act) {
      case "tab": this.tab = el.dataset.tab; return this.render();
      case "domaine": return globalThis.VEHICULES?.logement?.(a.uuid);
      case "jump": { this.tab = "plan"; const sec = this.element.querySelector(`#vm-slot-${el.dataset.slot}`); sec?.scrollIntoView({ behavior: "smooth", block: "center" }); sec?.classList.add("flash"); setTimeout(() => sec?.classList.remove("flash"), 900); return; }
      case "stage": { const v = Number(el.dataset.v); await a.update({ "system.hullStage": v }); return log(a, "hull", `Coque : ${HULL_STATES[v]}.`); }
      case "hull": { const d = Number(el.dataset.d) * (ev.shiftKey ? 10 : 1); const v = await actorLock(a, async () => { const vm = this.#vm(); const v = Math.max(0, Math.min(vm.hull.max, vm.hull.cur + d)); await a.update({ "system.hull": v }); return v; });; return; }
      case "pin": { const { pinHud } = await import("./hud.js"); await pinHud(a); return this.render(); }
      case "img": return new foundry.applications.apps.FilePicker.implementation({ type: "image", current: a.img, callback: p => a.update({ img: p, "prototypeToken.texture.src": p }) }).browse();
      case "install": return this.#install(el.dataset.slot);
      case "uninstall": return this.#uninstall(id);
      case "editPart": return this.#editPart(id);
      case "deposit": return this.#deposit();
      case "withdraw": return this.#withdraw(id);
      case "dock": return this.#dock();
      case "undock": { await actorLock(a, () => a.update({ "system.docked": (a.system.docked || []).filter(u => u !== el.dataset.uuid) })); const v = fromUuidSync(el.dataset.uuid); return log(a, "withdraw", `${v?.name || "Un véhicule"} quitte la soute.`); }
      case "addPost": return actorLock(a, () => { const posts = [...(a.system.posts || []), { id: foundry.utils.randomID(), name: (DEFAULT_POSTS[a.system.env] || DEFAULT_POSTS.land)[(a.system.posts || []).length] || "Nouveau poste", uuid: "" }]; return a.update({ "system.posts": posts }); });
      case "delPost": return actorLock(a, () => a.update({ "system.posts": (a.system.posts || []).filter(p => p.id !== id) }));
      case "unassign": return this.#setPost(id, "");
      case "assign": return this.#assign(id);
      case "applyProfile": { if (!game.user.isGM) return; const ok = await DialogV2.confirm({ window: { title: "Recalculer la base" }, content: `<p>Remplacer les caractéristiques de base par celles du profil « ${esc(FAMILIES[a.system.family]?.name)} » au rang ${esc(a.system.rank)} ?</p>` }); if (!ok) return; return a.update({ "system.base": baseStats(a.system.family, a.system.rank, "") }); }
    }
  }

  /* ── champs ── */
  async #change(ev) {
    const el = ev.target.closest("[data-vmf]"); if (!el) return; const f = el.dataset.vmf; const a = this.document; const v = el.type === "checkbox" ? el.checked : el.value;
    switch (f) {
      case "name": if (v.trim()) { await a.update({ name: v.trim(), "prototypeToken.name": v.trim() }); } return;
      case "hull": { const vm = this.#vm(); return a.update({ "system.hull": Math.max(0, Math.min(vm.hull.max, Number(v) || 0)) }); }
      case "showCrew": return a.update({ "system.showCrew": v });
      case "postName": { const id = el.closest("[data-id]").dataset.id; return actorLock(a, () => a.update({ "system.posts": a.system.posts.map(p => p.id === id ? { ...p, name: v } : p) })); }
      case "access": { await gmDo("access", { vehicle: a.uuid, target: el.dataset.user, level: v }); return; }
      case "owner": { const t = el.tagName === "SELECT" ? v : (el.querySelector('input[name="vmowner"]')?.value || ""); if (t === (a.system.owner || "")) return; await gmDo("owner", { vehicle: a.uuid, target: t }); return; }
      case "family": case "env": case "size": case "rank": case "rarity": case "origin": { const upd = { [`system.${f}`]: v }; if (f === "family") { const P = FAMILIES[v]; if (P) { upd["system.env"] = P.env; upd["system.size"] = P.size; } } return a.update(upd); }
      case "base": return a.update({ [`system.base.${el.dataset.k}`]: Number(v) || 0 });
      case "slot": { const k = el.dataset.k; return a.update(v === "" ? { [`system.slotsOverride.-=${k}`]: null } : { [`system.slotsOverride.${k}`]: Math.max(0, Number(v) || 0) }); }
    }
  }

  /* ── glisser-déposer : objet sur un emplacement = installer, ailleurs = déposer en soute ; véhicule = garer ── */
  async #drop(ev) {
    ev.preventDefault(); let data; try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { return; }
    const a = this.document; if (!a.isOwner) return ui.notifications.warn("Tu n'as pas l'accès modification sur ce véhicule.");
    if (data.type === "Actor") { const v = await fromUuid(data.uuid); if (isVehicle(v)) return this.#doDock(v); return; }
    if (data.type !== "Item") return; const it = await fromUuid(data.uuid); if (!it) return;
    if (it.parent?.id === a.id) return;
    const slot = ev.target.closest("[data-slot]")?.dataset.slot;
    if (!it.parent) { if (!game.user.isGM) return ui.notifications.warn("Seul le MJ peut ajouter un objet qui n'est sur aucune fiche."); const d = it.toObject(); delete d._id; const p = partOfItem(it); if (slot) { d.flags = { ...(d.flags || {}), [MOD]: { slot, bonus: p?.slot === slot ? p.bonus : {}, env: p?.env || [] } }; } await a.createEmbeddedDocuments("Item", [d]); return log(a, slot ? "install" : "deposit", `${it.name} ${slot ? `installé (${SLOTS[slot].name})` : "ajouté à la soute"} par le MJ.`); }
    if (!it.parent.isOwner) return ui.notifications.warn("Cet objet n'est pas sur un de tes personnages.");
    if (slot) return this.#doInstall(it, slot);
    return this.#doDeposit(it, qtyOf(it));
  }

  /* ── installer ── */
  async #install(slot) {
    const a = this.document; const env = a.system.env; const chars = myCharacters();
    const cand = []; const other = [];
    for (const c of chars) for (const it of c.items) { const p = partOfItem(it); if (p?.slot === slot) cand.push({ it, c, p, ok: !p.env?.length || p.env.includes(env) }); else if (game.user.isGM && !p) other.push({ it, c }); }
    if (!cand.length && !other.length) return ui.notifications.info(`Aucune pièce « ${SLOTS[slot].name} » sur tes personnages. Les pièces s'achètent dans le Catalogue (Véhicules › Modules).`);
    const row = (x, i, custom) => `<label class="vm-pick ${x.ok === false ? "bad" : ""}"><input type="radio" name="pick" value="${custom ? "o" : "c"}${i}" ${x.ok === false ? "" : ""}><img src="${esc(x.it.img)}"><span><b>${esc(x.it.name)}</b><small>${custom ? "pièce personnalisée (bonus à régler)" : esc(fmtBonus(x.p.bonus).join(" · ") || "aucun bonus")}${x.ok === false ? ` · <em>prévue pour ${x.p.env.map(e => ENVS[e]?.name.toLowerCase()).join(", ")}</em>` : ""}</small><small class="who">sur ${esc(x.c.name)}${qtyOf(x.it) > 1 ? ` · ×${qtyOf(x.it)}` : ""}</small></span></label>`;
    const form = await dlg(`Installer · ${SLOTS[slot].name}`, `<div class="vm-dlg"><p>Choisis une pièce portée par un de tes personnages. Elle quitte son inventaire et rejoint le véhicule.</p><div class="vm-picks">${cand.map((x, i) => row(x, i)).join("") || `<p class="vm-hint">Aucune pièce de ce type.</p>`}</div>${other.length ? `<details><summary>Autres objets (MJ : installer comme pièce personnalisée)</summary><div class="vm-picks">${other.map((x, i) => row(x, i, true)).join("")}</div></details>` : ""}</div>`, { icon: `fa-solid ${SLOTS[slot].icon}`, ok: "Installer", width: 560 });
    const v = form?.elements?.pick?.value; if (!v) return; const x = v[0] === "c" ? cand[Number(v.slice(1))] : other[Number(v.slice(1))]; if (!x) return;
    if (x.ok === false && !await DialogV2.confirm({ window: { title: "Pièce inadaptée" }, content: `<p>${esc(x.it.name)} est prévue pour ${x.p.env.map(e => ENVS[e]?.name.toLowerCase()).join(", ")}. L'installer quand même ?</p>` })) return;
    return this.#doInstall(x.it, slot, v[0] === "o");
  }
  async #doInstall(it, slot, custom = false) {
    const a = this.document; const p = partOfItem(it); const vm = this.#vm(); const s = vm.slots.find(z => z.key === slot) || { used: 0, total: 0 };
    if (!custom && p && p.slot !== slot) return ui.notifications.warn(`${it.name} se monte en « ${SLOTS[p.slot]?.name} », pas en « ${SLOTS[slot].name} ».`);
    if (!p && !custom && !game.user.isGM) return ui.notifications.warn(`${it.name} n'est pas une pièce de véhicule.`);
    if (s.used >= s.total) return ui.notifications.warn(`Plus d'emplacement « ${SLOTS[slot].name} » libre (${s.used}/${s.total}).`);
    const from = it.parent?.name || "";
    await moveItem(it, a, 1, { slot, bonus: p && !custom ? p.bonus : {}, env: p?.env || [], from });
    ui.notifications.info(`${it.name} installé sur ${a.name}.`);
    return log(a, "install", `${it.name} installé (${SLOTS[slot].name})${from ? ` depuis ${from}` : ""}.`);
  }
  async #uninstall(id) {
    const a = this.document; const it = a.items.get(id); if (!it) return; const chars = myCharacters();
    const form = await dlg("Retirer la pièce", `<div class="vm-dlg"><p>Où ranger <b>${esc(it.name)}</b> ?</p><select name="to">${chars.map(c => `<option value="${c.uuid}">Sur ${esc(c.name)}</option>`).join("")}<option value="hold">Dans la soute du véhicule</option></select></div>`, { icon: "fa-solid fa-wrench", ok: "Retirer" });
    const to = form?.elements?.to?.value; if (!to) return; const slot = slotOf(it);
    if (to === "hold") { await it.update({ [`flags.${MOD}.-=slot`]: null, [`flags.${MOD}.-=bonus`]: null }); return log(a, "remove", `${it.name} retiré (${SLOTS[slot]?.name}) et rangé dans la soute.`); }
    const dest = await fromUuid(to); await moveItem(it, dest, qtyOf(it)); return log(a, "remove", `${it.name} retiré (${SLOTS[slot]?.name}) et rendu à ${dest.name}.`);
  }
  async #editPart(id) {
    const a = this.document; const it = a.items.get(id); if (!it || !game.user.isGM) return; const p = partOfItem(it) || { slot: slotOf(it), bonus: {} }; const b = it.flags?.[MOD]?.bonus || p.bonus || {};
    const lab = { ...Object.fromEntries(Object.entries(STATS).map(([k, s]) => [k, s.name + (s.unit ? ` (${s.unit})` : "")])), speedPct: "Vitesse (%)", autonomyPct: "Autonomie (%)" };
    const form = await dlg(`Bonus · ${it.name}`, `<div class="vm-dlg"><label>Emplacement <select name="slot">${SLOT_KEYS.map(k => `<option value="${k}" ${k === slotOf(it) ? "selected" : ""}>${SLOTS[k].name}</option>`).join("")}</select></label>
      <h4>Bonus</h4><div class="vm-grid3">${BONUS_KEYS.map(k => `<label>${lab[k]}<input type="number" name="b.${k}" value="${Number(b[k]) || 0}"></label>`).join("")}</div>
      <h4>Emplacements ajoutés</h4><div class="vm-grid3">${SLOT_KEYS.map(k => `<label>${SLOTS[k].name}<input type="number" name="s.${k}" value="${Number(b.slots?.[k]) || 0}"></label>`).join("")}</div></div>`, { icon: "fa-solid fa-sliders", width: 620 });
    if (!form) return; const nb = { slots: {} };
    for (const k of BONUS_KEYS) { const v = Number(form.elements[`b.${k}`].value) || 0; if (v) nb[k] = v; }
    for (const k of SLOT_KEYS) { const v = Number(form.elements[`s.${k}`].value) || 0; if (v) nb.slots[k] = v; }
    if (!Object.keys(nb.slots).length) delete nb.slots;
    await it.update({ [`flags.${MOD}.slot`]: form.elements.slot.value, [`flags.${MOD}.-=bonus`]: null }); await it.setFlag(MOD, "bonus", nb);
    return log(a, "info", `Bonus de ${it.name} réglés par le MJ.`);
  }

  /* ── soute ── */
  async #deposit() {
    const chars = myCharacters(); const list = []; for (const c of chars) for (const it of c.items) if (!it.system?.equipped) list.push({ it, c });
    if (!list.length) return ui.notifications.info("Aucun objet non équipé sur tes personnages.");
    const form = await dlg("Déposer dans la soute", `<div class="vm-dlg"><input type="search" class="vm-q" placeholder="Rechercher…"><div class="vm-picks tall">${list.map((x, i) => `<label class="vm-pick"><input type="checkbox" name="i${i}"><img src="${esc(x.it.img)}"><span><b>${esc(x.it.name)}</b><small class="who">sur ${esc(x.c.name)}</small></span>${qtyOf(x.it) > 1 ? `<input type="number" name="q${i}" min="1" max="${qtyOf(x.it)}" value="${qtyOf(x.it)}" class="vm-qty">` : ""}</label>`).join("")}</div></div>`, { icon: "fa-solid fa-box-open", ok: "Déposer", width: 560, render: (ev, d) => { const root = d.element; const q = root.querySelector(".vm-q"); q?.addEventListener("input", () => root.querySelectorAll(".vm-pick").forEach(l => l.style.display = l.textContent.toLowerCase().includes(q.value.toLowerCase()) ? "" : "none")); } });
    if (!form) return; const names = [];
    for (let i = 0; i < list.length; i++) if (form.elements[`i${i}`]?.checked) { const q = Number(form.elements[`q${i}`]?.value) || 1; names.push(`${list[i].it.name}${q > 1 ? ` ×${q}` : ""} (${list[i].c.name})`); await moveItem(list[i].it, this.document, q); }
    if (names.length) return log(this.document, "deposit", `Déposé : ${names.join(", ")}.`);
  }
  async #doDeposit(it, q) { const from = it.parent.name; await moveItem(it, this.document, q); return log(this.document, "deposit", `Déposé : ${it.name}${q > 1 ? ` ×${q}` : ""} (${from}).`); }
  async #withdraw(id) {
    const a = this.document; const it = a.items.get(id); if (!it) return; const chars = myCharacters(); if (!chars.length) return ui.notifications.warn("Tu n'as aucun personnage.");
    const form = await dlg("Reprendre", `<div class="vm-dlg"><p><b>${esc(it.name)}</b></p><label>Sur<select name="to">${chars.map(c => `<option value="${c.uuid}">${esc(c.name)}</option>`).join("")}</select></label>${qtyOf(it) > 1 ? `<label>Quantité<input type="number" name="q" min="1" max="${qtyOf(it)}" value="${qtyOf(it)}"></label>` : ""}</div>`, { icon: "fa-solid fa-hand-holding", ok: "Reprendre" });
    if (!form) return; const dest = await fromUuid(form.elements.to.value); const q = Number(form.elements.q?.value) || 1; const name = it.name;
    await moveItem(it, dest, q); return log(a, "withdraw", `Repris : ${name}${q > 1 ? ` ×${q}` : ""} par ${dest.name}.`);
  }
  async #dock() {
    const a = this.document; const mySize = SIZES[a.system.size]?.order ?? 1;
    const list = game.actors.filter(v => isVehicle(v) && v.id !== a.id && v.isOwner && (SIZES[v.system.size]?.order ?? 1) < mySize && !(a.system.docked || []).includes(v.uuid));
    if (!list.length) return ui.notifications.info("Aucun de tes véhicules n'est assez petit pour entrer dans la soute.");
    const form = await dlg("Garer un véhicule à bord", `<div class="vm-dlg"><div class="vm-picks">${list.map((v, i) => `<label class="vm-pick"><input type="radio" name="pick" value="${i}"><img src="${esc(v.img)}"><span><b>${esc(v.name)}</b><small>${esc(SIZES[v.system.size]?.name)}</small></span></label>`).join("")}</div></div>`, { icon: "fa-solid fa-anchor", ok: "Garer" });
    const i = form?.elements?.pick?.value; if (i === undefined || i === "") return; return this.#doDock(list[Number(i)]);
  }
  async #doDock(v) { const a = this.document; if ((SIZES[v.system.size]?.order ?? 1) >= (SIZES[a.system.size]?.order ?? 1)) return ui.notifications.warn(`${v.name} est trop grand pour la soute de ${a.name}.`); const added = await actorLock(a, async () => { if ((a.system.docked || []).includes(v.uuid)) return false; await a.update({ "system.docked": [...(a.system.docked || []), v.uuid] }); return true; }); if (!added) return; return log(a, "deposit", `${v.name} garé à bord.`); }

  /* ── équipage ── */
  async #setPost(id, uuid) { const a = this.document; const posts = await actorLock(a, async () => { const posts = a.system.posts.map(p => p.id === id ? { ...p, uuid } : p); await a.update({ "system.posts": posts }); return posts; }); const p = posts.find(x => x.id === id); const x = uuid ? fromUuidSync(uuid) : null; return log(a, "crew", x ? `${x.name} prend le poste ${p.name}.` : `Poste ${p.name} libéré.`); }
  async #assign(id) {
    const list = game.actors.filter(x => !isVehicle(x) && (game.user.isGM || x.testUserPermission(game.user, "LIMITED"))).sort((p, q) => (q.hasPlayerOwner - p.hasPlayerOwner) || p.name.localeCompare(q.name, "fr"));
    const form = await dlg("Affecter au poste", `<div class="vm-dlg"><input type="search" class="vm-q" placeholder="Rechercher…"><div class="vm-picks tall">${list.map((x, i) => `<label class="vm-pick"><input type="radio" name="pick" value="${i}"><img src="${esc(x.img)}"><span><b>${esc(x.name)}</b><small>${x.hasPlayerOwner ? "personnage" : "PNJ"}</small></span></label>`).join("")}</div></div>`, { icon: "fa-solid fa-user-pen", ok: "Affecter", render: (ev, d) => { const root = d.element; const q = root.querySelector(".vm-q"); q?.addEventListener("input", () => root.querySelectorAll(".vm-pick").forEach(l => l.style.display = l.textContent.toLowerCase().includes(q.value.toLowerCase()) ? "" : "none")); } });
    const i = form?.elements?.pick?.value; if (i === undefined || i === "") return; return this.#setPost(id, list[Number(i)].uuid);
  }
}
