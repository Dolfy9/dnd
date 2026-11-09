"""Hand-authored Czech species descriptions and rules summaries."""

APPEARANCE = {
    "Dwarf": "Robustní humanoidi obvykle vysocí 4–5 stop, se širokými rameny, pevnou stavbou těla a výraznými vousy či copánky.",
    "Dragonborn": "Vysocí humanoidi s dračí hlavou, šupinami, ocasem a drápy; odstín šupin často připomíná jejich dračí původ.",
    "Elf": "Štíhlí humanoidi se špičatýma ušima a jemnými rysy; vzhled se mění podle zvolené elfí linie.",
    "Gnome": "Drobní, živí humanoidi s velkýma očima a sklonem k nápadným účesům i ozdobám.",
    "Tiefling": "Humanoidi poznamenaní pekelným či propastným dědictvím; mohou mít rohy, ocas, neobvyklou barvu kůže nebo oči.",
    "Halfling": "Drobní humanoidi přibližně třístopé výšky, často s kudrnatými vlasy, širokými chodidly a otevřeným výrazem.",
    "Orc": "Svalnatí humanoidi s kly, výrazným obočím a širokou čelistí; tělesná výška i barva kůže se liší.",
    "Goliath": "Velmi vysocí, mohutní humanoidi, často 7–8 stop, s kamenně šedou kůží a tmavými kresbami.",
    "Human": "Lidé mají širokou škálu tělesných proporcí, rysů, barev pleti i kulturního oděvu.",
    "Aasimar": "Člověku podobní lidé s jemným vnitřním světlem, neobvyklýma očima nebo dalšími náznaky nebeského původu.",
    "Hexblood": "Postava s náznaky vílí či čarodějné proměny, například levandulovou pletí a výrůstky připomínajícími kůru či korunu.",
    "Dhampir": "Bledý, ostře řezaný humanoid s tesáky a často zarudlýma očima; vzhled prozrazuje příměs upíří podstaty.",
    "Reborn": "Člověk navrácený z hranice smrti, často s popelavou pletí, jizvami, stehy či jinými stopami svého návratu.",
    "Lupin": "Vzpřímený vlčí humanoid se srstí, čenichem, špičatýma ušima a drápy; proměňuje se jen částečně.",
    "Boggart": "Drobnější, zavalitý goblinoid vysoký přibližně tři stopy, s velkýma ušima, širokým úsměvem a šedozelenou pletí.",
    "Faerie": "Velmi drobný vílí humanoid, zpravidla vysoký kolem jedné stopy, s průsvitnými křídly podobnými křídlům vážky.",
    "Flamekin": "Humanoid tvořený či poznamenaný živým ohněm; mívá uhlově tmavou, popraskanou kůži a plameny místo vlasů.",
    "Kithkin": "Drobní, asi třístopí humanoidi s laskavými rysy; jejich šat zdobí tkané vzory a místní řemeslné motivy.",
    "Lorwyn Changeling": "Fey s modrozelenou kůží, chomáčky vláknité srsti připomínající chapadélka a výraznými žlutými očima se štěrbinovitými zorničkami; napodobeniny tvora či rostliny si zachovávají tyto nápadné znaky.",
    "Lorwyn-Shadowmoor Elf": "Elfové z Lorwynu a Shadowmooru mají černé oči bez zorniček, zahnuté rohy, špičaté uši a nohy zakončené kopyty; jejich vzhled i estetika se mezi oběma rovinami výrazně liší.",
    "Rimekin": "Humanoid se studeně modrou, ledově bledou či krystalickou pletí; jeho vlasy mohou připomínat chladný plamen.",
    "Changeling": "Bledý humanoid s bezbarvýma očima a tváří, která se může měnit spolu s hlasem i tělesnými rysy.",
    "Kalashtar": "Člověku podobný humanoid s klidným výrazem a často jemně zářícíma očima, v nichž se odráží snový původ.",
    "Khoravar": "Člověk s jemně elfími rysy, například lehce špičatýma ušima a půvabnějšími proporcemi.",
    "Shifter": "Humanoid s nápadnými zvířecími znaky, například hustými licousy, tesáky, drápy nebo pronikavým pohledem.",
    "Warforged": "Umělý člověk z nýtovaných kovových plátů, tmavého dřeva a kloubů; oči obvykle žhnou v otvoru tváře.",
    "Duskling": "Humanoid s fialově soumračnou pletí a jemně světélkujícími značkami.",
    "Bariaur": "Beraní či kozoroží lidé s lidským trupem, čtyřnohým spodním tělem a zatočenými rohy.",
    "Aarakocra": "Vzpřímený ptačí humanoid s pery, zobákem, křídly a ostrými pařáty; běžně měří kolem pěti stop.",
    "Air Genasi": "Humanoid s modravou či popelavou pletí, vlasem vlajícím v neviditelném vánku a někdy se světelnými prasklinami.",
    "Bugbear": "Vysoký, dlouhoruký goblinoid s hrubou srstí, klínovitýma ušima a tesáky; umí se skrýt v překvapivě úzkých prostorech.",
    "Centaur": "Humanoidní horní polovina těla vyrůstá z koňského trupu se čtyřmi kopyty.",
    "Deep Gnome": "Drobný svirfneblin s podzemními rysy, tmavou či zemitou pletí a praktickým oděvem bez zbytečných ozdob.",
    "Duergar": "Podsaditý trpaslík s podzemními rysy, často popelavou pletí a strohým, pracovním oděvem.",
    "Earth Genasi": "Humanoid s pletí v odstínech kamene či země, někdy s třpytivými žilkami a vlasy připomínajícími krystal nebo kov.",
    "Eladrin": "Elf z Feywildu, jehož vzhled i nálada se mění s ročním obdobím: podzimní, zimní, jarní či letní.",
    "Fairy": "Drobný vílí humanoid s křídly; tvar a barva křídel i oblečení se výrazně liší.",
    "Firbolg": "Vysoký, mohutný fey humanoid s klidnými rysy a zemitým vzhledem, často spojený s lesem.",
    "Fire Genasi": "Humanoid s pletí od uhlově tmavé po červenou a oranžovou; pod kůží mohou prosvítat žhnoucí praskliny.",
    "Githyanki": "Vysoký a štíhlý humanoid se žlutou, zelenou či hnědou pletí a rysy formovanými astrálním životem.",
    "Githzerai": "Štíhlý humanoid se skvrnitou pletí v odstínech žluté, zelené či hnědé a soustředěným výrazem.",
    "Goblin": "Malý, hbitý goblinoid s velkýma ušima, dlouhými prsty a širokým rozsahem odstínů pleti.",
    "Harengon": "Vzpřímený králičí humanoid s dlouhýma ušima, výraznými chodidly, srstí různých barev a pružnými nohami.",
    "Hobgoblin": "Vysoký, pevně stavěný goblinoid s přísnými rysy a důrazem na výstroj, řád či sounáležitost.",
    "Kenku": "Ptačí humanoid s peřím, zobákem a černými či hnědými pery; jeho gesta často nahrazují hlas.",
    "Kobold": "Drobný šupinatý humanoid s dlouhým ocasem, výraznými ušima a dračím profilem.",
    "Lizardfolk": "Plazí humanoid se šupinami, ocasem, širokým čenichem a drápy.",
    "Minotaur": "Mohutný humanoid s býčí hlavou, širokými rameny a rohy, které může používat v boji.",
    "Satyr": "Veselý či divoký fey s lidským trupem, kozlíma nohama, kopyty a rohy.",
    "Sea Elf": "Elf přizpůsobený životu ve vodě, s plovacími blánami či žábrami a barvami připomínajícími moře.",
    "Shadar-kai": "Elf spojený s říší stínů; jeho bledý vzhled, tmavý oděv a tlumená mimika připomínají Raven Queen.",
    "Tabaxi": "Kočkovitý humanoid se srstí, vousky, ocasem a pohyby velké šelmy.",
    "Tortle": "Želví humanoid s krunýřem, zobákovitými rysy, drápy a pevnými končetinami.",
    "Triton": "Vodní humanoid s plovacími blánami či žábrami a rysy připomínajícími mořské tvory.",
    "Water Genasi": "Humanoid s vodními rysy, například vlasy jako proud či vodní hladina a pletí v odstínech moře.",
    "Yuan-ti": "Humanoid s hadími znaky, například rozeklaným jazykem, svislými zorničkami či jemnými šupinami.",
    "Astral Elf": "Elf s hvězdnými či kosmickými znaky, například světélkujícími pihami a vlasy připomínajícími noční oblohu.",
    "Autognome": "Malý mechanický gnóm s pohyblivými klouby, kovovým pláštěm a účelovými nástroji.",
    "Giff": "Mohutný humanoid s hlavou hrocha, silnou postavou a vojenskými či námořnickými doplňky.",
    "Hadozee": "Pohyblivý humanoid s opičí tváří, dlouhými končetinami a kožními blánami mezi pažemi a trupem.",
    "Plasmoid": "Pružná průsvitná masa, která si vytváří humanoidní obrys a může se zploštit či protáhnout.",
    "Thri-kreen": "Hmyzí humanoid s chitinovým krunýřem, tykadly a druhým párem menších paží.",
    "Kender": "Drobný humanoid s dětským, zvědavým výrazem, dlouhými prsty a praktickým cestovním oděvem.",
    "Owlin": "Soví humanoid s peřím, velkýma očima, křídly a tichým letem.",
    "Loxodon": "Mohutný humanoid se sloní hlavou, chobotem, klovci a silnou kůží.",
    "Simic Hybrid": "Humanoid pozměněný biologickými úpravami; zvolená adaptace může přidat žaberní, krunýřové či chapadlovité znaky.",
    "Vedalken": "Vysocí, štíhlí humanoidi s modrými odstíny pleti, hladkou hlavou a soustředěným výrazem.",
    "Leonin": "Lví humanoid s hřívou, drápy, ocasem a svalnatou postavou.",
    "Locathah": "Ryboidní humanoid s ploutvemi, šupinami, žábrami a tělem uzpůsobeným vodě.",
    "Verdan": "Proměnlivý goblinoid s neobvykle zelenou pletí a rysy, které se mohou měnit s věkem.",
    "Grung": "Drobný žabí humanoid s vlhkou barevnou kůží a dlouhými prsty.",
    "Half-Elf": "Člověk s rozmanitými rysy, v nichž se mísí lidská podoba s jemně elfími znaky.",
    "Half-Orc": "Mohutný humanoid s lidskými i orčími rysy, často s výraznými kly a pevnou stavbou těla.",
}

