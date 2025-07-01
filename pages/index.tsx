import { useState, useEffect } from "react";
import AnimatedTreemapGDP from "../components/AnimatedTreemapGDP";
import BarChartRace from "../components/BarChartRace";

function findClosestYear(target, years) {
  if (!years || years.length === 0) return null;
  return years.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
  );
}

export default function Home() {
  const [data, setData] = useState<any[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [dataPerCapita, setDataPerCapita] = useState<any[]>([]);
  const [yearsPerCapita, setYearsPerCapita] = useState<number[]>([]);
  const [graph, setGraph] = useState<
    "treemap" | "barchart" | "treemap_percap" | "barchart_percap"
  >("treemap");
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [animValue, setAnimValue] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [countryFocus, setCountryFocus] = useState<string | null>(null);
  const [mode, setMode] = useState<"world" | "ffa">("world");
  const [selectedRegions, setSelectedRegions] = useState<null | string[]>(null);
  const [proportional, setProportional] = useState(true);

  useEffect(() => {
    fetch("/data/gdp_by_country_year_with_region.json")
      .then((res) => res.json())
      .then((json) => {
        const yearsSet = new Set(json.map((d: any) => d.year));
        const yearsArr = Array.from(yearsSet).map(Number).sort((a, b) => a - b);
        setData(json);
        setYears(yearsArr);
        if (activeYear == null) {
          setActiveYear(yearsArr[0]);
          setAnimValue(yearsArr[0]);
        }
      });
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    fetch("/data/gdp_per_capita_by_country_year.json")
      .then((res) => res.json())
      .then((json) => {
        const yearsSet = new Set(json.map((d: any) => d.year));
        const yearsArr = Array.from(yearsSet).map(Number).sort((a, b) => a - b);
        setDataPerCapita(json);
        setYearsPerCapita(yearsArr);
      });
  }, []);

  useEffect(() => {
    if (activeYear == null) return;
    let targetYears: number[] = [];
    if (graph === "treemap" || graph === "barchart") {
      targetYears = years;
    } else {
      targetYears = yearsPerCapita;
    }
    if (targetYears && targetYears.length > 0) {
      const closest = findClosestYear(activeYear, targetYears);
      if (closest !== activeYear) {
        setActiveYear(closest);
        setAnimValue(closest);
      }
    }
    // eslint-disable-next-line
  }, [graph, years, yearsPerCapita]);

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

  function handlePlayPause() {
    if (playing) {
      const snapped = Math.round(animValue ?? activeYear ?? years[0]);
      handleYearChange(snapped);
      setPlaying(false);
    } else {
      let maxYear =
        graph === "treemap" || graph === "barchart"
          ? years.at(-1)
          : yearsPerCapita.at(-1);
      if ((animValue ?? activeYear ?? 0) >= (maxYear ?? 9999) - 0.01) {
        handleYearChange(
          graph === "treemap" || graph === "barchart" ? years[0] : yearsPerCapita[0]
        );
        setTimeout(() => setPlaying(true), 0);
      } else {
        setPlaying(true);
      }
    }
  }

  const isLoading =
    (["treemap", "barchart"].includes(graph) &&
      (years.length === 0 ||
        data.length === 0 ||
        activeYear == null ||
        animValue == null)) ||
    (["treemap_percap", "barchart_percap"].includes(graph) &&
      (yearsPerCapita.length === 0 ||
        dataPerCapita.length === 0 ||
        activeYear == null ||
        animValue == null));

  if (isLoading)
    return (
      <div className="flex-1 flex items-center justify-center w-full h-full bg-[#1E2D2F]">
        <div className="text-xl text-slate-100">Loading…</div>
      </div>
    );

  const currentData =
    graph === "treemap" || graph === "barchart" ? data : dataPerCapita;
  const currentYears =
    graph === "treemap" || graph === "barchart" ? years : yearsPerCapita;

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
      {/* Onglets de graph, compact */}
      <div className="w-full mb-2">
        <div
          className="flex flex-wrap justify-center items-center gap-2 p-2 rounded-2xl"
          style={{
            flexWrap: "wrap",
            gap: "0.15rem 0.35rem",
            marginBottom: 0,
            minHeight: "38px",
          }}
        >
          {[
            { value: "treemap", label: "GDP TREEMAP" },
            { value: "barchart", label: "GDP BAR" },
            { value: "treemap_percap", label: "GDP/hab TREEMAP" },
            { value: "barchart_percap", label: "GDP/hab BAR" },
          ].map((btn) => (
            <button
              key={btn.value}
              onClick={() => setGraph(btn.value as any)}
              className={`graph-btn${graph === btn.value ? " graph-btn--active" : ""}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content : graph 100% largeur */}
      <div
        className="w-full flex flex-col"
        style={{
          flex: 1,
          minHeight: 0,
          width: "100vw",
          padding: 0,
          display: "flex",
          flexDirection: "column",
        }}
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
            setFreeForAll={(ffa) => setMode(ffa ? "ffa" : "world")}
            proportional={proportional}
            setProportional={setProportional}
            mode={mode}
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
            isPerCapita={false}
          />
        )}
        {graph === "treemap_percap" && (
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
            setFreeForAll={(ffa) => setMode(ffa ? "ffa" : "world")}
            proportional={proportional}
            setProportional={setProportional}
            mode={mode}
          />
        )}
        {graph === "barchart_percap" && (
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
            isPerCapita={true}
          />
        )}
      </div>
    </div>
  );
}
