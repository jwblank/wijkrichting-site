# WijkRichting 2.0

WijkRichting is een compact, statisch onderzoeksproduct dat één vraag centraal stelt:

> Waar ontwikkelt een wijk zich opvallend, waar lijkt die ontwikkeling op en wat leert het verleden ons over mogelijke vervolgrichtingen?

De openbare site staat op [jwblank.github.io/wijkrichting-site](https://jwblank.github.io/wijkrichting-site/).

## Wat de site toont

De interface is bewust beperkt tot drie onderdelen:

1. **Het kernbeeld** — de sterkste onderbouwde conclusie in gewone taal.
2. **De ontwikkelrichting** — de werkelijke wijkreeks en de landelijke percentielpositie voor peer-afwijking, profielbeweging en historisch precedent.
3. **De historische spiegel** — de mediaan en middelste 50% van wat 30 historische wijk-tweelingen in de twee jaar daarna werkelijk lieten zien.

Leefbaarheid, veiligheid en brede gemeentelijke overzichten zijn uit de hoofdflow verwijderd. Ze droegen onvoldoende bij aan de centrale vraag en maakten het product meer dashboard dan onderzoeksproduct.

## Methode in het kort

De vooraf berekende analyse gebruikt negen structurele kenmerken, verdeeld over demografie, woningstructuur, woningmarkt en sociaaleconomie. Domeinen tellen gelijk mee. Voor de historische spiegel blijft eerst de 25% structureel best passende historie over. Daarna worden profiel en wijk-specifiek traject ieder voor 50% gewogen en worden de 30 beste analogieën samengevat.

De instellingen zijn in de vorige databuild afgesteld op 2020→2022 en voor deze update bevroren. Daarna zijn ze opnieuw, volledig buiten de afstelperiode, beoordeeld op 2023→2025 (`n=2.177`):

- in 53,1% van de wijken was de analogiemethode nauwkeuriger dan de landelijke trend;
- in 78,8% was zij nauwkeuriger dan het doortrekken van de recente lokale afwijking;
- trajectinformatie verlaagde de mediane fout in deze nieuwste holdout niet: de fout was 0,5% hoger dan bij alleen profielmatching.

De meerwaarde ten opzichte van de landelijke trend is bescheiden. Het afzonderlijke lineaire trendscenario wordt daarom niet als voorspelling in de hoofdinterface gebruikt.

Historische analogieën beschrijven empirische vervolgrichtingen, geen causale of zekere voorspelling. Alleen wijkcodes die in de tussenliggende CBS-jaargangen aanwezig zijn en geen bekende indelingswijziging hebben, worden gebruikt.

## Data en architectuur

Deze repository bevat de openbare presentatielaag en vooraf berekende JSON-resultaten voor meer dan 2.000 wijken in 341 gemeenten. De private analysemotor publiceert gevalideerde statische output naar deze repository.

Bronnen in de huidige databuild:

- CBS Kerncijfers Wijken en Buurten, 2019–2025;
- Leefbaarometer 3.0, t/m 2024;
- Politie/CBS 47022NED, voortschrijdende twaalf maanden t/m september 2026, als aanvullende veiligheidscontext.

De browser voert geen matching of modelberekeningen uit. Daardoor blijft de publieke site snel, controleerbaar en onderhoudsarm.

## Automatische controle en publicatie

Voer lokaal uit:

```bash
npm run check
```

De controle valideert JavaScript-syntax, alle gemeente-indexkoppelingen, de minimale wijkdatastructuur, de historische holdout en de compacte drieledige pagina-opbouw. De GitHub Pages-workflow draait deze controle vóór publicatie. Bij een fout wordt geen nieuwe versie uitgerold en blijft de laatst gevalideerde publicatie online.

Elke push naar `main` publiceert na een geslaagde controle automatisch via GitHub Pages.
