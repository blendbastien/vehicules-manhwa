/* Véhicules Manhwa — le Garage : mes véhicules, ceux partagés avec moi, mise en service d'un véhicule acheté, création (MJ), réglages (MJ). */
import { pinHud } from "./hud.js";
import { rankColor } from "./sheet.js";
import { MOD, FAMILIES, ENVS, SIZES, SLOTS, SLOT_KEYS, DEFAULT_SIZE_SLOTS, RANKS, compute, tierOf, fmtStat } from "./data.js";
import { esc, vehicles, myCharacters, isVehicleItem, gmDo, setting, installed, partOfItem, slotOf, profileFromItem, withLock } from "./core.js";

const { ApplicationV2, DialogV2 } = foundry.applications.api;
const fa = i => `<i class="fa-solid ${i}"></i>`;

export class Garage extends ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "vm-garage", classes: ["vm-sheet", "vm-garage"], window: { title: "Garage", icon: "fa-solid fa-warehouse", resizable: true }, position: { width: 900, height: 640 } };
  static open() { const g = foundry.applications.instances.get("vm-garage") || new Garage(); g.render({ force: true }); return g; }
  view = "mine";

  async _renderHTML() {
    const gm = game.user.isGM; const all = vehicles().filter(v => gm || v.testUserPermission(game.user, "LIMITED"));
    const mine = all.filter(v => v.system.owner === game.user.id), shared = all.filter(v => v.system.owner !== game.user.id);
    const tabs = [["mine", "Mes véhicules", "fa-key", mine.length], ["shared", gm ? "Tous les autres" : "Partagés avec moi", "fa-user-group", shared.length]]; if (gm) tabs.push(["settings", "Réglages", "fa-gear", null]);
    const card = v => { const s = v.system; const C = compute(s, installed(v).map(it => ({ name: it.name, slot: slotOf(it), bonus: it.flags?.[MOD]?.bonus || partOfItem(it)?.bonus || {} })), setting("sizeSlots")); const env = ENVS[s.env] || ENVS.land; const fam = FAMILIES[s.family] || FAMILIES.autre; const nar = setting("mode") !== "numeric";
      const used = Object.values(C.slots).reduce((n, x) => n + x.used, 0), tot = Object.values(C.slots).reduce((n, x) => n + x.total, 0);
      const st = k => nar ? tierOf(k, C.eff[k])?.label : fmtStat(k, C.eff[k]);
      return `<div class="vm-gcard" data-uuid="${v.uuid}" style="--ec:${env.color}"><a class="vm-pin${game.settings.get(MOD, "hudVehicle") === v.uuid ? " on" : ""}" data-g="pin" title="Afficher dans le cadre flottant"><i class="fa-solid fa-thumbtack"></i></a><div class="pic"><img src="${esc(v.img)}"><span class="vm-rank" style="--rc:${rankColor(s.rank || "F")}"><b>${esc(s.rank || "F")}</b></span></div><div class="t"><b>${esc(v.name)}</b><small>${fa(env.icon)} ${esc(fam.name)} · ${esc(SIZES[s.size]?.name)}</small>
        <div class="kv"><span>${fa("fa-gauge-high")} ${esc(st("speed"))}</span><span>${fa("fa-shield-halved")} ${esc(st("hull"))}</span><span>${fa("fa-screwdriver-wrench")} ${used}/${tot} pièces</span></div>
        <small class="own">${s.owner ? `${fa("fa-crown")} ${esc(game.users.get(s.owner)?.name || "?")}` : `${fa("fa-crown")} sans propriétaire`}${v.isOwner ? ` · ${fa("fa-pen")} modification` : ` · ${fa("fa-eye")} lecture`}</small></div></div>`; };
    let body;
    if (this.view === "settings") body = this.#settings();
    else { const list = this.view === "mine" ? mine : shared; body = `<div class="vm-glist">${list.map(card).join("") || `<div class="vm-empty big">${fa("fa-warehouse")}${this.view === "mine" ? "Tu n'as pas encore de véhicule. Achète-en un dans le Catalogue, puis « Mettre en service »." : "Aucun véhicule ici."}</div>`}</div>`; }
    return `<div class="vm-wrap"><header class="vm-ghead vm-top"><div class="vm-brand"><i class="vm-dot"></i><b>SYSTÈME</b><span>Garage</span></div><div class="vm-announce">[ Registre des véhicules · ${all.length} enregistré${all.length > 1 ? "s" : ""} · ${mine.length} à toi ]</div>
      <a class="vm-btn" data-g="service">${fa("fa-anchor")} Mettre en service</a>${gm ? `<a class="vm-btn ghost" data-g="new">${fa("fa-plus")} Nouveau véhicule (MJ)</a>` : ""}</header>
      <nav class="vm-tabs">${tabs.map(([k, n, i, c]) => `<a class="${this.view === k ? "on" : ""}" data-g="tab" data-tab="${k}">${fa(i)}<span>${n}</span>${c ? `<em>${c}</em>` : ""}</a>`).join("")}</nav><div class="vm-body">${body}</div></div>`;
  }
  #settings() {
    const cur = setting("sizeSlots") || {}; const mode = setting("mode");
    return `<div class="vm-spec"><h4>${fa("fa-eye")} Affichage des caractéristiques</h4><select data-gs="mode">${[["narrative", "Narratif (libellés : Lente, Robuste…)"], ["numeric", "Chiffré (km/h, points de coque…)"], ["both", "Les deux"]].map(([k, n]) => `<option value="${k}" ${k === mode ? "selected" : ""}>${n}</option>`).join("")}</select>
      <h4>${fa("fa-table-cells")} Emplacements par taille <small>(chaque véhicule peut ensuite être modifié, et des pièces en ajoutent)</small></h4>
      <table class="vm-table"><tr><th></th>${SLOT_KEYS.map(k => `<th style="color:${SLOTS[k].color}" title="${SLOTS[k].name}">${fa(SLOTS[k].icon)}<small>${SLOTS[k].name}</small></th>`).join("")}</tr>
      ${Object.entries(SIZES).map(([z, Z]) => `<tr><th>${Z.name}</th>${SLOT_KEYS.map(k => `<td><input type="number" min="0" data-gs="slot" data-z="${z}" data-k="${k}" value="${cur[z]?.[k] ?? ""}" placeholder="${DEFAULT_SIZE_SLOTS[z][k]}"></td>`).join("")}</tr>`).join("")}</table>
      <p class="vm-hint">Case vide = valeur par défaut (grisée).</p></div>`;
  }
  _replaceHTML(html, content) {
    content.innerHTML = html; if (content.dataset.vmBound) return; content.dataset.vmBound = "1";
    content.addEventListener("click", async ev => { const c = ev.target.closest(".vm-gcard"); if (c && !ev.target.closest("[data-g]")) return (await fromUuid(c.dataset.uuid))?.sheet.render(true);
      const el = ev.target.closest("[data-g]"); if (!el) return; const g = el.dataset.g; if (g === "pin") { const v = await fromUuid(el.closest(".vm-gcard").dataset.uuid); if (v) { await pinHud(v); this.render(); } return; }
      if (g === "tab") { this.view = el.dataset.tab; return this.render(); }
      if (g === "service") return putInService();
      if (g === "new") return newVehicle(); });
    content.addEventListener("change", async ev => { const el = ev.target.closest("[data-gs]"); if (!el || !game.user.isGM) return;
      if (el.dataset.gs === "mode") return game.settings.set(MOD, "mode", el.value);
      if (el.dataset.gs === "slot") return withLock(`set:${MOD}.sizeSlots`, () => { const cur = foundry.utils.deepClone(setting("sizeSlots") || {}); cur[el.dataset.z] = cur[el.dataset.z] || {}; if (el.value === "") delete cur[el.dataset.z][el.dataset.k]; else cur[el.dataset.z][el.dataset.k] = Math.max(0, Number(el.value) || 0); return game.settings.set(MOD, "sizeSlots", cur); }); });   /* lecture + écriture sous verrou : deux cases modifiées coup sur coup ne s'effacent plus */
  }
}