CULTURE = {
    "Dwarf": "Trpasličí společnosti často kladou důraz na řemeslo, rodové závazky a paměť předků; jednotlivé klany se však liší.",
    "Dragonborn": "Dračí původ může ovlivňovat rodinné dějiny i symboliku, ale neurčuje povahu ani morální přesvědčení jednotlivce.",
    "Elf": "Elfí tradice se liší podle linie a světa; dlouhý život často podporuje hluboké vztahy k paměti, umění a přírodě.",
    "Gnome": "Gnómové jsou různorodí, od lesních komunit po řemeslné a technické kruhy; zvědavost je častým, nikoli povinným rysem.",
    "Tiefling": "Pekelné dědictví samo neurčuje charakter; někteří tieflingové se hlásí k rodovým tradicím, jiní k žádným.",
    "Halfling": "Halflingské komunity bývají různorodé a mohou si cenit pohostinnosti, rodiny či cestování, aniž by to platilo pro každého.",
    "Orc": "Orčí kultury jsou mnohotvárné; žádný původ neurčuje, zda je postava mírumilovná, válečnická nebo součástí konkrétního klanu.",
    "Goliath": "Goliathové mívají soutěživé či rodové tradice, ale jednotlivci si mohou zvolit vlastní cestu.",
    "Human": "Lidské zvyky závisí na konkrétní společnosti, jazyku a dějinách; druh sám neurčuje žádnou jednotnou kulturu.",
    "Aasimar": "Nebeský původ neukládá postavě poslání ani víru; vztah k němu se liší od zbožnosti po odmítání.",
    "Hexblood": "Hexbloodové mohou vzniknout různými způsoby a nemají jednotnou společnost; jejich původ bývá osobní a často znepokojivý.",
    "Dhampir": "Dhampir může být potomkem upíra, obětí nedokončené proměny či výsledkem magie; jeho hlad a vztah k původu jsou individuální.",
    "Reborn": "Rebornové pocházejí z různých návratů ze smrti; vzpomínky, tělo i vztahy k minulému životu se mezi nimi liší.",
    "Lupin": "Lupin si zachovává vlastní vůli navzdory vlčí proměně; společenské přijetí závisí na komunitě, která jej potká.",
    "Boggart": "Boggartské tradice se mohou lišit podle světa; původ z Feywildu nevylučuje vlastní hodnoty a společenství.",
    "Faerie": "Vílí společnosti bývají svázané s Feywildem a jeho proměnlivými pravidly, ale neexistuje jediná povaha všech fae.",
    "Flamekin": "Flamekin může chápat oheň jako rodový dar, prostředí či součást těla; konkrétní zvyky nejsou jednotné.",
    "Kithkin": "Kithkin často vytvářejí těsné komunity založené na vzájemné důvěře; místní tradice se však liší.",
    "Lorwyn Changeling": "Oficiální popis uvádí jejich schopnost hrubě napodobovat tvory a rostliny; konkrétní sídla a kulturní zvyky nejsou ověřeny.",
    "Lorwyn-Shadowmoor Elf": "Elfové chrání krásu, ačkoli její podobu chápou různě. Lorwyn a Shadowmoor mají odlišné prostředí i estetiku; volba linie určuje jejich kouzla a některé smyslové schopnosti.",
    "Rimekin": "Rimekinové mohou své chladné plameny a ledové znaky chápat jako původní dar či součást rodové identity.",
    "Changeling": "Changelingská identita i způsob užívání proměnlivé podoby se liší; změna tváře není sama o sobě klam ani zločin.",
    "Kalashtar": "Kalashtarové jsou spojeni se snovým dědictvím quori; jejich vztah k telepatii a duchovnímu odkazu je individuální.",
    "Khoravar": "Khoravarové mají lidsko-elfí původ, ale jejich vlastní komunity a zvyky se utvářejí podle místa života.",
    "Shifter": "Shifteři vnímají zvířecí dědictví různě; některé komunity zdůrazňují rodové linie, jiné osobní volbu.",
    "Warforged": "Warforgedové si často hledají vlastní účel a společnost po probuzení; jejich minulost může být vojenská i civilní.",
    "Duskling": "Dusklingové jsou spojováni se soumračnou magií; jejich společenské zvyky a domovina nejsou pro všechny stejné.",
    "Bariaur": "Bariaurové mohou žít jako kočovníci či usedlí obyvatelé; jejich původ ani tělo neurčuje jednu společenskou roli.",
    "Aarakocra": "Aarakocra často vnímají vítr a otevřené nebe jako přirozenou součást života; jejich původ se pojí s Elementální rovinou Vzduchu.",
    "Air Genasi": "Genasi jsou spojeni s jedním elementem; vzdušní genasi mohou pocházet z džinů nebo z míst prostoupených jejich magií.",
    "Bugbear": "Bugbearové mají fey kořeny a někdy goblinoidní rodové vazby; jednotlivci se mohou odklonit od válečných tradic.",
    "Centaur": "Kentauři z tohoto pravidlového záznamu pocházejí z Feywildu a bývají spojeni s přírodou a zvířaty.",
    "Deep Gnome": "Svirfneblinové se přizpůsobili nebezpečí Underdarku, kde jim nenápadnost a magie pomáhají přežít.",
    "Duergar": "Duergarové jsou trpaslíci změnění životem v Underdarku a dějinami zotročení; jejich dnešní společnosti nejsou jednotné.",
    "Earth Genasi": "Zemní genasi dědí elementální spojení s dao; často se cítí blízko kameni a zemským silám.",
    "Eladrin": "Eladrinové pocházejí z Feywildu a jejich podoba i nálada mohou rezonovat s jedním ze čtyř ročních období.",
    "Fairy": "Vílí lidé z Feywildu se mohou řídit místními dvory, svobodnými cestami či vlastními pravidly.",
    "Firbolg": "Firbolgové bývají spojováni s lesy a fey magií; jejich vztah k samotě či ochraně přírody se liší.",
    "Fire Genasi": "Ohniví genasi mají spojení s efreety a silami Elementální roviny Ohně.",
    "Githyanki": "Githyanki unikli nadvládě mind flayerů a jejich dějiny se pojí s Astrální rovinou.",
    "Githzerai": "Githzerai hledali řád mysli v proměnlivém Limbu a jejich tradice často zdůrazňují kázeň.",
    "Goblin": "Goblini mají fey kořeny i dějiny pod vládou Maglubiyeta; mnozí dnes hledají vlastní osud.",
    "Harengon": "Harengoni pocházejí z Feywildu a často si nesou jeho energii, ale žádná osobnostní vlastnost není povinná.",
    "Hobgoblin": "Hobgoblini mají vojenské i fey kořeny; některá společenství cení disciplínu a vzájemné závazky.",
    "Kenku": "Kenku jsou rozptýlení po mnoha světech a mohou být součástí městských, cestovatelských i ptačích společenství.",
    "Kobold": "Koboldské rody často uctívají či napodobují draky, ale jejich vztah k drakonickému dědictví je různý.",
    "Lizardfolk": "Lizardfolkové jsou prakticky založení, ale jejich místní hodnoty a způsob života se mění podle prostředí.",
    "Minotaur": "Minotauři mohou čerpat z fey, městských či námořních tradic; jejich původ neurčuje povahu.",
    "Satyr": "Satyrové bývají spojeni s Feywildem, hudbou a slavnostmi, ale jde o možnosti, nikoli povinný temperament.",
    "Sea Elf": "Mořští elfové jsou přizpůsobeni životu pod hladinou a často mají vztahy s mořskými tvory.",
    "Shadar-kai": "Shadar-kai jsou spojeni se Shadowfellem a Raven Queen; ne každý však sdílí její cíle či víru.",
    "Tabaxi": "Tabaxi se mohou vydávat na cesty za příběhy, poklady či poznáním, ale jejich motivace je osobní.",
    "Tortle": "Tortlové jsou schopni žít na souši i ve vodě; jejich rodiny mohou být kočovné i usedlé.",
    "Triton": "Tritoni střeží či obývají podmořské oblasti, ale jejich vztahy k povrchu se liší.",
    "Water Genasi": "Vodní genasi jsou spjati s maridy či místy přesycenými vodní magií.",
    "Yuan-ti": "Yuan-ti mají lidské i hadí předky; magické dědictví může vést k různým podobám a přesvědčením.",
    "Astral Elf": "Astrální elfové se přizpůsobili cestám mezi světy a jejich kultura může být kosmopolitní.",
    "Autognome": "Autognom může být vytvořen pro konkrétní úkol, ale může si zvolit i vlastní identitu a cíle.",
    "Giff": "Giffové často navazují na vojenské, žoldnéřské či námořní tradice; řád a výstroj jsou časté motivy.",
    "Hadozee": "Hadozee jsou obratní cestovatelé a námořníci, kteří dokáží využít klouzání mezi místy.",
    "Plasmoid": "Plasmoidi mohou přijímat rozmanité tvary a často hledají společnost, která jejich neobvyklé tělo přijme.",
    "Thri-kreen": "Thri-kreen žijí v různých prostředích a komunikují způsobem odlišným od běžné řeči.",
    "Kender": "Kenderové jsou zvědaví cestovatelé, jejichž odvaha a zvyk klást otázky mohou vést k potížím i přátelstvím.",
    "Owlin": "Owlinové jsou soví lidé s tichým letem; někteří studují, jiní se vydávají do světa.",
    "Loxodon": "Loxodonové často oceňují trpělivost a soudržnost, ale jejich povaha i povolání se různí.",
    "Simic Hybrid": "Simic Hybrids byli magicky či biologicky upraveni; konkrétní úpravy určuje jejich zvolená adaptace.",
    "Vedalken": "Vedalkenové bývají známí analytickým přístupem a hledáním dokonalosti, aniž by to platilo pro každého.",
    "Leonin": "Leoninové mohou tvořit hrdé rodové skupiny a žít podle vlastních představ o cti a svobodě.",
    "Locathah": "Locathahové potřebují pravidelný kontakt s vodou; jejich společnost je přizpůsobena vodním sídlům.",
    "Verdan": "Verdanové jsou nově vzniklý goblinoidní národ; jejich tělesné proměny mohou pokračovat s věkem.",
    "Grung": "Grungové žijí ve vlhkém prostředí a jejich jedovatá kůže ovlivňuje každodenní kontakt s ostatními.",
    "Half-Elf": "Původ a identita půlelfů se liší; někteří vyrůstají v lidských, jiní v elfích či smíšených komunitách.",
    "Half-Orc": "Půlorkové mohou vyrůstat v lidských, orčích či smíšených komunitách; původ neurčuje jejich povahu.",
}

