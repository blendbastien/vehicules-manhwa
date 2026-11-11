/* Véhicules Manhwa — modèle de données du type d'acteur « Véhicule ».
 * Pièces installées et soute = objets intégrés (drapeau vehicules-manhwa.slot pour les pièces). */
const F = foundry.data.fields;

export class VehicleData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const num = (initial = 0) => new F.NumberField({ required: false, nullable: true, initial });
    return {
      family: new F.StringField({ initial: "autre" }),
      env: new F.StringField({ initial: "land" }),
      size: new F.StringField({ initial: "s" }),
      rank: new F.StringField({ initial: "F" }),
      rarity: new F.StringField({ initial: "" }),
      catalogueId: new F.StringField({ initial: "" }),
      origin: new F.StringField({ initial: "" }),               /* « Nautique › Voile » ou nom du modèle */
      base: new F.SchemaField({
        hull: num(20), armor: num(0), speed: num(5), handling: num(3), firepower: num(0),
        cargo: num(200), crew: num(1), passengers: num(2), autonomy: num(12), comfort: num(0)
      }),
      hull: num(null),                                          /* coque actuelle (mode chiffré) ; null = pleine */
      hullStage: new F.NumberField({ integer: true, min: 0, max: 4, initial: 0 }), /* état narratif */
      slotsOverride: new F.ObjectField({ initial: {} }),        /* { slot: n } fixé par le MJ */
      showCrew: new F.BooleanField({ initial: true }),
      posts: new F.ArrayField(new F.ObjectField(), { initial: [] }),   /* [{ id, name, uuid }] */
      docked: new F.ArrayField(new F.StringField(), { initial: [] }),  /* uuid de véhicules garés dans la soute */
      owner: new F.StringField({ initial: "" }),                /* id de l'utilisateur propriétaire */
      log: new F.ArrayField(new F.ObjectField(), { initial: [] }),     /* [{ t, u, k, txt }] */
      description: new F.HTMLField({ initial: "" }),
      notes: new F.HTMLField({ initial: "" }),
      /* 2.2 — plan du véhicule dans Domaine : niveaux, zones (comme les pièces d'un bien) et lignes hors zone */
      floors: new F.ArrayField(new F.ObjectField(), { initial: [] }),
      rooms: new F.ArrayField(new F.ObjectField(), { initial: [] }),
      general: new F.ArrayField(new F.ObjectField(), { initial: [] })
    };
  }
}
