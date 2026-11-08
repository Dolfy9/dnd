#!/usr/bin/env python3
"""Třetí várka 15 bojových map (organický terén → předloha → mřížka), místa z kánonu Montelienu.
Názvy, popisy a střetnutí jsou návrh.

  python3 tools/boj_nove15.py            # předlohy do ~/predlohy/org + výpis mřížek
  python3 tools/boj_nove15.py --zapsat   # přidá chybějící mapy do 11_Mapy/bojove_mapy.json (existující nechá)
"""
import json, math, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
from boj_organicke import M, fbm, X, Y, CL, W, H, PRED, OUT
from boj_mapy import spots


def haj():
    m = M("g", 101)
    m.put(fbm(102, 2.5) > .3, "^")
    d = m.blob(12, 10, 4.2, 3.2, ",", .35, 2.2); m.put(d < .5, "~")
    m.seg([(15.8, 10.6), (19, 12.5), (23, 12), (26.5, 14.2), (30, 14)], 1.1, ",", .35)
    for i in range(9):
        a = i / 9 * 2 * math.pi
        m.blob(12 + 6.6 * math.cos(a), 10 + 5.2 * math.sin(a), .55, .45, "o", .15, ang=a)
    for (x, y, r) in ((4, 4, 2.2), (22, 4.5, 2.4), (5, 16, 2.0), (21, 16.5, 1.9), (27, 7.5, 1.8)):
        m.blob(x, y, r, r * .9, "T", .25, 1.5)
    m.scatter("T", 18, .6, 1.1, "g^", avoid=(lambda x, y: ((x - 12) / 8) ** 2 + ((y - 10) / 6.5) ** 2 < 1,))
    return m, (0, 7, 3, 13), (24, 2, 29, 18), "an ancient elven sacred grove at dusk around a crystal-clear spring pool fed by a small brook, a ring of nine tall moss-covered standing stones with faint silver runes, colossal ancient trees with enormous twisting roots and silver bark, ferns, wild blue flowers, glowing mushrooms, fireflies and drifting pollen, soft golden-violet twilight light rays."


def amir():
    m = M("~", 111)
    d = m.blob(9, 11, 6.5, 5.2, ",", .45, 2.3); m.put(d < .78, "g"); m.put((d < .7) & (fbm(112, 1.4) > .05), "^")
    t = m.blob(21.5, 6.5, 3.0, 2.6, "#", .15, 2)
    m.blob(21.5, 6.5, 2.1, 1.7, ".", .15, 2); m.blob(23.2, 7.6, .9, .8, ",", .1)
    m.seg([(14.5, 11.5), (19, 10.2), (20.5, 8.6)], .9, "=")
    m.blob(17.2, 13.6, 1.2, .5, "%", .05, ang=.5)
    m.scatter("o", 7, .4, .9, "~,", box=(14, 0, 30, 20))
    m.scatter("T", 7, .6, 1.1, "g^", box=(3, 6, 15, 16))
    return m, (3, 8, 10, 14), (19, 4, 24, 9), "a vast misty lake at dawn: dark deep water with gentle ripples and reflections, a small island of reeds, sedge and willows with a muddy shore, the broken top of a drowned ancient stone tower rising from the water with a ruined round floor inside and a gap in its wall, a crooked old wooden fishing pier linking island and tower, a moored rowing boat, rocks breaking the surface, lily pads, pale golden mist over the water."


def vodopad():
    m = M("g", 121)
    m.put(fbm(122, 2.4) > .2, ".")
    cliff = 6.5 + 1.2 * np.sin(X / 3) + .8 * fbm(123, 2)
    m.put(np.abs(Y - cliff) < 1.1, "#")
    rx = 14 + 1.5 * np.sin(Y / 3)
    m.put((np.abs(X - rx) < 1.6) & (Y < cliff), ",")
    m.put((np.abs(X - rx) < 1.3) & (np.abs(Y - cliff) < 1.3), "x")
    d = m.blob(14.5, 10.5, 3.6, 2.4, ",", .35, 2); m.put(d < .55, "~")
    m.seg([(15, 12.5), (15.6, 16), (13.8, 20)], 1.6, ",", .3)
    for (x, y, a) in ((6, 12, .3), (23, 13, -.4), (8, 17, .1)):
        m.rect(x, y, 4.2, .6, a, "#"); m.blob(x + 1.6, y + .8, .7, .6, "^", .2)
    for (x, y) in ((20, 10.5), (21.5, 16), (5, 9.5), (10, 15.5), (25, 17)):
        m.blob(x, y, .5, .5, "o", .1)
    m.seg([(24, 6.5), (25.5, 9)], 1.2, "S")
    m.scatter("T", 14, .6, 1.2, "g.", avoid=(lambda x, y: abs(x - 14.5) < 5,))
    return m, (2, 13, 9, 19), (17, 0, 28, 5), "the overgrown ruins of an ancient city at a waterfall: a jagged natural rock ledge crosses the map, a river falls over it in a roaring white waterfall into a deep emerald plunge pool with spray and rainbows, the stream continues south; broken marble arches and collapsed colonnades lie in the grass, rubble piles, ivy, moss, a few old trees, carved stairs climbing the ledge in the east, fine mist and soft hazy light."