TRAIT_DETAILS = {
    "Dwarf": {
        "Darkvision": "V šeru vidíš do 120 stop jako za jasného světla a ve tmě jako v šeru; v úplné tmě rozeznáváš jen odstíny šedi.",
        "Dwarven Resilience": "Máš Resistance vůči Poison damage a Advantage na záchranné hody, kterými se vyhýbáš stavu Poisoned nebo jej ukončuješ.",
        "Dwarven Toughness": "Maximum Hit Points se zvýší o 1 a při každé další získané úrovni se znovu zvýší o 1.",
        "Stonecunning": "Bonus Action ti na 10 minut poskytne Tremorsense 60 stop, pokud stojíš na kameni nebo se ho dotýkáš. Použití máš tolik, kolik činí Proficiency Bonus, a všechna se obnoví po Long Rest.",
    },
    "Dragonborn": {
        "Draconic Ancestry": "Vyber jednu z deseti dračích linií v tabulce Volby. Tato volba určuje typ zranění Breath Weapon a Damage Resistance a také vzhledové motivy.",
        "Breath Weapon": "Při Attack action můžeš nahradit jeden útok výdechem v kuželu 15 stop nebo linii 30 × 5 stop. Cíle hází Dexterity save proti DC 8 + Constitution modifier + Proficiency Bonus; při neúspěchu utrpí 1d10 zranění zvolené linie, při úspěchu polovinu. Kostky rostou na 2d10 na 5. úrovni, 3d10 na 11. a 4d10 na 17. Použití se rovná Proficiency Bonus a obnoví se po Long Rest.",
        "Damage Resistance": "Získáš Resistance vůči typu zranění zvolenému u Draconic Ancestry.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Draconic Flight": "Od 5. úrovně můžeš Bonus Action vyvolat spektrální křídla na 10 minut a získat Flying Speed rovnou své Speed. Křídla zmizí dříve, pokud jsi Incapacitated nebo je odvoláš; po použití je znovu získáš po Long Rest.",
    },
    "Elf": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Elven Lineage": "Vyber Drow, High Elf nebo Wood Elf. Každá linie poskytuje své kouzlo či kouzla na určených úrovních; bez slotu lze dané kouzlo seslat jednou a použití se obnoví po Long Rest. K sesílání zvol Intelligence, Wisdom nebo Charisma; kouzla lze sesílat i příslušnými spell slots.",
        "Fey Ancestry": "Máš Advantage na záchranné hody proti stavu Charmed.",
        "Keen Senses": "Získáš Proficiency v jedné z dovedností Insight, Perception nebo Survival.",
        "Trance": "Nepotřebuješ spát a magie tě nemůže uspat; Long Rest dokončíš po 4 hodinách meditace v bdělém transu. Po transu můžeš změnit elfí linii a do dalšího Long Rest získat dvě zdatnosti se zbraní či nástrojem.",
    },
    "Gnome": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Gnomish Cunning": "Máš Advantage na Intelligence, Wisdom a Charisma saving throws.",
        "Gnomish Lineage": "Vyber Forest Gnome nebo Rock Gnome; každá linie přidává příslušné schopnosti uvedené níže.",
        "Forest Gnome": "Znáš Minor Illusion a vždy máš připravené Speak with Animals. Speak with Animals můžeš bez spell slotu seslat tolikrát za Long Rest, kolik činí Proficiency Bonus; lze jej seslat i dostupnými sloty.",
        "Rock Gnome": "Znáš Mending a Prestidigitation. Když 10 minut sesíláš Prestidigitation, vytvoříš Tiny clockwork device (AC 5, 1 HP) s jedním zvoleným efektem tohoto cantripu; aktivuje se dotykem a Bonus Action. Současně mohou existovat nejvýše tři zařízení; každé se rozpadne po 8 hodinách nebo jej můžeš dotykem rozebrat akcí Utilize.",
    },
    "Tiefling": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fiendish Legacy": "Vyber Abyssal, Chthonic nebo Infernal dědictví. Volba určuje odolnost, počáteční cantrip a kouzla, která získáš na 3. a 5. úrovni; tato kouzla máš vždy připravená. Každé můžeš jednou seslat bez slotu po Long Rest i pomocí spell slots; zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
        "Otherworldly Presence": "Znáš Thaumaturgy; při seslání tímto traitem použiješ stejnou spellcasting ability jako pro Fiendish Legacy.",
    },
    "Halfling": {
        "Brave": "Máš Advantage na záchranné hody, kterými se vyhýbáš stavu Frightened nebo jej ukončuješ.",
        "Halfling Nimbleness": "Můžeš projít prostorem každého tvora, který je alespoň o jednu velikost větší než ty, ale nemůžeš v něm ukončit pohyb.",
        "Luck": "Když na D20 Testu padne 1, můžeš kostku znovu hodit; nový výsledek musíš použít.",
        "Naturally Stealthy": "Můžeš se pokusit Hide, i když jsi zakrytý pouze tvorem, který je alespoň o jednu velikost větší než ty.",
    },
    "Orc": {
        "Adrenaline Rush": "Bonus Action použij k Dash a získej Temporary Hit Points v počtu rovném Proficiency Bonus. Použití máš tolik, kolik činí Proficiency Bonus; obnoví se po Short nebo Long Rest.",
        "Darkvision": "V šeru vidíš do 120 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Relentless Endurance": "Když bys klesl na 0 Hit Points, ale nejsi okamžitě zabit, místo toho zůstaneš na 1 Hit Point. Použití se obnoví po Long Rest.",
    },
    "Goliath": {
        "Giant Ancestry": "Vyber Cloud, Fire, Frost, Hill, Stone nebo Storm Giant ancestry. Účinek své volby můžeš použít tolikrát, kolik činí Proficiency Bonus; použití obnovíš po Long Rest. Přesné dosahy, kostky a záchranné hody jsou v tabulce Volby.",
        "Large Form": "Od 5. úrovně můžeš Bonus Actionem změnit svou velikost na Large, pokud máš dost místa. Na 10 minut získáš Advantage na Strength checks a Speed se zvýší o 10 stop; můžeš účinek ukončit bez akce. Použití se obnoví po Long Rest.",
        "Powerful Build": "Máš Advantage na ability checks k ukončení stavu Grappled. Pro určení nosnosti se počítáš jako o jednu velikost větší.",
    },
    "Human": {
        "Resourceful": "Po dokončení Long Rest získáš Heroic Inspiration.",
        "Skillful": "Získáš Proficiency v jedné dovednosti dle svého výběru.",
        "Versatile": "Získáš jeden Origin feat dle svého výběru.",
    },
    "Aasimar": {
        "Celestial Resistance": "Máš Resistance vůči Necrotic a Radiant damage.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Healing Hands": "Magic actionem se dotkneš tvora a hodíš tolika d4, kolik činí tvůj Proficiency Bonus; cíl obnoví Hit Points rovné součtu. Použití se obnoví po Long Rest.",
        "Light Bearer": "Znáš Light; Charisma je tvoje spellcasting ability pro toto kouzlo.",
        "Celestial Revelation": "Od 3. úrovně můžeš Bonus Actionem na 1 minutu projevit jednu nebeskou podobu: Heavenly Wings, Inner Radiance nebo Necrotic Shroud. Jednou v každém svém tahu, než proměna skončí, přidáš při zásahu útokem či kouzlem jednomu cíli extra damage rovné Proficiency Bonus; typ určuje podoba. Použití se obnoví po Long Rest.",
        "Heavenly Wings": "Po aktivaci Celestial Revelation získáš na 1 minutu Flying Speed rovnou své Speed.",
        "Inner Radiance": "Po aktivaci záříš jasným světlem v okruhu 10 stop a tlumeným dalších 10 stop; na konci každého svého tahu utrpí každý tvor, který je do 10 stop, Radiant damage rovné Proficiency Bonus.",
        "Necrotic Shroud": "Po aktivaci tvorové kromě tvých spojenců do 10 stop hází Charisma save proti DC 8 + Charisma modifier + Proficiency Bonus, jinak jsou do konce tvého dalšího tahu Frightened. Během trvání se přidané poškození z Celestial Revelation mění na Necrotic.",
    },
    "Hexblood": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Eerie Token": "Bonus Action vytvoříš magický token například neškodným odebráním vlasu či nehtu. Token trvá do dokončení Long Rest a v jednu chvíli můžeš mít jen jeden; po vytvoření jej znovu vytvoříš až po dokončení Long Rest.",
        "Distant Message": "Jsi-li do 10 mil od tokenu a jiná bytost jej drží nebo nese, můžeš pomocí Magic action poslat jí telepatickou zprávu o nejvýše 25 slovech.",
        "Remote Viewing": "Jsi-li do 10 mil od tokenu, můžeš pomocí Magic action na 1 minutu vidět a slyšet, jako bys byl v jeho místě. Účinek skončí při získání stavu Incapacitated, po minutě nebo když jej ukončíš bez akce; potom se token neškodně zničí.",
        "Hex Magic": "Vždy máš připravená Disguise Self a Hex. Každé můžeš jednou seslat bez slotu; obě bezplatná seslání se obnoví po Long Rest. Lze je sesílat i spell slots a zvolíš Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
    },
    "Dhampir": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Spider Climb": "Máš Climb Speed rovnou své Speed. Od 3. úrovně můžeš lézt po svislých plochách i stropech a při tom mít ruce volné.",
        "Trace of Undeath": "Máš Resistance vůči Necrotic damage.",
        "Vampiric Bite": "Když použiješ Unarmed Strike a způsobíš damage, můžeš místo běžného účinku kousnout tesáky a způsobit Piercing damage 1d4 + Constitution modifier. Pokud cíl není Construct ani Undead, můžeš utratit jedno z použití Vampiric Bite (počet odpovídá Proficiency Bonus, obnoví se po Long Rest) a zvolit Drain (získáš Hit Points rovné způsobenému Piercing damage) nebo Strengthen (na 1 minutu přičteš stejnou hodnotu k jednomu následujícímu ability checku či attack rollu).",
    },
    "Reborn": {
        "Escaped Death": "Máš Advantage na Death Saving Throws.",
        "Everlasting": "Nezískáváš Exhaustion levels z dehydratace, podvýživy ani dušení. Nepotřebuješ spát a magie tě nemůže uspat. Long Rest můžeš dokončit za 4 hodiny, pokud celou dobu zůstaneš neaktivní a nehybný; i tehdy si zachováváš vědomí.",
        "Knowledge from a Past Life": "Získáš Proficiency v jedné dovednosti podle svého výběru. Když neuspěješ na ability checku, můžeš hodit 1d6 a přičíst výsledek k hodu d20, čímž můžeš neúspěch změnit v úspěch. Použití odpovídají Proficiency Bonus a obnovují se po Long Rest.",
        "Strange Endurance": "Vyber Cold, Necrotic nebo Poison damage; máš vůči němu Resistance.",
    },
    "Lupin": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Feral Pounce": "Tvé Unarmed Strikes způsobují Slashing místo Bludgeoning damage. Když během svého tahu zasáhneš tvora Unarmed Strike jako součást Attack action, můžeš jednou za tah u tohoto zásahu použít současně Damage i Shove option.",
        "Howl": "Jako Bonus Action vydáš zlověstné zavytí. Každý tvor podle tvého výběru v okruhu 15 stop musí uspět ve Wisdom saving throw proti DC 8 + Constitution modifier + Proficiency Bonus, jinak má Disadvantage na attack rolls a saving throws do začátku tvého příštího tahu. Počet použití odpovídá Proficiency Bonus a obnoví se po Long Rest.",
        "Werewolf Instincts": "Získáš Proficiency v jedné dovednosti z nabídky Perception, Stealth nebo Survival.",
    },
    "Boggart": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na záchranné hody proti stavu Charmed.",
        "Fury of the Small": "Když útokem či kouzlem zraníš tvora většího než ty, můžeš přidat damage rovný Proficiency Bonus. Použití máš tolik, kolik činí Proficiency Bonus, obnoví se po Long Rest a lze jej použít nejvýše jednou za tah.",
        "Nimble Escape": "V každém svém tahu můžeš jako Bonus Action použít Disengage nebo Hide.",
    },
    "Faerie": {
        "Faerie Magic": "Znáš Druidcraft. Od 3. úrovně můžeš jednou po Long Rest seslat Faerie Fire a od 5. úrovně Enlarge/Reduce; každé lze také seslat příslušným spell slotem. Vyber Intelligence, Wisdom nebo Charisma pro spellcasting ability.",
        "Flight": "Máš Flying Speed rovnou své Speed; tuto rychlost nemůžeš použít, pokud máš na sobě Medium nebo Heavy armor.",
    },
    "Flamekin": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fire Resistance": "Máš Resistance vůči Fire damage.",
        "Reach to the Blaze": "Znáš Produce Flame. Od 3. úrovně můžeš jednou po Long Rest seslat Burning Hands a od 5. úrovně Flame Blade; lze je seslat také příslušnými spell slots. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
    },
    "Kithkin": {
        "Brave": "Máš Advantage na záchranné hody, kterými se vyhýbáš stavu Frightened nebo jej ukončuješ.",
        "Kithkin Nimbleness": "Můžeš projít prostorem každého tvora alespoň o jednu velikost většího než ty, ale nemůžeš v něm ukončit pohyb.",
        "Luck": "Když na D20 Testu padne 1, můžeš kostku znovu hodit; nový výsledek musíš použít.",
        "Naturally Stealthy": "Můžeš se pokusit Hide, i když jsi zakrytý pouze tvorem, který je alespoň o jednu velikost větší než ty.",
        "Kithkin Lineage": "Vyber Lorwyn nebo Shadowmoor původ: Lorwyn nepřidává další trait, Shadowmoor zvyšuje dosah Darkvision na 120 stop.",
    },
    "Lorwyn Changeling": {
        "Shape Self": "Actionem přetvoříš tělo do dvounohé Humanoid podoby nebo čtyřnohé Beast podoby. V Humanoid podobě můžeš nosit oblečení a armor určený pro Humanoid tvé velikosti; schopnost sama neposkytuje přestrojení ani změnu statistik.",
        "Darkvision": "V šeru vidíš do 120 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Delightful Imitator": "Získáš Proficiency v Deception nebo Performance.",
        "Unpredictable Movement": "Když hodíš Initiative a na hodě nemáš Disadvantage, můžeš hned urazit vzdálenost až poloviny své Speed.",
    },
    "Lorwyn-Shadowmoor Elf": {
        "Darkvision": "V šeru vidíš do 60 stop; Shadowmoor lineage zvyšuje dosah na 120 stop. V úplné tmě rozeznáváš jen odstíny šedi.",
        "Elven Lineage": "Vyber Lorwyn Elf nebo Shadowmoor Elf. Linie určuje cantrip a kouzla na 3. a 5. úrovni; vždy je máš připravená, každé můžeš jednou seslat bez slotu po Long Rest a také pomocí příslušných spell slots. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
        "Fey Ancestry": "Máš Advantage na záchranné hody proti stavu Charmed.",
        "Keen Senses": "Získáš Proficiency v Insight, Perception nebo Survival.",
        "Trance": "Nepotřebuješ spát a magie tě nemůže uspat; Long Rest dokončíš po 4 hodinách transu. Po transu si můžeš osvojit dvě zdatnosti se zbraní či nástrojem do příštího Long Rest.",
    },
    "Rimekin": {
        "Cold Fire Magic": "Znáš Ray of Frost. Od 3. úrovně získáš Ice Knife a od 5. úrovně Flame Blade; každé lze jednou po Long Rest seslat bez slotu i pomocí slotů. Flame Blade tohoto rimekina způsobuje Cold místo Fire damage; vyber spellcasting ability z Intelligence, Wisdom nebo Charisma.",
        "Cold Resistance": "Máš Resistance vůči Cold damage.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
    },
    "Changeling": {
        "Changeling Instincts": "Získáš Proficiency ve dvou dovednostech z Deception, Insight, Intimidation, Performance nebo Persuasion.",
        "Shape-Shifter": "Actionem změníš vzhled i hlas; můžeš napodobit jiné druhy a měnit viditelné znaky, ale ne vlastnosti, oblečení ani statistiky. Podoba trvá, dokud ji nezměníš znovu nebo nezemřeš. Během změněné podoby máš Advantage na Charisma checks.",
    },
    "Kalashtar": {
        "Dual Mind": "Máš Advantage na Wisdom a Charisma saving throws.",
        "Mental Discipline": "Máš Resistance vůči Psychic damage.",
        "Mind Link": "Telepaticky komunikuješ s tvorem ve vzdálenosti nejvýše 10 stop za každou svou úroveň. Magic actionem můžeš jednomu či více tvorům umožnit telepaticky ti odpovídat po dobu 1 hodiny; účinek skončí také, když jej ukončíš dalším Magic actionem. Cíl musí rozumět alespoň jednomu jazyku, ale nemusí být ve tvém zorném poli.",
        "Severed from Dreams": "Nemůžeš být cílem kouzla Dream. Po Long Rest získáš Proficiency v jedné zvolené dovednosti do konce dalšího Long Rest.",
    },
    "Khoravar": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na záchranné hody proti stavu Charmed.",
        "Fey Gift": "Znáš Friends. Po Long Rest můžeš toto kouzlo vyměnit za cantrip z nabídky Cleric, Druid nebo Wizard.",
        "Lethargy Resilience": "Když neuspěješ v saving throw, který by ti zabránil získat nebo ukončil stav Unconscious, můžeš místo neúspěchu uspět. Po použití obnovíš schopnost po dokončení 1d4 Long Restů.",
        "Skill Versatility": "Získáš Proficiency v jedné dovednosti nebo nástroji; po Long Rest ji můžeš vyměnit za jinou povolenou volbu.",
    },
    "Shifter": {
        "Bestial Instincts": "Získáš Proficiency v jedné z dovedností Acrobatics, Athletics, Intimidation nebo Survival.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Shifting": "Bonus Actionem přijmeš na 1 minutu zvířecí rysy (nebo se můžeš dříve vrátit další Bonus Action); získáš Temporary Hit Points ve výši dvojnásobku Proficiency Bonus. Použít můžeš tolikrát, kolik činí Proficiency Bonus, a vše obnovíš po Long Rest. Zvolená podoba přidá účinek uvedený v tabulce Volby.",
    },
    "Warforged": {
        "Constructed Resilience": "Máš Advantage na saving throws k ukončení stavu Poisoned; tento trait ti nedává Resistance vůči Poison damage.",
        "Integrated Protection": "Získáš +1 k AC. Zbroj, s níž jsi proficient, můžeš integrovat do těla; její nasazení už netrvá hodinu a proti tvé vůli ji nelze sundat.",
        "Sentry's Rest": "Nepotřebuješ spánek a magie tě nemůže uspat. Při Long Restu strávíš 6 hodin nehybným, neaktivním odpočinkem, během něhož zůstáváš vědomý a vnímáš okolí.",
        "Tireless": "Nemůžeš získat Exhaustion kvůli dehydrataci, podvýživě ani dušení.",
    },
    "Duskling": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Enhanced Jump": "Při skoku po rozběhu zvýšíš dosah skoku do výšky o 2 stopy a do dálky o 10 stop.",
        "Inner Magic": "Po Long Rest zvolíš Ardor, Mobility nebo Vigor; účinek trvá, dokud si nevybereš jiný. Bonus Actionem můžeš změnit volbu tolikrát, kolik činí Proficiency Bonus; použití obnovíš po Long Rest. Ardor dává Advantage na Charisma ability checks a na saving throws, kterými se vyhýbáš stavu Frightened nebo jej ukončuješ; Mobility zvyšuje Speed o 10 stop a lezení ani plavání nestojí pohyb navíc; Vigor dává Temporary Hit Points rovné Proficiency Bonus a Advantage na Strength (Athletics) a Dexterity (Acrobatics) checks.",
    },
    "Bariaur": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Ram": "Po přímém pohybu alespoň 10 stop můžeš při zásahu Unarmed Strike způsobit zranění a současně cíl odtlačit; velikost cíle a přesný dosah odtlačení: neověřeno.",
        "Stable Stance": "Máš Advantage na saving throws a ability checks, které by tě srazily do stavu Prone.",
        "Wanderer’s Instincts": "Získáš Proficiency v jedné dovednosti z nabídky Animal Handling, Arcana, Nature nebo Survival.",
    },
    "Aarakocra": {
        "Flight": "Máš Flying Speed rovnou své walking Speed; létat nemůžeš v Medium ani Heavy armor.",
        "Talons": "Talonami můžeš provádět Unarmed Strike; zásah způsobí Slashing damage 1d6 + Strength modifier místo běžného Bludgeoning damage.",
        "Wind Caller": "Od 3. úrovně můžeš seslat Gust of Wind bez material component jednou po Long Rest, nebo pomocí spell slotu 2. úrovně či vyšší. Zvol Intelligence, Wisdom nebo Charisma pro spellcasting ability.",
    },
    "Air Genasi": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Unending Breath": "Dokud nejsi Incapacitated, můžeš zadržovat dech bez časového omezení.",
        "Mingle with Wind": "Znáš Shocking Grasp. Od 3. úrovně můžeš jednou po Long Rest seslat Feather Fall, od 5. úrovně Levitate; žádné z těchto seslání nevyžaduje material component a obě kouzla můžeš seslat i spell slotem odpovídající úrovně. Zvol spellcasting ability z Intelligence, Wisdom nebo Charisma.",
        "Lightning Resistance": "Máš Resistance vůči Lightning damage.",
    },
    "Bugbear": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na záchranné hody proti stavu Charmed.",
        "Long-Limbed": "Během svého tahu máš při melee attacku dosah o 5 stop větší než obvykle.",
        "Powerful Build": "Pro nosnost a hmotnost, kterou můžeš tlačit, táhnout či zvedat, se počítáš jako o jednu velikost větší.",
        "Sneaky": "Získáš Proficiency ve Stealth a můžeš se pohybovat i zastavit v prostoru pro Small creature bez nutnosti Squeezing.",
        "Surprise Attack": "Když zasáhneš attack roll tvor, který ještě v tomto boji neodehrál svůj tah, přidáš k zásahu 2d6 damage.",
    },
    "Centaur": {
        "Charge": "Když se v tahu pohneš alespoň 30 stop přímo k cíli a zasáhneš jej melee weapon attackem, můžeš ihned Bonus Actionem zaútočit kopytem na tentýž cíl.",
        "Equine Build": "Pro nosnost a tlačení či tažení se počítáš jako o jednu velikost větší. Při lezení, které vyžaduje ruce i nohy, stojí každý foot pohybu 4 extra feet navíc.",
        "Hooves": "Kopytem můžeš provádět Unarmed Strike, který způsobí Bludgeoning damage 1d6 + Strength modifier místo běžného poškození.",
        "Natural Affinity": "Získáš Proficiency v jedné dovednosti dle výběru: Animal Handling, Medicine, Nature nebo Survival.",
    },
    "Deep Gnome": {
        "Darkvision": "V šeru vidíš do 120 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Gnomish Magic Resistance": "Máš Advantage na Intelligence, Wisdom a Charisma saving throws proti kouzlům.",
        "Gift of the Svirfneblin": "Od 3. úrovně můžeš seslat Disguise Self a od 5. úrovně Nondetection bez material component; každé kouzlo jednou po Long Rest, případně pomocí slotu odpovídající úrovně. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
        "Svirfneblin Camouflage": "Při Dexterity (Stealth) checku můžeš využít Advantage. Počet použití odpovídá Proficiency Bonus a vše se obnoví po Long Rest.",
    },
    "Duergar": {
        "Darkvision": "V šeru vidíš do 120 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Dwarven Resilience": "Máš Advantage na záchranné hody k vyhnutí se stavu Poisoned nebo jeho ukončení a Resistance vůči Poison damage.",
        "Duergar Magic": "Od 3. úrovně můžeš jednou po Long Rest seslat Enlarge/Reduce pouze na sebe; od 5. úrovně také Invisibility pouze na sebe. Obě kouzla nevyžadují material component a lze je seslat i odpovídajícím spell slotem; zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
        "Psionic Fortitude": "Máš Advantage na záchranné hody k vyhnutí se stavům Charmed a Stunned nebo jejich ukončení.",
    },
    "Earth Genasi": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Earth Walk": "Při chůzi po zemi nebo podlaze tě Difficult Terrain nestojí žádný pohyb navíc.",
        "Merge with Stone": "Znáš Blade Ward; navíc jej můžeš seslat jako Bonus Action tolikrát za Long Rest, kolik činí Proficiency Bonus. Od 5. úrovně můžeš jednou po Long Rest seslat Pass without Trace bez material component nebo jej seslat slotem 2. úrovně či vyšším. Zvol spellcasting ability z Intelligence, Wisdom nebo Charisma.",
    },
    "Eladrin": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na záchranné hody proti stavu Charmed.",
        "Fey Step": "Bonus Actionem se teleportuješ až 30 stop na volné místo, které vidíš. Použití se rovná Proficiency Bonus a obnoví se po Long Rest. Od 3. úrovně přidává sezónní účinek; pokud vyžaduje save, DC = 8 + Proficiency Bonus + zvolený Intelligence, Wisdom nebo Charisma modifier.",
        "Keen Senses": "Získáš Proficiency v Perception.",
        "Trance": "Nepotřebuješ spát a magie tě nemůže uspat; Long Rest dokončíš po 4 hodinách vědomé meditace. Po transu můžeš změnit sezónu a do dalšího Long Rest získat dvě zdatnosti se zbraní či nástrojem.",
    },
    "Fairy": {
        "Flight": "Máš Flying Speed rovnou své walking Speed; létat nemůžeš v Medium ani Heavy armor.",
        "Fairy Magic": "Znáš Druidcraft. Od 3. úrovně můžeš jednou po Long Rest seslat Faerie Fire a od 5. úrovně Enlarge/Reduce; tato kouzla lze seslat i pomocí spell slots. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
    },
    "Firbolg": {
        "Firbolg Magic": "Můžeš sesílat Detect Magic a Disguise Self; při použití Disguise Self můžeš změnit zdánlivou výšku nejvýše o 3 stopy. Každé kouzlo lze seslat jednou po Long Rest i příslušným spell slotem; vyber Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
        "Hidden Step": "Bonus Actionem se magicky zneviditelníš do začátku svého dalšího tahu, nebo do chvíle, kdy zaútočíš, způsobíš damage či donutíš tvora k saving throw. Použití odpovídá Proficiency Bonus a obnoví se po Long Rest.",
        "Speech of Beast and Leaf": "Omezeně komunikuješ s Beasts, Plants a vegetací: rozumějí smyslu tvých slov a ty chápeš jejich odpovědi. Máš Advantage na Charisma checks, jimiž se je snažíš ovlivnit.",
        "Powerful Build": "Při určení nosnosti a hmotnosti, kterou můžeš tlačit, táhnout či zvedat, se počítáš jako o jednu velikost větší.",
    },
    "Fire Genasi": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fire Resistance": "Máš Resistance vůči Fire damage.",
        "Reach to the Blaze": "Znáš Produce Flame. Od 3. úrovně můžeš jednou po Long Rest seslat Burning Hands a od 5. úrovně Flame Blade; Flame Blade seslané tímto traitem nevyžaduje material component. Každé kouzlo lze seslat také příslušným spell slotem. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
    },
    "Githyanki": {
        "Astral Knowledge": "Po každém Long Rest získáš Proficiency v jedné dovednosti a jedné zbrani nebo nástroji dle výběru; platí do konce dalšího Long Rest.",
        "Githyanki Psionics": "Znáš Mage Hand a při použití tohoto traitu je ruka neviditelná. Od 3. úrovně můžeš jednou po Long Rest seslat Jump a od 5. úrovně Misty Step; kouzla lze seslat i odpovídajícími spell slots, bez spell components. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
        "Psychic Resilience": "Máš Resistance vůči Psychic damage.",
    },
    "Githzerai": {
        "Githzerai Psionics": "Znáš Mage Hand a při použití tohoto traitu je ruka neviditelná. Od 3. úrovně můžeš jednou po Long Rest seslat Shield a od 5. úrovně Detect Thoughts; lze je seslat i odpovídajícími spell slots, bez spell components. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
        "Mental Discipline": "Máš Advantage na záchranné hody k vyhnutí se stavům Charmed a Frightened nebo k jejich ukončení.",
        "Psychic Resilience": "Máš Resistance vůči Psychic damage.",
    },
    "Goblin": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na záchranné hody k vyhnutí se stavu Charmed nebo k jeho ukončení.",
        "Fury of the Small": "Když útokem či kouzlem zraníš většího tvora, můžeš přidat damage rovný Proficiency Bonus. Použití odpovídá Proficiency Bonus, obnoví se po Long Rest a lze je použít nejvýše jednou za tah.",
        "Nimble Escape": "V každém tahu můžeš Bonus Actionem použít Disengage nebo Hide.",
    },
    "Harengon": {
        "Hare-Trigger": "K hodu na Initiative přičítáš svůj Proficiency Bonus.",
        "Leporine Senses": "Získáš Proficiency v Perception.",
        "Lucky Footwork": "Když neuspěješ na Dexterity saving throw, můžeš Reactionem přičíst d4; nepoužiješ, pokud jsi Prone nebo máš Speed 0.",
        "Rabbit Hop": "Bonus Actionem bez vyvolání Opportunity Attack skočíš do vzdálenosti 5 × Proficiency Bonus stop. Použití odpovídá Proficiency Bonus a obnoví se po Long Rest; musíš mít Speed větší než 0.",
    },
    "Hobgoblin": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na záchranné hody k vyhnutí se stavu Charmed nebo k jeho ukončení.",
        "Fey Gift": "Help můžeš použít jako Bonus Action tolikrát, kolik činí Proficiency Bonus; použití se obnoví po Long Rest. Od 3. úrovně si při každém takovém Help zvol Hospitality (ty i podpořený tvor získáte 1d6 + Proficiency Bonus Temporary Hit Points), Passage (ty i tvor zvýšíte walking Speed o 10 stop do začátku tvého dalšího tahu) nebo Spite (do začátku tvého dalšího tahu: když podpořený tvor poprvé zasáhne cíl attack rollem, tento cíl má Disadvantage na svůj další attack roll během následující minuty).",
        "Fortune from the Many": "Když neuspěješ na attack rollu, ability checku nebo saving throw, můžeš přičíst bonus podle počtu spojenců, které vidíš do 30 stop (nejvýše +3). Použití odpovídá Proficiency Bonus a obnoví se po Long Rest.",
    },
    "Kenku": {
        "Expert Duplication": "Když kopíruješ písmo nebo řemeslnou práci vytvořenou tebou či někým jiným, máš Advantage na ability checks potřebné k vytvoření přesné kopie.",
        "Kenku Recall": "Získáš Proficiency ve dvou dovednostech dle výběru. Když provádíš ability check s dovedností, v níž jsi proficient, můžeš si ještě před hodem udělit Advantage; počet použití odpovídá Proficiency Bonus a všechna se obnoví po Long Rest.",
        "Mimicry": "Dokážeš napodobit zvuky včetně hlasů, které jsi slyšel. Posluchač pozná imitaci úspěšným Wisdom (Insight) checkem proti DC 8 + Proficiency Bonus + Charisma modifier.",
    },
    "Kobold": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Draconic Cry": "Bonus Actionem vykřikneš na nepřátele do 10 stop, kteří tě slyší; do začátku tvého dalšího tahu mají na ně ty i tvoji spojenci Advantage při attack rolls. Použití odpovídá Proficiency Bonus a obnoví se po Long Rest.",
        "Kobold Legacy": "Vyber Craftiness (Proficiency v Arcana, Investigation, Medicine, Sleight of Hand nebo Survival), Defiance (Advantage na saves k vyhnutí se stavu Frightened nebo k jeho ukončení) nebo Draconic Sorcery (získáš cantrip ze Sorcerer spell listu a zvolíš jeho spellcasting ability: Intelligence, Wisdom nebo Charisma).",
    },
    "Lizardfolk": {
        "Bite": "Čelistmi můžeš provádět Unarmed Strike; při zásahu způsobíš Slashing damage 1d6 + Strength modifier místo běžného Bludgeoning damage.",
        "Hold Breath": "Dokážeš zadržet dech až 15 minut.",
        "Hungry Jaws": "Bonus Actionem provedeš kousnutí; při zásahu získáš Temporary Hit Points rovné Proficiency Bonus. Použití odpovídá Proficiency Bonus a obnoví se po Long Rest.",
        "Natural Armor": "Pokud nenosíš armor, můžeš mít AC 13 + Dexterity modifier. Jestli tě armor, který máš na sobě, chrání hůře, můžeš místo něj použít Natural Armor; výhody shield se započítají normálně.",
        "Nature's Intuition": "Získáš Proficiency ve dvou dovednostech podle výběru z Animal Handling, Medicine, Nature, Perception, Stealth nebo Survival.",
    },
    "Minotaur": {
        "Horns": "Rohy můžeš použít k Unarmed Strike, který způsobí Piercing damage 1d6 + Strength modifier.",
        "Goring Rush": "Bezprostředně po použití Dash a uražení alespoň 20 stop můžeš Bonus Actionem provést jeden melee attack pomocí Horns.",
        "Hammering Horns": "Po zásahu melee attackem v rámci Attack action můžeš Bonus Actionem zkusit odstrčit cíl do 5 stop, který není o více než jednu velikost větší. Pokud neuspěje na Strength save proti DC 8 + Proficiency Bonus + Strength modifier, odstrčíš jej až o 10 stop.",
        "Labyrinthine Recall": "Vždy víš, kterým směrem je sever, a máš Advantage na Wisdom (Survival) checks k navigaci nebo sledování.",
    },
    "Satyr": {
        "Ram": "Rohy můžeš použít k Unarmed Strike, který způsobí Bludgeoning damage 1d6 + Strength modifier.",
        "Magic Resistance": "Máš Advantage na saving throws proti kouzlům.",
        "Mirthful Leaps": "Při long jump nebo high jump můžeš hodit d8 a přidat výsledek ve stopách k uražené vzdálenosti, a to i při skoku z místa. Dodatečná vzdálenost běžně spotřebovává pohyb.",
        "Reveler": "Získáš Proficiency v Performance a Persuasion a v jednom hudebním nástroji dle výběru.",
    },
    "Sea Elf": {
        "Child of the Sea": "Dýcháš pod vodou i na vzduchu, máš Resistance vůči Cold damage a Swimming Speed rovnou své walking Speed.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na záchranné hody k vyhnutí se stavu Charmed nebo k jeho ukončení.",
        "Friend of the Sea": "Dokážeš sdělit jednoduché myšlenky Beastovi se Swimming Speed; rozumí ti, ale ty jeho odpovědím bez další schopnosti nerozumíš.",
        "Keen Senses": "Získáš Proficiency v Perception.",
        "Trance": "Nepotřebuješ spát a magie tě nemůže uspat; Long Rest dokončíš po 4 hodinách vědomé meditace. Po transu získáš Proficiency ve dvou zbraních či nástrojích podle výběru do dalšího Long Rest.",
    },
    "Shadar-kai": {
        "Blessing of the Raven Queen": "Bonus Actionem se teleportuješ až 30 stop na volné místo, které vidíš. Použití odpovídá Proficiency Bonus a obnoví se po Long Rest. Od 3. úrovně získáš po teleportu Resistance vůči všem damage do začátku svého dalšího tahu a vypadáš přízračně a průsvitně.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na záchranné hody k vyhnutí se stavu Charmed nebo k jeho ukončení.",
        "Keen Senses": "Získáš Proficiency v Perception.",
        "Necrotic Resistance": "Máš Resistance vůči Necrotic damage.",
        "Trance": "Nepotřebuješ spát a magie tě nemůže uspat; Long Rest dokončíš po 4 hodinách vědomé meditace. Po transu získáš Proficiency ve dvou zbraních či nástrojích podle výběru do dalšího Long Rest.",
    },
    "Tabaxi": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Feline Agility": "Při pohybu ve svém tahu můžeš zdvojnásobit svou Speed do konce tahu. Znovu ji použiješ až poté, co se v jednom ze svých tahů nepohneš.",
        "Cat's Claws": "Máš Climb Speed rovnou své walking Speed. Drápy použiješ k Unarmed Strike, který způsobí Slashing damage 1d6 + Strength modifier.",
        "Cat's Talent": "Získáš Proficiency v Perception a Stealth.",
    },
    "Tortle": {
        "Claws": "Drápy použiješ k Unarmed Strike, který způsobí Slashing damage 1d6 + Strength modifier.",
        "Hold Breath": "Dokážeš zadržet dech až 1 hodinu.",
        "Natural Armor": "Krunýř poskytuje základní AC 17, které Dexterity modifier nezvyšuje. Nemůžeš nosit Light, Medium ani Heavy armor; shield můžeš použít a jeho bonus se normálně přičítá.",
        "Shell Defense": "Akcí se stáhneš do krunýře: získáš +4 AC a Advantage na Strength a Constitution saving throws. Jsi Prone, Speed je 0 a nemůže se zvýšit, máš Disadvantage na Dexterity saving throws a nemůžeš používat Reaction; jedinou akcí, kterou můžeš provést, je Bonus Action k vysunutí.",
        "Nature's Intuition": "Vyber jednu dovednost z Animal Handling, Medicine, Nature, Perception, Stealth nebo Survival; získáš v ní Proficiency.",
    },
    "Triton": {
        "Amphibious": "Dýcháš vzduch i vodu.",
        "Control Air and Water": "Fog Cloud znáš od 1. úrovně; od 3. úrovně můžeš seslat Gust of Wind a od 5. úrovně Water Walk. Každé z těchto kouzel lze s traitem seslat jednou po Long Rest a také příslušnými spell slots. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Guardian of the Depths": "Máš Resistance vůči Cold damage.",
        "Emissary of the Sea": "Můžeš sdělovat jednoduché myšlenky Beastům, Elementalům a Monstrosities se Swimming Speed; rozumí ti, ale ty jim bez další schopnosti nerozumíš.",
    },
    "Water Genasi": {
        "Acid Resistance": "Máš Resistance vůči Acid damage.",
        "Amphibious": "Dýcháš vzduch i vodu.",
        "Call to the Wave": "Znáš Acid Splash; od 3. úrovně můžeš jednou po Long Rest seslat Create or Destroy Water a od 5. úrovně Water Walk bez Material component. Každé z těchto kouzel můžeš seslat také příslušným spell slotem. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
        "Swim": "Máš Swimming Speed rovnou své walking Speed.",
    },
    "Yuan-ti": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Magic Resistance": "Máš Advantage na saving throws proti kouzlům.",
        "Poison Resilience": "Máš Advantage na záchranné hody, kterými se vyhýbáš stavu Poisoned nebo jej ukončuješ, a Resistance vůči Poison damage.",
        "Serpentine Spellcasting": "Znáš Poison Spray a můžeš neomezeně sesílat Animal Friendship pouze na hady. Od 3. úrovně můžeš jednou po Long Rest seslat Suggestion; můžeš jej seslat také spell slotem 2. úrovně či vyšším. Zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability.",
    },
    "Astral Elf": {
        "Astral Fire": "Vyber Guidance, Light nebo Sacred Flame; zvolený cantrip znáš a Intelligence, Wisdom nebo Charisma je jeho spellcasting ability.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na saving throws k vyhnutí se stavu Charmed nebo k jeho ukončení.",
        "Starlight Step": "Bonus Actionem se teleportuješ až 30 stop na neobsazené místo, které vidíš. Použití odpovídá Proficiency Bonus a obnoví se po Long Rest.",
        "Trance": "Nepotřebuješ spát a magie tě nemůže uspat; Long Rest dokončíš po 4 hodinách vědomé meditace a získáš Proficiency v jedné dovednosti a jedné zbrani nebo nástroji do dalšího Long Rest.",
    },
    "Autognome": {
        "Armored Casing": "Pokud nenosíš armor, máš základní AC 13 + Dexterity modifier.",
        "Built for Success": "K útoku, ability checku či saving throw můžeš po zobrazení d20 a před vyhodnocením přidat d4; použití odpovídá Proficiency Bonus a obnoví se po Long Rest.",
        "Healing Machine": "Když na tebe někdo sesílá Mending, můžeš utratit Hit Die a získat jeho hod + Constitution modifier Hit Points (min. 1). Můžeš být ovlivněn i Cure Wounds, Healing Word, Mass Cure Wounds, Mass Healing Word a Spare the Dying, přestože obvykle na Construct nepůsobí.",
        "Mechanical Nature": "Máš Resistance vůči Poison damage, imunitu vůči disease, Advantage na saves proti Paralyzed a Poisoned a nepotřebuješ jíst, pít ani dýchat.",
        "Sentry's Rest": "Při Long Rest strávíš alespoň 6 hodin nehybný a neaktivní, ale zůstáváš při vědomí.",
        "Specialized Design": "Získáš Proficiency ve dvou nástrojích podle výběru.",
    },
    "Giff": {
        "Astral Spark": "Když zasáhneš jednoduchou nebo martial zbraní, můžeš přidat Force damage rovný Proficiency Bonus. Použití odpovídá Proficiency Bonus, obnovuje se po Long Rest a lze jej použít nejvýše jednou za tah.",
        "Firearms Mastery": "Získáš Proficiency se všemi Firearms, ignoruješ Loading property a střelba na long range ti nedává Disadvantage.",
        "Hippo Build": "Máš Advantage na Strength checks a Strength saving throws; pro nosnost a tlačení, tažení či zvedání se počítáš jako o jednu velikost větší.",
    },
    "Hadozee": {
        "Dexterous Feet": "Bonus Actionem můžeš nohama manipulovat s předmětem, otevřít či zavřít dveře nebo nádobu, nebo zvednout či položit Tiny předmět.",
        "Glide": "Při pádu z výšky alespoň 10 stop můžeš Reactionem klouzat vodorovně o vzdálenost rovnou walking Speed; určíš směr a neutrpíš fall damage.",
        "Hadozee Dodge": "Při utržení damage můžeš Reactionem hodit d6 + Proficiency Bonus a o součet snížit damage (min. 0); použití odpovídá Proficiency Bonus a obnovuje se po Long Rest.",
    },
    "Plasmoid": {
        "Amorphous": "Můžeš projít prostorem širokým 1 inch, pokud nic nenosíš ani neneseš; máš Advantage na ability checks k zahájení nebo ukončení Grapple.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Hold Breath": "Dokážeš zadržet dech až 1 hodinu.",
        "Natural Resilience": "Máš Resistance vůči Acid a Poison damage a Advantage na saving throws proti Poisoned.",
        "Shape Self": "Akcí vytvoříš humanoidní hlavu, paže, nohy, ruce a chodidla nebo se vrátíš do beztvaré podoby. V humanoidním tvaru můžeš nosit odpovídající oblečení a armor. Bonus Actionem vytvoříš či vstřebáš pseudopod do 6 inches široký a 10 feet dlouhý; stejnou akcí můžeš manipulovat s předmětem nebo Tiny objektem. Nemá smysly, neútočí, neaktivuje magic items a nezvedne přes 10 pounds.",
    },
    "Thri-kreen": {
        "Chameleon Carapace": "Bez armoru máš AC 13 + Dexterity modifier. Akcí změníš barvu a strukturu krunýře, aby splynula s okolím, a získáš Advantage na Dexterity (Stealth) checks pro ukrytí v něm.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Secondary Arms": "Dva menší paže mohou manipulovat s předmětem, otevřít či zavřít dveře nebo nádobu, zvednout či položit Tiny předmět, nebo ovládat zbraň s vlastností Light.",
        "Sleepless": "Nepotřebuješ spát a můžeš zůstat při Long Rest při vědomí; abys získal jeho výhody, musíš se vyhnout namáhavé činnosti.",
        "Thri-kreen Telepathy": "Bez magie nemůžeš mluvit jazyky jiných druhů. Telepaticky předáváš myšlenky ochotným tvorům do 120 stop, kteří rozumí alespoň jednomu jazyku; spojení končí při překročení dosahu, Incapacitated stavu nebo dobrovolném ukončení.",
    },
    "Kender": {
        "Kender Aptitude": "Získáš Proficiency v Insight, Investigation, Sleight of Hand, Stealth nebo Survival podle výběru.",
        "Fearless": "Máš Advantage na saves k vyhnutí se Frightened nebo jeho ukončení; při neúspěchu se můžeš rozhodnout uspět. Toto zvláštní použití se obnoví po Long Rest.",
        "Taunt": "Bonus Actionem vyprovokuješ tvora do 60 stop, který tě slyší a rozumí. Při neúspěšném Wisdom save proti DC 8 + Proficiency Bonus + Intelligence, Wisdom nebo Charisma modifier (zvolená schopnost) má Disadvantage na útoky proti ostatním do začátku tvého dalšího tahu. Použití odpovídá Proficiency Bonus a obnovuje se po Long Rest.",
    },
    "Owlin": {
        "Darkvision": "V šeru vidíš do 120 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Flight": "Máš Flying Speed rovnou své walking Speed; létat nemůžeš v Medium ani Heavy armor.",
        "Silent Feathers": "Získáš Proficiency ve Stealth.",
    },
    "Loxodon": {
        "Powerful Build": "Pro nosnost a hmotnost, kterou můžeš tlačit, táhnout či zvedat, se počítáš jako o jednu velikost větší.",
        "Loxodon Serenity": "Máš Advantage na saving throws proti stavům Charmed a Frightened.",
        "Natural Armor": "Bez armoru máš AC 12 + Constitution modifier; pokud armor poskytne nižší AC, můžeš použít Natural Armor. Shield se počítá normálně.",
        "Trunk": "Chobot dosáhne 5 stop, zvedne váhu 5 × Strength score pounds a slouží jako snorkel. Může zvedat, pouštět, držet, tlačit či táhnout, otevírat a zavírat, Grappleovat a provádět Unarmed Strike za 1d4 + Strength modifier Bludgeoning. Neudrží zbraň ani shield a neprovádí přesnou manuální práci.",
        "Keen Smell": "Máš Advantage na Wisdom (Perception), Wisdom (Survival) a Intelligence (Investigation) checks související s čichem.",
    },
    "Simic Hybrid": {
        "Animal Enhancements": "Při tvorbě vyber Manta Glide, Nimble Climber nebo Underwater Adaptation; další volbu získáš na 5. úrovni z Grappling Appendages, Carapace nebo Acid Spit. Účinky jsou popsány v tabulce Volby.",
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
    },
    "Vedalken": {
        "Vedalken Dispassion": "Máš Advantage na Intelligence, Wisdom a Charisma saving throws.",
        "Tireless Precision": "Vyber jednu dovednost z Arcana, History, Investigation, Medicine, Performance nebo Sleight of Hand a jeden nástroj; získáš Proficiency. Ability checks s nimi zvýšíš o d4.",
        "Partially Amphibious": "Dýcháš pod vodou až 1 hodinu; po vyčerpání limitu schopnost znovu použiješ až po Long Rest.",
    },
    "Leonin": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Claws": "Drápy použiješ k Unarmed Strike, který způsobí Slashing damage 1d4 + Strength modifier.",
        "Hunter's Instincts": "Získáš Proficiency v jedné dovednosti: Athletics, Intimidation, Perception nebo Survival.",
        "Daunting Roar": "Bonus Actionem zařveš na tvory podle výběru do 10 stop, kteří tě slyší. Při neúspěšném Wisdom save proti DC 8 + Proficiency Bonus + Constitution modifier jsou Frightened do konce tvého dalšího tahu. Obnoví se po Short nebo Long Rest.",
    },
    "Locathah": {
        "Leviathan Will": "Máš Advantage na saving throws proti stavům Charmed, Frightened, Poisoned, Paralyzed, Stunned a Unconscious.",
        "Natural Armor": "Bez armoru máš AC 12 + Dexterity modifier; pokud armor poskytne nižší AC, můžeš použít Natural Armor. Shield se počítá normálně.",
        "Observant and Athletic": "Získáš Proficiency v Athletics a Perception.",
        "Limited Amphibiousness": "Dýcháš vodu i vzduch, ale musíš se ponořit alespoň jednou během každých 4 hodin; jinak se začneš dusit.",
    },
    "Verdan": {
        "Black Blood Healing": "Při utracení Hit Die na konci Short Rest můžeš přehodit výsledek 1 nebo 2; nový výsledek musíš použít.",
        "Limited Telepathy": "Viditelnému tvorovi do 30 stop můžeš pomalu telepaticky sdílet jednoduché myšlenky; nesdílíte jazyk, ale cíl musí rozumět alespoň jednomu.",
        "Persuasive": "Získáš Proficiency v Persuasion.",
        "Telepathic Insight": "Máš Advantage na Wisdom a Charisma saving throws.",
    },
    "Grung": {
        "Amphibious": "Dýcháš vzduch i vodu.",
        "Arboreal Alertness": "Získáš Proficiency v Perception.",
        "Poison Immunity": "Máš Immunity vůči Poison damage i stavu Poisoned.",
        "Poisonous Skin": "Tvor, který tě Grapple nebo se přímo dotkne tvé kůže, musí uspět na Constitution save DC 12, jinak je Poisoned na 1 minutu. Mimo přímý kontakt může save opakovat na konci tahu. Při útoku piercing zbraní můžeš nanést jed; zasažený cíl hází Constitution save DC 12, při neúspěchu utrpí 2d4 Poison damage.",
        "Standing Leap": "Long jump až 25 stop a high jump až 15 stop, s rozběhem i bez něj.",
        "Water Dependency": "Pokud se během dne neponoříš alespoň na 1 hodinu, na konci dne získáš 1 Exhaustion; zotavíš se pouze magií nebo hodinovým ponořením.",
    },
    "Half-Elf": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Fey Ancestry": "Máš Advantage na záchranné hody proti stavu Charmed a magie tě nemůže uspat.",
        "Skill Versatility": "Získáš Proficiency ve dvou dovednostech dle výběru.",
    },
    "Half-Orc": {
        "Darkvision": "V šeru vidíš do 60 stop jako za jasného světla a ve tmě jako v šeru; barvy ve tmě rozeznáváš jen jako odstíny šedi.",
        "Menacing": "Získáš Proficiency v Intimidation.",
        "Relentless Endurance": "Když bys klesl na 0 Hit Points, ale nejsi okamžitě zabit, zůstaneš místo toho na 1 Hit Point. Použití se obnoví po Long Rest.",
        "Savage Attacks": "Při Critical Hit melee weapon attackem můžeš hodit jednu z damage kostek zbraně ještě jednou a přičíst ji k dodatečnému damage kritického zásahu.",
    },
}

