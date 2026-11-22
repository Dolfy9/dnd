# Audit importu bestiáře

Vzorek 20 skutečných záznamů z `web/assets/srd/bestiar.json`. Před = adaptér
z commitu `74fcb9b`, po = kanonický adaptér s katalogem `kouzla2024.json`.
Skóre počítá použitelné skupiny polí, ne jednotlivé hodnoty ani kompletní
správnost všech pravidel. Referencí jsou zdrojová data, nikoli nezávislý audit příručky.

Skupiny: HP/AC, půdorys, všech pět rychlostí, smysly, obrany proti zranění,
imunity stavů, CR/XP, identifikátor a edice zdroje. Podle dostupnosti navíc
seznam kouzel, spell DC, zachování textu Multiattack bez násobení každého útoku,
klasifikace legendárních akcí a Recharge. Audit Multiattack nekontroluje
každou alternativu a audit kouzel nekontroluje všechny mechaniky kouzel.

| Netvor | Před | Po |
|---|---:|---:|
| Mage | 7/11 | 11/11 |
| Archmage | 5/11 | 11/11 |
| Adult Red Dragon | 9/13 | 13/13 |
| Ancient Red Dragon | 9/13 | 13/13 |
| Tarrasque | 6/11 | 11/11 |
| Aboleth | 8/10 | 10/10 |
| Balor | 5/9 | 9/9 |
| Pit Fiend | 6/11 | 11/11 |
| Lich | 6/12 | 12/12 |
| Vampire | 8/10 | 10/10 |
| Ghoul | 5/9 | 9/9 |
| Skeleton | 5/8 | 8/8 |
| Ogre | 7/8 | 8/8 |
| Hill Giant | 7/9 | 9/9 |
| Storm Giant | 8/12 | 12/12 |
| Kraken | 6/10 | 10/10 |
| Solar | 6/12 | 12/12 |
| Goblin Warrior | 7/8 | 8/8 |
| Giant Eagle | 7/9 | 9/9 |
| Roper | 7/9 | 9/9 |
| **Celkem** | **134/205** | **205/205** |

Rozsahy a úrovně kouzel pocházejí ze strukturovaných polí katalogu.
Oblast, save, zranění a upcasting se nadále parsují z textu tam, kde katalog
nemá strukturované mechaniky. Složité náhrady útoků zůstávají i v původním
textu Multiattack; nejde o automatické provedení celé sekvence.

`warlock-engine.json` obsahuje vstup postavy a skutečný výstup backendového
`app.charsheet.compute(input)`: Warlock 5 / Wizard 3, samostatný pact pool,
běžné sloty a strukturovaný útok s normálním/dlouhým dosahem. Regrese jsou
v `../combatants.test.ts` a backendovém `tests/test_engine.py`.
