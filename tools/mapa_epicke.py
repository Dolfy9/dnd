#!/usr/bin/env python3
"""Šest autorských scén Montelienu; obrazové assety, nikoli generovaná kresba.

python3 tools/mapa_epicke.py --zapsat
Bez přepínače pouze vypíše statistiky. Přepisuje jen šest vlastních ID.
Rozvržení a ohniska jsou pevná, seed ovlivňuje pouze drobné rekvizity.
"""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / "11_Mapy/bojove_mapy.json"


def inside(x, y, points):
    result = False
    for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
    return result


class Scene:
    def __init__(self, slug, name, ground, place, description, seed, weather, ambient, tint):
        self.rng = random.Random(seed)
        self.w, self.h = 36, 28
        self.grid = [["." for _ in range(self.w)] for _ in range(self.h)]
        self.m = dict(id=slug, nazev=name, podklad=ground, misto=place,
                      popis=description + " Autorská herní scéna; místní názvy zón a zápletky jsou návrhem pro PJ.",
                      osvetleni="Vizuální atmosféra; dosah světel ve stopách.",
                      start={"druzina": [], "nepratele": []}, objekty=[], steny=[], malba=[],
                      svetla=[], poznamky=[], kresby=[], vyska={}, textury={},
                      atmosfera={"amb": ambient, "barva": tint},
                      pocasi={"typ": weather, "sila": .32 if weather != "bourka" else .58, "vitr": 112},
                      mrizkaStyl={"typ": "dots", "barva": "#ddd4b1", "opacita": .13})

    def uid(self, kind):
        return kind + str(len(self.m[kind]))

    def obj(self, asset, x, y, w=1, h=None, rot=0, **options):
        o = dict(id=self.uid("objekty"), asset=asset, x=round(x, 3), y=round(y, 3),
                 w=round(w, 3), h=round(h if h is not None else w, 3), rot=round(rot, 2))
        o.update(options)
        self.m["objekty"].append(o)
        return o

    def paint(self, texture, points, b=1, o=1, h=.5, r=0, poly=False):
        self.m["malba"].append(dict(id=self.uid("malba"), t=texture, b=b, o=o, h=h,
                                    r=r, poly=poly, p=[list(p) for p in points]))

    def area(self, points, texture, tile=".", **options):
        natural = texture in ("lava", "led", "teren-voda", "melka-voda", "teren-propast")
        self.paint(texture, points, poly=True, h=.3 if natural else 1, b=1.5 if natural else 1, **options)
        for y in range(self.h):
            for x in range(self.w):
                if inside(x + .5, y + .5, points):
                    self.grid[y][x] = tile

    def rect(self, x, y, w, h, texture, tile=".", **options):
        self.area([(x,y),(x+w,y),(x+w,y+h),(x,y+h)], texture, tile, **options)

    def wall(self, a, b, typ="wall", **options):
        self.m["steny"].append(dict(id=self.uid("steny"), a=list(a), b=list(b), typ=typ, **options))

    def enclosure(self, points, gaps=None, typ="wall"):
        for i, (a,b) in enumerate(zip(points, points[1:] + points[:1])):
            if gaps and i in gaps:
                lo, hi, kind = gaps[i]
                p = lambda t: (round(a[0]+(b[0]-a[0])*t,3),round(a[1]+(b[1]-a[1])*t,3))
                self.wall(a, p(lo), typ)
                self.wall(p(lo), p(hi), kind)
                self.wall(p(hi), b, typ)
            else:
                self.wall(a,b,typ)

    def light(self, x, y, color="#ffbb70", bright=8, dim=16, intensity=.8, flicker=True):
        self.m["svetla"].append(dict(id=self.uid("svetla"), x=x,y=y,bright=bright,dim=dim,
                                     color=color,intenzita=intensity,blikani=flicker))

    def note(self, x, y, text):
        self.m["poznamky"].append(dict(id=self.uid("poznamky"),x=x,y=y,text=text))

    def cluster(self, assets, x, y, n, rx, ry, size=(.35,.8), avoid=None, **options):
        for _ in range(n):
            for _ in range(100):
                a = self.rng.uniform(0, math.tau)
                r = math.sqrt(self.rng.random())
                px, py = x+math.cos(a)*r*rx, y+math.sin(a)*r*ry
                if .6 < px < self.w-.6 and .6 < py < self.h-.6 and (not avoid or not avoid(px,py)):
                    break
            else:
                raise ValueError("Shluk nemá volné místo")
            s = self.rng.uniform(*size)
            self.obj(self.rng.choice(assets),px,py,s,s*self.rng.uniform(.8,1.2),
                     self.rng.uniform(0,360),**options)

    def starts(self, party, enemies):
        self.m["start"] = {"druzina":[list(p) for p in party],"nepratele":[list(p) for p in enemies]}

    def finish(self):
        self.m["mrizka"] = ["".join(row) for row in self.grid]
        return self.m