OPTIONS = {
    "Dragonborn": """| Draconic ancestor | Damage type and breath shape |
| --- | --- |
| Black | Acid; line 5 × 30 stop |
| Blue | Lightning; line 5 × 30 stop |
| Brass | Fire; line 5 × 30 stop |
| Bronze | Lightning; line 5 × 30 stop |
| Copper | Acid; line 5 × 30 stop |
| Gold | Fire; cone 15 stop |
| Green | Poison; cone 15 stop |
| Red | Fire; cone 15 stop |
| Silver | Cold; cone 15 stop |
| White | Cold; cone 15 stop |""",
    "Elf": """| Lineage | Další schopnosti na 1. úrovni | Kouzlo od 3. úrovně | Kouzlo od 5. úrovně |
| --- | --- | --- | --- |
| Drow | Darkvision má dosah 120 stop; Dancing Lights | Faerie Fire | Darkness |
| High Elf | Prestidigitation; po Long Rest ji můžeš vyměnit za cantrip z Wizard spell listu | Detect Magic | Misty Step |
| Wood Elf | Speed 35 stop; Druidcraft | Longstrider | Pass without Trace |""",
    "Lorwyn-Shadowmoor Elf": """| Lineage | Schopnosti na 1. úrovni | Kouzlo od 3. úrovně | Kouzlo od 5. úrovně |
| --- | --- | --- | --- |
| Lorwyn Elf | Thorn Whip; po Long Rest jej můžeš vyměnit za cantrip z Druid spell listu | Command | Silence |
| Shadowmoor Elf | Darkvision má dosah 120 stop; Starry Wisp | Heroism | Gentle Repose |""",
    "Gnome": """| Linie | Základní magie | Další schopnost |
| --- | --- | --- |
| Forest Gnome | Minor Illusion; Speak with Animals | Speak with Animals lze sesílat bez slotu Proficiency Bonuskrát za Long Rest |
| Rock Gnome | Mending; Prestidigitation | Tvorba až tří jednoduchých clockwork devices |""",
    "Tiefling": """| Fiendish Legacy | Resistance | Cantrip | Kouzlo od 3. úrovně | Kouzlo od 5. úrovně |
| --- | --- | --- | --- | --- |
| Abyssal | Poison | Poison Spray | Ray of Sickness | Hold Person |
| Chthonic | Necrotic | Chill Touch | False Life | Ray of Enfeeblement |
| Infernal | Fire | Fire Bolt | Hellish Rebuke | Darkness |""",
    "Goliath": """| Giant ancestry | Účinek |
| --- | --- |
| Cloud | Bonus Actionem se teleportuješ až 30 stop na volné místo, které vidíš. |
| Fire | Po zásahu cíle attack roll a způsobení damage mu přidáš 1d10 Fire damage. |
| Frost | Po zásahu přidáš 1d6 Cold damage a snížíš Speed cíle o 10 stop do začátku svého dalšího tahu. |
| Hill | Při zásahu cíle velikosti Large nebo menšího jej můžeš srazit Prone. |
| Stone | Když utrpíš damage, můžeš Reactionem hodit 1d12, přičíst Constitution modifier a snížit damage o výsledek. |
| Storm | Když utrpíš damage od tvora do 60 stop, můžeš Reactionem tomuto tvorovi způsobit 1d8 Thunder damage. |

Každý účinek Giant Ancestry můžeš použít tolikrát, kolik činí Proficiency Bonus; všechna použití obnovíš po Long Rest.""",
    "Aasimar": """| Celestial Revelation | Extra damage | Účinek po aktivaci |
| --- | --- | --- |
| Heavenly Wings | Radiant, Proficiency Bonus | Získáš Flying Speed rovnou své Speed na 1 minutu. |
| Inner Radiance | Radiant, Proficiency Bonus | Záříš jasně 10 stop a tlumeně dalších 10 stop; tvorové do 10 stop utrpí na konci tvého tahu Radiant damage rovné Proficiency Bonus. |
| Necrotic Shroud | Necrotic, Proficiency Bonus | Tvorové kromě spojenců do 10 stop hází Charisma save proti DC 8 + Charisma modifier + Proficiency Bonus; při neúspěchu jsou Frightened do konce tvého dalšího tahu. |""",
    "Kithkin": """| Kithkin Lineage | Dodatečný účinek |
| --- | --- |
| Lorwyn | Žádný další trait. |
| Shadowmoor | Darkvision má dosah 120 stop. |""",
    "Shifter": """| Podoba | Další účinek při Shifting |
| --- | --- |
| Beasthide | Získáš navíc 1d6 Temporary Hit Points a po dobu proměny +1 AC. |
| Longtooth | Při proměně a jako Bonus Action v dalších tazích můžeš kousnout; Unarmed Strike způsobí Piercing damage 1d6 + Strength modifier. |
| Swiftstride | Po dobu proměny se Speed zvýší o 10 stop; Reactionem se můžeš posunout až o 10 stop, když tvor ukončí tah do 5 stop od tebe, bez vyvolání Opportunity Attacks. |
| Wildhunt | Po dobu proměny máš Advantage na Wisdom checks a tvorové do 30 stop nemají Advantage na útoky proti tobě, pokud nejsi Incapacitated. |""",
    "Duskling": """| Inner Magic | Účinek |
| --- | --- |
| Ardor | Advantage na Charisma ability checks a na saving throws, kterými se vyhýbáš stavu Frightened nebo jej ukončuješ. |
| Mobility | Speed se zvýší o 10 stop; lezení a plavání nestojí pohyb navíc. |
| Vigor | Získáš Temporary Hit Points rovné Proficiency Bonus a Advantage na Strength (Athletics) a Dexterity (Acrobatics) checks. |

Inner Magic nemá další lineage volby: vybíráš pouze jeden ze tří účinků v tabulce a můžeš jej přepínat Bonus Actionem v mezích Proficiency Bonus.""",
    "Eladrin": """| Season | Účinek Fey Step od 3. úrovně |
| --- | --- |
| Autumn | Až dva tvorové do 10 stop hází Wisdom save; při neúspěchu jsou Charmed na 1 minutu nebo do chvíle, kdy utrpí damage od tebe či spojenců. |
| Winter | Jeden tvor do 5 stop před teleportací hází Wisdom save; při neúspěchu je Frightened do konce tvého dalšího tahu. |
| Spring | Místo sebe teleportuješ dobrovolného tvora, kterého se dotkneš, až 30 stop na místo, které vidíš. |
| Summer | Tvorové dle tvého výběru do 5 stop utrpí Fire damage rovné Proficiency Bonus. |""",
    "Astral Elf": """| Astral Fire | Cantrip |
| --- | --- |
| Guidance | Guidance |
| Light | Light |
| Sacred Flame | Sacred Flame |

Při výběru zvol jeden cantrip; spellcasting ability pro něj je Intelligence, Wisdom nebo Charisma dle tvé volby.""",
    "Kobold": """| Kobold Legacy | Získaná schopnost |
| --- | --- |
| Craftiness | Proficiency v Arcana, Investigation, Medicine, Sleight of Hand nebo Survival. |
| Defiance | Advantage na saves proti stavu Frightened. |
| Draconic Sorcery | Jeden cantrip ze Sorcerer spell listu; zvol Intelligence, Wisdom nebo Charisma jako spellcasting ability. |""",
    "Simic Hybrid": """| Animal Enhancement | Účinek |
| --- | --- |
| Manta Glide | Při pádu můžeš klouzat, snížit fall damage a urazit vodorovnou vzdálenost. |
| Nimble Climber | Získáš Climb Speed rovnou své walking Speed. |
| Underwater Adaptation | Získáš Swimming Speed rovnou své walking Speed a můžeš dýchat pod vodou. |
| Grappling Appendages | Získáš dvě chapadla či klepeta pro uchopování a útoky. |
| Carapace | Získáš +1 AC, pokud nenosíš Heavy armor. |

Zvol jednu adaptaci při vytvoření postavy a druhou na 5. úrovni; první výběr je z úvodních tří možností.""",
    "Genasi": """| Species | Elementální původ | Typické zvláštní schopnosti |
| --- | --- | --- |
| Air Genasi | Vzduch | Delší zadržení dechu, odolnost vůči bleskům a vzdušná magie. |
| Earth Genasi | Země | Pohyb přes obtížný terén a magie kamene. |
| Fire Genasi | Oheň | Odolnost vůči ohni a ohnivá magie. |
| Water Genasi | Voda | Kyselinová odolnost, obojživelnost a plavecká rychlost. |""",
}

