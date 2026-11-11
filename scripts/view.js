/* Véhicules Manhwa — rendu HTML (pur : reçoit un modèle de vue, ne touche pas à Foundry → prévisualisable hors Foundry). */
import { SLOTS, SLOT_KEYS, ENVS, STATS, HULL_STATES, fmtStat, fmtN } from "./data.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fa = (i, cls = "") => `<i class="fa-solid ${i} ${cls}"></i>`;

/* ── silhouettes « plan d'architecte » (viewBox 600×280) et position des points d'emplacement ── */
const SIL = {
  sea: { body: `<path class="vm-s-fill" d="M40 140 C70 70 230 52 380 60 C470 66 535 100 568 140 C535 180 470 214 380 220 C230 228 70 210 40 140 Z"/>
      <path class="vm-s-line" d="M80 140 C110 98 240 86 380 92 C455 97 505 116 530 140 C505 164 455 183 380 188 C240 194 110 182 80 140 Z"/>
      <path class="vm-s-dash" d="M60 140 H560"/><circle class="vm-s-line" cx="300" cy="140" r="9"/><circle class="vm-s-line" cx="420" cy="140" r="6"/>
      <path class="vm-s-line" d="M300 140 L300 64 M300 140 L300 216" opacity=".5"/>`,
    pts: { steering: [70, 140], comfort: [150, 100], cargo: [200, 175], hull: [250, 214], propulsion: [300, 140], defense: [380, 214], weapons: [430, 92], special: [520, 140], wheels: [470, 186] } },
  land: { body: `<path class="vm-s-fill" d="M110 80 H470 L500 110 V180 H90 V100 Z"/><path class="vm-s-line" d="M128 96 H460 L482 116 V168 H108 V110 Z"/>
      <circle class="vm-s-fill" cx="180" cy="205" r="42"/><circle class="vm-s-line" cx="180" cy="205" r="24"/><circle class="vm-s-fill" cx="410" cy="205" r="42"/><circle class="vm-s-line" cx="410" cy="205" r="24"/>
      <path class="vm-s-dash" d="M500 140 H575 M575 120 V160"/><path class="vm-s-dash" d="M60 250 H560"/>`,
    pts: { defense: [110, 60], hull: [295, 60], weapons: [470, 60], comfort: [360, 140], cargo: [230, 140], special: [140, 140], propulsion: [560, 140], wheels: [180, 205], steering: [410, 205] } },
  air: { body: `<ellipse class="vm-s-fill" cx="300" cy="105" rx="240" ry="68"/><ellipse class="vm-s-line" cx="300" cy="105" rx="210" ry="46"/>
      <path class="vm-s-dash" d="M60 105 H540"/><path class="vm-s-line" d="M90 60 L40 30 L60 105 L40 180 L90 150"/>
      <path class="vm-s-fill" d="M220 182 H380 L366 222 H234 Z"/><path class="vm-s-line" d="M240 173 L250 182 M360 173 L350 182"/>`,
    pts: { propulsion: [52, 105], defense: [190, 70], hull: [300, 105], special: [420, 70], comfort: [480, 120], cargo: [250, 202], steering: [350, 202], weapons: [450, 202], wheels: [300, 252] } },
  space: { body: `<path class="vm-s-fill" d="M565 140 L420 92 L300 80 L170 52 L120 92 L60 100 L60 180 L120 188 L170 228 L300 200 L420 188 Z"/>
      <path class="vm-s-line" d="M530 140 L410 108 L300 102 L180 82 L140 110 L90 116 L90 164 L140 170 L180 198 L300 178 L410 172 Z"/>
      <path class="vm-s-dash" d="M50 140 H580"/><rect class="vm-s-line" x="30" y="112" width="30" height="56" rx="6"/>`,
    pts: { propulsion: [44, 140], defense: [170, 60], comfort: [230, 140], hull: [300, 140], cargo: [360, 190], special: [170, 220], steering: [500, 140], weapons: [400, 92], wheels: [300, 240] } }
};

