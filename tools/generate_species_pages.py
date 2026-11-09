#!/usr/bin/env python3
"""Create editable species reference pages and portrait prompts from the rules index."""
import argparse
import json
import os
import re
from pathlib import Path

import yaml
from species_content import (APPEARANCE, CULTURE, DETAIL_URLS, OPTIONS, PROMPT_ACTIONS,
                             PROMPT_ANATOMY, PUBLICATION_YEARS, TRAIT_DETAILS, TRAIT_REMOVALS,
                             TRAIT_RENAMES)

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "web/assets/pravidla2024.json"
OUT = ROOT / "13_Druhy"
PROMPTS = ROOT / "tools/portrety_prompty.json"
SRD = {"Dragonborn", "Dwarf", "Elf", "Gnome", "Goliath", "Halfling", "Human", "Orc", "Tiefling"}
ALTERNATIVES = {"Kenku": "žádná přímá", "Yuan-ti": "Tiefling (tematicky)", "Locathah": "Triton (tematicky)",
                "Loxodon": "Goliath (tematicky)", "Leonin": "Tabaxi (tematicky)", "Owlin": "Aarakocra (tematicky)"}
ANATOMY = {
    "Dwarf": "short, sturdy folk with broad shoulders and a thick beard", "Dragonborn": "scaled, upright draconic folk with a long tail",
    "Bugbear": "tall, broad goblinoid with long arms, pointed ears, shaggy fur, and a heavy build",
    "Fairy": "small winged Fey with delicate insect-like wings, pointed ears, and a slender humanoid body",
    "Human": "adult human with natural, varied features and ordinary bipedal proportions",
    "Elf": "slender, pointed-eared folk", "Gnome": "small, bright-eyed folk", "Halfling": "three-foot-tall, round-faced folk",
    "Goliath": "towering seven-to-eight-foot humanoid with stony skin", "Tiefling": "horned humanoid with a tail and unusual eyes",
    "Aasimar": "humanoid with a subtle golden inner light", "Orc": "broad, tusked humanoid", "Aarakocra": "feathered birdfolk with a beak, wings, and talons",
    "Kenku": "small feathered crow-like folk with a beak and black plumage", "Tabaxi": "feline humanoid with fur, whiskers, and a long tail",
    "Tortle": "turtle-like folk with a domed shell and clawed hands", "Lizardfolk": "scaled reptilian humanoid with a broad snout and tail",
    "Yuan-ti": "serpentine humanoid with slit pupils and subtle scales", "Centaur": "humanoid upper body joined to a horse-like body",
    "Minotaur": "horned bovine humanoid with a broad muzzle", "Satyr": "horned fey with goat legs and cloven hooves",
    "Warforged": "construct of riveted metal plates, dark wood, and glowing eyes", "Faerie": "tiny winged fey with translucent insect wings",
    "Flamekin": "living-fire humanoid with charcoal-cracked skin and flame hair", "Rimekin": "pale-blue crystalline humanoid with cold blue flame",
    "Boggart": "small squat goblinoid with large ears and grey-green skin", "Kithkin": "three-foot-tall folk in woven Celtic-style clothes",
    "Lorwyn Changeling": "small fey whose body mimics mossy stone and bark", "Changeling": "pale grey humanoid with colourless eyes",
    "Kalashtar": "human-like person with faintly glowing eyes", "Khoravar": "half-elven person with subtly pointed ears",
    "Shifter": "humanoid with bestial sideburns, fangs, and alert eyes", "Dhampir": "pale humanoid with sharp features and red-tinged eyes",
    "Reborn": "ash-grey humanoid with faint stitched scars", "Lupin": "wolf-headed humanoid with fur and a lupine muzzle",
    "Hexblood": "lavender-skinned humanoid with bark-like crown growths", "Duskling": "dusky violet humanoid with softly luminous markings",
    "Bariaur": "ram-folk with a humanoid torso, goat lower body, and curled horns",
}
PLACES = ["the dwarven forge below Wortmir, framed by anvils and soot-dark stone",
          "the ore-cart galleries of Wortmir's deep mine, lit by oil lamps",
          "a grey Orden office hung with faceless-mask banners",
          "a hidden, candlelit Irtis fire shrine",
          "the busy Upper Gate market stalls", "the crowded Kladivo a výheň tavern",
          "the ash-grey lanes of Popelná ulička", "a snowy mountain pass beside a mule caravan",
          "a rune workshop where blue sigils glow on stone", "a dark smuggler tunnel stacked with crates"]

def stem(name):
    return "Druh_" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")