def draar():
    m = M(".", 131)
    m.put(np.sin(X * .7 - Y * .4 + 3 * fbm(132, 3)) > .55, "^")
    sea = 16 + 1.5 * np.sin(X / 3.5) + 1 * fbm(133, 2)
    m.put(Y > sea - 1.2, ","); m.put(Y > sea, "~")
    cl = 3.5 + 1.5 * np.sin(Y / 2.5) + 1.3 * fbm(134, 2)
    m.put((X < cl) | (X > 30 - cl * .8), "#")
    m.blob(16, 8, 2.2, 1.7, "_", .35, 1.5)
    for (x, y, a) in ((10, 5, .6), (21, 11, -.3), (11, 12, 1.1)):
        m.rect(x, y, 2.6, .9, a, "o")
    for i in range(6):
        a = i / 6 * 2 * math.pi
        m.blob(16 + 4.4 * math.cos(a), 8 + 3.6 * math.sin(a), .45, .45, "o", .1)
    m.blob(16, 8, 3, 2.4, "x", .2, 1.5); m.blob(16, 8, 2.2, 1.7, "_", .35, 1.5)
    m.scatter("o", 10, .3, .7, ".^", box=(4, 1, 26, 15))
    return m, (5, 13, 13, 15), (18, 1, 24, 6), "a cursed island of black sand and ruins at a blood-red dusk: rippled black and ochre sand dunes, jagged black basalt cliffs on both sides, a dark sea with foam on the south shore, half-buried colossal statues and fallen columns of a lost empire, a ring of broken obelisks around a gaping sinkhole leading into darkness with faint red glow and ash around its rim, eerie, haunting and beautiful."


def hinai():
    m = M("T", 141)
    d = ((X - 15) / 9) ** 2 + ((Y - 10) / 6) ** 2 + .5 * fbm(142, 2)
    m.put(d < 1, "g"); m.put((d < 1.2) & (d >= 1), "^")
    m.seg([(0, 3), (6, 5.5), (11, 4.5), (16, 6), (22, 3.5), (30, 5)], 1.2, ",", .4)
    m.seg([(15, 20), (15.5, 15), (14, 12)], 1.4, "r", .3)
    m.blob(16, 9.5, 1.3, .9, "x", .1); m.blob(16, 9.5, 2.2, 1.6, ".", .2); m.blob(16, 9.5, 1.1, .8, "%", .05)
    m.scatter("o", 6, .3, .6, "g", box=(8, 6, 22, 15))
    m.put((fbm(143, 1.2) > .35) & (m.L == CL.index("T")), "^")
    return m, (12, 16, 18, 19), (6, 6, 24, 14), "a small eerie clearing deep inside a dense dark jungle: walls of giant buttress-rooted trees, hanging lianas, ferns and huge leaves, a slow brown creek crossing the north, a narrow trampled path entering from the south, in the centre a flat sacrificial stone with old dark stains surrounded by bare earth, bones and offerings, a few rocks, thick humid haze, thin green light filtering down, unsettling silence."


def ertin():
    m = M("g", 151)
    m.put(fbm(152, 2.2) > .25, "^")
    d = m.blob(19, 9, 6, 4.5, "#", .5, 2.5)
    m.put((d < 1.0) & (d > .75) & (fbm(153, 1) > 0), "^")
    m.blob(19, 9, 2.0, 1.4, ".", .2); m.blob(14.2, 8, 1.4, 1.0, ".", .2)
    for k in range(3):
        r = 4 + k * 2.4
        for i in range(10 + k * 4):
            a = i / (10 + k * 4) * 2 * math.pi + k
            x, y = 19 + r * 1.35 * math.cos(a), 9 + r * math.sin(a)
            if 0 < x < 30 and 0 < y < 20:
                m.blob(x, y, .55, .5, "T", .2)
    m.seg([(0, 15), (6, 14), (11, 11), (14.2, 8)], 1.3, "r", .3)
    m.scatter("o", 9, .3, .6, "g^", box=(0, 0, 30, 20))
    return m, (0, 12, 5, 18), (17, 7, 21, 11), "the foot of a mountain made of a dead god's body in an ancient silent forest: a huge mound of grey stones shaped like broken giant bones, overgrown with thick emerald moss and tree roots, a hollow in its heart with a glowing runic stone, trees growing in strange spiral rings around the mound as if turning away, ferns, mushrooms, a faint old path, deep green twilight with a few shafts of pale light."