function silhouette(vm) {
  const S = SIL[vm.env.key] || SIL.land; let nodes = "";
  for (const s of vm.slots) {
    if (!s.total && !s.used) continue; const p = S.pts[s.key]; if (!p) continue; const on = s.used > 0; const full = s.used >= s.total && s.total > 0;
    nodes += `<g class="vm-node ${on ? "on" : ""} ${full ? "full" : ""}" data-vm="jump" data-slot="${s.key}" style="--c:${s.color}"><title>${esc(s.name)} · ${s.used}/${s.total}</title>
      <circle class="halo" cx="${p[0]}" cy="${p[1]}" r="22"/><circle class="ring" cx="${p[0]}" cy="${p[1]}" r="13"/><circle class="dot" cx="${p[0]}" cy="${p[1]}" r="${on ? 6 : 3.5}"/>
      <text x="${p[0]}" y="${p[1] - 20}">${esc(s.name.toUpperCase())}</text><text class="n" x="${p[0]}" y="${p[1] + 30}">${s.used}/${s.total}</text></g>`;
  }
  return `<svg class="vm-sil" viewBox="0 0 600 280" preserveAspectRatio="xMidYMid meet"><defs><pattern id="vmgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 H0 V20" fill="none" stroke="currentColor" stroke-width=".4" opacity=".35"/></pattern></defs>
    <rect width="600" height="280" fill="url(#vmgrid)" class="vm-grid"/>${S.body}${nodes}</svg>`;
}

/* ── caractéristiques ── */
function meter(t, color) { if (!t) return ""; let s = ""; for (let i = 0; i <= t.max; i++) s += `<i class="${i <= t.i ? "on" : ""}" style="${i <= t.i ? `--d:${i}` : ""}"></i>`; return `<span class="vm-meter" style="--c:${color}">${s}</span>`; }
function statRow(st, mode) {
  const nar = mode !== "numeric" && st.tier; const delta = st.add || st.pct;
  const tip = [`Base : ${fmtStat(st.key, st.base)}`, ...st.from.map(f => `${f.name} : ${f.v > 0 ? "+" : "−"}${Math.abs(f.v)}${f.pct ? " %" : ""}`)].join("\n");
  const num = `<b class="vm-num">${st.count ? fmtN(st.value) : fmtStat(st.key, st.value)}</b>${delta ? `<em class="${(st.add || 0) + (st.pct || 0) >= 0 ? "up" : "down"}">${st.add ? `${st.add > 0 ? "+" : "−"}${fmtN(Math.abs(st.add))}` : ""}${st.pct ? ` ${st.pct > 0 ? "+" : "−"}${Math.abs(st.pct)} %` : ""}</em>` : ""}`;
  return `<div class="vm-stat" title="${esc(tip)}" style="--c:${st.color}"><span class="ic">${fa(st.icon)}</span><span class="nm">${esc(st.name)}</span>
    <span class="val">${nar ? `<b class="vm-tier">${esc(st.tier.label)}</b>${mode === "both" ? `<small>${st.count ? fmtN(st.value) : fmtStat(st.key, st.value)}</small>` : ""}${delta ? `<em class="${(st.add || 0) + (st.pct || 0) >= 0 ? "up" : "down"}">${(st.add || 0) + (st.pct || 0) >= 0 ? "▲" : "▼"}</em>` : ""}` : num}</span>${nar ? meter(st.tier, st.color) : ""}</div>`;
}