def inn():
    s = Scene("epic-octowerin-zlaty-kanec","Octowerin – Poslední noc U Zlatého kance","mesto",
              "03_Mesta/Mesto_Octowerin.md",
              "Déšť bubnuje do oken cechovního hostince. Šenk s krbem, kuchyně, soukromý salonek, "
              "tři pokoje a dvůr s vozem tvoří propojenou scénu. Sklepní poklop skrývá pašeráckou chodbu.",
              301,"dest",.50,"#182237")
    s.rect(0,0,36,28,"kocici-hlavy")
    s.paint("hlina",[(0,25),(8,23),(18,24),(30,26),(36,24)],2.8,.65,.25,23)
    s.rect(3,3,29,20,"drevo",r=90)
    s.rect(23,3,9,9,"dlazba")
    s.rect(3.4,3.4,8,7.6,"koberec",o=.85,r=12)
    s.enclosure([(3,3),(32,3),(32,23),(3,23)],{0:(.38,.45,"window"),1:(.22,.33,"window"),2:(.36,.44,"door"),3:(.38,.50,"window")})
    s.wall((3,11),(15,11));s.wall((15,3),(15,11))
    s.wall((3,16),(12,16));s.wall((12,11),(12,16))
    s.wall((23,3),(23,8));s.wall((23,8),(23,10),"door");s.wall((23,10),(23,16))
    s.wall((23,16),(29,16));s.wall((29,16),(31,16),"door");s.wall((31,16),(32,16))
    s.wall((3,19),(9,19));s.wall((9,19),(11,19),"door");s.wall((11,19),(12,19))
    s.wall((12,16),(12,23));s.wall((12,13),(15,13),"door")
    for a,b in [((5,3),(7,3)),((18,3),(20,3)),((32,19),(32,21)),((3,13),(3,15))]:
        s.wall(a,b,"window")
    s.obj("pult",25,14.3,6,2.2,8,cover=2,difficult=True)
    s.obj("krb",18.7,4.3,3,2.3,light={"bright":10,"dim":15})
    s.obj("kotel",29.3,5.5,1.5)
    s.obj("stolni-deska",27,8.5,3,1.5,4,cover=2)
    s.obj("p3-padaci-dvere",29,19.6,1.6,rot=7)
    s.obj("gen2-vuz",7,25.2,3.2,2.2,-14,cover=2,difficult=True)
    for x,y,r in [(16.6,10,12),(17.5,18,-17),(9,13.5,4),(27.6,20,-8),(8.2,6.5,3)]:
        s.obj("gen2-koberec",x,y,4.5,3.2,r,z=-2)
        s.obj("stul-kulaty" if x<20 else "stul-obdelnik",x,y,2.2,2.2,r,cover=2,difficult=True)
        for a in [0,78,180,265]:
            t=math.radians(a+r);s.obj("zidle",x+1.6*math.cos(t),y+1.6*math.sin(t),.75,1,a+r-90)
        s.obj("svicka",x+.45,y-.3,.3)
        s.obj("p3-nadobi",x-.3,y+.2,.85,.65,r)
        s.light(x,y,bright=4,dim=9,intensity=.6)
    for x,y,r in [(5.2,18,90),(5.2,21,90),(6,8,0)]:
        s.obj("postel",x,y,2.4,1.5,r)
        s.obj("truhel",x+2.5,y,.85,.6,-7,cover=2)
    for x,y,r in [(11,5,90),(30.3,10,0),(30.4,13,0),(14,21,90)]:
        s.obj("skrin" if x<20 else "gen2-regal",x,y,2,1,r,blocks=True,cover=3)
    for x,y in [(4,4),(14,4),(31,17),(23.7,21.8)]:
        s.obj("kandelabr",x,y,.65)
        s.light(x,y)
    for x,y in [(30,13),(25.8,5),(30,24.8),(4.5,24.5),(11.5,25.3)]:
        s.cluster(["sud","bedna","pydel"],x,y,7,1.3,1.1,(.55,.95),cover=2,difficult=True)
    for x,y in [(23.8,18),(4.5,10),(31,5),(33.5,9),(1.5,19)]:
        s.cluster(["smiti","kamen","kvetinac"],x,y,5,.8,1,(.3,.65))
    s.paint("teren-rubble",[(24,23),(25,25),(28,26)],1.1,.45,.2,32)
    s.light(18.7,4.6,"#ff9b42",12,20,.8)
    s.light(20,25,"#9cc4e0",5,12,.35,False)
    s.note(29,19.7,"Sklepní poklop: DC 13 Investigation odhalí čerstvé škrábance. Žebřík do pašeráckého sklepa.")
    s.note(8,6.5,"Salonek kupců: tajná schránka pod stolem. Hostinec a jeho příběh jsou návrh pro PJ.")
    s.note(26,14,"Šenk: pult poskytuje poloviční kryt; převrácené sudy vytvoří těžký terén.")
    s.starts([(16,24),(17,24),(18,24),(19,24),(16,25),(19,25)],[(24,19),(27,17),(9,9)])
    return s.finish()


