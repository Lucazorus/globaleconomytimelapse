import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import AnimatedTreemapGDP from "../components/AnimatedTreemapGDP";
import BarChartRace from "../components/BarChartRace";
import { useLang } from "../lib/LangContext";

// --- Helpers ---
function findClosestYear(target: number, years: number[]): number | null {
  if (!years || years.length === 0) return null;
  return years.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
  );
}

// --- URL parsing helpers ---
type ChartType = "treemap" | "barchart";
type MetricType = "gdp" | "percap" | "ppp";
const VALID_CHARTS: ChartType[] = ["treemap", "barchart"];
const VALID_METRICS: MetricType[] = ["gdp", "percap", "ppp"];

// Keep GraphType for URL compat
type GraphType = "treemap" | "barchart";

// METRIC_INFO is built dynamically from translations — see getMetricInfo() below

function parseChart(val: string | string[] | undefined): ChartType {
  if (typeof val === "string" && VALID_CHARTS.includes(val as ChartType)) {
    return val as ChartType;
  }
  return "treemap";
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
  return "treemap";
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

function parseCountry(val: string | string[] | undefined): string | null {
  if (typeof val === "string" && val.trim() !== "") return val.trim();
  return null;
}

export default function Home() {
  const router = useRouter();
  const { t } = useLang();

  // Empêche l'écriture URL avant la lecture initiale
  const urlInitialized = useRef(false);
  // Année issue de l'URL, en attente que les données soient chargées
  const pendingUrlYear = useRef<number | null>(null);
  // Auto-play au premier chargement (une seule fois)
  const hasAutoPlayed = useRef(false);

  const [data, setData] = useState<any[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [dataPerCapita, setDataPerCapita] = useState<any[]>([]);
  const [yearsPerCapita, setYearsPerCapita] = useState<number[]>([]);
  const [dataPercapPpp, setDataPercapPpp] = useState<any[]>([]);
  const [yearsPercapPpp, setYearsPercapPpp] = useState<number[]>([]);

  const [graph, setGraph] = useState<ChartType>("treemap");
  const [metric, setMetric] = useState<MetricType>("gdp");
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [animValue, setAnimValue] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [countryFocus, setCountryFocus] = useState<string | null>(null);
  const [mode, setMode] = useState<"world" | "ffa">("world");
  const [selectedRegions, setSelectedRegions] = useState<null | string[]>(null);
  const [proportional, setProportional] = useState(false);
  const [topN, setTopN] = useState(20);

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
    setCountryFocus(parseCountry(q.country));

    pendingUrlYear.current = parseYear(q.year);

    urlInitialized.current = true;
    // eslint-disable-next-line
  }, [router.isReady]);

  // --- Étape 2 : Fetch GDP total ---
  useEffect(() => {
    fetch("/data/gdp_by_country_year_with_region.json")
      .then((res) => res.json())
      .then((json) => {
        const yearsSet = new Set(json.map((d: any) => d.year));
        const yearsArr = Array.from(yearsSet).map(Number).sort((a, b) => a - b) as number[];
        setData(json);
        setYears(yearsArr);
        if (activeYear == null) {
          const targetYear =
            pendingUrlYear.current != null
              ? findClosestYear(pendingUrlYear.current, yearsArr) ?? yearsArr[0]
              : yearsArr[0];
          setActiveYear(targetYear);
          setAnimValue(targetYear);
          // Auto-play dès le premier chargement
          if (!hasAutoPlayed.current) {
            hasAutoPlayed.current = true;
            setTimeout(() => setPlaying(true), 300);
          }
        }
      });
    // eslint-disable-next-line
  }, []);

  // --- Étape 3 : Fetch GDP per capita ---
  useEffect(() => {
    fetch("/data/gdp_per_capita_by_country_year.json")
      .then((res) => res.json())
      .then((json) => {
        const yearsSet = new Set(json.map((d: any) => d.year));
        const yearsArr = Array.from(yearsSet).map(Number).sort((a, b) => a - b) as number[];
        setDataPerCapita(json);
        setYearsPerCapita(yearsArr);
      });
  }, []);

  // --- Étape 3b : Fetch GDP per capita PPP ---
  useEffect(() => {
    fetch("/data/gdp_per_capita_ppp_by_country_year.json")
      .then((res) => res.json())
      .then((json) => {
        const yearsSet = new Set(json.map((d: any) => d.year));
        const yearsArr = Array.from(yearsSet).map(Number).sort((a, b) => a - b) as number[];
        setDataPercapPpp(json);
        setYearsPercapPpp(yearsArr);
      });
  }, []);

  // --- Étape 4 : Snap année au plus proche quand la métrique change ---
  useEffect(() => {
    if (activeYear == null) return;
    let targetYears: number[];
    if (metric === "gdp") targetYears = years;
    else if (metric === "percap") targetYears = yearsPerCapita;
    else targetYears = yearsPercapPpp;
    if (targetYears && targetYears.length > 0) {
      const closest = findClosestYear(activeYear, targetYears);
      if (closest !== activeYear && closest != null) {
        setActiveYear(closest);
        setAnimValue(closest);
      }
    }
    // eslint-disable-next-line
  }, [metric, years, yearsPerCapita, yearsPercapPpp]);

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
    if (countryFocus) {
      query.country = countryFocus;
    }

    router.replace({ pathname: "/", query }, undefined, { shallow: true });
    // eslint-disable-next-line
  }, [graph, metric, activeYear, mode, proportional, selectedRegions, countryFocus]);

  // --- Handlers ---
  const handleYearChange = (val: number | ((v: number) => number)) => {
    setAnimValue((prev) =>
      typeof val === "function" ? val(prev ?? activeYear ?? years[0]) : val
    );
    setActiveYear((prev) =>
      typeof val === "function"
        ? Math.round(val(animValue ?? activeYear ?? years[0]))
        : Math.round(val)
    );
  };

  function getActiveYears(): number[] {
    if (metric === "gdp") return years;
    if (metric === "percap") return yearsPerCapita;
    return yearsPercapPpp;
  }

  function handlePlayPause() {
    if (playing) {
      const snapped = Math.round(animValue ?? activeYear ?? years[0]);
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
  const currentDataForSearch =
    metric === "gdp" ? data :
    metric === "percap" ? dataPerCapita :
    dataPercapPpp;

  const allCountries: string[] = Array.from(
    new Set(
      currentDataForSearch.map((d: any) => d.country as string).filter(Boolean)
    )
  ).sort();

  const filteredCountries =
    searchInput.trim() === ""
      ? allCountries
      : allCountries.filter((c) =>
          c.toLowerCase().includes(searchInput.toLowerCase())
        );

  // Sync input ← countryFocus (clic dans le graphe)
  useEffect(() => {
    setSearchInput(countryFocus ?? "");
  }, [countryFocus]);

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
    setCountryFocus(country);
    setSearchInput(country);
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
    setCountryFocus(null);
    setSearchInput("");
    setSearchOpen(false);
  }

  // --- Loading guard ---
  const isLoading =
    activeYear == null || animValue == null ||
    (metric === "gdp" && (years.length === 0 || data.length === 0)) ||
    (metric === "percap" && (yearsPerCapita.length === 0 || dataPerCapita.length === 0)) ||
    (metric === "ppp" && (yearsPercapPpp.length === 0 || dataPercapPpp.length === 0));

  if (isLoading)
    return (
      <div className="flex-1 flex items-center justify-center w-full h-full bg-[#1E2D2F]">
        <div className="text-xl text-slate-100">{t.loading}</div>
      </div>
    );

  const currentData =
    metric === "gdp" ? data :
    metric === "percap" ? dataPerCapita :
    dataPercapPpp;
  const currentYears =
    metric === "gdp" ? years :
    metric === "percap" ? yearsPerCapita :
    yearsPercapPpp;
  const isPerCapita = metric === "percap" || metric === "ppp";

  const metricInfo: Record<MetricType, { label: string; title: string; description: string; example: string }> = {
    gdp:    { label: t.gdpLabel,    title: t.gdpTitle,    description: t.gdpDesc,    example: t.gdpExample },
    percap: { label: t.percapLabel, title: t.percapTitle, description: t.percapDesc, example: t.percapExample },
    ppp:    { label: t.pppLabel,    title: t.pppTitle,    description: t.pppDesc,    example: t.pppExample },
  };
  const info = metricInfo[metric];

  return (
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
          {(["treemap", "barchart"] as ChartType[]).map((c) => (
            <button
              key={c}
              onClick={() => setGraph(c)}
              className={`graph-btn${graph === c ? " graph-btn--active" : ""}`}
            >
              {c === "treemap" ? t.treemap : t.barchart}
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
                placeholder={t.searchPlaceholder}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearchOpen(true);
                  if (e.target.value === "") setCountryFocus(null);
                }}
                onFocus={() => setSearchOpen(true)}
                autoComplete="off"
                spellCheck={false}
              />
              {(searchInput || countryFocus) && (
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
                      countryFocus === country ? " country-search-item--active" : ""
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
            setCountryFocus={setCountryFocus}
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
            setCountryFocus={setCountryFocus}
            selectedRegions={selectedRegions}
            setSelectedRegions={setSelectedRegions}
            isPerCapita={isPerCapita}
            topN={topN}
            setTopN={setTopN}
            metricLabel={info.label}
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
  );
}