def fornheim():
    m = M(".", 161)
    m.put(fbm(162, 2.5) > .2, "^")
    for pts in (((0, 6), (5, 7.5), (9, 6.5), (13, 8.5)), ((17, 14), (22, 12), (26, 13.5), (30, 12))):
        m.seg(pts, 1.1, "_", .35)
    m.seg([(6, 20), (9, 15), (13, 12), (18, 10), (24, 6), (30, 4)], 1.0, ",", .35)
    for (x, y) in ((8, 11), (11, 10), (20, 7), (14, 15), (23, 16), (6, 3), (26, 9)):
        m.blob(x, y, .45, .45, "o", .1)
    for (x, y, r) in ((3, 15, 1.6), (27, 17, 1.4), (24, 2.5, 1.8), (16, 3, 1.2)):
        m.blob(x, y, r, r * .8, "#", .4, 1.5)
    m.seg([(11, 8.5), (15, 9.8)], 1.6, "=")
    return m, (1, 9, 6, 14), (19, 1, 28, 9), "a glacier field below a frozen fortress under the aurora borealis: wind-carved blue-white ice and snow, two deep jagged crevasses glowing turquoise inside, a natural snow bridge over one of them, a thin meandering meltwater stream, jagged ice spires and black rocks, several human figures frozen inside clear ice blocks like statues, sparkling frost, magical green and violet aurora light reflecting on the ice, cold, silent and beautiful."


def hvozd():
    m = M("g", 171)
    m.put(fbm(172, 2.5) > .3, "^")
    cx = 15 + 2.5 * np.sin(Y / 3) + .8 * fbm(173, 2)
    dd = np.abs(X - cx)
    m.put(dd < 2.4, ","); m.put((dd < 1.3) & (np.abs(Y - 10) > 1.5), "~")
    m.scatter("o", 12, .3, .55, ",", box=(10, 8, 20, 12))
    m.seg([(0, 10.5), (8, 9.5), (12, 10.2)], 1.3, "r", .3); m.seg([(18, 10), (23, 10.5), (30, 9.5)], 1.3, "r", .3)
    m.blob(24, 15, 2.4, 2.4, "#", .1); m.blob(24, 15, 1.7, 1.7, ".", .1)
    for i in range(6):
        a = i / 6 * 2 * math.pi
        m.blob(24 + 2.05 * math.cos(a), 15 + 2.05 * math.sin(a), .35, .35, "o", .05)
    m.rect(24, 17.2, 1.2, .8, 0, "+")
    m.scatter("T", 34, .7, 1.4, "g^", avoid=(lambda x, y: abs(y - 10) < 1.8 or abs(x - 15) < 4.5 or math.hypot(x - 24, y - 15) < 3.3,))
    return m, (0, 7, 4, 13), (25, 6, 29, 13), "a ford of white stones across a clear forest river in an enchanted ancient beech forest at sunrise: crystal water over pale pebbles, white stepping stones, silver-barked trees with golden leaves, morning mist rising from the water, sun rays through the canopy, a small ruined round elven stone pavilion with slender columns and a mossy floor on the south-east bank, dirt paths on both banks, ferns and wildflowers, serene and magical."


