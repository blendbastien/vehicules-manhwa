# Source unique des pièces de base (rang F/E) : écrit dans le Catalogue ET dans le module.
import json, sys
SLOT_NAME = {"hull":"Coque","propulsion":"Propulsion","steering":"Direction","wheels":"Roues & train","weapons":"Armement","defense":"Défense","cargo":"Soute","comfort":"Confort","special":"Spécial"}
SUB = {"hull":"Défense","propulsion":"Propulsion","steering":"Navigation","wheels":"Propulsion","weapons":"Armement","defense":"Défense","cargo":"Utilitaire","comfort":"Confort","special":"Utilitaire"}
ENV = {"sea":"navires","land":"terrestres","air":"aéronefs","space":"vaisseaux"}
BL = {"hull":"Coque","armor":"Armure","speed":"Vitesse","speedPct":"Vitesse","handling":"Maniabilité","firepower":"Puissance de feu","cargo":"Soute","crew":"Équipage","passengers":"Passagers","autonomy":"Autonomie","comfort":"Confort"}
# (nom, rang, prix, emplacement, environnements, bonus, description, époque)
P = [
 # COQUE
 ("Planches de renfort", "F", 60, "hull", ["sea","land"], {"hull":10}, "Planches de chêne clouées sur les flancs.", "Médiéval"),
 ("Calfatage au goudron", "F", 40, "hull", ["sea"], {"hull":5,"speedPct":5}, "Coutures de la coque bouchées à l'étoupe et au goudron : plus d'eau dans les fonds.", "Médiéval"),
 ("Bâche de cuir bouilli", "F", 45, "hull", ["land"], {"hull":6,"comfort":1}, "Couverture rigide tendue sur arceaux, protège le chargement.", "Médiéval"),
 ("Bordé doublé", "F", 150, "hull", ["sea"], {"hull":15}, "Seconde épaisseur de planches sur toute la coque.", "Médiéval"),
 ("Plaques de fer clouées", "F", 220, "hull", ["sea","land"], {"hull":25,"armor":2,"speedPct":-5}, "Plaques de fer forgé clouées sur la coque ou la caisse. Solide, mais lourd.", "Médiéval"),
 ("Doublage de cuivre", "E", 900, "hull", ["sea"], {"hull":15,"speedPct":8}, "Feuilles de cuivre sous la ligne de flottaison : ni tarets ni algues.", "Renaissance"),
 ("Plaques d'acier rivetées", "E", 1400, "hull", ["sea","land"], {"hull":45,"armor":4,"speedPct":-8}, "Blindage d'acier riveté, pour qui s'attend à recevoir des coups.", "Renaissance"),
 # PROPULSION
 ("Paire de rames", "F", 25, "propulsion", ["sea"], {"speed":2}, "Deux rames de sapin et leurs tolets.", "Intemporel"),
 ("Rames longues de frêne", "F", 70, "propulsion", ["sea"], {"speed":3,"handling":1}, "Rames souples et longues, la nage est plus ample.", "Médiéval"),
 ("Mât de fortune et voile", "F", 160, "propulsion", ["sea"], {"speed":5,"autonomy":24}, "Un mât court et une toile simple : la barque avance sans ramer.", "Médiéval"),
 ("Voile latine de lin", "F", 240, "propulsion", ["sea"], {"speed":7,"handling":1,"autonomy":24}, "Voile triangulaire, remonte bien au vent.", "Médiéval"),
 ("Foc", "F", 120, "propulsion", ["sea"], {"speed":3,"handling":1}, "Petite voile d'avant, aide aux manœuvres.", "Médiéval"),
 ("Voile renforcée", "F", 380, "propulsion", ["sea"], {"speed":9,"autonomy":48}, "Toile doublée et ralingues de chanvre : tient les coups de vent.", "Médiéval"),
 ("Grand-voile de coton", "E", 900, "propulsion", ["sea"], {"speed":12,"autonomy":72}, "Grande voile de coton serré, pour les traversées.", "Renaissance"),
 ("Harnais de cuir", "F", 50, "propulsion", ["land"], {"speed":3}, "Harnais ajusté : l'animal tire mieux et se fatigue moins.", "Médiéval"),
 ("Palonnier double", "F", 140, "propulsion", ["land"], {"speed":5,"cargo":150}, "Permet d'atteler deux bêtes côte à côte.", "Médiéval"),
 ("Brancards renforcés", "F", 90, "propulsion", ["land"], {"cargo":100}, "Brancards de frêne cerclés de fer, supportent une charge plus lourde.", "Médiéval"),
 # DIRECTION
 ("Gouvernail de chêne", "F", 90, "steering", ["sea"], {"handling":1}, "Safran de chêne et sa barre.", "Médiéval"),
 ("Barre franche ferrée", "F", 140, "steering", ["sea"], {"handling":2}, "Barre ferrée et ferrures neuves, sans jeu.", "Médiéval"),
 ("Gouvernail d'étambot", "E", 700, "steering", ["sea"], {"handling":3,"speedPct":3}, "Gouvernail central articulé, la référence des navires de haute mer.", "Renaissance"),
 ("Avant-train pivotant", "F", 160, "steering", ["land"], {"handling":2}, "L'essieu avant tourne : le chariot prend les virages serrés.", "Médiéval"),
 ("Frein à sabot", "F", 60, "steering", ["land"], {"handling":1}, "Patin de bois actionné par levier, pour les descentes.", "Médiéval"),
 # ROUES
 ("Roues pleines de bois", "F", 40, "wheels", ["land"], {"speed":2}, "Roues taillées d'une pièce, robustes et lourdes.", "Antique"),
 ("Roues à rayons", "F", 120, "wheels", ["land"], {"speed":4,"handling":1}, "Roues légères à moyeu et rayons.", "Médiéval"),
 ("Roues cerclées de fer", "F", 200, "wheels", ["land"], {"speed":3,"hull":8}, "Bandage de fer posé à chaud : ne s'use plus sur les pavés.", "Médiéval"),
 ("Essieux graissés", "F", 50, "wheels", ["land"], {"speedPct":5}, "Essieux neufs et suif : moins de frottement, moins de grincements.", "Médiéval"),
 ("Patins de traîneau", "F", 90, "wheels", ["land"], {"speed":3}, "Patins ferrés pour la neige et la glace.", "Médiéval"),
 ("Suspensions à lanières", "E", 600, "wheels", ["land"], {"comfort":2,"speed":2}, "Caisse suspendue à des lanières de cuir : on ne sent plus les ornières.", "Renaissance"),
 # ARMEMENT
 ("Arbalète de bord", "F", 260, "weapons", ["sea","land"], {"firepower":4}, "Arbalète lourde montée sur pivot.", "Médiéval"),
 ("Lames de moyeu", "F", 300, "weapons", ["land"], {"firepower":5}, "Lames fixées aux roues : malheur à qui s'approche.", "Antique"),
 ("Éperon de bronze", "E", 800, "weapons", ["sea"], {"firepower":6,"hull":5}, "Éperon de proue pour éventrer les coques adverses.", "Antique"),
 ("Pierrier", "E", 1200, "weapons", ["sea","land"], {"firepower":10}, "Petit canon pivotant chargé de pierres ou de mitraille.", "Renaissance"),
 # DÉFENSE
 ("Pavois de bois", "F", 120, "defense", ["sea","land"], {"armor":2}, "Panneaux de bois le long du bord, pour s'abriter des flèches.", "Médiéval"),
 ("Boucliers de bastingage", "F", 90, "defense", ["sea","land"], {"armor":1,"hull":3}, "Rangée de boucliers ronds accrochés au bord.", "Médiéval"),
 ("Filets d'abordage", "F", 70, "defense", ["sea"], {"armor":1}, "Filets tendus au-dessus du pont : l'abordage devient un calvaire.", "Médiéval"),
 ("Bâche ignifugée", "F", 110, "defense", ["sea","land"], {"armor":1}, "Toile imbibée d'alun, résiste aux flèches enflammées.", "Médiéval"),
 # SOUTE
 ("Coffres arrimés", "F", 60, "cargo", ["sea","land"], {"cargo":50}, "Coffres cerclés fixés au plancher.", "Médiéval"),
 ("Filets de cale", "F", 45, "cargo", ["sea","land"], {"cargo":40}, "Filets pour suspendre et caler la marchandise.", "Médiéval"),
 ("Ridelles et galerie", "F", 80, "cargo", ["land"], {"cargo":120}, "Planches latérales et galerie de toit : on charge plus haut.", "Médiéval"),
 ("Tonneaux d'eau douce", "F", 35, "cargo", ["sea","land"], {"autonomy":24}, "Réserve d'eau et de vivres pour tenir plus longtemps.", "Intemporel"),
 ("Cale agrandie", "E", 900, "cargo", ["sea"], {"cargo":400,"speedPct":-3}, "Cloisons repoussées et pont abaissé : la cale double.", "Renaissance"),
 # CONFORT
 ("Taud de toile", "F", 70, "comfort", ["sea","land"], {"comfort":1}, "Toile tendue pour s'abriter du soleil et de la pluie.", "Médiéval"),
 ("Banquette rembourrée", "F", 60, "comfort", ["sea","land"], {"comfort":1,"passengers":1}, "Banc garni de crin et de cuir, une place de plus.", "Médiéval"),
 ("Couchettes suspendues", "F", 140, "comfort", ["sea","land"], {"comfort":1,"crew":2}, "Hamacs et bat-flanc : on peut dormir à bord.", "Médiéval"),
 ("Brasero de bord", "F", 90, "comfort", ["sea","land"], {"comfort":1,"autonomy":12}, "Petit foyer sur bac de sable : repas chauds et nuits moins froides.", "Médiéval"),
 ("Cabine de poupe", "E", 1100, "comfort", ["sea"], {"comfort":3,"passengers":2}, "Petite cabine fermée à l'arrière, avec couchettes.", "Renaissance"),
 # SPÉCIAL
 ("Ancre de fer", "F", 80, "special", ["sea"], {"handling":1}, "Ancre forgée et sa chaîne : on mouille où l'on veut.", "Médiéval"),
 ("Lanterne de proue", "F", 30, "special", ["sea","land"], {"handling":1}, "Lanterne à volets, pour naviguer ou rouler de nuit.", "Médiéval"),
 ("Pompe de cale à main", "F", 120, "special", ["sea"], {"hull":5,"autonomy":24}, "Pompe à bras : l'eau qui entre ressort.", "Médiéval"),
 ("Banc de nage supplémentaire", "F", 100, "special", ["sea"], {"crew":2,"slots":{"propulsion":1}}, "Un banc de plus : deux rameurs et un emplacement de propulsion en plus.", "Médiéval"),
 ("Plateforme d'armement", "F", 150, "special", ["sea","land"], {"slots":{"weapons":1}}, "Plateforme renforcée : un emplacement d'armement en plus.", "Médiéval"),
 ("Arrimages supplémentaires", "F", 90, "special", ["sea","land"], {"slots":{"cargo":1}}, "Anneaux et sangles : un emplacement de soute en plus.", "Médiéval"),
 ("Second mât et bôme", "E", 800, "special", ["sea"], {"slots":{"propulsion":1},"speed":2}, "Un second mât : un emplacement de propulsion en plus.", "Renaissance"),
 ("Caisse à outils de charpentier", "F", 75, "special", ["sea","land"], {"hull":3}, "Maillet, clous, étoupe et planches : on répare en route.", "Médiéval"),
]
VEH = [
 ("Radeau", "F", 80, "Nautique", "Rame", "Troncs liés, 2 places, une perche et une pagaie.", "Intemporel"),
 ("Sloop", "E", 3200, "Nautique", "Voile", "Un mât, 9 m, 4 couchettes, 6 nœuds.", "Médiéval"),
 ("Cogue", "E", 4800, "Nautique", "Voile", "Navire de commerce à voile carrée, 20 t de cargaison, 8 marins.", "Médiéval"),
]
def fmtb(b):
  out=[]
  for k,v in b.items():
    if k=="slots":
      for s,n in v.items(): out.append(f"+{n} emplacement {SLOT_NAME[s].lower()}")
      continue
    lab=BL[k]; sign="+" if v>0 else "−"; a=abs(v)
    unit={"speed":" km/h","speedPct":" %","autonomy":" h","cargo":" kg"}.get(k,"")
    out.append(f"{lab} {sign}{a}{unit}")
  return " · ".join(out)
