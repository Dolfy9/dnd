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