/* le joueur choisit un véhicule acheté (objet sur un de ses personnages) → le MJ crée la fiche, le joueur en devient propriétaire */
export async function putInService() {
  const list = []; for (const c of myCharacters()) for (const it of c.items) if (isVehicleItem(it)) list.push({ it, c, p: profileFromItem(it) });
  if (!list.length) return ui.notifications.info("Aucun véhicule dans l'inventaire de tes personnages. Achète-le d'abord dans le Catalogue (onglet Véhicules).");
  const r = await DialogV2.wait({ window: { title: "Mettre en service", icon: "fa-solid fa-anchor" }, classes: ["vm-dialog"], position: { width: 560 },
    content: `<div class="vm-dlg"><p>Le véhicule quitte l'inventaire et devient une fiche à part entière, dont tu es propriétaire.</p><div class="vm-picks">${list.map((x, i) => `<label class="vm-pick"><input type="radio" name="pick" value="${i}" ${i ? "" : "checked"}><img src="${esc(x.it.img)}"><span><b>${esc(x.it.name)}</b><small>${fa(ENVS[x.p.env].icon)} ${esc(FAMILIES[x.p.family].name)} · ${esc(SIZES[x.p.size].name)} · rang ${esc(x.p.rank)}</small><small class="who">sur ${esc(x.c.name)}</small></span></label>`).join("")}</div></div>`,
    buttons: [{ action: "ok", label: "Mettre en service", icon: "fa-solid fa-anchor", default: true, callback: (e, b) => b.form.elements.pick.value }, { action: "no", label: "Annuler" }], rejectClose: false });
  if (r === null || r === "no" || r === undefined) return; const x = list[Number(r)]; if (!x) return;
  const uuid = await gmDo("create", { itemUuid: x.it.uuid }); if (uuid) { const a = await fromUuid(uuid); a?.sheet.render(true); foundry.applications.instances.get("vm-garage")?.render(); }
}
export async function newVehicle() {
  if (!game.user.isGM) return;
  const groups = {}; for (const [k, f] of Object.entries(FAMILIES)) (groups[f.env] = groups[f.env] || []).push([k, f]);
  const r = await DialogV2.wait({ window: { title: "Nouveau véhicule", icon: "fa-solid fa-plus" }, classes: ["vm-dialog"], position: { width: 480 },
    content: `<div class="vm-dlg vm-grid3"><label style="grid-column:1/-1">Nom<input name="name" placeholder="ex. La Mouette"></label><label style="grid-column:1/3">Modèle<select name="family">${Object.entries(groups).map(([e, l]) => `<optgroup label="${ENVS[e].name}">${l.map(([k, f]) => `<option value="${k}">${f.name}</option>`).join("")}</optgroup>`).join("")}</select></label><label>Rang<select name="rank"><option value="">auto</option>${RANKS.map(x => `<option>${x}</option>`).join("")}</select></label>
      <label style="grid-column:1/-1">Propriétaire${globalThis.MANHWA?.pickers ? globalThis.MANHWA.pickers.field({ mode: "user", name: "owner", multi: false, placeholder: "Pseudo du joueur ou nom de son personnage…" }) : `<select name="owner"><option value="">— aucun —</option>${game.users.filter(u => !u.isGM).map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select>`}</label></div>`,
    render: (ev, dlg) => globalThis.MANHWA?.pickers?.bind(dlg.element ?? dlg),
    buttons: [{ action: "ok", label: "Créer", icon: "fa-solid fa-check", default: true, callback: (e, b) => { const f = b.form.elements; return { name: f.name.value.trim(), family: f.family.value, rank: f.rank.value, owner: b.form.querySelector('[name="owner"]')?.value || "" }; } }, { action: "no", label: "Annuler" }], rejectClose: false });
  if (!r || r === "no") return; const uuid = await gmDo("create", r); if (uuid) (await fromUuid(uuid))?.sheet.render(true); foundry.applications.instances.get("vm-garage")?.render();
}
