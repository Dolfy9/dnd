# Ilustrace bojových map

Každá bojová mapa v `11_Mapy/bojove_mapy.json` může mít pole `obrazek` (cesta relativně k `11_Mapy`, např. `bojove/octowerin-ulicka.jpg`). Bojový modul obrázek vykreslí pod mřížku. Pravidla (zdi, voda, krytí, těžký terén) se dál počítají z `mrizka`, tlačítko **Terén** je ukáže přes obrázek.

## Postup pro novou mapu
1. Nakresli mřížku (v režimu úprav na webu nebo v `tools/boj_mapy.py`).
2. `python3 tools/boj_mapy.py --predlohy` vykreslí schematické předlohy do `11_Mapy/bojove/predlohy/` (1536 × 1024, 30 × 20 polí).
3. Předlohu dej generátoru obrázků jako referenci (image-to-image) s promptem níže, výstup ulož jako `11_Mapy/bojove/<id>.jpg` (JPEG, kvalita ~86).
4. Ověř zarovnání (tlačítko **Terén** v bojovém modulu) a do mapy doplň `"obrazek": "bojove/<id>.jpg"` (tlačítko **Obrázek mapy…** v záložce Mapa).

## Společný prompt
> Repaint this layout reference as a gorgeous, highly detailed, hand-painted top-down (orthographic, 90 degree overhead) fantasy tabletop RPG battle map, in the style of premium Dungeons & Dragons battlemaps. CRITICAL: preserve the exact layout, proportions and positions of every element of the reference image so it aligns with a 30 x 20 square grid. No grid lines, no text, no labels, no characters, no frame. Rich textures, soft shadows, painterly detail.

Plus legenda barev předlohy (tmavá = zdi, modrá = voda, hnědé čtverce = bedny/keře podle prostředí…) a popis scény a světla podle `popis` a `osvetleni` mapy.

## Realistický styl (mapy 6–15)
Druhá várka map (`python3 tools/boj_mapy.py --pridat` doplní nové mapy do JSON, existující nechá být) používá realistický prompt:

> Repaint this layout reference as a highly realistic top-down (orthographic, exactly 90 degree overhead) tabletop RPG battle map. Photorealistic look like a high-end realistic 3D render or aerial drone photograph: physically accurate natural lighting, real-world materials and textures, subtle ambient occlusion and soft shadows, no cartoon outlines, no painterly stylization. CRITICAL: preserve the exact layout … aligns with a 30 x 20 square grid. … No grid lines, no square tiles, no text, no labels, no people, no creatures, no frame.

Pozor: těžký terén (`^`) kresli v předloze jako rozmazané skvrny, ne jako čtverce, a do promptu napiš, že skvrny nejsou předměty (rákos, suť, oblázky, bláto). Jinak z nich generátor udělá bedny.

## Organické přírodní mapy (`tools/boj_organicke.py`)
Přírodní mapy (brod, most, ruiny, bažina, zamrzlé jezero, jeskyně, průsmyk, oáza, pobřeží) už nevznikají ze čtverců mřížky. Terén je spojité pole (šum, meandry, nepravidelné skvrny, natočené stavby), z něj se vykreslí předloha (`~/predlohy/org/<id>.png`) a mřížka se odvodí až z něj podle podílu terénu v každém poli.

1. `python3 tools/boj_organicke.py` vypíše mřížky a uloží předlohy a popisy scén (`sceny.json`); `--zapsat` přepíše mřížky a starty těchto map v `bojove_mapy.json`.
2. Předlohu dej generátoru s promptem „realistic aerial drone photograph … natural, organic, wild and chaotic … no blocky, tiled or Minecraft-like look …“ + popis scény.
3. Zkontroluj tlačítkem **Terén**: velké prvky (voda, útesy, zdi, most, propast) sedí, jednotlivé stromy a balvany jen přibližně. Případné rozdíly přemaluj v režimu úprav.
