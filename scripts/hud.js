/* Véhicules Manhwa — cadre flottant d'un véhicule (comme le cadre de groupe) : coque et caractéristiques clés, sous les yeux. */
import { MOD, STATS, HULL_STATES, compute, tierOf, fmtStat, fmtN } from "./data.js";
import { esc, setting, installed, partOfItem, slotOf, isVehicle, vehicles, actorLock } from "./core.js";

const KEYS = ["speed", "armor", "handling", "firepower", "autonomy"];
const POS_KEY = "vm-hud-pos";
const HULL_COL = ["#3ddc84", "#a8e05a", "#ffc24a", "#ff7a3c", "#ff3a4a"];
const mine = () => vehicles().filter(v => game.user.isGM || v.testUserPermission(game.user, "LIMITED")).sort((a, b) => (b.system.owner === game.user.id) - (a.system.owner === game.user.id) || a.name.localeCompare(b.name, "fr"));
const cur = () => { const u = game.settings.get(MOD, "hudVehicle"); const v = u ? fromUuidSync(u) : null; return v && isVehicle(v) && (game.user.isGM || v.testUserPermission(game.user, "LIMITED")) ? v : null; };

/** caractéristiques effectives d'un véhicule (mêmes calculs que la fiche) */
export function quickStats(a) {
  const s = a.system; const parts = installed(a).map(it => { const p = partOfItem(it) || { slot: slotOf(it), bonus: {} }; return { id: it.id, name: it.name, slot: slotOf(it), bonus: it.flags?.[MOD]?.bonus || p.bonus || {} }; });
  const C = compute(s, parts, setting("sizeSlots")); const hullMax = C.eff.hull; const hullCur = s.hull === null || s.hull === undefined ? hullMax : Math.min(hullMax, Math.max(0, Number(s.hull)));
  const filled = (s.posts || []).filter(p => p.uuid).length;
  return { eff: C.eff, hull: { cur: hullCur, max: hullMax, stage: Number(s.hullStage) || 0 }, crew: { filled, need: C.eff.crew } };
}

function html(v) {
  const q = quickStats(v); const mode = setting("mode"); const nar = mode !== "numeric"; const col = !!game.settings.get(MOD, "hudCollapsed"); const own = v.isOwner;
  const pct = q.hull.max ? Math.round(q.hull.cur / q.hull.max * 100) : 0; const st = q.hull.stage;
  const hull = nar
    ? `<div class="vh-hull nar" style="--hc:${HULL_COL[st] || HULL_COL[0]}"><i class="fa-solid fa-shield-halved"></i><b>${esc(HULL_STATES[st] || HULL_STATES[0])}</b>${own ? `<span class="pm"><a data-vh="stage" data-d="1" title="Plus abîmée">−</a><a data-vh="stage" data-d="-1" title="Réparer">+</a></span>` : ""}<div class="pips">${HULL_STATES.map((n, i) => `<i class="${i <= st ? "on" : ""}" title="${esc(n)}"></i>`).join("")}</div></div>`
    : `<div class="vh-hull num" style="--p:${pct}%;--hc:${pct > 60 ? HULL_COL[0] : pct > 30 ? HULL_COL[2] : HULL_COL[4]}"><i class="fa-solid fa-shield-halved"></i><div class="bar"><u></u><span>${fmtN(q.hull.cur)} / ${fmtN(q.hull.max)}</span></div>${own ? `<span class="pm"><a data-vh="hull" data-d="-1" title="Dégâts (Maj : ×10)">−</a><a data-vh="hull" data-d="1" title="Réparer (Maj : ×10)">+</a></span>` : ""}</div>`;
  const stat = k => { const val = q.eff[k]; const t = tierOf(k, val); return `<div class="vh-st" title="${esc(STATS[k].name)}"><i class="fa-solid ${STATS[k].icon}"></i><span>${nar && t ? esc(t.label) : fmtStat(k, val)}</span></div>`; };
  return `<header class="vh-top" data-vh="drag"><img src="${esc(v.img)}" data-vh="open" title="Ouvrir la fiche"><div class="vh-id"><b>${esc(v.name)}</b><small>${esc(v.system.rank || "")} · ${q.crew.need ? `équipage ${q.crew.filled}/${fmtN(q.crew.need)}` : "sans équipage"}</small></div>
      <span class="vh-btn">${mine().length > 1 ? `<a data-vh="next" title="Véhicule suivant"><i class="fa-solid fa-arrows-rotate"></i></a>` : ""}<a data-vh="fold" title="${col ? "Déplier" : "Replier"}"><i class="fa-solid fa-chevron-${col ? "down" : "up"}"></i></a><a data-vh="close" title="Fermer (réglage : Cadre du véhicule)"><i class="fa-solid fa-xmark"></i></a></span></header>
    ${hull}${col ? "" : `<div class="vh-stats">${KEYS.map(stat).join("")}</div>`}`;
}

