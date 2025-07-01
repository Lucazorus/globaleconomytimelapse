"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { REGION_LIST, regionColors } from "./Colors";
import PlayPauseButton from "./PlayPauseButton";

// Format espace pour les milliers
function formatNumberSpace(num: number) {
  if (typeof num !== "number" || isNaN(num)) return "";
  return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const margin = { top: 40, right: 40, bottom: 60, left: 40 };
const barHeight = 32;
const barPadding = 8;
const topN = 18;
const MIN_BAR_LABEL_WIDTH = 100;

interface CountryData {
  year: number;
  gdp: number;
  country: string;
  region: string;
  [key: string]: any; // fallback pour compatibilité données non typées
}

interface BarChartRaceProps {
  data: CountryData[];
  years: number[];
  year: number;
  animValue: number;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  onYearChange: (v: any) => void;
  countryFocus: string | null;
  setCountryFocus: (v: string | null) => void;
  selectedRegions: string[] | null;
  setSelectedRegions: React.Dispatch<React.SetStateAction<string[] | null>>;
  isPerCapita?: boolean;
}

export default function BarChartRace({
  data = [],
  years = [],
  year = 0,
  animValue = 0,
  playing,
  setPlaying,
  onYearChange,
  countryFocus,
  setCountryFocus,
  selectedRegions,
  setSelectedRegions,
  isPerCapita = false,
}: BarChartRaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 760 });

  // Safe resizing
  useEffect(() => {
    function handleResize() {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth || 1200;
      const barsHeight = topN * (barHeight + barPadding) + margin.top + margin.bottom;
      setContainerSize({
        width: Math.max(360, width),
        height: Math.max(400, Math.round(barsHeight)),
      });
    }
    handleResize();
    const observer = new window.ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", handleResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const width = containerSize.width;
  const height = containerSize.height;

  // Pour l’animation (toujours frais dans closures)
  const playingRef = useRef(playing);
  const yearRef = useRef(year);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { yearRef.current = year; }, [year]);

  // Liste des régions affichables (jamais "Other")
  const regionListClean = REGION_LIST.filter(r => r !== "Other");
  const getRegionsArray = () =>
    !selectedRegions || selectedRegions.length === 0
      ? regionListClean
      : selectedRegions.filter(r => r !== "Other");

  // Génère les keyframes pour chaque année
  function createKeyframes(
    data: CountryData[],
    years: number[],
    regions: string[] = regionListClean
  ): [number, CountryData[], number][] {
    return years.map((year) => {
      let yearData = data.filter(
        (d) =>
          d.year === year &&
          d.gdp > 0 &&
          d.region && d.region !== "Other" &&
          regions.includes(d.region)
      );
      const sorted = yearData
        .sort((a, b) => b.gdp - a.gdp)
        .slice(0, topN)
        .map((d, i) => ({ ...d, rank: i }));
      const maxValue = Math.max(0, ...sorted.map((d) => d.gdp));
      return [year, sorted, maxValue];
    });
  }

  // ToolTip logic
  function useTooltip() {
    const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: "" });
    function showTooltip(x: number, y: number, content: string) { setTooltip({ show: true, x, y, content }); }
    function hideTooltip() { setTooltip({ show: false, x: 0, y: 0, content: "" }); }
    return { tooltip, showTooltip, hideTooltip };
  }
  const { tooltip, showTooltip, hideTooltip } = useTooltip();

  // LABELS logic
  const labels = (svg: any) => {
    const x = d3.scaleLinear().range([margin.left, width - margin.right]);
    const y = (_d: any, i: number) => margin.top + i * (barHeight + barPadding);
    return (keyframe: any, transition: any) => {
      const [_, data, maxValue] = keyframe;
      x.domain([0, maxValue * 1.08]);
      svg.selectAll("text.country-label").remove();
      svg.selectAll("text.value-label").remove();

      data.forEach((d: any, i: number) => {
        const barLen = x(d.gdp) - margin.left;
        let countryX, valueX, anchor;
        let showOutside = barLen < MIN_BAR_LABEL_WIDTH;
        if (!showOutside) {
          countryX = x(d.gdp) - 14;
          valueX = x(d.gdp) + 18;
          anchor = "end";
        } else {
          countryX = x(d.gdp) + 8;
          valueX = x(d.gdp) + 24 + d.country.length * 10;
          anchor = "start";
        }
        svg.append("text")
          .attr("class", "country-label")
          .attr("x", countryX)
          .attr("y", y(d, i) + barHeight / 2 + 4)
          .attr("font-size", 15)
          .attr("fill", "#fff")
          .attr("font-family", "Inter, Arial, sans-serif")
          .attr("font-weight", 300)
          .attr("letter-spacing", "0.06em")
          .attr("text-anchor", anchor)
          .attr("cursor", "pointer")
          .attr("text-transform", "uppercase")
          .text(
            d.country.length < 20
              ? d.country.toUpperCase()
              : d.country.slice(0, 19).toUpperCase() + "…"
          )
          .on("click", () => setCountryFocus(d.country));

        let valueLabel = isPerCapita
          ? `$${formatNumberSpace(d.gdp)}`
          : `$${formatNumberSpace(Math.round(d.gdp / 1e6) / 1e3)}B`;

        svg.append("text")
          .attr("class", "value-label")
          .attr("x", valueX)
          .attr("y", y(d, i) + barHeight / 2 + 4)
          .attr("font-size", 17)
          .attr("fill", "#fff")
          .attr("opacity", 0.95)
          .attr("font-family", "Inter, Arial, sans-serif")
          .attr("font-weight", 300)
          .attr("letter-spacing", "0.04em")
          .attr("text-anchor", "start")
          .attr("text-transform", "uppercase")
          .attr("cursor", "pointer")
          .text(valueLabel)
          .on("click", () => setCountryFocus(d.country));
      });
    };
  };

  // BARS logic
  const bars = (svg: any) => {
    const x = d3.scaleLinear().range([margin.left, width - margin.right]);
    const y = (_d: any, i: number) => margin.top + i * (barHeight + barPadding);
    return (keyframe: any, transition: any) => {
      const [_, data, maxValue] = keyframe;
      x.domain([0, maxValue * 1.08]);
      const bar = svg
        .selectAll("g.bar")
        .data(data, (d: any) => d.country)
        .join(
          (enter: any) => {
            const g = enter.append("g").attr("class", "bar");
            g.attr("transform", (_d: any, i: number) => `translate(0,${y(_d, i)})`);
            g.append("rect")
              .attr("x", margin.left)
              .attr("y", 0)
              .attr("height", barHeight)
              .attr("width", (d: any) => x(d.gdp) - margin.left)
              .attr("fill", (d: any) =>
                countryFocus && d.country === countryFocus
                  ? "#FA003F"
                  : regionColors(d.region)
              )
              .attr("rx", 2)
              .attr("cursor", "pointer")
              .on("click", (_e: any, d: any) => setCountryFocus(d.country))
              .on("mousemove", function (e: any, d: any) {
                let valueLabel = isPerCapita
                  ? `$${formatNumberSpace(d.gdp)}`
                  : `$${formatNumberSpace(Math.round(d.gdp / 1e6) / 1e3)}B`;
                showTooltip(
                  e.clientX + 20,
                  e.clientY - 20,
                  `<b>${d.country}</b><br>${valueLabel}`
                );
              })
              .on("mouseleave", hideTooltip);
            return g;
          },
          (update: any) => {
            update.attr("transform", (_d: any, i: number) => `translate(0,${y(_d, i)})`);
            update
              .select("rect")
              .attr("fill", (d: any) =>
                countryFocus && d.country === countryFocus
                  ? "#FA003F"
                  : regionColors(d.region)
              );
            return update;
          },
          (exit: any) => exit.remove()
        );
      if (transition) {
        bar
          .transition(transition)
          .attr("transform", (_d: any, i: number) => `translate(0,${y(_d, i)})`);
        bar
          .select("rect")
          .transition(transition)
          .attr("width", (d: any) => x(d.gdp) - margin.left)
          .attr("fill", (d: any) =>
            countryFocus && d.country === countryFocus
              ? "#FA003F"
              : regionColors(d.region)
          );
      } else {
        bar
          .select("rect")
          .attr("width", (d: any) => x(d.gdp) - margin.left)
          .attr("fill", (d: any) =>
            countryFocus && d.country === countryFocus
              ? "#FA003F"
              : regionColors(d.region)
          );
      }
    };
  };

  // Animation (barres)
  useEffect(() => {
    if (!playing || !year || data.length === 0 || years.length === 0) return;
    let animating = true;
    const tick = () => {
      onYearChange((prev: number) => {
        if (!playingRef.current || !animating) return prev;
        const idx = years.indexOf(yearRef.current ?? years[0]);
        if (idx < years.length - 1) {
          const target = years[idx + 1];
          if (prev < target) {
            const next = Math.min(prev + 0.015, target);
            return next;
          } else {
            return target;
          }
        } else {
          setPlaying(false);
          return prev;
        }
      });
      if (playingRef.current && animating) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      animating = false;
    };
  }, [playing, year, years, data, onYearChange, setPlaying]);

  // RENDER + TOOLTIP
  useEffect(() => {
    if (!svgRef.current || data.length === 0 || years.length === 0) return;

    const yearFloat = animValue;
    const y1 = Math.floor(yearFloat);
    const y2 = Math.ceil(yearFloat);
    const t = yearFloat - y1;

    const y1Clamped = Math.max(years[0], Math.min(years[years.length - 1], y1));
    const y2Clamped = Math.max(years[0], Math.min(years[years.length - 1], y2));

    const regionsArray = getRegionsArray();

    const kf1 = createKeyframes(data, [y1Clamped], regionsArray)[0] as [number, CountryData[], number];
    const kf2 = createKeyframes(data, [y2Clamped], regionsArray)[0] as [number, CountryData[], number];

    // Interpolation pays par pays
    const mergedCountries = new Map<string, any>();
    if (kf1 && Array.isArray(kf1[1])) for (const d of kf1[1]) mergedCountries.set(d.country, { ...d, gdp1: d.gdp, gdp2: 0 });
    if (kf2 && Array.isArray(kf2[1])) for (const d of kf2[1]) {
      if (mergedCountries.has(d.country))
        mergedCountries.get(d.country)!.gdp2 = d.gdp;
      else
        mergedCountries.set(d.country, { ...d, gdp1: 0, gdp2: d.gdp });
    }

    const interpData = Array.from(mergedCountries.values())
      .map((d) => ({ ...d, gdp: d.gdp1 * (1 - t) + d.gdp2 * t }))
      .filter((d) => d.gdp > 0)
      .sort((a, b) => b.gdp - a.gdp);

    const interpTop = interpData.slice(0, topN);
    const interpMax = Math.max(...interpTop.map((d) => d.gdp), 1);
    const interpYear = y1Clamped * (1 - t) + y2Clamped * t;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height);
    svg.selectAll("*").remove();

    const updateBars = bars(svg);
    const updateLabels = labels(svg);

    const keyframeInterp: [number, CountryData[], number] = [interpYear, interpTop, interpMax];
    updateBars(keyframeInterp, null);
    updateLabels(keyframeInterp, null);

    // Axe X formaté
    const x = d3.scaleLinear()
      .range([margin.left, width - margin.right])
      .domain([0, interpMax * 1.08]);

    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${margin.top - 10})`)
      .call(
        d3.axisTop(x)
          .ticks(5)
          .tickFormat(d => isPerCapita
            ? `$${formatNumberSpace(Number(d))}`
            : `$${formatNumberSpace(Math.round(Number(d) / 1e6) / 1e3)}B`
          )
      )
      .selectAll("text")
      .attr("font-size", 14)
      .attr("fill", "#fff")
      .attr("font-family", "Inter, sans-serif");
  }, [animValue, selectedRegions, data, years, countryFocus, isPerCapita, width, height]);

  // --- Sélection régions
  const toggleRegion = (region: string) => {
    if (region === "Other") return;
    setSelectedRegions(current => {
      if (!current || current.length === 0) {
        return [region];
      }
      if (current.includes(region)) {
        const next = current.filter((r) => r !== region);
        return next.length === 0 ? null : next;
      } else {
        return [...current, region];
      }
    });
  };
  const selectAllRegions = () => {
    setSelectedRegions(null);
  };

  function handlePlayPause() {
    if (playing) {
      const snapped = Math.round(animValue);
      onYearChange(snapped);
      setPlaying(false);
    } else {
      if (animValue >= years[years.length - 1] - 0.01) {
        onYearChange(years[0]);
        setTimeout(() => setPlaying(true), 0);
      } else {
        setPlaying(true);
      }
    }
  }

  const countryList = Array.from(
    new Set(
      data
        .filter(
          (d) =>
            years.includes(d.year) &&
            d.region &&
            d.region !== "Other"
        )
        .map((d) => d.country)
    )
  ).sort();

  if (!year || years.length === 0) return <div>Loading…</div>;

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 mt-4 w-full">
      <div className="flex flex-wrap gap-3 justify-center p-4 rounded-2xl bg-white/10 shadow-2xl backdrop-blur-md">
        <button
          onClick={selectAllRegions}
          className={`region-btn${!selectedRegions || selectedRegions.length === 0 ? " region-btn--active" : ""}`}
        >
          🌍 World
        </button>
        {regionListClean.map((region) => (
          <button
            key={region}
            onClick={() => toggleRegion(region)}
            className={`region-btn${
              selectedRegions &&
              selectedRegions.length > 0 &&
              selectedRegions.includes(region)
                ? " region-btn--active"
                : ""
            }`}
            style={
              selectedRegions &&
              selectedRegions.length > 0 &&
              selectedRegions.includes(region)
                ? {
                    background: `${regionColors(region)}22`,
                    boxShadow: `0 0 0 3px ${regionColors(region)}80, 0 4px 24px #2223`,
                  }
                : {}
            }
          >
            {region}
          </button>
        ))}
      </div>

      <div className="center-controls-wrapper flex items-center gap-4 w-full" style={{ minWidth: 320, maxWidth: 1280, margin: "0 auto" }}>
        <div className="shrink-0 flex items-center">
          <PlayPauseButton
            playing={playing}
            onClick={handlePlayPause}
            size={48}
            disabled={years.length < 2}
          />
        </div>
        <div className="flex-1 flex items-center">
          <input
            type="range"
            min={years[0]}
            max={years[years.length - 1]}
            step={0.01}
            value={animValue}
            onChange={(e) => onYearChange(Math.round(Number(e.target.value)))}
            className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer"
            style={{ minWidth: 120, maxWidth: 350 }}
          />
        </div>
        <div>
          <select
            value={Math.round(animValue)}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="select-glass ml-3 px-3 py-2"
            style={{ minWidth: 80 }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 flex justify-end items-center min-w-[130px] ml-3">
          <select
            value={countryFocus ?? ""}
            onChange={(e) => setCountryFocus(e.target.value || null)}
            className="select-glass px-3 py-2 min-w-[100px]"
          >
            <option value="">Focused Country</option>
            {countryList.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          {countryFocus && (
            <span
              onClick={() => setCountryFocus(null)}
              className="ml-2 text-white text-sm cursor-pointer select-none inline-flex items-center"
              style={{ padding: "3px 10px" }}
              title="Clear"
            >
              Clear
            </span>
          )}
        </div>
      </div>
      <svg ref={svgRef} onMouseLeave={hideTooltip}></svg>
      {/* Tooltip HTML (en dehors du SVG) */}
      {tooltip.show && (
        <div
          style={{
            position: "fixed",
            pointerEvents: "none",
            top: tooltip.y - 70,
            left: tooltip.x - 100,
            background: "rgba(22,28,40,0.97)",
            color: "#fff",
            borderRadius: 10,
            padding: "9px 15px",
            fontSize: 16,
            fontFamily: "Inter, Arial, sans-serif",
            fontWeight: 300,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            minWidth: 120,
            zIndex: 1001,
            boxShadow: "0 4px 24px #1116"
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  );
}
