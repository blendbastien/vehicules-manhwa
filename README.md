# Domaine - Manhwa — `vehicules-manhwa`

Types d'acteur `vehicle` et `property`, Garage, Logement (registre des biens) et HUD de véhicule. API `globalThis.VEHICULES`.

La documentation détaillée du module est dans `DOCUMENTATION.md`.

Code de la version **2.5.2** (dernière release), pour Foundry VTT v13.

## Liens avec la suite Manhwa

La suite compte un système (Fiche - Manhwa) et 11 modules. La Fiche est le centre : les données partagées y vivent et les modules les lisent via `globalThis.MANHWA`.

- Lieux via la Carte Stellaire, pièces via la Boutique, destinataires via `MANHWA.pickers` (Fiche).
- Règle commune : un module ne plante jamais si un autre est absent (vérifier `game.modules.get(id)?.active` avant d'appeler son API).

## À savoir

`scripts/parts-data.js` est généré par `tools/parts.py`.

## Livraison

1. Augmenter `version` dans `module.json` (jamais deux livraisons au même numéro).
2. Construire le zip, qui doit contenir le dossier `vehicules-manhwa/` :
   ```bash
   mkdir -p build/vehicules-manhwa && git archive HEAD | tar -x -C build/vehicules-manhwa
   cd build && zip -qr vehicules-manhwa.zip vehicules-manhwa
   ```
3. Créer la release GitHub `vX.Y.Z` avec **exactement 2 fichiers** : `module.json` et `vehicules-manhwa.zip`. Le manifeste pointe vers `releases/latest/download/…`.
4. The Forge : Bazaar → *Install From Manifest* avec l'URL versionnée `https://github.com/blendbastien/vehicules-manhwa/releases/download/vX.Y.Z/module.json`. Ne jamais utiliser *Update All Packages*.
5. Redémarrer le monde de test, vérifier la version installée et tester.
