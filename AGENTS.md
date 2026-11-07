# Pokyny pro práci na projektu Montelien (pro Devina / AI asistenty)

Tento repozitář je **lore wiki a příprava D&D 5e kampaní** ve světě Montelien. Nejde o software.

## Jazyk a styl
- Veškerý obsah piš **česky** (s diakritikou). D&D mechaniky (kouzla, subclassy, schopnosti) nech v **angličtině** dle 5e (SRD / PHB 2014 názvy), jak je zvykem v existujících souborech.
- Názvy souborů: bez diakritiky, slova oddělená `_`, prefix podle typu (`Postava_`, `Mesto_`, `Quest_`, `Hadanka_`, `Sezeni_` ...).
- Tón: temné fantasy, politické intriky, ztracené vědění, náboženský útlak (Orden) vs. stará víra ve Stavitele.

## Kánon – pravidla
1. **Kánon určuje uživatel (DM).** Nic, co je napsané, nepřepisuj ani "neopravuj" bez souhlasu – kromě zjevných překlepů.
2. Rozpory a nejasnosti nezapisuj potichu – přidej je do `Otevrene_otazky.md` a zeptej se.
3. Nový obsah, který vymyslíš ty (návrhy), označ v souboru řádkem `> **Stav:** návrh` dokud ho uživatel neschválí; schválený obsah má `> **Stav:** kánon` (u původních souborů z archivu se stav neuvádí = kánon).
4. Tajné informace pro DM (které hráči nesmí vidět) dávej do sekce `## Pro DM (tajné)`. Texty pro hráče (handouty) patří do `06_Knihy_a_Dokumenty/`.
5. Při přidání nové entity ji **prolinkuj** relativními Markdown odkazy (země ↔ město ↔ vládce ↔ frakce) a aktualizuj index spuštěním `python3 tools/kontrola.py --index`.
6. Používej šablony ze `_Sablony/`.

## Časová osa (zkráceně)
- **Éra Stavitelů** (-400 000 až -600 let) → končí **Temným dnem** (Ertusův pád / Zkáza Werenoru).
- **Éra vlády lidí** (-600 až -3 roky) → koruna Bririe, občanské války.
- **Éra Ordenského řádu věcí** (posledních 3 roky) → začala **Urkalským sněmem**.
- Rok 0 = začátek kampaně (přítomnost).

## Struktura
Viz `README.md`. Kontrola odkazů: `python3 tools/kontrola.py` (bez závislostí, Python 3).