def build(start):
  items=[]; n=start
  for (name,rk,price,slot,envs,b,desc,ep) in P:
    vp={"slot":slot,"env":envs,"bonus":b}
    full=f"{desc} — Pièce de véhicule ({SLOT_NAME[slot]}) : {fmtb(b)}. Pour {', '.join(ENV[e] for e in envs)}."
    items.append({"t":"vehicle","cat":"Modules","sub":SUB[slot],"n":name,"rang":rk,"rar":"Commun" if rk=="F" else "Peu Commun","price":price,"desc":full,"tags":["véhicule","pièce"],"origin":"Réseau","epoch":ep,"stock":40 if rk=="F" else 12,"full":40 if rk=="F" else 12,"reqShop":1 if rk=="F" else 2,"id":f"VM-{n:04d}","vp":vp}); n+=1
  for (name,rk,price,cat,sub,desc,ep) in VEH:
    items.append({"t":"vehicle","cat":cat,"sub":sub,"n":name,"rang":rk,"rar":"Commun" if rk=="F" else "Peu Commun","price":price,"desc":desc,"tags":["véhicule"],"origin":"Réseau","epoch":ep,"stock":10,"full":10,"reqShop":1 if rk=="F" else 2,"id":f"VM-{n:04d}"}); n+=1
  return items
if __name__=="__main__":
  mode=sys.argv[1]
  if mode=="catalogue":
    p=sys.argv[2]; d=json.load(open(p,encoding="utf-8"))
    d["items"]=[x for x in d["items"] if not ("vp" in x or x.get("_vm"))]
    names={x["n"] for x in d["items"] if x["t"]=="vehicle"}
    start=1
    new=[x for x in build(start) if x["n"] not in names or "vp" in x]
    for x in new: x["_vm"]=1
    d["items"]+=new
    json.dump(d,open(p,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
    print("ajoutés",len(new),"à partir de",start)
  else:
    out=sys.argv[2]; d=json.load(open(sys.argv[3],encoding="utf-8"))
    parts={x["id"]:{"n":x["n"],**x["vp"]} for x in d["items"] if "vp" in x}
    byname={x["n"]:x["id"] for x in d["items"] if "vp" in x}
    open(out,"w",encoding="utf-8").write("/* généré par tools/parts.py — pièces de base du Catalogue (id → emplacement, environnements, bonus) */\nexport const CATALOGUE_PARTS = "+json.dumps(parts,ensure_ascii=False)+";\nexport const PART_BY_NAME = "+json.dumps(byname,ensure_ascii=False)+";\n")
    print("module:",len(parts))