/* ── en-tête ── */
function header(vm) {
  const h = vm.hull; const nar = vm.mode !== "numeric";
  const hullBox = nar
    ? `<div class="vm-hullstate">${HULL_STATES.map((s, i) => `<a class="st s${i} ${h.stage === i ? "on" : ""}" ${vm.canEdit ? `data-vm="stage" data-v="${i}"` : ""}>${esc(s)}</a>`).join("")}</div>`
    : `<div class="vm-hullbar" style="--p:${h.max ? Math.round(h.cur / h.max * 100) : 0}%"><u></u><span>${vm.canEdit ? `<a data-vm="hull" data-d="-1">${fa("fa-minus")}</a>` : ""}<input type="number" data-vmf="hull" value="${h.cur}" ${vm.canEdit ? "" : "disabled"}><small>/ ${fmtN(h.max)}</small>${vm.canEdit ? `<a data-vm="hull" data-d="1">${fa("fa-plus")}</a>` : ""}</span></div>`;
  return `<header class="vm-head" style="--rc:${vm.rankColor};--ec:${vm.env.color}">
    <div class="vm-pic" ${vm.canEdit ? `data-vm="img"` : ""}><img src="${esc(vm.img)}"><span class="vm-rank"><b>${esc(vm.rank)}</b></span></div>
    <div class="vm-id">
      <div class="vm-sys">[ REGISTRE DES VÉHICULES // ${esc(vm.env.name.toUpperCase())} ]<a class="vm-pin${vm.pinned ? " on" : ""}" data-vm="pin" title="Afficher ce véhicule dans le cadre flottant"><i class="fa-solid fa-thumbtack"></i> ${vm.pinned ? "Épinglé" : "Épingler"}</a></div>
      ${vm.canEdit ? `<input class="vm-name" data-vmf="name" value="${esc(vm.name)}">` : `<h1 class="vm-name">${esc(vm.name)}</h1>`}
      <div class="vm-tags"><span class="env">${fa(vm.env.icon)} ${esc(vm.env.name)}</span><span>${fa(vm.famIcon)} ${esc(vm.famName)}</span><span>${fa("fa-up-right-and-down-left-from-center")} ${esc(vm.sizeName)}</span>${vm.rarity ? `<span class="rar">${esc(vm.rarity)}</span>` : ""}${vm.origin ? `<span class="dim">${esc(vm.origin)}</span>` : ""}</div>
      <div class="vm-hull"><label>${fa("fa-shield-halved")} ÉTAT DE LA COQUE</label>${hullBox}</div>
    </div>
    <div class="vm-owner">${vm.ownerName ? `<small>PROPRIÉTAIRE</small><b>${esc(vm.ownerName)}</b>` : `<small>PROPRIÉTAIRE</small><b class="dim">—</b>`}${vm.canEdit ? `<span class="ok">${fa("fa-key")} accès modification</span>` : `<span class="ro">${fa("fa-eye")} lecture seule</span>`}</div>
  </header>`;
}

/* ── onglet Plan ── */
function planTab(vm) {
  const groups = vm.slots.filter(s => s.total || s.used).map(s => {
    let cells = s.parts.map(p => `<div class="vm-part" style="--c:${s.color}" data-id="${p.id}" title="${esc(p.desc || "")}">
        <img src="${esc(p.img)}"><div class="t"><b>${esc(p.name)}</b><small>${p.bonus.length ? p.bonus.map(esc).join(" · ") : "Aucun bonus"}${p.guessed ? ` <i class="g" title="Bonus déduits automatiquement (rang et description)">auto</i>` : ""}</small></div>
        ${vm.canEdit ? `<span class="a"><a data-vm="uninstall" title="Retirer la pièce">${fa("fa-wrench")}</a>${vm.isGM ? `<a data-vm="editPart" title="Régler les bonus (MJ)">${fa("fa-sliders")}</a>` : ""}</span>` : ""}</div>`).join("");
    for (let i = s.used; i < s.total; i++) cells += `<div class="vm-socket" style="--c:${s.color}" ${vm.canEdit ? `data-vm="install" data-slot="${s.key}"` : ""}>${vm.canEdit ? `${fa("fa-plus")}<span>Installer</span>` : `<span>Libre</span>`}</div>`;
    return `<section class="vm-slot" id="vm-slot-${s.key}" style="--c:${s.color}"><header>${fa(s.icon)}<b>${esc(s.name)}</b><small>${s.used}/${s.total}${s.extra ? ` <em title="Emplacements ajoutés par des pièces">(+${s.extra})</em>` : ""}</small>${s.used > s.total ? `<span class="warn">${fa("fa-triangle-exclamation")} trop de pièces</span>` : ""}</header><div class="cells">${cells || `<div class="vm-empty">Aucun emplacement.</div>`}</div></section>`;
  }).join("");
  return `<div class="vm-plan"><div class="vm-left"><div class="vm-blue">${silhouette(vm)}<span class="cap">PLAN DE COQUE · ${esc(vm.famName.toUpperCase())}</span></div><div class="vm-slots">${groups}</div></div>
    <aside class="vm-right"><h3>${fa("fa-gauge-high")} CARACTÉRISTIQUES</h3>${vm.stats.map(s => statRow(s, vm.mode)).join("")}
    <div class="vm-hint">Survole une ligne pour voir le détail des bonus.</div></aside></div>`;
}

