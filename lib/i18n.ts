export type Lang = "fr" | "en";

export const TRANSLATIONS = {
  fr: {
    // Navbar / Layout
    langToggle: "Langue",

    // Onglets
    treemap: "TREEMAP",
    barchart: "BAR CHART",

    // Métriques labels (dropdown)
    gdpLabel: "PIB total",
    percapLabel: "PIB / habitant",
    pppLabel: "PIB/hab (PPA)",

    // Encart explicatif
    gdpTitle: "Produit Intérieur Brut (PIB)",
    gdpDesc: "La valeur totale de tout ce qu'un pays produit en un an : voitures, logiciels, services médicaux, cafés… C'est la taille brute de l'économie, en dollars.",
    gdpExample: "Les États-Unis ont un PIB de ~28 000 Mds $. La Chine ~18 000 Mds $. Mais ça ne dit rien du niveau de vie des habitants.",

    percapTitle: "PIB par habitant",
    percapDesc: "Le PIB divisé par la population. Ça donne une idée du niveau de richesse moyen par personne dans un pays.",
    percapExample: "Le Luxembourg a un PIB/hab de ~130 000 $/an, l'Inde ~2 500 $/an. Mais attention : vivre avec 2 500 $ en Inde n'est pas la même chose qu'en Occident.",

    pppTitle: "PIB par habitant en Parité de Pouvoir d'Achat",
    pppDesc: "Le PIB/hab ajusté pour tenir compte du coût de la vie local. Un dollar achète plus de choses en Inde qu'aux États-Unis — la PPA corrige cet effet pour comparer le niveau de vie réel.",
    pppExample: "En PIB/hab nominal, la Chine semble 6× plus pauvre que les USA. En PPA, l'écart est bien plus faible car les prix y sont beaucoup plus bas.",

    // UI générale
    loading: "Chargement…",
    searchPlaceholder: "Rechercher un pays…",
    searchClear: "Effacer",

    // Composants graphes
    world: "🌍 Monde",
    freeForAll: "Libre",
    proportional: "Proportionnel",
    nonProp: "Non prop.",
    focusedCountry: "Pays sélectionné",
    gdpAtYear: "PIB cette année",
    clear: "Effacer",
    top: "Top",
  },
  en: {
    langToggle: "Language",

    treemap: "TREEMAP",
    barchart: "BAR CHART",

    gdpLabel: "Total GDP",
    percapLabel: "GDP / capita",
    pppLabel: "GDP/cap (PPP)",

    gdpTitle: "Gross Domestic Product (GDP)",
    gdpDesc: "The total value of everything a country produces in a year: cars, software, medical services, cafés… It measures the raw size of an economy, in dollars.",
    gdpExample: "The US has a GDP of ~$28T. China ~$18T. But it says nothing about the living standards of the population.",

    percapTitle: "GDP per capita",
    percapDesc: "GDP divided by population. It gives a rough idea of the average wealth per person in a country.",
    percapExample: "Luxembourg has a GDP/capita of ~$130,000/year, India ~$2,500/year. But living on $2,500 in India is very different from living on it in the West.",

    pppTitle: "GDP per capita, Purchasing Power Parity (PPP)",
    pppDesc: "GDP per capita adjusted for local cost of living. A dollar buys more in India than in the US — PPP corrects for this to compare real living standards.",
    pppExample: "In nominal GDP/capita, China appears 6× poorer than the US. In PPP terms, the gap is much smaller because prices there are much lower.",

    loading: "Loading…",
    searchPlaceholder: "Search country…",
    searchClear: "Clear",

    world: "🌍 World",
    freeForAll: "Free for all",
    proportional: "Proportional",
    nonProp: "Non prop.",
    focusedCountry: "Focused Country",
    gdpAtYear: "GDP at this year",
    clear: "Clear",
    top: "Top",
  },
} as const;

export type Translations = typeof TRANSLATIONS["fr"];
