# Véhicules Manhwa 2.0.0 — Logement & véhicules

## 2.3.1
- Zoom de départ du plan ajusté à la largeur et à la hauteur de l'écran ; « Tout voir » corrigé.

## 2.3.0
- Plan libre : taille propre à chaque étage, réglable sans limite (bouton « Taille du plan » : poignées à étirer, saisie colonnes × lignes, dimensions de base de logements et de véhicules) ; nouvel étage « même dimension » ou « dimension de base ».
- Se déplacer sur le plan : glisser dans le vide, bouton Main pour agripper partout, zoom centré sur la souris (Ctrl + molette), « Tout voir ».
- Formes : rectangle, arrondi, ellipse, forme libre (points cliqués, puis modifiables : glisser, double-clic pour ajouter, clic droit pour retirer) ; forme changeable sur chaque pièce.
- Coque (véhicules) / contour (biens) dessinés en forme libre sous les pièces ; zones de départ avec silhouette.
- DA : étages, ligne du lieu, sommaire coloré avec section active allumée, boutons en relief.

## 2.2.1
- Nom des pièces lisible (les listes passent à la ligne), texte d'aide des champs raccourci, plan agrandi sur fond opaque.

## 2.2.0 — refonte graphique de Domaine
- Boutons colorés par action, champs « ajouter » en bleu clair néon, listes et champs à choisir plus clairs.
- Éléments posés encadrés de la couleur de leur pièce ; une couleur par type de bien, par milieu de véhicule et par genre de pièce.
- Prix d'achat, loyer, échéance en tuiles néon (montant court affiché).
- Plan : surbrillance croisée liste ↔ plan, « Voir sur le plan », zoom (boutons ou Ctrl + molette), « Agrandir le plan ».
- Véhicules : page dans Domaine avec plan, zones (pont, cale, cabine, poste de pilotage, machines, armement…), dessin, déplacement des éléments, objets de la soute rangés par zone ; « Zones de départ » selon le milieu ; lien « Zones (Domaine) » sur la fiche du véhicule.
- Colonne de gauche spatiale.

## 2.0.0 — « Logement » : le registre des biens

Le bouton **Logement** (onglet Acteurs, outil des jetons) remplace « Garage ». Il ouvre un registre de tout ce qui vit hors de la fiche : maison, appartement, chambre d'auberge, tente, entrepôt, barque… et les véhicules.

- **Navigation sans défilement** : à gauche, l'arborescence (groupes, personnages, véhicules, biens sans détenteur) avec les pièces de chaque bien ; une recherche trouve n'importe quel meuble, objet, pièce ou note et y mène directement (la ligne clignote).
- **Une page par bien** : nom, type, statut (acheté, loué, provisoire, prêté, occupé sans titre), détenteurs (un personnage, un groupe, ou les deux), lieu (texte libre ou lieu de la Carte Stellaire, avec « Où est-ce ? »), prix, loyer, échéance ; sommaire cliquable ; sections repliables : Notes, Plan, Pièces, Contenu général, Améliorations, Journal, Accès.
- **Pièces et aménagement** : on crée les pièces (modèles de départ : studio, maison, appartement, barque, tente, entrepôt, base) puis on les remplit en tapant une ligne + Entrée (« Lit double », « 2 chaises », « Coffre ×1 »). On glisse une ligne pour la réordonner ou la changer de pièce.
- **Vrais objets** : « Objet » dépose un objet d'un personnage dans une pièce (ou glisser-déposer depuis la fiche) ; « Reprendre » le rend à un personnage.
- **Plan par étage** : on dessine les pièces sur une grille, on les déplace, on les agrandit ; on place les meubles (depuis « À placer ») en les glissant sur le plan.
- **Droits** : les joueurs des personnages et des groupes détenteurs peuvent modifier ; le gestionnaire donne « peut voir » / « peut modifier » aux autres ; le MJ voit tout.

API : `VEHICULES.logement(uuid?)`, `VEHICULES.newProperty()`, `VEHICULES.garageSettings()`.

# Véhicules Manhwa 1.2.0

Module pour **Manhwa Sheet** (Foundry v13) : des véhicules ultra personnalisables, de la barque au vaisseau spatial.

**Manifeste :** `https://github.com/blendbastien/vehicules-manhwa/releases/latest/download/module.json`

## Ce que fait le module

- **Un type d'acteur « Véhicule »** avec sa propre fiche :
  - coque (état narratif ou points de coque), armure, vitesse, maniabilité, puissance de feu ;
  - soute, autonomie, confort, équipage, passagers.