PUBLICATION_YEARS = {
    "Player's Handbook": 2024,
    "Ravenloft: The Horrors Within": 2026,
    "Lorwyn: First Light": 2026,
    "Eberron: Forge of the Artificer": 2025,
    "D&D Beyond Drops (September 2026)": 2026,
    "D&D Beyond Drops (November 2026)": 2026,
    "Mordenkainen Presents: Monsters of the Multiverse": 2022,
    "Spelljammer: Adventures in Space": 2022,
    "Dragonlance: Shadow of the Dragon Queen": 2022,
    "Strixhaven: A Curriculum of Chaos": 2021,
    "Guildmasters' Guide to Ravnica": 2018,
    "Mythic Odysseys of Theros": 2020,
    "Locathah Rising": 2019,
    "Acquisitions Incorporated": 2019,
    "One Grung Above": 2017,
    "Player's Handbook (2014)": 2014,
}

DETAIL_URLS = {
    "Aarakocra": "https://dnd5e.wikidot.com/lineage:aarakocra-mpmm",
    "Air Genasi": "https://dnd5e.wikidot.com/lineage:genasi-air-mpmm",
    "Bugbear": "https://dnd5e.wikidot.com/lineage:bugbear-mpmm",
    "Centaur": "https://dnd5e.wikidot.com/lineage:centaur-mpmm",
    "Deep Gnome": "https://dnd5e.wikidot.com/lineage:deep-gnome-mpmm",
    "Duergar": "https://dnd5e.wikidot.com/lineage:duergar-mpmm",
    "Earth Genasi": "https://dnd5e.wikidot.com/lineage:genasi-earth-mpmm",
    "Eladrin": "https://dnd5e.wikidot.com/lineage:eladrin-mpmm",
    "Fire Genasi": "https://dnd5e.wikidot.com/lineage:genasi-fire-mpmm",
    "Githyanki": "https://dnd5e.wikidot.com/lineage:githyanki-mpmm",
    "Githzerai": "https://dnd5e.wikidot.com/lineage:githzerai-mpmm",
    "Goblin": "https://dnd5e.wikidot.com/lineage:goblin-mpmm",
    "Harengon": "https://dnd5e.wikidot.com/lineage:harengon-mpmm",
    "Hobgoblin": "https://dnd5e.wikidot.com/lineage:hobgoblin-mpmm",
    "Kenku": "https://dnd5e.wikidot.com/lineage:kenku-mpmm",
    "Kobold": "https://dnd5e.wikidot.com/lineage:kobold-mpmm",
    "Yuan-ti": "https://dnd5e.wikidot.com/lineage:yuan-ti-mpmm",
    "Lorwyn Changeling": "https://dungeonmister.com/guides/lorwyn-changeling-dd-2024-species-optimisation-guide/",
}