def crypt():
    s=Scene("epic-mictima-modra-hrobka","Mictima – Hrobka Modré přísahy","krypta",
            "03_Mesta/Mesto_Mictima.md",
            "Pod hřbitovem se otevírá lomená pohřební cesta. Ústřední osmistěnná síň, "
            "postranní niky a zatopený relikviář vedou k modrému portálu. Sarkofágy nabízejí kryt, kosti zpomalují.",
            302,"mlha",.45,"#111d35")
    s.rect(0,0,36,28,"teren-bedrock",tile="#")
    hall=[(11,6),(15,3),(26,3),(31,7),(31,17),(27,21),(17,21),(11,16)]
    s.area(hall,"teren-krypta")
    corridor=[(3,25),(3,19),(7,15),(11,12),(15,16),(10,20),(8,25)]
    s.area(corridor,"dlazba",r=39)
    s.rect(3,5,8,7,"dlazba",r=12)
    s.rect(27,22,7,4,"dlazba")
    s.area([(24,19),(28,18),(31,23),(28,25),(24,21)],"dlazba",r=27)
    s.enclosure(hall,{5:(.15,.37,"door"),7:(.18,.4,"door")})
    s.m["steny"] = [w for w in s.m["steny"] if not (w["a"] == [11, 12] and w["b"] == [11, 6])]
    s.wall((11,12),(11,10.7));s.wall((11,10.7),(11,9.3),"door");s.wall((11,9.3),(11,6))
    s.enclosure(corridor,{2:(.5,.95,"door"),3:(.15,.8,"door")})
    s.enclosure([(3,5),(11,5),(11,12),(3,12)],{1:(.6,.9,"door")})
    s.enclosure([(27,22),(34,22),(34,26),(27,26)],{3:(.05,.55,"door")})
    s.paint("teren-ruiny",[(14,8),(20,7.7),(27,8.4),(27.5,12),(26.6,16),(20,16.4),(15,16),(14.3,12)],1.5,.5,.35,45,True)
    s.obj("mag-kruh",22,11.8,7,7,-12,z=-2,anim=False)
    s.obj("gen2-portal",24.5,7.2,3.7,3.7,27)
    s.obj("oltar",22,17,3.3,1.6,0,blocks=True,cover=3)
    s.obj("socha",14,8,1.7,2,28,blocks=True,cover=3)
    s.obj("socha",29,16.5,1.7,2,-30,blocks=True,cover=3)
    for x,y,r in [(16,5.6,0),(21,5.2,4),(14,17,42),(18.5,18.8,8),(28,11,90),(5.5,7.2,-8),(8.5,9,9),(30,24,90)]:
        s.obj("sarkofag",x,y,1.5,2.8,r,cover=2,difficult=True)
        s.cluster(["gen2-kosti","pavouk-web","kamen"],x+.5,y+.5,4,1.5,1.3,(.3,.7))
    for x,y in [(15,10),(15,14.5),(27.8,7.5),(27.5,18),(4.4,10.7),(9.8,6)]:
        s.obj("sloup",x,y,1.1,blocks=True,cover=3)
    for x,y,c in [(12,8,"#7ec8ff"),(29,8,"#89beff"),(16,19,"#91aaff"),(27,18,"#769cff"),(6,21,"#88d4dd"),(6,6,"#a68fff")]:
        s.obj("brasier",x,y,.8)
        s.light(x,y,c,7,15,.8)
    s.light(24.5,7.2,"#57baff",10,18,.7,False)
    s.rect(27.6,22.6,5.6,2.8,"melka-voda",tile=",",o=.8)
    s.paint("teren-rubble",[(4.5,23),(6,20),(10,16)],1.4,.7,.3,46)
    s.paint("teren-rubble",[(14,7),(13,12),(16,17)],1.2,.5,.3,32)
    s.cluster(["kostlivec","gen2-kosti","gen2-houby","trhlina"],20,12,32,9,7,(.3,.75),
              avoid=lambda x,y: abs(x-22)<3 and abs(y-12)<3)
    s.cluster(["pavouk-web","kamen","gen2-krystal"],6.5,8,12,3,2.5,(.3,.65))
    s.cluster(["gen2-kosti","gen2-hrob","trhlina"],6.2,21.5,14,2,2.5,(.3,.7))
    s.obj("gen2-krev",18,16,.8,1.3,70,z=-1,anim=False)
    s.note(24.5,7.2,"Brána přísahy: otevře se po vyslovení jména pohřbeného strážce; bez nutného boje.")
    s.note(30,24,"Relikviář: voda po kolena, těžký terén. Stříbrný klíč leží pod hladinou.")
    s.note(22,17,"Oltář: nápis připomíná porušenou přísahu. Sarkofágy lze obejít po širokém okruhu.")
    s.starts([(4,23),(5,23),(6,23),(4,24),(5,24),(6,24)],[(19,10),(24,14),(26,16),(8,10)])
    return s.finish()


