import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import AnimatedTreemapGDP from "../components/AnimatedTreemapGDP";
import BarChartRace from "../components/BarChartRace";
import BumpChart from "../components/BumpChart";
import { useLang } from "../lib/LangContext";
import { loadMetric, MetricDataset } from "../lib/loadMetric";
import { SITE_URL } from "../lib/site";

// --- Helpers ---
function findClosestYear(target: number, years: number[]): number | null {
  if (!years || years.length === 0) return null;
  return years.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
  );
}

// --- URL parsing helpers ---
type ChartType = "treemap" | "barchart" | "bumpchart";
type MetricType = "gdp" | "percap" | "ppp";
const VALID_CHARTS: ChartType[] = ["treemap", "barchart", "bumpchart"];
const VALID_METRICS: MetricType[] = ["gdp", "percap", "ppp"];

// Keep GraphType for URL compat
type GraphType = ChartType;

// Nombre max de pays épinglés simultanément (focus multi sur le bump chart)
const MAX_FOCUS = 4;

// METRIC_INFO is built dynamically from translations — see getMetricInfo() below

function parseChart(val: string | string[] | undefined): ChartType {
  if (typeof val === "string" && VALID_CHARTS.includes(val as ChartType)) {
    return val as ChartType;
  }
  return "bumpchart";
}

function parseMetric(val: string | string[] | undefined): MetricType {
  if (typeof val === "string" && VALID_METRICS.includes(val as MetricType)) {
    return val as MetricType;
  }
  return "gdp";
}

function parseGraph(val: string | string[] | undefined): GraphType {
  if (typeof val === "string" && VALID_CHARTS.includes(val as ChartType)) {
    return val as GraphType;
  }
  return "bumpchart";
}

function parseMode(val: string | string[] | undefined): "world" | "ffa" {
  if (val === "ffa") return "ffa";
  return "world";
}

