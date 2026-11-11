/* Véhicules Manhwa — point d'entrée : types d'acteur « Véhicule » et « Bien », fiche, Logement (registre), Garage, réglages, relais MJ. */
import { MOD, TYPE } from "./data.js";
import { VehicleData } from "./model.js";
import { VehicleSheet } from "./sheet.js";
import { Garage, putInService, newVehicle } from "./garage.js";
import { initSocket, isVehicle } from "./core.js";
import { pinHud, renderHud } from "./hud.js";
import { PropertyData } from "./property-model.js";
import { Logement, PTYPE, newProperty } from "./logement.js";

/* la « fiche » d'un bien ouvre simplement le registre Logement sur ce bien */
class PropertySheet extends foundry.applications.sheets.ActorSheetV2 { render(options) { if (options === true || options?.force) Logement.open(this.document.uuid); return this; } }   /* Foundry rappelle render(false) à chaque mise à jour : on n'ouvre que sur une demande explicite */

Hooks.once("init", () => {
  CONFIG.Actor.dataModels[TYPE] = VehicleData;
  CONFIG.Actor.dataModels[PTYPE] = PropertyData;
  CONFIG.Actor.typeIcons = CONFIG.Actor.typeIcons || {}; CONFIG.Actor.typeIcons[TYPE] = "fa-solid fa-sailboat"; CONFIG.Actor.typeIcons[PTYPE] = "fa-solid fa-house-chimney";
  const DSC = foundry.applications.apps?.DocumentSheetConfig ?? globalThis.DocumentSheetConfig;
  DSC.registerSheet(Actor, MOD, VehicleSheet, { types: [TYPE], makeDefault: true, label: "Fiche de véhicule" });
  DSC.registerSheet(Actor, MOD, PropertySheet, { types: [PTYPE], makeDefault: true, label: "Registre Logement" });
  const rerender = () => { for (const app of foundry.applications.instances.values()) if (app instanceof VehicleSheet || app instanceof Garage || app instanceof Logement) app.render(); };
  game.settings.register(MOD, "mode", { name: "Affichage des caractéristiques", hint: "Narratif (libellés), chiffré, ou les deux. Modifiable aussi dans Garage › Réglages.", scope: "world", config: true, type: String, default: "narrative", choices: { narrative: "Narratif", numeric: "Chiffré", both: "Les deux" }, onChange: rerender });
  game.settings.register(MOD, "sizeSlots", { scope: "world", config: false, type: Object, default: {}, onChange: rerender });
  game.settings.register(MOD, "directoryButton", { name: "Bouton « Logement » dans l'onglet Acteurs", scope: "client", config: true, type: Boolean, default: true, onChange: () => ui.actors?.render() });
});

Hooks.once("ready", () => {
  initSocket();
  globalThis.VEHICULES = { logement: sel => Logement.open(sel), garage: () => Logement.open(), garageSettings: () => Garage.open(), putInService, newVehicle, newProperty, Garage, Logement, VehicleSheet, pinHud, renderHud };
  if (!game.documentTypes?.Actor?.includes(PTYPE)) console.error(`${MOD} | le type d'acteur ${PTYPE} n'est pas déclaré : vérifier module.json (documentTypes).`);
  if (!game.documentTypes?.Actor?.includes(TYPE)) console.error(`${MOD} | le type d'acteur ${TYPE} n'est pas déclaré : vérifier module.json (documentTypes).`);
});

/* bouton Garage dans l'onglet Acteurs */
Hooks.on("renderActorDirectory", (app, html) => {
  try {
    if (!game.settings.get(MOD, "directoryButton")) return; const root = html instanceof HTMLElement ? html : html?.[0] ?? app.element; if (!root || root.querySelector(".vm-dirbtn")) return;
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "vm-dirbtn"; btn.innerHTML = `<i class="fa-solid fa-house-chimney"></i> Logement`; btn.addEventListener("click", ev => { ev.preventDefault(); Logement.open(); });
    const bar = root.querySelector(".header-actions") || root.querySelector(".directory-header") || root; bar.appendChild(btn);
  } catch (e) { console.error(MOD, e); }
});
/* outil Garage dans les contrôles de jetons */
Hooks.on("getSceneControlButtons", controls => {
  const tool = { name: "vmGarage", title: "Domaine — logements et véhicules", icon: "fa-solid fa-house-chimney", button: true, visible: true, order: 97, onChange: () => Logement.open(), onClick: () => Logement.open() };
  if (Array.isArray(controls)) controls.find(c => c.name === "token")?.tools?.push(tool); else { const t = controls.tokens || controls.token; if (t?.tools) t.tools.vmGarage = tool; }
});
/* le Garage se met à jour quand un véhicule change */
const refreshGarage = a => { if (isVehicle(a)) foundry.applications.instances.get("vm-garage")?.render(); };
Hooks.on("createActor", refreshGarage); Hooks.on("deleteActor", refreshGarage); Hooks.on("updateActor", refreshGarage);