/* ── onglet Soute ── */
function cargoTab(vm) {
  const rows = vm.cargo.map(c => `<div class="vm-crow" data-id="${c.id}"><img src="${esc(c.img)}"><b>${esc(c.name)}</b>${c.part ? `<span class="pt" style="--c:${SLOTS[c.part].color}">${fa(SLOTS[c.part].icon)} pièce · ${esc(SLOTS[c.part].name)}</span>` : ""}<span class="q">×${fmtN(c.qty)}</span>
    ${vm.canEdit ? `<a class="vm-btn ghost" data-vm="withdraw" title="Reprendre sur un de tes personnages">${fa("fa-hand-holding")} Reprendre</a>` : ""}</div>`).join("");
  const docked = vm.docked.map(d => `<div class="vm-crow dock"><img src="${esc(d.img)}"><b>${esc(d.name)}</b><span class="pt">${esc(d.size)}</span>${vm.canEdit ? `<a class="vm-btn ghost" data-vm="undock" data-uuid="${esc(d.uuid)}">${fa("fa-right-from-bracket")} Sortir</a>` : ""}</div>`).join("");
  return `<div class="vm-cargo"><div class="vm-bar"><span>${fa("fa-boxes-stacked")} Soute : <b>${esc(vm.cargoCap)}</b> · ${vm.cargo.length} type${vm.cargo.length > 1 ? "s" : ""} d'objets</span><span class="grow"></span>
      ${vm.canEdit ? `<a class="vm-btn" data-vm="deposit">${fa("fa-box-open")} Déposer depuis mes personnages</a><a class="vm-btn ghost" data-vm="dock">${fa("fa-anchor")} Garer un véhicule</a>` : ""}</div>
    <div class="vm-clist">${rows || `<div class="vm-empty big">${fa("fa-box-open")}La soute est vide.</div>`}</div>
    ${vm.docked.length || vm.canEdit ? `<h4>${fa("fa-anchor")} Véhicules garés à bord</h4><div class="vm-clist">${docked || `<div class="vm-empty">Aucun.</div>`}</div>` : ""}</div>`;
}