function parseRegions(val: string | string[] | undefined): string[] | null {
  if (typeof val !== "string" || val.trim() === "") return null;
  const arr = val.split(",").map((r) => r.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
}

function parseProportional(val: string | string[] | undefined): boolean {
  if (val === "true") return true;
  return false;
}

function parseYear(val: string | string[] | undefined): number | null {
  if (typeof val !== "string") return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

// Séparateur "|" : certains noms de pays contiennent une virgule ("Korea, Rep.").
// Une valeur simple sans séparateur (anciennes URLs) reste valide.
function parseCountries(val: string | string[] | undefined): string[] {
  if (typeof val !== "string" || val.trim() === "") return [];
  return val.split("|").map((c) => c.trim()).filter(Boolean).slice(0, MAX_FOCUS);
}

export default function Home() {
  const router = useRouter();
  const { t, lang } = useLang();

  // Empêche l'écriture URL avant la lecture initiale
  const urlInitialized = useRef(false);
  // Année issue de l'URL, en attente que les données soient chargées
  const pendingUrlYear = useRef<number | null>(null);
  // Auto-play au premier chargement (une seule fois)
  const hasAutoPlayed = useRef(false);

  // Datasets chargés à la demande, mis en cache par métrique
  const [datasets, setDatasets] = useState<Partial<Record<MetricType, MetricDataset>>>({});
  const loadingMetrics = useRef<Set<MetricType>>(new Set());
  const [urlReady, setUrlReady] = useState(false);

  const [graph, setGraph] = useState<ChartType>("treemap");
  const [metric, setMetric] = useState<MetricType>("gdp");
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [animValue, setAnimValue] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  // Pays épinglés : multi sur le bump chart, le premier sert de focus
  // unique pour le treemap et le bar chart
  const [focusCountries, setFocusCountries] = useState<string[]>([]);
  const [mode, setMode] = useState<"world" | "ffa">("world");
  const [selectedRegions, setSelectedRegions] = useState<null | string[]>(null);
  const [proportional, setProportional] = useState(false);
  const [topN, setTopN] = useState(20);

  const countryFocus = focusCountries.length > 0 ? focusCountries[0] : null;
  const setCountryFocusSingle = (v: string | null) => setFocusCountries(v ? [v] : []);

  // --- Étape 1 : Lecture URL au mount (une seule fois) ---
  useEffect(() => {
    if (!router.isReady) return;
    if (urlInitialized.current) return;

    const q = router.query;

    setGraph(parseChart(q.graph));
    setMetric(parseMetric(q.metric));
    setMode(parseMode(q.mode));
    setSelectedRegions(parseRegions(q.region));
    setProportional(parseProportional(q.proportional));
    setFocusCountries(parseCountries(q.country));

    pendingUrlYear.current = parseYear(q.year);

    urlInitialized.current = true;
    setUrlReady(true);
    // eslint-disable-next-line
  }, [router.isReady]);

  // --- Étape 2 : Chargement lazy de la métrique active (avec cache) ---
  // On attend la lecture de l'URL pour ne charger que la métrique demandée.
  useEffect(() => {
    if (!urlReady) return;
    const m = metric;
    if (datasets[m] || loadingMetrics.current.has(m)) return;
    loadingMetrics.current.add(m);
    loadMetric(m)
      .then((ds) => {
        setDatasets((prev) => ({ ...prev, [m]: ds }));
      })
      .catch((err) => {
        console.error(`Failed to load metric ${m}:`, err);
      })
      .finally(() => {
        loadingMetrics.current.delete(m);
      });
    // eslint-disable-next-line
  }, [urlReady, metric, datasets]);

  // --- Étape 3 : Initialisation de l'année au premier dataset chargé ---
  useEffect(() => {
    const ds = datasets[metric];
    if (!ds || ds.years.length === 0 || activeYear != null) return;
    const targetYear =
      pendingUrlYear.current != null
        ? findClosestYear(pendingUrlYear.current, ds.years) ?? ds.years[0]
        : ds.years[0];
    setActiveYear(targetYear);
    setAnimValue(targetYear);
    // Auto-play dès le premier chargement
    if (!hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      setTimeout(() => setPlaying(true), 300);
    }
    // eslint-disable-next-line
  }, [datasets, metric, activeYear]);

  // --- Étape 4 : Snap année au plus proche quand la métrique change ---
  useEffect(() => {
    if (activeYear == null) return;
    const targetYears = datasets[metric]?.years;
    if (targetYears && targetYears.length > 0) {
      const closest = findClosestYear(activeYear, targetYears);
      if (closest !== activeYear && closest != null) {
        setActiveYear(closest);
        setAnimValue(closest);
      }
    }
    // eslint-disable-next-line
  }, [metric, datasets]);

  // --- Étape 5 : Sync état → URL (shallow replace) ---
  useEffect(() => {
    if (!urlInitialized.current || activeYear == null) return;

    const query: Record<string, string> = {
      graph,
      metric,
      year: String(activeYear),
      mode,
      proportional: String(proportional),
    };
    if (selectedRegions && selectedRegions.length > 0) {
      query.region = selectedRegions.join(",");
    }
    if (focusCountries.length > 0) {
      query.country = focusCountries.join("|");
    }

    router.replace({ pathname: "/", query }, undefined, { shallow: true });
    // eslint-disable-next-line
  }, [graph, metric, activeYear, mode, proportional, selectedRegions, focusCountries]);

  // --- Dataset courant (métrique active) ---
  // Si la métrique active n'est pas encore chargée, on continue d'afficher la
  // précédente : le graphe reste monté, son animation n'est jamais interrompue.
  const displayedMetricRef = useRef<MetricType | null>(null);
  if (datasets[metric]) displayedMetricRef.current = metric;
  const displayedMetric = displayedMetricRef.current ?? metric;
  const currentDataset = datasets[displayedMetric];
  const currentData = currentDataset?.rows ?? [];
  const currentYears = currentDataset?.years ?? [];

  // --- Handlers ---
  const handleYearChange = (val: number | ((v: number) => number)) => {
    setAnimValue((prev) =>
      typeof val === "function" ? val(prev ?? activeYear ?? currentYears[0]) : val
    );
    setActiveYear((prev) =>
      typeof val === "function"
        ? Math.round(val(animValue ?? activeYear ?? currentYears[0]))
        : Math.round(val)
    );
  };

  function getActiveYears(): number[] {
    return currentYears;
  }

  function handlePlayPause() {
    if (playing) {
      const snapped = Math.round(animValue ?? activeYear ?? currentYears[0]);
      handleYearChange(snapped);
      setPlaying(false);
    } else {
      const activeYears = getActiveYears();
      const maxYear = activeYears.at(-1);
      if ((animValue ?? activeYear ?? 0) >= (maxYear ?? 9999) - 0.01) {
        handleYearChange(activeYears[0]);
        setTimeout(() => setPlaying(true), 0);
      } else {
        setPlaying(true);
      }
    }
  }

  // --- Recherche de pays ---
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Dataset courant pour la liste des pays
  const currentDataForSearch = currentData;

  const allCountries: string[] = Array.from(
    new Set(
      currentDataForSearch.map((d: any) => d.country as string).filter(Boolean)
    )
  ).sort();

  // Sur le bump chart, masquer les pays déjà épinglés
  const searchableCountries =
    graph === "bumpchart"
      ? allCountries.filter((c) => !focusCountries.includes(c))
      : allCountries;

  const filteredCountries =
    searchInput.trim() === ""
      ? searchableCountries
      : searchableCountries.filter((c) =>
          c.toLowerCase().includes(searchInput.toLowerCase())
        );

  // Sync input ← countryFocus (clic dans le graphe).
  // Sur le bump chart les pays épinglés sont affichés en chips : l'input reste vide.
  useEffect(() => {
    setSearchInput(graph === "bumpchart" ? "" : countryFocus ?? "");
  }, [countryFocus, graph]);

  // Fermeture dropdown au clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearchSelect(country: string) {
    if (graph === "bumpchart") {
      // Bump chart : la recherche AJOUTE le pays aux épinglés (comparaison)
      setFocusCountries((current) => {
        if (current.includes(country)) return current;
        const next = [...current, country];
        // Au-delà de la limite, on retire le plus ancien
        return next.length > MAX_FOCUS ? next.slice(next.length - MAX_FOCUS) : next;
      });
      setSearchInput("");
    } else {
      // Treemap / bar chart : focus unique (comportement historique)
      setFocusCountries([country]);
      setSearchInput(country);
    }
    setSearchOpen(false);

    // Si on a un filtre de régions actif (pas World), auto-ajouter la région du pays
    setSelectedRegions((current) => {
      // World (null) = pas de filtre, toutes les régions visibles — rien à faire
      if (!current || current.length === 0) return current;
      // Trouver la région du pays dans les données courantes
      const countryRecord = currentDataForSearch.find((d: any) => d.country === country);
      const region = countryRecord?.region;
      if (!region || region === "Other") return current;
      // Si la région est déjà sélectionnée, rien à faire
      if (current.includes(region)) return current;
      // Sinon, ajouter la région au filtre actif
      return [...current, region];
    });
  }

  function handleSearchClear() {
    setFocusCountries([]);
    setSearchInput("");
    setSearchOpen(false);
  }

  // --- SEO : titre dynamique + Open Graph / Twitter cards ---
  const metricLabels: Record<MetricType, string> = {
    gdp: t.gdpLabel,
    percap: t.percapLabel,
    ppp: t.pppLabel,
  };
  const pageTitle =
    activeYear != null
      ? `${metricLabels[metric]} ${activeYear} — Global Economy Timelapse`
      : `Global Economy Timelapse — ${t.metaTagline}`;
  const ogImage = `${SITE_URL}/og-image.png`;
  const seoHead = (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={t.metaDescription} />
      <link rel="canonical" href={SITE_URL} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Global Economy Timelapse" />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={t.metaDescription} />
      <meta property="og:url" content={SITE_URL} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={lang === "fr" ? "fr_FR" : "en_US"} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={t.metaDescription} />
      <meta name="twitter:image" content={ogImage} />
    </Head>
  );

  // --- Loading guard ---
  const isLoading =
    activeYear == null || animValue == null ||
    !currentDataset || currentYears.length === 0;

  if (isLoading)
    return (
      <>
        {seoHead}
        <div className="flex-1 flex items-center justify-center w-full h-full bg-[#1E2D2F]">
          <div className="text-xl text-slate-100">{t.loading}</div>
        </div>
      </>
    );

  const isPerCapita = displayedMetric === "percap" || displayedMetric === "ppp";

  const metricInfo: Record<MetricType, { label: string; title: string; description: string; example: string }> = {
    gdp:    { label: t.gdpLabel,    title: t.gdpTitle,    description: t.gdpDesc,    example: t.gdpExample },
    percap: { label: t.percapLabel, title: t.percapTitle, description: t.percapDesc, example: t.percapExample },
    ppp:    { label: t.pppLabel,    title: t.pppTitle,    description: t.pppDesc,    example: t.pppExample },
  };
  const info = metricInfo[displayedMetric];

  return (
    <>
    {seoHead}
    <div
      className="flex-1 flex flex-col w-full"
      style={{
        width: "100vw",
        minHeight: 0,
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: 0,
      }}
    >
      {/* Barre de contrôles — 2 lignes */}
      <div className="w-full mb-1">
        {/* Ligne 1 : type de graphe */}
        <div
          className="flex justify-center items-center"
          style={{ gap: "0 0.15rem", paddingTop: "0.35rem", paddingBottom: "0.1rem" }}
        >
          {(["bumpchart", "barchart", "treemap"] as ChartType[]).map((c) => (
            <button
              key={c}
              onClick={() => setGraph(c)}
              className={`graph-btn${graph === c ? " graph-btn--active" : ""}`}
            >
              {c === "treemap" ? t.treemap : c === "barchart" ? t.barchart : t.bumpchart}
            </button>
          ))}
        </div>

        {/* Ligne 2 : métrique + recherche pays */}
        <div
          className="flex flex-wrap justify-center items-center"
          style={{ gap: "0.1rem 0.2rem", paddingBottom: "0.3rem" }}
        >
          {/* Boutons métrique — style pill */}
          {(Object.entries(metricInfo) as [MetricType, { label: string }][]).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setMetric(key as MetricType)}
              className={`metric-btn${metric === key ? " metric-btn--active" : ""}`}
            >
              {val.label}
            </button>
          ))}

          {/* Séparateur visuel */}
          <span style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.14)", margin: "0 0.2rem" }} />

          {/* Widget de recherche pays */}
          <div ref={searchRef} className="country-search-wrapper">
            <div className="country-search-input-row">
              <input
                type="text"
                className="country-search-input select-glass"
                placeholder={graph === "bumpchart" ? t.addCountryPlaceholder : t.searchPlaceholder}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearchOpen(true);
                  if (e.target.value === "" && graph !== "bumpchart") setFocusCountries([]);
                }}
                onFocus={() => setSearchOpen(true)}
                autoComplete="off"
                spellCheck={false}
              />
              {(searchInput || focusCountries.length > 0) && (
                <button
                  className="country-search-clear"
                  onClick={handleSearchClear}
                  tabIndex={-1}
                  aria-label={t.searchClear}
                >
                  ×
                </button>
              )}
            </div>
            {searchOpen && filteredCountries.length > 0 && (
              <ul className="country-search-dropdown">
                {filteredCountries.slice(0, 40).map((country) => (
                  <li
                    key={country}
                    className={`country-search-item${
                      focusCountries.includes(country) ? " country-search-item--active" : ""
                    }`}
                    onMouseDown={() => handleSearchSelect(country)}
                  >
                    {country}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

      {/* Graphe pleine largeur */}
      <div
        className="w-full flex flex-col"
        style={{ flex: 1, minHeight: 0, width: "100vw", padding: 0, display: "flex", flexDirection: "column" }}
      >
        {graph === "treemap" && (
          <AnimatedTreemapGDP
            data={currentData}
            years={currentYears}
            animValue={animValue}
            playing={playing}
            setPlaying={setPlaying}
            onYearChange={handleYearChange}
            countryFocus={countryFocus}
            setCountryFocus={setCountryFocusSingle}
            selectedRegions={selectedRegions}
            setSelectedRegions={setSelectedRegions}
            freeForAll={mode === "ffa"}
            setFreeForAll={(ffa: boolean) => setMode(ffa ? "ffa" : "world")}
            proportional={proportional}
            setProportional={setProportional}
            mode={mode}
            metricLabel={info.label}
          />
        )}
        {graph === "barchart" && (
          <BarChartRace
            data={currentData}
            years={currentYears}
            year={activeYear}
            animValue={animValue}
            playing={playing}
            setPlaying={setPlaying}
            onYearChange={handleYearChange}
            countryFocus={countryFocus}
            setCountryFocus={setCountryFocusSingle}
            selectedRegions={selectedRegions}
            setSelectedRegions={setSelectedRegions}
            isPerCapita={isPerCapita}
            topN={topN}
            setTopN={setTopN}
            metricLabel={info.label}
            groupEU={displayedMetric === "gdp"}
          />
        )}
        {graph === "bumpchart" && (
          <BumpChart
            data={currentData}
            years={currentYears}
            animValue={animValue}
            playing={playing}
            setPlaying={setPlaying}
            onYearChange={handleYearChange}
            focusCountries={focusCountries}
            setFocusCountries={setFocusCountries}
            selectedRegions={selectedRegions}
            setSelectedRegions={setSelectedRegions}
            isPerCapita={isPerCapita}
            topN={topN}
            setTopN={setTopN}
            metricLabel={info.label}
            groupEU={displayedMetric === "gdp"}
          />
        )}
      </div>

      {/* Encart explicatif compact sous le graphe */}
      <div style={{
        padding: "0.3rem 1.2rem 0.4rem",
        color: "rgba(255,255,255,0.38)",
        fontSize: "0.7rem",
        lineHeight: 1.4,
        display: "flex",
        flexWrap: "wrap",
        gap: "0 0.5rem",
        alignItems: "baseline",
      }}>
        <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>{info.title} —</span>
        <span>{info.description}</span>
        <span style={{ fontStyle: "italic", opacity: 0.7 }}>{info.example}</span>
      </div>
    </div>
    </>
  );
}
