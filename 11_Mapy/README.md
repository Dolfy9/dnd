# Mapy

![Mapa Montelienu](Montelien_mapa.jpg)

Barevná mapa je **přímo tvoje kresba**: fotka je vyrovnaná, bez stínů, moře a pevnina jsou obarvené a ruční nápisy zemí nahrazené sázeným písmem. Žádné tvary se nepřekreslují. Podrobný rozbor všeho, co na kresbě je: [Analýza mapy](Analyza_mapy.md).

| Soubor | Popis |
|---|---|
| [Montelien_mapa.jpg](Montelien_mapa.jpg) | Barevná mapa s popisky (3072×2160). |
| [Montelien_mapa_vyrovnana.jpg](Montelien_mapa_vyrovnana.jpg) | Vyrovnaná černobílá kresba (2048×1440) – souřadnice v `mista.json` odpovídají tomuto obrázku. |
| [Montelien_mapa_foto.jpg](Montelien_mapa_foto.jpg) | Původní fotka mapy (DM). |
| [mista.json](mista.json) | Místa na mapě (souřadnice, popisky, odkazy) – pro barevnou i interaktivní mapu. |
| [Analyza_mapy.md](Analyza_mapy.md) | Rozbor kresby po dílech: popisky, sídla, symboly. |
| [Geografie.md](Geografie.md) | Měřítko, cestování, jisté vs. odhad. |

## Úpravy
- Místo / popisek: uprav `mista.json` a spusť `python3 tools/mapa.py` (`--debug` vykreslí body a rámečky nápisů).
- Na mapě DM jsou sídla jen jako kroužky bez jmen; v `mista.json` jsou jako „Sídlo (bez jména)“. Až určíš, který kroužek je které město, přejmenuju je.