let EL = null;
export function renderHud() {
  const v = cur(); if (!v) { EL?.remove(); EL = null; return; }
  if (!EL) { EL = document.createElement("div"); EL.id = "vm-hud"; document.body.appendChild(EL); bind(EL); place(EL); }
  EL.classList.toggle("col", !!game.settings.get(MOD, "hudCollapsed")); EL.innerHTML = html(v); EL.dataset.uuid = v.uuid;
}
function place(el) { let p = null; try { p = JSON.parse(localStorage.getItem(POS_KEY) || "null"); } catch (e) {} const x = p?.x ?? 120, y = p?.y ?? 90; el.style.left = `${Math.max(0, Math.min(innerWidth - 120, x))}px`; el.style.top = `${Math.max(0, Math.min(innerHeight - 60, y))}px`; }
function bind(el) {
  el.addEventListener("click", async ev => { const a = ev.target.closest("[data-vh]"); if (!a || a.dataset.vh === "drag") return; ev.preventDefault(); const v = cur(); if (!v) return;
    const k = a.dataset.vh;
    if (k === "open") return v.sheet.render(true);
    if (k === "close") return game.settings.set(MOD, "hudVehicle", "");
    if (k === "fold") return game.settings.set(MOD, "hudCollapsed", !game.settings.get(MOD, "hudCollapsed"));
    if (k === "next") { const l = mine(); const i = l.findIndex(x => x.uuid === v.uuid); return game.settings.set(MOD, "hudVehicle", l[(i + 1) % l.length]?.uuid || ""); }
    if (!v.isOwner) return;
    if (k === "stage") return actorLock(v, () => v.update({ "system.hullStage": Math.max(0, Math.min(HULL_STATES.length - 1, (Number(v.system.hullStage) || 0) + Number(a.dataset.d))) }));
    if (k === "hull") { const d = Number(a.dataset.d) * (ev.shiftKey ? 10 : 1); return actorLock(v, () => { const q = quickStats(v); return v.update({ "system.hull": Math.max(0, Math.min(q.hull.max, q.hull.cur + d)) }); }); }   /* relu sous verrou : clics rapides additionnés */
  });
  /* déplacer en tirant l'en-tête */
  el.addEventListener("pointerdown", ev => { const h = ev.target.closest(".vh-top"); if (!h || ev.target.closest("a, img") || ev.button !== 0) return; ev.preventDefault(); const r = el.getBoundingClientRect(); const dx = ev.clientX - r.left, dy = ev.clientY - r.top; el.classList.add("drag");
    const mv = e => { el.style.left = `${Math.max(0, Math.min(innerWidth - 80, e.clientX - dx))}px`; el.style.top = `${Math.max(0, Math.min(innerHeight - 40, e.clientY - dy))}px`; };
    const up = () => { el.classList.remove("drag"); removeEventListener("pointermove", mv); removeEventListener("pointerup", up); try { localStorage.setItem(POS_KEY, JSON.stringify({ x: parseInt(el.style.left), y: parseInt(el.style.top) })); } catch (e) {} };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); });
}

/* réglage « Cadre du véhicule » : la liste des véhicules est connue seulement une fois le monde chargé */
Hooks.once("init", () => {
  game.settings.register(MOD, "hudCollapsed", { scope: "client", config: false, type: Boolean, default: false, onChange: () => renderHud() });
});
Hooks.once("ready", () => {
  const choices = { "": "— aucun —", ...Object.fromEntries(mine().map(v => [v.uuid, `${v.name}${v.system.owner === game.user.id ? " (à moi)" : ""}`])) };
  game.settings.register(MOD, "hudVehicle", { name: "Cadre du véhicule", hint: "Affiche en permanence un petit cadre (comme celui du groupe) avec l'état de la coque et les caractéristiques essentielles de ce véhicule. Aussi depuis le Garage ou la fiche (bouton épingle).", scope: "client", config: true, type: String, choices, default: "", onChange: () => renderHud() });
  renderHud();
});
const touch = d => { const v = cur(); if (!v) return; const a = d?.documentName === "Item" ? d.parent : d; if (a?.uuid === v.uuid) renderHud(); };
for (const h of ["updateActor", "createItem", "updateItem", "deleteItem"]) Hooks.on(h, d => touch(d));
Hooks.on("deleteActor", a => { if (EL?.dataset.uuid === a.uuid) game.settings.set(MOD, "hudVehicle", ""); });
Hooks.on("updateSetting", s => { if (s.key === `${MOD}.mode` || s.key === `${MOD}.sizeSlots`) renderHud(); });
/** épingler un véhicule dans le cadre (ou l'enlever) */
export async function pinHud(v) { const now = game.settings.get(MOD, "hudVehicle"); await game.settings.set(MOD, "hudVehicle", now === v.uuid ? "" : v.uuid); }
