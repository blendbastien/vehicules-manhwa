/* Véhicules Manhwa 2.0 — modèle de données du type d'acteur « Bien » (logement, propriété, stockage…).
 * Les pièces, leurs lignes (texte libre) et le plan sont dans system ; les vrais objets Foundry déposés sont des objets
 * intégrés, rangés par le drapeau vehicules-manhwa.room (vide = contenu général). */
const F = foundry.data.fields;

export class PropertyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      kind: new F.StringField({ initial: "house" }),            /* house, flat, land, base, temp, storage, boat, misc */
      status: new F.StringField({ initial: "owned" }),          /* owned, rented, temp, lent, squat */
      owner: new F.StringField({ initial: "" }),                /* utilisateur gestionnaire (droits, cession) */
      holders: new F.ArrayField(new F.ObjectField(), { initial: [] }),   /* [{ k: "actor"|"party", id, name }] */
      place: new F.ObjectField({ initial: {} }),                /* { label, gal, sys, pl, moon, place } */
      price: new F.StringField({ initial: "" }),
      rent: new F.StringField({ initial: "" }),
      due: new F.StringField({ initial: "" }),
      notes: new F.StringField({ initial: "" }),
      floors: new F.ArrayField(new F.ObjectField(), { initial: [] }),    /* [{ id, name }] */
      rooms: new F.ArrayField(new F.ObjectField(), { initial: [] }),     /* [{ id, name, kind, floor, x, y, w, h, notes, lines: [{ id, t, q, x, y }] }] */
      general: new F.ArrayField(new F.ObjectField(), { initial: [] }),   /* lignes hors pièce */
      upgrades: new F.ArrayField(new F.ObjectField(), { initial: [] }),  /* [{ id, t, done }] */
      log: new F.ArrayField(new F.ObjectField(), { initial: [] })        /* [{ t, u, k, txt }] */
    };
  }
}