TRAIT_RENAMES = {
    "Deep Gnome": {"Gnomish Magic": "Gift of the Svirfneblin"},
    "Duergar": {"Duergar Resilience": "Dwarven Resilience"},
    "Warforged": {"Construct Resilience": "Constructed Resilience"},
    "Kalashtar": {"Mindlink": "Mind Link"},
}

TRAIT_REMOVALS = {
    "Warforged": {"Specialized Design"},
}

PROMPT_ANATOMY = {
    "Air Genasi": "a medium-sized person with blue-grey skin and hair stirred by a constant unseen breeze",
    "Earth Genasi": "a compact person with stone-toned skin, sparkling mineral flecks, and crystal-like hair",
    "Eladrin": "a tall, slender elf whose skin and clothing carry a distinct seasonal palette",
    "Deep Gnome": "a small, three-foot-tall underground gnome with dusky skin and broad, watchful eyes",
    "Duergar": "a sturdy, four-foot-tall dwarf with ash-grey skin and a close-cropped beard",
    "Firbolg": "a very tall, broad-shouldered fey humanoid with calm features and an earthy complexion",
    "Fire Genasi": "a medium-sized person with charcoal-cracked skin and hair like a living orange flame",
    "Githyanki": "a tall, lanky humanoid with ochre skin, sharp features, and long limbs",
    "Githzerai": "a slender humanoid with speckled yellow-green skin and a composed, focused face",
    "Goblin": "a small, long-eared goblinoid with wiry limbs and olive-green skin",
    "Harengon": "a rabbitfolk humanoid with long ears, oversized feet, soft fur, and springy legs",
    "Hobgoblin": "a tall, disciplined goblinoid with pointed ears, a strong nose, and a soldier's build",
    "Kobold": "a small rust-scaled dragonkin with a long tail, oversized ears, and a narrow muzzle",
    "Lizardfolk": "a scaled reptilian humanoid with a long tail, broad snout, and clawed hands",
    "Satyr": "a fey humanoid with curled horns, a human-like upper body, goat legs, and cloven hooves",
    "Sea Elf": "a slender sea-dwelling elf with blue-green skin, webbed fingers, and gill slits",
    "Shadar-kai": "a pale, slender elf with shadow-dark eyes and faintly shadowed skin",
    "Triton": "a medium-sized aquatic humanoid with webbed hands, subtle gills, and sea-green skin",
    "Water Genasi": "a medium-sized person with blue-green skin and hair flowing like water",
    "Astral Elf": "a slender elf with star-like freckles, luminous eyes, and hair like a night sky",
    "Autognome": "a three-foot-tall mechanical gnome with articulated brass joints and a compact metal body",
    "Giff": "a tall, powerfully built hippopotamus-headed humanoid with thick hide and a broad muzzle",
    "Hadozee": "a lean, agile simian humanoid with long arms and gliding skin membranes under both arms",
    "Plasmoid": "a small translucent, softly glowing gelatinous being holding a loose humanoid shape",
    "Thri-kreen": "an insectoid humanoid with chitin plates, antennae, and two smaller secondary arms",
    "Kender": "a small, three-foot-tall traveler with bright eyes, nimble hands, and youthful proportions",
    "Owlin": "a small owl-headed humanoid with feathered wings, a heart-shaped face, and large forward eyes",
    "Lorwyn Changeling": "a small or medium Fey with blue-green skin, tentacle-like fur tufts, and huge yellow slit-pupil eyes, whose crude Humanoid or Beast shapes never hide those features",
    "Loxodon": "a towering elephant-headed humanoid with a muscular trunk, broad ears, and thick hide",
    "Simic Hybrid": "a humanoid with visible aquatic or crustacean adaptations integrated into their body",
    "Vedalken": "a tall, slender blue-skinned humanoid with a smooth head and long, precise fingers",
    "Leonin": "a muscular lion-headed humanoid with a full mane, feline tail, and powerful paws",
    "Locathah": "a fish-headed humanoid with slick scales, prominent gills, and fin-like ears",
    "Verdan": "a small green-skinned goblinoid with an expressive face and youthful proportions",
    "Grung": "a small, three-foot-tall frogfolk with vivid green skin, wide-set eyes, and webbed fingers",
    "Half-Elf": "a human-sized person with a blend of human features and subtly pointed elven ears",
    "Half-Orc": "a tall, broad humanoid with prominent lower tusks and a strong orcish jaw",
    "Lorwyn-Shadowmoor Elf": "an elf with black pupil-less eyes, curved horns, pointed ears, and cloven hooves, in a Lorwyn or Shadowmoor aspect",
}