def ruins():
    s=Scene("epic-nolien-chram-reky","Nölien – Chrám Stříbrného proudu","les",
            "02_Zeme/Elfsky_Stat_Nolien.md",
            "Večerní světlo nad zarostlou Tirentovou svatyní. Šikmá procesní cesta vede od řeky "
            "k rozlomenému polygonálnímu chrámu, mezi kořeny svítí staré runy. Dřevěný most spojuje oba břehy.",
            303,"mlha",.67,"#263c43")
    s.rect(0,0,36,28,"teren-g",tile="g")
    river=[(23,0),(29,0),(27,6),(28,10),(25,17),(26,22),(23,28),(18,28),(21,21),(20,16),(23,9),(21,5)]
    s.area(river,"teren-voda",tile="~")
    s.paint("teren-melcina",[(23.3,0),(21.7,5),(23.5,9),(20.8,17),(22,22),(19,28)],1.1,.7,.4)
    s.paint("hlina",[(0,23),(7,19),(12,14),(17,12),(22,12),(32,15),(36,17)],2.4,.9,.25,34)
    s.rect(20,11.2,8,2.3,"drevo",tile="=",r=90)
    s.wall((20,11.3),(27.8,11.3),"half");s.wall((20,13.4),(27.8,13.4),"half")
    temple=[(6,7),(10,3.5),(17,4),(20,8),(18,16),(11,18),(5,13)]
    s.area(temple,"teren-ruiny",r=26)
    s.enclosure(temple,{0:(.4,.8,"window"),2:(.2,.75,"half"),4:(.35,.7,"door"),5:(.2,.65,"half")})
    s.obj("mag-kruh",12,10,6,6,20,z=-2,anim=False)
    s.obj("gen2-oltar",12,7,2.6,1.5,17,blocks=True,cover=3)
    s.obj("gen2-socha",16,7,1.8,2,-20,blocks=True,cover=3)
    for x,y,r in [(7.2,7,20),(18,8.5,-15),(8,14,-32),(16,14,32),(11,4.5,0)]:
        s.obj("sloup",x,y,1.05,blocks=True,cover=3)
        s.obj("p3-sloup-ruina",x+.6,y+.9,2,1.2,r,difficult=True,cover=2)
    for pts in [[(5,7),(6,12),(10,15)],[(11,17),(16,16),(18,12)],[(8,5),(12,5),(15,6)]]:
        s.paint("bazina",pts,1.7,.5,.15,48)
        s.paint("teren-rubble",pts,.8,.45,.3,22)
    s.obj("gen2-kmen",22,21,4.5,1.3,-38,cover=2,difficult=True)
    s.obj("gen2-keltsky_kamen",30,7,1.8,2,23,cover=2)
    s.light(12,8,"#96e6cd",9,19,.65,False)
    s.light(30,7,"#a7c6ff",8,14,.55,False)
    s.light(17,24,"#ca9ae7",6,15,.5,False)
    for x,y,n,rx,ry in [(3,4,12,3,3),(3,14,13,3,5),(9,25,12,7,2),(31,23,14,4,4),(32,4,10,3,3),(32,10,8,3,2)]:
        s.cluster(["strom","gen2-strom","gen2-strom2","strom-velky"],x,y,n,rx,ry,(2,3.5),
                  avoid=lambda x,y: abs(y-12)<2 or (5<x<20 and 4<y<18),cover=3)
    for x,y in [(6,7),(6,13),(17,14),(12,17),(27.5,19),(30,6),(15,23)]:
        s.cluster(["gen2-kapradi","koreny","gen2-houby","vinorost","gen2-ker"],x,y,8,2.2,1.8,(.4,.95))
    for x,y in [(25.8,5),(25,17),(23.5,24)]:
        s.cluster(["gen2-rakos","gen2-lekniny","kamen"],x,y,5,1,2,(.5,.85))
    s.note(12,7,"Tirentův oltář: rozbitá mísa odráží nebe bez ohledu na koruny stromů.")
    s.note(24,12,"Most: zábradlí poskytuje poloviční kryt, průchod po prostředku je volný.")
    s.note(30,7,"Runový kámen: lze vyjednat průchod se strážci; kořeny u zdi tvoří těžký terén.")
    s.starts([(2,21),(3,21),(4,21),(2,22),(3,22),(4,22)],[(10,10),(16,11),(29,16),(30,18)])
    return s.finish()


