# Pokyny pro práci na projektu Montelien (pro Devina / AI asistenty)

Tento repozitář je **lore wiki a příprava D&D 5e kampaní** ve světě Montelien. Nejde o software.

## Jazyk a styl
- Veškerý obsah piš **česky** (s diakritikou). D&D mechaniky (kouzla, subclassy, schopnosti) nech v **angličtině** pod názvy z pravidel 2024.
- Názvy souborů: bez diakritiky, slova oddělená `_`, prefix podle typu (`Postava_`, `Mesto_`, `Quest_`, `Hadanka_`, `Sezeni_` ...).
- Tón: temné fantasy, politické intriky, ztracené vědění, náboženský útlak (Orden) vs. stará víra ve Stavitele.

## Pravidla hry: D&D 5e – verze 2024
- Základ: **Player's Handbook 2024, Dungeon Master's Guide 2024, Monster Manual 2025**. Terminologie 2024: *Species* (ne Race), *Background* dává ability score increases + Origin feat, subclass všude od 3. úrovně, Exhaustion −2 za úroveň, Weapon Mastery.
- Kouzla a schopnosti uváděj pod názvy z 2024 (např. Befuddlement místo Feeblemind, Shining Smite místo Branding Smite, Divine Smite je kouzlo).
- Subclassy a species ze starších knih (XGtE, TCoE, MotM, SCAG…) jen tehdy, když 2024 nemá ekvivalent. Označ je „legacy, kompatibilní“ a uveď alternativu z 2024.
- U každé postavy veď řádek **Převod na 2024**, kde je vidět, co se změnilo.
- Bohové a mýtické bytosti: avatar max. CR 30 (MM 2025).
- Pravidla ověřuj např. na http://dnd2024.wikidot.com nebo D&D Beyond (Free Rules 2024).

## Kánon – pravidla
1. **Kánon určuje uživatel (DM).** Nic, co je napsané, nepřepisuj ani "neopravuj" bez souhlasu – kromě zjevných překlepů.
2. Rozpory a nejasnosti nezapisuj potichu – přidej je do `Otevrene_otazky.md` a zeptej se.
3. Nový obsah, který vymyslíš ty (návrhy), označ v souboru řádkem `> **Stav:** návrh` dokud ho uživatel neschválí; schválený obsah má `> **Stav:** kánon` (u původních souborů z archivu se stav neuvádí = kánon).
4. Tajné informace pro DM (které hráči nesmí vidět) dávej do sekce `## Pro DM (tajné)`. Texty pro hráče (handouty) patří do `06_Knihy_a_Dokumenty/`.
5. Při přidání nové entity ji **prolinkuj** relativními Markdown odkazy (země ↔ město ↔ vládce ↔ frakce) a aktualizuj index spuštěním `python3 tools/kontrola.py --index`.
6. Používej šablony ze `_Sablony/`.

## Časová osa (zkráceně)
- **Éra Stavitelů** (-400 000 až -600 let) → končí **Temným dnem** (Ertusův pád / Zkáza Werenoru).
- **Éra vlády lidí** (-600 až -2 roky) → koruna Bririe, občanské války.
- **Éra Ordenského řádu věcí** (poslední 2 roky) → začala **Urkalským sněmem**.
- Rok 0 = začátek kampaně (přítomnost).

## Mapa a web
- Souřadnice míst: `11_Mapy/mista.json` → popisky `python3 tools/mapa.py` (Pillow). Nové místo s polohou přidej i sem.
- Web: `web/serve.sh` spustí `web/server.py` (MkDocs Material + API pro úpravy). Na webu jde upravit, přidat a smazat každou stránku, postavy (formulář) i místa na mapě – zapisuje se přímo do souborů repa. Navigace se generuje z nadpisů `# `. Sekce `## Pro DM` web skryje v režimu hráče.
- Postavy: data jsou v YAML hlavičce `postava:` (viz `_Sablony/Sablona_Postava.md`); AC, HP, záchrany, dovednosti, PB, spell DC a sloty dopočítává `web/assets/postava.js` podle pravidel 2024 (`web/assets/pravidla2024.json`). Používej jen species, subclassy, featy a kouzla z pravidel 2024 (PHB 2024, Heroes of Faerûn, Ravenloft: The Horrors Within).

## Struktura
Viz `README.md`. Kontrola odkazů: `python3 tools/kontrola.py` (bez závislostí, Python 3).