PROMPT_ACTIONS = {
    "Dwarf": "striking a rune into a steel brace with a masterwork hammer",
    "Dragonborn": "testing a measured breath of flame over cooled forge stone",
    "Elf": "marking a mountain route on parchment with an ashwood bow at hand",
    "Gnome": "adjusting a tiny brass clockwork device with a jeweler's loupe",
    "Tiefling": "sealing a folded contract with a dark wax stamp",
    "Halfling": "serving a hot meal from a copper travel kettle",
    "Orc": "hauling an ore cart up a steep rail with a hooked chain",
    "Goliath": "lifting a basalt forge slab clear of the workbench",
    "Human": "annotating a mine ledger with a sharp quill",
    "Aasimar": "raising a steady lantern to inspect a carved stone arch",
    "Hexblood": "whispering to a carved wooden charm held between long fingers",
    "Dhampir": "climbing a soot-dark wall toward a locked archive window",
    "Reborn": "repairing a torn work coat with careful, scarred hands",
    "Lupin": "following a scent trail along a mine gallery floor",
    "Boggart": "darting beneath a market cart with a coil of colored thread",
    "Faerie": "hovering above a bundle of mountain herbs with tiny shears",
    "Flamekin": "tending a forge fire with long blackened tongs",
    "Kithkin": "tying a woven clan banner to an iron railing",
    "Lorwyn Changeling": "blending into a mossy stone support while watching the tunnel",
    "Lorwyn-Shadowmoor Elf": "scouting a shadowed parapet with a narrow hunting spear",
    "Rimekin": "etching a frost rune into a chilled steel plate with an ice chisel",
    "Changeling": "studying a reflected borrowed face in a polished steel mirror",
    "Kalashtar": "meditating beside a luminous crystal that evokes a dream",
    "Khoravar": "drafting an auction notice beside a stack of sealed papers",
    "Shifter": "tracking fresh claw marks along a snowy pass",
    "Warforged": "riveting a broken support beam back into place",
    "Duskling": "leaping between stair landings with a dusk-glass shard in hand",
    "Bariaur": "pulling a laden mule cart uphill with a curled-horn harness",
    "Aarakocra": "sweeping forge smoke toward a ventilation shaft with one wing",
    "Air Genasi": "testing wind direction with a strip of bright cloth",
    "Bugbear": "slipping through a narrow mine brace with a silent rope coil",
    "Centaur": "charging across a stone yard with a spear held low",
    "Deep Gnome": "marking a hidden tunnel with a miner's lamp and chalk",
    "Duergar": "lifting an ore hammer beside an invisible outline on the wall",
    "Earth Genasi": "steadying a cracked mine support with both stone-flecked hands",
    "Eladrin": "stepping through a swirl of seasonal leaves beside a carved arch",
    "Fairy": "hovering over a candlelit herb stall with a tiny glass lantern",
    "Firbolg": "quietly tending a stubborn mountain sapling with a branchwood staff",
    "Fire Genasi": "coaxing a line of embers into a forge channel with iron tongs",
    "Githyanki": "projecting an astral route above a folded navigation chart",
    "Githzerai": "holding a focused defensive stance beneath falling forge sparks",
    "Goblin": "hiding behind a spice stall while aiming a compact sling",
    "Harengon": "springing from one market roof to another with a wicker basket",
    "Hobgoblin": "helping a companion lift a crate while signaling with a red sash",
    "Kenku": "reproducing a smith's mark on a charcoal tablet with a hooked stylus",
    "Kobold": "calling a warning beside a coiled length of dragon-patterned rope",
    "Lizardfolk": "testing a bone knife beside a damp cistern",
    "Minotaur": "lowering broad horns before a charge through a stone gateway",
    "Satyr": "playing a reed pipe to calm a nervous mule",
    "Sea Elf": "filling a water jar at the market cistern with a shell-handled ladle",
    "Shadar-kai": "appearing from a shadowed arch with a raven-feather cloak",
    "Tabaxi": "climbing a soot-black roof beam with chalk and a curled tail",
    "Tortle": "turning a domed shell toward a shower of hot sparks",
    "Triton": "checking the forge waterwheel with a carved conch in hand",
    "Water Genasi": "guiding water through a narrow channel with a glazed blue cup",
    "Yuan-ti": "examining a sealed venom vial beside a serpent-headed walking staff",
    "Astral Elf": "aligning a brass astrolabe with a narrow view of the stars",
    "Autognome": "oiling a shoulder joint with a tiny crank-key tool",
    "Giff": "inspecting a carefully unloaded firearm with a powder horn nearby",
    "Hadozee": "gliding from a mine gantry while gripping a canvas sling",
    "Plasmoid": "slipping through a pipe opening with a sealed glass flask",
    "Thri-kreen": "filing two tools at once with separate pairs of hands",
    "Kender": "unfolding a hand-drawn map while balancing a length of rope",
    "Owlin": "landing silently beside a rolled dispatch tied with grey thread",
    "Loxodon": "lifting a heavy iron bell by its handle with a strong trunk",
    "Simic Hybrid": "checking a small vial beside newly grown fin-like limbs",
    "Vedalken": "measuring an alloy sample with a precise steel caliper",
    "Leonin": "sharpening a short blade with broad feline paws",
    "Locathah": "repairing a fish net beside a water barrel",
    "Verdan": "delivering a sealed message from a deep mine gallery",
    "Grung": "leaping over a puddle with a woven reed tube",
    "Half-Elf": "sketching the mountain skyline in charcoal on rough paper",
    "Half-Orc": "dragging a heavy ore hook clear of a crowded rail",
}