def frontmatter(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    parts = text.split("---", 2)
    return yaml.safe_load(parts[1]) or {}

def species_npcs():
    result = {}
    for path in sorted((ROOT / "04_Postavy").rglob("Postava_*.md")):
        character = frontmatter(path).get("postava", {})
        name = character.get("druh")
        if not name:
            continue
        related = result.setdefault(name, [])
        links = []
        for field in ("mesta", "zeme", "frakce"):
            entries = character.get(field, [])
            if isinstance(entries, str):
                entries = [entries]
            for entry in entries:
                target = ROOT / entry
                if target.is_file():
                    title = next((line[2:].strip() for line in target.read_text(encoding="utf-8").splitlines()
                                  if line.startswith("# ")), target.stem.replace("_", " "))
                    links.append((title, Path(os.path.relpath(target, OUT)).as_posix()))
        related.append((character.get("jmeno", path.stem), Path(os.path.relpath(path, OUT)).as_posix(), links))
    return result

def main():
    parser = argparse.ArgumentParser(description="Generate species pages from the rules index.")
    parser.add_argument("--force", action="store_true", help="overwrite existing species pages")
    args = parser.parse_args()
    rules = json.loads(RULES.read_text(encoding="utf-8"))
    data = rules["druhy"]
    prompts = json.loads(PROMPTS.read_text(encoding="utf-8"))
    prompts.setdefault("druhy", {})
    prompts.setdefault("jmena_karet", {})
    npc_index = species_npcs()
    existing = [OUT / f"{stem(name)}.md" for name in data if (OUT / f"{stem(name)}.md").exists()]
    if existing and not args.force:
        names = ", ".join(path.name for path in existing[:5])
        if len(existing) > 5:
            names += f", … ({len(existing)} pages total)"
        raise SystemExit(f"Refusing to overwrite existing species pages: {names}. Pass --force to overwrite.")
    OUT.mkdir(exist_ok=True)
    for index, (name, value) in enumerate(data.items()):
        traits = {str(key).strip(): str(description).strip()
                  for key, description in value.get("rysy", {}).items()}
        for old_trait, new_trait in TRAIT_RENAMES.get(name, {}).items():
            if old_trait in traits:
                traits[new_trait] = traits.pop(old_trait)
        for removed_trait in TRAIT_REMOVALS.get(name, set()):
            traits.pop(removed_trait, None)
        traits.update(TRAIT_DETAILS.get(name, {}))
        value["rysy"] = traits
        old = bool(value.get("legacy"))
        source = value.get("zdroj", "neověřeno")
        urls = value.get("overeno") or ["https://www.dndbeyond.com/species"]
        if name in DETAIL_URLS:
            urls = list(dict.fromkeys(urls + [DETAIL_URLS[name]]))
        if name in SRD:
            urls = list(dict.fromkeys(urls + ["https://www.dndbeyond.com/srd",
                "https://creativecommons.org/licenses/by/4.0/legalcode"]))
        if name == "Aasimar":
            urls = list(dict.fromkeys(urls + ["https://www.dndbeyond.com/sources/dnd/phb-2024"]))
        kind = value.get("typ", "Humanoid")
        value["typ"] = kind
        value["overeno"] = urls
        value.setdefault("delka_zivota", "zdroj neuvádí")
        if old:
            value.setdefault("alternativa_2024", ALTERNATIVES.get(name, "žádná přímá"))
        else:
            value.setdefault("alternativa_2024", "—")
        value.setdefault("legacy", old)
        edice = "legacy" if old else ("2024+" if source != "Player's Handbook" else "2024")
        year = PUBLICATION_YEARS.get(source, "neověřeno")
        meta = {"nazev": name, "zdroj": source, "rok": year, "edice": edice, "legacy": old,
                "alternativa_2024": value["alternativa_2024"], "velikost": value.get("velikost", "neověřeno"),
                "rychlost": value.get("rychlost", "neověřeno"), "typ": kind,
                "delka_zivota": value["delka_zivota"], "overeno": urls,
                "stitky": ["Druh", "legacy, kompatibilní"] if old else ["Druh", "2024+" if edice == "2024+" else "2024"]}
        appearance = APPEARANCE.get(name, "Vzhled konkrétní populace není v použitých zdrojích podrobně popsán; další znaky jsou **neověřeno**.")
        culture = CULTURE.get(name, f"Zdroj *{source}* zasazuje druh do multiverza D&D; konkrétní kultura a domovina mimo tuto informaci jsou **neověřeno**.")
        body = [f"# {name}", "", f'<div class="druh-hero" data-druh-obrazek="{stem(name)}" aria-label="Ilustrace druhu {name}"></div>', "",
                "## Přehled", "", f"**{name}** je hratelný druh z publikace *{source}*. Pravidlový záznam uvádí velikost **{meta['velikost']}**, rychlost **{meta['rychlost']}** a typ **{kind}**."]
        if old:
            body += ["", "> **legacy, kompatibilní** — starší varianta je podporována; přímá či tematická alternativa pro 2024: " + meta["alternativa_2024"] + "."]
        body += ["", "## Vzhled", "", appearance,
                 "", "## Původ a kultura", "", culture,
                 "", "## Velikost a délka života", "", f"- **Velikost:** {meta['velikost']}\n- **Rychlost:** {meta['rychlost']}\n- **Typ:** {kind}\n- **Délka života:** {meta['delka_zivota']}",
                 "", "## Traits", ""]
        for trait, description in traits.items():
            body += [f"### {trait.strip()}", "", str(description).strip(), ""]
        choices = OPTIONS.get(name)
        if not choices and name in {"Air Genasi", "Earth Genasi", "Fire Genasi", "Water Genasi"}:
            choices = OPTIONS["Genasi"]
        if not choices:
            choices = "Druh nemá v použitých zdrojích doloženou samostatnou tabulku volitelných linií či předků."
        first_traits = list(traits)[:2]
        player_tip = (f"Plánuj využití traitů **{first_traits[0]}** a **{first_traits[1]}** společně s akcemi své postavy; "
                      "u schopností s omezeným počtem použití sleduj obnovu po Short či Long Rest.") if len(first_traits) > 1 else "Při tvorbě ověř zdroj a omezení každého traitu."
        dm_tip = ("Druh neurčuje povahu ani jednu kulturu. V boji i mimo něj připomeň hráčům dosah, trvání, záchranné hody a obnovu schopností přesně podle citovaných pravidel.")
        body += ["## Volby", "", choices, "",
                 "## Tipy pro hráče a DM", "", f"- **Pro hráče:** {player_tip}",
                 f"- **Pro DM:** {dm_tip}",
                 "", "## V Montelienu", "", "> **Stav:** návrh", "",
                 f"Začlenění druhu do Montelienu je návrh; konkrétní domovina a místní tradice nejsou potvrzené. "
                 f"Místní vazby mohou vést přes [Wortmir](../03_Mesta/Mesto_Wortmir.md) "
                 "a [Knížectví Khärghae Zia](../02_Zeme/Kralovstvi_Kharghae_Zia.md)."]
        residents = npc_index.get(name, [])
        body += ["", "## Postavy tohoto druhu", ""]
        if residents:
            for resident, link, places in residents:
                line = f"- [{resident}]({link})"
                if places:
                    line += " — " + " · ".join(f"[{title}]({place})" for title, place in places)
                body.append(line)
        else:
            body.append(f"Katalog zatím neobsahuje postavu, jejímž druhem je **{name}**.")
        body += ["", "## Zdroje", "", *[f"- {url}" for url in urls]]
        if name in SRD:
            body += ["", "Tato stránka obsahuje materiál ze System Reference Document 5.2.1 (SRD 5.2.1) od Wizards of the Coast LLC, dostupného na https://www.dndbeyond.com/srd. SRD 5.2.1 je licencován pod Creative Commons Attribution 4.0 International License: https://creativecommons.org/licenses/by/4.0/legalcode."]
        file = OUT / f"{stem(name)}.md"
        file.write_text("---\n" + yaml.safe_dump({"druh": meta}, allow_unicode=True, sort_keys=False) + "---\n\n" + "\n".join(body) + "\n", encoding="utf-8")
        anatomy = PROMPT_ANATOMY.get(name, ANATOMY.get(name, f"adult {name} humanoid with species-specific features"))
        sex = "female" if index % 3 == 0 else "male"
        clothing = ["ochre wool and soot-black leather", "teal linen with brass trim", "burgundy work cloth and bronze clasps",
                    "indigo travel robes with copper stitching", "rust-red canvas over charcoal grey", "moss-green layers with gold thread",
                    "cream linen and dark leather", "plum wool with a polished steel clasp", "slate-blue apron and amber scarf",
                    "deep violet fabric with pale silver embroidery", "golden ochre coat with smoke-grey cuffs", "white linen beneath a worn cobalt vest"][index % 12]
        action = PROMPT_ACTIONS.get(name, "studying the carved symbols of the old mountain city")
        prompt = (f"Create an original Art Nouveau lithograph portrait of one {sex} adult {name}, depicted at the true scale for {meta['velikost']}. "
                  f"Make the species anatomy unmistakable: {anatomy}; pose them {action} in {PLACES[index % len(PLACES)]}, wearing {clothing} inspired by {source}. "
                  "Use a gold-and-soot palette, natural facial features, matte paper grain, and no text.")
        prompts["druhy"][stem(name)] = prompt
        prompts["jmena_karet"][stem(name)] = name
    rules["druhy"] = data
    RULES.write_text(json.dumps(rules, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PROMPTS.write_text(json.dumps(prompts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(data)} species pages and prompts")

if __name__ == "__main__":
    main()