def harbor():
    s=Scene("epic-menkant-boure","Menkant – Bouře nad Zlatou kotvou","pristav",
            "03_Mesta/Mesto_Menkant.md",
            "Blesky nad Menkantskou zátokou. Sklad Zlaté kotvy, nákladní molo a paluba přivázané "
            "karavely vytvářejí tři propojené arény; sudy a náklad nabízejí kryt, mokré rampy kloužou.",
            304,"bourka",.58,"#16283d")
    s.rect(0,0,36,28,"teren-voda",tile="~")
    s.rect(0,0,12.5,28,"kocici-hlavy")
    s.rect(2,3,9,9,"drevo",r=90)
    s.enclosure([(2,3),(11,3),(11,12),(2,12)],{1:(.55,.82,"door"),2:(.2,.45,"window")})
    s.rect(11,13,18,3.5,"drevo",tile="=",r=90)
    s.rect(14,6,3,17,"drevo",tile="=",r=0)
    s.rect(10,23,12,2,"drevo",tile="=",r=90)
    ship=[(26,3),(28,5),(29.5,8),(30,13),(29.5,21),(28,23),(24,23),(22.4,21),(22,8)]
    s.area(ship,"drevo",r=90,o=0)
    s.enclosure(ship,{7:(.45,.70,"door")},typ="half")
    s.obj("p3-lodni-paluba",26,13.1,9,25,z=-4,anim=False)
    s.obj("stożar",26,9,2.1,blocks=True,cover=3)
    s.obj("stożar",26,18,1.7,blocks=True,cover=3)
    s.obj("kotva",24,4,.9,1.3,-22)
    s.obj("clun",32.5,20,2.3,5,-12,cover=2)
    s.obj("clun",17.8,3.5,1.8,3.6,21,cover=2)
    s.obj("p3-padaci-dvere",26,13.3,1.5)
    for x,y in [(13,7),(13,19),(18,14),(20,24),(23,21),(29,7),(4,13)]:
        s.obj("p3-lana",x,y,.9,rot=s.rng.uniform(0,360))
    for x,y in [(3.5,4.5),(8,5),(4,9.5),(10.5,19),(4.5,22),(20,15),(27.5,21),(27.8,6.5)]:
        s.cluster(["bedna","sud","pydel","truhla-lod"],x,y,7,1.5,1.3,(.65,1.15),cover=2,difficult=True)
    for x,y in [(11.5,13.5),(15,6.5),(16,22),(21,23.5),(23,8),(29,22),(7,11.5)]:
        s.obj("latarnik",x,y,.6)
        s.light(x,y,"#ffd58d",6,16,.7)
    s.paint("teren-rubble",[(1,16),(6,18),(10,22)],1.4,.45,.2,18)
    s.paint("hlina",[(1,25),(5,21),(8,17),(10,13)],1.6,.5,.3,34)
    s.cluster(["smiti","kamen","vrv-kotel"],6,16,18,5,10,(.3,.75))
    s.cluster(["gen2-sudy","bedna","kotva"],6,8,12,4,3,(.45,.8),cover=2)
    s.light(30,14,"#92b9e9",10,25,.35,False)
    s.note(26,13,"Karavela: dubový poklop vede do podpalubí. Můstky spojují otevřenou palubu s nákladním molem.")
    s.note(7,7,"Sklad Zlaté kotvy: celní pečeti na jedné bedně jsou padělané. Stávající městská krčma je místní inspirací.")
    s.note(15,14,"Mola: volný koridor uprostřed. Voda je těžký terén; pád do moře řeší PJ.")
    s.starts([(2,24),(3,24),(4,24),(2,25),(3,25),(4,25)],[(25,11),(27,16),(18,15),(8,8)])
    return s.finish()