def tune():
    m = M(".", 181)
    sh = 18 - 3 * np.sin(Y / 4) - 1.2 * fbm(182, 3)
    m.put(X > sh, "~"); m.put((X > sh - 2.2) & (X <= sh), ",")
    cl = 5 + 1.5 * np.sin(Y / 2.2) + 1.2 * fbm(183, 2)
    m.put(X < cl, "#")
    m.blob(4.2, 6, 2.2, 1.6, ".", .2); m.blob(2.8, 6, .9, .9, "_", .1)
    m.put((fbm(184, 1.2) > .25) & (m.L == CL.index(".")), "^")
    for i in range(8):
        m.blob(9 + (i % 4) * 2.2, 4 + (i // 4) * 9 + (i % 2) * 2, .9, .6, ",", .3, 1)
    m.blob(16.5, 13.5, 1.6, .55, "%", .05, ang=.4); m.blob(15.6, 15.6, 1.4, .5, "%", .05, ang=-.2)
    m.scatter("o", 16, .3, .8, ".^,~", box=(6, 0, 30, 20))
    return m, (7, 1, 13, 5), (12, 12, 19, 18), "a rocky seashore at low tide at dusk: dark wet rocks covered in seaweed, barnacles and mussels, many small natural tide pools reflecting the sky with starfish and anemones, a pebbly beach, shallow green water with foam turning into a deep blue bay on the east, a dark sea cave entrance in the high cliff on the west, two beached smugglers' rowing boats with crates, scattered sea stacks and rocks, warm orange and violet sunset light, wet glistening reflections."


def laguna():
    m = M("~", 191)
    d = ((X - 15) / 12) ** 2 + ((Y - 10) / 8) ** 2 + .35 * fbm(192, 2.3)
    m.put(d < 1.05, ","); m.put((d < 1.05) & (d > .9), "^")
    m.put(Y > 17 + .8 * np.sin(X / 3), "."); m.put((Y > 15.8 + .8 * np.sin(X / 3)) & (Y <= 17 + .8 * np.sin(X / 3)), ",")
    hut = [(9, 6), (15, 4.5), (21, 6.5), (12, 11), (19, 11.5)]
    for (x, y) in hut:
        m.rect(x, y, 2.6, 2.2, .2, "#"); m.rect(x, y, 1.8, 1.4, .2, "."); m.rect(x, y + 1.0, .8, .4, .2, "+")
    m.seg([(9, 7.2), (12, 9.8)], .8, "="); m.seg([(15, 5.6), (15.5, 10.5), (19, 10.4)], .8, "="); m.seg([(21, 7.6), (19.5, 10.4)], .8, "=")
    m.seg([(12, 12.2), (11.5, 17.2)], .8, "="); m.seg([(19, 12.6), (20, 17)], .8, "=")
    m.scatter("T", 9, .6, 1.0, ".", box=(0, 17, 30, 20))
    m.scatter("o", 8, .3, .7, "^~", box=(0, 0, 30, 17))
    return m, (8, 18, 22, 19), (13, 3, 22, 8), "a turquoise tropical lagoon at noon: crystal-clear shallow water over white sand and colourful coral, a ring of coral reef with breaking surf separating it from the deep blue ocean, a village of thatched-roof stilt huts with roofs cut away connected by rope-and-plank walkways, a white sand beach with palm trees at the south, outrigger canoes, fishing nets, sea turtles shadows, dazzling sunlight with caustic light patterns on the sea floor."


def rokle():
    m = M("g", 201)
    cx = 15 + 2 * np.sin(Y / 3.5) + .8 * fbm(202, 2)
    dd = np.abs(X - cx)
    m.put(dd < 4.2, "^"); m.put(dd < 2.6, "_"); m.put(dd < 1.0, "~")
    m.seg([(10, 6.5), (20.5, 7.5)], 1.2, "=")
    m.put((fbm(203, 1.5) > .3) & (m.L == CL.index("g")) & (X < 9), ".")
    for i in range(4):
        m.seg([(1, 3 + i * 4), (8, 4 + i * 4)], .5, "%", .2)
    m.blob(26, 14, 2.4, 1.8, ".", .2); m.blob(26, 14, 1.2, .8, "x", .1)
    m.scatter("T", 20, .6, 1.2, "g", avoid=(lambda x, y: abs(x - 15) < 6,))
    m.scatter("o", 8, .3, .7, "g^.")
    return m, (0, 9, 6, 17), (22, 1, 29, 18), "a lush green ravine on the edge of a desert: a deep narrow gorge with steep mossy rock walls cutting the map north to south, a turquoise river at its bottom with small cascades, a swaying rope-and-plank bridge across, ferns, vines and flowering creepers hanging over the edge, terraced vineyards and olive trees of satyr farmers on the west rim, a raiders' camp with a campfire on the east rim, warm afternoon sunlight and floating pollen."


def vir():
    m = M("~", 211)
    r = np.hypot((X - 22) / 1.2, Y - 8)
    m.put((r < 6) & (np.sin(np.arctan2(Y - 8, (X - 22) / 1.2) * 2 + r * 1.4) > .2), "x")
    m.put(r < 1.6, "_")
    for (x, y, rx, ry) in ((6, 12, 4.5, 3.2), (13, 16, 2.6, 2.0), (4, 3.5, 2.2, 1.6)):
        d = m.blob(x, y, rx, ry, "#", .45, 1.6); m.put(d < .6, ".")
    m.blob(6, 12, 1.6, 1.4, "#", .1); m.blob(6, 12, 1.1, .9, ".", .1); m.rect(6, 13.2, .7, .5, 0, "+")
    m.blob(11.5, 9, 2.5, .6, "%", .05, ang=.5); m.blob(15, 11.5, 1.4, .5, "%", .05, ang=-.6)
    m.seg([(9.5, 13.5), (11.5, 15.2)], .9, "=")
    m.scatter("o", 9, .3, .8, "~", box=(0, 0, 16, 20))
    return m, (3, 9, 9, 15), (11, 14, 15, 18), "jagged dark rocky islets at the edge of a gigantic swirling ocean whirlpool during a storm: the right side of the map is a vast spiral maelstrom of foaming white water spinning down into a black abyss, the left side has wave-battered black rocks and two small rocky islets, the ruin of a round stone lighthouse with a broken roof, floating shipwreck debris, broken masts and barrels, a plank bridge between the islets, flying spray, dramatic stormy light with a single break in the clouds."


def khaeraz():
    m = M("g", 221)
    m.put(fbm(222, 2.2) > .25, "^")
    d = m.blob(20, 7, 7, 4.5, ",", .45, 2.3); m.put(d < .7, "~")
    m.put((Y < 2.5 + 1.2 * fbm(223, 2)) & (X < 14), "#")
    for (x, y, a) in ((7, 12, .2), (10.5, 14.5, -.3), (5, 16, .6)):
        m.blob(x, y, 1.2, 1.0, "%", .1, ang=a)
    m.blob(8.5, 15, .6, .6, "x", .1)
    m.seg([(3, 10), (4.5, 9)], .5, "%"); m.seg([(12, 11), (13.5, 11.8)], .5, "%")
    m.seg([(0, 18), (6, 17), (10, 13), (13, 10)], 1.2, "r", .3)
    m.scatter("T", 30, .6, 1.2, "g^", avoid=(lambda x, y: math.hypot(x - 8, y - 14) < 4.5 or ((x - 20) / 8) ** 2 + ((y - 7) / 5.3) ** 2 < 1,))
    m.scatter("o", 10, .3, .8, "g^,")
    return m, (4, 11, 11, 17), (22, 13, 29, 19), "a hunters' camp by a clear alpine lake in autumn: dark blue mountain lake with reflections and a reedy shore, grey scree and cliffs in the north-west, golden larches and dark pines, three hide tents, drying racks with furs and fish, a smoking campfire, a dirt trail, mossy boulders, crisp cold air, low golden autumn sun with long shadows."


def urkal():
    m = M("g", 231)
    m.put(fbm(232, 2) > .3, "^")
    m.rect(15, 10, 9, 3.2, 0, ","); m.rect(15, 10, 7.6, 2.0, 0, "~")
    m.blob(15, 10, .8, .8, "o", .05)
    for (x, y) in ((8, 6), (22, 6), (8, 14), (22, 14), (11.5, 6), (18.5, 6), (11.5, 14), (18.5, 14)):
        m.blob(x, y, .45, .45, "o", .05)
    for pts in (((3, 3), (11, 2.5)), ((19, 2.5), (27, 3.2)), ((3, 17), (10, 17.5)), ((20, 17.6), (27, 17))):
        m.seg(pts, .9, "T", .4)
    m.blob(26, 10, 2.8, 2.6, "#", .3, 1.5); m.blob(26, 10, 2.1, 1.9, ".", .25, 1.5); m.blob(24.4, 9.5, .8, .9, "^", .1)
    m.seg([(0, 10), (10, 10)], 1.6, "r", .2); m.seg([(20, 10), (23.6, 10)], 1.6, "r", .2)
    m.put((fbm(233, 1.2) > .4) & (m.L == CL.index("r")), "^")
    m.scatter("T", 10, .5, 1.0, "g^", avoid=(lambda x, y: 6 < x < 24 and 5 < y < 15,))
    return m, (0, 7, 4, 13), (22, 4, 28, 16), "an overgrown abandoned palace garden at night under a full moon: a long cracked marble reflecting pool with dark water and floating petals and a broken fountain statue in the middle, rows of weathered statues of crowned kings with their eyes chiselled out, wild overgrown hedges and rose bushes, a collapsed domed marble pavilion in the east, cracked paved walkways invaded by weeds, ivy, fallen leaves, silver moonlight and a few fireflies, melancholic and beautiful."


def mlyn():
    m = M("g", 241)
    cy = 8 + 1.5 * np.sin(X / 4) + .6 * fbm(242, 2)
    dd = np.abs(Y - cy)
    m.put(dd < 2.0, ","); m.put(dd < 1.2, "~")
    m.rect(17, 5.2, 4.6, 3.4, .08, "#"); m.rect(17, 5.2, 3.8, 2.6, .08, "."); m.rect(17.1, 6.9, 1.0, .4, .08, "+")
    m.blob(19.8, 7.2, .7, 1.3, "x", .05)
    m.rect(9, 8.3, 2.6, 4.6, .1, "=")
    for i in range(6):
        yy = 12 + i * 1.3
        m.put((np.abs(Y - (yy + .6 * np.sin(X / 2.5))) < .3) & (X > 2) & (X < 26), "%")
    m.seg([(0, 3), (9, 4), (14, 4.5)], 1.2, "r", .3); m.seg([(9, 10.5), (8, 20)], 1.2, "r", .3)
    m.scatter("T", 10, .6, 1.2, "g", box=(0, 0, 30, 6), avoid=(lambda x, y: 13 < x < 22,))
    return m, (2, 0, 8, 3), (12, 11, 24, 19), "a stone watermill by a gentle river among vineyards in late afternoon: a two-storey stone mill with its tiled roof cut away showing millstones and flour sacks, a turning wooden waterwheel splashing in the river, a small old stone bridge, gently curving rows of grapevines heavy with purple grapes on the south slope, poplars and fruit trees, wildflowers, a dusty road, warm honey-coloured sunlight, butterflies, peaceful and idyllic."


NOVE = [
 ("noelien-posvatny-haj", haj, dict(nazev="Nöelien – Posvátný háj u tůně", misto="02_Zeme/Elfsky_Stat_Noelien.md", podklad="les", osvetleni="Dim Light (soumrak, světlušky)",
   popis="Prastaré stromy kolem průzračné tůně a kruh devíti mechových menhirů s runami (three-quarters cover). Tůň je ve středu hluboká, kořeny a kapradí jsou difficult terrain. Kdo v kruhu sešle kouzlo školy Enchantment, hází záchranu s advantage. Potok odtéká na východ.",
   stretnuti=[{"nazev": "Dryad", "pocet": 1}, {"nazev": "Awakened Tree", "pocet": 2}, {"nazev": "Sprite", "pocet": 3}])),
 ("amir-rakosovy-ostrov", amir, dict(nazev="Jezero Amir – Rákosový ostrov a potopená věž", misto="01_Svet/Mista/Jezero_Amir_a_Kop_Aram.md", podklad="more", osvetleni="Bright Light (ráno), mlha: Lightly Obscured nad vodou",
   popis="Rákosový ostrůvek uprostřed jezera, z vody čouhá vrchol utopené věže starého Kop Aramu. Ostrov a věž spojuje vratké molo (=). Rákos je difficult terrain a Lightly Obscured. Kolem je hluboká voda, plavání stojí dvojnásob pohybu. Ve věži je otvor do zatopených pater.",
   stretnuti=[{"nazev": "Merrow", "pocet": 2}, {"nazev": "Giant Frog", "pocet": 3}])),
 ("werenor-vodopad", vodopad, dict(nazev="Starý Werenor – Ruiny u vodopádu", misto="03_Mesta/Mesto_Werenor.md", podklad="ruiny", osvetleni="Dim Light (mlha z vodopádu)",
   popis="Ruiny předpádového Werenoru u skalního prahu, přes který padá řeka. Skalní práh (#) je 15 ft vysoký, nahoru vedou schody na východě. Proud pod vodopádem (x): kdo do něj vstoupí, hází Strength save DC 13, jinak ho strhne 10 ft po proudu a je Prone. Tůň je hluboká, zlomené arkády dávají half cover.",
   stretnuti=[{"nazev": "Ghost", "pocet": 1}, {"nazev": "Specter", "pocet": 2}, {"nazev": "Skeleton", "pocet": 4}])),
 ("draar-cerne-utesy", draar, dict(nazev="Trosky Dräaru – Černé útesy a šeptající písky", misto="01_Svet/Mista/Trosky_Draaru.md", podklad="poust", osvetleni="Dim Light (rudý soumrak)",
   popis="Černý písek mezi čedičovými útesy, polozasypané sochy říše a kruh obelisků kolem propadu do Draarského podzemí. Okraj propadu (x) je popel a žhavá suť: 1d6 Fire při vstupu. Propad je 60 ft hluboký. Šepot démonů: na začátku každého kola Wisdom save DC 14, jinak postava do konce tahu nemůže používat Reaction. Duny jsou difficult terrain.",
   stretnuti=[{"nazev": "Glabrezu", "pocet": 1}, {"nazev": "Quasit", "pocet": 4}])),
 ("hinai-mihi-myti", hinai, dict(nazev="Hinai Mihi – Mýtina v pralese neviditelných", misto="01_Svet/Mista/Hinai_Mihi.md", podklad="les", osvetleni="Dim Light (pod korunami)",
   popis="Malá mýtina s obětním kamenem uprostřed hustého pralesa. Prales kolem (T) je heavily obscured a difficult terrain. Ticho: Wisdom (Perception) podle sluchu má disadvantage. Kanibalové jsou Invisible (viz stránka místa). Kolem kamene je oltář s krví (x): kdo na něm skončí tah, má disadvantage na Wisdom saves do konce dalšího tahu.",
   stretnuti=[{"nazev": "Tough", "pocet": 4}, {"nazev": "Tough Boss", "pocet": 1}])),
 ("ertinova-hora-upati", ertin, dict(nazev="Západní hvozd – Úpatí Ertinovy hory", misto="01_Svet/Mista/Zapadni_hvozd_a_Ertinova_hora.md", podklad="les", osvetleni="Dim Light (zelené přítmí)",
   popis="Hromada kamení tvaru zlomených kostí porostlá mechem a kořeny, kolem ní stromy ve spirálách. Uvnitř je dutina s runovým kamenem. Kouzla školy Divination tu mají advantage na související ověření, každé seslání ale vyvolá Wisdom save DC 13 proti vizím Temného dne (viz stránka místa). Suť a kořeny jsou difficult terrain.",
   stretnuti=[{"nazev": "Shambling Mound", "pocet": 1}, {"nazev": "Awakened Shrub", "pocet": 4}])),
 ("fornheim-ledovec", fornheim, dict(nazev="Fornheim – Ledovec pod zamrzlou tvrzí", misto="01_Svet/Mista/Fornheim.md", podklad="snih", osvetleni="Dim Light (polární záře)",
   popis="Ledovcové pole se dvěma trhlinami (_, 40 ft hluboké) a sněhovým mostem. Zmrzlé postavy v ledu (o) dávají three-quarters cover. Celá mapa je slippery ice a difficult terrain kvůli sněhu. Extreme Cold: Constitution save DC 10 každou hodinu bez ochrany. Tavná voda je mělká a ledová.",
   stretnuti=[{"nazev": "Frost Giant", "pocet": 1}, {"nazev": "Ice Devil", "pocet": 1}, {"nazev": "Winter Wolf", "pocet": 2}])),
 ("vychodni-hvozd-brod", hvozd, dict(nazev="Východní hvozd – Brod bílých kamenů", misto="01_Svet/Mista/Vychodni_hvozd.md", podklad="les", osvetleni="Bright Light (ráno), mlha nad řekou",
   popis="Průzračná řeka v Tirentově hvozdu, přes brod vedou bílé kameny. Hluboká koryta (~) jsou mimo brod. Na jihovýchodním břehu stojí rozpadlý elfí altán se sloupy (three-quarters cover). Les, který se dívá: kdo se pokusí o Hide, hází s disadvantage.",
   stretnuti=[{"nazev": "Owlbear", "pocet": 1}, {"nazev": "Worg", "pocet": 2}])),
 ("ordenska-zatoka-tune", tune, dict(nazev="Ordenská zátoka – Přílivové tůně a pašerácká jeskyně", misto="02_Zeme/Teokracie_Orden.md", podklad="plaz", osvetleni="Dim Light (soumrak, odliv)",
   popis="Skalnaté pobřeží při odlivu, kluzké kameny s chaluhami (difficult terrain) a přílivové tůně. Ve skalní stěně na západě je vstup do pašerácké jeskyně. Na pláži leží dva čluny s bednami (half cover). Příliv: od 5. kola se mělčina (,) mění v hlubokou vodu.",
   stretnuti=[{"nazev": "Sahuagin Warrior", "pocet": 4}, {"nazev": "Giant Crab", "pocet": 2}])),
 ("jizni-ostrovy-laguna", laguna, dict(nazev="Svobodné jižní ostrovy – Laguna s vesnicí na kůlech", misto="02_Zeme/Svobodne_Jizni_Ostrovy.md", podklad="more", osvetleni="Bright Light (poledne)",
   popis="Tyrkysová laguna s chýšemi na kůlech spojenými lávkami (=). Laguna je mělká (,), za korálovým útesem (^, difficult terrain, 1 Slashing při vstupu bez bot) začíná hluboký oceán. Na jihu je pláž s palmami. Lávky jsou úzké: Dash po nich vyžaduje Acrobatics DC 10.",
   stretnuti=[{"nazev": "Merfolk Skirmisher", "pocet": 3}, {"nazev": "Sea Hag", "pocet": 1}])),
 ("zairam-rokle", rokle, dict(nazev="Zairam – Rokle na hranici s Tali", misto="02_Zeme/Zeme_Zairam.md", podklad="reka", osvetleni="Bright Light (odpoledne)",
   popis="Hluboká zelená rokle (_, 50 ft) s řekou na dně dělí satyrské vinice na západě od tábora nájezdníků z Tali na východě. Přes rokli vede houpavý provazový most (=): kdo po něm běží, hází Dexterity save DC 10, jinak Prone. Okraje rokle porostlé liánami jsou difficult terrain.",
   stretnuti=[{"nazev": "Gnoll Warrior", "pocet": 4}, {"nazev": "Hyena", "pocet": 3}])),
 ("monohen-vir", vir, dict(nazev="Mönohen – Skaliska u Víru", misto="02_Zeme/Klanove_Zeme_Monohen.md", podklad="more", osvetleni="Dim Light (bouře)",
   popis="Skalnaté ostrůvky na okraji obřího víru východně od Mönohenu, zřícený maják a trosky lodí. Vír (x): na konci tahu ve víru Strength (Athletics) DC 15, jinak tě strhne 10 ft ke středu. Střed víru (_) táhne do hlubin. Skály jsou kluzké (difficult terrain), trosky dávají half cover.",
   stretnuti=[{"nazev": "Giant Octopus", "pocet": 1}, {"nazev": "Merrow", "pocet": 2}])),
 ("khaeraz-lovecky-tabor", khaeraz, dict(nazev="Khaeraz – Lovecký tábor u horského jezera", misto="02_Zeme/Khaeraz.md", podklad="les", osvetleni="Bright Light (podzim, nízké slunce)",
   popis="Tábor lovců z kmenů náčelníka Oltara u horského jezera. Stany a sušáky (%) dávají half cover, ohniště (x) 1d6 Fire při vstupu. Na severozápadě jsou skály a suť. Ordenská posádka přichází od jihovýchodu.",
   stretnuti=[{"nazev": "Warrior Veteran", "pocet": 1}, {"nazev": "Guard", "pocet": 4}])),
 ("urkal-palacova-zahrada", urkal, dict(nazev="Urkal – Zarostlá palácová zahrada", misto="01_Svet/Mista/Urkal.md", podklad="ruiny", osvetleni="Dim Light (úplněk)",
   popis="Zahrada zapečetěného Urkalského paláce: dlouhý odrazný bazén (hluboký 5 ft) s rozbitou fontánou, sochy králů s vydlabanýma očima (three-quarters cover) a zřícený pavilon na východě. Zarostlé živé ploty jsou heavily obscured. Palác hlídá ordenská stráž.",
   stretnuti=[{"nazev": "Knight", "pocet": 1}, {"nazev": "Guard", "pocet": 4}])),
 ("noet-mlyn-ve-vinicich", mlyn, dict(nazev="Nöet – Vodní mlýn ve vinicích", misto="02_Zeme/Provincie_Noet.md", podklad="reka", osvetleni="Bright Light (podvečer)",
   popis="Kamenný mlýn u řeky s vodním kolem (x: kdo se dostane do kola, 2d6 Bludgeoning a je Restrained, únik Athletics DC 13). Přes řeku vede kamenný most. Na jižním svahu jsou řady vinné révy (%, half cover, difficult terrain napříč řadami). V mlýně se schovávají kultisté.",
   stretnuti=[{"nazev": "Cultist", "pocet": 4}, {"nazev": "Cultist Fanatic", "pocet": 1}])),
]

if __name__ == "__main__":
    PRED.mkdir(parents=True, exist_ok=True)
    data = json.loads(OUT.read_text(encoding="utf-8"))
    ids = {d["id"] for d in data["mapy"]}
    sc_p = PRED / "sceny.json"
    sceny = json.loads(sc_p.read_text(encoding="utf-8")) if sc_p.exists() else {}
    for mid, f, meta in NOVE:
        m, sd, sn, scena = f()
        rows = m.grid(); m.image(PRED / f"{mid}.png"); sceny[mid] = scena

        class G2:
            def get(s, x, y):
                return rows[y][x] if 0 <= x < W and 0 <= y < H else "#"
        st = {"druzina": spots(G2(), 6, *sd), "nepratele": spots(G2(), 6, *sn)}
        print(mid, st); print("\n".join(rows)); print()
        if "--zapsat" in sys.argv and mid not in ids:
            rec = {"id": mid, **meta, "stav": "návrh", "start": st, "mrizka": rows, "obrazek": f"bojove/{mid}.jpg"}
            data["mapy"].append(rec)
    sc_p.write_text(json.dumps(sceny, ensure_ascii=False, indent=1), encoding="utf-8")
    if "--zapsat" in sys.argv:
        OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8"); print("zapsáno →", OUT)