/* ── onglet Équipage ── */
function crewTab(vm) {
  const cards = vm.posts.map(p => `<div class="vm-post" data-id="${p.id}"><div class="pic">${p.actor ? `<img src="${esc(p.actor.img)}">` : fa("fa-user-plus")}</div>
    <div class="t">${vm.canEdit ? `<input data-vmf="postName" value="${esc(p.name)}">` : `<b>${esc(p.name)}</b>`}<small>${p.actor ? esc(p.actor.name) : "Poste vacant"}</small></div>
    ${vm.canEdit ? `<span class="a"><a data-vm="assign" title="Affecter">${fa("fa-user-pen")}</a>${p.actor ? `<a data-vm="unassign" title="Libérer">${fa("fa-user-slash")}</a>` : ""}<a data-vm="delPost" class="x" title="Supprimer le poste">${fa("fa-xmark")}</a></span>` : ""}</div>`).join("");
  return `<div class="vm-crew"><div class="vm-bar"><span>${fa("fa-users")} Équipage requis : <b>${fmtN(vm.crewNeed)}</b> · passagers : <b>${fmtN(vm.passengers)}</b></span><span class="grow"></span>
    ${vm.canEdit ? `<label class="vm-check"><input type="checkbox" data-vmf="showCrew" ${vm.showCrew ? "checked" : ""}> Postes d'équipage</label>${vm.showCrew ? `<a class="vm-btn" data-vm="addPost">${fa("fa-plus")} Poste</a>` : ""}` : ""}</div>
    ${vm.showCrew ? `<div class="vm-posts">${cards || `<div class="vm-empty big">${fa("fa-users")}Aucun poste. Ajoute-en pour ce véhicule.</div>`}</div>` : `<div class="vm-empty big">${fa("fa-person-rays")}Pas de postes d'équipage pour ce véhicule.${vm.canEdit ? " Coche « Postes d'équipage » pour en créer." : ""}</div>`}</div>`;
}

/* ── onglet Journal ── */
function logTab(vm) {
  return `<div class="vm-log">${vm.log.map(l => `<div class="vm-lrow k-${esc(l.k)}"><span class="ic">${fa(l.icon)}</span><div><b>${esc(l.txt)}</b><small>${esc(l.u)} · ${esc(l.when)}</small></div></div>`).join("") || `<div class="vm-empty big">${fa("fa-feather")}Le journal de bord est vide.</div>`}</div>`;
}

/* ── onglet Accès ── */
function accessTab(vm) {
  const A = vm.access; const lv = { edit: "Peut modifier", view: "Peut voir", none: "Aucun accès" };
  const row = r => `<div class="vm-arow"><i class="dot" style="background:${esc(r.color)}"></i><b>${esc(r.name)}</b><small>${esc(r.src)}</small><span class="grow"></span>
    ${A.manage && !r.owner ? `<select data-vmf="access" data-user="${r.id}">${Object.entries(lv).map(([k, n]) => `<option value="${k}" ${r.level === k ? "selected" : ""}>${n}</option>`).join("")}</select>` : `<span class="lv ${r.level}">${r.owner ? "Propriétaire" : lv[r.level]}</span>`}</div>`;
  return `<div class="vm-access"><p class="vm-hint">${A.manage ? "Tu peux donner l'accès à ton véhicule aux membres de tes groupes et à tes amis. « Peut modifier » permet d'installer et retirer des pièces, de déposer et reprendre dans la soute." : "Seul le propriétaire (ou le MJ) gère les accès."}</p>
    <h4>${fa("fa-key")} Accès actuels</h4><div class="vm-alist">${A.rows.map(row).join("") || `<div class="vm-empty">Personne.</div>`}</div>
    ${A.manage ? `<h4>${fa("fa-user-group")} Groupes et amis</h4><div class="vm-alist">${A.candidates.map(row).join("") || `<div class="vm-empty">Aucun membre de groupe ni ami avec un compte joueur.</div>`}</div>` : ""}
    ${vm.isGM ? `<h4>${fa("fa-crown")} Propriétaire (MJ)</h4>${globalThis.MANHWA?.pickers ? `<div data-vmf="owner" class="vm-ownpick">${globalThis.MANHWA.pickers.field({ mode: "user", name: "vmowner", multi: false, selected: A.ownerId ? [A.ownerId] : [], placeholder: "Pseudo du joueur ou nom de son personnage…" })}</div>` : `<select data-vmf="owner"><option value="">— aucun —</option>${A.users.map(u => `<option value="${u.id}" ${u.id === A.ownerId ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select>`}` : ""}</div>`;
}

/* ── onglet Fiche (MJ) ── */
function specTab(vm) {
  const g = vm.gm; const opt = (o, v) => Object.entries(o).map(([k, n]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(n)}</option>`).join("");
  return `<div class="vm-spec">
    <div class="vm-grid3">
      <label>Profil<select data-vmf="family">${opt(g.families, vm.family)}</select></label>
      <label>Milieu<select data-vmf="env">${opt(g.envs, vm.env.key)}</select></label>
      <label>Taille<select data-vmf="size">${opt(g.sizes, vm.size)}</select></label>
      <label>Rang<select data-vmf="rank">${g.ranks.map(r => `<option ${r === vm.rank ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      <label>Rareté<input data-vmf="rarity" value="${esc(vm.rarity)}"></label>
      <label>Origine<input data-vmf="origin" value="${esc(vm.origin)}"></label>
    </div>
    <div class="vm-bar"><a class="vm-btn ghost" data-vm="applyProfile">${fa("fa-wand-magic-sparkles")} Recalculer la base d'après le profil et le rang</a></div>
    <h4>${fa("fa-sliders")} Caractéristiques de base <small>(sans les pièces)</small></h4>
    <div class="vm-grid5">${g.baseRows.map(b => `<label><span>${fa(b.icon)} ${esc(b.name)}${b.unit ? ` <small>(${b.unit})</small>` : ""}</span><input type="number" data-vmf="base" data-k="${b.key}" value="${b.value}"></label>`).join("")}</div>
    <h4>${fa("fa-table-cells")} Emplacements <small>(vide = selon la taille : ${esc(g.sizeDefaultTxt)})</small></h4>
    <div class="vm-grid5">${SLOT_KEYS.map(k => `<label style="--c:${SLOTS[k].color}"><span>${fa(SLOTS[k].icon)} ${esc(SLOTS[k].name)}</span><input type="number" min="0" data-vmf="slot" data-k="${k}" value="${g.slotsOverride[k] ?? ""}" placeholder="${g.sizeDefault[k]}"></label>`).join("")}</div>
  </div>`;
}

export const TABS = [["plan", "Plan", "fa-compass-drafting"], ["cargo", "Soute", "fa-boxes-stacked"], ["crew", "Équipage", "fa-users"], ["log", "Journal", "fa-book"], ["access", "Accès", "fa-key"], ["spec", "Fiche", "fa-screwdriver-wrench"]];
/* ── bandeau « SYSTÈME » (fenêtre système façon ORV, comme le Journal des scénarios) ── */
function topBar(vm) {
  const used = vm.slots.reduce((n, s) => n + s.used, 0), tot = vm.slots.reduce((n, s) => n + s.total, 0);
  const crew = vm.posts.filter(p => p.filled || p.actor).length; const nar = vm.mode !== "numeric";
  const pct = vm.hull.max ? vm.hull.cur / vm.hull.max : 1;
  const lvl = nar ? Math.min(4, Math.max(0, Number(vm.hull.stage) || 0)) : pct >= 1 ? 0 : pct > .6 ? 1 : pct > .3 ? 2 : pct > 0 ? 3 : 4;
  const msg = ["Tous les systèmes sont opérationnels.", "Dégâts superficiels détectés sur la coque.", "Avaries en cours : réparations conseillées.", "Alerte : intégrité de la coque critique.", "Épave : le véhicule est hors d'usage."][lvl];
  const hull = nar ? HULL_STATES[lvl] : `${fmtN(vm.hull.cur)} / ${fmtN(vm.hull.max)}`;
  return `<div class="vm-top" style="--ec:${vm.env.color}"><div class="vm-brand"><i class="vm-dot"></i><b>SYSTÈME</b><span>Fiche de véhicule</span></div>
    <div class="vm-announce lv${lvl}" title="Coque : ${esc(hull)}">[ ${esc(msg)} ]</div>
    <div class="vm-kpis"><span class="k" title="Pièces installées / emplacements">${fa("fa-screwdriver-wrench")}<b>${used}/${tot}</b>pièces</span><span class="k" title="Types d'objets en soute">${fa("fa-boxes-stacked")}<b>${vm.cargo.length}</b>soute</span>${vm.showCrew ? `<span class="k" title="Postes pourvus / équipage requis">${fa("fa-users")}<b>${crew}/${fmtN(vm.crewNeed)}</b>équipage</span>` : ""}</div></div>`;
}

export function renderSheet(vm) {
  const tabs = TABS.filter(t => t[0] !== "spec" || vm.isGM);
  const body = { plan: planTab, cargo: cargoTab, crew: crewTab, log: logTab, access: accessTab, spec: specTab }[vm.tab] || planTab;
  return `<div class="vm-wrap env-${vm.env.key}">${topBar(vm)}${header(vm)}
    <nav class="vm-tabs">${tabs.map(([k, n, i]) => `<a class="${vm.tab === k ? "on" : ""}" data-vm="tab" data-tab="${k}">${fa(i)}<span>${n}</span>${k === "cargo" && vm.cargo.length ? `<em>${vm.cargo.length}</em>` : ""}</a>`).join("")}<a class="vm-dom" data-vm="domaine" data-tooltip="Plan des zones, objets à déplacer et dessin, dans Domaine">${fa("fa-map")}<span>Zones (Domaine)</span></a></nav>
    <div class="vm-body">${body(vm)}</div></div>`;
}