def volcano():
    s=Scene("epic-draar-popelava-svatyne","Dräar – Svatyně Popelavého draka","jeskyne",
            "01_Svet/Mista/Trosky_Draaru.md",
            "Návrh svatyně pod troskami dávné říše: lávová řeka obtéká obřadní ostrov, "
            "šikmý čedičový most vede k runovému oltáři. Pokladnice, zlomené pilíře a dračí ostatky v černém popelu.",
            305,"popel",.52,"#291b22")
    s.rect(0,0,36,28,"jeskyne")
    lava=[(17,0),(23,0),(24,5),(21,9),(23,15),(20,20),(22,28),(16,28),(15,22),(17,16),(15,11),(18,6)]
    s.area(lava,"lava",tile="l")
    s.area([(17,16),(25,17),(29,23),(24,27),(17,25),(14,21)],"lava",tile="l")
    island=[(20,9),(25,4),(31,5),(34,11),(32,19),(27,22),(23,18)]
    s.area(island,"teren-skala")
    bridge=[(11,16),(12,13),(25,11),(25.5,13.5)]
    s.area(bridge,"dlazba")
    s.wall((11,16),(25.5,13.5),"half")
    s.area([(2,17),(8,13),(13,15),(13,23),(7,26),(2,24)],"teren-ruiny")
    s.enclosure([(24,6),(30,6),(33,11),(31,17),(26,19),(23,15)],{4:(.2,.65,"door"),5:(.12,.46,"door")},typ="half")
    s.obj("magicky-oltar",28,11,3.3,2.3,22,blocks=True,cover=3)
    s.obj("mag-kruh",28,11,6,6,22,z=-3,anim=False)
    s.obj("gen2-portal2",29,7.5,3.2,3.2,-17)
    s.obj("p3-poklad",7.5,19,3.2,2.6,13,cover=2,difficult=True)
    s.obj("p3-draci-kostra",8,8,7,5,-24,cover=2,difficult=True)
    s.obj("kostlivec",10,8,1.7,2,32)
    for x,y,r in [(24,9,20),(31,15,20),(24,17,45),(6,15,-12),(12,21,-42)]:
        s.obj("sloup-velky",x,y,1.4,blocks=True,cover=3)
        s.obj("prulom",x+1,y+.7,1.5,1,r,difficult=True)
    for x,y in [(18.5,4),(20,9),(19,17),(18.5,24),(29,22),(25,25)]:
        s.light(x,y,"#ff5b24",6,18,.7)
    s.light(28,11,"#ffa13f",8,18,.7)
    s.light(29,7.5,"#bd77fa",7,12,.5,False)
    for x,y,rx,ry in [(4,4,3,3),(31,3,4,2),(33,23,2,4),(4,26,3,1),(13,4,2,3),(3,11,2,3)]:
        s.cluster(["gen2-balvan","p3-obsidian","gen2-balvan2"],x,y,8,rx,ry,(1,2.2),cover=3)
    for x,y in [(8,8),(11,22),(24,16),(31,11),(26,6),(6,20)]:
        s.cluster(["gen2-kosti","gen2-krystal","kamen","trhlina"],x,y,8,2.2,2,(.4,1.1))
    s.paint("teren-rubble",[(1,23),(7,21),(11,18),(15,14)],2,.7,.25,29)
    s.paint("hlina",[(4,9),(8,10),(13,8)],2.4,.35,.2,-16)
    s.obj("gen2-krev",26,12,1.4,1.9,30,z=-1,anim=False)
    s.note(18,17,"Láva: neprůchodné pole l s ohnivým nebezpečím. Kamenný most zůstává průchozí a bez nákladu.")
    s.note(8,8,"Dračí ostatky: pradávný strážce svatyně, herní návrh pro PJ; nikoli nový kanonický drak Montelienu.")
    s.note(7.5,19,"Pokladnice: poloviční kryt. Zápletka i označení svatyně jsou herní návrh.")
    s.starts([(3,20),(4,20),(3,21),(4,21),(3,22),(4,22)],[(26,13),(28,16),(30,10)])
    return s.finish()


