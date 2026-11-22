#!/usr/bin/env python3
"""Dvě editovatelné scény podle přístavní a zahradní obrazové předlohy.

--zapsat aktualizuje pouze vlastní ID v pracovním souboru map.
--stage-store vloží do indexu pouze HEAD + tyto dvě mapy, nikoli cizí úpravy.
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import subprocess

from mapa_epicke import ROOT, STORE, Scene, update_store


def scene(slug, name, ground, seed, ambient, tint):
    s = Scene(slug, name, ground, "03_Mesta/Mesto_Menkant.md",
              "Rekonstrukce obrazové předlohy z editovatelných vrstev knihovny.",
              seed, "mlha", ambient, tint)
    s.w, s.h = 42, 28
    s.grid = [["."] * s.w for _ in range(s.h)]
    s.m["pocasi"]["sila"] = .06
    s.m["trasy"] = []
    s.m["mrizkaStyl"]["opacita"] = .06
    s.m["atmosfera"]["vineta"] = .5
    return s


def route(s, kind, pts, width, texture=None, **options):
    r = dict(id=f"trasa{len(s.m['trasy'])}", druh=kind, pts=[list(p) for p in pts],
             sirka=width, hladke=False, seed=741 + len(s.m["trasy"]))
    if texture:
        r["t"] = texture
    r.update(options)
    s.m["trasy"].append(r)


def mist(s, points, size):
    for x,y in points:
        s.obj("ov-mlha-chuchvalec",x,y,size,size*.55,s.rng.uniform(-35,35),
              opacity=s.rng.uniform(.19,.28),z=12,anim="voda",stin=False)


def undergrowth(s, points, count=14, radius=1.5):
    for x,y in points:
        s.cluster(["gen2-ker2","gen2-ker","z-kvetinovy-zahon","z-brectan-previs","koreny"],
                  x,y,count,radius,radius*.65,(.45,1.1),z=-1,stin=False)
        s.cluster(["d-mech","d-mech","d-listi"],x,y,4,radius,radius*.7,(.6,1.2),opacity=.4)


def masonry(s, pts):
    for a,b in zip(pts,pts[1:]):
        length=math.dist(a,b)
        count=math.ceil(length/2.6)
        for i in range(count):
            t=(i+.5)/count
            s.obj("m-kamenna-zidka",a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,
                  length/count+.4,1.5,math.degrees(math.atan2(b[1]-a[1],b[0]-a[0])),
                  stin=False)


def harbor():
    s = scene("reference-pristav-tri-mola", "Tři mola – Noční přístav", "pristav", 811, .43, "#010102")
    s.rect(0, 0, 42, 28, "hluboka-voda", tile="~")
    s.rect(0, 0, 42, 14, "t-ulice-dlazba")
    for x in (0, 28):
        s.rect(x+.3, .2, 13.1, 6.8, "drevo", r=0)
        s.interior([(x+.3, 0), (x+13.4, 0), (x+13.4, 7), (x+.3, 7)])
        gate = 7.8 if x == 0 else 5
        left=[(x+.25, 0), (x+.25, 7), (x+gate-1, 7)]
        right=[(x+gate+1, 7), (x+13.5, 7), (x+13.5, 0)]
        route(s, "zidka", left, 1.65, "t-pristavni-kamen", brectan=True)
        route(s, "zidka", right, 1.65, "t-pristavni-kamen", brectan=True)
        masonry(s,left)
        masonry(s,right)
        s.enclosure([(x+.25,0),(x+13.5,0),(x+13.5,7),(x+.25,7)],
                    gaps={2:[((13.5-gate-1)/13.25,(13.5-gate+1)/13.25,"door")]})
        s.paint("t-pristavni-kamen",[(x+gate,6.5),(x+gate,9.5)],b=1.9,o=.5,h=.2)
        s.light(x+7,3.5,"#e7a76f",8,24,.38,False)
        s.m["svetla"][-1]["nazev"]="Tlumené světlo skladu"
    route(s, "zidka", [(0, 14), (42, 14)], .65, "t-pristavni-kamen")
    for x in (6.3, 20.5, 34.7):
        route(s, "molo", [(x, 13.7), (x, 26.3)], 3.8)
        for y in (14.4, 24.5):
            s.obj("p-site",x+.6,y,1.6,1.4,18,stin=False)
        s.obj("sud",x+.7,20.9,.85,.85,12,cover=2)
        for side in (-1,1):
            s.obj("m-lucerna-sloup",x+side*2,14,.65,.65,light={"bright":3,"dim":7})
            s.light(x+side*2,14,"#ff9f45",3,9,1)
    for x,y in [(7.8,7.8),(33,7.8),(8,25.4)]:
        s.obj("m-lucerna-sloup",x,y,.65,.65,light={"bright":3,"dim":7})
        s.light(x,y,"#ff9f45",3,9,1)
    s.obj("pristav-vor-plachta",26.5,20.6,7.5,7.5,-7,cover=2,vyska=1.2)["v"]=0
    for x,y,w in [(4,1.5,1.5),(5.5,2.2,1.4),(10.5,4.8,1.5),(11.3,6,1.2),
                  (36.4,1.8,1.5),(38.1,2,1.5),(39,3.5,1.4),(30,5.8,1.3),
                  (7.6,10.2,1.2),(6.4,12,1.2),(17.3,11.4,1.3),(20.4,10.3,1.5),
                  (23.4,10.8,1.2),(25.7,8.8,1.4),(32.2,11.7,1.3)]:
        s.obj("gen2-bedny",x,y,w*1.25,w*1.25,s.rng.choice([0,0,6,-8]),cover=2)
    for x,y in [(12,1),(12,4.2),(23.5,7.2),(22,12.7),(29,12.3),(39,10.8),(38.5,3.8)]:
        s.obj("sud",x,y,1.2,1.2,s.rng.uniform(0,90),cover=2)
        s.obj("p-lana-svitek",x+.65,y+.4,.9,.9,-20,stin=False)
    s.obj("m-sit",30.7,3.6,5.2,3.4,23,stin=False)
    s.obj("m-sit",28,10.5,4,3,-28,stin=False)
    for x,y in [(1,1),(40,1),(1,9),(40,8),(15.1,2),(26.6,1)]:
        s.cluster(["gen2-ker","z-ruze-ker"],x,y,4,1,1,(.6,1.1),z=-2,stin=False)
    for x,y in [(1,1),(41,1)]:
        s.obj("z-strom-koruna",x,y,6,5,30,cover=3)
    for x,y in [(1.5,7.6),(11,7.6),(14,2),(27,2),(29,7.6),(40,7.6),(1,12.4),(40.5,12.7)]:
        s.cluster(["gen2-ker","z-ruze-ker"],x,y,4,1.4,.7,(.8,1.35),z=-2,stin=False)
    for x,y in [(3,1.5),(9.7,5.8),(11.8,5.8),(36.5,1.5),(38,1.5),(40,1.5),(36.8,3)]:
        s.obj("gen2-bedny",x,y,1.8,1.8,0,cover=2)
    for x in (6.3,20.5,34.7):
        for y in (17,22.5,26):
            s.obj("p-lodni-kolik",x-2,y,.65,.65,0)
            s.obj("p-lana-svitek",x+1.55,y-.2,.9,.9,20,stin=False)
    for x,y in [(4.6,18.4),(21.7,23.7),(33.6,18),(8.2,4.8),(38.5,6.1)]:
        s.obj("p-sud-ryby",x,y,1.3,1.2,10,cover=2)
    for x,y in [(1,9.7),(13,10.2),(26,4.2),(37,12.6)]:
        s.paint("teren-les",[(x,y),(x+2,y+.3)],b=1.7,o=.32,h=0)
    undergrowth(s,[(1,8),(13,7.8),(15,2),(27,3),(29,8),(40,8),(1,12),(40,12)],10)
    for x,y in [(3,10),(11,10),(17,12),(25,9),(36,12)]:
        s.obj("d-prasklina",x,y,1.7,1.5,s.rng.uniform(0,360),opacity=.6)
    for x,y in [(2,19),(28,20),(20,4)]:
        s.light(x,y,"#cbd3e0",16,65,.35,False)
        s.m["svetla"][-1]["stiny"]=False
    for x,y,w,h in [(2.5,20.7,5,12),(13.5,21,4,11),(29.5,23,3,8),(39,21,4,12)]:
        s.obj("ov-mesic-odlesk",x,y,w,h,0,z=8,opacity=.55,anim="voda",stin=False)
    s.obj("ov-paprsky",5,18.8,12,10,8,z=9,opacity=.10,anim=False,stin=False)
    mist(s,[(1,18),(12,26),(29,27),(41,20)],11)
    s.starts([(14,9),(17,9),(20,9),(23,9),(14,12),(20,12)],
             [(5,17),(8,17),(19,17),(22,17),(33,17),(36,17)])
    s.note(20,10,"Náklad na nábřeží poskytuje kryt; všechna tři mola jsou průchozí nad vodou.")
    s.note(26,21,"Vor s plátěnou plachtou u prostředního mola; v knihovně jsou další dvě varianty nákladu a plachty.")
    return s.finish()


def garden():
    s = scene("reference-zahrada-mesic", "Zahrada osmi králů – Měsíční ticho", "les", 812, .26, "#010102")
    s.rect(0,0,42,28,"t-zahrada-trava-stin")
    for texture,opacity in [("t-zahrada-trava-stin",.4),("t-zahrada-hlina-koreny",.4),("t-zahrada-mech-listi",.35)]:
        for _ in range(12):
            x,y=s.rng.uniform(1,40),s.rng.uniform(1,27)
            points=[(x+math.cos(i*math.tau/7)*s.rng.uniform(1,3.5),
                     y+math.sin(i*math.tau/7)*s.rng.uniform(1,3.5)) for i in range(7)]
            s.paint(texture,points,b=5,o=opacity,h=0,poly=True,r=s.rng.uniform(0,360))
    for y in (4,24):
        for x in (5,12,29,37):
            s.paint("t-zahrada-mech-listi",[(x,y)],b=2.8,o=.3,h=0)
    route(s,"cesta",[(0,14),(42,14)],2.1,"t-zahradni-cesta")
    for pts in [[(3,1),(5,6),(10,10),(10,12)],[(17,1),(15,6),(15,10)],
                [(39,1),(37,7),(32,10),(32,12)],[(26,1),(28,6),(28,10)],
                [(3,27),(5,22),(10,18),(10,16)],[(17,28),(15,23),(15,20)],
                [(39,28),(37,22),(32,18),(32,16)],[(26,28),(28,23),(28,20)]]:
        route(s,"cesta",pts,.7,"t-hlina-pesina",hladke=True)
    for y in (3.5,25):
        for pts in [[(1,y+.5),(8,y),(16,y+.3),(19.4,y)],
                    [(22.6,y),(28,y+.3),(36,y),(41,y+.5)]]:
            route(s,"plot",pts,1.6,hladke=True)
    s.rect(14.8,11.2,12.2,5.8,"hluboka-voda",tile="~")
    s.obj("z-jezirko-fontana",20.9,14.1,13,13*251/512,0,z=-3,stin=False)["v"]=1
    for y in (8,20.1):
        for x in (11.3,16,26.2,31):
            s.obj("z-socha-kral",x,y,2.3,3.6,s.rng.uniform(-3,3),cover=3)
            s.obj("z-brectan-previs",x-.4,y+1.1,1.5,1,-15,z=-1,stin=False)
    s.obj("z-rotunda-ruina",36.5,14.1,8.1,8.1,-15,cover=2,difficult=True)
    for x,y,r in [(8.2,10.8,25),(27.6,9.8,25),(14.1,4.3,0),(27.5,4.2,0),(31.5,23,0)]:
        s.obj("z-lavicka-kamen",x,y,1.7,.8,r,cover=2)
    for x,y in [(4,1),(40,2),(1,20),(40,26),(4,26)]:
        s.obj("z-strom-koruna",x,y,5.2,5.2,s.rng.uniform(0,360),cover=3)
    for x,y in [(1,6),(41,8),(1,25),(14,27),(24,27),(41,20),(30,1)]:
        s.obj("z-strom-koruna",x,y,3.7,4,s.rng.uniform(0,360),cover=3)
    for x,y in [(8,5),(17,5),(25,5),(34,5),(8,23),(17,23),(25,23),(34,23),(3,17),(38,20)]:
        s.cluster(["gen2-ker2","z-brectan-previs","z-ruze-ker","kvety"],x,y,15,2.2,1.5,(.3,.8),stin=False,z=-2)
    for x,y in [(5,3.8),(12,3.8),(29,3.8),(37,3.8),(5,24.5),(12,24.5),(29,24.5),(37,24.5),
                (10,8.8),(17,8.8),(26,8.8),(31,8.8),(10,21.4),(17,21.4),(26,21.4),(31,21.4)]:
        s.cluster(["gen2-ker","z-brectan-previs"],x,y,3,1.1,.7,(.8,1.4),z=-1,stin=False)
    for x,y in [(8,16.8),(17,3.2),(28,3.1),(31,17.8),(5,22)]:
        s.obj("z-urna-kamen",x,y,.8,.8,0,cover=2)
    s.obj("z-sloup-zlomeny",32.8,17.8,1.8,1.2,24,cover=2)
    for x,y in [(10,3.4),(32,3.5),(10,25),(32,25),(2.5,10),(3,18),(39.5,9),(39,22),
                (13.3,10.7),(29.1,10.7),(13.2,17.6),(28.5,17.9),(20.8,9.8),(21.1,18.5)]:
        s.cluster(["gen2-ker","z-brectan-previs","kvety","z-ruze-ker"],x,y,10,2.1,.9,(.3,.8),stin=False,z=-2)
    for x,y in [(8,9),(17,9),(26,9),(31,9),(8,21),(17,21),(26,21),(31,21)]:
        s.obj("z-brectan-previs",x,y,1.7,1.2,s.rng.uniform(-30,30),z=-1,stin=False)
    for x,y in [(2,8),(4,19),(9,25),(17,19),(24,8),(30,23),(38,7),(33,18)]:
        s.obj("ov-svetlusky",x,y,2,2,0,z=2,anim=False,stin=False)
    s.obj("ov-mesic-odlesk",18.1,14.1,2.2,3.9,0,z=-1,opacity=.75,anim="voda",stin=False)
    undergrowth(s,[(x,y) for y in (3.6,8.8,21.2,24.8) for x in (5,10,16,26,31,37)],18,1.8)
    for y,left,right in [(4.6,2,40),(23.8,2,40),(9.6,8,33),(21.5,8,33)]:
        s.paint("t-zahrada-mech-listi",[(x,y+.5*math.sin(x*.45)) for x in range(left,right+1,2)],b=2.8,o=.35,h=0)
        for i in range(round((right-left)/.75)+1):
            x=left+i*.75
            py=y+.5*math.sin(x*.45)
            s.obj("d-mech",x,py+s.rng.uniform(-.4,.4),s.rng.uniform(1.6,2.4),s.rng.uniform(.8,1.4),s.rng.uniform(0,360),opacity=.65,z=-2,stin=False)
            s.cluster(["gen2-kapradi","z-brectan-previs","gen2-ker2"],x,py,3,.5,.5,(.7,1.15),opacity=.85,z=-2,stin=False)
    for x in range(1,42):
        for y in (12.7,15.3):
            if 14<x<28:
                continue
            s.obj("d-mech",x+s.rng.uniform(-.3,.3),y+s.rng.uniform(-.3,.3),s.rng.uniform(1,2),s.rng.uniform(.6,1.2),s.rng.uniform(0,360),opacity=.8)
            s.cluster(["d-listi","d-prasklina"],x,y,1,.8,.4,(.5,1),opacity=.5)
            s.obj("kvety",x+s.rng.uniform(-.4,.4),y,.5,.5,s.rng.uniform(0,360),z=-1,stin=False)
            s.cluster(["gen2-ker2","z-brectan-previs"],x,y,3,.7,.35,(.25,.6),z=-1,stin=False)
    for x,y in [(11.3,8),(16,8),(26.2,8),(31,8),(11.3,20.1),(16,20.1),(26.2,20.1),(31,20.1)]:
        s.obj("d-mech",x,y+1.1,2.2,1.5,s.rng.uniform(0,360),opacity=.8)
    for x,y,w in [(0,5,11),(1,11,12),(0,18,11),(2,24,12),(7,27,13),(16,28,13),(26,27,12),(36,28,11)]:
        s.obj("ov-mlha-chuchvalec",x,y,w,w*.6,s.rng.uniform(-25,25),
              opacity=s.rng.uniform(.5,.65),z=12,anim="voda",stin=False)
    s.obj("ov-paprsky",6,3.5,11,9,0,z=9,opacity=.12,anim=False,stin=False)
    s.light(6,2,"#b9cde8",28,95,.65,False)
    for x,y in [(13.7,8),(28.6,8),(13.7,20),(28.6,20)]:
        s.light(x,y,"#d4d6dc",12,42,.32,False)
    s.light(19,14,"#bfcddb",7,22,.2,False)
    s.light(21,14,"#d6dfee",6,13,.6,False)
    s.light(21,26,"#c6d1df",10,35,.12,False)
    for light in s.m["svetla"]:
        light.update(stiny=False, nazev="Rozptýlené měsíční světlo")
    s.starts([(1,10),(4,10),(7,10),(1,13),(4,13),(7,13)],
             [(31,6),(34,6),(37,6),(40,6),(31,9),(34,9)])
    s.note(21,14,"Zapuštěná nádrž není průchozí. Cesta ji obchází na severu a jihu.")
    s.note(36,14,"Zřícená rotunda poskytuje poloviční kryt a těžký terén.")
    objects=[]
    for o in s.m["objekty"]:
        if o["asset"]=="d-listi":
            near_base=any(math.dist((o["x"],o["y"]),(x,y))<2.2 for y in (8,20.1) for x in (11.3,16,26.2,31))
            near_hedge=min(abs(o["y"]-3.5),abs(o["y"]-25))<1.4
            if not (near_base or near_hedge) or s.rng.random()>.45:
                continue
            o.update(w=o["w"]*.65,h=o["h"]*.65,opacity=.28)
        objects.append(o)
    s.m["objekty"]=objects
    return s.finish()


def generate():
    return [harbor(),garden()]


def isolated_store(committed, maps):
    result = copy.deepcopy(committed)
    ids = {m["id"] for m in maps}
    result["mapy"] = [m for m in result.get("mapy",[]) if m["id"] not in ids] + maps
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zapsat",action="store_true")
    parser.add_argument("--stage-store",action="store_true")
    args = parser.parse_args()
    maps = generate()
    if args.zapsat:
        update_store(STORE,maps)
    if args.stage_store:
        path = str(STORE.relative_to(ROOT))
        committed = json.loads(subprocess.check_output(["git","show",f"HEAD:{path}"],cwd=ROOT))
        payload = json.dumps(isolated_store(committed,maps),ensure_ascii=False,indent=1).encode()
        blob = subprocess.check_output(["git","hash-object","-w","--stdin"],input=payload,cwd=ROOT).decode().strip()
        subprocess.run(["git","update-index","--cacheinfo",f"100644,{blob},{path}"],cwd=ROOT,check=True)
    for m in maps:
        print(m["id"],len(m["objekty"]),"objects",len(m["trasy"]),"routes")


if __name__ == "__main__":
    main()
