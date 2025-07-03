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
const topN = 20;
const MIN_BAR_LABEL_WIDTH = 100;

interface CountryData {
  year: number;
  gdp: number;
  country: string;
  region: string;
  [key: string]: any;
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
  const sliderRef = useRef<HTMLInputElement | null>(null);

  // Responsive container
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 });
  useEffect(() => {
    function handleResize() {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth || 1200;
      const totalHeight = containerRef.current.offsetHeight || 600;
      const controlsHeight = 185;
      const height = Math.max(
        320,
        totalHeight - controlsHeight,
        topN * (barHeight + barPadding) + margin.top + margin.bottom
      );
      setContainerSize({
        width: Math.max(360, width),
        height: Math.round(height),
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

  // Région
  const regionListClean = REGION_LIST.filter(r => r !== "Other");
  const safeSelectedRegions =
    !selectedRegions || selectedRegions.length === 0
      ? regionListClean
      : selectedRegions.filter((r) => r !== "Other");

  function handleRegionToggle(region: string) {
    if (region === "Other") return;
    setSelectedRegions((current) => {
      if (!current || current === null) return [region];
      if (current.includes(region)) {
        const next = current.filter((r) => r !== region);
        return next.length === 0 ? null : next;
      } else {
        return [...current, region];
      }
    });
  }
  function handleRegionClick(region: string) {
    if (region === "Other") return;
    setSelectedRegions((current) => {
      if (!current || current === null) return [region];
      if (current.includes(region)) return current;
      return [...current, region];
    });
  }
  function handleWorldClick() {
    setSelectedRegions(null);
  }

  // Animation (autoplay)
  const playingRef = useRef(playing);
  const yearRef = useRef(year);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { yearRef.current = year; }, [year]);
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

  // Tooltip
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: "" });

  // Focus GDP à afficher (synchronisé à chaque render)
  const [focusGDP, setFocusGDP] = useState<string>("");

  // ------- D3 render main -------
  useEffect(() => {
    if (!svgRef.current || data.length === 0 || years.length === 0) return;

    // --- Interpolation bar chart ---
    const yearFloat = animValue;
    const y1 = Math.floor(yearFloat);
    const y2 = Math.ceil(yearFloat);
    const t = animValue - y1;
    const y1Clamped = Math.max(years[0], Math.min(years[years.length - 1], y1));
    const y2Clamped = Math.max(years[0], Math.min(years[years.length - 1], y2));
    const regionsArray = safeSelectedRegions;

    function createKeyframe(yearVal: number) {
      let yearData = data.filter(
        (d) =>
          d.year === yearVal &&
          d.gdp > 0 &&
          d.region && d.region !== "Other" &&
          regionsArray.includes(d.region)
      );
      const sorted = yearData
        .sort((a, b) => b.gdp - a.gdp)
        .slice(0, topN)
        .map((d, i) => ({ ...d, rank: i }));
      const maxValue = Math.max(0, ...sorted.map((d) => d.gdp));
      return [yearVal, sorted, maxValue] as [number, CountryData[], number];
    }
    const kf1 = createKeyframe(y1Clamped);
    const kf2 = createKeyframe(y2Clamped);

    const mergedCountries = new Map<string, any>();
    if (kf1 && Array.isArray(kf1[1])) for (const d of kf1[1]) mergedCountries.set(d.country, { ...d, gdp1: d.gdp, gdp2: 0 });
    if (kf2 && Array.isArray(kf2[1])) for (const d of kf2[1]) {
      if (mergedCountries.has(d.country))
        mergedCountries.get(d.country)!.gdp2 = d.gdp;
      else
        mergedCountries.set(d.country, { ...d, gdp1: 0, gdp2: d.gdp });
    }
    const interpTop = Array.from(mergedCountries.values())
      .map((d) => ({ ...d, gdp: d.gdp1 * (1 - t) + d.gdp2 * t }))
      .filter((d) => d.gdp > 0)
      .sort((a, b) => b.gdp - a.gdp)
      .slice(0, topN);

    // GDP du pays focus à afficher (live) — même s’il n’est pas dans le topN
    if (countryFocus) {
      const focus = interpTop.find(d => d.country === countryFocus);
      if (focus) {
        setFocusGDP(
          isPerCapita
            ? `$${formatNumberSpace(focus.gdp)}`
            : `$${formatNumberSpace(Math.round(focus.gdp / 1e9))}B`
        );
      } else {
        // Cherche le GDP dans toute la donnée pour l’année actuelle (interpolé)
        const d1 = data.find(
          d =>
            d.country === countryFocus &&
            d.year === y1 &&
            d.gdp > 0 &&
            d.region &&
            d.region !== "Other"
        );
        const d2 = data.find(
          d =>
            d.country === countryFocus &&
            d.year === y2 &&
            d.gdp > 0 &&
            d.region &&
            d.region !== "Other"
        );
        let gdpInterp = null;
        if (d1 && d2) {
          gdpInterp = d1.gdp * (1 - t) + d2.gdp * t;
        } else if (d1) {
          gdpInterp = d1.gdp;
        } else if (d2) {
          gdpInterp = d2.gdp;
        }
        if (gdpInterp) {
          setFocusGDP(
            isPerCapita
              ? `$${formatNumberSpace(gdpInterp)}`
              : `$${formatNumberSpace(Math.round(gdpInterp / 1e9))}B`
          );
        } else {
          setFocusGDP("—");
        }
      }
    } else {
      setFocusGDP("");
    }

    // ----- RENDER D3 -----
    const interpMax = Math.max(...interpTop.map((d) => d.gdp), 1);
    const x = d3.scaleLinear().range([margin.left, width - margin.right]);
    const y = (_d: any, i: number) => margin.top + i * (barHeight + barPadding);
    x.domain([0, interpMax * 1.08]);
    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height);
    svg.selectAll("*").remove();

    // Bars
    svg
      .selectAll("g.bar")
      .data(interpTop, (d: any) => d.country)
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
            .on("click", (_e: any, d: any) => setCountryFocus(d.country));
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
            )
            .on("click", (_e: any, d: any) => setCountryFocus(d.country));
          return update;
        },
        (exit: any) => exit.remove()
      )
      .select("rect")
      .attr("width", (d: any) => x(d.gdp) - margin.left)
      .attr("fill", (d: any) =>
        countryFocus && d.country === countryFocus
          ? "#FA003F"
          : regionColors(d.region)
      )
      .on("click", (_e: any, d: any) => setCountryFocus(d.country));

    // Labels
    svg.selectAll("text.country-label").remove();
    svg.selectAll("text.value-label").remove();
    interpTop.forEach((d: any, i: number) => {
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
        : `$${formatNumberSpace(Math.round(d.gdp / 1e9))}B`;
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

    // Axe X
    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${margin.top - 10})`)
      .call(
        d3.axisTop(x)
          .ticks(5)
          .tickFormat(d => isPerCapita
            ? `$${formatNumberSpace(Number(d))}`
            : `$${formatNumberSpace(Math.round(Number(d) / 1e9))}B`
          )
      )
      .selectAll("text")
      .attr("font-size", 14)
      .attr("fill", "#fff")
      .attr("font-family", "Inter, sans-serif");

    // Tooltip live (affichage)
    if (!playing && mousePos && svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const mouseY = mousePos.y - svgRect.top;
      const i = Math.floor((mouseY - margin.top) / (barHeight + barPadding));
      if (i >= 0 && i < interpTop.length) {
        const d = interpTop[i];
        let valueLabel = isPerCapita
          ? `$${formatNumberSpace(d.gdp)}`
          : `$${formatNumberSpace(Math.round(d.gdp / 1e9))}B`;
        setTooltip({
          show: true,
          x: mousePos.x + 20,
          y: mousePos.y - 20,
          content: `<b>${d.country}</b><br>${valueLabel}`,
        });
      } else {
        setTooltip({ show: false, x: 0, y: 0, content: "" });
      }
    } else {
      setTooltip({ show: false, x: 0, y: 0, content: "" });
    }
  }, [
    animValue,
    mousePos,
    selectedRegions,
    data,
    years,
    countryFocus,
    isPerCapita,
    width,
    height,
    playing,
  ]);

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

  const selectedArr = Array.isArray(selectedRegions) ? selectedRegions : [];

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center gap-4 mt-4 w-full"
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Boutons région */}
      <div className="flex flex-wrap gap-3 justify-center p-4 rounded-2xl">
        <button
          onClick={handleWorldClick}
          className={`region-btn${!selectedRegions || selectedRegions.length === 0 ? " region-btn--active" : ""}`}
        >
          🌍 World
        </button>
        {regionListClean.map((region) => {
          const isActive = selectedArr.includes(region);
          return (
            <button
              key={region}
              data-region={region}
              onClick={() =>
                isActive ? handleRegionToggle(region) : handleRegionClick(region)
              }
              className={[
                "region-btn",
                isActive ? "region-btn--active" : "",
              ].join(" ")}
              style={
                isActive
                  ? {
                      background: `${regionColors(region)}22`,
                      boxShadow: `0 0 0 3px ${regionColors(region)}80, 0 4px 24px #2223`,
                    }
                  : {}
              }
            >
              {region}
            </button>
          );
        })}
      </div>

      {/* Contrôles alignés */}
      <div
        className="center-controls-wrapper flex items-center gap-4 w-full"
        style={{
          minWidth: 300,
          maxWidth: 1280,
          margin: "0 auto",
          padding: "6px 0",
          fontSize: 13,
          lineHeight: "1.2",
        }}
      >
        <div className="shrink-0 flex items-center">
          <PlayPauseButton
            playing={playing}
            onClick={handlePlayPause}
            size={34}
            disabled={years.length < 2}
          />
        </div>
        {/* Slider */}
        <div className="flex-1 flex items-center justify-center min-w-[120px]">
          <input
            ref={sliderRef}
            type="range"
            min={years[0]}
            max={years[years.length - 1]}
            step={0.01}
            value={animValue}
            onChange={(e) => onYearChange(Math.round(Number(e.target.value)))}
            className="w-full h-1.5 bg-white/30 rounded-lg accent-blue-400"
            style={{ minWidth: 90, maxWidth: 250, height: 5 }}
          />
        </div>
        {/* Année */}
        <div className="flex flex-col justify-center items-center min-w-[60px]">
          <select
            value={Math.round(animValue)}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="select-glass px-2 py-1 text-[1rem] font-semibold text-center"
            style={{ minWidth: 48, fontSize: 15, padding: "3px 8px" }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {/* Focus Country + PIB + Clear (style TreeMap) */}
        <div className="flex flex-row items-center min-w-[250px] ml-2" style={{ marginTop: 0 }}>
          <select
            value={countryFocus ?? ""}
            onChange={(e) => setCountryFocus(e.target.value || null)}
            className="select-glass px-2 py-1 min-w-[100px]"
            style={{ fontSize: 14, padding: "2px 8px" }}
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
              className="text-white text-xs select-none"
              style={{
                padding: "1px 9px",
                marginLeft: 7,
                marginRight: 5,
                fontSize: 15,
                fontWeight: 500,
                fontFamily: "Inter, Arial, sans-serif",
                letterSpacing: "0.04em",
                background: "rgba(255,255,255,0.09)",
                borderRadius: 7,
                minWidth: 80,
                display: "inline-block",
                textAlign: "center",
                lineHeight: "1.25",
                opacity: 0.93,
              }}
              title="GDP at this year"
            >
              {focusGDP || "—"}
            </span>
          )}
          {countryFocus && (
            <button
              onClick={() => setCountryFocus(null)}
              className="ml-2 text-white text-sm cursor-pointer select-none inline-flex items-center"
              style={{
                color: "#fff",  
                padding: "3px 12px",
                borderRadius: 8,
                border: "none",
                background: "#f9013f",
                marginLeft: 7,
                marginRight: 3,
                fontWeight: 400,
                fontFamily: "Inter, Arial, sans-serif",
                fontSize: 15,
                lineHeight: "1.25",
                transition: "background 0.18s",
              }}
              title="Clear"
              onMouseOver={e => (e.currentTarget.style.background = "#f9013f")}
              onMouseOut={e => (e.currentTarget.style.background = "#f9013f")}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {/* SVG */}
      <div
        className="w-full overflow-x-auto"
        style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}
      >
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{
            display: "block",
            minWidth: 360,
            minHeight: 320,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
          onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setMousePos(null)}
        ></svg>
      </div>
      {/* Tooltip */}
      {!playing && tooltip.show && (
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