def winter():
    s=Scene("epic-fornheim-polarni-tabor","Fornheim – Hlídka na zrcadlovém jezeře","snih",
            "01_Svet/Mista/Fornheim.md",
            "Polární tábor pod ledovými věžemi Fornheimu. Sněžná cesta míjí zamrzlé jezero, "
            "výprava rozbila stany v závětří skal. Uprostřed ledu praská runový kruh; táborák je jediný teplý bod.",
            306,"snih",.72,"#22374b")
    s.rect(0,0,36,28,"snih")
    lake=[(17,4),(25,2),(32,6),(34,14),(29,23),(21,26),(14,22),(13,15)]
    s.area(lake,"led",tile="i",r=14)
    s.paint("snih",[(14,23),(13,17),(16,9),(19,5)],1.7,.6,.2,32)
    s.paint("hlina",[(0,21),(6,19),(10,16),(12,11),(17,9)],2,.65,.2,-23)
    s.area([(25,10),(27,9),(28,13),(25,15),(24,13)],"teren-propast",tile="_")
    s.obj("mag-kruh",25.5,12.2,4.5,4.5,-21,z=-2,anim=False)
    s.obj("rune-kamen",26,8.2,1.6,2,23,cover=2)
    for x,y,w,h,r in [(6,7,4.2,3.8,-16),(5,14,3.5,3.2,12),(10,5,3.2,3.2,28),(11,20,3.5,3,18)]:
        s.obj("gen2-stan",x,y,w,h,r,cover=2,difficult=True)
        s.obj("zbroj-stojan",x+2,y+1,1,.8,r)
        s.obj("gen2-truhla",x-1,y+2,.9,.65,-r,cover=2)
    s.obj("ohne-tabor",9.5,12,2,2,light={"bright":10,"dim":15})
    s.obj("gen2-kmen",7.6,11,2,.65,60,cover=2)
    s.obj("gen2-kmen",10,14,2.3,.7,-10,cover=2)
    s.light(9.5,12,"#ffb063",12,20,.8)
    s.light(26,11,"#83cfe8",8,17,.6,False)
    s.light(21,22,"#9e99ff",7,12,.4,False)
    for x,y,n,rx,ry in [(3,3,9,3,2),(3,24,12,3,3),(32,25,12,4,2),(32,3,8,3,2),(21,2,7,3,1)]:
        s.cluster(["gen2-strom2","smrk"],x,y,n,rx,ry,(1.8,3),cover=3)
    for x,y in [(14,3),(33,13),(3,19),(12,25),(34,21)]:
        s.cluster(["balvan","gen2-balvan2","gen2-kmen"],x,y,5,1.2,2,(.6,1.4),cover=2)
    for x,y in [(4,9),(7,18),(11,7),(12,18)]:
        s.cluster(["bedna","pydel","vrv-kotel"],x,y,6,1.2,1.3,(.4,.75),cover=2)
    s.wall((2,17),(6,18),"half");s.wall((6,18),(9,17.5),"door")
    s.wall((3,4),(7,2),"half");s.wall((7,2),(12,2.5),"half")
    s.obj("gen2-krev",23,16,.8,1.2,-24,z=-1,anim=False)
    s.paint("teren-rubble",[(12,25),(14,23),(16,22)],1,.25,.3,22)
    s.note(26,12,"Trhlina: neprůchodná propast. Okolní led je těžký terén; bezpečná cesta obchází západní břeh.")
    s.note(9.5,12,"Hlídka: zásoby vydrží tři noci. Oheň je vidět z protějšího břehu.")
    s.note(23,16,"Krvavé stopy končí na ledu. Pátrání DC 13 odhalí, že se majitel vracel do tábora.")
    s.starts([(1,20),(2,20),(3,20),(1,21),(2,21),(3,21)],[(22,17),(27,19),(30,14)])
    return s.finish()


def generate():
    return [inn(), crypt(), ruins(), harbor(), volcano(), winter()]


def update_store(path, maps):
    doc = json.loads(path.read_text(encoding="utf-8"))
    by_id = {m["id"]: m for m in maps}
    doc["mapy"] = [by_id.pop(m["id"], m) for m in doc.get("mapy", [])]
    doc["mapy"].extend(by_id.values())
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8", newline="")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--zapsat", action="store_true")
    args = p.parse_args()
    maps = generate()
    if args.zapsat:
        update_store(STORE, maps)
    for m in maps:
        print(f"{m['id']}: 36×28, {len(m['objekty'])} objektů, {len(m['steny'])} zdí, "
              f"{len(m['malba'])} maleb, {len(m['svetla'])} světel")


if __name__ == "__main__":
    main()