- **Des emplacements par zone** : Coque, Propulsion, Direction, Roues & train, Armement, Défense, Soute, Confort, Spécial.
  - Leur nombre dépend de la taille du véhicule (Minuscule → Colossal).
  - Le MJ peut le changer pour tout le monde (Garage › Réglages) ou pour un seul véhicule (onglet Fiche).
  - Certaines pièces ajoutent des emplacements (banc de nage, plateforme d'armement, second mât…).
- **Les pièces viennent du Catalogue et doivent être sur soi.** Un joueur installe une pièce que porte un de ses personnages ; l'objet quitte l'inventaire et rejoint l'emplacement. Quand on la retire, elle revient sur un personnage ou dans la soute.
  - Les pièces de base du Catalogue 2.5.0 (rangs F et E) portent leurs bonus exacts.
  - Pour les autres modules du Catalogue, les bonus sont déduits du rang et de la description, et le MJ peut les régler.
- **Plan de coque** : un schéma du véhicule (naval, terrestre, aérien, spatial) dont les points s'allument quand une zone est équipée. Cliquer sur un point mène à la zone.
- **Soute** : déposer et reprendre des objets depuis ses personnages, et garer un véhicule plus petit à bord.
- **Équipage** : postes à pourvoir, activables et modifiables. Ils sont désactivés par défaut sur les petits véhicules.
- **Journal de bord automatique** : pièces installées ou retirées, dépôts, état de la coque, droits, équipage.
- **Droits d'accès** : le propriétaire donne « peut modifier » ou « peut voir » aux membres de ses groupes et à ses amis (Carnet). Le MJ peut changer le propriétaire.
- **Affichage narratif, chiffré ou les deux** (réglage du monde). En narratif, la vitesse devient « Lente », « Rapide »…, la coque « Robuste », « Blindée »…, avec une jauge de paliers.

## Utilisation

1. Le joueur achète un véhicule dans le Catalogue (onglet Véhicules). L'objet arrive dans l'inventaire de son personnage.
2. Il ouvre le **Garage** (bouton dans l'onglet Acteurs, ou outil dans les contrôles de jetons) et clique **Mettre en service**. Le MJ doit être connecté : la fiche est créée dans le dossier « Véhicules », le joueur en est propriétaire.
3. Il achète des pièces (Véhicules › Modules), puis clique un emplacement libre › **Installer**.

Le MJ peut créer un véhicule sans objet : Garage › **Nouveau véhicule**.

API : `VEHICULES.garage()`, `VEHICULES.putInService()`, `VEHICULES.newVehicle()`.

## Profils

Les véhicules du Catalogue sont reconnus par leur catégorie : 33 profils (radeau, barque, chaloupe, galère, voiliers, navires, sous-marin, charrette, chariot, char de guerre, cycle, moto, voiture, utilitaire, blindé, train, méca, planeur, ballon, dirigeable, aéronef, chasseur, navette, vaisseau, croiseur, station, forteresses…).

Les chiffres de base suivent le profil et le rang, puis la description (« 60 km/h », « 6 places », « 2 t »…). Montures, créatures et portails ne sont pas des véhicules.

## Historique

- **1.3.0** : **solidité quand plusieurs personnes agissent en même temps**. Mise en service : la fiche Véhicule est créée avant que l'objet soit retiré de l'inventaire (avant : objet perdu si la création échouait ; deux demandes sur une pile → deux véhicules). Transferts soute ↔ inventaire : retrait de la source avant la copie, restitution si la copie échoue, sous verrou des deux fiches (partagé avec Manhwa Sheet, le Gacha et le Catalogue). Coque, postes, soute, journal de bord, grille des emplacements : lectures et écritures sous verrou (clics rapides additionnés, plus d'écrasement). Requêtes au MJ traitées une à la fois, doublons et requêtes forgées ignorés ; un seul dossier « Véhicules » même si deux créations partent ensemble.
- **1.2.0** : **cadre flottant d'un véhicule** (réglage « Cadre du véhicule », ou épingle dans le Garage et sur la fiche) : état de la coque (avec + / − pour le propriétaire), vitesse, armure, maniabilité, puissance de feu, autonomie, équipage ; déplaçable, repliable, bouton pour passer au véhicule suivant. Choix du propriétaire avec la barre de recherche de joueurs.
- **1.1.0** : fiche de véhicule adaptée aux petites fenêtres (en-tête et plan sur une colonne, état de la coque qui passe à la ligne).
- **1.0.2** : étiquettes de la fiche (environnement, famille, taille, rareté, origine) au même style que Manhwa Sheet et le Catalogue.
- **1.0.1** : le MJ qui met en service le véhicule d'un joueur le lui attribue automatiquement (propriétaire = joueur du personnage) ; les fenêtres de dialogue passent devant la fiche ; messages de confirmation corrects côté MJ.
- **1.0.0** : première version.
